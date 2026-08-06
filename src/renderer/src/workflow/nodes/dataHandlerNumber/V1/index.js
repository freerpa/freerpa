import { IO_FIELD_MAP_STANDARD } from '../../../io-conventions.js'
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
      dataPath: '__nodeIO.inputs',
      legacyDataPath: 'nodeIO.inputs',
      fieldMap: IO_FIELD_MAP_STANDARD
    }
  ],
  outputs: [
    {
      type: 'dynamic',
      dataPath: '__nodeIO.outputs',
      legacyDataPath: 'nodeIO.outputs',
      fieldMap: IO_FIELD_MAP_STANDARD
    }
  ]
}
