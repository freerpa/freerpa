/** * @file: 流程图画布组件 * @author: dabao * @date: 2024-03-15 */
<template>
  <a-spin style="width: 100%; height: calc(100% - 10px)" :loading="loading" tip="加载中...">
    <div class="flow-canvas" tabindex="0">
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
        :selection-key-code="['Meta', 'Shift']"
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
        @nodeDragStart="((isDragging = true), dispatchMouseDown())"
        @nodeDrag="onNodeDrag"
        @nodeDragStop="onNodeDragStop"
        @edgeMouseEnter="edgeMouseEnter"
        @edgeMouseLeave="edgeMouseLeave"
        @paneMouseEnter="edgeMouseLeave"
        @edgeDoubleClick="edgeDoubleClick"
        @wheel="handleWheel"
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
        <Background pattern-color="#aaa" gap="20" />
        <MiniMap />
      </VueFlow>

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
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { useFlowStore } from '../store'
import { useStore } from '@/store'
import { Message } from '@arco-design/web-vue'
import ModalPopover from './ModalPopover.vue'
import NodeList from './NodeList.vue'
import CustomNode from './custom/CustomNode.vue'
import SubFlowNode from './custom/SubFlowNode.vue'
import CommentNode from './custom/CommentNode.vue'
import CustomEdge from './custom/CustomEdge.vue'
import CustomConnectionLine from './custom/CustomConnectionLine.vue'
import NodeConfigDrawer from './NodeConfigDrawer.vue'
import { v4 as uuidv4 } from 'uuid'
import { storeToRefs } from 'pinia'
import nodes from '@nodes-path'
import {
  ConnectionRules,
  autoConnect,
  getNodeName,
  handleNodeCopy,
  handleNodePaste,
  getFlowCoordinate,
  getRelativeCoordinate,
  locateNode,
  decryptedData,
  getInitNodeData,
  getValidNodesCount,
  rebuildElementIds,
  adjustParentSize,
  isTouchpadEvent,
  getAllSuccessorNodes,
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

// ── 选中节点追踪与配置字段（提取至 useNodeSelection） ───────
const {
  handleNodesChange,
  configDrawerVisible,
  selectedNodeId,
  selectedNodeData,
  selectedNodeConfigFields
} = useNodeSelection(flowStore, vueFlowRef)
// 连线规则
const { validateConnection, createConnection } = new ConnectionRules(workflowId)

// ── 节点增删改查与剪贴板（提取至 useNodeCrud） ───────
const { addStartNode, addNode, addSubFlowNode, handleNodeAction, handleNodeDelete, isOverNodeLimit } = useNodeCrud({
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

onMounted(async () => {
  await nextTick()
  // 初始化工作流
  vueFlowRef.value.onPaneReady(async () => {
    const result = await workflowAPI.getWorkflow(workflowId)
    if (result && result.graph) {
      let elements
      try { elements = typeof result.graph === 'string' ? JSON.parse(result.graph) : result.graph } catch (e) { elements = result.graph }
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
  })
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
  handleNodeDelete,
  isOverNodeLimit
})

// 组件卸载时清理
onUnmounted(() => {
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
  background-color: #f2f3f5;
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
