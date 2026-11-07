const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const statePath = path.join(__dirname, 'window-state.json')
const heartbeatPath = path.join(__dirname, 'heartbeat.json')
let beatTimer = 0
function writeHeartbeat() {
  if (!win) return
  try {
    const url = win.webContents.getURL() || targetUrl
    fs.writeFileSync(heartbeatPath, JSON.stringify({ pid: process.pid, at: Date.now(), url }))
  } catch (err) {}
}
function clearHeartbeat() { try { fs.unlinkSync(heartbeatPath) } catch (err) {} }
function loadWindowState() {
  try { return JSON.parse(fs.readFileSync(statePath, 'utf8')) } catch (err) { return null }
}
let saveTimer = 0
function saveWindowState() {
  if (!win) return
  try {
    const b = win.getBounds()
    fs.writeFileSync(statePath, JSON.stringify({ x: b.x, y: b.y, w: b.width, h: b.height }))
  } catch (err) {}
}
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveWindowState, 400)
}

const args = process.argv.slice(1)
function argValue(name, fallback) {
  for (const a of args) if (a.indexOf(name + '=') === 0) return a.slice(name.length + 1)
  return fallback
}

const targetUrl = argValue('--url', '')
const startSize = Math.max(72, Math.min(480, Number(argValue('--size', '180')) || 180))
let win = null

function createWindow() {
  const area = screen.getPrimaryDisplay().workArea
  const saved = loadWindowState()
  const w = saved && Number(saved.w) > 0 ? Math.max(72, Math.min(480, Number(saved.w))) : startSize
  win = new BrowserWindow({
    width: w,
    height: w,
    x: saved && Number.isFinite(saved.x) ? Math.round(saved.x) : area.x + area.width - w - 24,
    y: saved && Number.isFinite(saved.y) ? Math.round(saved.y) : area.y + area.height - w - 48,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  if (targetUrl) win.loadURL(targetUrl)
  win.webContents.on('did-finish-load', writeHeartbeat)
  // 加载失败（宿主还没起来/端口已变）时撤掉心跳，宿主下次巡检就会重新拉起窗口。
  win.webContents.on('did-fail-load', () => { clearHeartbeat() })
  win.on('move', scheduleSave)
  win.on('resize', scheduleSave)
  win.on('closed', () => { saveWindowState(); clearHeartbeat(); win = null })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine) => {
    // A new DSH host may have a different port: adopt its URL in the existing window.
    const urlArg = (commandLine || []).find((a) => a.indexOf('--url=') === 0)
    if (urlArg && win) {
      const url = urlArg.slice(6)
      // 只有端口真的变了才重新加载；以前每次 second-instance 都 loadURL，宿主每 10 秒
      // 重复 spawn 时会把桌宠刷成幻灯片。
      if (win.webContents.getURL() !== url) win.loadURL(url).catch(() => {})
    }
    if (win) { if (win.isMinimized()) win.restore(); win.showInactive() }
    writeHeartbeat()
  })
  app.whenReady().then(() => {
    createWindow()
    writeHeartbeat()
    beatTimer = setInterval(writeHeartbeat, 2000)
  })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => {
    if (beatTimer) clearInterval(beatTimer)
    if (saveTimer) clearTimeout(saveTimer)
    saveWindowState()
    clearHeartbeat()
  })
}

ipcMain.on('whale-pet:move', (event, dx, dy) => {
  if (!win) return
  const b = win.getBounds()
  win.setBounds({ x: Math.round(b.x + Number(dx || 0)), y: Math.round(b.y + Number(dy || 0)), width: b.width, height: b.height })
})

ipcMain.on('whale-pet:size', (event, size) => {
  if (!win) return
  const s = Math.max(72, Math.min(480, Number(size) || 180))
  const b = win.getBounds()
  win.setBounds({ x: b.x, y: b.y, width: s, height: s })
})

ipcMain.on('whale-pet:menu', () => {
  if (!win) return
  const send = (cmd) => { try { win.webContents.send('whale-pet:command', cmd) } catch (err) {} }
  const menu = Menu.buildFromTemplate([
    { label: '按住 Ctrl 拖动桌宠', enabled: false },
    { type: 'separator' },
    { label: '放大', click: () => send('zoom-in') },
    { label: '缩小', click: () => send('zoom-out') },
    { label: '恢复默认大小', click: () => send('reset-size') },
    { type: 'separator' },
    { label: '收起桌宠（可在 DSH 设置里重新打开）', click: () => send('hide') },
  ])
  menu.popup({ window: win })
})

ipcMain.on('whale-pet:close', () => { app.quit() })

ipcMain.on('whale-pet:click-through', (event, on) => {
  if (!win) return
  try { win.setIgnoreMouseEvents(!!on, { forward: true }) } catch (err) {}
})

ipcMain.on('whale-pet:hide', () => { if (win) win.hide() })

ipcMain.on('whale-pet:show', () => { if (win) win.showInactive() })

ipcMain.on('whale-pet:resize-to', (event, size) => {
  if (!win) return
  const s = Math.max(72, Math.min(480, Number(size) || 180))
  const b = win.getBounds()
  win.setBounds({ x: b.x, y: b.y, width: s, height: s })
})
