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
    },
    getTrash: () => ipcRenderer.invoke('data:getTrash'),
    restore: (id) => ipcRenderer.invoke('data:restore', id),
    permanentDelete: (id) => ipcRenderer.invoke('data:permanentDelete', id)
  },

  // 数据库管理 API
  dbInfo: {
    getInfo: () => ipcRenderer.invoke('data:getDbInfo'),
    changeLocation: () => ipcRenderer.invoke('data:changeDbLocation'),
    backup: () => ipcRenderer.invoke('data:backupDb'),
    restore: () => ipcRenderer.invoke('data:restoreDb'),
    openFolder: () => ipcRenderer.invoke('data:openDbFolder')
  },

  // 浏览器管理模块API
  env: {
    // 内核管理
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

  // 工作流管理模块API
  workflow: {
    // 工作流执行
    getAllNodes: () => ipcRenderer.invoke('workflow:getAllNodes'),
    getAllNodeCategories: () => ipcRenderer.invoke('workflow:getAllNodeCategories'),
    encryptData: (data) => ipcRenderer.invoke('workflow:encryptData', data),
    decryptData: (data) => ipcRenderer.invoke('workflow:decryptData', data),
    verifyData: (data) => ipcRenderer.invoke('workflow:verifyData', data),
    // 工作流本地 CRUD
    getWorkflows: (params) => ipcRenderer.invoke('workflow:getWorkflows', params),
    getWorkflow: (id) => ipcRenderer.invoke('workflow:getWorkflow', id),
    createWorkflow: (params) => ipcRenderer.invoke('workflow:createWorkflow', params),
    updateWorkflow: (params) => ipcRenderer.invoke('workflow:updateWorkflow', params),
    deleteWorkflow: (id) => ipcRenderer.invoke('workflow:deleteWorkflow', id),
    importWorkflow: (params) => ipcRenderer.invoke('workflow:importWorkflow', params),
    exportWorkflow: (id) => ipcRenderer.invoke('workflow:exportWorkflow', id),
    getTrash: () => ipcRenderer.invoke('workflow:getTrash'),
    restore: (id) => ipcRenderer.invoke('workflow:restore', id),
    permanentDelete: (id) => ipcRenderer.invoke('workflow:permanentDelete', id)
  },

  // 浏览器本地 CRUD
  browserLocal: {
    getBrowsers: (params) => ipcRenderer.invoke('browser:getBrowsers', params),
    getBrowser: (id) => ipcRenderer.invoke('browser:getBrowser', id),
    createBrowser: (params) => ipcRenderer.invoke('browser:createBrowser', params),
    updateBrowser: (params) => ipcRenderer.invoke('browser:updateBrowser', params),
    deleteBrowser: (id) => ipcRenderer.invoke('browser:deleteBrowser', id),
    importBrowser: (params) => ipcRenderer.invoke('browser:importBrowser', params),
    exportBrowser: (id) => ipcRenderer.invoke('browser:exportBrowser', id),
    getTrash: () => ipcRenderer.invoke('browser:getTrash'),
    restore: (id) => ipcRenderer.invoke('browser:restore', id),
    permanentDelete: (id) => ipcRenderer.invoke('browser:permanentDelete', id)
  },

  // 元素集模块 API
  elementSet: {
    getElementSets: (params) => ipcRenderer.invoke('elementSet:getElementSets', params),
    getElementSet: (id) => ipcRenderer.invoke('elementSet:getElementSet', id),
    createElementSet: (params) => ipcRenderer.invoke('elementSet:createElementSet', params),
    updateElementSet: (params) => ipcRenderer.invoke('elementSet:updateElementSet', params),
    deleteElementSet: (id) => ipcRenderer.invoke('elementSet:deleteElementSet', id),
    getTrash: () => ipcRenderer.invoke('elementSet:getTrash'),
    restore: (id) => ipcRenderer.invoke('elementSet:restore', id),
    permanentDelete: (id) => ipcRenderer.invoke('elementSet:permanentDelete', id)
  },

  // 分类模块 API
  category: {
    getCategories: (type) => ipcRenderer.invoke('category:getCategories', type),
    addCategory: (type, name) => ipcRenderer.invoke('category:addCategory', type, name),
    updateCategory: (id, name) => ipcRenderer.invoke('category:updateCategory', id, name),
    deleteCategory: (id) => ipcRenderer.invoke('category:deleteCategory', id)
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
  cache: {
    getSize: () => ipcRenderer.invoke('cache:getSize'),
    clear: () => ipcRenderer.invoke('cache:clear')
  },
  plugin: {
    addDir: () => ipcRenderer.invoke('plugin:addDir'),
    removeDir: (dir) => ipcRenderer.invoke('plugin:removeDir', dir),
    getDirs: () => ipcRenderer.invoke('plugin:getDirs'),
    list: () => ipcRenderer.invoke('plugin:list'),
    get: (pluginId) => ipcRenderer.invoke('plugin:get', pluginId),
    resolvePath: (pluginId) => ipcRenderer.invoke('plugin:resolvePath', pluginId),
    execute: (params) => ipcRenderer.invoke('plugin:execute', params)
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
  }
})
