/**
 * @file: 鼠标操作节点执行器
 * @author: dabao
 * @date: 2024-03-15
 */

const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context

  try {
    const page = inputs.page
    const {
      selector,
      action,
      clickAll = false,
      delay = 0,
      wheelDeltaX = 0,
      wheelDeltaY = 0,
      interval = 100,
      dragConfig = {}
    } = config

    // 延迟等待
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    // 计算元素绝对位置中心点（与 wheel 分支一致；此前只返回宽高一半，导致 drag 落点错误）
    const calculateClickPosition = async (element) => {
      const box = await element.boundingBox()
      if (!box) return null
      const x = Number(box.x) + Number(box.width) / 2
      const y = Number(box.y) + Number(box.height) / 2
      return { x: Math.round(x), y: Math.round(y) }
    }

    try {
      const name = selector.name

      if (clickAll && ['click', 'dblclick', 'rightClick'].includes(action)) {
        const elements = await page.find(selector, { all: true })
        if (!elements.length) throw new Error(`未找到元素: ${name}`)

        // 依次操作每个元素
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i]

          // 检查元素是否可见和可点击
          const isVisible = await element.isVisible()
          if (!isVisible) continue

          // 执行点击
          switch (action) {
            case 'click':
              await element.click()
              break
            case 'dblclick':
              await element.click({ clickCount: 2 })
              break
            case 'rightClick':
              await element.click({ button: 'right' })
              break
          }

          // 操作间隔 (除了最后一个元素)
          if (interval > 0 && i < elements.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, interval))
          }
        }
      } else {
        const element = await page.find(selector)
        if (!element) throw new Error(`未找到元素: ${name}`)
        switch (action) {
          case 'click':
            await element.click()
            break
          case 'dblclick':
            await element.click({ clickCount: 2 })
            break
          case 'rightClick':
            await element.click({ button: 'right' })
            break
          case 'hover':
            try {
              await element.hover()
            } catch (error) {
              console.error('悬停操作失败:', error)
              throw error
            }
            break
          case 'drag':
            const target = await page.find(dragConfig.target)
            if (!target) throw new Error(`未找到拖拽目标元素`)

            const pos = await calculateClickPosition(element)
            if (!pos) throw new Error('无法获取起始元素位置')

            const endPos = await calculateClickPosition(target)
            if (!endPos) throw new Error('无法获取目标元素位置')

            try {
              // 移动到起始位置
              await page.mouse.move(pos.x, pos.y)
              await new Promise((resolve) => setTimeout(resolve, 100))

              // 按下鼠标
              await page.mouse.down()
              await new Promise((resolve) => setTimeout(resolve, 100))

              // 处理自定义路径
              if (dragConfig.pathMode === 'custom' && Array.isArray(dragConfig.pathPoints)) {
                for (const point of dragConfig.pathPoints) {
                  const x = pos.x + (point.x || 0)
                  const y = pos.y + (point.y || 0)
                  await page.mouse.move(x, y, { steps: 5 })
                  if (point.delay > 0) {
                    await new Promise((resolve) => setTimeout(resolve, point.delay))
                  }
                }
              }

              // 移动到终点
              await page.mouse.move(endPos.x, endPos.y, { steps: 5 })
              await new Promise((resolve) => setTimeout(resolve, 100))

              // 释放鼠标
              await page.mouse.up()
              await new Promise((resolve) => setTimeout(resolve, 100))
            } catch (error) {
              console.error('拖拽操作失败:', error)
              throw error
            } finally {
              // 确保鼠标释放
              try {
                await page.mouse.up()
              } catch (e) {
                // 忽略鼠标释放错误
              }
            }
            break
          case 'wheel':
            const boundingBox = await element.boundingBox();
            await page.mouse.move(
              boundingBox.x + boundingBox.width / 2,
              boundingBox.y + boundingBox.height / 2,
            );
            await page.mouse.wheel({ deltaX: wheelDeltaX, deltaY: wheelDeltaY })
            break
        }
      }

      // 完成节点
      complete()
    } catch (error) {
      throw error
    }
  } catch (error) {
    throw error
  }
}

export default execute
