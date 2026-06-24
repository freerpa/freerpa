import { RiFileExcelLine } from "@remixicon/vue";


export default {
  type: 'workbookCreate',
  name: '创建工作表',
  icon: RiFileExcelLine,
  description: '创建一张工作表,需要调用【保存工作表】节点才能保存',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        createType: {
          id: 'createType',
          name: '创建方式',
          description: '工作表的创建方式',
          type: 'radio',
          default: 'create',
          options: [
            { label: '直接创建', value: 'create' },
            { label: '从文件创建', value: 'file' }
          ],
          quickConfig: true,
          required: false
        },
        filePath: {
          id: 'filePath',
          name: '文件路径',
          type: 'path',
          show: "${createType} === 'file'",
          pathType: 'file',
          extensions: ['xlsx'],
          description: '选择xlsx文件',
          quickConfig: true,
          required: true
        }
      }
    }
  },
  inputs: [],
  outputs: [
    {
      id: 'worksheet',
      name: '工作表',
      type: 'worksheet',
      description: '工作表'
    }
  ]
}
