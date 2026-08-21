import { RiSplitCellsVertical } from '@remixicon/vue'
export default {
  type: 'workbookCellMergeUn',
  name: '取消单元格合并',
  icon: RiSplitCellsVertical,
  description: '取消合并工作表中的单元格',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
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
  outputs: []
}
