/**
 * @file: 文件移动节点
 */
import { RiFileTransferLine } from '@remixicon/vue'

export default {
  type: 'fileMove',
  name: '移动文件',
  icon: RiFileTransferLine,
  description: '移动文件或目录',
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'moveType',
          name: '移动类型',
          type: 'radio',
          options: [
            { label: '移动文件', value: 'file' },
            { label: '移动目录', value: 'folder' }
          ],
          default: 'file',
          quickConfig: true,
          description: '移动文件或目录'
        },
        {
          id: 'sourcePath',
          name: '源路径',
          type: 'path',
          pathType: 'file',
          description: '要移动的源文件路径',
          show: "${moveType} === 'file'",
          quickConfig: true,
          required: true
        },
        {
          id: 'sourceDirPath',
          name: '源路径',
          type: 'path',
          pathType: 'folder',
          description: '要移动的源目录路径',
          show: "${moveType} === 'folder'",
          quickConfig: true,
          required: true
        },
        {
          id: 'targetPath',
          name: '目标路径',
          type: 'path',
          pathType: 'folder',
          description: '移动到的目标路径',
          quickConfig: true,
          required: true
        },
        {
          id: 'overwrite',
          name: '强制覆盖',
          type: 'switch',
          default: true,
          quickConfig: true,
          description: '如果目标已存在是否覆盖'
        }
      ]
    }
  ],
  inputs: [],
  outputs: [
    {
      id: 'targetPath',
      name: '目标路径',
      type: 'string',
      pathType: 'folder',
      description: '移动到的目标路径'
    }
  ]
}
