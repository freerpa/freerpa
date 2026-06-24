/**
 * @file: 应用配置存储模块
 * @author: dabao
 * @date: 2024-03-16
 */
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

class Store {
  constructor(opts) {
    // 确定存储文件的路径
    const userDataPath = app.getPath('userData')
    this.path = path.join(userDataPath, opts.configName)
    // 如果文件不存在，则创建一个空对象
    if (!fs.existsSync(this.path)) {
      fs.writeFileSync(this.path, JSON.stringify({}))
    }
    // 读取文件内容
    this.data = JSON.parse(fs.readFileSync(this.path))
  }

  // 获取特定键的值
  get(key) {
    return this.data[key]
  }

  // 设置特定键的值
  set(key, val) {
    this.data[key] = val
    // 确保数据被同步保存到文件
    fs.writeFileSync(this.path, JSON.stringify(this.data))
  }
}

const store = new Store({
  configName: 'user-preferences'
})

export const get = (key) => {
  return store.get(key)
}

export const set = (key, value) => {
  store.set(key, value)
}
