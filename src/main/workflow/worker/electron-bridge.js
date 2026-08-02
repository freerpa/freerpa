/**
 * @file: electron 桥 — 节点对 electron 模块的依赖（clipboard/shell/app）经主进程 RPC 注入
 */
import { bridge } from './bridge.js'

const rpc = (method) => (...args) => bridge.rpc(method, ...args)

export const clipboard = {
  readText: rpc('electron.clipboard.readText'),
  writeText: rpc('electron.clipboard.writeText'),
  clear: rpc('electron.clipboard.clear')
}

export const shell = {
  openPath: rpc('electron.shell.openPath'),
  openExternal: rpc('electron.shell.openExternal'),
  showItemInFolder: rpc('electron.shell.showItemInFolder')
}

export const app = {
  getPath: rpc('electron.app.getPath')
}
