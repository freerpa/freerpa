import { RiTBoxLine } from '@remixicon/vue'
import { createDataHandlerNode } from '../../common'
/**
 * @file: 文本数据处理节点
 */
export default createDataHandlerNode({
  type: 'dataHandlerString',
  name: '文本处理',
  icon: RiTBoxLine,
  description: '对文本数据进行处理转换（取长度/替换/转大写/转小写/去空白/截取/分割/转数字/拼接/查找/包含/JSON 解析，详见节点配置下拉）'
})
