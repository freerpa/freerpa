/**
 * @file: 键盘操作节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { RiKeyboardLine } from "@remixicon/vue";

export default {
  type: 'keyboardInputV2',
  name: '键盘操作',
  icon: RiKeyboardLine,
  description: '模拟键盘操作',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        // 操作类型
        keyboardMode: {
          id: 'keyboardMode',
          name: '操作类型',
          type: 'radio',
          options: [
            { label: '输入文本', value: 'input' },
            { label: '按下按键', value: 'key' }
          ],
          default: 'input',
          description: '键盘输入的模式',
          quickConfig: true
        },
        // 按键目标
        keySelector: {
          id: 'keySelector',
          name: '按键区域',
          type: 'selector',
          description: '要操作的按键区域，为空则默认当前页面焦点区域',
          quickConfig: true,
          show: '${keyboardMode} === "key"'
        },
        // 输入目标
        inputSelector: {
          id: 'inputSelector',
          name: '目标元素',
          type: 'selector',
          description: '要输入的目标元素',
          required: true,
          quickConfig: true,
          show: '${keyboardMode} === "input"'
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
          quickConfig: true,
          show: '${keyboardMode} === "input"'
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
        },
        text: {
          id: 'text',
          name: '输入内容',
          type: 'text',
          description: '要输入的文本内容',
          quickConfig: true,
          show: '${keyboardMode} === "input"'
        },
        // 输入设置
        inputConfig: {
          id: 'inputConfig',
          name: '输入设置',
          type: 'checkbox',
          options: [
            { label: '先清空', value: 'clearFirst' },
            { label: '回车确认', value: 'pressEnter' }
          ],
          default: ['clearFirst'],
          description: '输入设置',
          show: '${keyboardMode} === "input"',
          quickConfig: true
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
            { label: 'Meta', value: 'Meta' },
            { label: 'Windows', value: 'Windows' },
            { label: 'Command', value: 'Command' },
            { label: 'Option', value: 'Option' }
          ],
          description: '同时按下的修饰键',
          show: '${keyboardMode} === "key"',
          quickConfig: true
        },
        keys: {
          id: 'keys',
          name: '按键',
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
            { label: 'ArrowRight', value: 'ArrowRight' },
            { label: 'Enter', value: 'Enter' },
            { label: 'Space', value: 'Space' },
            { label: 'A', value: 'A' },
            { label: 'B', value: 'B' },
            { label: 'C', value: 'C' },
            { label: 'D', value: 'D' },
            { label: 'E', value: 'E' },
            { label: 'F', value: 'F' },
            { label: 'G', value: 'G' },
            { label: 'H', value: 'H' },
            { label: 'I', value: 'I' },
            { label: 'J', value: 'J' },
            { label: 'K', value: 'K' },
            { label: 'L', value: 'L' },
            { label: 'M', value: 'M' },
            { label: 'N', value: 'N' },
            { label: 'O', value: 'O' },
            { label: 'P', value: 'P' },
            { label: 'Q', value: 'Q' },
            { label: 'R', value: 'R' },
            { label: 'S', value: 'S' },
            { label: 'T', value: 'T' },
            { label: 'U', value: 'U' },
            { label: 'V', value: 'V' },
            { label: 'W', value: 'W' },
            { label: 'X', value: 'X' },
            { label: 'Y', value: 'Y' },
            { label: 'Z', value: 'Z' },
            { label: '0', value: '0' },
            { label: '1', value: '1' },
            { label: '2', value: '2' },
            { label: '3', value: '3' },
            { label: '4', value: '4' },
            { label: '5', value: '5' },
            { label: '6', value: '6' },
            { label: '7', value: '7' },
            { label: '8', value: '8' },
            { label: '9', value: '9' },
            { label: 'F1', value: 'F1' },
            { label: 'F2', value: 'F2' },
            { label: 'F3', value: 'F3' },
            { label: 'F4', value: 'F4' },
            { label: 'F5', value: 'F5' },
            { label: 'F6', value: 'F6' },
            { label: 'F7', value: 'F7' },
            { label: 'F8', value: 'F8' },
            { label: 'F9', value: 'F9' },
            { label: 'F10', value: 'F10' },
            { label: 'F11', value: 'F11' },
            { label: 'F12', value: 'F12' },
            { label: '~', value: '~' },
            { label: '!', value: '!' },
            { label: '@', value: '@' },
            { label: '#', value: '#' },
            { label: '$', value: '$' },
            { label: '%', value: '%' },
            { label: '^', value: '^' },
            { label: '&', value: '&' },
            { label: '*', value: '*' },
            { label: '(', value: '(' },
            { label: ')', value: ')' },
            { label: '-', value: '-' },
            { label: '_', value: '_' },
            { label: '=', value: '=' },
            { label: '+', value: '+' },
            { label: '[', value: '[' },
            { label: ']', value: ']' },
            { label: '{', value: '{' },
            { label: '}', value: '}' },
            { label: '\\', value: '\\' },
            { label: '|', value: '|' },
            { label: ';', value: ';' },
            { label: ':', value: ':' },
            { label: '\'', value: '\'' },
            { label: '"', value: '"' },
            { label: ',', value: ',' },
            { label: '<', value: '<' },
            { label: '.', value: '.' },
            { label: '>', value: '>' },
            { label: '/', value: '/' },
            { label: '?', value: '?' }
          ],
          description: '要按下的键',
          show: '${keyboardMode} === "key"',
          quickConfig: true
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
