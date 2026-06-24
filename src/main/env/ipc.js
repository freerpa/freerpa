/**
 * @file: 环境管理IPC通信处理
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
  getEnvironmentFromView,
  debug,
  clear
} from './index'

export const register = () => {
  // WebContentsView 相关
  ipcMain.handle('env:createWebView', async (event, params) => {
    return await createWebView(params)
  })

  ipcMain.handle('env:updateWebView', async (event, params) => {
    return await updateWebView(params)
  })

  ipcMain.handle('env:destroyWebView', async (event) => {
    return await destroyWebView()
  })

  ipcMain.handle('env:goBack', async (event) => {
    return await goBack()
  })

  ipcMain.handle('env:goForward', async (event) => {
    return await goForward()
  })

  ipcMain.handle('env:refresh', async (event) => {
    return await refresh()
  })

  ipcMain.handle('env:getEnvironmentFromView', async (event) => {
    return await getEnvironmentFromView()
  })

  ipcMain.handle('env:debug', async (event) => {
    return await debug()
  })

  ipcMain.handle('env:clear', async (event) => {
    return await clear()
  })
}
