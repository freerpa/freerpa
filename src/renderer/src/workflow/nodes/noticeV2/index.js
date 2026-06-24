/**
 * @file: 通知节点
 * @author: dabao
 * @date: 2024-03-15
 */
import { IconNotification } from "@arco-design/web-vue/es/icon"

export default {
  type: "noticeV2",
  name: "系统通知",
  icon: IconNotification,
  description: "创建一条系统通知消息并显示在通知中心",
  view: false,
  config: {
    basic: {
      name: "基础配置",
      fields: {
        content: {
          id: "content",
          name: "内容",
          type: "textarea",
          required: true,
          description: "要显示在通知中心的内容",
          quickConfig: true,
        },
        type: {
          id: "type",
          name: "类型",
          type: "radio",
          required: true,
          default: 'default',
          description: "通知的类型",
          quickConfig: true,
          options: [
            {
              label: "默认",
              value: "default"
            },
            {
              label: "成功",
              value: "success"
            },
            {
              label: "警告",
              value: "warning"
            },
            {
              label: "错误",
              value: "error"
            }
          ]
        }
      },
    },
  },
  inputs: [],
  outputs: [],
}
