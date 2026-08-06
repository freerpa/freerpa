import { availableNodesForAIBot } from '@nodes-path'
import { autoLayout, getInitNodeData, ConnectionRules } from '@/workflow/utils'

const initConfigItem = async (field) => {
    const configItem = {}
    if (['array', 'object', 'string', 'number', 'boolean'].includes(field.type)) {
        configItem.type = field.type
    } else if (['radio', 'select'].includes(field.type)) {
        configItem.type = 'string'
        let options = field.options || []
        // if (field.remote && field.remoteMethod) {
        //     options = await field.remoteMethod()
        // }
        configItem.enum = options.map((item) => item.value)
    } else {
        configItem.type = 'string'
    }
    configItem.default = field.default
    configItem.description = field.description || field.name || ''
    return configItem
}
const getConfigForModel = (config) => {
    const configObj = {
        type: 'object',
        properties: {},
        required: [],

    }
    Object.values(config || {}).forEach((group) => {
        Object.values(group.fields || {}).forEach(async (field) => {
            const configItem = await initConfigItem(field)
            if (field.required) {
                configObj.required.push(field.id)
            }
            if (field.fields && Object.keys(field.fields).length > 0) {
                configItem.properties = {}
                let configItemProperties = configItem.properties

                if (field.type === 'array') {
                    delete configItem.properties
                    configItem.type = 'array'
                    configItem.items = {
                        type: 'object',
                        properties: {},
                        required: [],
                        additionalProperties: false
                    }
                    configItemProperties = configItem.items.properties
                }

                configItem.required = []
                Object.keys(field.fields).forEach(async (itemId) => {
                    const item = field.fields[itemId]
                    if (item.required) {
                        configItem.required.push(itemId)
                    }
                    configItemProperties[itemId] = await initConfigItem(item)
                })
            }
            configObj.properties[field.id] = configItem
        })
    })
    return configObj
}
const nodeTools = []
Object.keys(availableNodesForAIBot).forEach((key) => {
    const node = availableNodesForAIBot[key]
    const nodeTool = {
        type: 'function',
        function: {
            name: 'addNode_' + key,
            description: node.description,
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    nodeId: {
                        type: 'string',
                        description: '如果节点ID存在，代表更新节点，否则创建新节点',
                        default: ''
                    },
                    name: {
                        type: 'string',
                        description: '节点名称',
                    },
                    parentNode: {
                        type: 'string',
                        description: '父节点ID,可选',
                        default: ''
                    },
                    config: getConfigForModel(availableNodesForAIBot[key].config)
                }
            },
            required: ['name'],
            additionalProperties: false
        }
    }
    nodeTools.push(nodeTool)
})

export const getActions = (vueFlowRef, flowRef, workflowId, flowStore) => {
    const { validateConnection, createConnection } = new ConnectionRules(workflowId)
    const actions = {}
    nodeTools.forEach((tool) => {
        actions[tool.function.name] = async ({ nodeId, name, parentNode = undefined, config }) => {
            let result = {
                id: '',
                status: ''
            }
            if (!name) {
                throw new Error('name is required')
            }
            const type = tool.function.name.replace('addNode_', '')
            if (!availableNodesForAIBot[type]) {
                throw new Error('node type not found')
            }
            if (nodeId) {
                const n = vueFlowRef.value.getNode(nodeId)
                n.data.name = name
                n.parentNode = parentNode || undefined
                for (const key in n.data.config) {
                    if (config[key]) {
                        n.data.config[key] = config[key]
                    }
                }
                // AI 修改节点后触发 data change：进入历史（undo/redo 可回退）并标记未保存
                flowStore?.onNodesChange([{ id: nodeId, type: 'data' }])
                result = {
                    id: nodeId,
                    status: 'success'
                }
            } else {
                let newNode = {}
                let initNodeData = getInitNodeData(type)
                if (initNodeData) {
                    initNodeData = JSON.parse(initNodeData)
                    initNodeData.name = name
                    initNodeData.parentNode = parentNode || undefined
                    for (const key in initNodeData.config) {
                        if (config[key]) {
                            initNodeData.config[key] = config[key]
                        }
                    }
                    newNode = await flowRef.value.addNode(initNodeData, { x: 0, y: 0 })
                }
                autoLayout(vueFlowRef.value)
                result = {
                    id: newNode.id,
                    status: 'success'
                }
            }
            return result
        }
    })
    actions.deleteNode = async ({ nodeId }) => {
        if (!nodeId) {
            throw new Error('nodeId is required')
        }
        // 走受管 API：handleNodeDelete 含起始节点保护、容器重算与历史记录；未就绪时回退直接移除
        const node = vueFlowRef.value.getNode(nodeId)
        if (flowRef.value?.handleNodeDelete && node) {
            flowRef.value.handleNodeDelete(node)
        } else {
            await vueFlowRef.value.removeNodes(nodeId, true, true)
        }
        autoLayout(vueFlowRef.value)
        return 'success'
    }
    actions.addEdge = async ({ source, target, sourceHandle, targetHandle }) => {
        if (!source) {
            throw new Error('source is required')
        }
        if (!target) {
            throw new Error('target is required')
        }
        const newEdge = {
            source,
            target,
            sourceHandle,
            targetHandle
        }
        if (!validateConnection(newEdge)) {
            return 'invalid'
        }
        vueFlowRef.value.addEdges([createConnection(newEdge)])
        autoLayout(vueFlowRef.value)
        return 'success'
    }
    actions.deleteEdge = async ({ edgeId }) => {
        if (!edgeId) {
            throw new Error('edgeId is required')
        }
        await vueFlowRef.value.removeEdges([edgeId])
        autoLayout(vueFlowRef.value)
        return 'success'
    }
    return actions
}

export const tools = [
    ...nodeTools,
    {
        type: 'function',
        function: {
            name: 'deleteNode',
            description: '使用此工具删除你当前工作流中的节点。',
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    nodeId: {
                        type: 'string',
                        description: '节点ID',
                    }
                }
            },
            required: ['nodeId'],
            additionalProperties: false
        }
    },
    {
        type: 'function',
        function: {
            name: 'addEdge',
            description: '使用此工具为你当前的工作流添加连线。',
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    source: {
                        type: 'string',
                        description: '源节点ID'
                    },
                    sourceHandle: {
                        type: 'string',
                        description: '源节点输出端口ID'
                    },
                    target: {
                        type: 'string',
                        description: '目标节点ID'
                    },
                    targetHandle: {
                        type: 'string',
                        description: '目标节点输入端口ID'
                    }
                }
            },
            required: ["source", "sourceHandle", "target", "targetHandle"],
            additionalProperties: false
        }
    },
    {
        type: 'function',
        function: {
            name: 'deleteEdge',
            description: '使用此工具删除你当前工作流中的连线。',
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    edgeId: {
                        type: 'string',
                        description: '连线ID'
                    }
                }
            },
            required: ['edgeId'],
            additionalProperties: false

        }
    },
    {
        type: 'function',
        function: {
            name: "finish",
            description: "本会话的最终工具，当你认为你已达到用户需求的目标时，你应该使用此工具将其标记为完成。",
        }
    }
]
console.log(tools)
/**
 * 流结束后：解析出完整的工具调用
 * @returns {Array} 完整的tool_calls数组（支持多工具）
 */
export function getFinalToolCalls(toolCallsBuffer) {
    const finalToolCalls = []
    for (let i = 0; i < toolCallsBuffer.length; i++) {
        const tool = {
            id: toolCallsBuffer[i].id,
            type: toolCallsBuffer[i].type,
            function: toolCallsBuffer[i].function
        }
        try {
            tool.function.arguments = JSON.parse(tool.function.arguments || '{}')
        } catch (error) {
            tool.function.arguments = {}
        }
        finalToolCalls.push(tool)
    }
    return finalToolCalls
}