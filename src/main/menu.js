import { Menu } from 'electron'
const isMac = process.platform === 'darwin'
const template = [
    ...(isMac
        ? [{
            label: '应用',
            submenu: [
                { role: 'quit', label: '退出' }
            ]
        }]
        : []),
    {
        label: '编辑',
        submenu: [
            { role: 'undo', label: '撤销' },
            { role: 'redo', label: '重做' },
            { type: 'separator' },
            { role: 'cut', label: '剪切' },
            { role: 'copy', label: '复制' },
            { role: 'paste', label: '粘贴' },
            ...(isMac
                ? [
                    { role: 'pasteAndMatchStyle', label: '粘贴并匹配样式' },
                    { role: 'delete', label: '删除' },
                    { role: 'selectAll', label: '全选' }
                ]
                : [
                    { role: 'delete', label: '删除' },
                    { type: 'separator' },
                    { role: 'selectAll', label: '全选' }
                ])
        ]
    }
]

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)