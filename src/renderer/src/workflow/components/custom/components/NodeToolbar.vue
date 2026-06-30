<template>
  <div class="node-toolbar-box" v-if="!isExecuting && !disabled" :style="[alwaysVisible ? { display: 'block' } : {}]">
    <div class="node-toolbar">
      <!-- Global node toggle -->
      <a-tooltip v-if="nodeDefinition.type !== 'workflowEnd'">
        <template #content>
          设为全局：{{ global ? '是' : '否' }} <br />
          全局节点：节点输出可被 <b>所有</b> 节点引用 <br />
          普通节点：节点输出可被 <b>同级</b> 节点引用
        </template>
        <IconSwitch :modelValue="global" @click="$emit('action', 'global')">
          <icon-public />
        </IconSwitch>
      </a-tooltip>

      <template v-if="nodeDefinition.type !== 'workflowStart'">
        <template v-if="nodeDefinition.type !== 'workflowEnd'">
          <a-tooltip content="重命名：双击标题可快速编辑">
            <icon-edit @click="$emit('action', 'rename')" />
          </a-tooltip>
          <a-tooltip content="复制节点">
            <icon-copy @click="$emit('action', 'copy')" />
          </a-tooltip>
          <a-tooltip content="停用节点">
            <icon-stop @click="$emit('action', 'deactivate')" />
          </a-tooltip>
          <a-tooltip content="节点详情" v-if="showDetail">
            <icon-file @click="$emit('action', 'detail')" />
          </a-tooltip>
        </template>
        <a-tooltip content="删除节点">
          <icon-delete @click="$emit('action', 'delete')" />
        </a-tooltip>
      </template>
    </div>
  </div>
</template>

<script setup>
import {
  IconEdit,
  IconCopy,
  IconDelete,
  IconStop,
  IconFile,
  IconPublic
} from '@arco-design/web-vue/es/icon'
import IconSwitch from './iconSwitch.vue'

defineEmits(['action'])

defineProps({
  nodeDefinition: { type: Object, required: true },
  global: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  isExecuting: { type: Boolean, default: false },
  showDetail: { type: Boolean, default: false },
  alwaysVisible: { type: Boolean, default: false }
})
</script>

<style lang="less" scoped>
.node-toolbar-box {
  display: none;
  height: 32px;
  position: absolute;
  top: -30px;
  width: 100%;
  z-index: 1000;
  left: 0;
}
.node-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  height: 32px;
  font-weight: bold;
  font-size: 14px;
  color: var(--color-text-1);
  background: rgba(255, 255, 255, 0.3);
  height: 24px;
  padding: 0 12px;
  border-radius: var(--border-radius-small);
  border: 1px solid var(--color-border);
}
</style>
