/**
 * @file: 系统托盘（后台运行入口）
 *
 * 图标：build/tray.png（550×550 源图，运行时 resize 到 16×16）。
 * 路径：dev 用项目根 build/（__dirname=out/main 上溯 2 级）；
 *       打包后 build/ 是 buildResources 被排除出 asar，改经 extraResources 分发到
 *       process.resourcesPath/tray.png。
 * 左键：恢复主窗口；右键：弹出菜单（打开主界面 / 退出软件）。
 */
import { Tray, Menu, nativeImage, app } from 'electron'
import path from 'path'

let tray = null

/** 托盘图标路径（dev 源码 / 打包分发两态） */
const getTrayIconPath = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'tray.png')
    : path.join(__dirname, '../../build/tray.png')

/** 恢复并聚焦主窗口（隐藏/最小化状态下均有效） */
const showMainWindow = () => {
  if (!global.mainWindow) return
  if (global.mainWindow.isMinimized()) global.mainWindow.restore()
  global.mainWindow.show()
  global.mainWindow.focus()
}

/** 退出软件：打开主界面并让渲染端弹确认框（与关闭确认逻辑一致），确认后走 window.electronAPI.window.close() */
const requestExit = () => {
  showMainWindow()
  global.mainView?.webContents.send('request-exit')
}

/** 创建系统托盘：左键显示主窗口，右键弹出菜单（打开主界面 / 退出软件） */
export const createTray = () => {
  if (tray) return tray
  const icon = nativeImage.createFromPath(getTrayIconPath())
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('FreeRPA')
  const menu = Menu.buildFromTemplate([
    { label: '打开主界面', click: showMainWindow },
    { type: 'separator' },
    { label: '退出软件', click: requestExit }
  ])
  // 不调用 setContextMenu：否则 macOS/Windows 左键点击也会弹菜单，与"左键显示主窗口"冲突
  tray.on('click', showMainWindow) // 左键：显示主窗口
  tray.on('right-click', () => tray.popUpContextMenu(menu)) // 右键：仅弹菜单，不显示主窗口
  return tray
}

/** 销毁托盘（应用退出时） */
export const destroyTray = () => {
  tray?.destroy()
  tray = null
}
