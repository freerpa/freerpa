/**
 * @file: 时间获取节点执行器
 */
import dayjs from 'dayjs'

const execute = async (node, context) => {
  const { config, inputs } = node
  const { complete } = context
  const { time } = inputs

  const { handleType = 'toTimestamp', format = 'YYYY-MM-DD HH:mm:ss', timeZone = 'Asia/Shanghai', amount = 1, unit = 'hour' } = config

  try {
    let result = time

    if (handleType === 'toTimestamp') {
      result = dayjs(time).unix()
    }else if (handleType === 'subtractTime') {
      if (amount > 0) {
        result = dayjs(time).add(amount, unit).format(format)
      } else {
        result = dayjs(time).subtract(-amount, unit).format(format)
      }
    }else if (handleType === 'format') {
      //判断是否是时间戳格式
      if (typeof time === 'number') {
        result = dayjs.unix(time).format(format)
      } else {
        result = dayjs(time).format(format)
      }
    }
    complete({ time: result })
  } catch (error) {
    console.error('execute error:', error)
    throw error
  }
}

export default execute