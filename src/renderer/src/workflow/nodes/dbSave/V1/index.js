/**
 * @file: 数据保存节点
 */
import { IconSave } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dbSave',
  name: '数据保存',
  icon: IconSave,
  description: '数据保存节点：将输入的对象或对象数组批量插入到指定数据表（每 1000 条一批），输出数据标识（供删除/修改使用）与本次保存条数。',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'modelId',
          name: '数据表',
          type: 'select',
          props: {
            allowClear: true
          },
          options: [], // 动态获取数据表列表
          required: true,
          description: '选择要保存到的数据表',
          quickConfig: true,
          remote: true,
          remoteMethod: async (keyword = '') => {
            // 获取数据表列表
            const result = await window.electronAPI.data.getModels({
              page: 1,
              pageSize: 1000,
              keyword
            })

            return result.data.map((model) => ({
              label: model.name,
              value: model.id
            }))
          }
        }
      ]
    }
  ],
  inputs: [
    {
      id: 'data',
      name: '数据',
      type: ['array', 'object'],
      required: true,
      description: '要保存到数据表的数据（单个对象或对象数组，对象的键对应数据表字段）'
    }
  ],
  outputs: [
    {
      id: 'query',
      name: '数据标识',
      type: 'dataQuery',
      description: '本次保存数据的数据标识（数据表 + 行 ID），可传给“数据删除/修改”节点'
    },
    {
      id: 'savedCount',
      name: '保存条数',
      type: 'number',
      description: '本次保存成功的数据条数'
    }
  ]
}
