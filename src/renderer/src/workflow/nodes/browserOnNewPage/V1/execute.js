/**
 * @file: 浏览器元素编辑节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */
const execute = async (node, context) => {
  const { inputs, config } = node
  const { complete, next, onBeforeDestroy } = context
  const { closePage, isContinuous } = config
  try {
    const page = inputs.page
    let newPage = null
    const browser = page.browser()
    const handler = async (target) => {
      // 步骤1：仅处理「页面类型」的新目标（排除service_worker、iframe等非页面）
      if (target.type() !== 'page') return;
      // 步骤2：获取打开新页面的「源页面（父页面）」，非空判断（手动打开的新页面opener为null）
      const openerPage = await target.opener().page();
      if (!openerPage || !page || openerPage !== page) return;
      newPage = await target.page();
      const targetUrl = target.url();
      if (closePage) {
        await newPage.close()
        newPage = null
      }
      if (isContinuous) {
        next({
          url: targetUrl
        })
      } else {
        complete({
          url: targetUrl
        })
      }
    }

    let listener = null
    if (isContinuous) {
      // 监听新页面打开事件
      listener = browser.on('targetcreated', handler)
    } else {
      listener = browser.once('targetcreated', handler)
    }
    // 节点销毁前，移除事件监听
    onBeforeDestroy(() => {
      if (newPage) {
        newPage.close()
        newPage = null
      }
      listener?.off()
    })
  } catch (error) {
    throw error
  }
}

export default execute
