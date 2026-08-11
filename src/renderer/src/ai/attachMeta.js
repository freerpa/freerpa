/**
 * @file: 附件资源类型元数据（Sender 输入区附件 chips 与 Bubble 用户气泡内引用 chips 共用）
 */
import { RiFileLine, RiFlowChart, RiGlobalLine, RiDatabase2Line, RiStackLine } from '@remixicon/vue'

export const ATTACH_META = {
  file: { icon: RiFileLine, label: '文件' },
  workflow: { icon: RiFlowChart, label: '工作流' },
  browser: { icon: RiGlobalLine, label: '浏览器' },
  table: { icon: RiDatabase2Line, label: '数据表' },
  element: { icon: RiStackLine, label: '元素集' }
}

export const attMeta = (type) => ATTACH_META[type] || ATTACH_META.file
