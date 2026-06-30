<template>
  <div class="subFlow-container" v-if="isAllowExpand">
    <Handle
      id="subFlow"
      type="source"
      position="bottom"
      style="bottom: -48px; opacity: 0"
      :connectable="false"
    />
    <div
      class="toggleSubFlow"
      :class="{ disabled: isExecuting }"
      @click.stop="$emit('toggle')"
    >
      <icon-branch
        :style="{ transform: subFlowExpand ? 'rotate(0deg)' : 'rotate(180deg)' }"
        style="transition: all 0.2s"
      />
      {{ subFlowExpand ? '收起' : '展开' }}{{ subFlowName }}
    </div>
  </div>
</template>

<script setup>
import { Handle } from '@vue-flow/core'
import { IconBranch } from '@arco-design/web-vue/es/icon'

defineEmits(['toggle'])

defineProps({
  isAllowExpand: { type: Boolean, default: false },
  isExecuting: { type: Boolean, default: false },
  subFlowExpand: { type: Boolean, default: false },
  subFlowName: { type: String, default: '' }
})
</script>

<style lang="less" scoped>
.subFlow-container {
  .toggleSubFlow {
    position: fixed;
    bottom: -50px;
    left: 50%;
    background: #fff;
    width: 100px;
    margin-left: -50px;
    border-radius: var(--border-radius-small);
    border: 1px solid var(--color-border);
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 12px;

    &::before {
      height: 20px;
      width: 1px;
      background: var(--color-border);
      content: '';
      position: absolute;
      top: -11px;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  }
}
</style>
