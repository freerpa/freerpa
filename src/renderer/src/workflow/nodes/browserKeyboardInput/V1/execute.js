/**
 * @file: 键盘输入节点执行器
 */
import { page_eval } from '@pageEval'
const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete } = context

  
  const page = inputs.page
  const {
    keyboardMode,
    keySelector,
    inputSelector,
    text,
    delay = 100,
    mode = 'char',
    inputConfig = ['clearFirst'],
    modifiers = [],
    keys = []
  } = config

  // 等待函数
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  // 执行输入
  const type = async () => {
    
    if (keyboardMode === 'input') {
      // 查找元素
      const element = await page.find(inputSelector)
      if (!element) throw new Error(`未找到元素: ${inputSelector?.name || '未知'}`)
      // 聚焦元素
      // await element.focus()
      //移动光标到最后
      // await page.keyboard.down('Control') // 全选
      // await page.keyboard.press('End') // 全选
      // await page.keyboard.up('Control') // 全选

      // 如果需要先清空
      if (inputConfig.includes('clearFirst')) {
        if (process.platform !== 'darwin') {
          await page.keyboard.down('Control') // 全选
          await page.keyboard.press('A') // 全选
          await page.keyboard.up('Control') // 全选
        } else {
          await page_eval(page, '() => document.execCommand("selectAll")')
        }
        await page.keyboard.press('Backspace') // 删除
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

      // 如果需要按回车
      if (inputConfig.includes('pressEnter')) {
        await wait(100)
        await page.keyboard.press('Enter')
      }
    } else {
      if (keySelector) {
        const element = await page.find(keySelector)
        if (!element) throw new Error(`未找到元素: ${keySelector?.name || '未知'}`)
        await element.focus()
      }
      // 按下修饰键
      for (const modifier of modifiers) {
        await page.keyboard.down(modifier)
      }
      // 按下按键
      for (const key of keys) {
        await page.keyboard.press(key)
        await wait(delay)
      }
      // 释放修饰键
      for (const modifier of modifiers) {
        await page.keyboard.up(modifier)
      }
    }
    // 发送结果
    complete()

  }

  // 执行输入
  await type()

}

export default execute
