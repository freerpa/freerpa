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
    <FlowToolbar
      @toggleChat="toggleChat"
      @toggleBatch="toggleBatch"
      :chat-loading="aiLoading"
    />
    <div
      class="chat-container"
      @mouseenter="aiFocus = true"
      @mouseleave="aiFocus = false"
      :style="{ right: aiVisible ? '20px' : '-740px' }"
    >
      <ChatPanel
        :workflowId="workflowId"
        :visible="aiVisible"
        @close="aiVisible = false"
        @loading-change="aiLoading = $event"
      />
    </div>
    <!-- 批量执行实例列表：与 AI 面板互斥；面板不持有实例生命周期（不停止/不销毁） -->
    <div
      class="batch-container"
      @mouseenter="batchFocus = true"
      @mouseleave="batchFocus = false"
      :style="{ right: batchVisible ? '20px' : '-480px' }"
    >
      <BatchPanel :workflowId="workflowId" @close="batchVisible = false" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, provide, inject } from 'vue'
import FlowCanvas from './components/FlowCanvas.vue'
import FlowToolbar from './components/FlowToolbar.vue'
import BatchPanel from './components/BatchPanel.vue'
import ChatPanel from '@/ai/ChatPanel.vue'
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

  // 如果正在执行,则仅放行画布内的停止与保存，其它快捷键不处理
  if (isExecuting.value) {
    if (matchId === 'workflow.stop') {
      flowStore.engine.stop()
    } else if (matchId === 'workflow.save') {
      flowStore.saveWorkflow()
      event.preventDefault()
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
      flowRef.value?.handleNodePaste(vueFlowRef.value, clipboard.value)
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
  if (props.visible && isFocus.value && !aiFocus.value && !batchFocus.value) {
    handleKeyDown(e)
    if (!e.repeat) {
      handleKeyDownOnce(e)
    }
  }
}, props.workflowId)

// 注册键盘事件监听
const removeKeyUpEventListener = addKeyUpEventListener((e) => {
  if (props.visible && isFocus.value && !aiFocus.value && !batchFocus.value) {
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
// AI 会话进行中状态（ChatPanel 实时上报），驱动工具栏 AI 助手图标
const aiLoading = ref(false)
const toggleChat = () => {
  aiVisible.value = !aiVisible.value
  if (aiVisible.value) batchVisible.value = false // 与批量面板互斥
}

// 批量执行实例列表（数据在模块级 BatchRunner 中，面板关闭不影响实例运行）
const batchVisible = ref(false)
const batchFocus = ref(false)
const toggleBatch = () => {
  batchVisible.value = !batchVisible.value
  if (batchVisible.value) aiVisible.value = false // 与 AI 面板互斥
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
  box-shadow: var(--mac-shadow-3);
  border-radius: var(--mac-radius-lg);
}

.batch-container {
  position: absolute;
  bottom: 80px;
  height: calc(100vh - 150px);
  z-index: 1000;
  overflow: hidden;
  transition: right 0.3s ease-in-out;
  background: rgba(250, 250, 252, 0.6);
  -webkit-backdrop-filter: saturate(180%) blur(30px);
  backdrop-filter: saturate(180%) blur(30px);
  border: 0.5px solid rgba(255, 255, 255, 0.7);
  box-shadow: var(--mac-shadow-3);
  border-radius: var(--mac-radius-lg);
}

.ai-assistant-btn {
  position: fixed;
  bottom: 20px;
  left: 20px;
  height: 80px;
  width: 80px;
}
</style>
