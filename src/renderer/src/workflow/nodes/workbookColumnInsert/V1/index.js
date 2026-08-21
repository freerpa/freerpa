import { RiInsertColumnRight } from "@remixicon/vue";
export default {
  type: 'workbookColumnInsert',
  name: '插入列',
  icon: RiInsertColumnRight,
  description: '插入工作表的列',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'type',
          name: '类型',
          description: '插入列：在指定列号插入一列\n追加列：在最后追加一列',
          type: 'radio',
          default: 'insert',
          options: [
            { label: '插入列', value: 'insert' },
            { label: '追加列', value: 'append' }
          ],
          quickConfig: true,
          required: false
        },
        {
          id: 'columnIndex',
          name: '列号',
          description: '要添加的列号 1 表示插入到第一列', 
          show: "${type} === 'insert'",
          type: 'number',
          default: 1,
          min: 1,
          quickConfig: true,
          required: false
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
      id: 'columnIndex',
      name: '列号',
      type: 'number',
      description: '添加的列号'
    },
    {
      id: 'columnCount',
      name: '总列数',
      type: 'number',
      description: '工作表总列数'
    }
  ]
}
