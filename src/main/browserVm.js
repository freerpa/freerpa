import { WebContentsView, session } from 'electron'
import { v4 as uuidv4 } from 'uuid'
let bvmView = null
export const createBvm = async () => {
  const win = global.mainWindow
  return new Promise((resolve, reject) => {
    if (bvmView) {
      win.contentView.removeChildView(bvmView)
      bvmView.webContents.close()
    }
    // 创建 session
    const customSession = session.fromPartition('persist:env_browser-vm')
    // 创建 WebContentsView
    const view = new WebContentsView({
      webPreferences: {
        devTools: false,
        session: customSession,
        webSecurity: false,
        offscreen: true,
        //保持窗口大小
        backgroundThrottling: false
      }
    })
    view.webContents.setFrameRate(1)
    bvmView = view
    // const window = new BrowserWindow({
    //   width: 1280,
    //   height: 720,
    //   webPreferences: {
    //     webSecurity: false,
    //     backgroundThrottling: false
    //   }
    // })
    win.contentView.addChildView(view)
    view.setBounds({
      x: -1919,
      y: -1079,
      width: 1280,
      height: 720
    })
    // view.webContents.openDevTools({ mode: 'undocked' })
    // console.log('openDevTools');
    // 设置静音
    view.webContents.setAudioMuted(true)
    // 设置window.open
    view.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' }
    })
    // 创建一个唯一的ID
    const id = uuidv4()
    view.webContents.once('did-fail-load', async () => {
      // 如果浏览器丢失连接，则重新连接
      if (!global.browser.connected) {
        await global.pptrConnect()
      }
      // 获取所有页面
      const pages = await global.browser.pages()
      // 遍历所有页面，找到包含ID的页面
      pages.forEach((page) => {
        if (page.target().url().includes(id)) {
          global.bvm = page
          page.goto(`http://localhost:${global.httpServer.port}`)
          resolve()
        }
      })
    })
    // 加载URL
    view.webContents.loadURL(`chrome://${id}`).catch(() => { })
    // 阻止导航
    view.webContents.on('will-navigate', (event) => {
      event.preventDefault()
    })

    // 阻止新窗口打开
    view.webContents.on('new-window', (event) => {
      event.preventDefault()
    })

    //阻止下载
    customSession.on('will-download', (event) => {
      event.preventDefault()
    })
  })
}

global.createBvm = createBvm
