/**
 * @file: 下载监听节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { IconCloudDownload } from '@arco-design/web-vue/es/icon'

export default {
  // 节点名称
  name: '下载监听',
  // 节点类型
  type: 'browserDownloadListener',
  // 节点图标
  icon: IconCloudDownload,
  // 节点描述
  description: '监听页面下载事件（常驻监听，需 workflowEnd 或手动停止结束流程）',
  // 节点分类
  view: true,
  // 节点配置
  config: {
    // 基础配置
    basic: {
      name: '基础配置',
      fields: {
        savePath: {
          id: 'savePath',
          name: '保存路径',
          type: 'path',
          description: '为空则不保存',
          quickConfig: true
        },
        isContinuous: {
          id: 'isContinuous',
          name: '持续监听',
          type: 'switch',
          default: false,
          description: '是否持续监听下载事件',
          quickConfig: true
        }
      }
    }
  },
  // 输入
  inputs: [
    {
      id: 'page',
      name: '浏览器',
      type: 'page',
      required: true
    }
  ],
  // 输出
  outputs: [
    {
      id: 'downloadUrl',
      name: '下载地址',
      type: 'string',
      label: '下载地址',
      description: '下载的文件地址'
    },
    {
      id: 'fileName',
      name: '文件名',
      type: 'string',
      label: '文件名',
      description: '下载的文件名'
    },
    {
      id: 'filePath',
      name: '文件路径',
      type: 'string',
      label: '文件路径',
      description: '下载的文件路径'
    }
  ]
}
