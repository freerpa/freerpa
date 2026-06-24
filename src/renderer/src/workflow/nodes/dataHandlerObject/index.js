/**
 * @file: 对象类型数据处理节点
 * @author: dabao
 * @date: 2026-05-25
 */
import { RiBracesLine } from "@remixicon/vue";

export default {
  type: 'dataHandlerObject',
  name: '对象处理',
  icon: RiBracesLine,
  description: '对对象数据进行处理转换',
  view: true,
  config: {},
  inputs: [
    {
      type: 'dynamic',
      dataPath: 'nodeIO.inputs',
      fieldMap: {
        id: 'id',
        name: 'name',
        description: 'description',
        type: 'type',
        required: 'required'
      }
    }
  ],
  outputs: [
    {
      type: 'dynamic',
      dataPath: 'nodeIO.outputs',
      fieldMap: {
        id: 'id',
        name: 'name',
        description: 'description',
        type: 'type',
        required: 'required'
      }
    }
  ]
}
