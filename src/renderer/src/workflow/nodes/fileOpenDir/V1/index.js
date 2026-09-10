/**
 * @file: 打开目录节点
 */
import { RiFolderOpenLine } from "@remixicon/vue";

export default {
  type: 'fileOpenDir',
  name: '打开目录',
  icon: RiFolderOpenLine,
  description: '打开目录节点：在系统文件管理器中打开指定目录；若传入的是文件路径，则在资源管理器中定位到该文件。',
  config: [
    {
      id: 'basic',
      name: '基础配置',
      fields: [
        {
          id: 'dirPath',
          name: '目录路径',
          type: 'path',
          pathType: 'folder',
          description: '要打开的目录或文件路径',
          quickConfig: true,
          required: true
        }
      ]
    }
  ],
  inputs: [],
  outputs: []
}
