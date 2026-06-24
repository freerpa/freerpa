<template>
  <div class="start-node-view">
    <a-space>
      全局变量可被所有节点引用。
    </a-space>
    <!-- 参数配置表单 -->
    <template v-if="configFields.length">
      <div class="configs-form">
        <a-divider orientation="left">全局配置</a-divider>
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
import { IconQuestionCircle, IconSettings } from '@arco-design/web-vue/es/icon'

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
  const fields = props.node.config.config?.map(buildConfigFields) || []
  fields.map((field) => (field.paramRef = false))
  formData.value = props.node.config.config?.reduce((prev, cur) => {
    prev[cur.name] = cur[cur.type + 'Value']
    return prev
  }, {})
  return fields
})

watch(
  formData,
  (value) => {
    props.node.config.config?.forEach((config) => {
      config[config.type + 'Value'] = value[config.name]
    })
  },
  { deep: true }
)
</script>

<style scoped lang="less">
.start-node-view {
  .configs-form {
    margin: 16px 0 0 0;
  }

  .actions {
    margin-top: 16px;
    text-align: center;
  }
}
</style>
