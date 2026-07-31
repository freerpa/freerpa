/**
 * @file: 文本数据处理节点
 * @author: dabao
 * @date: 2024-03-29
 */
import { RiTBoxLine } from "@remixicon/vue";

export default {
  type: 'dataHandlerString',
  name: '文本处理',
  icon: RiTBoxLine,
  description: '对文本数据进行处理转换',
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
