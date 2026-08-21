/**
 * @file: 文件保存节点
 */
import { IconSave } from '@arco-design/web-vue/es/icon'

export default {
  type: 'fileSave',
  name: '保存文件',
  icon: IconSave,
  description: '保存文件到本地（支持链接、Base64、文本）',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'filePath',
          name: '保存路径',
          type: 'path',
          pathType: 'directory',
          default: '',
          required: true,
          quickConfig: true
        },
        {
          id: 'fileName',
          name: '文件名称',
          type: 'text',
          default: '',
          description: '（含扩展名）如 text.txt',
          quickConfig: true
        },
        {
          id: 'overwrite',
          name: '覆盖文件',
          type: 'radio',
          options: [
            { label: '强制覆盖', value: true },
            { label: '顺序编号', value: false }
          ],
          default: true,
          description: '是否允许覆盖文件',
          quickConfig: true
        }
      ]
    }
  ],
  inputs: [
    {
      id: 'content',
      name: '内容',
      type: 'any',
      required: true,
      description: '要保存的内容（支持URL链接、Base64、Buffer、对象等）'
    }
  ],
  outputs: [
    {
      id: 'result',
      name: '文件路径',
      type: 'string',
      description: '保存成功会返回文件路径，失败会返回空字符串'
    }
  ]
}
