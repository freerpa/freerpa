import { app, ipcMain, BaseWindow, WebContentsView, shell, globalShortcut, session } from 'electron'
import puppeteer from 'puppeteer-core'
import path from 'path'
import fs from 'fs'
import { register as workflowRegisterIPC } from './workflow/ipc'
import { register as dataRegisterIPC } from './data/ipc'
import { register as envRegisterIPC } from './browser/ipc'
import { register as storeRegisterIPC } from './store/ipc'
import { register as apiRegisterIPC } from './api/ipc'
import { register as registerIPC } from './ipc'
import { register as inspectorRegisterIPC } from './inspector/ipc'
import { register as systemRegisterIPC } from './system/ipc'
import './menu'
import { is } from '@electron-toolkit/utils'
import { createBvm } from './browserVm'
import { execSync } from 'child_process'
import { H3, serve } from 'h3'
import pkg from '../../package.json'
global.appName = pkg.name
function isPortTakenSync(port, host = '127.0.0.1') {
  try {
    const platform = process.platform
    let command

    if (platform === 'win32') {
      // Windows 系统
      command = `netstat -ano | findstr :${port}`
      const output = execSync(command, { encoding: 'utf8' })

      // 检查输出中是否包含 TCP 连接信息
      return output.includes('TCP') && output.includes(`:${port}`)
    } else if (platform === 'darwin' || platform === 'linux') {
      // macOS 或 Linux 系统
      command = `lsof -Pi :${port} -sTCP:LISTEN -t`
      const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' })

      // 如果有输出，表示端口被占用
      return !!output.trim()
    } else {
      // 其他系统默认返回 false（无法检测）
      console.warn(`不支持的操作系统: ${platform}`)
      return false
    }
  } catch (error) {
    // 命令执行失败（通常表示端口未被占用）
    return false
  }
}

const getCanUsePort = (port) => {
  let canUsePort = port
  while (isPortTakenSync(canUsePort)) {
    canUsePort++
  }
  return canUsePort
}

//创建HTTP服务
function createHttpServer() {
  const router = new Map()
  const app = new H3().all('**', async (req, res) => {
    const handler = router.get(`${req.url.pathname}:${req.method}`)
    if (!handler) {
      return {
        code: 404,
        msg: `${global.appName} HTTP Server:404 not found`,
        data: null
      }
    }
    const result = await handler(req)
    return {
      code: 200,
      msg: 'success',
      data: result
    }
  })
  app.get('/', async (req, res) => {
    return `${global.appName} HTTP Server`
  })
  const httpPort = getCanUsePort(9264)
  const server = serve(app, {
    port: httpPort
  })
  const createRouter = (method, path, handler) => {
    if (router.has(`${path}:${method}`)) {
      throw new Error(`路由地址 ${path} 已存在，请更换`)
    }
    router.set(`${path}:${method}`, handler)
  }
  const removeRouter = (method, path, handler) => {
    router.delete(`${path}:${method}`, handler)
  }
  return {
    createRouter,
    removeRouter,
    port: httpPort,
    server
  }
}

global.httpServer = createHttpServer()

//判断端口是否被占用
const debugPort = getCanUsePort(9222)
app.commandLine.appendSwitch('remote-debugging-port', debugPort)
app.commandLine.appendSwitch('remote-allow-origins', '*')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('ignore-certificate-errors')

//删除分区目录
const sessionDir = path.join(app.getPath('sessionData'), 'Partitions')
if (fs.existsSync(sessionDir)) {
  fs.readdir(sessionDir, (error, dirs) => {
    //循环遍历文件夹
    dirs.forEach((filename) => {
      const tempDir = path.join(sessionDir, filename)
      fs.stat(tempDir, (err, stats) => {
        //判断最后访问时间是否超过3天(超过后清理缓存)
        const overDays = 3 * 24 * 60 * 60 * 1000
        if (Date.now() - stats.atimeMs > overDays) {
          fs.rmdir(tempDir, { recursive: true }, (err) => {
            if (err) {
              console.error('Failed to delete session directory: ', err)
            } else {
              console.log('Session directory deleted successfully')
            }
          })
        }
      })
    })
  })
}

function createWindow() {
  // 创建基础窗口
  const win = new BaseWindow({
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fff',
    show: false,
    trafficLightPosition: {
      x: 16,
      y: 12
    }
  })
  if (process.platform === 'darwin') {
    win.setWindowButtonVisibility(true)
  }
  const devSession = session.fromPartition('persist:dev')
  // 创建 WebContentsView
  const view = new WebContentsView({
    webPreferences: {
      session: is.dev ? devSession : '',
      devTools: is.dev,
      sandbox: false,
      preload: path.join(__dirname, '../preload/index.js'),
      // 禁用同源策略以允许跨域请求
      webSecurity: false,
      webviewTag: true
    }
  })

  // if (!is.dev) {
  //   view.webContents.on('will-navigate', (event) => {
  //     shell.openExternal(event.url)
  //     event.preventDefault()
  //   })
  // }

  // view.webContents.setWindowOpenHandler(({ url }) => {
  //   shell.openExternal(url)
  //   return { action: 'deny' }
  // })

  // 将 view 添加到窗口
  win.contentView.addChildView(view)

  // 设置 view 的bounds以填充整个窗口
  const bounds = win.getContentBounds()
  view.setBounds({
    x: 0,
    y: 0,
    width: bounds.width,
    height: bounds.height
  })

  // 监听窗口大小变化
  win.on('resize', () => {
    const bounds = win.getContentBounds()
    view.setBounds({
      x: 0,
      y: 0,
      width: bounds.width,
      height: bounds.height
    })
  })

  win.on('enter-full-screen', () => {
    view.webContents.send('window-fullscreen-change', true)
  })

  win.on('leave-full-screen', () => {
    view.webContents.send('window-fullscreen-change', false)
  })

  // 窗口关闭事件
  win.on('close', (event) => {
    event.preventDefault()
    if (!is.dev) {
      view.webContents.send('window-close')
    } else {
      ipcMain.emit('window-close')
    }
  })

  // 阻挡F11全屏
  globalShortcut.register('F11', () => { })


  // 加载内容
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    view.webContents.loadURL(process.env['ELECTRON_RENDERER_URL']).catch(() => { })
    // 注册全局快捷键
    globalShortcut.register('F1', () => {
      view.webContents.openDevTools()
    })
    globalShortcut.register('F2', () => {
      view.webContents.reload()
    })
  } else {
    view.webContents.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 监听 view 的 dom-ready 事件
  view.webContents.on('dom-ready', () => {
    win.show()
    // 隐藏菜单栏
    win.setMenuBarVisibility(false)
  })

  return { win, view }
}

// 监听应用启动事件
app.whenReady().then(async () => {
  // 禁止应用多开
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    !is.dev ? app.quit() : null
  } else {
    // 当第二个实例启动时，会触发此事件
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // 确保窗口存在
      try {
        if (global.mainWindow) {
          // 恢复窗口（如果最小化）
          if (global.mainWindow.isMinimized()) global.mainWindow.restore()
          // 聚焦窗口
          global.mainWindow.focus()
        }
      } catch (error) {
        ipcMain.emit('window-close')
      }
    })
  }

  global.pptrConnect = async () => {
    global.browser = await puppeteer.connect({
      browserURL: `http://localhost:${debugPort}/`,
      defaultViewport: null
    })
  }

  await global.pptrConnect()

  const { win, view } = createWindow()


  global.mainWindow = win
  global.mainView = view

  // 注册应用退出清理
  app.on('before-quit', async () => {
    try {
      const { closeAllBrowsers } = await import('./browser/manager')
      await closeAllBrowsers()
    } catch (_) {}
  })

  createBvm()

  // 注册工作流 IPC 处理
  workflowRegisterIPC()

  // 注册数据管理IPC
  dataRegisterIPC()

  // 注册浏览器管理IPC
  envRegisterIPC()

  // 注册应用配置存储IPC
  storeRegisterIPC()

  // 注册加密解密IPC
  apiRegisterIPC()

  // 注册检查器IPC
  inspectorRegisterIPC()

  // 注册系统IPC
  systemRegisterIPC()

  // 注册主IPC
  registerIPC()

  // 监听激活事件
  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})
