/**
 * @file: 文件目录创建节点
 */
import { RiFolderAddLine } from '@remixicon/vue'

export default {
  type: 'fileDirCreate',
  name: '创建目录',
  icon: RiFolderAddLine,
  description: '创建目录节点：在本地创建目录，支持多级递归创建；创建成功返回目录路径，失败返回空字符串。',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'dirPath',
          name: '目录路径',
          type: 'path',
          pathType: 'directory',
          default: '',
          required: true,
          quickConfig: true,
          description: '要创建的目录路径（支持多级，自动递归创建）'
        }
      ]
    }
  ],
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
