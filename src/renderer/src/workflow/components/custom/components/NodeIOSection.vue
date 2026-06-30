<template>
  <div class="io-section" v-if="nodeInputs.length || nodeOutputs.length">
    <!-- Input params (left side) -->
    <div class="params-container input-params">
      <div
        v-for="input in nodeInputs"
        :key="input.id"
        class="param-item"
        v-memo="[input.id, input.name, input.type, input.required, pendingConnection?.handleId]"
      >
        <a-popover>
          <Handle
            :connectable="!isExecuting"
            type="target"
            :id="input.id"
            :position="Position.Left"
            :class="[
              'handle',
              `handle-${input.type || 'default'}`,
              {
                is_self_hover:
                  nodeId === pendingConnection?.nodeId &&
                  pendingConnection?.handleId === input.id
              },
              handleClass(input.id, 'target')
            ]"
            :is-valid-connection="validateConnection"
          >
            <svg class="param-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <path
                v-for="(item, i) in getTypeColor(input.type)"
                :key="i"
                :d="item.d"
                :fill="item.fill"
              />
              <circle cx="50" cy="50" r="30" fill="white" />
            </svg>
          </Handle>
          <template #content>
            <div
              style="display: flex; align-items: center; gap: 4px"
              v-for="(item, i) in getTypeColor(input.type)"
              :key="i"
            >
              <div
                style="width: 10px; height: 10px; border-radius: 50%"
                :style="{ background: item.fill }"
              />
              <span style="font-size: 10px; color: var(--color-text-2)">{{ item.text }}</span>
            </div>
          </template>
        </a-popover>

        <a-space :size="1">
          <span
            class="param-name"
            :class="{
              'need-connect': needConnect(input.id)
            }"
          >
            {{ input.name }}
          </span>
          <span v-if="input.required" class="param-required">
            <svg fill="currentColor" viewBox="0 0 1024 1024" width="1em" height="1em">
              <path
                d="M583.338667 17.066667c18.773333 0 34.133333 15.36 34.133333 34.133333v349.013333l313.344-101.888a34.133333 34.133333 0 0 1 43.008 22.016l42.154667 129.706667a34.133333 34.133333 0 0 1-21.845334 43.178667l-315.733333 102.4 208.896 287.744a34.133333 34.133333 0 0 1-7.509333 47.786666l-110.421334 80.213334a34.133333 34.133333 0 0 1-47.786666-7.509334L505.685333 706.218667 288.426667 1005.226667a34.133333 34.133333 0 0 1-47.786667 7.509333l-110.421333-80.213333a34.133333 34.133333 0 0 1-7.509334-47.786667l214.186667-295.253333L29.013333 489.813333a34.133333 34.133333 0 0 1-22.016-43.008l42.154667-129.877333a34.133333 34.133333 0 0 1 43.008-22.016l320.512 104.106667L412.672 51.2c0-18.773333 15.36-34.133333 34.133333-34.133333h136.533334z"
              ></path>
            </svg>
          </span>
          <a-tooltip v-if="input.description" :content="input.description">
            <icon-question-circle class="param-description" />
          </a-tooltip>
        </a-space>
      </div>
    </div>

    <!-- Output params (right side) -->
    <div class="params-container output-params">
      <div
        v-for="output in nodeOutputs"
        :key="output.id"
        class="param-item"
        v-memo="[output.id, output.name, output.type, output.required, pendingConnection?.handleId]"
      >
        <a-tooltip v-if="output.description" :content="output.description">
          <icon-question-circle class="param-description" />
        </a-tooltip>
        <span class="param-name">{{ output.name }}</span>
        <a-popover>
          <Handle
            :connectable="!isExecuting"
            type="source"
            :id="output.id"
            :position="Position.Right"
            :class="[
              'handle',
              `handle-${output.type || 'default'}`,
              {
                is_self_hover:
                  nodeId === pendingConnection?.nodeId &&
                  pendingConnection?.handleId === output.id
              },
              handleClass(output.id, 'source')
            ]"
            :is-valid-connection="validateConnection"
          >
            <svg class="param-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <path
                v-for="(item, i) in getTypeColor(output.type)"
                :key="i"
                :d="item.d"
                :fill="item.fill"
              />
              <circle cx="50" cy="50" r="30" fill="white" />
            </svg>
          </Handle>
          <template #content>
            <div
              style="display: flex; align-items: center; gap: 4px"
              v-for="(item, i) in getTypeColor(output.type)"
              :key="i"
            >
              <div
                style="width: 10px; height: 10px; border-radius: 50%"
                :style="{ background: item.fill }"
              />
              <span style="font-size: 10px; color: var(--color-text-2)">{{ item.text }}</span>
            </div>
          </template>
        </a-popover>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { IconQuestionCircle } from '@arco-design/web-vue/es/icon'
import { getTypeColor, getConnectionClass } from '../../../utils'

const props = defineProps({
  nodeId: { type: String, required: true },
  nodeInputs: { type: Array, default: () => [] },
  nodeOutputs: { type: Array, default: () => [] },
  isExecuting: { type: Boolean, default: false },
  pendingConnection: { type: Object, default: null },
  validateConnection: { type: Function, default: () => true },
  needConnects: { type: Array, default: () => [] }
})

// Check if an input needs connection
const needConnect = (inputId) => {
  return props.needConnects.some(
    (item) => item.nodeId === props.nodeId && item.inputId === inputId
  )
}

// Compute handle connection class
const handleClass = (handleId, type) => {
  return getConnectionClass(
    { id: props.nodeId, handle: handleId, type },
    props.pendingConnection,
    props.validateConnection
  )
}
</script>

<style lang="less" scoped>
.io-section {
  padding: 10px;
  display: flex;
  justify-content: space-between;

  .params-container {
    flex: 1;

    .param-item {
      display: flex;
      align-items: center;
      height: 20px;
      position: relative;
      cursor: default;

      .param-icon {
        position: absolute;
        pointer-events: none;
      }

      .param-name {
        font-size: 10px;
        color: var(--color-text-2);

        &.need-connect {
          padding: 0 2px;
          background: var(--color-danger-light-1);
          color: rgb(var(--danger-6));
          border: 1px solid rgb(var(--danger-3));

          &::after {
            content: '[必传]';
            color: rgb(var(--danger-6));
            margin-left: 2px;
          }
        }
      }

      .param-required {
        color: rgb(var(--danger-6));
        margin-left: 2px;
        margin-top: 2px;
        font-size: 6px;
      }

      .param-description {
        font-size: 12px;
        color: #b1b1b7;
        margin: 0 2px;
      }

      .handle {
        width: 10px;
        height: 10px;
        background: white;

        &:hover {
          width: 12px;
          height: 12px;
        }
      }

      .is_self_hover {
        cursor: crosshair !important;
      }

      .no-connection {
        opacity: 0.5;
        cursor: no-drop;

        &:hover {
          width: 10px !important;
          height: 10px !important;
          border: 2px solid var(--color-border) !important;
        }
      }

      .yes-connection {
        opacity: 1;
        transition: all 0.2s;
        width: 12px;
        height: 12px;
        border-width: 0;
      }
    }
  }

  .input-params .param-item {
    padding-left: 10px;
  }

  .output-params .param-item {
    padding-right: 10px;
    justify-content: flex-end;
  }
}
</style>
