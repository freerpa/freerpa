/**
 * @file: 数据保存节点
 */
import { IconSave } from '@arco-design/web-vue/es/icon'

export default {
  type: 'dbSave',
  name: '数据保存',
  icon: IconSave,
  description: '保存数据到数据表',
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
      description: '要保存的数据对象'
    }
  ],
  outputs: [
    {
      id: 'query',
      name: '数据标识',
      type: 'dataQuery',
      description: '用于删除和修改数据'
    },
    {
      id: 'savedCount',
      name: '保存条数',
      type: 'number',
      description: '本次保存成功的数据条数'
    }
  ]
}
