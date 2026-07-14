/**
 * @file: 工作流节点定义
 * @author: dabao
 * @date: 2024-03-15
 */

// 流程控制节点
import workflowIf from './workflowIf'
import workflowLoop from './workflowLoop'
import workflowEnd from './workflowEnd'
import workflowRestart from './workflowRestart'
import workflowThrowException from './workflowThrowException'
import workflowNotice from './workflowNotice'
import workflowCustomNode from './workflowCustomNode'
import workflowSubWorkflow from './workflowSubWorkflow'

// 时间计数节点
import timeGetter from './timeGetter'
import timeHandle from './timeHandle'
import timeSchedule from './timeSchedule'
import timeDelay from './timeDelay'
import timeBaseTimer from './timeBaseTimer'
import timeBaseTimerHandle from './timeBaseTimerHandle'
import timeCounter from './timeCounter'
import timeCounterHandle from './timeCounterHandle'

// 网页控制节点
import browserOpen from './browserOpen'
import browserUrlVisit from './browserUrlVisit'
import browserKeyboardInput from './browserKeyboardInput'
import browserMouseAction from './browserMouseAction'
import browserPageScroll from './browserPageScroll'
import browserContentGetter from './browserContentGetter'
import browserElementState from './browserElementState'
import browserElementEdit from './browserElementEdit'
import browserInjectScript from './browserInjectScript'
import browserFileSelect from './browserFileSelect'
import browserScreenshot from './browserScreenshot'
import browserMonitor from './browserMonitor'
import browserOnNewPage from './browserOnNewPage'
import browserDownloadListener from './browserDownloadListener'
import browserDomListener from './browserDomListener'
import browserNetworkListener from './browserNetworkListener'
import browserWebsocketListener from './browserWebsocketListener'
import browserSavePdf from './browserSavePdf'

// 本地数据节点
import dataSave from './dataSave'
import dataRead from './dataRead'
import dataDelete from './dataDelete'
import dataUpdate from './dataUpdate'
import dataTemp from './dataTemp'
import dataTempClear from './dataTempClear'

// 网络操作节点
import networkHttpRequest from './networkHttpRequest'
import networkHttpServer from './networkHttpServer'
import networkWebsocketConnect from './networkWebsocketConnect'
import networkWebsocketSend from './networkWebsocketSend'

// 文件操作节点
import fileDirCreate from './fileDirCreate'
import fileOpenDir from './fileOpenDir'
import fileDirectoryTraverse from './fileDirectoryTraverse'
import fileReader from './fileReader'
import fileSave from './fileSave'
import fileWriter from './fileWriter'
import fileMove from './fileMove'
import fileCopy from './fileCopy'
import fileDelete from './fileDelete'
import fileStatus from './fileStatus'

// 数据处理节点
import dataCreate from './dataCreate'
import dataHandlerString from './dataHandlerString'
import dataHandlerNumber from './dataHandlerNumber'
import dataHandlerObject from './dataHandlerObject'
import dataHandlerArray from './dataHandlerArray'
import dataParser from './dataParser'
import dataExtract from './dataExtract'
import dataFilter from './dataFilter'
import dataClipboard from './dataClipboard'

// Excel 节点
import workbookCreate from './workbookCreate'
import workbookSave from './workbookSave'
import workbookCellMerge from './workbookCellMerge'
import workbookCellMergeUn from './workbookCellMergeUn'
import workbookCellRead from './workbookCellRead'
import workbookCellWrite from './workbookCellWrite'
import workbookRowInsert from './workbookRowInsert'
import workbookRowDelete from './workbookRowDelete'
import workbookColumnInsert from './workbookColumnInsert'
import workbookColumnDelete from './workbookColumnDelete'

// 文件预览节点
import previewImage from './previewImage'
import previewVideo from './previewVideo'
import previewAudio from './previewAudio'

// 特殊节点
import workflowStart from './workflowStart'
import workFlow from './workFlow'
import workflowCallPlugin from './workflowCallPlugin'

// 节点分类
export const categories = {
  workflow: {
    name: '流程控制',
    nodes: [workflowIf, workflowLoop, workflowEnd, workflowRestart, workflowThrowException, workflowNotice, workflowCustomNode, workflowSubWorkflow, workflowCallPlugin]
  },
  time: {
    name: '时间计数',
    nodes: [timeGetter, timeHandle, timeSchedule, timeDelay, timeBaseTimer, timeBaseTimerHandle, timeCounter, timeCounterHandle]
  },
  browser: {
    name: '网页控制',
    nodes: [
      browserOpen,
      browserUrlVisit,
      browserKeyboardInput,
      browserMouseAction,
      browserPageScroll,
      browserContentGetter,
      browserElementState,
      browserElementEdit,
      browserInjectScript,
      browserFileSelect,
      browserScreenshot,
      browserMonitor,
      browserOnNewPage,
      browserDownloadListener,
      browserDomListener,
      browserNetworkListener,
      browserWebsocketListener,
      browserSavePdf
    ]
  },
  data: {
    name: '本地数据',
    nodes: [dataSave, dataRead, dataDelete, dataUpdate, dataTemp, dataTempClear]
  },
  network: {
    name: '网络操作',
    nodes: [networkHttpRequest, networkHttpServer, networkWebsocketConnect, networkWebsocketSend]
  },
  file: {
    name: '文件操作',
    nodes: [fileDirCreate, fileOpenDir, fileDirectoryTraverse, fileReader, fileSave, fileWriter, fileMove, fileCopy, fileDelete, fileStatus]
  },
  dataProcess: {
    name: '数据处理',
    nodes: [dataCreate, dataHandlerString, dataHandlerNumber, dataHandlerObject, dataHandlerArray, dataParser, dataExtract, dataFilter, dataClipboard]
  },
  workbook: {
    name: 'Excel',
    nodes: [workbookCreate, workbookSave, workbookCellMerge, workbookCellMergeUn, workbookCellRead, workbookCellWrite, workbookRowInsert, workbookRowDelete, workbookColumnInsert, workbookColumnDelete]
  },
  preview: {
    name: '文件预览',
    nodes: [previewImage, previewVideo, previewAudio]
  }
}

// 获取所有节点
const getNodes = () => {
  const nodes = {}
  Object.values(categories).forEach((category) => {
    category.nodes.forEach((node) => {
      nodes[node.type] = node
    })
  })
  nodes['workflowStart'] = workflowStart
  nodes['workFlow'] = workFlow
  return nodes
}

// 导出所有节点
export default getNodes()

const availableNodesForAIBot = getNodes()
export { availableNodesForAIBot }
