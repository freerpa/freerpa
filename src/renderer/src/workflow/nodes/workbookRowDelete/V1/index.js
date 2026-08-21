import { RiDeleteRow } from "@remixicon/vue";
export default {
  type: 'workbookRowDelete',
  name: '删除行',
  icon: RiDeleteRow,
  description: '删除工作表的行',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'rowIndex',
          name: '行号',
          description: '要删除的行号 1 表示删除第一行',
          type: 'number',
          default: 1,
          min: 1,
          quickConfig: true,
          required: false
        },
        {
          id: 'order',
          name: '顺序',
          description: '删除行的顺序',
          type: 'radio',
          default: 'asc',
          quickConfig: true,
          required: false,
          options: [
            {
              label: '正序',
              value: 'asc'
            },
            {
              label: '倒序',
              value: 'desc'
            }
          ]
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
    {
      id: 'rowCount',
      name: '总行数',
      type: 'number',
      description: '工作表总行数'
    }
  ]
}
