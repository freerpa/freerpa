import { BaseWindow, WebContentsView, session, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import path from 'path'

/**
 * 创建主应用窗口
 */
export const createWindow = () => {
  const win = new BaseWindow({
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fff',
    show: false,
    trafficLightPosition: { x: 16, y: 12 }
  })

  if (process.platform === 'darwin') {
    win.setWindowButtonVisibility(true)
  }

  const devSession = session.fromPartition('persist:dev')

  const view = new WebContentsView({
    webPreferences: {
      session: is.dev ? devSession : '',
      devTools: is.dev,
      sandbox: false,
      preload: path.join(__dirname, '../preload/index.js'),
      webSecurity: false,
      webviewTag: true
    }
  })
view.webContents.openDevTools()
  win.contentView.addChildView(view)

  // 初始 bounds 填满窗口
  const fitView = () => {
    const bounds = win.getContentBounds()
    view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height })
  }
  fitView()
  win.on('resize', fitView)

  // 全屏事件通知渲染进程
  win.on('enter-full-screen', () => view.webContents.send('window-fullscreen-change', true))
  win.on('leave-full-screen', () => view.webContents.send('window-fullscreen-change', false))

  // 关闭拦截
  win.on('close', (event) => {
    event.preventDefault()
    if (!is.dev) {
      view.webContents.send('window-close')
    } else {
      ipcMain.emit('window-close')
    }
  })

  // 加载内容
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    view.webContents.loadURL(process.env['ELECTRON_RENDERER_URL']).catch(() => {})
  } else {
    view.webContents.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  view.webContents.on('dom-ready', () => {
    win.show()
    win.setMenuBarVisibility(false)
  })

  return { win, view }
}
