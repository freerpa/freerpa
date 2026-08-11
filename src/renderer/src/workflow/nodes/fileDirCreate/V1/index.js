/**
 * @file: 文件目录创建节点
 */
import { RiFolderAddLine } from '@remixicon/vue'

export default {
  type: 'fileDirCreate',
  name: '创建目录',
  icon: RiFolderAddLine,
  description: '创建目录（支持递归创建）',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        dirPath: {
          id: 'dirPath',
          name: '目录路径',
          type: 'path',
          pathType: 'directory',
          default: '',
          required: true,
          quickConfig: true
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      id: 'result',
      name: '目录路径',
      type: 'string',
      description: '创建成功会返回目录路径，失败会返回空字符串'
    }
  ]
}
