<template>
  <!-- 流程连线连接点 -->
  <div class="flow-handles">
    <!-- 前置节点连接点 -->
    <Handle
      v-if="node?.prev !== false"
      :connectable="!isExecuting"
      type="target"
      position="left"
      id="prev"
      class="flow-handle prev-handle"
      :class="[
        {
          is_self_hover:
            props.id === pendingConnection?.nodeId && pendingConnection?.handleId === 'prev',
          disabled: isExecuting,
          'start-error': flowStore.unConnectedNodes.some((item) => item.id === props.id)
        },
        getConnectionClass(
          {
            id: props.id,
            handle: 'prev',
            type: 'target'
          },
          pendingConnection,
          validateConnection
        )
      ]"
      :is-valid-connection="validateConnection"
    />
    <template v-if="node?.next !== false">
      <!-- 后续节点连接点 -->
      <Handle
        :connectable="!isExecuting"
        type="source"
        position="right"
        id="next"
        @click.stop="showQuickConnect($event, 'next')"
        @drop="handleDrop($event, 'next')"
        class="flow-handle next-handle"
        :class="[
          {
            is_self_hover:
              props.id === pendingConnection?.nodeId && pendingConnection?.handleId === 'next',
            disabled: isExecuting,
            'next-true-handle': node.type === 'workflowIf',
            'allow-drop': dragStartNode
          },
          getConnectionClass(
            {
              id: props.id,
              handle: 'next',
              type: 'source'
            },
            pendingConnection,
            validateConnection
          )
        ]"
        :is-valid-connection="validateConnection"
      />
      <!-- 后续节点连接点 -->
      <Handle
        v-if="node.type === 'workflowIf'"
        :connectable="!isExecuting"
        @click.stop="showQuickConnect($event, 'next-false')"
        @drop="handleDrop($event, 'next-false')"
        type="source"
        position="right"
        id="next-false"
        class="flow-handle next-false-handle"
        :class="[
          {
            is_self_hover:
              props.id === pendingConnection?.nodeId &&
              pendingConnection?.handleId === 'next-false',
            disabled: isExecuting,
            'allow-drop': dragStartNode
          },
          getConnectionClass(
            {
              id: props.id,
              handle: 'next-false',
              type: 'source'
            },
            pendingConnection,
            validateConnection
          )
        ]"
        :is-valid-connection="validateConnection"
      />
    </template>
  </div>
</template>
<script setup>
import { Handle } from '@vue-flow/core'
import { useFlowStore } from '../../../store'
import { storeToRefs } from 'pinia'
import { ref, computed, inject } from 'vue'
import { getConnectionClass, ConnectionRules } from '../../../utils'
const workflowId = inject('workflowId')
const pendingConnection = inject('pendingConnection')
const isExecuting = inject('isExecuting')
const flowStore = useFlowStore(workflowId)
const { validateConnection } = new ConnectionRules(workflowId)
const emit = defineEmits(['showQuickConnect', 'addNode'])
const { dragStartNode } = storeToRefs(flowStore)

const props = defineProps({
  id: {
    type: String,
    required: true
  },
  node: {
    type: Object,
    required: true
  }
})

// 点击节点显示快速连接
const showQuickConnect = (e, handleId) => {
  emit('showQuickConnect', { e, handleId, nodeId: props.id })
}

// 直接拖拽到节点
const handleDrop = (e, handleId) => {
  e.stopPropagation()
  e.preventDefault()
  emit('addNode', {
    fromNode: props.id,
    nodeData: e.dataTransfer.getData('node'),
    handleId
  })
}
</script>

<style lang="less" scoped>
// 流程连线连接点样式
.flow-handles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;

  .is_self_hover {
    cursor: crosshair !important;
  }
  .no-connection {
    opacity: 0.5;
    cursor: no-drop;
    &:hover {
      background: #b1b1b7 !important ;
      border: 2px solid var(--color-fill-2) !important;
    }
  }
  .yes-connection {
    opacity: 1;
    background: rgb(var(--primary-6)) !important;
    border-color: rgb(var(--primary-6)) !important;
  }
  .flow-handle.disabled:hover {
    background: #b1b1b7 !important;
    border: 2px solid var(--color-fill-2) !important;
  }
  .flow-handle {
    width: 12px;
    height: 24px;
    background: #b1b1b7;
    border: 2px solid var(--color-fill-2);
    border-radius: 12px;
    pointer-events: all;
    transition: all 0.2s;
    z-index: 99;
    &.start-error {
      background: rgb(var(--danger-6));
      border-color: rgb(var(--danger-2));
    }

    &:hover {
      background: rgb(var(--primary-6));
      border-color: rgb(var(--primary-6));
    }

    &.prev-handle {
      left: -5px;
      top: 20px;
      transform: translateY(-50%);
    }

    &.next-handle {
      right: -5px;
      top: 20px;
      transform: translateY(-50%);
      &.allow-drop {
        background: rgb(var(--primary-6));
        border-color: rgb(var(--primary-6));
      }
    }

    &.next-true-handle {
      background: rgb(var(--link-5));
      border-color: rgb(var(--link-2));
      &:hover {
        border-color: rgb(var(--link-5));
      }
      &.allow-drop {
        background: rgb(var(--link-5));
        border-color: rgb(var(--link-5));
      }
    }

    &.next-false-handle {
      right: -5px;
      top: 65px;
      transform: translateY(-50%);
      background: rgb(var(--danger-5));
      border-color: rgb(var(--danger-2));
      &.allow-drop {
        border-color: rgb(var(--danger-5));
      }
      &:hover {
        border-color: rgb(var(--danger-5));
      }
    }
  }
}
</style>
