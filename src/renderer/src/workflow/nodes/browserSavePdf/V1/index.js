import { RiFilePdfLine } from "@remixicon/vue"
export default {
  type: 'browserSavePdf',
  name: '保存为PDF',
  icon: RiFilePdfLine,
  description: '保存为 PDF 节点：将当前浏览器页面渲染为 PDF 文件保存到指定目录（A4 纸张、保留背景、含页边距），可选排除页面中的指定元素后再保存。',
  view: false,
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'filePath',
          name: '文件路径',
          type: 'path',
          pathType: 'folder',
          quickConfig: true,
          required: true,
          description: 'PDF 保存目录（文件夹路径）'
        },
        {
          id: 'fileName',
          name: '文件名',
          type: 'text',
          quickConfig: true,
          required: true,
          description: '文件名，无需添加后缀（自动补 .pdf）'
        },
        // 要排除的元素选择器
        {
          id: 'excludes',
          name: '排除元素',
          type: 'array',
          fields: [{
            id: 'selector',
            name: '选择器',
            type: 'selector',
            description: '要排除的元素选择器'
          }],
          description: '保存前要从页面中移除的元素（如广告、导航栏等）'
        }
      ]
    }
  ],
  inputs: [{
    id: 'page',
    name: '浏览器',
    type: 'page',
    description: '浏览器页面对象（来自“打开浏览器”节点）'
  }],
  outputs: [{
    id: 'filePath',
    name: '文件路径',
    type: 'text',
    description: '保存后的 PDF 文件完整路径'
  }]
}
