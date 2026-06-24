/**
 * @file: 延时节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconClockCircle } from "@arco-design/web-vue/es/icon"

export default {
  type: "delay",
  name: "延时等待",
  icon: IconClockCircle,
  description: "等待指定时间后继续执行",
  view: false,
  config: {
    basic: {
      name: "基础配置",
      fields: {
        duration: {
          id: "duration",
          name: "等待时间",
          type: "number",
          min: 0,
          default: 1000,
          description: "等待时间(毫秒)",
          quickConfig: true,
        },
      },
    },
  },
  inputs: [],
  outputs: [],
}
