<template>
  <div class="chat">
    <div class="chat__title">
      <span><icon-robot /> AI助手</span>
      <a-space>
        <a-popconfirm content="确认清空聊天记录吗？" @ok="emptyChatMessages">
          <a-button type="text" size="mini"> 清空记录 </a-button>
        </a-popconfirm>
        <a-button type="text" size="mini" @click="emit('close')">
          <template #icon>
            <icon-close />
          </template>
        </a-button>
      </a-space>
    </div>
    <a-scrollbar ref="scrollbar" style="height: calc(80vh - 140px); overflow-y: auto">
      <div ref="messagesContainer" class="chat__messages">
        <template v-if="messages.length > 0">
          <Bubble
            v-for="(message, index) in messages"
            :key="index"
            :tool_calls="message.tool_calls"
            :content="message.content"
            :reasoning_content="message.reasoning_content"
            :role="message.role"
            :tool_calling="message.tool_calling"
            :loading="message.loading"
            @delete="handleDelete(index)"
          />
        </template>
        <div class="chat__empty" v-else>
          <a-empty description="暂无聊天记录">
            <template #image>
              <icon-robot />
            </template>
          </a-empty>
        </div>
      </div>
    </a-scrollbar>
    <Sender class="chat__sender" @send="handleSend" @cancel="handleCancel" :loading="loading" />
  </div>
</template>

<script setup>
import { defineProps, defineEmits, ref, nextTick } from 'vue'
import Bubble from './Bubble.vue'
import Sender from './Sender.vue'
import { createChatStream, getChatMessages, deleteChatMessages } from '@/api/aiModels'
import { IconRobot, IconClose } from '@arco-design/web-vue/es/icon'
import { categories } from '@nodes-path'
import { useFlowStore } from '@/workflow/store'
import { tools, getFinalToolCalls } from './functionCalling.js'
import { Message } from '@arco-design/web-vue'
const props = defineProps({
  workflowId: {
    type: String,
    required: true
  },
  toolActions: {
    type: Object,
    required: true
  }
})
const flowStore = useFlowStore(props.workflowId)
const emit = defineEmits(['send', 'close', 'workflow'])

const messages = ref([])
const scrollbar = ref(null)
const messagesContainer = ref(null)
const loading = ref(false)
const scrollToBottom = () => {
  nextTick(() => {
    scrollbar.value.scrollTop(messagesContainer.value.scrollHeight)
  })
}
const initMessages = async () => {
  try {
    const response = await getChatMessages({ workflowId: props.workflowId })
    messages.value = response.data || []
    scrollToBottom()
  } catch (error) {
    console.error('获取聊天记录失败:', error)
  }
}

initMessages()

const handleDelete = async (index) => {
  try {
    const deleteMessage = messages.value[index]
    let isDelete = true
    const reserveMessages = []
    messages.value.forEach((message) => {
      if (message.message_id !== deleteMessage.message_id) {
        reserveMessages.push(message)
      } else if (message.loading) {
        isDelete = false
      }
    })

    if (!isDelete) {
      Message.warning('当前消息正在回复中，不能删除')
      return
    }
    await deleteChatMessages({
      workflowId: props.workflowId,
      messageId: deleteMessage.message_id,
      role: deleteMessage.role
    })
    messages.value = reserveMessages
  } catch (error) {
    console.error('删除聊天记录失败:', error)
  }
}

const emptyChatMessages = async () => {
  try {
    await deleteChatMessages({ workflowId: props.workflowId })
    messages.value = []
  } catch (error) {
    console.error('清空聊天记录失败:', error)
  }
}
let messageBuffer = ''

const getConfigForModel = (config) => {
  const configObj = {}
  Object.values(config || {}).forEach((group) => {
    Object.values(group.fields || {}).forEach((field) => {
      const configItem = {}
      configItem.name = field.name
      configItem.description = field.description
      configItem.required = field.required
      configItem.type = field.type
      configItem.default = field.default
      if (field.fields && field.fields.length > 0) {
        configItem.fields = {}
        field.fields.forEach((item) => {
          configItem.fields[item.id] = {
            name: item.name,
            description: item.description,
            required: item.required,
            type: item.type,
            default: item.default
          }
        })
      }
      configObj[field.id] = configItem
    })
  })
  return configObj
}

const getHandleForModel = (handles) => {
  const handleObj = {}
  handles.forEach((handle) => {
    handleObj[handle.id] = {
      name: handle.name,
      description: handle.description,
      type: handle.type,
      required: handle.required
    }
  })
  return handleObj
}
const toolCallsBuffer = []

let chatStream = null
const handleCancel = () => {
  loading.value = false
  if (chatStream) {
    chatStream.abort()
  }
  chatStream = null
  messageBuffer = ''
  toolCallsBuffer.length = 0
}
const handleSend = async ({ id: messageId, model, role, content }) => {
  loading.value = true
  messageBuffer = ''
  const nodeForModel = []
  Object.values(categories).forEach(({ name, nodes }) => {
    nodeForModel.push({
      group: name,
      nodes: nodes.map((node) => ({
        type: node.type,
        name: node.name,
        description: node.description,
        subFlow: node.subFlow ? true : false,
        config: getConfigForModel(node.config),
        inputs: getHandleForModel(node.inputs),
        outputs: getHandleForModel(node.outputs)
      }))
    })
  })
  try {
    if (role === 'user') {
      messages.value.push({ message_id: messageId, role, content, tool_calls: '' })
    }
    messages.value.push({
      message_id: messageId,
      role: 'assistant',
      loading: true,
      content: '',
      reasoning_content: '',
      tool_calls: '',
      tool_calling: ''
    })
    const lastMessage = messages.value[messages.value.length - 1]
    scrollToBottom()
    const workflow = {
      nodes: flowStore.vueFlowRef.getNodes.map((node) => ({
        id: node.id,
        name: node.data.name,
        type: node.data.type,
        parentNode: node.parentNode,
        config: node.data.config,
        inputs: node.data.inputs,
        outputs: node.data.outputs
      })),
      edges: flowStore.vueFlowRef.getEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
        targetHandle: edge.targetHandle
      }))
    }
    chatStream = await createChatStream(
      {
        model,
        role,
        content,
        workflowId: props.workflowId,
        messageId,
        tools: JSON.stringify(tools),
        nodes: JSON.stringify(nodeForModel),
        workflow: JSON.stringify(workflow)
      },
      (msg) => {
        // console.log('chat msg', msg)
        lastMessage.loading = false
        const delta = msg.choices[0].delta
        if (delta.reasoning_content) {
          lastMessage.reasoning_content += delta.reasoning_content || ''
        }
        if (delta.content) {
          lastMessage.content += delta.content || ''
        }
        if (delta.tool_calls) {
          lastMessage.tool_calling = 'loading'
          delta.tool_calls.forEach((toolDelta) => {
            const index = toolDelta.index // 多工具的索引（0、1、2...）
            // 初始化对应索引的工具缓存
            if (!toolCallsBuffer[index])
              toolCallsBuffer[index] = { id: '', function: { name: '', arguments: '' } }

            const currentTool = toolCallsBuffer[index]
            // 拼接 工具ID
            if (toolDelta.id) currentTool.id = toolDelta.id
            // 拼接 函数名
            if (toolDelta.function?.name) currentTool.function.name += toolDelta.function.name
            // 拼接 函数参数（碎片化JSON字符串，必须完整拼接后再解析）
            if (toolDelta.function?.arguments)
              currentTool.function.arguments += toolDelta.function.arguments
          })
        }
        scrollToBottom()
      },
      (err) => {
        console.error('chat error', err)
        loading.value = false
      },
      async (err) => {
        try {
          lastMessage.tool_calls = getFinalToolCalls(toolCallsBuffer)
          const callResults = []
          let isFinish = false
          for (const tool_call of lastMessage.tool_calls) {
            let result = ''
            try {
              if (tool_call.function.name === 'finish') {
                isFinish = true
              }
              result = await props.toolActions[tool_call.function.name](
                tool_call.function.arguments
              )
            } catch (error) {
              result = 'error: ' + error.message
            }
            callResults.push({
              tool_call_id: tool_call.id,
              content: result
            })
          }
          loading.value = false
          if (callResults.length > 0 && !isFinish) {
            toolCallsBuffer.length = 0
            handleSend({
              id: messageId,
              model,
              role: 'tool',
              content: JSON.stringify(callResults)
            })
          }
        } catch (err) {
          console.error('搭建失败:', err)
          loading.value = false
          lastMessage.content = '搭建失败，请重试！'
        } finally {
          lastMessage.loading = false
          lastMessage.tool_calling = ''
        }
      }
    )
    await chatStream.start()
  } catch (error) {
    loading.value = false
    lastMessage.content = '调用AI模型失败，请重试！'
    lastMessage.loading = false
    lastMessage.tool_calling = ''
    console.error('调用AI模型失败:', error)
  }
}
</script>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  width: 500px;
  .chat__title {
    font-size: 16px;
    font-weight: bold;
    color: #333;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .chat__empty {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 500px;
  }
  .chat__sender {
    margin-top: 12px;
  }
}
</style>
