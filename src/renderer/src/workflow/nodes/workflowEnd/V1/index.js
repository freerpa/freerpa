import { IO_FIELD_MAP_NAME_ID } from '../../../io-conventions.js'
/**
 * @file: 结束工作流节点
 */
import { IconRecordStop } from '@arco-design/web-vue/es/icon'
import { createDynamicFields } from '../../common'
export default {
  // 节点名称
  name: '结束流程',
  // 节点类型
  type: 'workflowEnd',
  // 节点图标
  icon: IconRecordStop,
  // 节点描述
  description: '流程结束节点：终止当前工作流，并把配置的“输出项”作为整个流程的运行结果返回。若处于子流程中，则结束子流程并把输出返回给调用方。',
  // 节点视图
  view: true,
  // 允许前置节点连接点
  prev: true,
  // 允许后续节点连接点
  next: false,
  // 配置项
  config: [
    {
      id: 'basic',
      name: '输出项',
      fields: [
        {
          id: 'params',
          name: '输出项',
          type: 'array',
          description: '流程结束时对外返回的输出项列表（参数名 + 数据类型 + 取值），作为整个工作流或子流程的运行结果暴露给调用方。',
          fields: createDynamicFields()
        }
      ]
    }
  ],
  inputs: [
    {
      type: 'dynamic',
      dataPath: 'params',
      fieldMap: IO_FIELD_MAP_NAME_ID
    }
  ],
  outputs: []
}
