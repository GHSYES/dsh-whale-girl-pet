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

    // 只保留设置里的交互面板；桌宠本体在独立的 Electron 桌面窗里显示，页面内不再浮一层。
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
      var electronState = React.useState('missing')
      var electron = electronState[0]
      var setElectron = electronState[1]

      function load() {
        api('/api/settings').then(function (r) {
          if (r && r.settings) { setSettings(r.settings); setElectron(r.electron || 'missing') }
        })
        api('/api/catalog').then(function (r) { if (r && r.catalog) setCatalog(r.catalog) })
      }
      React.useEffect(load, [])

      function patch(p) {
        var prev = settings
        setSettings(Object.assign({}, settings, p))
        post('/api/settings', p).then(function (r) {
          if (r && r.settings) { setSettings(r.settings); setElectron(r.electron || 'missing') }
        }).catch(function () { setSettings(prev); setMsg('保存失败，已恢复原设置') })
      }
      function setDesktop(on) {
        var prev = settings
        setSettings(Object.assign({}, settings, { desktop: !!on }))
        setMsg(on ? '正在把桌宠放到桌面…' : '正在收起桌宠…')
        post('/api/desktop', { open: !!on }).then(function (r) {
          if (r && r.settings) setSettings(r.settings)
          if (r && r.electron) setElectron(r.electron)
          setMsg(r && r.ok ? (on ? '桌宠已显示在电脑桌面上' : '桌宠已收起来') : '桌面窗口启动失败，请重启 DSH Desktop 再试')
        }).catch(function () { setSettings(prev); setMsg('操作失败，已恢复原状态') })
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

      return h('div', { style: { padding: '16px 20px 28px', maxWidth: '760px' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' } },
          h('img', { src: ROUTE + '/assets/01-idle.gif', alt: '', style: { width: '56px', height: 'auto', imageRendering: 'pixelated' } }),
          h('div', null,
            h('div', { style: { fontSize: '15px', fontWeight: 600 } }, '鲸娘桌宠'),
            h('div', { style: { fontSize: '12px', opacity: .65 } }, '只显示在电脑桌面上：按住 Ctrl 拖动，单击戳脸、连点挠痒；任务完成时单击确认，右键菜单可缩放/收起')
          )
        ),
        h('div', { style: row },
          h('div', { style: labelStyle }, '显示在桌面上'),
          h('input', { type: 'checkbox', checked: settings.desktop === true, onChange: function (ev) { setDesktop(ev.target.checked) } }),
          h('div', { style: { fontSize: '12px', opacity: .6 } }, electron !== 'ready' ? '缺少 Electron 运行时，暂时无法浮到桌面' : (settings.desktop === true ? '已浮在电脑桌面顶层，DSH 页面内不会重复出现' : '勾选后在电脑桌面顶层显示'))
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
          h('div', null, '素材库：%DSH_HOME%/pets/whale-girl-emoji'),
          h('div', null, '交互：Ctrl + 拖动 = 拎着走；单击左右脸 = 挨戳；1 秒内连点 3 下 = 挠痒；任务完成循环时单击 = 确认并点赞；右键 = 菜单'),
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
