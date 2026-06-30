import { WebContentsView, session } from 'electron'
import { v4 as uuidv4 } from 'uuid'

let bvmView = null

export const createBvm = async () => {
  const win = global.mainWindow

  // 销毁旧实例
  if (bvmView) {
    win.contentView.removeChildView(bvmView)
    bvmView.webContents.close()
    bvmView = null
  }

  const customSession = session.fromPartition('persist:env_browser-vm')

  const view = new WebContentsView({
    webPreferences: {
      session: customSession,
      webSecurity: false,
      offscreen: true,
      backgroundThrottling: false,
      devTools: false
    }
  })

  view.webContents.setFrameRate(1)
  view.webContents.setAudioMuted(true)
  view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  win.contentView.addChildView(view)
  view.setBounds({ x: -1919, y: -1079, width: 1280, height: 720 })

  // 阻止导航 & 新窗口 & 下载
  view.webContents.on('will-navigate', (e) => e.preventDefault())
  view.webContents.on('new-window', (e) => e.preventDefault())
  customSession.on('will-download', (e) => e.preventDefault())

  bvmView = view

  const id = uuidv4()

  // 页面加载失败时通过 Puppeteer 恢复连接
  view.webContents.once('did-fail-load', async () => {
    try {
      if (global.browser && !global.browser.connected) {
        await global.pptrConnect()
      }
      const pages = await global.browser.pages()
      const target = pages.find((p) => p.target().url().includes(id))
      if (target) {
        global.bvm = target
        await target.goto(`http://localhost:${global.httpServer.port}`)
      }
    } catch (err) {
      console.error('browserVm did-fail-load recovery failed:', err.message)
    }
  })

  await view.webContents.loadURL(`chrome://${id}`)
}

global.createBvm = createBvm
