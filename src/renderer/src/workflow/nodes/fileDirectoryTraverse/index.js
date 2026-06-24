/**
 * @file: 文件目录遍历节点
 * @author: AutoMan
 * @date: 2025-07-30
 */
import { RiFolderLine } from "@remixicon/vue";

export default {
  type: 'fileDirectoryTraverse',
  name: '读取目录',
  icon: RiFolderLine,
  description: '读取指定目录下的所有文件或文件夹',
  config: {
    basic: {
      name: '基础配置',
      fields: {
        directoryPath: {
          id: 'directoryPath',
          name: '目录路径',
          type: 'path',
          description: '要读取的目录路径',
          required: true,
          quickConfig: true
        },
        traverseType: {
          id: 'traverseType',
          name: '读取类型',
          type: 'checkbox',
          options: [
            { label: '文件', value: 'files' },
            { label: '文件夹', value: 'directories' }
          ],
          default: ['files'],
          description: '选择要读取的内容类型',
          quickConfig: true
        },
        isDeep: {
          id: 'isDeep',
          name: '深度读取',
          type: 'switch',
          default: true,
          description: '是否递归读取子目录',
          quickConfig: true
        },
        maxDepth: {
          id: 'maxDepth',
          name: '最大深度',
          type: 'number',
          default: 10,
          description: '递归读取的最大深度（0表示无限制）', 
          min: 0,
          show: '${isDeep}',
          quickConfig: true
        },
        includePattern: {
          id: 'includePattern',
          name: '包含模式',
          type: 'text',
          default: '*',
          description: '文件名匹配模式（支持通配符，如*.txt）',
          quickConfig: true
        },
        excludePattern: {
          id: 'excludePattern',
          name: '排除模式',
          type: 'text',
          default: '',
          description: '要排除的文件名模式（支持通配符）',
          quickConfig: true
        },
        sortBy: {
          id: 'sortBy',
          name: '排序方式',
          type: 'select',
          options: [
            { label: '名称', value: 'name' },
            { label: '大小', value: 'size' },
            { label: '修改时间', value: 'mtime' },
            { label: '创建时间', value: 'ctime' },
            { label: '不排序', value: 'none' }
          ],
          default: 'name',
          description: '结果排序方式',
          quickConfig: true
        },
        sortOrder: {
          id: 'sortOrder',
          name: '排序顺序',
          type: 'select',
          options: [
            { label: '升序', value: 'asc' },
            { label: '降序', value: 'desc' }
          ],
          default: 'asc',
          description: '结果排序顺序',
          show: '${sortBy} !== "none"',
          quickConfig: true
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      id: 'paths',
      name: '路径列表',
      type: ['array'],
      description: '遍历得到的文件或文件夹路径列表'
    },
    {
      id: 'count',
      name: '数量',
      type: ['number'],
      description: '遍历得到的文件或文件夹数量'
    },
    {
      id: 'rootPath',
      name: '根目录',
      type: ['string'],
      description: '遍历的根目录路径'
    }
  ]
}