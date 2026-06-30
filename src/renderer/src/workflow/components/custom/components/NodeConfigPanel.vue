<template>
  <ModalPopover
    @visible-change="$emit('update:configVisible', $event)"
    position="right"
  >
    <template #content>
      <a-tabs
        type="card-gutter"
        tabindex="0"
        @keydown="unDoReDoInterceptor"
        @keyup="unDoReDoInterceptor"
        @mouseenter="$emit('focusChange', true)"
      >
        <a-tab-pane
          :title="name"
          v-for="(fields, name) in allConfigFieldsWithGroup"
          :key="name"
        >
          <div class="config-content" style="padding: 10px">
            <FieldRenderer :model-value="nodeConfig" @update:model-value="$emit('update:nodeConfig', $event)" :fields="fields" />
          </div>
        </a-tab-pane>
      </a-tabs>
    </template>
    <a-tooltip content="节点完整配置">
      <icon-settings />
    </a-tooltip>
  </ModalPopover>
</template>

<script setup>
import { IconSettings } from '@arco-design/web-vue/es/icon'
import ModalPopover from '../../ModalPopover.vue'
import FieldRenderer from '../../fieldRenderer/FieldRenderer.vue'
import { unDoReDoInterceptor } from '../../../utils'

defineEmits(['update:configVisible', 'update:nodeConfig', 'focusChange'])

defineProps({
  allConfigFieldsWithGroup: { type: Object, default: () => ({}) },
  nodeConfig: { type: Object, default: () => ({}) }
})
</script>

<style lang="less" scoped>
.config-content {
  max-height: calc(90vh - 40px);
  overflow: auto;
}
</style>
