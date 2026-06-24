// 执行页面代码
export const page_eval = async (page, code, ...args) => {
  return await page.evaluate(eval(code), ...args)
}