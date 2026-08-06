<template>
  <div class="dataHandler-view">
    <FormView :fields="fields" v-model="formData" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import FormView from '@/workflow/components/nodes/FormView.vue'
import { HANDLERS } from './handlers.js'
const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

const formData = ref(props.node.config)

// 单类型收敛：本节点只处理 数字 类型，操作下拉直接用节点内 HANDLERS（不再有类型下拉）
const handleOptions = Object.entries(HANDLERS).map(([value, h]) => ({
  label: h.label,
  value
}))

const fields = computed(() => {
  const handle = formData.value.handle
  const handler = HANDLERS[handle]
  const fields = [
    {
      id: 'handle',
      name: '操作',
      type: 'select',
      description: handler?.description || '选择要执行的操作',
      props: {
        allowClear: false
      },
      default: '',
      options: []
    },
    // 操作参数配置
    ...(handler?.params || [])
  ]
  if (handleOptions.length) {
    if (
      formData.value.handle === '' ||
      !handleOptions.find((item) => item.value === formData.value.handle)
    ) {
      formData.value.handle = handleOptions[0].value
    }
    fields[0].options = handleOptions
  } else {
    formData.value.handle = ''
    fields[0].show = false
  }
  return fields
})

watch(
  () => formData.value.handle,
  () => {
    const handler = HANDLERS[formData.value.handle]
    if (handler) {
      handler.params.forEach((param) => {
        formData.value[param.id] = param.default
      })
      const inputs = []
      const outputs = []
      if (handler.input?.length) {
        inputs.push({
          id: 'data',
          name: '数据',
          type: handler.input,
          required: true,
          description: '待处理数据'
        })
      }
      if (handler.output?.length) {
        outputs.push({
          id: 'result',
          name: '结果',
          type: handler.output,
          description: '处理后的数据'
        })
      }
      formData.value.__nodeIO = {
        inputs,
        outputs
      }
    } else {
      formData.value.__nodeIO = { inputs: [], outputs: [] }
    }
  }
)
</script>

<style scoped lang="less"></style>
