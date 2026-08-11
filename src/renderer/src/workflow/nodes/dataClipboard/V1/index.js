import { IO_FIELD_MAP_STANDARD } from '../../../io-conventions.js'
/**
 * @file: 剪切板操作节点
 */
import { IconPaste } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dataClipboard',
  name: '系统剪切板',
  icon: IconPaste,
  description: '读取或设置系统剪切板内容',
  config: {
    basic: {
      name: '基础配置',
      fields: {
        type: {
          id: 'type',
          name: '操作类型',
          type: 'radio',
          options: [
            { label: '读取', value: 'read' },
            { label: '写入', value: 'write' },
            { label: '清空', value: 'clear' }
          ],
          default: 'read',
          description: '选择要执行的剪切板操作',
          quickConfig: true,
          onChange: (value, formData) => {
            if (value === 'read') {
              formData.value.outputs = [
                {
                  id: 'content',
                  name: '剪切板内容',
                  type: ['string'],
                  description: '从剪切板读取的内容'
                }
              ]
            } else {
              formData.value.outputs = []
            }
          }
        },
        content: {
          id: 'content',
          name: '写入内容',
          type: 'text',
          default: '',
          description: '要写入剪切板的内容（仅在设置剪切板时使用）,优先级低于参数传入的内容',
          quickConfig: true,
          show: "${type} === 'write'"
        },
        outputs: {
          id: 'outputs',
          name: '输出',
          type: 'array',
          show: false,
          fields: [],
          default: [{
            id: 'content',
            name: '剪切板内容',
            type: ['string'],
            description: '从剪切板读取的内容'
          }]
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      type: 'dynamic',
      dataPath: 'outputs',
      fieldMap: IO_FIELD_MAP_STANDARD
    }
  ]
}
