import { RiBracketsLine } from '@remixicon/vue'
import { createDataHandlerNode } from '../../common'
/**
 * @file: 数组类型数据处理节点
 */
export default createDataHandlerNode({
  type: 'dataHandlerArray',
  name: '数组处理',
  icon: RiBracketsLine,
  description: '对数组数据进行处理转换（取长度/取值/添加/删除/扁平化/拼接/分组/排序/反转/去重/截取/转字符串，详见节点配置下拉）'
})
