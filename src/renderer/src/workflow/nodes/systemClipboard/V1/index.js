import { IO_FIELD_MAP_STANDARD } from '../../../io-conventions.js'
/**
 * @file: 剪贴板操作节点
 */
import { IconPaste } from '@arco-design/web-vue/es/icon'

export default {
  type: 'systemClipboard',
  name: '系统剪贴板',
  icon: IconPaste,
  description: '系统剪贴板操作节点：读取系统剪贴板的文本内容、写入文本到剪贴板，或清空剪贴板。读取/写入模式均输出 content（剪贴板文本）。',
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'type',
          name: '操作类型',
          type: 'radio',
          options: [
            { label: '读取', value: 'read' },
            { label: '写入', value: 'write' },
            { label: '清空', value: 'clear' }
          ],
          default: 'read',
          description: '剪贴板操作类型：read（读取系统剪贴板文本）/ write（写入文本）/ clear（清空剪贴板）',
          quickConfig: true,
          onChange: (value, formData) => {
            if (value === 'read') {
              formData.outputs = [
                {
                  id: 'content',
                  name: '剪贴板内容',
                  type: ['string'],
                  description: '从剪贴板读取的内容'
                }
              ]
            } else {
              formData.outputs = []
            }
          }
        },
        {
          id: 'content',
          name: '写入内容',
          type: 'text',
          default: '',
          description: '要写入剪贴板的文本内容（仅写入模式生效；若上游传入同名 content 数据，则以上游数据为准）',
          quickConfig: true,
          show: "${type} === 'write'"
        },
        {
          id: 'outputs',
          name: '输出',
          type: 'array',
          show: false,
          fields: [],
          default: [{
            id: 'content',
            name: '剪贴板内容',
            type: ['string'],
            description: '从剪贴板读取的内容'
          }]
        }
      ]
    }
  ],
  inputs: [],
  outputs: [
    {
      type: 'dynamic',
      dataPath: 'outputs',
      fieldMap: IO_FIELD_MAP_STANDARD
    }
  ]
}
