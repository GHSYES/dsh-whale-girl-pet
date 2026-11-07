import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import https from 'node:https'
import { execFile } from 'node:child_process'

// Electron helper runtime, pinned to the same build dsh-orb uses. Only the
// binary is downloaded; nothing from this plugin is ever executed remotely.
export const ELECTRON_VERSION = '44.0.0'
const ASSET = 'electron-v' + ELECTRON_VERSION + '-win32-x64.zip'
const SHA256 = 'e61aa3bcea8152bc0730abd015e47c032d778a0ef10e2a1c78ba3c4ea47942f9'
const SOURCES = [
  'https://cdn.npmmirror.com/binaries/electron/v' + ELECTRON_VERSION + '/' + ASSET,
  'https://github.com/electron/electron/releases/download/v' + ELECTRON_VERSION + '/' + ASSET,
]

const state = { status: 'missing', progress: 0, message: '', at: 0, source: '' }

export function electronRuntimeInfo() {
  return { status: state.status, progress: state.progress, message: state.message, at: state.at }
}

export function runtimeExe(stateDir) {
  return path.join(stateDir, 'runtime', 'electron-v' + ELECTRON_VERSION, 'electron.exe')
}

export function runtimeMarker(stateDir) {
  return path.join(stateDir, 'runtime', 'electron-v' + ELECTRON_VERSION, '.complete')
}

function setState(next) {
  Object.assign(state, next)
}

function execFileP(file, args, timeout) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: timeout || 120000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(String((stderr || stdout || err.message || '').trim() || err.message).slice(0, 400)))
      else resolve()
    })
  })
}

function formatMb(bytes) {
  return (bytes / 1048576).toFixed(1) + ' MB'
}

// Stream one URL into dest, resuming an existing .partial with a Range request.
// Redirects (GitHub releases / mirrors) are followed manually so we keep the
// Range header and can report progress accurately.
function downloadTo(url, dest, redirects) {
  const depth = redirects || 0
  if (depth > 8) return Promise.reject(new Error('too many redirects'))
  return new Promise((resolve, reject) => {
    let start = 0
    try { start = fs.statSync(dest).size } catch (err) { start = 0 }
    const headers = { 'user-agent': 'dsh-whale-pet/' + ELECTRON_VERSION, accept: '*/*' }
    if (start > 0) headers.range = 'bytes=' + start + '-'
    const req = https.get(url, { headers }, (res) => {
      const code = res.statusCode || 0
      if (code >= 300 && code < 400 && res.headers.location) {
        res.resume()
        const next = new URL(res.headers.location, url).toString()
        downloadTo(next, dest, depth + 1).then(resolve, reject)
        return
      }
      if (code === 416) { res.resume(); resolve(start); return }
      if (code !== 200 && code !== 206) {
        res.resume()
        reject(new Error('HTTP ' + code + ' from ' + new URL(url).host))
        return
      }
      const append = code === 206 && start > 0
      const totalHeader = Number(res.headers['content-length'] || 0)
      const total = totalHeader + (append ? start : 0)
      let received = append ? start : 0
      let lastLog = 0
      const out = fs.createWriteStream(dest, { flags: append ? 'a' : 'w' })
      res.on('data', (chunk) => {
        received += chunk.length
        if (received - lastLog > 8 * 1048576) {
          lastLog = received
          const pct = total > 0 ? Math.min(99, Math.round((received / total) * 100)) : 0
          setState({ status: 'downloading', progress: pct, message: '正在下载 Electron 运行时 ' + formatMb(received) + (total ? ' / ' + formatMb(total) : '') })
        }
      })
      res.on('error', reject)
      out.on('error', reject)
      out.on('finish', () => resolve(received))
      res.pipe(out)
    })
    req.setTimeout(45000, () => req.destroy(new Error('download timed out')))
    req.on('error', reject)
  })
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const input = fs.createReadStream(file)
    input.on('error', reject)
    input.on('data', (chunk) => hash.update(chunk))
    input.on('end', () => resolve(hash.digest('hex')))
  })
}

async function extractZip(zip, dest) {
  fs.mkdirSync(dest, { recursive: true })
  try {
    await execFileP('tar', ['-xf', zip, '-C', dest], 180000)
  } catch (err) {
    if (process.platform !== 'win32') throw err
    const quote = (p) => "'" + p.replace(/'/g, "''") + "'"
    await execFileP('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
      'Expand-Archive -LiteralPath ' + quote(zip) + ' -DestinationPath ' + quote(dest) + ' -Force',
    ], 180000)
  }
}

let running = null

async function install(stateDir) {
  const target = path.join(stateDir, 'runtime', 'electron-v' + ELECTRON_VERSION)
  const exe = path.join(target, 'electron.exe')
  const runtimeRoot = path.join(stateDir, 'runtime')
  const partial = path.join(runtimeRoot, ASSET + '.partial')
  const staging = path.join(runtimeRoot, 'staging-' + process.pid + '-' + Date.now())
  fs.mkdirSync(runtimeRoot, { recursive: true })

  let lastError = null
  for (const source of SOURCES) {
    setState({ status: 'downloading', progress: 0, message: '正在连接 ' + new URL(source).host, at: Date.now(), source })
    state.source = source
    try {
      await downloadTo(source, partial, 0)
      setState({ status: 'downloading', progress: 99, message: '正在校验下载文件…' })
      const actual = await sha256File(partial)
      if (actual !== SHA256) throw new Error('SHA-256 校验失败（文件可能不完整），已删除重新下载')
      setState({ status: 'downloading', progress: 99, message: '正在解压 Electron 运行时…' })
      fs.rmSync(staging, { recursive: true, force: true })
      await extractZip(partial, staging)
      if (!fs.existsSync(path.join(staging, 'electron.exe'))) throw new Error('压缩包内没有 electron.exe')
      fs.rmSync(target, { recursive: true, force: true })
      fs.renameSync(staging, target)
      fs.writeFileSync(path.join(target, '.complete'), ELECTRON_VERSION + '\n' + new Date().toISOString() + '\n')
      try { fs.rmSync(partial, { force: true }) } catch (err) {}
      setState({ status: 'ready', progress: 100, message: 'Electron 运行时已就绪', at: Date.now(), source })
      return true
    } catch (err) {
      lastError = err
      if (/校验失败/.test(String(err && err.message))) { try { fs.rmSync(partial, { force: true }) } catch (e2) {} }
    }
  }
  fs.rmSync(staging, { recursive: true, force: true })
  setState({ status: 'error', progress: 0, message: 'Electron 运行时下载失败：' + String(lastError && lastError.message || '未知错误'), at: Date.now(), source: '' })
  return false
}

export function ensureElectronRuntime(options) {
  if (running) return running
  const stateDir = String(options && options.stateDir || '')
  const log = typeof (options && options.log) === 'function' ? options.log : () => {}
  if (!stateDir) return Promise.resolve(false)
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    setState({ status: 'error', progress: 0, message: '自动下载仅支持 Windows x64；请设置 WHALE_PET_ELECTRON 指向 Electron 可执行文件', at: Date.now() })
    return Promise.resolve(false)
  }
  if (fs.existsSync(runtimeExe(stateDir))) { setState({ status: 'ready', progress: 100, message: 'Electron 运行时已就绪', at: Date.now() }); return Promise.resolve(true) }
  setState({ status: 'downloading', progress: 0, message: '准备下载 Electron 运行时…', at: Date.now() })
  log('electron runtime download start version=' + ELECTRON_VERSION)
  running = install(stateDir)
    .then((ok) => { log('electron runtime download ' + (ok ? 'ok' : 'failed') + ' ' + state.message); return ok })
    .catch((err) => { setState({ status: 'error', progress: 0, message: 'Electron 运行时下载失败：' + String(err && err.message), at: Date.now() }); return false })
    .finally(() => { running = null })
  return running
}
