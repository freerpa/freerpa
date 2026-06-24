
import { BrowserWindow, WebContentsView, session, app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { sendToRenderer } from '../workflow/core/utils/rendererUtils'

// 1. 标准协议白名单（与渲染进程保持一致）
const STANDARD_PROTOCOLS = new Set([
    'http:', 'https:', 'file:', 'data:', 'about:', 'mailto:', 'tel:', 'ftp:', 'ssh:', 'sftp:', 'irc:', 'ircs:', 'xmpp:'
]);
// 辅助函数：判断是否为非标准协议
const isNonStandardProtocol = (url) => {
    try {
        const parsedUrl = new URL(url);
        return !STANDARD_PROTOCOLS.has(parsedUrl.protocol);
    } catch (err) {
        return false; // 无效 URL 视为非协议跳转
    }
}

// 2. 拦截非标准协议跳转
const blockNonStandardProtocol = (view) => {
    // 拦截窗口内导航（will-navigate）
    view.webContents.on('will-navigate', (event, url) => {
        if (isNonStandardProtocol(url)) {
            event.preventDefault(); // 阻止导航
        }
    });

    view.webContents.on('will-frame-navigate', (event, url) => {
        if (isNonStandardProtocol(url)) {
            event.preventDefault(); // 阻止导航
        }
    })

    view.webContents.on('will-redirect', (event, url) => {
        if (isNonStandardProtocol(url)) {
            event.preventDefault(); // 阻止导航
        }
    })
}
// 设置userAgent
export const setUserAgent = (view, env) => {
    let userAgent = env.browser_ua.trim()
    let defaultUserAgent = global.mainView.webContents.getUserAgent()
    // 核心正则：匹配 Electron/版本号（包含前后空格，避免残留空格）
    const removeRegex = / (Electron)\/\d+(\.\d+)* /g;
    // 第一步：移除目标内容；第二步：清理多余空格（连续空格/首尾空格）
    defaultUserAgent = defaultUserAgent
        .replace(removeRegex, ' ')  // 替换匹配内容为单个空格（避免连续空格）
        .trim()                     // 去除首尾空格
        .replace(/\s+/g, ' ');
    if (env.browser_type === 'pc') {
        userAgent = defaultUserAgent
    } else if (env.browser_type === 'mobile') {
        userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    }
    view.webContents.setUserAgent(userAgent)
    const customSession = view.webContents.session
    customSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const h = details.requestHeaders
        if (h['user-agent'] && h['user-agent'] !== defaultUserAgent) {
            // 强制 UA
            h['user-agent'] = userAgent
            // 移除 UA-CH 相关请求头
            for (const k of Object.keys(h)) {
                if (k.toLowerCase().startsWith('sec-ch')) delete h[k]
            }
        }
        callback({ requestHeaders: h })
    })
    return true
}
export const createEnvView = async (env = null, options = {}) => {
    const {
        offscreen = false,
        backgroundThrottling = true,
        proxy = '',
        nodeId = uuidv4(),
        inspector = false,
        type = '',
        images = true,
        newPage = false
    } = options


    // 如果有环境ID，获取环境数据
    let storage, cookies, url
    if (env) {
        try {
            storage = env.storage
            cookies = env.cookies
            // 使用环境中保存的URL
            url = env.url
        } catch (error) {
            console.error('获取环境数据失败:', error)
        }
    }
    let customSession = null
    if (env?.id) {
        //如果有环境ID则创建常驻环境
        customSession = session.fromPartition(`persist:env_${env.id}`)
    } else {
        //如果没有环境ID则创建临时环境
        customSession = session.fromPartition(`persist:temp_${nodeId}`)
    }
    // 清除环境的数据(保留缓存，加速下次打开的速度)
    await customSession.clearData({
        dataTypes: [
            'cookies',
            'backgroundFetch',
            'storage',
            'fileSystems',
            'indexedDB',
            'localStorage',
            'serviceWorkers',
            'webSQL',
            'downloads'
        ]
    })

    let proxyConfig = {
        mode: 'system',
        proxyRules: ''
    }

    //设置代理
    if (proxy) {
        proxyConfig.mode = 'fixed_servers'
        proxyConfig.proxyRules = proxy.trim()
        // 解析代理配置
        const proxyProtocol = ['http:', 'https:', 'ftp:', 'socks4:', 'socks5:']
        // 检查代理协议是否正确
        if (!proxyProtocol.some(protocol => proxyConfig.proxyRules.startsWith(protocol))) {
            proxyConfig.proxyRules = `http://${proxyConfig.proxyRules}`
        }
    }
    await customSession.setProxy(proxyConfig)
    await customSession.forceReloadProxyConfig()
    // 如果有cookies数据，恢复cookies
    if (cookies) {
        try {
            for (const cookie of cookies) {
                //删除domain的第一个点
                if (cookie.domain.charAt(0) === '.') {
                    cookie.domain = cookie.domain.slice(1)
                }
                // 确保cookie对象包含必要的字段
                const cookieData = {
                    // 构建cookie的URL
                    url: `${cookie.secure ? 'https://' : 'http://'}${cookie.domain}${cookie.path || '/'}`,
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain,
                    path: cookie.path || '/',
                    secure: cookie.secure,
                    httpOnly: cookie.httpOnly,
                    // 只有当过期时间有效时才设置
                    ...(cookie.expirationDate && cookie.expirationDate > Date.now() / 1000
                        ? { expirationDate: cookie.expirationDate }
                        : {})
                }

                // 过滤掉无效的cookie
                if (!cookieData.name || !cookieData.value || !cookieData.domain) {
                    console.warn('跳过无效的cookie:', cookieData)
                    continue
                }

                try {
                    await customSession.cookies.set(cookieData)
                } catch (err) {
                    console.warn('设置cookie失败:', {
                        cookie: cookieData,
                        error: err.message
                    })
                }
            }
        } catch (error) {
            console.error('恢复cookies失败:', error)
        }
    }

    customSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
        // console.log('setPermissionCheckHandler', permission, requestingOrigin, details);
        // 允许所有权限
        return true
    })

    customSession.setDevicePermissionHandler((webContents, permission, requestingOrigin, details) => {
        // console.log('setDevicePermissionHandler', permission, requestingOrigin, details);
        // 允许所有权限
        return true
    })

    customSession.setDisplayMediaRequestHandler((webContents, permission, requestingOrigin, details) => {
        // console.log('setDisplayMediaRequestHandler', permission, requestingOrigin, details);
        // 允许所有权限
        return true
    })

    customSession.setPermissionRequestHandler((webContents, permission, requestingOrigin, details) => {
        // console.log('setPermissionRequestHandler', permission, requestingOrigin, details);
        // 允许所有权限
        return true
    })
    // 创建新的 view并设置chrome的UA
    const view = new WebContentsView({
        webPreferences: {
            sandbox: !inspector,
            session: customSession,
            // 禁用同源策略以允许跨域请求
            nodeIntegrationInSubFrames: true,
            webSecurity: true,
            backgroundThrottling,
            webGL: false,
            offscreen: offscreen,
            images: images,
            preload: inspector ? path.join(__dirname, '../preload/inspector.js') : null
        }
    })
    // 注入指纹
    // await injectFingerprint(view)
    // 设置新页面数组
    view.newPages = []
    // 禁用非代理UDP
    view.webContents.setWebRTCIPHandlingPolicy("disable_non_proxied_udp")
    // 拦截非标准协议跳转
    blockNonStandardProtocol(view)
    // 设置UA
    setUserAgent(view, env)
    // 如果newPage为false，禁止打开新窗口
    view.webContents.setWindowOpenHandler(async ({ url }) => {
        if (!newPage) {
            view.webContents.loadURL(url).catch(() => { })
        } else {
            const bounds = view.getBounds()
            const newPage = await new BrowserWindow({
                width: bounds.width,
                height: bounds.height,
                webPreferences: {
                    session: customSession
                },
                show: !offscreen
            })
            await newPage.loadURL(url)
            view.newPages.push(newPage)
        }
        return { action: 'deny' }
    })

    // 设置storage
    const setStorage = async () => {
        return new Promise(async (resolve, reject) => {
            // 如果有storage数据，注入恢复脚本
            view.webContents.once('did-start-loading', async () => {
                try {
                    await view.webContents.executeJavaScript(`
                        try {
                            const storage = ${JSON.stringify(storage)};
                            // 恢复 localStorage
                            Object.entries(storage.localStorage || {}).forEach(([key, value]) => {
                                localStorage.setItem(key, value);
                            });
                            // 恢复 sessionStorage
                            Object.entries(storage.sessionStorage || {}).forEach(([key, value]) => {
                                sessionStorage.setItem(key, value);
                            });
                        } catch (error) {
                            console.error('恢复storage失败:', error);
                        }
                    `)
                    resolve()
                } catch (error) {
                    console.error('解析storage数据失败:', error)
                    reject(error)
                }
            })
            view.webContents.loadURL(url).catch(() => { })
        })
    }

    // 如果有storage数据，注入恢复脚本
    if (storage && url) {
        await setStorage()
    }

    if (['inspector', 'env'].includes(type)) {
        view.webContents.on('did-start-navigation', ({ url, isMainFrame }) => {
            if (isMainFrame && !url.includes('envGuide?system') && !url.includes('selectorGuide?system')) {
                sendToRenderer(`webview:did-start-navigation-${type}`, url)
            }
        })
        view.webContents.on('did-start-loading', () => {
            sendToRenderer(`webview:did-start-loading-${type}`)
        })
        view.webContents.on('did-stop-loading', () => {
            sendToRenderer(`webview:did-stop-loading-${type}`)
        })
        view.webContents.on('did-finish-load', () => {
            sendToRenderer(`webview:did-finish-load-${type}`)
        })
        view.webContents.on('did-fail-load', () => {
            sendToRenderer(`webview:did-fail-load-${type}`)
        })
    }
    return view
}
