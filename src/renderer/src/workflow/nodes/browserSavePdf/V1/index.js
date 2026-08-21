import { RiFilePdfLine } from "@remixicon/vue"
export default {
  type: 'browserSavePdf',
  name: '保存为PDF',
  icon: RiFilePdfLine,
  description: '保存当前浏览器页面为PDF文件',
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
          description: '文件路径'
        },
        {
          id: 'fileName',
          name: '文件名',
          type: 'text',
          quickConfig: true,
          required: true,
          description: '文件名无需添加后缀'
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
          description: '要排除的元素'
        }
      ]
    }
  ],
  inputs: [{
    id: 'page',
    name: '浏览器',
    type: 'page',
    description: '浏览器'
  }],
  outputs: [{
    id: 'filePath',
    name: '文件路径',
    type: 'text',
    description: '文件路径'
  }]
}
