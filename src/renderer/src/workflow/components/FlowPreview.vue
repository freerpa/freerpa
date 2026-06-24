/** * @file: 流程图画布组件 * @author: dabao * @date: 2024-03-15 */
<template>
  <a-spin style="width: 100%; height: calc(100% - 10px)" :loading="loading" tip="加载中...">
    <div class="flow-canvas" tabindex="0" @keydown="handleKeyDown">
      <VueFlow
        :id="workflow.id"
        :default-viewport="{ zoom: 1 }"
        :min-zoom="0.1"
        :max-zoom="1.5"
        :elements-selectable="false"
        :deleteKeyCode="null"
        :zoomOnDoubleClick="true"
        :zoomOnScroll="false"
        @nodeDragStart="false"
        @nodeDragStop="false"
        :nodesDraggable="false"
        fitViewOnInit
        ref="vueFlowRef"
      >
        <a-space style="position: absolute; top: 10px; right: 10px; z-index: 1000">
          <a-button @click="handleZoom('in')"> <icon-plus /></a-button>
          <a-button @click="handleZoom('out')"> <icon-minus /></a-button>
          <a-button @click="handleZoom('fit')">
            <IconFullscreen />
          </a-button>
        </a-space>
        <template #edge-custom="customEdgeProps">
          <CustomEdge :customEdgeProps="customEdgeProps" v-bind="customEdgeProps" />
        </template>
        <template #node-custom="nodeProps">
          <CustomNode v-bind="nodeProps" is-preview />
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
          <CommentNode :id="nodeProps.id" :data="nodeProps.data" :selected="nodeProps.selected" is-preview />
        </template>
        <Background pattern-color="#aaa" gap="20" />
        <MiniMap />
      </VueFlow>
    </div>
  </a-spin>
</template>

<script setup>
import { ref, onMounted, provide, nextTick } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { IconFullscreen, IconPlus, IconMinus } from '@arco-design/web-vue/es/icon'
import { useFlowStore } from '../store'
import CustomNode from './custom/CustomNode.vue'
import CustomEdge from './custom/CustomEdge.vue'
import SubFlowNode from './custom/SubFlowNode.vue'
import CommentNode from './custom/CommentNode.vue'
import { storeToRefs } from 'pinia'
import { decryptedData } from '../utils/crypto'
import { v4 as uuidv4 } from 'uuid'

const props = defineProps({
  workflow: {
    type: Object,
    required: true
  }
})

// 工作流ID
const workflowId = props.workflow.id
provide('workflowId', workflowId)
// 工作流store
const flowStore = useFlowStore(workflowId)
// 工作流store的元素
const { isExecuting, vueFlowRef } = storeToRefs(flowStore)

isExecuting.value = true

provide('isExecuting', isExecuting)
//开启预览模式
provide('isPreview', ref(true))

// 待连接的节点
const pendingConnection = ref(null)
provide('pendingConnection', pendingConnection)

const loading = ref(true)

onMounted(async () => {
  await nextTick()
  // 初始化工作流
  vueFlowRef.value.onPaneReady(() => {
    setTimeout(async () => {
      let elements = props.workflow.elements
      if (elements) {
        const decryptedElements = await decryptedData(elements)
        elements = JSON.parse(decryptedElements)
      }
      if (props.workflow.only_node) {
        const { newNode, subFlowNode } = buildWorkflowNode()
        elements.nodes = elements.nodes
          .filter((item) => !item.parentNode)
          .map((item) => {
            return {
              ...item,
              parentNode: subFlowNode.id,
              hidden: true
            }
          })

        elements.nodes.push(newNode)
        elements.nodes.push(subFlowNode)
      }

      if (elements) {
        vueFlowRef.value.fromObject(elements)
      } else {
        elements.value = []
      }
      loading.value = false
      setTimeout(() => {
        vueFlowRef.value.fitView({
          padding: 0.05,
          includeHiddenNodes: false,
          maxZoom: 1
        })
      }, 10)
    }, 1000)
  })
})

const buildWorkflowNode = () => {
  const newNode = {
    id: `node-${uuidv4()}`,
    type: 'custom',
    position: {
      x: 0,
      y: 0
    },
    data: {
      user_id: '',
      type: 'workFlow',
      name: props.workflow.name,
      icon: props.workflow.cover,
      description: props.workflow.description,
      inputs: [],
      outputs: [],
      config: {}, // 初始化空配置
      status: 'pending', // 初始状态
      view: true,
      workFlow: {
        id: props.workflow.id,
        only_node: props.workflow.only_node
      }
    }
  }
  const subFlowNode = {
    id: newNode.id + '-subFlow',
    type: 'subFlow',
    parentNode: newNode.id,
    hidden: newNode.data.type === 'workFlow',
    deletable: false,
    position: {
      x: -30,
      y: 150
    },
    data: {
      user_id: '',
      type: 'subFlow',
      name: '子流程',
      inputs: [],
      outputs: [],
      config: {}, // 初始化空配置
      status: 'pending', // 初始状态
      view: false
    }
  }
  return {
    newNode,
    subFlowNode
  }
}

const handleZoom = (type) => {
  if (type === 'in') {
    vueFlowRef.value.zoomIn()
  } else if (type === 'out') {
    vueFlowRef.value.zoomOut()
  } else if (type === 'fit') {
    vueFlowRef.value.fitView({
      padding: 0.05,
      includeHiddenNodes: false,
      maxZoom: 1
    })
  }
}
</script>

<style lang="less" scoped>
.flow-canvas {
  // position: absolute;
  // top: 0;
  // left: 0;
  // right: 0;
  // bottom: 0;
  outline: none; // 移除焦点轮廓
  width: 100%;
  height: 100%;

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
