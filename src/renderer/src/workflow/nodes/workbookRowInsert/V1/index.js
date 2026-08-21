import { RiInsertRowBottom } from "@remixicon/vue";
export default {
  type: 'workbookRowInsert',
  name: '插入行',
  icon: RiInsertRowBottom,
  description: '插入工作表的行',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'type',
          name: '类型',
          description: '插入行：在指定行号插入一行\n追加行：在最后追加一行',
          type: 'radio',
          default: 'insert',
          options: [
            { label: '插入行', value: 'insert' },
            { label: '追加行', value: 'append' }
          ],
          quickConfig: true,
          required: false
        },
        {
          id: 'rowIndex',
          name: '行号',
          description: '要添加的行号 1 表示插入到第一行',
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
      id: 'rowIndex',
      name: '行号',
      type: 'number',
      description: '添加的行号'
    },
    {
      id: 'rowCount',
      name: '总行数',
      type: 'number',
      description: '工作表总行数'
    }
  ]
}
