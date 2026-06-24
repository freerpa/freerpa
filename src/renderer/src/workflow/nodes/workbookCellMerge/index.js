import { RiMergeCellsVertical } from '@remixicon/vue'
export default {
  type: 'workbookCellMerge',
  name: '合并单元格',
  icon: RiMergeCellsVertical,
  description: '合并工作表中的单元格',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        startCell: {
          id: 'startCell',
          name: '起始单元格',
          paramRef: false,
          description: '起始单元格',
          type: 'object',
          default: '',
          fields: [
            {
              id: 'rowIndex',
              name: '行号',
              description: '单元格行号 1 表示第一行',
              type: 'number',
              default: 1,
              min: 1,
              quickConfig: true,
              required: false
            },
            {
              id: 'columnIndex',
              name: '列号',
              description: '单元格列号 1 表示 A 列',
              type: 'number',
              default: 1,
              min: 1,
              quickConfig: true,
              required: false
            }
          ],
          quickConfig: true,
          required: false
        },
        endCell: {
          id: 'endCell',
          name: '结束单元格',
          paramRef: false,
          description: '结束单元格',
          type: 'object',
          default: '',
          fields: [
            {
              id: 'rowIndex',
              name: '行号',
              description: '单元格行号 1 表示第一行',
              type: 'number',
              default: 1,
              min: 1,
              quickConfig: true,
              required: false
            },
            {
              id: 'columnIndex',
              name: '列号',
              description: '单元格列号 1 表示 A 列',
              type: 'number',
              default: 1,
              min: 1,
              quickConfig: true,
              required: false
            }
          ],
          quickConfig: true,
          required: false
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
      id: 'rowIndex',
      name: '行号',
      type: 'number',
      description: '合并后的单元格行号'
    },
    {
      id: 'columnIndex',
      name: '列号',
      type: 'number',
      description: '合并后的单元格列号'
    }
  ]
}
