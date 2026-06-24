import { RiSave3Line } from "@remixicon/vue";


export default {
  type: 'workbookSave',
  name: '保存工作表',
  icon: RiSave3Line,
  description: '保存工作表到文件',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        filePath: {
          id: 'filePath',
          name: '文件路径',
          type: 'path',
          pathType: 'folder',
          description: '选择要保存的目录路径',
          quickConfig: true,
          required: true
        },
        fileName: {
          id: 'fileName',
          name: '文件名',
          type: 'string',
          default: '',
          description: '文件名（无需扩展名 默认.xlsx）',
          quickConfig: true,
          required: true
        }
      }
    }
  },
  inputs: [{
    id: 'worksheet',
    name: '工作表',
    type: 'worksheet',
    required: true,
    description: '工作表'
  }],
  outputs: [
    {
      id: 'filePath',
      name: '文件路径',
      type: 'string',
      description: '保存的文件路径'
    }
  ]
}
