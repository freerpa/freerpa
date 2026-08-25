# FreeRPA（风影RPA）

> 免费、安全、本地优先的跨平台桌面流程自动化（RPA）工具。

FreeRPA 是一款基于 Electron 的桌面端自动化工具，提供**可视化拖拽流程编排**、**AI 自然语言搭建**、**指纹浏览器环境**、**Deno 安全沙箱**以及**可安装插件系统**五大核心能力，覆盖网页、桌面、数据、文件、Excel、数据库与网络等全场景。

All data stays **local-first** by default — your workflows, data and browser environments never leave your machine unless you choose to sync.

---

## 特性

- **可视化流程编排**：基于 Vue Flow 的画布，拖拽即可搭建自动化流程。
- **82+ 内置节点、10 大类**：流程控制 / 全局变量 / 时间计数 / 网页控制 / 数据存储 / 网络操作 / 文件操作 / 数据处理 / Excel / 文件预览。
- **AI 自然语言搭建**：接入多供应商大模型（OpenAI 兼容 / Anthropic / Google），通过对话由 AI 自动生成并编排流程，支持工具调用与上下文理解。
- **指纹浏览器**：基于 fingerprint-chromium 内核，提供相互隔离的浏览器环境，轻松管理多账号，支持独立代理、Cookie 与指纹。
- **安全沙箱**：流程在独立 Deno Worker 中执行，配合细粒度权限模型（文件系统 / 网络 / 子进程 / 环境变量 / 系统信息 / FFI），默认最安全。
- **可安装插件系统**：通过 `plugin://` 协议加载第三方插件并为每个插件动态注册节点，扩展无限能力。
- **本地优先数据**：工作流、数据、浏览器环境均存于本地 SQLite，离线可用、隐私可控。
- **跨平台**：Windows / macOS / Linux 全平台支持。

---

## 内置节点分类

| 分类 | 节点示例 |
| --- | --- |
| 流程控制 | 条件判断、循环、结束、异常、通知、子流程、自定义节点 |
| 全局变量 | 变量设置、变量读取 |
| 时间计数 | 定时器、计数器、延迟、计划任务、获取/处理时间 |
| 网页控制 | 打开网页、输入、鼠标、滚动、抓取、截图、监听、PDF 保存 |
| 数据存储 | 数据读写/删除/更新、临时数据、数据库连接/执行 |
| 网络操作 | HTTP 请求、HTTP 服务、WebSocket 连接/发送 |
| 文件操作 | 创建/遍历/移动/复制/删除/读写文件、打开目录、状态 |
| 数据处理 | 字符串/数字/对象/数组处理、解析、提取、过滤、剪贴板 |
| Excel | 创建、保存、单元格读写/合并、行列插入/删除 |
| 文件预览 | 图片 / 视频 / 音频预览 |

所有节点均支持**版本化**（`V{num}` 目录），新版本自动生效，旧版本兼容保留。

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面框架 | Electron 43 + electron-vite 5 |
| 前端 | Vue 3 + Pinia + Vue Router + Arco Design Vue |
| 画布 | Vue Flow（自定义节点 / 连接线 / 子流程） |
| 代码编辑 | CodeMirror |
| 执行沙箱 | Deno Worker（独立进程，默认 2.9.x） |
| 浏览器内核 | fingerprint-chromium + puppeteer-core（CDP 控制） |
| AI SDK | Vercel AI SDK + @ai-sdk/* 多供应商 |
| 本地存储 | SQLite（sqlite3 驱动）+ 文件目录 |
| 打包 | electron-builder（Windows NSIS / macOS DMG / Linux AppImage·snap·deb） |

---

## 目录结构

```
freerpa/
├── src/
│   ├── main/                # 主进程
│   │   ├── app/             # 应用引导、托盘、窗口
│   │   ├── ai/              # AI 供应商管理、聊天 IPC
│   │   ├── browser/         # 指纹浏览器内核下载、启动与管理
│   │   ├── data/            # 本地数据层（浏览器/分类/元素集/模型/工作流）
│   │   ├── plugin/          # 插件安装、打包、plugin:// 协议、商店
│   │   ├── stats/           # 日活/使用统计上报（可关闭）
│   │   ├── store/           # 全局配置存储与迁移
│   │   └── workflow/        # 工作流宿主、权限体系、Worker 管理
│   ├── preload/             # 预加载脚本（IPC 桥）
│   └── renderer/            # 渲染进程
│       └── src/
│           ├── workflow/    # 节点生态（nodes/）、画布、字段渲染器
│           ├── ai/          # AI 对话与工具调用
│           ├── views/       # 浏览器 / 数据 / 元素集 / 设置 / 市场等页面
│           └── components/  # 通用组件
├── scripts/                 # deno 下载、worker 构建、原生依赖、冒烟测试
├── build/                   # 应用图标、托盘图标、macOS entitlements
└── resources/               # 运行时资源（deno / worker，打包产物）
```

---

## 开发环境

**环境要求：**

- Node.js ≥ 20（建议 22）
- 网络可访问 GitHub Releases / Deno 发布源（用于下载运行时）

**安装 & 启动：**

```bash
npm install          # postinstall 自动 ensure-electron / ensure-native / install-app-deps
npm run dev          # 启动开发模式（electron-vite dev）
```

> 首次启动前可能需按需下载 Deno 运行时与浏览器内核，相关命令见下。

### 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发模式（启动 Electron） |
| `npm run build` | 仅构建（electron-vite build） |
| `npm run fetch:deno` | 下载 Deno 运行时二进制到 `resources/deno` |
| `npm run build:worker` | 构建工作流 Worker 资源 |
| `npm run ensure:native` | 校验 / 修复原生依赖（sharp、sqlite3 等） |
| `npm run test:worker` | Deno Worker 冒烟测试 |
| `npm run lint` | ESLint 检查 |
| `npm run format` | Prettier 格式化 |

### 平台打包

```bash
npm run build:win      # Windows（NSIS）
npm run build:mac      # macOS（DMG）
npm run build:linux    # Linux（AppImage / snap / deb）
npm run build:unpack   # 仅打目录（本地调试产物）
```

---

## 环境变量

复制 `.env` 并按需修改：

| 变量 | 说明 |
| --- | --- |
| `VITE_DEV_URL` | 开发环境 API 地址 |
| `VITE_PROD_URL` | 生产环境 API 地址 |
| `VITE_MARKET_URL` | 扩展市场嵌入地址 |
| `VITE_DOWNLOAD_URL` | 更新下载跳转地址 |

---

## 安全沙箱

工作流默认在独立 **Deno Worker** 中执行，与主应用隔离。权限模型包括：

- **io**：文件系统可访问根目录（预置 `FREERPA-DATA` 目录）
- **network**：网络访问模式（allow-all / allow-list / disabled）与域名规则
- **process**：子进程启动白名单
- **env**：环境变量读取白名单
- **sys**：系统信息读取白名单
- **ffi**：Native FFI 开关与路径白名单

首次启动写入最安全默认权限；可在“设置 - 权限管理”中按需放行，兼顾易用性与安全边界。

---

## 相关项目

- [FreeRPA 官网 & 后端](https://freerpa.cn) —— 官网、插件市场（扩展商店）、用户中心与服务端 API 所在的 `freerpa-website` 仓库。

---

## 开源协议

本项目开源，具体协议详见仓库根目录 `LICENSE` 文件。