/**
 * @file: 页面事件监听节点执行器（对应 puppeteer PageEvent）
 */

// 构造页面的 DevTools CDP 调试链接（wsEndpoint + 页面对应 target id）
const buildPageCdp = (page, popupPage) => {
  try {
    const wsEndpoint = page.browser?.()?.wsEndpoint?.()
    const targetId = popupPage?.target?.()?._targetId
    if (wsEndpoint && targetId) return `${wsEndpoint}/devtools/page/${targetId}`
  } catch {
    /* 忽略取不到 target 的情况 */
  }
  return null
}

// 按事件产出常用且简单的输出字段（与 node 定义中 show 过滤后的 outputs 对齐）
const buildOutput = async (event, payload, page, cfg) => {
  switch (event) {
    case 'popup': {
      const url = payload?.url?.() ?? null
      const cdp = buildPageCdp(page, payload)
      if (cfg.closeTab) {
        // 关闭新标签页（无头模式无窗口，关闭失败忽略）
        payload?.close?.().catch?.(() => {})
      }
      return {
        newPageUrl: url,
        newPageCdp: cdp
      }
    }
    case 'framenavigated':
      if (cfg.waitUntil) {
        // 等本次导航加载到选定状态再输出地址（超时忽略，仍输出）
        await page.waitForNavigation({ waitUntil: cfg.waitUntil, timeout: 15000 }).catch(() => {})
      }
      return { url: payload?.url?.() ?? null }
    case 'console':
      return { consoleMessage: payload?.text?.() ?? null }
    case 'dialog':
      return { dialogMessage: payload?.message?.() ?? null }
    case 'pageerror':
      return { errorMessage: payload?.message ?? String(payload) }
    default:
      // 无载荷事件：无输出
      return {}
  }
}

const execute = async (node, context) => {
  const { inputs, config } = node
  const { next, complete, onBeforeDestroy } = context
  const { event = 'console', isContinuous = true, closeTab = false, waitUntil = 'load' } = config
  const page = inputs.page
  const evt = String(event).toLowerCase()

  const listener = async (payload) => {
    const output = await buildOutput(evt, payload, page, { closeTab, waitUntil })
    if (isContinuous) {
      next(output)
    } else {
      complete(output)
      page.off(evt, listener)
    }
  }

  if (isContinuous) {
    // 持续监听
    page.on(evt, listener)
  } else {
    // 仅监听一次
    page.once(evt, listener)
  }

  // 节点销毁前移除监听，避免事件泄漏
  onBeforeDestroy(() => {
    page.off(evt, listener)
  })
}

export default execute