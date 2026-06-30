/**
 * @file: 浏览器模块统一入口
 * @author: FreeRPA
 */

// Kernel
export { checkKernelExists, downloadKernel, launchKernel, fetchKernelList, getRecommendedKernel, getPlatform, KERNEL_DIR } from './kernel'

// Viewer
export { createEnvView } from './viewer'

// Manager
export { registerBrowser, killBrowserProcess, isBrowserOpen, getAllBrowserStatus, closeAllBrowsers } from './manager'

// IPC
export { register } from './ipc'

// Utils
export { getIpInfo } from './utils/ip'
export { extractIpFromProxy, validateProxy, uuidTo10Decimal, getLanguageByCountryCode } from './utils/proxy'
