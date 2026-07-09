/**
 * @file: Puppeteer 代理模块
 *
 * 统一从 browser/puppeteer.js 导入 puppeteer，避免直接引用 'puppeteer-core'
 * 自动将 finder 挂载到 Page.prototype
 */

import puppeteer from 'puppeteer-core'
import { mountFinder } from './selector/index.js'

// 挂载 finder 到 Page.prototype
mountFinder(puppeteer)

export default puppeteer

// 转发所有命名导出
export * from 'puppeteer-core'
