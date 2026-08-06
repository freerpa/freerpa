import { IO_FIELD_MAP_STANDARD } from '../../../io-conventions.js'
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
