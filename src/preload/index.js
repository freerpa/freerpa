import { contextBridge, ipcRenderer } from 'electron'

ipcRenderer.setMaxListeners(100)
contextBridge.exposeInMainWorld('electronAPI', {
  window: {
    minimize: () => ipcRenderer.send('window-min'),
    maximize: (forceMax = false) => ipcRenderer.send('window-max', forceMax),
    hide: () => ipcRenderer.send('window-hide'),
    close: () => ipcRenderer.send('window-close'),
    onRequestExit: (callback) => {
      ipcRenderer.removeAllListeners('request-exit')
      ipcRenderer.on('request-exit', callback)
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
    openFolder: () => ipcRenderer.invoke('data:openDbFolder')
  },

  // 浏览器管理模块API
  env: {
    openBrowser: (params) => ipcRenderer.invoke('env:openBrowser', params),
    closeBrowser: (params) => ipcRenderer.invoke('env:closeBrowser', params),
    getAllBrowserStatus: () => ipcRenderer.invoke('env:getAllBrowserStatus'),
    // 事件监听
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
    // 工作流本地 CRUD
    getWorkflows: (params) => ipcRenderer.invoke('workflow:getWorkflows', params),
    getWorkflow: (id) => ipcRenderer.invoke('workflow:getWorkflow', id),
    createWorkflow: (params) => ipcRenderer.invoke('workflow:createWorkflow', params),
    updateWorkflow: (params) => ipcRenderer.invoke('workflow:updateWorkflow', params),
    deleteWorkflow: (id) => ipcRenderer.invoke('workflow:deleteWorkflow', id),
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
  // 目录浏览（自定义目录选择器用）
  fs: {
    listDirectory: (dirPath) => ipcRenderer.invoke('fs:listDirectory', dirPath),
    readThumb: (filePath) => ipcRenderer.invoke('fs:readThumb', filePath),
    getHome: () => ipcRenderer.invoke('fs:getHome'),
    getUserDirs: () => ipcRenderer.invoke('fs:getUserDirs')
  },
  // 获取鼠标位置API
  app: {
    getMousePos: () => ipcRenderer.invoke('app:getMousePos'),
    startGetMousePos: () => ipcRenderer.invoke('app:startGetMousePos'),
    stopGetMousePos: () => ipcRenderer.invoke('app:stopGetMousePos'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    checkUpdate: () => ipcRenderer.invoke('app:checkUpdate')
  },
  // 应用配置存储模块API
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    list: () => ipcRenderer.invoke('store:list'),
    remove: (key) => ipcRenderer.invoke('store:remove', key)
  },
  // AI 模型模块API
  ai: {
    getProviders: () => ipcRenderer.invoke('ai:getProviders'),
    getPresetProviders: () => ipcRenderer.invoke('ai:getPresetProviders'),
    createProvider: (data) => ipcRenderer.invoke('ai:createProvider', data),
    updateProvider: (id, data) => ipcRenderer.invoke('ai:updateProvider', id, data),
    deleteProvider: (id) => ipcRenderer.invoke('ai:deleteProvider', id),
    getModels: () => ipcRenderer.invoke('ai:getModels'),
    createConversation: (workflowId, title) =>
      ipcRenderer.invoke('ai:createConversation', { workflowId, title }),
    getConversations: (workflowId) => ipcRenderer.invoke('ai:getConversations', { workflowId }),
    deleteConversation: (workflowId, conversationId) =>
      ipcRenderer.invoke('ai:deleteConversation', { workflowId, conversationId }),
    getMessages: (workflowId, conversationId) =>
      ipcRenderer.invoke('ai:getMessages', { workflowId, conversationId }),
    saveMessage: (workflowId, conversationId, message) =>
      ipcRenderer.invoke('ai:saveMessage', { workflowId, conversationId, message }),
    deleteMessage: (workflowId, conversationId, messageId) =>
      ipcRenderer.invoke('ai:deleteMessage', { workflowId, conversationId, messageId }),
    clearMessages: (workflowId, conversationId) =>
      ipcRenderer.invoke('ai:clearMessages', { workflowId, conversationId }),
    getMemories: (workflowId) => ipcRenderer.invoke('ai:getMemories', { workflowId }),
    chatStart: (payload) => ipcRenderer.invoke('ai:chatStart', payload),
    chatAbort: (requestId) => ipcRenderer.invoke('ai:chatAbort', requestId),
    onProvidersChanged: (callback) => {
      const listener = () => callback()
      ipcRenderer.on('ai:providersChanged', listener)
      return () => ipcRenderer.removeListener('ai:providersChanged', listener)
    },
    onChatChunk: (callback) => {
      const listener = (_event, data) => callback(data)
      ipcRenderer.on('ai:chatChunk', listener)
      return () => ipcRenderer.removeListener('ai:chatChunk', listener)
    },
    onChatDone: (callback) => {
      const listener = (_event, data) => callback(data)
      ipcRenderer.on('ai:chatDone', listener)
      return () => ipcRenderer.removeListener('ai:chatDone', listener)
    },
    onChatError: (callback) => {
      const listener = (_event, data) => callback(data)
      ipcRenderer.on('ai:chatError', listener)
      return () => ipcRenderer.removeListener('ai:chatError', listener)
    }
  },
  permissions: {
    getDefaults: () => ipcRenderer.invoke('permissions:getDefaults')
  },
  plugin: {
    list: () => ipcRenderer.invoke('plugin:list'),
    get: (pluginId) => ipcRenderer.invoke('plugin:get', pluginId),
    getRoot: () => ipcRenderer.invoke('plugin:getRoot'),
    installFrp: () => ipcRenderer.invoke('plugin:installFrp'),
    importDev: () => ipcRenderer.invoke('plugin:importDev'),
    packFrp: (srcDir) => ipcRenderer.invoke('plugin:packFrp', srcDir),
    uninstall: (pluginId, version) => ipcRenderer.invoke('plugin:uninstall', pluginId, version),
    /** 安装/打包进度监听，返回取消订阅函数 */
    onProgress: (callback) => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('plugin:progress', listener)
      return () => ipcRenderer.removeListener('plugin:progress', listener)
    }
  },
  system: {
    showNotification: (options, eventCallback) => {
      ipcRenderer.on('system:showNotification:on:' + options.id, (event, params) => {
        eventCallback(params)
      })
      // 返回 invoke 的 Promise：主进程失败（如系统不支持通知）时渲染端可 catch（见 store onNotice）
      return ipcRenderer.invoke('system:showNotification', options).then((res) => {
        if (res && res.ok === false) {
          throw new Error(res.error || '系统通知发送失败')
        }
      })
    }
  }
})
