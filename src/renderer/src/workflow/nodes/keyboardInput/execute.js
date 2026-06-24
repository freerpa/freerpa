/**
 * @file: 键盘输入节点执行器
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
      text,
      delay = 100,
      mode = 'char',
      clearFirst = true,
      pressEnter = false,
      modifiers = [],
      specialKeys = []
    } = config

    // 等待函数
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    // 执行输入
    const type = async () => {
      try {
        // 等待元素出现
        await page.waitForSelector(selector)
        // 查找元素
        const element = await page.$(selector)
        if (!element) {
          throw new Error(`未找到元素: ${selector}`)
        }

        // 聚焦元素
        await element.focus()

        // 如果需要先清空
        if (clearFirst) {
          const ControlKey = process.platform !== 'darwin' ? 'Control' : 'MetaLeft'
          await page.keyboard.down(ControlKey) // 全选
          await page.keyboard.press('A') // 全选
          await page.keyboard.up(ControlKey) // 全选
          await page.keyboard.press('Backspace') // 删除
        }

        // 按下修饰键
        for (const modifier of modifiers) {
          await page.keyboard.down(modifier)
        }
        //转换为字符串
        const input = text.toString()
        // 按照模式执行输入
        if (mode === 'paste') {
          page.keyboard.sendCharacter(input)
        } else {
          // 逐字输入模式
          const chars = input.split('')
          for (let i = 0; i < chars.length; i++) {
            const char = chars[i]
            await page.keyboard.type(char)
            await wait(delay)
          }
        }

        // 按下特殊按键
        for (const key of specialKeys) {
          console.log('按下特殊按键', key, specialKeys)
          await page.keyboard.press(key)
          await wait(delay)
        }

        // 如果需要按回车
        if (pressEnter) {
          await page.keyboard.press('Enter')
        }

        // 释放修饰键
        for (const modifier of modifiers) {
          await page.keyboard.up(modifier)
        }

        // 发送结果
        complete()
      } catch (error) {
        throw error
      }
    }

    // 执行输入
    await type()
  } catch (error) {
    throw error
  }
}

export default execute
