import { IO_FIELD_MAP_STANDARD } from '../../../io-conventions.js'
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
