/**
 * @file: 键盘输入节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconDownload } from '@arco-design/web-vue/es/icon'

export default {
  type: 'keyboardInput',
  name: '键盘输入',
  icon: IconDownload,
  description: '模拟键盘输入操作',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        selector: {
          id: 'selector',
          name: '目标元素',
          type: 'selector',
          description: '要输入的目标元素',
          required: true,
          quickConfig: true
        },
        text: {
          id: 'text',
          name: '输入内容',
          type: 'text',
          description: '要输入的文本内容',
          quickConfig: true
        },
        mode: {
          id: 'mode',
          name: '输入模式',
          type: 'radio',
          options: [
            { label: '整体粘贴', value: 'paste' },
            { label: '逐字输入', value: 'char' }
          ],
          default: 'paste',
          description: '文本输入的方式',
          quickConfig: true
        },
        delay: {
          id: 'delay',
          name: '输入间隔',
          type: 'number',
          min: 0,
          default: 100,
          description: '每个字符的输入间隔(ms)',
          quickConfig: true,
          show: '${mode} === "char"'
        }
      }
    },
    advanced: {
      name: '高级配置',
      fields: {
        clearFirst: {
          id: 'clearFirst',
          name: '先清空',
          type: 'switch',
          default: true,
          description: '输入前是否清空原有内容'
        },
        pressEnter: {
          id: 'pressEnter',
          name: '回车确认',
          type: 'switch',
          default: false,
          description: '输入完成后是否按回车'
        },
        modifiers: {
          id: 'modifiers',
          name: '修饰键',
          type: 'select',
          multiple: true,
          props: {
            allowClear: true
          },
          default: [],
          options: [
            { label: 'Ctrl', value: 'Control' },
            { label: 'Alt', value: 'Alt' },
            { label: 'Shift', value: 'Shift' },
            { label: 'Meta', value: 'Meta' }
          ],
          description: '同时按下的修饰键'
        },
        specialKeys: {
          id: 'specialKeys',
          name: '特殊按键',
          type: 'select',
          multiple: true,
          props: {
            allowClear: true
          },
          default: [],
          options: [
            { label: 'Tab', value: 'Tab' },
            { label: 'Escape', value: 'Escape' },
            { label: 'Backspace', value: 'Backspace' },
            { label: 'Delete', value: 'Delete' },
            { label: 'ArrowUp', value: 'ArrowUp' },
            { label: 'ArrowDown', value: 'ArrowDown' },
            { label: 'ArrowLeft', value: 'ArrowLeft' },
            { label: 'ArrowRight', value: 'ArrowRight' }
          ],
          description: '要按下的特殊按键'
        }
      }
    }
  },
  inputs: [
    {
      id: 'page',
      name: '浏览器',
      type: 'page',
      required: true
    }
  ],
  outputs: []
}
