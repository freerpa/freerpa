/**
 * @file: 工作流节点定义
 * @author: dabao
 * @date: 2024-03-15
 */

//基础节点
import baseTimer from './baseTimer'
import baseTimerHandle from './baseTimerHandle'

import counter from './counter'
import counterClear from './counterClear'
import counterV2 from './counterV2'
import counterHandle from './counterHandle'

import browser from './browser'
import browserV2 from './browserV2'
import browserElementEdit from './browserElementEdit'
import browserOnNewPage from './browserOnNewPage'
import browserSavePdf from './browserSavePdf'
import browserMonitor from './browserMonitor'
import browserPageScroll from './browserPageScroll'
import browserContentGetter from './browserContentGetter'
import networkListener from './networkListener'
import networkListenerV2 from './networkListenerV2'
import domListener from './domListener'
import domListenerV2 from './domListenerV2'
import keyboardInput from './keyboardInput'
import keyboardInputV2 from './keyboardInputV2'
import mouseAction from './mouseAction'
import pageScroll from './pageScroll'
import websocketListener from './websocketListener'
import injectScript from './injectScript'
import delay from './delay'
import delayV2 from './delayV2'
import trigger from './trigger'


import timeSchedule from './timeSchedule'
import timeGetter from './timeGetter'
import timeHandle from './timeHandle'

import httpRequest from './httpRequest'
import httpRequestV2 from './httpRequestV2'
import httpRequestV3 from './httpRequestV3'

import httpServer from './httpServer'
import websocketSend from './websocketSend'
import debugOutput from './debugOutput'
import notice from './notice'
import noticeV2 from './noticeV2'
import urlVisit from './urlVisit'
import contentGetter from './contentGetter'
import fileSave from './fileSave'
import screenshot from './screenshot'
import fileSelect from './fileSelect'
import fileSelectV2 from './fileSelectV2'
import downloadListener from './downloadListener'
import downloadListenerV2 from './downloadListenerV2'
import customNode from './customNode'
import fileReader from './fileReader'
import fileWriter from './fileWriter'
import fileMove from './fileMove'
import fileDirCreate from './fileDirCreate'
import fileOpenDir from './fileOpenDir'
import fileDelete from './fileDelete'
import fileDirectoryTraverse from './fileDirectoryTraverse'
import fileStatus from './fileStatus'
import elementState from './elementState'
import fileCopy from './fileCopy'
import websocketConnect from './websocketConnect'
import dataSave from './dataSave'
import dataRead from './dataRead'
import dataReadV2 from './dataReadV2'
import dataReadV3 from './dataReadV3'
import dataDelete from './dataDelete'
import dataUpdate from './dataUpdate'
import dataParser from './dataParser'
import dataExtract from './dataExtract'
import dataFilter from './dataFilter'
import dataTemp from './dataTemp'
import dataTempClear from './dataTempClear'
import dataCreate from './dataCreate'
// import dataCrypto from './dataCrypto'
import dataHandler from './dataHandler'
import dataHandlerV2 from './dataHandlerV2'
import dataHandlerString from './dataHandlerString'
import dataHandlerNumber from './dataHandlerNumber'
import dataHandlerObject from './dataHandlerObject'
import dataHandlerArray from './dataHandlerArray'

//逻辑节点
import logicIf from './logicIf'
import logicLoop from './logicLoop'
import logicLoopV2 from './logicLoopV2'
import endNode from './endNode'
import startNode from './startNode'
import workFlow from './workFlow'
import clipboard from './clipboard'
import previewImage from './previewImage'
import previewVideo from './previewVideo'
import previewAudio from './previewAudio'
import subWorkFlow from './subWorkFlow'
import baseThrowExceptional from './baseThrowExceptional'
// 桌面操作节点
// import pcMouse from './pcMouse'
// import pcWindow from './pcWindow'
// Excel操作节点
import workbookCreate from './workbookCreate'
import workbookSave from './workbookSave'
import workbookCellRead from './workbookCellRead'
import workbookCellWrite from './workbookCellWrite'
import workbookRowInsert from './workbookRowInsert'
import workbookRowDelete from './workbookRowDelete'
import workbookColumnInsert from './workbookColumnInsert'
import workbookColumnDelete from './workbookColumnDelete'
import workbookCellMerge from './workbookCellMerge'
import workbookCellMergeUn from './workbookCellMergeUn'
import workflowRestart from './workflowRestart'



// 节点分类
export const categories = {
  // base: {
  //   name: '基础',
  //   nodes: [noticeV2, clipboard, customNode, subWorkFlow]
  // },
  //流程控制
  workflow: {
    name: '流程控制',
    nodes: [logicIf, logicLoopV2, endNode, workflowRestart, baseThrowExceptional,noticeV2, customNode, subWorkFlow]
  },
  //时间计数
  time: {
    name: '时间计数',
    nodes: [timeGetter, timeHandle, timeSchedule, delayV2, baseTimer, baseTimerHandle, counterV2, counterHandle]
  },
  browser: {
    name: '网页控制',
    nodes: [
      browserV2,
      urlVisit,
      keyboardInputV2,
      mouseAction,
      browserPageScroll,
      browserContentGetter,
      elementState,
      browserElementEdit,
      injectScript,
      fileSelectV2,
      screenshot,
      browserMonitor,
      browserOnNewPage,
      downloadListenerV2,
      domListenerV2,
      networkListenerV2,
      websocketListener,
      browserSavePdf
    ]
  },
  // 鼠标操作节点
  // pc: {
  //   name: '桌面操作',
  //   nodes: [pcMouse, pcWindow]
  // },
  data: {
    name: '本地数据',
    nodes: [dataSave, dataReadV3, dataDelete, dataUpdate, dataTemp, dataTempClear]
  },
  network: {
    name: '网络操作',
    nodes: [httpRequestV3, httpServer, websocketConnect, websocketSend]
  },
  file: {
    name: '文件操作',
    nodes: [fileDirCreate, fileOpenDir, fileDirectoryTraverse, fileReader, fileSave, fileWriter, fileMove, fileCopy, fileDelete, fileStatus]
  },
  dataProcess: {
    name: '数据处理',
    nodes: [dataCreate, dataHandlerString, dataHandlerNumber, dataHandlerObject, dataHandlerArray, dataParser, dataExtract, dataFilter,clipboard]
  },
  workbook: {
    name: 'Excel',
    nodes: [workbookCreate, workbookSave, workbookCellMerge, workbookCellMergeUn, workbookCellRead, workbookCellWrite, workbookRowInsert, workbookRowDelete, workbookColumnInsert, workbookColumnDelete]
  },
  priview: {
    name: '文件预览',
    nodes: [previewImage, previewVideo, previewAudio]
  }
}

// 废弃节点（废弃后为了兼容旧版本保留但不可再创建）
const deprecatedNodes = [
  browser,
  logicLoop,
  keyboardInput,
  httpRequest,
  httpRequestV2,
  networkListener,
  fileSelect,
  delay,
  domListener,
  dataHandler,
  downloadListener,
  dataRead,
  dataReadV2,
  debugOutput,
  counter,
  counterClear,
  notice,
  trigger,
  dataHandlerV2,
  pageScroll,
  contentGetter,
]

// 获取所有节点
const getNodes = (isDeprecated = true) => {
  const nodes = {}
  Object.values(categories).forEach((category) => {
    category.nodes.forEach((node) => {
      nodes[node.type] = node
    })
  })
  if (isDeprecated) {
    deprecatedNodes.forEach((node) => {
      node.deprecated = true
      nodes[node.type] = node
    })
  }
  nodes['startNode'] = startNode
  nodes['workFlow'] = workFlow
  return nodes
}
// 导出所有节点
export default getNodes()
const availableNodesForAIBot = getNodes(false)
export { availableNodesForAIBot }
