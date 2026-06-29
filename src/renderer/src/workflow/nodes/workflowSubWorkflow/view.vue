<template>
  <div class="trigger-view">
    <a-typography-text class="description" :ellipsis="{ rows: 2, expandable: true }">
      使用开始、结束节点输入、输出数据。
    </a-typography-text>

    <!-- 参数配置表单 -->
    <template v-if="configFields.length">
      <div class="configs-form">
        <a-divider orientation="left">配置项 </a-divider>
        <FormView :fields="configFields" v-model="formData" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import FormView from '@/workflow/components/nodes/FormView.vue'
import { useFlowStore } from '@/workflow/store'
import { buildConfigFields } from '../common'
// 工作流ID
const workflowId = inject('workflowId')
// 工作流store
const flowStore = useFlowStore(workflowId)

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

//参数表单数据，自动获取字段值，并绑定v-model
const formData = ref({})
// 参数字段配置
const configFields = computed(() => {
  const startNode = flowStore.vueFlowRef.getNodes.find(
    (node) => node.parentNode === props.node.id + '-subFlow' && node.data.type === 'workflowStart'
  )
  const fields =
    startNode.data.config.config?.map(buildConfigFields) || []
  fields.forEach((field) => {
    formData.value[field.id] = field.default
  })
  return fields
})

watch(
  formData,
  (value) => {
    const startNode = flowStore.vueFlowRef.getNodes.find(
      (node) => node.parentNode === props.node.id + '-subFlow' && node.data.type === 'workflowStart'
    )
    startNode.data.config.config?.forEach((config) => {
      config[config.type + 'Value'] = value[config.name]
    })
    // 触发节点数据更新（写入历史记录）
    flowStore.onNodesChange([{ id: startNode.id, type: 'data' }])
  },
  { deep: true }
)
</script>

<style scoped lang="less">
.description {
  color: var(--color-text-3);
  margin: 0px;
}
</style>
