/**
 * @file: 触发器节点执行器
 */
import { Cron } from 'croner'
import { processParams } from '@/common'

const buildCronExpression = (config) => {
  let { schedule = 'day', interval = 1, week = [1], day = [1], hour = [0], minute = [0], second = [0] } = config
  let cronSecond = second.join(',')
  let cronMinute = minute.join(',')
  let cronHour = hour.join(',')
  let cronDay = '*'
  let cronMonth = '*'
  let cronWeek = '*'

  switch (schedule) {
    case 'second':
      cronSecond = `*/${interval}`
      cronMinute = '*'
      cronHour = '*'
      cronDay = '*'
      break
    case 'minute':
      cronMinute = `*/${interval}`
      cronHour = '*'
      cronDay = '*'
      break
    case 'hour':
      cronHour = `*/${interval}`
      cronDay = '*'
      break
    case 'day':
      cronDay = `*/${interval}`
      break
    case 'weekly':
      cronWeek = week.join(',') || '*'
      cronDay = '?'
      break
    case 'monthly':
      cronDay = day.join(',') || '*'
      break
  }

  return `${cronSecond} ${cronMinute} ${cronHour} ${cronDay} ${cronMonth} ${cronWeek}`
}

const execute = async (node, context) => {
  const { config } = node
  const { next, onBeforeDestroy, complete, onNodeEvent } = context

  try {
    const { enableSchedule = false, maxTimes = 0, params = [] } = config
    let isRunning = true
    let cronInstance = null
    let count = 0

    onBeforeDestroy(() => {
      isRunning = false
      if (cronInstance) {
        cronInstance.stop()
      }
    })

    const doTrigger = async () => {
      const _params = processParams(params, {}, context.runCode)
      count++
      if (maxTimes !== 0 && count >= maxTimes) {
        if (cronInstance) {
          cronInstance.stop()
        }
        complete({ ..._params })
      } else {
        next({ ..._params })
      }
    }

    if (enableSchedule) {
      const cronExpr = buildCronExpression(config)
      console.error('Cron expression:', config, cronExpr)

      cronInstance = new Cron(cronExpr, {
        timezone: 'Asia/Shanghai'
      })

      cronInstance.schedule(async () => {
        if (!isRunning) return
        await doTrigger()
      })
    }

    onNodeEvent((event) => {
      if (event.type === 'confirm') {
        doTrigger()
      }
    })
  } catch (error) {
    console.error('Trigger execute error:', error)
    throw error
  }
}

export default execute