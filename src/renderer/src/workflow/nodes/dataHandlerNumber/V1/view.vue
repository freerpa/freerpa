<template>
  <div class="dataHandler-view">
    <FormView :fields="fields" v-model="formData" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import FormView from '@/workflow/components/nodes/FormView.vue'
import { getTypes, getHandlersByType, getHandler } from '@/workflow/dataHandlers'
const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

const formData = ref(props.node.config)

const types = {
  id: 'type',
  name: '类型',
  description: '选择要处理的数据类型',
  type: 'select',
  props: {
    allowClear: false
  },
  quickConfig: true,
  options: getTypes(),
  show: false,
  default: 'number'
}
const fields = computed(() => {
  const type = formData.value.type
  const handle = formData.value.handle
  const handler = getHandler(type, handle)
  const fields = [
    types,
    // 数组操作配置
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
    ...handler.params
  ]
  const handleOptions = getHandlersByType(type)
  if (handleOptions.length) {
    if (
      formData.value.handle === '' ||
      !handleOptions.find((item) => item.value === formData.value.handle)
    ) {
      formData.value.handle = handleOptions[0].value
    }
    fields[1].options = handleOptions
  } else {
    formData.value.handle = ''
    fields[1].show = false
  }
  return fields
})

watch(
  () => [formData.value.type, formData.value.handle],
  () => {
    const handler = getHandler(formData.value.type, formData.value.handle)
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
