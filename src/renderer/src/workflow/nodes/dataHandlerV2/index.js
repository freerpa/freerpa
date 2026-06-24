/**
 * @file: 数据处理节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { RiCpuLine } from "@remixicon/vue";

export default {
  type: 'dataHandlerV2',
  name: '处理数据',
  icon: RiCpuLine,
  description: '对数据进行处理转换',
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
