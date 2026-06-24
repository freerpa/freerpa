/**
 * @file: 触发器节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */
import { processParams } from '@/common'

const execute = async (node, context) => {
  const { config } = node
  const { next, onBeforeDestroy, complete, onNodeEvent, wait, runCode, sendNodeEvent } = context

  // 计算每天的执行时间
  const calculateDailyTime = (time) => {
    const [hour, minute, second] = time.split(':')
    const next = new Date()
    next.setHours(hour, minute, second, 0)
    if (next < new Date()) {
      next.setDate(next.getDate() + 1)
    }
    return next
  }

  // 计算每周的执行时间
  const calculateWeeklyTime = (weekDays, time) => {
    const [hour, minute] = time.split(':')
    const now = new Date()
    const currentDay = now.getDay()

    // 找到下一个执行日期
    let nextDay = weekDays.find((day) => day > currentDay)
    if (!nextDay) {
      nextDay = weekDays[0]
    }

    const next = new Date()
    next.setDate(next.getDate() + ((nextDay + 7 - currentDay) % 7))
    next.setHours(hour, minute, 0, 0)
    return next
  }

  // 计算每月的执行时间
  const calculateMonthlyTime = (monthDays, time) => {
    const [hour, minute] = time.split(':')
    const now = new Date()
    const currentDay = now.getDate()

    // 找到下一个执行日期
    let nextDay = monthDays.find((day) => day > currentDay)
    if (!nextDay) {
      nextDay = monthDays[0]
    }

    const next = new Date()
    if (nextDay <= currentDay) {
      next.setMonth(next.getMonth() + 1)
    }
    next.setDate(nextDay)
    next.setHours(hour, minute, 0, 0)
    return next
  }

  try {
    const { triggerType = 'manual', schedule = {}, loop = {}, params = [] } = config
    let isRunning = true
    // 清理函数
    onBeforeDestroy(() => {
      isRunning = false
    })
    // 定时触发
    if (triggerType === 'schedule') {
      const { type, time, weekDay, monthDay, maxTimes = 0 } = schedule
      let nextTime
      let count = 1

      // 计算下次执行时间
      const calculateNextTime = () => {
        switch (type) {
          case 'daily':
            return calculateDailyTime(time)
          case 'weekly':
            return calculateWeeklyTime(weekDay, time)
          case 'monthly':
            return calculateMonthlyTime(monthDay, time)
        }
      }

      // 执行定时任务
      const runSchedule = async () => {
        while (isRunning && (maxTimes === 0 || count <= maxTimes)) {
          nextTime = calculateNextTime()
          const delayms = nextTime.getTime() - Date.now()
          await wait(delayms)
          const _params = processParams(params, {}, runCode)
          // 检查是否达到最大次数
          if (maxTimes !== 0 && count >= maxTimes) {
            isRunning = false
            complete({ ..._params })
          } else {
            next({ ..._params })
            count++
          }
        }
      }

      // 开始定时任务
      runSchedule()

    }
    // 循环触发
    else if (triggerType === 'loop') {
      const { interval, maxTimes = 0 } = loop
      let count = 1

      const run = async () => {
        if (isRunning && (maxTimes === 0 || count < maxTimes)) {
          const _params = processParams(params, {}, runCode)
          next({ ..._params })
          count++
          await wait(interval)
          run()
        } else if (maxTimes !== 0 && count >= maxTimes) {
          complete({ ..._params })
        }
      }

      // 开始循环
      run()

    }
    // 直接触发
    else if (triggerType === 'direct') {
      // 合并默认参数和用户输入
      const _params = processParams(params, {}, runCode)
      complete({ ..._params })
    }
    // 手动触发
    else {
      sendNodeEvent({ type: 'ready' })
      // 等待用户点击触发按钮
      onNodeEvent((event) => {
        if (event.type === 'confirm') {
          console.log('params', params)
          // 合并默认参数和用户输入
          const _params = processParams(params, {}, runCode)
          // 完成节点
          complete({ ..._params })
        }
      })
    }
  } catch (error) {
    throw error
  }
}

export default execute
