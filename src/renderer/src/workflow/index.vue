/** * @file: 工作流编辑器页面 * @author: dabao * @date: 2024-03-15 */
<template>
  <div
    tabindex="0"
    class="workflow-page"
    :class="{ 'show-editor': showEditor }"
    @mouseenter="isFocus = true"
    @mouseleave="isFocus = false"
  >
    <FlowCanvas ref="flowRef" />
    <FlowToolbar @toggleChat="toggleChat" />
    <div
      class="chat-container"
      @mouseenter="aiBotFocus = true"
      @mouseleave="aiBotFocus = false"
      :style="{ right: aiBotVisible ? '20px' : '-550px' }"
    >
      <chat :workflowId="workflowId" @close="aiBotVisible = false" :toolActions="toolActions" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, provide, inject } from 'vue'
import FlowCanvas from './components/FlowCanvas.vue'
import FlowToolbar from './components/FlowToolbar.vue'
import chat from './components/aiBot/chat.vue'
import { storeToRefs } from 'pinia'
import { useFlowStore } from './store'
import { useStore } from '@/store'
import { autoLayout, getInitNodeData, ConnectionRules } from '@/workflow/utils'
import { getShortcuts, findMatch, onChanged } from '@/utils/shortcut'
import { getActions } from './components/aiBot/functionCalling.js'
const props = defineProps({
  workflowId: {
    type: [String, Number],
    required: true
  },
  showEditor: {
    type: Boolean,
    default: true
  },
  visible: {
    type: Boolean,
    default: true
  }
})
provide('workflowId', props.workflowId)
const { validateConnection, createConnection } = new ConnectionRules(props.workflowId)
const flowRef = ref(null)
const flowStore = useFlowStore(props.workflowId)
const { isCtrl, isExecuting, vueFlowRef } = storeToRefs(flowStore)

const { clipboard, isMacOS } = storeToRefs(useStore())

const _isCtrlKey = (e) => (isMacOS.value ? e.metaKey : e.ctrlKey)

const handleKeyUp = async (event) => {
  if (event.key === 't') {
    console.log(vueFlowRef.value.getNodes, await toolActions.addEdge({
        source: 'node-e040cbee-317b-4c10-a9d9-f1cf1a55cc37',
        sourceHandle: 'next',
        target: 'node-13103dcd-9d37-4d7a-af78-40421b4729c2',
        targetHandle: 'prev'
      }))
  }
  const isCtrlKey = _isCtrlKey(event)
  isCtrl.value = isCtrlKey
}

// 处理键盘事件,只执行一次
// 快捷键配置（运行时从 store 加载）
const inAppShortcuts = ref([])

/** 加载快捷键配置 */
const loadShortcuts = () => {
  inAppShortcuts.value = getShortcuts()
}
loadShortcuts()

/** 快捷键变更时重载 */
let removeOnChanged = null
onMounted(() => {
  removeOnChanged = onChanged(loadShortcuts)
})

const handleKeyDownOnce = async (event) => {
  isCtrl.value = _isCtrlKey(event)

  // 匹配应用内快捷键
  const matchId = findMatch(event, inAppShortcuts.value)

  // 如果正在执行,则不处理画布快捷键
  if (isExecuting.value) {
    if (matchId === 'workflow.stop') {
      flowStore.engine.stop()
    }
    return
  }

  if (!matchId) return

  switch (matchId) {
    case 'workflow.save':
      flowStore.saveWorkflow()
      event.preventDefault()
      break
    case 'workflow.run':
      !isExecuting.value && flowStore.engine.start()
      event.preventDefault()
      break
    case 'canvas.copy':
      flowRef.value?.handleNodeCopy(vueFlowRef.value, clipboard)
      event.preventDefault()
      break
    case 'canvas.cut':
      flowRef.value?.handleNodeCopy(vueFlowRef.value, clipboard)
      flowRef.value?.handleNodeDelete([...vueFlowRef.value.getSelectedNodes, ...vueFlowRef.value.getSelectedEdges])
      event.preventDefault()
      break
    case 'canvas.paste':
      flowRef.value?.handleNodePaste(vueFlowRef.value, clipboard.value, flowRef.value?.isOverNodeLimit)
      event.preventDefault()
      break
    case 'canvas.autoLayout':
      autoLayout(vueFlowRef.value)
      event.preventDefault()
      break
    case 'canvas.fitView':
      vueFlowRef.value.fitView({ padding: 0.05, includeHiddenNodes: false, maxZoom: 1 })
      event.preventDefault()
      break
  }
}

// 处理键盘事件,支持重复执行（缩放、删除）
const handleKeyDown = async (event) => {
  isCtrl.value = _isCtrlKey(event)

  const matchId = findMatch(event, inAppShortcuts.value)

  // 如果正在执行,则不处理画布快捷键
  if (isExecuting.value) return

  if (!matchId) return

  switch (matchId) {
    case 'canvas.zoomIn':
      vueFlowRef.value.zoomIn()
      break
    case 'canvas.zoomOut':
      vueFlowRef.value.zoomOut()
      break
    case 'canvas.delete':
      flowRef.value?.handleNodeDelete([...vueFlowRef.value.getSelectedNodes, ...vueFlowRef.value.getSelectedEdges])
      event.preventDefault()
      break
    case 'canvas.undo':
      flowStore.undo()
      event.preventDefault()
      break
    case 'canvas.redo':
      flowStore.redo()
      event.preventDefault()
      break
    case 'canvas.selectAll':
      vueFlowRef.value.nodes.forEach((node) => {
        if (node.selectable !== false) node.selected = true
      })
      event.preventDefault()
      break
  }
}

const addKeyDownEventListener = inject('keyDownEventListener')
const addKeyUpEventListener = inject('keyUpEventListener')

const isFocus = ref(false)
provide('isFocus', isFocus)

// 注册键盘事件监听
const removeKeyDownEventListener = addKeyDownEventListener((e) => {
  if (props.visible && isFocus.value && !aiBotFocus.value) {
    handleKeyDown(e)
    if (!e.repeat) {
      handleKeyDownOnce(e)
    }
  }
}, props.workflowId)

// 注册键盘事件监听
const removeKeyUpEventListener = addKeyUpEventListener((e) => {
  if (props.visible && isFocus.value && !aiBotFocus.value) {
    handleKeyUp(e)
  }
}, props.workflowId)

// 组件卸载时清理
onUnmounted(() => {
  try {
    flowRef.value?.handleStop()
    removeKeyDownEventListener()
    removeKeyUpEventListener()
    removeOnChanged?.()
  } catch (e) {
    console.log(e)
  }
})

const aiBotVisible = ref(false)
const aiBotFocus = ref(false)
const toggleChat = () => {
  aiBotVisible.value = !aiBotVisible.value
}

const toolActions = getActions(vueFlowRef, flowRef, props.workflowId)
// const handleToolCalls = {
//   addNodes: async ({ nodes }) => {
//     if (!nodes) {
//       throw new Error('nodes is required')
//     }
//     const newNodes = []
//     for (const node of nodes.filter((node) => node.type !== 'startNode')) {
//       let initNodeData = getInitNodeData(node.type)
//       if (initNodeData) {
//         initNodeData = JSON.parse(initNodeData)
//         initNodeData.name = node.name
//         initNodeData.parentNode = node.parentNode
//         for (const key in initNodeData.config) {
//           if (node.config[key]) {
//             initNodeData.config[key] = node.config[key]
//           }
//         }
//         const newNode = await flowRef.value.addNode(initNodeData, { x: 0, y: 0 })
//         newNodes.push(newNode)
//       }
//     }
//     autoLayout(vueFlowRef.value)
//     return newNodes.map((node) => ({
//       id: node.id,
//       name: node.name,
//       config: node.data.config
//     }))
//   },
//   editNodes: async ({ nodes }) => {
//     if (!nodes) {
//       throw new Error('nodes is required')
//     }
//     const editNodes = []
//     for (const node of nodes) {
//       try {
//         const n = vueFlowRef.value.getNode(node.id)
//         n.data.name = node.name
//         n.parentNode = node.parentNode
//         for (const key in n.data.config) {
//           if (node.config[key]) {
//             n.data.config[key] = node.config[key]
//           }
//         }
//         editNodes.push({
//           id: node.id,
//           status: 'success'
//         })
//       } catch (e) {
//         editNodes.push({
//           id: node.id,
//           status: 'error'
//         })
//       }
//     }
//     autoLayout(vueFlowRef.value)
//     console.log(editNodes)

//     return editNodes
//   },
//   deleteNodes: async ({ nodes }) => {
//     if (!nodes) {
//       throw new Error('nodes is required')
//     }
//     const nodeIds = nodes.map((node) => node.id)
//     await vueFlowRef.value.removeNodes(nodeIds, true, true)
//     autoLayout(vueFlowRef.value)
//     return nodeIds
//   },
//   addEdges: async ({ edges }) => {
//     if (!edges) {
//       throw new Error('edges is required')
//     }
//     const newEdges = []
//     for (const edge of edges) {
//       const newEdge = {
//         source: edge.source,
//         target: edge.target,
//         sourceHandle: edge.sourceHandle,
//         targetHandle: edge.targetHandle
//       }
//       if (validateConnection(newEdge)) {
//         newEdges.push(createConnection(newEdge))
//       } else {
//         newEdges.push({
//           id: 'invalid',
//           source: edge.source,
//           target: edge.target,
//           sourceHandle: edge.sourceHandle,
//           targetHandle: edge.targetHandle,
//           status: `Invalid connection: ${edge.source} -> ${edge.target}`
//         })
//       }
//     }
//     vueFlowRef.value.addEdges(newEdges.filter((edge) => edge.id !== 'invalid'))
//     autoLayout(vueFlowRef.value)
//     return newEdges.map((edge) => ({
//       id: edge.id,
//       source: edge.source,
//       target: edge.target,
//       sourceHandle: edge.sourceHandle,
//       targetHandle: edge.targetHandle,
//       status: edge.status || 'success'
//     }))
//   },
//   deleteEdges: async ({ edges }) => {
//     if (!edges) {
//       throw new Error('edges is required')
//     }
//     const edgeIds = edges.map((edge) => edge.id)
//     await vueFlowRef.value.removeEdges(edgeIds)
//     autoLayout(vueFlowRef.value)
//     return edgeIds
//   },
//   validateWorkflow: async () => {
//     const flowData = flowStore.engine.getFlowData()
//     const configErrors = await flowStore.engine.validateNodeConfig()
//     const noConnectedNodes = flowStore.engine.getUnconnectedNodes(flowData)
//     const inputsErrors = flowStore.engine.validateNodeInputs(flowData)
//     const paramReferErrors = flowStore.engine.replaceParamRefer(flowData)
//     return {
//       configErrors,
//       inputsErrors,
//       paramReferErrors,
//       noConnectedNodes
//     }
//   }
// }
</script>

<style lang="less" scoped>
.workflow-page {
  position: relative;
  width: 100%;
  height: 100%;
  display: none;
  &.show-editor {
    display: block;
  }
}

.chat-container {
  position: absolute;
  bottom: 80px;
  z-index: 1000;
  background: #fff;
  padding: 12px 16px;
  transition: all 0.3s ease-in-out;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border-radius: var(--border-radius-small);
}

.ai-assistant-btn {
  position: fixed;
  bottom: 20px;
  left: 20px;
  height: 80px;
  width: 80px;
}
</style>
