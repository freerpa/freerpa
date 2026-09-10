/**
 * @file: 通知节点
 */
import { IconNotification } from "@arco-design/web-vue/es/icon"

export default {
  type: "systemNotice",
  name: "系统通知",
  icon: IconNotification,
  description: "系统通知节点：创建一条通知消息并推送到应用通知中心（含弹窗展示）。用于流程运行状态、结果或异常提醒。",
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
          description: "要显示在通知中心/弹窗中的通知内容文本",
          quickConfig: true,
        },
        {
          id: "type",
          name: "类型",
          type: "radio",
          required: true,
          default: 'default',
          description: "通知类型：default（默认）/ success（成功）/ warning（警告）/ error（错误），决定通知的展示样式",
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
