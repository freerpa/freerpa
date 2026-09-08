import { BaseWindow, WebContentsView, session, globalShortcut, shell } from 'electron'
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

  // 关闭拦截：用户主动关闭（红点/关闭按钮/Cmd+W）隐藏到托盘后台运行（仅生产模式）；
  // 开发模式直接放行（点关闭即退出，便于调试；Ctrl+C 由 before-quit 放行跟随）
  win.on('close', (event) => {
    if (is.dev) return
    event.preventDefault()
    win.hide()
  })

  // 阻挡 F11 全屏
  globalShortcut.register('F11', () => {})

  /**
   * 主渲染进程导航守卫：
   * 允许加载的地址仅为应用自身（生产 file:// 渲染产物 / 开发 electron-vite dev server origin）。
   * 其余一律视为外部地址：阻止导航（避免主界面被带到其他页面后无法返回），
   * 并改用系统默认浏览器弹出新窗口访问。
   */
  const isInternalUrl = (url) => {
    try {
      const u = new URL(url)
      if (u.protocol === 'file:' || u.protocol === 'devtools:') return true
      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        return u.origin === new URL(process.env['ELECTRON_RENDERER_URL']).origin
      }
      return false
    } catch {
      return false
    }
  }

  const guardNavigation = (event, url) => {
    if (isInternalUrl(url)) return
    event.preventDefault()
    shell.openExternal(url).catch(() => {})
  }
  view.webContents.on('will-navigate', guardNavigation)
  view.webContents.on('will-redirect', guardNavigation)

  // 加载内容
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    view.webContents.loadURL(process.env['ELECTRON_RENDERER_URL']).catch(() => {})
    globalShortcut.register('F1', () => view.webContents.openDevTools())
    globalShortcut.register('F2', () => view.webContents.reload())
  } else {
    view.webContents.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  view.webContents.on('dom-ready', () => {
    win.show()
    win.setMenuBarVisibility(false)
  })

  return { win, view }
}
