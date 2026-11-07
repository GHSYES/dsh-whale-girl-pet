import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url))
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const PET_DIR = path.join(DSH_HOME, 'pets', 'whale-girl-emoji')
const GIF_DIR = path.join(PET_DIR, 'gifs')
const STATE_DIR = path.join(DSH_HOME, 'whale-pet')
const SETTINGS_FILE = path.join(STATE_DIR, 'settings.json')
const DESKTOP_DIR = path.join(STATE_DIR, 'desktop')
const ROUTE = '/whale-pet'
const IDLE_ROTATE_MS = 30000
const CLICK_BONUS_RATE = 0.12
const TURN_BONUS_RATE = 0.18
const HAPPY_MS = 5200
const HEART_MS = 3200

const DEFAULT_SETTINGS = {
  enabled: true,
  size: 180,
  opacity: 1,
  x: null,
  y: null,
  clickThrough: false,
  badge: true,
  idle: true,
  desktop: true,
}

let settings = loadSettings()
function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
    return Object.assign({}, DEFAULT_SETTINGS, raw && typeof raw === 'object' ? raw : {})
  } catch (err) {
    return Object.assign({}, DEFAULT_SETTINGS)
  }
}
function saveSettings() {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true })
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
  } catch (err) {}
}

const FALLBACK_ANIMS = [
  { key: 'idle', title: '待机眨眼', state: 'idle', gif: '01-idle.gif' },
  { key: 'idle-look', title: '东张西望', state: 'idle', gif: '02-idle-look.gif' },
  { key: 'idle-spout', title: '开心喷水', state: 'idle', gif: '03-idle-spout.gif' },
  { key: 'thinking', title: '思考中', state: 'thinking', gif: '04-thinking.gif' },
  { key: 'typing', title: '敲代码', state: 'working', gif: '05-typing.gif' },
  { key: 'music', title: '戴耳机听歌', state: 'working', gif: '06-music.gif' },
  { key: 'conducting', title: '小鲸鱼分身', state: 'juggling', gif: '07-conducting.gif' },
  { key: 'building', title: '施工中', state: 'working', gif: '08-building.gif' },
  { key: 'error', title: '出错啦', state: 'error', gif: '09-error.gif' },
  { key: 'happy', title: '任务完成', state: 'attention', gif: '10-happy.gif' },
  { key: 'notification', title: '需要你确认', state: 'notification', gif: '11-notification.gif' },
  { key: 'compacting', title: '上下文清理', state: 'sweeping', gif: '12-compacting.gif' },
  { key: 'carrying', title: '抱书搬运', state: 'carrying', gif: '13-carrying.gif' },
  { key: 'sleeping', title: '呼呼大睡', state: 'sleeping', gif: '14-sleeping.gif' },
  { key: 'waking', title: '被吵醒', state: 'waking', gif: '15-waking.gif' },
  { key: 'poke-left', title: '戳左边', state: 'reaction', gif: '16-poke-left.gif' },
  { key: 'poke-right', title: '戳右边', state: 'reaction', gif: '17-poke-right.gif' },
  { key: 'tickle', title: '被挠痒痒', state: 'reaction', gif: '18-tickle.gif' },
  { key: 'drag', title: '被拎起来', state: 'reaction', gif: '19-drag.gif' },
  { key: 'swim', title: '游来游去', state: 'idle', gif: '20-swim.gif' },
  { key: 'smile-hearts', title: '冒爱心', state: 'bonus', gif: '21-smile-hearts.gif' },
  { key: 'thumbs-up', title: '举大拇指', state: 'bonus', gif: '22-thumbs-up.gif' },
]

function readCatalog() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(PET_DIR, 'catalog.json'), 'utf8'))
    const list = Array.isArray(raw && raw.anims) ? raw.anims : []
    const out = []
    for (const item of list) {
      const gif = String(item.gif || '')
      if (!gif) continue
      if (!fs.existsSync(path.join(GIF_DIR, gif))) continue
      out.push({
        key: String(item.key || ''),
        title: String(item.title || item.key || ''),
        state: String(item.state || 'idle'),
        trigger: String(item.trigger || ''),
        summary: String(item.summary || ''),
        gif: gif,
      })
    }
    if (out.length > 0) return out
  } catch (err) {}
  return FALLBACK_ANIMS.filter((a) => fs.existsSync(path.join(GIF_DIR, a.gif)))
}

let catalog = readCatalog()
function animOf(key) {
  for (const a of catalog) if (a.key === key) return a
  return catalog.length > 0 ? catalog[0] : null
}
const STATE_POOLS = {
  idle: ['idle', 'idle-look', 'idle-spout', 'swim', 'music', 'conducting', 'building'],
  working: ['typing', 'music', 'building'],
  attention: ['happy'],
  notification: ['notification'],
  error: ['error'],
  sweeping: ['compacting'],
  carrying: ['carrying'],
  sleeping: ['sleeping'],
  waking: ['waking'],
  thinking: ['thinking'],
  juggling: ['conducting'],
  reaction: ['poke-left', 'poke-right', 'tickle', 'drag'],
  bonus: ['smile-hearts', 'thumbs-up'],
}
function pickPool(key, now) {
  const pool = STATE_POOLS[key]
  if (!pool || pool.length === 0) return 'idle'
  const idx = Math.floor(now / IDLE_ROTATE_MS) % pool.length
  return pool[idx]
}

const sessions = new Map()
let lastActivity = Date.now()
let lastTurnEndAt = 0
let lastErrorAt = 0
let lastCompactAt = 0
let lastCarryAt = 0
let reaction = null
let forced = null
let subagents = 0
let wasSleeping = false
let completedTurns = 0
let clientOrigin = ''
let desktopChild = null

function sessionOf(sid) {
  let st = sessions.get(sid)
  if (!st) {
    st = { turns: 0, tools: new Map(), approvals: new Set(), lastTool: '', lastErrorAt: 0 }
    sessions.set(sid, st)
  }
  return st
}

function isSubagentSession(session) {
  try {
    const header = session && session.header
    return Boolean(header && header.origin === 'subagent')
  } catch (err) { return false }
}

function markError(st, now) {
  lastErrorAt = now
  if (st) st.lastErrorAt = now
}

function onSessionEvent(session, event) {
  try {
    const sid = session && session.id ? String(session.id) : 'default'
    const st = sessionOf(sid)
    const type = String((event && event.type) || '')
    const data = (event && event.data) || {}
    const now = Date.now()
    if (wasSleeping) {
      wasSleeping = false
      reaction = { key: 'waking', until: now + 1400 }
    }
    lastActivity = now
    if (/compact/i.test(type)) { lastCompactAt = now; return }
    if (/worktree/i.test(type)) { lastCarryAt = now; return }
    if (type === 'turn/start') { st.turns += 1; return }
    if (type === 'turn/end') {
      st.turns = Math.max(0, st.turns - 1)
      st.tools.clear()
      completedTurns += 1
      const reason = data.reason || {}
      const failed = Boolean(data.error) || data.stopReason === 'error' || data.status === 'error' || reason.kind === 'error'
      if (failed) { lastTurnEndAt = 0; markError(st, now) }
      else if (reason.kind === 'aborted') { lastTurnEndAt = 0 }
      else if (isSubagentSession(session)) { /* 子会话收尾不打断主会话状态 */ }
      else if (Math.random() < TURN_BONUS_RATE) {
        lastTurnEndAt = now
        completionPending = true
        reaction = { key: 'smile-hearts', until: now + HEART_MS }
      } else {
        // 主会话正常结束：先弹 5.2 秒，之后一直循环「任务完成」，直到用户点一下桌宠。
        lastTurnEndAt = now
        completionPending = true
        reaction = { key: 'happy', until: now + HAPPY_MS }
      }
      return
    }
    if (type === 'tool/call') {
      const cid = String(data.callId || data.toolCallId || data.id || (data.message && (data.message.callId || data.message.id)) || ('c' + now))
      st.tools.set(cid, String(data.name || data.toolName || ''))
      st.lastTool = String(data.name || data.toolName || '')
      return
    }
    if (type === 'tool/result') {
      const cid = String(data.callId || data.toolCallId || data.id || (data.message && (data.message.callId || data.message.id)) || '')
      if (cid && st.tools.has(cid)) st.tools.delete(cid)
      else if (st.tools.size > 0) st.tools.delete(st.tools.keys().next().value)
      const blocks = data.message && Array.isArray(data.message.content) ? data.message.content : []
      const failedBlock = blocks.some((b) => b && (b.isError === true || b.is_error === true))
      if (data.error || data.isError || failedBlock) markError(st, now)
      return
    }
    if (type === 'approval/asked') {
      st.approvals.add(String(data.id || data.requestId || ('a' + now)))
      return
    }
    if (type.indexOf('approval/') === 0) {
      const id = String(data.id || data.requestId || '')
      if (id && st.approvals.has(id)) st.approvals.delete(id)
      else st.approvals.clear()
      return
    }
    if (/error|failure/i.test(type)) markError(st, now)
  } catch (err) {}
}

function pendingApprovals() {
  let n = 0
  for (const st of sessions.values()) n += st.approvals.size
  return n
}
function toolSessionCount() {
  let n = 0
  for (const st of sessions.values()) if (st.tools.size > 0) n += 1
  return n
}
function anyTurnActive() {
  for (const st of sessions.values()) if (st.turns > 0) return true
  return false
}

function currentState() {
  const now = Date.now()
  if (forced && forced.until > now) return { key: forced.key, reason: 'forced' }
  if (reaction && reaction.until > now) return { key: reaction.key, reason: 'reaction' }
  if (pendingApprovals() > 0) return { key: 'notification', reason: 'approval' }
  if (now - lastErrorAt < 4500) return { key: 'error', reason: 'error' }
  if (now - lastCompactAt < 4200) return { key: 'compacting', reason: 'compacting' }
  if (now - lastCarryAt < 4200) return { key: 'carrying', reason: 'worktree' }
  if (subagents >= 2) return { key: 'conducting', reason: 'subagents' }
  const working = toolSessionCount()
  if (working >= 3) return { key: 'building', reason: 'working3' }
  if (working === 2) return { key: 'music', reason: 'working2' }
  if (working === 1) return { key: 'typing', reason: 'working1' }
  if (anyTurnActive()) return { key: 'thinking', reason: 'turn' }
  if (completionPending) return { key: 'happy', reason: 'completion-ack' }
  if (now - lastTurnEndAt < HAPPY_MS) return { key: 'happy', reason: 'turn-end' }
  if (now - lastActivity > 60000) {
    wasSleeping = true
    return { key: 'sleeping', reason: 'idle-long' }
  }
  if (settings.idle === false) return { key: 'idle', reason: 'idle-static' }
  return { key: pickPool('idle', now), reason: 'idle' }
}

function statePayload() {
  const s = currentState()
  const anim = animOf(s.key) || animOf('idle')
  return {
    ok: true,
    key: s.key,
    reason: s.reason,
    state: anim ? anim.state : 'idle',
    title: anim ? anim.title : '',
    gif: anim ? ROUTE + '/assets/' + anim.gif : '',
    settings: settings,
    detail: {
      tools: toolSessionCount(),
      approvals: pendingApprovals(),
      subagents: subagents,
      turns: anyTurnActive(),
      completedTurns: completedTurns,
      sessions: sessions.size,
      electron: electronPath() ? 'ready' : 'missing',
    },
    now: Date.now(),
  }
}

function electronPath() {
  const candidates = [
    process.env.WHALE_PET_ELECTRON,
    path.join(DSH_HOME, 'dsh-orb', 'electron-runtime', 'electron.exe'),
    path.join(DSH_HOME, 'dsh-orb', 'electron-runtime', 'electron'),
    path.join(DSH_HOME, 'pets', '.runtime', 'electron.exe'),
  ]
  for (const p of candidates) {
    if (!p) continue
    try { if (fs.statSync(p).isFile()) return p } catch (err) {}
  }
  return ''
}

function writeDesktopApp() {
  fs.mkdirSync(DESKTOP_DIR, { recursive: true })
  const src = path.join(PACKAGE_ROOT, 'desktop')
  fs.copyFileSync(path.join(src, 'main.js'), path.join(DESKTOP_DIR, 'main.js'))
  fs.copyFileSync(path.join(src, 'preload.js'), path.join(DESKTOP_DIR, 'preload.js'))
  fs.writeFileSync(path.join(DESKTOP_DIR, 'package.json'), JSON.stringify({ name: 'whale-pet-desktop', version: '0.1.0', main: 'main.js' }, null, 2))
}

let desktopStartedAt = 0
function logSpawn(msg) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true })
    fs.appendFileSync(path.join(STATE_DIR, 'spawn.log'), new Date().toISOString() + ' ' + msg + '\n')
  } catch (err) {}
}
let desktopOrigin = ''

function ensureDesktop() {
  const exe = electronPath()
  if (!exe || !clientOrigin) { logSpawn('skip exe=' + exe + ' origin=' + clientOrigin); return false }
  if (desktopChild && desktopChild.exitCode === null) {
    if (desktopOrigin === clientOrigin) return true
    logSpawn('origin changed, restart desktop old=' + desktopOrigin + ' new=' + clientOrigin)
    stopDesktop()
    desktopStartedAt = 0
  }
  if (Date.now() - desktopStartedAt < 8000) return true
  try {
    writeDesktopApp()
    const url = clientOrigin + ROUTE + '/standalone'
    const env = Object.assign({}, process.env)
    delete env.ELECTRON_RUN_AS_NODE
    delete env.ELECTRON_NO_ATTACH_CONSOLE
    let stdio = 'ignore'
    try {
      const logPath = path.join(STATE_DIR, 'desktop.log')
      const fd = fs.openSync(logPath, 'a')
      stdio = ['ignore', fd, fd]
    } catch (err) {}
    desktopStartedAt = Date.now()
    desktopOrigin = clientOrigin
    desktopChild = spawn(exe, [DESKTOP_DIR, '--url=' + url, '--size=' + String(settings.size)], { detached: true, windowsHide: true, stdio: stdio, env: env })
    logSpawn('spawn pid=' + (desktopChild && desktopChild.pid) + ' url=' + url)
    desktopChild.on('error', (err) => { logSpawn('child error ' + (err && err.message)); desktopChild = null })
    desktopChild.on('exit', (code) => { logSpawn('child exit ' + code); desktopChild = null })
    desktopChild.unref()
    return true
  } catch (err) {
    logSpawn('spawn throw ' + (err && err.message))
    desktopChild = null
    return false
  }
}

function stopDesktop() {
  if (desktopChild && desktopChild.exitCode === null) {
    try { desktopChild.kill() } catch (err) {}
  }
  desktopChild = null
  desktopOrigin = ''
}

const MIME = {
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

function sendJson(res, code, body) {
  const text = JSON.stringify(body)
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' })
  res.end(text)
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 200000) raw = raw.slice(0, 200000) })
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')) } catch (err) { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

function serveGif(res, name) {
  const safe = path.basename(String(name || ''))
  const file = path.join(GIF_DIR, safe)
  let buf
  try { buf = fs.readFileSync(file) } catch (err) { res.writeHead(404); res.end('not found'); return }
  res.writeHead(200, { 'content-type': MIME[path.extname(safe).toLowerCase()] || 'application/octet-stream', 'cache-control': 'public, max-age=3600' })
  res.end(buf)
}

function standaloneHtml() {
  const payload = JSON.stringify({ settings: settings, route: ROUTE })
  return '<!doctype html><html><head><meta charset="utf-8"><title>whale pet</title>'
    + '<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;height:100%;width:100%;}'
    + 'body{user-select:none;cursor:default;}'
    + '#wrap{position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:center;}'
    + 'img{width:100%;height:auto;user-select:none;-webkit-user-drag:none;image-rendering:pixelated;filter:drop-shadow(0 6px 10px rgba(0,0,0,.25));}'
    + '</style></head><body><div id="wrap"><img id="pet" alt="鲸娘桌宠"></div>'
    + '<script>window.__WHALE_PET__ = ' + payload + ';</' + 'script>'
    + '<script src="' + ROUTE + '/standalone.js"></' + 'script>'
    + '</body></html>'
}

function handle(req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  const pathname = url.pathname
  if (pathname === ROUTE + '/api/state') { sendJson(res, 200, statePayload()); return }
  if (pathname === ROUTE + '/api/catalog') { catalog = readCatalog(); sendJson(res, 200, { ok: true, catalog: catalog, petDir: PET_DIR, electron: electronPath() ? 'ready' : 'missing' }); return }
  if (pathname === ROUTE + '/api/hello') {
    readBody(req).then((body) => {
      const origin = String(body.origin || '')
      if (/^https?:\/\/[^\s]+$/.test(origin)) {
        const changed = clientOrigin !== origin
        clientOrigin = origin
        if (settings.origin !== origin) { settings.origin = origin; saveSettings() }
        if (changed && desktopChild) stopDesktop()
        ensureDesktop()
      }
      sendJson(res, 200, { ok: true, desktop: settings.desktop === true, electron: electronPath() ? 'ready' : 'missing' })
    })
    return
  }
  if (pathname === ROUTE + '/api/settings') {
    if (req.method === 'POST') {
      readBody(req).then((body) => {
        for (const k of Object.keys(DEFAULT_SETTINGS)) {
          if (body && Object.prototype.hasOwnProperty.call(body, k)) settings[k] = body[k]
        }
        settings.size = Math.max(72, Math.min(480, Number(settings.size) || 180))
        settings.opacity = Math.max(0.2, Math.min(1, Number(settings.opacity) || 1))
        saveSettings()
        if (settings.desktop === true) ensureDesktop(); else if (body && body.desktop === false) stopDesktop()
        sendJson(res, 200, { ok: true, settings: settings, electron: electronPath() ? 'ready' : 'missing' })
      })
      return
    }
    sendJson(res, 200, { ok: true, settings: settings, electron: electronPath() ? 'ready' : 'missing' })
    return
  }
  if (pathname === ROUTE + '/api/interaction') {
    readBody(req).then((body) => {
      const kind = String(body.kind || '')
      const now = Date.now()
      const wasCompletion = completionPending
      if (kind === 'poke-left' || kind === 'poke-right' || kind === 'tickle' || kind === 'waking') completionPending = false
      const durations = { 'poke-left': 900, 'poke-right': 900, tickle: 1700, drag: 60000, 'drag-end': 0, waking: 1300, 'smile-hearts': 2600, 'thumbs-up': 3200, happy: 2400 }
      if (kind === 'drag-end') { if (reaction && reaction.key === 'drag') reaction = null; sendJson(res, 200, { ok: true }); return }
      if (kind === 'hide') { settings.enabled = false; saveSettings(); sendJson(res, 200, { ok: true }); return }
      if (kind === 'show') { settings.enabled = true; saveSettings(); sendJson(res, 200, { ok: true }); return }
      if (wasCompletion && (kind === 'poke-left' || kind === 'poke-right')) {
        // 点击确认「任务完成」：播一次点赞 GIF，之后回到正常状态机。
        reaction = { key: 'thumbs-up', until: now + 3200 }
        sendJson(res, 200, { ok: true, key: 'thumbs-up', acknowledged: true })
        return
      }
      if (kind && Object.prototype.hasOwnProperty.call(durations, kind) && durations[kind] > 0) {
        const clickBonus = (kind === 'poke-left' || kind === 'poke-right') && Math.random() < CLICK_BONUS_RATE
        reaction = clickBonus
          ? { key: 'smile-hearts', until: now + 2600 }
          : { key: kind, until: now + durations[kind] }
      }
      sendJson(res, 200, { ok: true, key: kind })
    })
    return
  }
  if (pathname === ROUTE + '/api/desktop') {
    readBody(req).then((body) => {
      if (body && body.open === false) { settings.desktop = false; saveSettings(); stopDesktop(); sendJson(res, 200, { ok: true, desktop: false }); return }
      settings.desktop = true; saveSettings()
      const ok = ensureDesktop()
      sendJson(res, 200, { ok: ok, desktop: true, electron: electronPath() ? 'ready' : 'missing' })
    })
    return
  }
  if (pathname === ROUTE + '/api/preview') {
    readBody(req).then((body) => {
      const key = String(body.key || '')
      forced = key ? { key: key, until: Date.now() + 3000 } : null
      sendJson(res, 200, { ok: true, key: key })
    })
    return
  }
  if (pathname === ROUTE + '/standalone.js') {
    try {
      const buf = fs.readFileSync(path.join(PACKAGE_ROOT, 'standalone.js'))
      res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store' })
      res.end(buf)
    } catch (err) { res.writeHead(404); res.end('not found') }
    return
  }
  if (pathname === ROUTE + '/standalone') {
    res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' })
    res.end(standaloneHtml())
    return
  }
  if (pathname.indexOf(ROUTE + '/assets/') === 0) { serveGif(res, pathname.slice((ROUTE + '/assets/').length)); return }
  if (pathname === ROUTE + '/client.js') {
    try {
      const buf = fs.readFileSync(path.join(PACKAGE_ROOT, 'client.js'))
      res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store' })
      res.end(buf)
    } catch (err) { res.writeHead(404); res.end('not found') }
    return
  }
  res.writeHead(404)
  res.end('not found')
}

let archivedPrev = null
let completionPending = false

let workbenchOrigin = ''
let workbenchSeen = null
let workbenchTimer = null

function startWorkbenchWatch(origin) {
  if (!origin || !/^https?:\/\//.test(origin)) return
  if (workbenchTimer && workbenchOrigin === origin) return
  if (workbenchTimer) { clearInterval(workbenchTimer); workbenchTimer = null }
  workbenchOrigin = origin
  workbenchSeen = null
  workbenchTimer = setInterval(pollWorkbench, 2000)
  if (workbenchTimer.unref) workbenchTimer.unref()
  setTimeout(pollWorkbench, 1500)
}

async function pollWorkbench() {
  const origin = workbenchOrigin
  if (!origin) return
  try {
    const res = await fetch(origin + '/api/workbench/tasks', { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(2500) })
    if (!res.ok) return
    const json = await res.json()
    const tasks = Array.isArray(json && json.tasks) ? json.tasks : []
    const done = new Set()
    for (const task of tasks) {
      if (task && task.id && task.statusCode === 'done') done.add(String(task.id))
    }
    if (workbenchSeen === null) { workbenchSeen = done; return }
    let fresh = false
    for (const id of done) {
      if (!workbenchSeen.has(id)) { fresh = true; workbenchSeen.add(id) }
    }
    if (fresh) {
      // 工作台验收通过：不再自动点赞，而是进入「任务完成」循环，
      // 等用户单击一次桌宠时再播点赞 GIF。
      completionPending = true
      lastActivity = Date.now()
    }
  } catch (err) {}
}

function startRoutes(webCtx) {
  try {
    const server = webCtx.webServer
    if (!server || typeof server.register !== 'function') return
    server.register({ kind: 'prefix', path: ROUTE, handler: handle })
    try {
      const origin = typeof server.getOrigin === 'function' ? server.getOrigin() : null
      if (origin && /^https?:\/\//.test(origin)) {
        const changed = clientOrigin !== origin
        clientOrigin = origin
        if (settings.origin !== origin) { settings.origin = origin; saveSettings() }
        logSpawn('origin from webserver ' + origin)
        startWorkbenchWatch(origin)
        if (changed && desktopChild) {
          stopDesktop()
          desktopStartedAt = 0
        }
        if (settings.desktop === true) setTimeout(() => { try { ensureDesktop() } catch (err) {} }, 600)
      }
    } catch (err) {}
  } catch (err) {
    try { console.warn('[whale-pet] route registration failed: ' + (err && err.message)) } catch (e2) {}
  }
}

function onDomainChange(change) {
  try {
    if (!change || change.domain !== 'workspace' || change.table !== '' || change.operation !== 'put') return
    let value = change.value
    if (typeof value === 'string') { try { value = JSON.parse(value) } catch (err) { return } }
    if (!value || !Array.isArray(value.archivedSessionIds)) return
    const ids = value.archivedSessionIds.map(String)
    const prev = archivedPrev
    archivedPrev = new Set(ids)
    if (prev === null) return
    for (const id of ids) {
      if (!prev.has(id)) { lastCompactAt = Date.now(); lastActivity = Date.now(); return }
    }
  } catch (err) {}
}

export function apply(ctx) {
  try {
    const disposeList = []
    try {
      const registry = typeof ctx.get === 'function' ? ctx.get('workspaceRegistry') : null
      if (registry && Array.isArray(registry.archivedSessionIds)) archivedPrev = new Set(registry.archivedSessionIds.map(String))
    } catch (err) {}
    if (archivedPrev === null) archivedPrev = new Set()
    disposeList.push(ctx.on('session/event', onSessionEvent))
    try { disposeList.push(ctx.on('domain/changed', onDomainChange)) } catch (err) {}
    try { disposeList.push(ctx.on('subagent/start', () => { subagents += 1; lastActivity = Date.now() })) } catch (err) {}
    try { disposeList.push(ctx.on('subagent/end', () => { subagents = Math.max(0, subagents - 1); lastActivity = Date.now() })) } catch (err) {}
    try { disposeList.push(ctx.on('session/disposed', (session) => { if (session && session.id) sessions.delete(String(session.id)) })) } catch (err) {}
    if (typeof ctx.effect === 'function') {
      ctx.effect(() => () => { for (const off of disposeList) { try { off() } catch (err) {} } stopDesktop() }, 'whale-pet: listeners')
    }
  } catch (err) {}
  try { ctx.inject(['webServer'], startRoutes) } catch (err) {}
  if (!clientOrigin && typeof settings.origin === 'string') clientOrigin = settings.origin
  if (clientOrigin) startWorkbenchWatch(clientOrigin)
  setTimeout(() => { try { if (settings.desktop === true) ensureDesktop() } catch (err) {} }, 2500)
  setInterval(() => { try { if (settings.desktop === true) ensureDesktop() } catch (err) {} }, 10000)
  try { process.once('exit', () => { try { stopDesktop() } catch (err) {} }) } catch (err) {}
}
