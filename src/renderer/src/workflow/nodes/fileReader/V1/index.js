/**
 * @file: 文件读取节点
 */
import { RiFileTextLine } from "@remixicon/vue";

export default {
  type: 'fileReader',
  name: '读取文件',
  icon: RiFileTextLine,
  description: '读取本地文件内容',
  config: {
    basic: {
      name: '基础配置',
      fields: {
        filePath: {
          id: 'filePath',
          name: '文件路径',
          type: 'path',
          pathType: 'file',
          description: '要读取的文件路径',
          quickConfig: true,
          required: true
        },
        encoding: {
          id: 'encoding',
          name: '文件编码',
          type: 'select',
          quickConfig: true,
          options: [
            { label: 'UTF-8', value: 'utf8' },
            { label: 'GBK', value: 'gbk' },
            { label: 'ASCII', value: 'ascii' },
            { label: 'Binary', value: 'binary' }
          ],
          default: 'utf8',
          description: '文件编码格式'
        },
        readMode: {
          id: 'readMode',
          name: '读取方式',
          type: 'select',
          options: [
            { label: '全部内容', value: 'all' },
            { label: '按行读取', value: 'line' }
          ],
          default: 'all',
          quickConfig: true,
          description: '文件读取方式'
        },
        startLine: {
          id: 'startLine',
          name: '起始行',
          type: 'number',
          default: 1,
          show: "${readMode} === 'line'",
          quickConfig: true,
          description: '从第几行开始读取'
        },
        endLine: {
          id: 'endLine',
          name: '结束行',
          type: 'number',
          show: "${readMode} === 'line'",
          quickConfig: true,
          description: '读取到第几行（为空表示读到末尾）'
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      id: 'result',
      name: '文件内容',
      type: ['string'],
      description: '文件内容'
    },
    {
      id: 'filePath',
      name: '文件路径',
      type: ['string'],
      description: '文件路径'
    }
  ]
}
