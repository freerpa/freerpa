/**
 * @file: 文件写入节点
 */
import { RiFileEditLine } from "@remixicon/vue";

export default {
  type: 'fileWriter',
  name: '写入文件',
  icon: RiFileEditLine,
  description: '将内容写入本地文件',
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'filePath',
          name: '文件路径',
          type: 'path',
          pathType: 'file',
          description: '要写入的文件路径',
          quickConfig: true,
          required: true
        },
        {
          id: 'content',
          name: '写入内容',
          type: 'any',
          required: true,
          quickConfig: true,
          description: '要写入文件的内容'
        },
        {
          id: 'encoding',
          name: '文件编码',
          type: 'select',
          options: [
            { label: 'UTF-8', value: 'utf8' },
            { label: 'GBK', value: 'gbk' },
            { label: 'ASCII', value: 'ascii' },
            { label: 'Binary', value: 'binary' }
          ],
          default: 'utf8',
          quickConfig: true,
          description: '文件编码格式'
        },
        {
          id: 'writeMode',
          name: '写入模式',
          type: 'radio',
          options: [
            { label: '覆盖', value: 'overwrite' },
            { label: '追加', value: 'append' }
          ],
          default: 'overwrite',
          quickConfig: true,
          description: '文件写入模式'
        },
        {
          id: 'appendLineBreak',
          name: '追加换行',
          type: 'switch',
          default: false,
          quickConfig: true,
          show: '${writeMode} === "append"',
          description: '是否在写入内容前添加换行符'
        }
      ]
    }
  ],
  inputs: [],
  outputs: []
}
