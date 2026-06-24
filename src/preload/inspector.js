import { contextBridge, ipcRenderer } from 'electron'
import ElementInspector from './ElementInspector.js'
contextBridge.exposeInMainWorld('inspector', (element) => {
  if (window.ElementInspector) {
    window.ElementInspector.clear()
  }
  window.ElementInspector = new ElementInspector(element, (channel, data) => {
    ipcRenderer.send(channel, data)
  })
})
// 调用inspector函数
contextBridge.executeInMainWorld({
  func: () => {
    window.onload = () => {
      window.inspector()
    }
  }
})
