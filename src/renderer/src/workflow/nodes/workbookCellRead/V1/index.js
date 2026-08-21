import { IconNav } from '@arco-design/web-vue/es/icon'
export default {
  type: 'workbookCellRead',
  name: '读数据',
  icon: IconNav,
  description: '读取工作表的数据',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'row',
          name: '读取行',
          description: '读取行',
          type: 'radio',
          default: 'all',
          options: [
            {
              label: '所有行',
              value: 'all'
            },
            {
              label: '指定行',
              value: 'specify'
            }
          ],
          quickConfig: true,
          required: true
        },
        {
          id: 'specifyRow',
          name: '指定行',
          description: '指定行',
          type: 'array',
          show: "${row} === 'specify'",
          default: '',
          fields: [
            {
              id: 'startRow',
              name: '起始',
              description: '起始行 1 表示第一行',
              type: 'number',
              default: 1,
              min: 1,
              quickConfig: true,
              required: true
            },
            {
              id: 'countRow',
              name: '行数',
              description: '读取行数',
              type: 'number',
              default: 1,
              min: 1,
              quickConfig: true,
              required: true
            }
          ],
          quickConfig: true,
          required: true
        },
        {
          id: 'column',
          name: '读取列',
          description: '读取列',
          type: 'radio',
          default: 'all',
          options: [
            {
              label: '所有列',
              value: 'all'
            },
            {
              label: '指定列',
              value: 'specify'
            }
          ],
          quickConfig: true,
          required: true
        },
        {
          id: 'specifyColumn',
          name: '指定列',
          description: '指定列',
          type: 'array',
          show: "${column} === 'specify'",
          default: '',
          fields: [
            {
              id: 'startColumn',
              name: '起始',
              description: '起始列 1 表示 A 列',
              type: 'number',
              default: 1,
              min: 1,
              quickConfig: true,
              required: true
            },
            {
              id: 'countColumn',
              name: '列数',
              description: '读取列数',
              type: 'number',
              default: 1,
              min: 1,
              quickConfig: true,
              required: true
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
    {
      id: 'data',
      name: '数据',
      type: 'array',
      description: '工作表单元格数据'
    }
  ]
}
