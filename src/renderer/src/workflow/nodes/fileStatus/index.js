/**
 * @file: 获取状态节点配置
 * @author: AutoMan
 * @date: 2024-03-15
 */

import { RiFolderInfoLine } from "@remixicon/vue";



export default {
    // 节点类型唯一标识
    type: 'fileStatus',
    // 节点显示名称
    name: '路径信息',
    // 节点图标
    icon: RiFolderInfoLine,
    // 节点描述
    description: '获取路径的状态信息',
    // 节点配置
    config: {},
    // 输入定义
    inputs: [
        {
            id: 'path',
            name: '路径',
            type: 'string',
            required: true,
            description: '要检查状态的路径'
        }
    ],
    // 输出定义
    outputs: [
        {
            id: 'exists',
            name: '是否存在',
            type: 'boolean',
            description: '路径是否存在'
        },
        {
            id: 'isFile',
            name: '是否文件',
            type: 'boolean',
            description: '路径是否为文件'
        },
        {
            id: 'status',
            name: '完整信息',
            type: 'object',
            description: '完整的路径状态信息'
        }
    ],
    // 是否使用自定义视图
    view: false
}