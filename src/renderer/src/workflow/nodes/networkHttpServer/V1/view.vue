<template>
  <div class="http-server-node-view">
    <a-typography-paragraph
      :copyable="nodeStatus === 'running'"
      style="margin: 0px"
      :copyText="serverUrl"
      type="secondary"
    >
      地址：{{ nodeStatus === 'running' ? serverUrl : '未启动' }}
    </a-typography-paragraph>
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
import { buildConfigFields } from '../../common'
// 工作流ID
const workflowId = inject('workflowId')
// 工作流store
const flowStore = useFlowStore(workflowId)
const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  nodeStatus: {
    type: String,
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
  const fields = startNode.data.config.config?.map(buildConfigFields) || []
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
// 处理节点事件
const onNodeEvent = async (url) => {
  serverUrl.value = url
}
const serverUrl = ref('')

defineExpose({
  onNodeEvent
})
</script>

<style lang="less" scoped>
.http-server-node-view {
  font-size: 12px;
}
</style>
