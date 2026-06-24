import { availableNodesForAIBot } from '@nodes-path'
export const tools = [
    {
        type: 'function',
        function: {
            name: 'addNodes',
            description: '使用此工具为你当前的工作流添加节点。',
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    nodes: {
                        type: 'array',
                        description: '节点列表',
                        items: {
                            type: 'object',
                            properties: {
                                type: {
                                    type: 'string',
                                    description: '节点类型',
                                    enum: Object.keys(availableNodesForAIBot)
                                },
                                name: {
                                    type: 'string',
                                    description: '节点名称'
                                },
                                config: {
                                    type: 'object',
                                    description: '节点配置信息'
                                },
                                parentNode: {
                                    type: 'string',
                                    description: '父节点ID'
                                }
                            },
                            required: ["type", "name"],
                            minItems: 1,
                            maxItems: 5
                        }
                    }
                },
                required: ['nodes'],
                additionalProperties: false
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'editNodes',
            description: '使用此工具编辑你当前工作流中的节点。',
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    nodes: {
                        type: 'array',
                        description: '节点列表',
                        items: {
                            type: 'object',
                            properties: {
                                id: {
                                    type: 'string',
                                    description: '节点ID'
                                },
                                name: {
                                    type: 'string',
                                    description: '节点名称'
                                },
                                config: {
                                    type: 'object',
                                    description: '节点配置信息'
                                },
                                parentNode: {
                                    type: 'string',
                                    description: '父节点ID'
                                }
                            },
                            required: ["id"],
                            minItems: 1,
                            maxItems: 5
                        }
                    }
                },
                required: ['nodes'],
                additionalProperties: false
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'deleteNodes',
            description: '使用此工具删除你当前工作流中的节点。',
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    nodes: {
                        type: 'array',
                        description: '节点列表',
                        items: {
                            type: 'object',
                            properties: {
                                id: {
                                    type: 'string',
                                    description: '节点ID'
                                }
                            },
                            required: ["id"],
                            minItems: 1,
                            maxItems: 5
                        }
                    }
                },
                required: ['nodes'],
                additionalProperties: false
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'addEdges',
            description: '使用此工具为你当前的工作流添加连线。',
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    edges: {
                        type: 'array',
                        description: '连线列表',
                        items: {
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
                            },
                            required: ["source", "sourceHandle", "target", "targetHandle"],
                            minItems: 1,
                            maxItems: 5
                        }
                    }
                },
                required: ['edges'],
                additionalProperties: false
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'deleteEdges',
            description: '使用此工具删除你当前工作流中的连线。',
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    edges: {
                        type: 'array',
                        description: '连线列表',
                        items: {
                            type: 'object',
                            properties: {
                                id: {
                                    type: 'string',
                                    description: '连线ID'
                                }
                            },
                            required: ["id"],
                            minItems: 1,
                            maxItems: 5
                        }
                    }
                },
                required: ['edges'],
                additionalProperties: false
            }
        }
    },
    {
        type: 'function',
        function: {
            name: "finish",
            description: "本会话的最终工具，当你认为你已达到用户需求的目标时，你应该使用此工具将其标记为完成。",
            parameters: {
                type: "object",
                properties: {
                    summary: { "type": "string" }
                },
                required: ["summary"]
            }
        }
    }
]

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