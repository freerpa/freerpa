import { RiBracesLine } from '@remixicon/vue'
import { createDataHandlerNode } from '../../common'
/**
 * @file: 对象类型数据处理节点
 */
export default createDataHandlerNode({
  type: 'dataHandlerObject',
  name: '对象处理',
  icon: RiBracesLine,
  description: '对对象数据进行处理转换（取长度/取值/设值/取键/取值列表/判断存在/删除/清空/转字符串，详见节点配置下拉）'
})
