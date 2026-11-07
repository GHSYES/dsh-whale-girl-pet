/* 桌面桌宠页：独立 Electron 透明窗里运行，只负责显示 GIF、交互与右键菜单。 */
(function () {
  var boot = window.__WHALE_PET__ || {}
  var ROUTE = boot.route || '/whale-pet'
  var wrap = document.getElementById('wrap')
  var img = document.getElementById('pet')
  var cur = ''
  var curKey = ''
  var lastSize = 0
  var lastClick = null
  var lastHidden = null
  var ctrl = false
  var clicks = []
  var drag = null
  var downInfo = null
  var DRAG_GIF = ROUTE + '/assets/19-drag.gif'

  function post(p, b) {
    return fetch(ROUTE + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }).catch(function () {})
  }
  function pick() {
    return fetch(ROUTE + '/api/state').then(function (r) { return r.json() }).catch(function () { return null })
  }

  function applyWin(j) {
    var s = (j && j.settings) || {}
    var size = Math.max(72, Math.min(480, Number(s.size) || 180))
    if (size !== lastSize) { lastSize = size; try { window.whalePet && window.whalePet.resizeTo(size) } catch (err) {} }
    var ct = !!s.clickThrough
    if (ct !== lastClick) { lastClick = ct; try { window.whalePet && window.whalePet.setClickThrough(ct) } catch (err) {} }
    var hid = s.enabled === false
    if (hid !== lastHidden) { lastHidden = hid; try { window.whalePet && (hid ? window.whalePet.hide() : window.whalePet.show()) } catch (err) {} }
  }

  function draw(j) {
    if (!j || !j.gif) return
    if (j.gif !== cur && !(drag && j.gif !== DRAG_GIF)) { cur = j.gif; if (img) img.src = j.gif }
    curKey = j.key || ''
    document.body.style.opacity = String((j.settings && j.settings.opacity) || 1)
    applyWin(j)
  }

  // 页面自己的 origin 就是宿主地址：用作 origin 兜底，端口变了也能自愈。
  post('/api/hello', { origin: location.origin })
  pick().then(draw)
  setInterval(function () { pick().then(draw) }, 900)

  function setCursor() {
    document.body.style.cursor = drag ? 'grabbing' : (ctrl ? 'grab' : 'default')
  }
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Control' || e.key === 'Meta') { ctrl = true; setCursor() }
  })
  window.addEventListener('keyup', function (e) {
    if (e.key === 'Control' || e.key === 'Meta') { ctrl = false; setCursor() }
  })
  window.addEventListener('blur', function () { ctrl = false; setCursor() })

  wrap.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return
    downInfo = { x: e.screenX, y: e.screenY, cx: e.clientX, at: Date.now() }
    if (ctrl || e.ctrlKey || e.metaKey) {
      drag = { x: e.screenX, y: e.screenY }
      setCursor()
      // 被拎起来：立刻换成 19-drag.gif，并让宿主进入 drag reaction，松手再回到当前状态。
      cur = DRAG_GIF
      if (img) img.src = DRAG_GIF
      post('/api/interaction', { kind: 'drag' })
      try { window.whalePet && window.whalePet.dragStart() } catch (err) {}
    }
  })

  window.addEventListener('pointermove', function (e) {
    if (!drag) return
    var dx = e.screenX - drag.x
    var dy = e.screenY - drag.y
    if (!dx && !dy) return
    drag.x = e.screenX
    drag.y = e.screenY
    try { window.whalePet && window.whalePet.move(dx, dy) } catch (err) {}
  })

  window.addEventListener('pointerup', function (e) {
    if (drag) {
      drag = null
      setCursor()
      try { window.whalePet && window.whalePet.dragEnd() } catch (err) {}
      post('/api/interaction', { kind: 'drag-end' })
      cur = ''
      downInfo = null
      return
    }
    if (!downInfo) return
    var down = downInfo
    downInfo = null
    var moved = Math.abs(e.screenX - down.x) + Math.abs(e.screenY - down.y)
    if (moved > 6 || Date.now() - down.at > 700) return
    if (curKey === 'sleeping') { post('/api/interaction', { kind: 'waking' }); return }
    var now = Date.now()
    clicks = clicks.filter(function (t) { return now - t < 1000 })
    clicks.push(now)
    if (clicks.length >= 3) { clicks = []; post('/api/interaction', { kind: 'tickle' }); return }
    var r = wrap.getBoundingClientRect()
    post('/api/interaction', { kind: (down.cx - r.left < r.width / 2) ? 'poke-left' : 'poke-right' })
  })

  function applySize(n) {
    n = Math.max(72, Math.min(480, Number(n) || 180))
    lastSize = n
    try { window.whalePet && window.whalePet.resizeTo(n) } catch (err) {}
    post('/api/settings', { size: n })
  }
  function handleCommand(cmd) {
    if (cmd === 'zoom-in') applySize((lastSize || 180) + 32)
    else if (cmd === 'zoom-out') applySize((lastSize || 180) - 32)
    else if (cmd === 'reset-size') applySize(180)
    else if (cmd === 'hide') {
      post('/api/desktop', { open: false }).then(function () { try { window.whalePet && window.whalePet.close() } catch (err) {} })
    }
  }

  window.addEventListener('contextmenu', function (e) {
    e.preventDefault()
    try { if (window.whalePet && window.whalePet.openMenu) { window.whalePet.openMenu(); return } } catch (err) {}
  })
  try { if (window.whalePet && window.whalePet.onCommand) window.whalePet.onCommand(handleCommand) } catch (err) {}
})();
