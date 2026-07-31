/**
 * @file: 文件删除节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { RiFileShredLine } from "@remixicon/vue";

export default {
  type: 'fileDelete',
  name: '删除文件',
  icon: RiFileShredLine,
  description: '删除文件或目录',
  config: {
    basic: {
      name: '基础配置',
      fields: {
        deleteType: {
          id: 'deleteType',
          name: '删除类型',
          type: 'radio',
          options: [
            { label: '删除文件', value: 'file' },
            { label: '删除目录', value: 'folder' }
          ],
          default: 'file',
          quickConfig: true,
          description: '删除文件或目录'
        },
        filePath: {
          id: 'filePath',
          name: '文件路径',
          type: 'path',
          pathType: 'file',
          description: '要删除的文件或目录路径',
          show: "${deleteType} === 'file'",
          quickConfig: true,
          required: true
        },
        dirPath: {
          id: 'dirPath',
          name: '目录路径',
          type: 'path',
          pathType: 'folder',
          description: '要删除的目录路径',
          show: "${deleteType} === 'folder'",
          quickConfig: true,
          required: true
        },
        force: {
          id: 'force',
          name: '强制删除',
          type: 'switch',
          default: false,
          quickConfig: true,
          description: '是否强制删除（忽略只读属性）'
        }
      }
    }
  },
  inputs: [],
  outputs: []
}
