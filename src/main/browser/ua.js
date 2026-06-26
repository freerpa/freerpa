/**
 * @file: UserAgent 处理
 * @author: FreeRPA
 */

/**
 * 设置 UserAgent（通过 Puppeteer API）
 */
export const setUserAgentOnPage = async (page, env) => {
  let userAgent = env.browser_ua?.trim()
  if (!userAgent) {
    if (env.browser_type === 'mobile') {
      userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    } else {
      return
    }
  }
  await page.setUserAgent(userAgent)
}

/**
 * 设置 UserAgent（导出给外部使用）
 */
export const setUserAgent = (view, env) => {
  if (view?.puppeteerPage && env) {
    setUserAgentOnPage(view.puppeteerPage, env)
    return true
  }
  return false
}
