/**
 * @file: 文件保存节点
 */
import { IconSave } from '@arco-design/web-vue/es/icon'

export default {
  type: 'fileSave',
  name: '保存文件',
  icon: IconSave,
  description: '保存文件节点：将内容保存到本地，支持 URL 下载、Base64 数据、Buffer、对象（存为 JSON）与纯文本；文件重名时可强制覆盖或自动顺序编号。',
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
          quickConfig: true,
          description: '文件保存目录（文件夹路径）'
        },
        {
          id: 'fileName',
          name: '文件名称',
          type: 'text',
          default: '',
          description: '（含扩展名）如 text.txt；留空时自动从内容推断文件名',
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
          description: '目标文件已存在时的处理：强制覆盖 / 自动生成顺序编号（如 file001.txt）',
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
