import { RiDeleteColumn } from "@remixicon/vue";
export default {
  type: 'workbookColumnDelete',
  name: '删除列',
  icon: RiDeleteColumn,
  description: '删除工作表的列',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'columnIndex',
          name: '列号',
          description: '要删除的列号 1 表示删除第一列', 
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
      id: 'columnCount',
      name: '总列数',
      type: 'number',
      description: '工作表总列数'
    }
  ]
}
