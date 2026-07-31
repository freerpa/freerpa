/**
 * @file: 复制文件节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { IconCopy } from '@arco-design/web-vue/es/icon'

export default {
  type: 'fileCopy',
  name: '复制文件',
  icon: IconCopy,
  description: '复制文件或目录',
  config: {
    basic: {
      name: '基础配置',
      fields: {
        copyType: {
          id: 'copyType',
          name: '复制类型',
          type: 'radio',
          options: [
            { label: '复制文件', value: 'file' },
            { label: '复制目录', value: 'folder' }
          ],
          default: 'file',
          quickConfig: true,
          description: '复制文件或目录'
        },
        sourcePath: {
          id: 'sourcePath',
          name: '源路径',
          type: 'path',
          pathType: 'file',
          description: '要复制的源文件路径',
          show: "${copyType} === 'file'",
          quickConfig: true,
          required: true
        },
        sourceDirPath: {
          id: 'sourceDirPath',
          name: '源路径',
          type: 'path',
          pathType: 'folder',
          description: '要复制的源目录路径',
          show: "${copyType} === 'folder'",
          quickConfig: true,
          required: true
        },
        targetPath: {
          id: 'targetPath',
          name: '目标路径',
          type: 'path',
          pathType: 'folder',
          description: '复制到的目标路径',
          quickConfig: true,
          required: true
        },
        overwrite: {
          id: 'overwrite',
          name: '强制覆盖',
          type: 'switch',
          default: true,
          quickConfig: true,
          description: '如果目标已存在是否覆盖'
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      id: 'targetPath',
      name: '目标路径',
      type: 'string',
      pathType: 'folder',
      description: '复制到的目标路径'
    }
  ]
}
