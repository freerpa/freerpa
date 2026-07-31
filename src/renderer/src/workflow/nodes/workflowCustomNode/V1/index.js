/**
 * @file: 自定义节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { IconCode } from '@arco-design/web-vue/es/icon'
import { dynamicFields, configFields } from '../../common'
const fields = JSON.parse(JSON.stringify(dynamicFields))
fields.type.options = [
  { label: '文本', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '是否', value: 'boolean' },
  { label: '数组', value: 'array' },
  { label: '对象', value: 'object' },
  { label: '任意', value: 'any' }
]
export default {
  // 节点名称
  name: '自定义',
  // 节点类型
  type: 'workflowCustomNode',
  description: '使用 JavaScript 代码实现自定义逻辑，沙箱环境，无法传递不可序列化对象，不支持Node.js模块，可使用基于浏览器的远程es6模块调用',
  // 节点图标
  icon: IconCode,
  view: true,
  // 节点配置
  config: {
    // 执行代码
    basic: {
      name: '执行代码',
      fields: {
        openSource: {
          id: 'openSource',
          name: '是否开源',
          type: 'switch',
          default: true,
          description: '开源后任意用户都可以查看和修改代码，闭源后只有创建者可以查看和修改代码',
          show: '${isAuthor}'
        },
        // 自定义代码
        code: {
          id: 'code',
          name: '执行代码',
          type: 'code',
          nolabel: true,
          default: `// 在这里编写你的javascript代码
// 你可以使用 inputs 获取输入数据,config 获取配置数据
// 注意：沙箱环境，无法传递不可序列化对象
// 使用 complete() 完成节点并输出数据 如：complete({输出参数1: 输出数据1,输出参数2: 输出数据2})
// 支持基于浏览器的远程es6模块调用 如：
const { default : md5 } = await import("https://cdn.jsdelivr.net/npm/md5@2.3.0/+esm");
// 基本示例
complete({
  输出:{
    ...inputs,
    ...config,
    md5:md5(123456)
  }
})`,
          language: 'javascript'
        }
      }
    },
    inputs: {
      name: '输入项',
      fields: {
        inputs: {
          id: 'inputs',
          name: '输入项',
          nolabel: true,
          type: 'array',
          description: '设置输入参数',
          fields: fields,
          default: [
            {
              name: '输入',
              description: '输入数据',
              type: 'any',
              stringValue: '',
              numberValue: 0,
              booleanValue: false,
              arrayValue: '[]',
              objectValue: '{}',
              anyValue: "'输入的默认值'",
              required: false
            }
          ]
        }
      }
    },
    config: {
      name: '配置项',
      fields: {
        params: {
          id: 'params',
          name: '配置项',
          nolabel: true,
          type: 'array',
          description: '设置自定义配置数据',
          fields: configFields,
          default: []
        }
      }
    },
    outputs: {
      name: '输出项',
      fields: {
        outputs: {
          id: 'outputs',
          name: '输出项',
          nolabel: true,
          type: 'array',
          description: '设置输出参数',
          fields: fields,
          default: [
            {
              name: '输出',
              description: '输出数据',
              type: 'any',
              stringValue: '',
              numberValue: 0,
              booleanValue: false,
              arrayValue: '[]',
              objectValue: '{}',
              anyValue: "'输出的默认值'",
              required: false
            }
          ]
        }
      }
    },
    description: {
      name: '节点描述',
      fields: {
        description: {
          id: 'description',
          name: '节点描述',
          nolabel: true,
          type: 'string',
          paramRef: false,
          description: '在这里填写关于节点的描述，可以包含节点的用途、使用方法、注意事项等'
        }
      }
    }
  },
  // 输入
  inputs: [
    {
      type: 'dynamic',
      dataPath: 'inputs',
      fieldMap: {
        id: 'name',
        name: 'name',
        description: 'description',
        type: 'type',
        required: 'required'
      }
    }
  ],
  // 输出
  outputs: [
    {
      type: 'dynamic',
      dataPath: 'outputs',
      fieldMap: {
        id: 'name',
        name: 'name',
        description: 'description',
        type: 'type',
        required: 'required'
      }
    }
  ]
}
