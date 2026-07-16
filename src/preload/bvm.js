/**
 * @file: bvm 预加载脚本
 * @description: 为 offscreen bvm 视图暴露 IPC 通信接口
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('__bvmIpc', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
})
