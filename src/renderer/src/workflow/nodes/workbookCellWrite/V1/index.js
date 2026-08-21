import { RiTextSnippet } from "@remixicon/vue";
export default {
  type: 'workbookCellWrite',
  name: '写数据',
  icon: RiTextSnippet,
  description: '写入工作表数据',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'writeData',
          name: '数据',
          description: '写入工作表的数据',
          type: 'array',
          default: '',
          fields: [
            {
              id: 'rowIndex',
              name: '行号',
              description: '写入行号 1 表示第一行',
              type: 'number',
              default: 1,
              min: 1,
              quickConfig: true,
              required: false
            },
            {
              id: 'columnIndex',
              name: '列号',
              description: '写入列号 1 表示第一列',
              type: 'number',
              default: 1,
              min: 1,
              quickConfig: true,
              required: false
            },
            {
              id: 'value',
              name: '内容',
              description: '写入内容',
              type: 'text',
              default: '',
              quickConfig: true,
              required: false
            }
          ],
          quickConfig: true,
          required: true
        }
      ]
    }
  ],
  inputs: [{
    id: 'worksheet',
    name: '工作表',
    type: 'worksheet',
    required: true,
    description: '工作表'
  }],
  outputs: [

  ]
}
