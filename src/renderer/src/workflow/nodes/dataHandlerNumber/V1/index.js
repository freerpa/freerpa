import { RiHashtag } from '@remixicon/vue'
import { createDataHandlerNode } from '../../common'
/**
 * @file: 数字类型数据处理节点
 */
export default createDataHandlerNode({
  type: 'dataHandlerNumber',
  name: '数字处理',
  icon: RiHashtag,
  description: '对数字数据进行处理转换（计算/四舍五入/向下取整/向上取整/绝对值/幂/平方根/随机/均值/最大/最小，详见节点配置下拉）'
})
