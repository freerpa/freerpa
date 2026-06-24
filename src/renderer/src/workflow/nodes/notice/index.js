/**
 * @file: 通知节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconNotification } from "@arco-design/web-vue/es/icon"

export default {
  type: "notice",
  name: "通知",
  icon: IconNotification,
  description: "触发通知消息",
  view: true,
  config: {
    basic: {
      name: "基础配置",
      fields: {
        message: {
          id: "message",
          name: "通知内容",
          type: "textarea",
          required: true,
          description: "要显示的通知内容",
          quickConfig: true,
        },
        playSound: {
          id: "playSound",
          name: "播放声音",
          type: "switch",
          default: true,
          description: "是否播放提示音",
        },
        loop: {
          id: "loop",
          name: "循环播放",
          type: "switch",
          default: false,
          description: "是否循环播放提示音",
          show: "${playSound}",
        },
      },
    },
  },
  inputs: [],
  outputs: [],
}
