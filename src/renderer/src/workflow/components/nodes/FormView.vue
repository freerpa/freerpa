<template>
  <div class="form-view">
    <field-renderer ref="formRef" :fields="fields" v-model="formData" />
  </div>
</template>

<script setup>
import { ref, inject, watch } from 'vue'
import FieldRenderer from '@/workflow/components/fieldRenderer/FieldRenderer.vue'
import { useFlowStore } from '@/workflow/store'
// 工作流ID
const workflowId = inject('workflowId')
// 工作流store
const flowStore = useFlowStore(workflowId)
// 节点ID
const nodeId = inject('nodeId')
// 状态
const formRef = ref(null)

watch(
  () => formRef.value,
  (value) => {
    if (value) {
      flowStore.nodeRefs.set(nodeId, formRef.value)
    } else {
      flowStore.nodeRefs.delete(nodeId)
    }
  }
)

const formData = defineModel({
  type: Object,
  default: () => ({})
})

const props = defineProps({
  fields: {
    type: Array,
    default: () => []
  }
})
</script>

<style lang="scss" scoped>
</style>