/**
 * @file: 流程图画布组件
 */
<template>
  <a-spin style="width: 100%; height: calc(100% - 10px)" :loading="loading" tip="加载中...">
    <div
      class="flow-canvas"
      :class="{ 'is-box-selecting': boxSelecting }"
      tabindex="0"
      @pointerdown.capture="onCanvasPointerDown"
      @contextmenu="onCanvasContextMenu"
    >
      <div v-if="isDragging" class="drag-prompt" :class="{ 'is-ctrl': isCtrl }">
        拖拽节点时按住 <b>{{ platform === 'darwin' ? 'Cmd' : 'Ctrl' }}</b> 键可以穿透子流程
      </div>
      <VueFlow
        :id="workflowId"
        :default-viewport="{ zoom: 1 }"
        :min-zoom="0.1"
        :max-zoom="5"
        :snap-to-grid="true"
        :snap-grid="[5, 5]"
        :validate-connection="validateConnection"
        :delete-key-code="null"
        :zoom-on-double-click="false"
        elevate-edges-on-select
        :select-nodes-on-drag="false"
        :selection-key-code="null"
        :multi-selection-key-code="['Meta', 'Shift']"
        connectionMode="strict"
        :connect-on-click="false"
        noDragClassName="no-drag"
        noWheelClassName="no-wheel"
        noPanClassName="no-pan"
        :connection-radius="50"
        @dragover="onDragOver"
        @drop="onDrop"
        @connect-start="onConnectStart"
        @connect-end="onConnectEnd"
        @connect="onConnect"
        @nodesChange="handleNodesChange"
        @edgesChange="handleNodesChange"
        @nodeClick="handleNodeClick"
        @paneClick="clearClickedNode"
        @nodeDragStart="((isDragging = true), dispatchMouseDown())"
        @nodeDrag="onNodeDrag"
        @nodeDragStop="onNodeDragStop"
        @edgeMouseEnter="edgeMouseEnter"
        @edgeMouseLeave="edgeMouseLeave"
        @paneMouseEnter="edgeMouseLeave"
        @pane-ready="onPaneReadyHandler"
        @edgeDoubleClick="edgeDoubleClick"
        @wheel="onCanvasWheel"
        @click="dispatchMouseDown"
        @moveStart="dispatchMouseDown"
        :zoom-on-scroll="false"
        :nodesDraggable="!isExecuting"
        ref="vueFlowRef"
      >
        <template #connection-line="customConnectionLineProps">
          <CustomConnectionLine v-bind="customConnectionLineProps" />
        </template>
        <template #edge-custom="customEdgeProps">
          <CustomEdge
            v-bind="customEdgeProps"
            :hover-edge-id="hoverEdgeId"
            :node-list-visible="nodeListVisible"
            @addNodeFromEdge="addNodeFromEdge"
            @showQuickConnect="showQuickConnect"
          />
        </template>
        <template #node-custom="nodeProps">
          <CustomNode
            :id="nodeProps.id"
            :data="nodeProps.data"
            :selected="nodeProps.selected"
            @action="handleNodeAction"
            @addNode="addNodeFromNode"
            @showQuickConnect="showQuickConnect"
          />
        </template>
        <template #node-subFlow="nodeProps">
          <SubFlowNode
            :id="nodeProps.id"
            :data="nodeProps.data"
            :selected="nodeProps.selected"
            @addNodeToSubFlow="addNodeToSubFlow"
            @addNode="addNodeFromNode"
            @showQuickConnect="showQuickConnect"
          />
        </template>

        <template #node-comment="nodeProps">
          <CommentNode :id="nodeProps.id" :data="nodeProps.data" :selected="nodeProps.selected" />
        </template>
        <Background pattern-color="rgba(60, 60, 67, 0.18)" gap="22" />
        <MiniMap />
      </VueFlow>

      <!-- 右键框选矩形 -->
      <div v-if="selectionRect" class="box-selection" :style="selectionRectStyle" />

      <div :style="quickConnectStyle">
        <ModalPopover position="right" v-model:visible="nodeListVisible">
          <template #content>
            <NodeList
              trigger="click"
              :type="quickConnect.edgeId ? 'insert' : 'add'"
              @chooseNode="quickConnectChooseNode"
            />
          </template>
        </ModalPopover>
      </div>

      <!-- 节点配置抽屉 -->
      <NodeConfigDrawer
        :key="selectedNodeId || '__empty__'"
        :visible="configDrawerVisible"
        :node-id="selectedNodeId"
        :node-data="selectedNodeData"
        :all-config-fields-with-group="selectedNodeConfigFields"
      />
    </div>

  </a-spin>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, provide, inject, nextTick } from 'vue'
import { VueFlow, getNodesInside } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { useFlowStore } from '../store'
import { useStore } from '@/store'
import ModalPopover from './ModalPopover.vue'
import NodeList from './NodeList.vue'
import CustomNode from './custom/CustomNode.vue'
import SubFlowNode from './custom/SubFlowNode.vue'
import CommentNode from './custom/CommentNode.vue'
import CustomEdge from './custom/CustomEdge.vue'
import CustomConnectionLine from './custom/CustomConnectionLine.vue'
import NodeConfigDrawer from './NodeConfigDrawer.vue'
import { storeToRefs } from 'pinia'
import {
  ConnectionRules,
  autoConnect,
  handleNodeCopy,
  handleNodePaste,
  handleWheel,
  dispatchMouseDown
} from '../utils'
import { useNodeSelection } from '../composables/useNodeSelection.js'
import { useNodeCrud } from '../composables/useNodeCrud.js'
import { useNodeDragDrop } from '../composables/useNodeDragDrop.js'
// 工作流ID
const workflowId = inject('workflowId')
const { workflow: workflowAPI } = window.electronAPI
// 工作流store
const flowStore = useFlowStore(workflowId)
// 用户store
const { platform } = useStore()
// 剪贴板
const { clipboard } = storeToRefs(useStore())
// 工作流store的元素
const { initialized, isExecuting, vueFlowRef, engine, isDragging, IntersectingNode, isCtrl } =
  storeToRefs(flowStore)
const { saveHistory } = flowStore
provide('isExecuting', isExecuting)
//关闭预览模式
provide('isPreview', ref(false))

// 画布滚轮（缩放/平移）：handleWheel 按 vueFlowRef.value 访问实例，
// 模板中 ref 已自动解包（传出去是实例），故在此包装传入 script 作用域的 ref
const onCanvasWheel = (e) => handleWheel(e, vueFlowRef)

// ── 选中节点追踪与配置字段（提取至 useNodeSelection） ───────
const {
  handleNodesChange,
  handleNodeClick,
  clearClickedNode,
  configDrawerVisible,
  selectedNodeId,
  selectedNodeData,
  selectedNodeConfigFields
} = useNodeSelection(flowStore, vueFlowRef)
// 连线规则
const { validateConnection, createConnection } = new ConnectionRules(workflowId)

// ── 节点增删改查与剪贴板（提取至 useNodeCrud） ───────
const { addStartNode, addNode, handleNodeAction, handleNodeDelete } = useNodeCrud({
  vueFlowRef,
  isExecuting,
  clipboard,
  createConnection
})

// ── 节点拖拽归属与快速连接（提取至 useNodeDragDrop） ───────
const {
  onNodeDrag,
  onNodeDragStop,
  onDragOver,
  addNodeToSubFlow,
  addNodeFromEdge,
  addNodeFromNode,
  nodeListVisible,
  quickConnectStyle,
  quickConnect,
  showQuickConnect,
  quickConnectChooseNode
} = useNodeDragDrop({
  vueFlowRef,
  isCtrl,
  isDragging,
  IntersectingNode,
  isExecuting,
  addNode,
  createConnection
})

// 悬停边ID
const hoverEdgeId = ref(null)
const edgeMouseEnter = ({ edge }) => {
  hoverEdgeId.value = edge.id
}
const edgeMouseLeave = () => {
  hoverEdgeId.value = null
}

// 处理边双击
const edgeDoubleClick = ({ edge }) => {
  //删除边
  vueFlowRef.value.removeEdges(edge.id)
}

// ── 右键框选（原先为 Shift/Cmd + 左键框选，现改为鼠标右键按下即框选） ─────
const boxSelecting = ref(false)
const selectionRect = ref(null)
/** 起点（canvas 坐标用于画矩形，pane 坐标用于命中判定） */
let boxSelectOrigin = null
let boxSelectBounds = null
let boxSelectPane = null
let boxSelectPointerId = null
let lastBoxSelectedIds = ''

const selectionRectStyle = computed(() => {
  const rect = selectionRect.value
  if (!rect) return {}
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  }
})

/** 仅从空白画布区域起框：节点、边、小地图等不触发 */
const onCanvasPointerDown = (event) => {
  if (event.button !== 2) return
  const target = event.target
  if (!(target instanceof Element) || !target.closest('.vue-flow__pane')) return
  if (
    target.closest('.vue-flow__node, .vue-flow__edge, .vue-flow__handle, .vue-flow__nodesselection')
  ) {
    return
  }
  // 阻止原生拖拽选中文本与后续的 d3 平移/系统右键菜单
  event.preventDefault()
  event.stopPropagation()

  const canvasRect = event.currentTarget.getBoundingClientRect()
  const paneEl = target.closest('.vue-flow__pane')
  const paneRect = paneEl.getBoundingClientRect()
  boxSelectBounds = { canvasRect, paneRect }
  boxSelectOrigin = {
    canvas: { x: event.clientX - canvasRect.left, y: event.clientY - canvasRect.top },
    pane: { x: event.clientX - paneRect.left, y: event.clientY - paneRect.top }
  }
  lastBoxSelectedIds = ''
  boxSelecting.value = true
  boxSelectPane = paneEl
  boxSelectPointerId = event.pointerId
  // 锁定指针：拖出窗口后仍能收到 pointermove/pointerup
  paneEl.setPointerCapture?.(event.pointerId)
  selectionRect.value = {
    left: boxSelectOrigin.canvas.x,
    top: boxSelectOrigin.canvas.y,
    width: 0,
    height: 0
  }

  window.addEventListener('pointermove', onBoxSelectMove)
  window.addEventListener('pointerup', onBoxSelectEnd)
  window.addEventListener('pointercancel', onBoxSelectEnd)
}

const onBoxSelectMove = (event) => {
  if (!boxSelecting.value || !boxSelectOrigin || !boxSelectBounds) return
  const { canvasRect, paneRect } = boxSelectBounds
  const canvasPoint = {
    x: event.clientX - canvasRect.left,
    y: event.clientY - canvasRect.top
  }
  const panePoint = {
    x: event.clientX - paneRect.left,
    y: event.clientY - paneRect.top
  }

  selectionRect.value = {
    left: Math.min(boxSelectOrigin.canvas.x, canvasPoint.x),
    top: Math.min(boxSelectOrigin.canvas.y, canvasPoint.y),
    width: Math.abs(canvasPoint.x - boxSelectOrigin.canvas.x),
    height: Math.abs(canvasPoint.y - boxSelectOrigin.canvas.y)
  }

  const flow = vueFlowRef.value
  if (!flow) return
  // 命中判定复用 Vue Flow 的实现（需完全框住节点，视口缩放已折算）
  const nodes = getNodesInside(
    flow.getNodes,
    {
      x: Math.min(boxSelectOrigin.pane.x, panePoint.x),
      y: Math.min(boxSelectOrigin.pane.y, panePoint.y),
      width: Math.abs(panePoint.x - boxSelectOrigin.pane.x),
      height: Math.abs(panePoint.y - boxSelectOrigin.pane.y)
    },
    flow.viewport,
    false,
    true
  )
  const ids = nodes.map((node) => node.id).join('|')
  if (ids === lastBoxSelectedIds) return
  lastBoxSelectedIds = ids
  flow.addSelectedNodes(nodes)
}

const onBoxSelectEnd = (event) => {
  if (!boxSelecting.value) return
  window.removeEventListener('pointermove', onBoxSelectMove)
  window.removeEventListener('pointerup', onBoxSelectEnd)
  window.removeEventListener('pointercancel', onBoxSelectEnd)
  if (boxSelectPane?.hasPointerCapture?.(boxSelectPointerId)) {
    boxSelectPane.releasePointerCapture(boxSelectPointerId)
  }

  const moved =
    selectionRect.value && (selectionRect.value.width > 3 || selectionRect.value.height > 3)
  if (event.type === 'pointerup' && moved) onBoxSelectMove(event)
  // 未拖动视为在空白处单击右键：清空选中
  if (!moved) {
    clearClickedNode()
    vueFlowRef.value?.addSelectedNodes([])
  }
  boxSelecting.value = false
  selectionRect.value = null
  boxSelectOrigin = null
  boxSelectBounds = null
  boxSelectPane = null
  boxSelectPointerId = null
  lastBoxSelectedIds = ''
}

/** 屏蔽画布区域的原生右键菜单（配置抽屉内保留，便于输入框粘贴） */
const onCanvasContextMenu = (event) => {
  if (event.target instanceof Element && event.target.closest('.node-config-drawer')) return
  event.preventDefault()
}

// 处理节点拖放
const onDrop = async (event) => {
  if (!event.dataTransfer.getData('node')) {
    return
  }
  const nodeData = JSON.parse(event.dataTransfer.getData('node'))
  const { clientX, clientY } = event
  // 获取节点位置
  let position = vueFlowRef.value.screenToFlowCoordinate({
    x: clientX,
    y: clientY
  })
  const newNode = await addNode(nodeData, position)
  if (newNode) {
    await nextTick()
    autoConnect(vueFlowRef.value, createConnection, null, newNode)
  }
}

const loading = ref(true)

let paneReadyHandled = false

/** 画布就绪后加载工作流图（只执行一次） */
const onPaneReadyHandler = async () => {
  if (paneReadyHandled) return
  paneReadyHandled = true
  const result = await workflowAPI.getWorkflow(workflowId)
  if (result && result.graph) {
    let elements
    try { elements = typeof result.graph === 'string' ? JSON.parse(result.graph) : result.graph } catch { elements = result.graph }
    result.elements = elements
  }

  const { off: offNodesInitialized } = vueFlowRef.value.onNodesInitialized(() => {
    offNodesInitialized()
    setTimeout(() => {
      vueFlowRef.value.fitView({
        padding: 0.05,
        includeHiddenNodes: false,
        maxZoom: 1
      })
      initialized.value = true
      loading.value = false
      setTimeout(() => {
        saveHistory()
      }, 10)
    }, 10)
  })
  // 删除节点style 保持自动调整大小
  if (result.elements && result.elements.nodes.length > 0) {
    vueFlowRef.value.fromObject(result.elements)
    // 兼容旧工作流：确保所有节点都有 version 字段，缺失时默认 V1
    nextTick(() => {
      const nodes = vueFlowRef.value.getNodes
      nodes.forEach((node) => {
        if (!node.data.version) {
          node.data.version = 'V1'
        }
      })
    })
  } else {
    addStartNode()
  }
}

onMounted(async () => {
  await nextTick()
  // 兜底：paneReady 事件可能早于本回调注册（Vue Flow 用 1ms 定时器派发，主线程繁忙时会错过）
  vueFlowRef.value.onPaneReady(onPaneReadyHandler)
})


// 待连接的节点
const pendingConnection = ref(null)
provide('pendingConnection', pendingConnection)

// 处理连线开始
const onConnectStart = (connection) => {
  pendingConnection.value = connection
}
let isConnect = false
// 处理连线
const onConnect = (connection) => {
  isConnect = true
  const newEdge = createConnection(connection)
  vueFlowRef.value.addEdges([newEdge])
}

// 处理连线结束
const onConnectEnd = (e) => {
  if (!isConnect && ['next', 'next-false'].includes(pendingConnection.value.handleId)) {
    const sourceNode = pendingConnection.value
    const mousePosition = vueFlowRef.value.screenToFlowCoordinate({
      x: e.clientX + 150,
      y: e.clientY - 20
    })
    showQuickConnect({
      e: {
        clientX: e.clientX,
        clientY: e.clientY
      },
      handleId: sourceNode.handleId,
      nodeId: sourceNode.nodeId,
      position: mousePosition
    })
  }
  isConnect = false
  pendingConnection.value = null
}

defineExpose({
  addNode,
  handleNodeCopy,
  handleNodePaste,
  handleNodeDelete
})

// 组件卸载时清理
onUnmounted(() => {
  window.removeEventListener('pointermove', onBoxSelectMove)
  window.removeEventListener('pointerup', onBoxSelectEnd)
  window.removeEventListener('pointercancel', onBoxSelectEnd)
  if (engine.value) {
    engine.value.cleanup()
  }
})
// 提供给子组件的方法
provide('engine', engine)
</script>

<style lang="less" scoped>
.flow-canvas {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  outline: none; // 移除焦点轮廓
  background:
    radial-gradient(1100px 640px at 50% -10%, rgba(255, 255, 255, 0.5), transparent 60%),
    linear-gradient(180deg, #f1f1f4 0%, #e8e8ec 100%);
  .drag-prompt {
    position: absolute;
    top: 20px;
    left: 50%;
    width: auto;
    transform: translateX(-50%);
    height: auto;
    padding: 8px 16px;
    background: var(--color-danger-light-1);
    border: 1px solid var(--color-danger-light-4);
    border-radius: var(--border-radius-small);
    z-index: 9999999;
    &.is-ctrl {
      background: var(--color-success-light-1);
      border: 1px solid var(--color-success-light-4);
    }
  }
  .vue-flow {
    width: 100%;
    height: 100%;
  }

  /* 右键框选进行中：指针变为十字，框选用绝对定位矩形绘制 */
  &.is-box-selecting {
    cursor: crosshair;

    :deep(.vue-flow__pane),
    :deep(.vue-flow__node),
    :deep(.vue-flow__edge) {
      cursor: crosshair;
    }
  }

  .box-selection {
    position: absolute;
    z-index: 5;
    border: 1px dashed var(--mac-accent);
    background: rgb(29 29 31 / 8%);
    border-radius: 2px;
    pointer-events: none;
  }

  :deep(.vue-flow__minimap) {
    bottom: 20px;
    right: 20px;
    transition: right 0.3s ease;

    &.shift-left {
      right: 320px; // 300px面板宽度 + 20px间距
    }
  }

  :deep(.vue-flow__edges:has(.selected)) {
    z-index: 100 !important;
  }
}
</style>
