/**
 * @file: 检查器IPC通信处理
 * @author: dabao
 * @date: 2024-03-16
 */
import { ipcMain } from 'electron'
import {
  createWebView,
  updateWebView,
  destroyWebView,
  goBack,
  goForward,
  refresh,
  debug,
  clear
} from './index'

export const register = () => {
  // WebContentsView 相关
  ipcMain.handle('inspector:createWebView', async (event, params) => {
    return await createWebView(params)
  })

  ipcMain.handle('inspector:updateWebView', async (event, params) => {
    return await updateWebView(params)
  })

  ipcMain.handle('inspector:destroyWebView', async (event) => {
    return await destroyWebView()
  })

  ipcMain.handle('inspector:goBack', async (event) => {
    return await goBack()
  })

  ipcMain.handle('inspector:goForward', async (event) => {
    return await goForward()
  })

  ipcMain.handle('inspector:refresh', async (event) => {
    return await refresh()
  })

  ipcMain.handle('inspector:debug', async (event) => {
    return await debug()
  })

  ipcMain.handle('inspector:clear', async (event) => {
    return await clear()
  })
}
