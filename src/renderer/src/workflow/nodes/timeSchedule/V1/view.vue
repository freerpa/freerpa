<template>
  <div class="trigger-view">
    <!-- 参数配置表单 -->
    <div class="params-form" :style="{ display: paramFields.length ? 'block' : 'none' }">
      <FormView :fields="paramFields" v-model="formData" :allow-executing-edit="true" />
    </div>
    <div class="actions">
      <a-button
        type="primary"
        :loading="isTriggering"
        long
        @click="handleTrigger"
        :disabled="!isExecuting || nodeStatus !== 'running'"
      >
        {{ isTriggering ? '触发中...' : '立即触发' }}
      </a-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import FormView from '@/workflow/components/nodes/FormView.vue'
import { buildConfigFields } from '../../common'
const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  nodeStatus: {
    type: String,
    default: 'initializing'
  }
})

const isTriggering = ref(false)
const sendNodeEvent = inject('sendNodeEvent')
const isExecuting = inject('isExecuting')

// 处理节点事件
const onNodeEvent = async (params, callback) => {
}

const handleTrigger = async () => {
  if (isTriggering.value) return

  isTriggering.value = true
  try {
    sendNodeEvent({
      type: 'confirm',
      data: {}
    })
  } catch (error) {
    console.error('触发失败:', error)
  } finally {
    isTriggering.value = false
  }
}
//参数表单数据，自动获取字段值，并绑定v-model
const formData = ref({})
// 参数字段配置
const paramFields = computed(() => {
  const fields =
    props.node.config.params?.map(buildConfigFields) || []
  fields.map((field) => (field.paramRef = false))
  fields.forEach((field) => {
    formData.value[field.id] = field.default
  })
  return fields
})
watch(
  formData,
  (value) => {
    props.node.config.params.forEach((param) => {
      param[param.type + 'Value'] = value[param.name]
    })
  },
  { deep: true }
)


defineExpose({
  onNodeEvent
})
</script>

<style scoped lang="less">
.trigger-view {
  .params-form {
    margin-bottom: 4px;
  }
  .actions {
    text-align: center;
  }
}
</style>
