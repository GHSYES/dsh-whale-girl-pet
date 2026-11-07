window.__ModuleLoader__.load({
  id: 'dsh-whale-pet',
  factory: function (require) {
    var React = null
    try { React = require('react') } catch (err) { React = null }

    var ROUTE = '/whale-pet'

    function api(path, init) {
      return fetch(ROUTE + path, init).then(function (res) { return res.json() }).catch(function () { return null })
    }
    function post(path, body) {
      return api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
    }

    // 设置里的交互面板。桌宠本体由宿主拉到独立的 Electron 桌面窗里，页面内不渲染悬浮层。
    function SettingsSection(props) {
      if (!React) return null
      var h = React.createElement
      var sState = React.useState(null)
      var settings = sState[0]
      var setSettings = sState[1]
      var catState = React.useState([])
      var catalog = catState[0]
      var setCatalog = catState[1]
      var msgState = React.useState('')
      var msg = msgState[0]
      var setMsg = msgState[1]
      var rtState = React.useState({ status: 'missing', progress: 0, message: '' })
      var runtime = rtState[0]
      var setRuntime = rtState[1]

      function applyRuntime(r) {
        if (!r) return
        setRuntime({ status: r.electron || 'missing', progress: (r.electronDetail && r.electronDetail.progress) || 0, message: (r.electronDetail && r.electronDetail.message) || '' })
      }

      function load() {
        api('/api/settings').then(function (r) {
          if (r && r.settings) setSettings(r.settings)
          applyRuntime(r)
        })
        api('/api/catalog').then(function (r) {
          if (r && r.catalog) setCatalog(r.catalog)
          applyRuntime(r)
        })
      }
      React.useEffect(load, [])

      // 首次安装会自动下载 Electron；下载中每 1.5 秒刷新一次进度。
      React.useEffect(function () {
        if (runtime.status === 'ready' || runtime.status === 'error') return
        var timer = setInterval(function () {
          api('/api/runtime').then(applyRuntime)
        }, 1500)
        return function () { clearInterval(timer) }
      }, [runtime.status])

      function patch(p) {
        var prev = settings
        setSettings(Object.assign({}, settings, p))
        post('/api/settings', p).then(function (r) {
          if (r && r.settings) setSettings(r.settings)
          applyRuntime(r)
        }).catch(function () { setSettings(prev); setMsg('保存失败，已恢复原设置') })
      }
      function setDesktop(on) {
        var prev = settings
        setSettings(Object.assign({}, settings, { desktop: !!on }))
        setMsg(on ? '正在把桌宠放到桌面…' : '正在收起桌宠…')
        post('/api/desktop', { open: !!on }).then(function (r) {
          if (r && r.settings) setSettings(r.settings)
          applyRuntime(r)
          if (r && r.ok) setMsg(on ? '桌宠已显示在电脑桌面上' : '桌宠已收起来')
          else if (r && r.electron === 'downloading') setMsg('正在准备 Electron 运行时，下载完成后会自动出现')
          else setMsg('桌面窗口还没起来，请稍等或重启 DSH Desktop 再试')
        }).catch(function () { setSettings(prev); setMsg('操作失败，已恢复原状态') })
      }
      function retryRuntime() {
        setMsg('正在重试下载 Electron 运行时…')
        post('/api/runtime', {}).then(function (r) {
          applyRuntime(r)
          if (r && r.ok) setMsg('Electron 运行时已就绪')
          else setMsg((r && r.electronDetail && r.electronDetail.message) || '下载失败，请检查网络后重试')
        })
      }
      function preview(key) {
        post('/api/preview', { key: key }).then(function () { setMsg('预览 ' + key + '（3 秒）') })
      }

      if (!settings) return h('div', { style: { padding: '18px', color: 'var(--fg-secondary, #8a94a6)' } }, '读取桌宠设置…')

      var row = { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }
      var labelStyle = { width: '118px', flex: '0 0 118px', fontSize: '13px', opacity: .92 }
      var valueStyle = { fontSize: '12px', opacity: .7, minWidth: '48px', textAlign: 'right' }
      var slider = { flex: '1 1 auto', accentColor: '#4aa3ff' }

      function toggleRow(name, key) {
        return h('div', { style: row },
          h('div', { style: labelStyle }, name),
          h('input', { type: 'checkbox', checked: settings[key] !== false, onChange: function (ev) { patch(Object.assign({}, settings, { [key]: ev.target.checked })) } }),
          h('div', { style: { fontSize: '12px', opacity: .6 } }, settings[key] !== false ? '已开启' : '已关闭')
        )
      }

      var ready = runtime.status === 'ready'
      var statusText
      if (ready) statusText = settings.desktop === true ? '已浮在电脑桌面顶层，DSH 页面内不会重复出现' : '勾选后在电脑桌面顶层显示'
      else if (runtime.status === 'downloading') statusText = '正在下载 Electron 运行时 ' + runtime.progress + '%（首次约 160 MB）'
      else if (runtime.status === 'error') statusText = '运行时下载失败，点「重试」或检查网络'
      else statusText = '首次使用会自动下载 Electron 运行时（约 160 MB）'

      return h('div', { style: { padding: '16px 20px 28px', maxWidth: '760px' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' } },
          h('img', { src: ROUTE + '/assets/05-typing.gif', alt: '', style: { width: '56px', height: 'auto', imageRendering: 'pixelated' } }),
          h('div', null,
            h('div', { style: { fontSize: '15px', fontWeight: 600 } }, '鲸娘桌宠'),
            h('div', { style: { fontSize: '12px', opacity: .65 } }, '只显示在电脑桌面上：按住 Ctrl 拖动，单击戳脸、连点挠痒，右键菜单可缩放/收起')
          )
        ),
        h('div', { style: row },
          h('div', { style: labelStyle }, '显示在桌面上'),
          h('input', { type: 'checkbox', checked: settings.desktop === true, disabled: !ready, onChange: function (ev) { setDesktop(ev.target.checked) } }),
          h('div', { style: { fontSize: '12px', opacity: .6, flex: '1 1 auto' } }, statusText),
          runtime.status === 'error' ? h('button', { onClick: retryRuntime, style: { fontSize: '12px', padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: 'inherit', cursor: 'pointer' } }, '重试') : null,
          runtime.status === 'missing' ? h('button', { onClick: retryRuntime, style: { fontSize: '12px', padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: 'inherit', cursor: 'pointer' } }, '下载运行时') : null,
          runtime.status === 'downloading' ? h('div', { style: { width: '86px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,.1)', overflow: 'hidden' } }, h('div', { style: { width: runtime.progress + '%', height: '100%', background: '#4aa3ff', transition: 'width .3s' } })) : null
        ),
        h('div', { style: row },
          h('div', { style: labelStyle }, '大小'),
          h('input', { type: 'range', min: 72, max: 480, step: 4, value: settings.size, style: slider, onChange: function (ev) { var v = Number(ev.target.value); setSettings(Object.assign({}, settings, { size: v })); patch({ size: v }) } }),
          h('div', { style: valueStyle }, settings.size + 'px')
        ),
        h('div', { style: row },
          h('div', { style: labelStyle }, '不透明度'),
          h('input', { type: 'range', min: 0.2, max: 1, step: 0.05, value: settings.opacity, style: slider, onChange: function (ev) { var v = Number(ev.target.value); setSettings(Object.assign({}, settings, { opacity: v })); patch({ opacity: v }) } }),
          h('div', { style: valueStyle }, Math.round((settings.opacity || 1) * 100) + '%')
        ),
        toggleRow('点击穿透', 'clickThrough'),
        toggleRow('待机轮换', 'idle'),
        h('div', { style: { padding: '12px 0 6px', fontSize: '13px', fontWeight: 600 } }, '状态预览'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '8px' } },
          catalog.map(function (a) {
            return h('div', { key: a.key, onClick: function () { preview(a.key) }, title: a.trigger, style: { border: '1px solid rgba(255,255,255,.09)', borderRadius: '10px', padding: '6px', cursor: 'pointer', textAlign: 'center', background: 'rgba(255,255,255,.03)' } },
              h('img', { src: ROUTE + '/assets/' + a.gif, alt: a.title, style: { width: '100%', height: '58px', objectFit: 'contain', imageRendering: 'pixelated' } }),
              h('div', { style: { fontSize: '11px', opacity: .78, marginTop: '2px' } }, a.title)
            )
          })
        ),
        h('div', { style: { marginTop: '14px', fontSize: '12px', opacity: .6, lineHeight: 1.7 } },
          h('div', null, '素材：插件内置 22 张 GIF；同名文件放到 %DSH_HOME%\\pets\\whale-girl-emoji\\gifs 会覆盖内置素材'),
          h('div', null, '交互：按住 Ctrl 拖动 = 拎着走；单击左右脸 = 挨戳；1 秒内连点 3 下 = 挠痒；右键 = 原生菜单（缩放 / 收起）'),
          msg ? h('div', { style: { color: '#4aa3ff' } }, msg) : null
        )
      )
    }

    function apply(ctx) {
      try {
        post('/api/hello', { origin: location.origin })
      } catch (err) {}
      try {
        var slots = ctx && typeof ctx.get === 'function' ? ctx.get('slots') : null
        if (slots && React) {
          var entry = { name: 'settings.section', id: 'whale-pet', order: 26, label: '鲸娘桌宠' }
          if (typeof slots.inject === 'function') slots.inject('settings.section', function () { slots.register(entry, SettingsSection) })
          else if (typeof slots.register === 'function') slots.register(entry, SettingsSection)
        }
      } catch (err) {}
    }

    return { apply: apply, inject: ['slots'] }
  },
})
