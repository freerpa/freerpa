import { contextBridge, ipcRenderer } from 'electron'

ipcRenderer.setMaxListeners(100)
contextBridge.exposeInMainWorld('electronAPI', {
  window: {
    minimize: () => ipcRenderer.send('window-min'),
    maximize: (forceMax = false) => ipcRenderer.send('window-max', forceMax),
    fullscreen: () => ipcRenderer.send('window-fullscreen'),
    size: (width, height) => ipcRenderer.send('window-size', width, height),
    close: () => ipcRenderer.send('window-close'),
    onClose: (callback) => {
      ipcRenderer.removeAllListeners('window-close')
      ipcRenderer.on('window-close', callback)
    },
    onFullscreenChange: (callback) => ipcRenderer.on('window-fullscreen-change', callback)
  },
  // 注册节点事件监听
  onFlowEvent: (event, flowId, nodeId, callback) => {
    let channel = `flowEventBus:${event}`
    if (flowId) {
      channel += `:${flowId}`
    }
    if (nodeId) {
      channel += `:${nodeId}`
    }
    const listener = (event, data) => {
      // 如果是异步事件，需要发送响应
      if (data.async) {
        callback(event, data, (response) => {
          ipcRenderer.send(`${channel}:response:${data.responseId}`, response)
        })
      } else {
        callback(event, data)
      }
    }
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.off(channel, listener)
    }
  },
  emitFlowEvent: (event, flowId, nodeId, params) => {
    let channel = `flowEventBus:${event}`
    if (flowId) {
      channel += `:${flowId}`
    }
    if (nodeId) {
      channel += `:${nodeId}`
    }
    return ipcRenderer.invoke(channel, params)
  },

  // 数据管理模块API
  data: {
    getModel: (id) => ipcRenderer.invoke('data:getModel', id),
    getModels: (params) => ipcRenderer.invoke('data:getModels', params),
    copyModel: (id) => ipcRenderer.invoke('data:copyModel', id),
    createModel: (params) => ipcRenderer.invoke('data:createModel', params),
    updateModel: (params) => ipcRenderer.invoke('data:updateModel', params),
    deleteModel: (id) => ipcRenderer.invoke('data:deleteModel', id),
    getModelData: (params) => ipcRenderer.invoke('data:getModelData', params),
    createModelData: (params) => ipcRenderer.invoke('data:createModelData', params),
    updateModelData: (params) => ipcRenderer.invoke('data:updateModelData', params),
    deleteModelData: (params) => ipcRenderer.invoke('data:deleteModelData', params),
    clearModelData: (params) => ipcRenderer.invoke('data:clearModelData', params),
    batchCreateModelData: (params) => ipcRenderer.invoke('data:batchCreateModelData', params),
    exportExcel: (params) => ipcRenderer.invoke('data:exportExcel', params),
    importExcel: (params) => ipcRenderer.invoke('data:importExcel', params),
    onImportExcelProgress: (callback) => {
      ipcRenderer.removeAllListeners('data:importExcelProgress')
      ipcRenderer.on('data:importExcelProgress', (event, progress) => {
        callback(progress)
      })
    }
  },

  // 环境管理模块API
  env: {
    createWebView: (params) => ipcRenderer.invoke('env:createWebView', params),
    updateWebView: (params) => ipcRenderer.invoke('env:updateWebView', params),
    destroyWebView: () => ipcRenderer.invoke('env:destroyWebView'),
    goBack: () => ipcRenderer.invoke('env:goBack'),
    goForward: () => ipcRenderer.invoke('env:goForward'),
    refresh: () => ipcRenderer.invoke('env:refresh'),
    getEnvironmentFromView: () => ipcRenderer.invoke('env:getEnvironmentFromView'),
    debug: () => ipcRenderer.invoke('env:debug'),
    clear: () => ipcRenderer.invoke('env:clear'),
    // 新增：打开/关闭浏览器
    getKernelList: () => ipcRenderer.invoke('env:getKernelList'),
    getMajorVersionList: () => ipcRenderer.invoke('env:getMajorVersionList'),
    checkKernel: (params) => ipcRenderer.invoke('env:checkKernel', params),
    downloadKernel: (kernel) => ipcRenderer.invoke('env:downloadKernel', kernel),
    openBrowser: (params) => ipcRenderer.invoke('env:openBrowser', params),
    closeBrowser: (params) => ipcRenderer.invoke('env:closeBrowser', params),
    getBrowserStatus: (params) => ipcRenderer.invoke('env:getBrowserStatus', params),
    getAllBrowserStatus: () => ipcRenderer.invoke('env:getAllBrowserStatus'),
    resolveKernelVersion: (params) => ipcRenderer.invoke('env:resolveKernelVersion', params),
    queryGeo: (params) => ipcRenderer.invoke('env:queryGeo', params),
    // 事件监听
    onDownloadKernelProgress: (callback) => {
      const listener = (event, params) => callback(params)
      ipcRenderer.on('env:downloadKernelProgress', listener)
      return () => ipcRenderer.removeListener('env:downloadKernelProgress', listener)
    },
    onBrowserOpened: (callback) => {
      const listener = (event, params) => callback(params)
      ipcRenderer.on('env:browserOpened', listener)
      return () => ipcRenderer.removeListener('env:browserOpened', listener)
    },
    onBrowserClosed: (callback) => {
      const listener = (event, params) => callback(params)
      ipcRenderer.on('env:browserClosed', listener)
      return () => ipcRenderer.removeListener('env:browserClosed', listener)
    },
    onSaveSession: (callback) => {
      const listener = (event, params) => callback(params)
      ipcRenderer.on('env:saveSession', listener)
      return () => ipcRenderer.removeListener('env:saveSession', listener)
    }
  },

  // 检查器模块API
  inspector: {
    createWebView: (params) => ipcRenderer.invoke('inspector:createWebView', params),
    updateWebView: (params) => ipcRenderer.invoke('inspector:updateWebView', params),
    destroyWebView: () => ipcRenderer.invoke('inspector:destroyWebView'),
    goBack: () => ipcRenderer.invoke('inspector:goBack'),
    goForward: () => ipcRenderer.invoke('inspector:goForward'),
    refresh: () => ipcRenderer.invoke('inspector:refresh'),
    debug: () => ipcRenderer.invoke('inspector:debug'),
    clear: () => ipcRenderer.invoke('inspector:clear'),
    onInspector: (callback) => {
      const listener = (event, params) => {
        callback(params)
      }
      ipcRenderer.on('env:inspector', listener)
      return () => {
        ipcRenderer.off('env:inspector', listener)
      }
    }
  },

  // 工作流管理模块API
  workflow: {
    getAllNodes: () => ipcRenderer.invoke('workflow:getAllNodes'),
    getAllNodeCategories: () => ipcRenderer.invoke('workflow:getAllNodeCategories'),
    encryptData: (data) => ipcRenderer.invoke('workflow:encryptData', data),
    decryptData: (data) => ipcRenderer.invoke('workflow:decryptData', data),
    verifyData: (data) => ipcRenderer.invoke('workflow:verifyData', data)
  },

  // 加密解密API
  api: {
    encrypt: (data) => ipcRenderer.invoke('api:encrypt', data),
    decrypt: (data) => ipcRenderer.invoke('api:decrypt', data)
  },

  // 路径选择对话框API
  dialog: {
    openPath: (options) => ipcRenderer.invoke('dialog:openPath', options),
    savePath: (options) => ipcRenderer.invoke('dialog:savePath', options)
  },
  // 打开路径API
  shell: {
    openPath: (path) => ipcRenderer.invoke('shell:openPath', path),
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
  },
  // 获取鼠标位置API
  app: {
    getMousePos: () => ipcRenderer.invoke('app:getMousePos'),
    startGetMousePos: () => ipcRenderer.invoke('app:startGetMousePos'),
    stopGetMousePos: () => ipcRenderer.invoke('app:stopGetMousePos'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
    updateApp: (url, callback) => {
      ipcRenderer.invoke('app:updateApp', url)
      ipcRenderer.on('download-progress', (event, params) => {
        callback(params)
      })
    }
  },
  // 应用配置存储模块API
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value)
  },
  system: {
    getWindows: (keyWord) => ipcRenderer.invoke('system:getWindows', keyWord),
    screenshot: () => ipcRenderer.invoke('system:screenshot'),
    showNotification: (options, eventCallback) => {
      ipcRenderer.invoke('system:showNotification', options)
      ipcRenderer.on('system:showNotification:on:' + options.id, (event, params) => {
        eventCallback(params)
      })
    }
  },
  webview: {
    on: (event, callback) => {
      const listener = (event, params) => {
        console.log(event, params)
        callback(params)
      }
      console.log(event, listener)
      ipcRenderer.on(`webview:${event}`, listener)
      return () => {
        ipcRenderer.off(`webview:${event}`, listener)
      }
    }
  }
})
