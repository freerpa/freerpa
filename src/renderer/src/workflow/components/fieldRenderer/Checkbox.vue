<template>
    <a-checkbox-group
    v-model="value"
    :options="options"
    :disabled="field.disabled"
  />
</template>

<script setup>
import { ref, watch } from 'vue'
import { useFieldWatch } from './composables/useFieldValue'

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const value = defineModel()
useFieldWatch(props, value)
const options = ref(props.field.options || [])

// 远程加载选项
if(props.field.remote) {
  const loadOptions = async () => {
    try {
      const result = await props.field.remoteMethod(value.value)
      options.value = result
    } catch(err) {
      console.error('加载选项失败:', err)
    }
  }
  loadOptions()
}

// 监听选项变化
watch(() => props.field.options, (newVal) => {
  options.value = newVal || []
})
</script>
<style scoped>
.checkbox-group {
  min-height: 24px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
</style>
