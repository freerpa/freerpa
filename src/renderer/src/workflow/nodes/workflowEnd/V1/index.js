/**
 * @file: 结束工作流节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { IconRecordStop } from '@arco-design/web-vue/es/icon'
import { dynamicFields } from '../../common'
export default {
  // 节点名称
  name: '结束流程',
  // 节点类型
  type: 'workflowEnd',
  // 节点图标
  icon: IconRecordStop,
  // 节点描述
  description: '结束当前流程并可返回指定的输出项',
  // 节点视图
  view: true,
  // 允许前置节点连接点
  prev: true,
  // 允许后续节点连接点
  next: false,
  // 配置项
  config: {
    basic: {
      name: '输出项',
      fields: {
        params: {
          id: 'params',
          name: '输出项',
          nolabel: true,
          type: 'array',
          description: '设置结束时的输出',
          fields: dynamicFields
        }
      }
    }
  },
  inputs: [
    {
      type: 'dynamic',
      dataPath: 'params',
      fieldMap: {
        id: 'name',
        name: 'name',
        type: 'type',
        description: 'description',
        required: 'required'
      }
    }
  ],
  outputs: []
}
