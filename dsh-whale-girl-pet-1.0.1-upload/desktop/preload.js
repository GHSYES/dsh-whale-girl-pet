const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('whalePet', {
  move: (dx, dy) => ipcRenderer.send('whale-pet:move', dx, dy),
  dragStart: () => {},
  dragEnd: () => {},
  resizeTo: (size) => ipcRenderer.send('whale-pet:resize-to', size),
  setClickThrough: (on) => ipcRenderer.send('whale-pet:click-through', !!on),
  hide: () => ipcRenderer.send('whale-pet:hide'),
  show: () => ipcRenderer.send('whale-pet:show'),
  close: () => ipcRenderer.send('whale-pet:close'),
  openMenu: () => ipcRenderer.send('whale-pet:menu'),
  onCommand: (cb) => { ipcRenderer.on('whale-pet:command', (event, cmd) => { try { cb(cmd) } catch (err) {} }) },
})
