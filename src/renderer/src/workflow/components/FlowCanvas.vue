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
import {
  IconFullscreen,
  IconSave,
  IconPlayCircle,
  IconPauseCircle,
  IconUndo,
  IconRedo
} from '@arco-design/web-vue/es/icon'
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
  getAllSuccessorNodes
} from '../utils'
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

// ── 选中节点追踪 ──────────────────────────────────
const selectedNodes = ref([])

/** 包装 store 的 onNodesChange，在节点增删或选择变化后同步选中状态 */
const handleNodesChange = (changes) => {
  flowStore.onNodesChange(changes)
  if (changes.length === 0) return
  const type = changes[0]?.type
  if (type === 'select' || type === 'remove' || type === 'add') {
    nextTick(() => {
      selectedNodes.value = vueFlowRef.value?.getSelectedNodes || []
    })
  }
}

/** 选中的自定义节点（排除 comment/subFlow 类型） */
const selectedCustomNodes = computed(() => {
  return selectedNodes.value.filter(
    (n) => n.type === 'custom' && n.data?.type
  )
})

/** 有且仅有一个可配置节点选中时才显示抽屉 */
const configDrawerVisible = computed(() => {
  if (selectedCustomNodes.value.length !== 1) return false
  const node = selectedCustomNodes.value[0]
  const def = nodes[node.data?.type]
  if (!def) return false
  // 检查是否有配置字段
  const groups = getNodeConfigFields(node.data?.type)
  return Object.keys(groups).length > 0
})

/** 缓存最后有效节点 ID — 确保关闭时 key 不变，让 Transition 正常触发 leave 动画 */
const _cachedNodeId = ref('')

/** 当前选中的节点 ID */
const selectedNodeId = computed(() => {
  const id = configDrawerVisible.value ? selectedCustomNodes.value[0]?.id : ''
  if (id) _cachedNodeId.value = id
  return id || _cachedNodeId.value
})

/** 当前选中节点的 data 对象 */
const selectedNodeData = computed(() => {
  return configDrawerVisible.value ? selectedCustomNodes.value[0]?.data : { config: {} }
})

/** 选中节点的配置字段分组 */
const selectedNodeConfigFields = computed(() => {
  if (!configDrawerVisible.value) return {}
  const nodeId = selectedCustomNodes.value[0]?.id
  const fields = getNodeConfigFields(selectedCustomNodes.value[0]?.data?.type)

  // 为 errorHandleSpecifyNode 注入可用的 remoteMethod
  if (fields['执行配置']) {
    const specifyField = fields['执行配置'].find((f) => f.id === 'errorHandleSpecifyNode')
    if (specifyField) {
      specifyField.remoteMethod = async (keyword = '') => {
        const node = vueFlowRef.value?.findNode(nodeId)
        if (!node) return []
        let nodesList = vueFlowRef.value?.getNodes.filter(
          (n) => n.parentNode === node.parentNode && n.id !== node.id
        ) || []
        if (keyword) {
          nodesList = nodesList.filter((n) => n.data.name.includes(keyword))
        }
        return nodesList.map((el) => ({
          label: el.data.name,
          value: el.id
        }))
      }
    }
  }

  return fields
})

/**
 * 获取节点类型的配置字段分组（含错误处理注入）
 * 返回 { groupName: [field1, field2, ...] }
 */
const getNodeConfigFields = (type) => {
  const def = nodes[type]
  if (!def) return {}

  const config = { ...def.config }

  // 为非 start/end 节点注入错误处理配置
  if (type !== 'workflowStart' && type !== 'workflowEnd') {
    config.errorHandle = {
      name: '执行配置',
      fields: {
        errorHandleType: {
          id: 'errorHandleType',
          name: '错误处理',
          type: 'select',
          description: '节点遇到错误时的处理方式',
          default: 'stop',
          paramRef: false,
          options: [
            { label: '忽略错误', value: 'ignore' },
            { label: '重试节点', value: 'retry' },
            { label: '指定节点', value: 'specify' },
            { label: '重试流程', value: 'retryFlow' },
            { label: '终止流程', value: 'stop' }
          ]
        },
        errorHandleRetryCount: {
          id: 'errorHandleRetryCount',
          name: '重试次数',
          type: 'number',
          description: '重试次数',
          show: "${errorHandleType}==='retry'",
          default: 3,
          paramRef: false
        },
        errorHandleRetryInterval: {
          id: 'errorHandleRetryInterval',
          name: '重试间隔',
          type: 'number',
          description: '重试间隔（毫秒）',
          show: "${errorHandleType}==='retry'",
          default: 1000,
          paramRef: false
        },
        errorHandleRetryFailed: {
          id: 'errorHandleRetryFailed',
          name: '重试失败',
          type: 'select',
          description: '重试次数超过最大重试次数时的处理方式',
          default: 'stop',
          show: "${errorHandleType}==='retry'",
          paramRef: false,
          options: [
            { label: '忽略错误', value: 'ignore' },
            { label: '指定节点', value: 'specify' },
            { label: '终止流程', value: 'stop' },
            { label: '重试流程', value: 'retryFlow' }
          ]
        },
        errorHandleSpecifyNode: {
          id: 'errorHandleSpecifyNode',
          name: '指定节点',
          type: 'select',
          description: '指定要跳转的节点',
          show: "${errorHandleType}==='specify' || ${errorHandleRetryFailed}==='specify'",
          paramRef: false,
          remote: true,
          options: [],
          remoteMethod: null, // runtime 不适用
          default: ''
        }
      }
    }
  }

  // 转换为分组格式
  const groups = {}
  Object.values(config).forEach((group) => {
    groups[group.name] = []
    Object.values(group.fields || {}).forEach((field) => {
      groups[group.name].push(field)
    })
  })
  return groups
}
// 连线规则
const { validateConnection, createConnection } = new ConnectionRules(workflowId)
// 触摸板处理：平移画布
function handleTouchpadWheel(e) {
  const { x, y, zoom } = vueFlowRef.value.viewport
  vueFlowRef.value.setViewport({
    x: x - e.deltaX,
    y: y - e.deltaY,
    zoom
  })
}

// --------------------------
// 1. 新增：判断鼠标下元素是否需要 no-wheel
// --------------------------
function isNoWheelElement(e) {
  // 获取鼠标当前位置的元素
  const targetElement = document.elementFromPoint(e.clientX, e.clientY)
  if (!targetElement) return false

  // 检查元素本身或其父元素是否包含 no-wheel 类
  let currentElement = targetElement
  while (currentElement) {
    if (currentElement.classList.contains('no-wheel')) {
      return true // 找到 no-wheel 元素，返回需要禁用
    }
    currentElement = currentElement.parentElement // 向上遍历父元素
  }
  return false // 未找到，允许滚轮
}

// 鼠标滚轮处理：缩放画布
const handleMouseWheel = (e) => {
  const zoom = vueFlowRef.value.viewport.zoom
  let zoomStep = 0
  if (e.deltaY > 0) {
    zoomStep = Math.min(e.deltaY, 30)
  } else {
    zoomStep = Math.max(e.deltaY, -30)
  }
  vueFlowRef.value.zoomTo(zoom - zoomStep * 0.002)
}

// 新增：判断元素是否为“可滚动元素”（需要自身响应滚轮）
const isScrollableElement = (element) => {
  if (!element) return false

  // 1. 输入框类元素：本身可滚动（如多行文本框）或不需要画布响应
  const inputTypes = ['INPUT', 'TEXTAREA', 'SELECT']
  if (inputTypes.includes(element.tagName) || element.isContentEditable) {
    return true
  }

  // 2. 可滚动容器：overflow 为 auto/scroll 且内容超出容器
  const styles = window.getComputedStyle(element)
  const isScrollable =
    (styles.overflow === 'auto' ||
      styles.overflow === 'scroll' ||
      styles.overflowX === 'auto' ||
      styles.overflowX === 'scroll' ||
      styles.overflowY === 'auto' ||
      styles.overflowY === 'scroll') &&
    // 内容高度 > 容器高度（垂直可滚动），或内容宽度 > 容器宽度（水平可滚动）
    (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth)

  return isScrollable
}

// 新增：检查事件目标或其祖先是否为可滚动元素
const isInScrollableElement = (e) => {
  let currentElement = e.target
  // 向上遍历至 body，检查是否有可滚动元素
  while (currentElement && currentElement !== document.body) {
    if (isScrollableElement(currentElement)) {
      return true
    }
    currentElement = currentElement.parentElement
  }
  return false
}

// 点击处理：向文档发送 mousedown 事件，触发select的popup
const dispatchMouseDown = (e) => {
  document.documentElement.dispatchEvent(new Event('mousedown'))
}

// 处理滚轮事件
const handleWheel = (e) => {
  if (isTouchpadEvent(e) && !isInScrollableElement(e)) {
    handleTouchpadWheel(e)
  } else if (!isNoWheelElement(e) && !isInScrollableElement(e)) {
    handleMouseWheel(e)
  }
}

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

// 处理节点拖拽
const onNodeDrag = (data) => {
  if (!isCtrl.value) return

  const position = vueFlowRef.value.screenToFlowCoordinate({
    x: data.event.clientX,
    y: data.event.clientY
  })
  const subFlowNodes = vueFlowRef.value.getNodes.filter(
    (node) => node.type === 'subFlow' && !node.hidden
  )
  if (subFlowNodes.length === 0) return
  // 获取当前节点与子流程节点的交集
  IntersectingNode.value = vueFlowRef.value
    .getIntersectingNodes(
      {
        x: position.x,
        y: position.y,
        width: 1,
        height: 1
      },
      false,
      subFlowNodes
    )
    .pop()
}

// 处理节点拖拽停止
const onNodeDragStop = (data) => {
  isDragging.value = false
  if (!isCtrl.value) return
  let parentPosition = null
  let parentNode = undefined
  if (IntersectingNode.value) {
    parentPosition = getFlowCoordinate(IntersectingNode.value, vueFlowRef.value)
    parentNode = IntersectingNode.value.id
  }
  const oldParentNode = []
  data.nodes
    .filter(
      (node) =>
        !['comment', 'subFlow'].includes(node.type) &&
        node.data.type !== 'workflowStart' &&
        node.data.type !== 'workflowEnd' &&
        node.parentNode !== parentNode
    )
    .forEach((node) => {
      const position = getFlowCoordinate(node, vueFlowRef.value)
      if (parentPosition) {
        position.x = position.x - parentPosition.x
        position.y = position.y - parentPosition.y
      }
      node.parentNode && oldParentNode.push(node.parentNode)
      vueFlowRef.value.updateNode(node.id, (node) => {
        //同级名称查重
        node.data.name = getNodeName(
          vueFlowRef.value.getNodes.filter((n) => n.parentNode === parentNode && n.id !== node.id),
          node.data.name
        )
        node.parentNode = parentNode
        node.position = position
      })
    })
  //获取所有和交叉节点关联的边
  const edges = vueFlowRef.value.getEdges.filter(
    (edge) => edge.sourceNode.parentNode === parentNode || edge.targetNode.parentNode === parentNode
  )
  const childNodeIds = vueFlowRef.value.getNodes
    .filter((node) => (parentNode ? node.parentNode === parentNode : !node.parentNode))
    .map((node) => node.id)

  IntersectingNode.value = null
  //如果边不在当前节点中,则删除
  edges.forEach((edge) => {
    if (!childNodeIds.includes(edge.source) || !childNodeIds.includes(edge.target)) {
      vueFlowRef.value.removeEdges([edge.id])
    }
  })
  if (oldParentNode.length > 0) {
    oldParentNode.forEach((parentNode) => {
      const childNode = vueFlowRef.value.getNodes.find((node) => node.parentNode === parentNode)
      if (childNode) {
        adjustParentSize([childNode], vueFlowRef.value)
      }
    })
  }
  adjustParentSize(data.nodes, vueFlowRef.value)
}

// 处理节点拖放
const onDragOver = (event) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
}

// 添加节点到子流程
const addNodeToSubFlow = async ({ nodeData, fromNode, position }) => {
  nodeData = JSON.parse(nodeData)
  fromNode = vueFlowRef.value.getNode(fromNode)
  nodeData.parentNode = fromNode.id
  const parentPosition = getFlowCoordinate(fromNode, vueFlowRef.value)
  const realPosition = {
    x: position.x - parentPosition.x,
    y: position.y - parentPosition.y
  }
  addNode(nodeData, realPosition)
}

// 从边添加节点
const addNodeFromEdge = async ({ fromEdge, nodeData }) => {
  nodeData = JSON.parse(nodeData)
  const edge = vueFlowRef.value.findEdge(fromEdge)
  const sourceNode = edge.sourceNode
  const targetNode = edge.targetNode
  let position = {
    x: sourceNode.position.x + sourceNode.dimensions.width + 200,
    y: targetNode.position.y
  }
  if (sourceNode.position.x > targetNode.position.x) {
    // 添加新节点
    position = {
      x: sourceNode.position.x + sourceNode.dimensions.width + 200,
      y: sourceNode.position.y
    }
  }
  nodeData.parentNode = sourceNode.parentNode
  const newNode = await addNode(nodeData, position)
  // 删除原来的边
  vueFlowRef.value.removeEdges(fromEdge)
  await nextTick()
  autoConnect(vueFlowRef.value, createConnection, sourceNode, newNode, edge.sourceHandle)
  autoConnect(vueFlowRef.value, createConnection, newNode, targetNode)
  await nextTick()
  if (newNode) {
    if (sourceNode.position.x < targetNode.position.x) {
      const nextNodes = getAllSuccessorNodes(
        vueFlowRef.value.getEdges,
        vueFlowRef.value.getNodes.filter((node) => node.parentNode === sourceNode.parentNode),
        targetNode.id
      )
      // 更新节点位置为新节点让出位置
      vueFlowRef.value.updateNodePositions(
        [
          {
            id: targetNode.id,
            position: {
              x: targetNode.position.x + 350,
              y: targetNode.position.y
            }
          },
          ...nextNodes
            .filter((node) => node.position.x > sourceNode.position.x)
            .map((node) => ({
              id: node.id,
              position: {
                x: node.position.x + 350,
                y: node.position.y
              }
            }))
        ],
        true
      )
    }
  }
}

// 节点列表弹窗
const nodeListVisible = ref(false)
// 快速连接样式
const quickConnectStyle = ref({
  position: 'fixed',
  top: '0',
  right: '0'
})
// 快速连接节点ID
const quickConnect = ref(null)

// 显示快速连接
const showQuickConnect = ({ e, edgeId, handleId, nodeId, position }) => {
  if (isExecuting.value) {
    return
  }
  nodeListVisible.value = true
  quickConnect.value = {
    edgeId,
    handleId,
    nodeId,
    position
  }
  quickConnectStyle.value = {
    position: 'fixed',
    top: `${e.clientY}px`,
    left: `${e.clientX}px`
  }
}

// 快速连接节点
const quickConnectChooseNode = (nodeData) => {
  if (!quickConnect.value.edgeId) {
    addNodeFromNode({
      fromNode: quickConnect.value.nodeId,
      nodeData,
      handleId: quickConnect.value.handleId,
      position: quickConnect.value.position
    })
  } else {
    addNodeFromEdge({
      fromEdge: quickConnect.value.edgeId,
      nodeData
    })
  }
  nodeListVisible.value = false
}
// 从节点添加节点
const addNodeFromNode = async ({ nodeData, fromNode, handleId, position }) => {
  nodeData = JSON.parse(nodeData)
  fromNode = vueFlowRef.value.getNode(fromNode)
  nodeData.parentNode = fromNode.parentNode
  let newPosition = {}
  if (position) {
    newPosition = getRelativeCoordinate(fromNode.parentNode, position, vueFlowRef.value)
  } else {
    newPosition = {
      x: fromNode.position.x + fromNode.dimensions.width / 2 + fromNode.dimensions.width + 50,
      y: fromNode.position.y
    }
  }
  if (handleId == 'next-false') {
    newPosition.y = newPosition.y + 45
  }
  const newNode = await addNode(nodeData, newPosition)
  if (newNode) {
    await nextTick()
    autoConnect(vueFlowRef.value, createConnection, fromNode, newNode, handleId)
  }
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
    } else {
      addStartNode()
    }
  })
})

const addStartNode = (parentNode) => {
  let startNodeData = getInitNodeData('workflowStart')
  if (startNodeData) {
    startNodeData = JSON.parse(startNodeData)
  }
  // startNodeData.selectable = false
  startNodeData.deletable = false
  startNodeData.focusable = false
  startNodeData.extent = 'parent'
  startNodeData.parentNode = parentNode
  addNode(startNodeData, {
    x: 180,
    y: 60
  })
}

// 判断节点数量限制
// 节点数量不再限制
const isOverNodeLimit = (_addNodeCount = 1) => false

// 添加节点
const addNode = async (nodeData, position) => {
  if (nodeData.type === 'subFlow') {
    return
  }
  if (isExecuting.value) {
    Message.warning('当前工作流正在执行,不允许添加节点')
    return
  }

  // 如果节点是结束节点,则需要查重
  if (nodeData.type === 'workflowEnd') {
    const endNode = vueFlowRef.value.getNodes
      .filter((node) => node.parentNode === nodeData.parentNode)
      .find((node) => node.data.type === 'workflowEnd')
    if (endNode) {
      locateNode(vueFlowRef.value, [endNode.id])
      Message.error('当前流程已存在结束节点,禁止重复添加')
      return
    }
  }

  let workflow = null
  if (nodeData.workflow) {
    const localWf = await workflowAPI.getWorkflow(nodeData.workflow.id)
    if (localWf) {
      let graph = {}
      try { graph = typeof localWf.graph === 'string' ? JSON.parse(localWf.graph) : (localWf.graph || {}) } catch (e) {}
      workflow = {
        id: localWf.id,
        name: localWf.name,
        description: localWf.description,
        cover: '',
        only_node: false,
        elements: typeof localWf.graph === 'string' ? localWf.graph : JSON.stringify(localWf.graph || {}),
        nodes_count: (graph.nodes || []).length
      }
    }
  }

  const nodes_count = workflow ? workflow.nodes_count : 0
  if (isOverNodeLimit(nodes_count)) {
    return
  }
  const newNode = {
    id: `node-${uuidv4()}`,
    type: 'custom',
    position: {
      x: position.x - 150,
      y: position.y
    },
    parentNode: nodeData.parentNode,
    selectable: nodeData.selectable,
    deletable: nodeData.deletable,
    focusable: nodeData.focusable,
    extent: nodeData.extent,
    // expandParent: !!nodeData.parentNode,
    // extent: { range: 'parent', padding: [20, 20, 20, 20] },
    data: {
      user_id: nodeData.user_id || '',
      type: nodeData.type,
      name: getNodeName(
        vueFlowRef.value.getNodes.filter((n) => n.parentNode === nodeData.parentNode),
        workflow ? workflow.name : nodeData.name
      ),
      icon: workflow?.cover,
      description: workflow?.description,
      inputs: nodeData.inputs,
      outputs: nodeData.outputs,
      config: nodeData.config || {}, // 初始化空配置
      status: 'pending', // 初始状态
      view: nodeData.view
    },
    focusable: true
  }
  if (workflow) {
    newNode.data.workFlow = {
      id: workflow.id,
      only_node: workflow.only_node,
      store: nodeData.workflow.isStore
    }
  }
  vueFlowRef.value.addNodes([newNode])
  if (nodeData.subFlow) {
    addSubFlowNode(newNode, workflow)
  }
  return newNode
}

// 添加子流程节点
const addSubFlowNode = async (node, workFlow) => {
  const subFlowNode = {
    id: node.id + '-subFlow',
    type: 'subFlow',
    parentNode: node.id,
    hidden: node.data.type === 'workFlow',
    deletable: false,
    position: {
      x: -30,
      y: 150
    },
    data: {
      user_id: node.user_id || '',
      type: 'subFlow',
      name: node.data.type === 'workFlow' ? workFlow.name : '工作流',
      inputs: [],
      outputs: [],
      config: {}, // 初始化空配置
      status: 'pending', // 初始状态
      view: false
    }
  }
  let elements = null
  // 如果子流程有工作流，则获取工作流节点并预计算子流程的宽度
  if (workFlow) {
    let elementsData = workFlow.elements
    // 本地工作流：elements 已是纯 JSON，远程工作流需要解密
    if (typeof elementsData === 'string') {
      try {
        // 先尝试直接解析（本地模式）
        elements = JSON.parse(elementsData)
      } catch (e) {
        // 解密后再解析（远程模式）
        const decryptedElements = await decryptedData(elementsData)
        elements = JSON.parse(decryptedElements)
      }
    } else if (typeof elementsData === 'object') {
      elements = elementsData
    }
    // 预计算子流程的宽度
    let minX = Infinity
    let maxX = -Infinity
    elements.nodes
      .filter((node) => !node.parentNode)
      .forEach((node) => {
        minX = Math.min(minX, node.position.x)
        maxX = Math.max(maxX, node.position.x)
      })
    subFlowNode.position.x = -((maxX - minX) / 2) - 30
  }

  //延迟10毫秒等待高度渲染完成
  setTimeout(() => {
    //获取父节点尺寸
    const dimensions = vueFlowRef.value.getNode(node.id).dimensions
    //更新子流程容器节点位置为父节点高度加上原始位置避免节点覆盖
    vueFlowRef.value.updateNode(subFlowNode.id, (node) => {
      return {
        position: {
          x: node.position.x,
          y: node.position.y + dimensions.height
        }
      }
    })
  }, 10)

  // 添加子流程容器节点
  vueFlowRef.value.addNodes([subFlowNode])
  // 添加子流程容器连线
  vueFlowRef.value.addEdges([
    createConnection({
      source: node.id,
      target: subFlowNode.id,
      sourceHandle: 'subFlow',
      targetHandle: 'subFlow',
      selectable: false,
      deletable: false,
      label: nodes[node.data.type].subFlow.name
    })
  ])

  // 如果子流程有工作流，则添加工作流节点
  if (elements && elements?.nodes?.length > 0) {
    elements.nodes.map((node) => {
      node.hidden = true
      if (!node.parentNode) {
        node.parentNode = subFlowNode.id
      }
      return node
    })
    //重建元素ID
    elements = rebuildElementIds(vueFlowRef.value, elements)
    vueFlowRef.value.addNodes(elements.nodes)
    vueFlowRef.value.addEdges(elements.edges)
  } else {
    // 如果子流程没有工作流，则添加一个起始节点
    addStartNode(subFlowNode.id)
  }
}

// 处理节点操作
const handleNodeAction = (action, nodeId) => {
  const node = vueFlowRef.value.getNode(nodeId)
  if (action === 'delete') {
    handleNodeDelete(node)
  } else if (action === 'copy') {
    handleNodeCopy(vueFlowRef.value, clipboard, [node])
    handleNodePaste(vueFlowRef.value, clipboard.value, isOverNodeLimit)
    clipboard.value = null
  }
}

// 处理节点删除
const handleNodeDelete = (elements) => {
  if (isExecuting.value) {
    Message.warning('当前工作流正在执行,不允许删除节点')
    return
  }
  // 支持单个ID或ID数组
  const elementsToDelete = Array.isArray(elements) ? elements : [elements]
  const nodeIds = []
  const edgeIds = []
  elementsToDelete.forEach((el) => {
    if (el.id.startsWith('node-')) {
      // 开始节点不允许删除,清空配置
      if (el.data.type === 'workflowStart') {
        el.data.config = {}
      } else {
        nodeIds.push(el.id)
      }
    } else if (el.id.startsWith('edge-')) {
      edgeIds.push(el.id)
    }
  })
  nodeIds && vueFlowRef.value.removeNodes(nodeIds, true, true)
  edgeIds && vueFlowRef.value.removeEdges(edgeIds)
}

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
