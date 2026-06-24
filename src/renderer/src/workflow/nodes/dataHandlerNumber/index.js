/**
 * @file: 数字类型数据处理节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { RiHashtag } from "@remixicon/vue";

export default {
  type: 'dataHandlerNumber',
  name: '数字处理',
  icon: RiHashtag,
  description: '对数字数据进行处理转换',
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
