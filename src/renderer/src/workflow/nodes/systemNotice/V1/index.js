/**
 * @file: 通知节点
 */
import { IconNotification } from "@arco-design/web-vue/es/icon"

export default {
  type: "systemNotice",
  name: "系统通知",
  icon: IconNotification,
  description: "创建一条系统通知消息并显示在通知中心",
  view: false,
  config: [
    {
      id: 'basic',
      name: "基础配置",
      fields: [
        {
          id: "title",
          name: "标题",
          type: "input",
          default: "工作流通知",
          description: "系统通知弹窗的标题（不填默认「工作流通知」）",
          quickConfig: true,
        },
        {
          id: "content",
          name: "内容",
          type: "textarea",
          required: true,
          description: "要显示在通知中心的内容",
          quickConfig: true,
        },
        {
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
      ],
    },
  ],
  inputs: [],
  outputs: [],
}
