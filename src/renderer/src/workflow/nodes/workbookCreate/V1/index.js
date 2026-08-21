import { RiFileExcelLine } from "@remixicon/vue";


export default {
  type: 'workbookCreate',
  name: '创建工作簿',
  icon: RiFileExcelLine,
  description: '创建 Excel 工作簿（含默认 Sheet1），需调用【保存工作簿】节点保存为 .xlsx',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'createType',
          name: '创建方式',
          description: '工作表的创建方式',
          type: 'radio',
          default: 'create',
          options: [
            { label: '新建空表', value: 'create' },
            { label: '读取文件', value: 'file' }
          ],
          quickConfig: true,
          required: false
        },
        {
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
      ]
    }
  ],
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
