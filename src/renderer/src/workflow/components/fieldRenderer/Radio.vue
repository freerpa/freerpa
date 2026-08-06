<template>
  <a-radio-group
    v-model="value"
    :options="options"
    :disabled="field.disabled"
    type="button"
    :class="{ 'is-quick-config': isQuickConfig }"
  />
</template>

<script setup>
import { inject } from 'vue'
import { useFieldWatch } from './composables/useFieldValue'
import { useRemoteOptions } from './composables/useRemoteOptions'

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const isQuickConfig = inject('isQuickConfig')

const value = defineModel()
useFieldWatch(props, value)

// 远程/静态选项统一加载（useRemoteOptions 处理 loading、异常、静态 options 同步）
const { options, loadOptions } = useRemoteOptions(props.field, () => value.value)
loadOptions()
</script>

<style scoped lang="less">
.is-quick-config.arco-radio-group-button {
  min-width: 100%;
  :deep(.arco-radio-button) {
    flex: 1;
    text-align: center;
  }
}
</style>
