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
import { ref, watch, inject } from 'vue'

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const formData = inject('formData')
const isQuickConfig = inject('isQuickConfig')

const value = defineModel()
const options = ref(props.field.options || [])

// 远程加载选项
if (props.field.remote) {
  const loadOptions = async () => {
    try {
      const result = await props.field.remoteMethod(value.value)
      options.value = result
    } catch (err) {
      console.error('加载选项失败:', err)
    }
  }
  loadOptions()
}

// 监听选项变化
watch(
  () => props.field.options,
  (newVal) => {
    options.value = newVal || []
  }
)

// 值变化时触发onChange
watch(value, (newVal) => {
  if (props.field.onChange) {
    props.field.onChange(newVal, formData)
  }
})
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
