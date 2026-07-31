/**
 * @file: 数组类型数据处理节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { RiBracketsLine } from "@remixicon/vue";

export default {
  type: 'dataHandlerArray',
  name: '数组处理',
  icon: RiBracketsLine,
  description: '对数组数据进行处理转换',
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
