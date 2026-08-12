/**
 * @file: 时间获取节点执行器
 */
import dayjs from 'dayjs'

const execute = async (node, context) => {
  const { config } = node
  const { complete } = context
  const { timeType = 'format', format = 'YYYY-MM-DD HH:mm:ss' } = config

  try {
    const time = timeType === 'timestamp' ? dayjs().unix() : dayjs().format(format)
    complete({ time })
  } catch (error) {
    console.error('execute error:', error)
    throw error
  }
}

export default execute