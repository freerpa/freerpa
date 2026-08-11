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
      @mouseenter="aiFocus = true"
      @mouseleave="aiFocus = false"
      :style="{ right: aiVisible ? '20px' : '-740px' }"
    >
      <chat
        :workflowId="workflowId"
        :visible="aiVisible"
        @close="aiVisible = false"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, provide, inject } from 'vue'
import FlowCanvas from './components/FlowCanvas.vue'
import FlowToolbar from './components/FlowToolbar.vue'
import chat from '@/ai/chat.vue'
import { storeToRefs } from 'pinia'
import { useFlowStore } from './store'
import { useStore } from '@/store'
import { autoLayout } from '@/workflow/utils'
import { getShortcuts, findMatch, onChanged } from '@/utils/shortcut'
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
const flowRef = ref(null)
const flowStore = useFlowStore(props.workflowId)
const { isCtrl, isExecuting, vueFlowRef } = storeToRefs(flowStore)

const { clipboard, isMacOS } = storeToRefs(useStore())

const _isCtrlKey = (e) => (isMacOS.value ? e.metaKey : e.ctrlKey)

const handleKeyUp = async (event) => {
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
  if (props.visible && isFocus.value && !aiFocus.value) {
    handleKeyDown(e)
    if (!e.repeat) {
      handleKeyDownOnce(e)
    }
  }
}, props.workflowId)

// 注册键盘事件监听
const removeKeyUpEventListener = addKeyUpEventListener((e) => {
  if (props.visible && isFocus.value && !aiFocus.value) {
    handleKeyUp(e)
  }
}, props.workflowId)

// 组件卸载时清理
onUnmounted(() => {
  try {
    // 引擎/浏览器清理由 FlowCanvas onUnmounted 的 engine.cleanup() 负责
    removeKeyDownEventListener()
    removeKeyUpEventListener()
    removeOnChanged?.()
  } catch {
    // 卸载清理失败不影响组件销毁
  }
})

const aiVisible = ref(false)
const aiFocus = ref(false)
const toggleChat = () => {
  aiVisible.value = !aiVisible.value
}
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
  height: calc(100vh - 150px);
  z-index: 1000;
  overflow: hidden;
  transition: right 0.3s ease-in-out;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
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
