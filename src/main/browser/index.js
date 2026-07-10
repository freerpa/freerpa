/**
 * @file: 浏览器模块统一入口
 * @author: FreeRPA
 */

// Kernel
export { checkKernelExists, downloadKernel, launchKernel, fetchKernelList, getPlatform } from './kernel'

// Viewer
export { openBrowser } from './viewer'

// Manager
export { registerBrowser, killBrowserProcess, isBrowserOpen, getBrowserInstance, incrementRef, decrementRef, getAllBrowserStatus, closeAllBrowsers } from './manager'

// IPC
export { register } from './ipc'

// Utils
export { queryGeoInfo } from './utils/proxy'

// Selector
export { find, mountFinder, matchTemplate } from './selector/index.js'

// Puppeteer proxy
export { default as puppeteer } from './puppeteer.js'
