import { ipcMain } from 'electron'
import { windowManager } from "node-window-manager";
// 注册工作流相关的 IPC 处理
export const register = () => {

  // 验证数据
  ipcMain.handle('system:getWindows', async (event, keyWord = '') => {
    const windows = await windowManager.getWindows()
    const options = new Set()
    for (const window of windows) {
      const title = await window.getTitle()
      const isVisible = await window.isVisible()
      const isWindow = await window.isWindow()
      if (title && isVisible && isWindow && title.toLowerCase().includes(keyWord.toLowerCase())) {
        options.add({
          label: title,
          value: window.id
        })
      }
    }
    return options
  })

  ipcMain.handle('system:screenshot', async (event) => {
    console.log('system:screenshot')
  })
}
