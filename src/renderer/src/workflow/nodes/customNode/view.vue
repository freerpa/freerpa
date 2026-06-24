<template>
  <div class="customNode-view">
    <!-- <a-space class="open-source" v-if="isMyNode">
      <a-tooltip content="开源后任意用户都可以查看和修改代码，闭源后只有创建者可以查看和修改代码">
        <icon-question-circle-fill size="16" />
      </a-tooltip>
      是否开源：<a-switch v-model="node.config.openSource" size="small" />
    </a-space> -->
    <div class="description scrollbar" v-html="description || '暂无描述'"></div>
    <template v-if="paramFields?.length">
      <a-divider orientation="left">配置项</a-divider>
      <div class="params-form">
        <FormView :fields="paramFields" v-model="formData" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { IconQuestionCircleFill } from '@arco-design/web-vue/es/icon'
import { ref, computed, inject, watch } from 'vue'
import FormView from '@/workflow/components/nodes/FormView.vue'

import { buildConfigFields } from '../common'
const isMyNode = inject('isMyNode')

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

const description = computed(() => {
  return props.node.config.description.replace(/\n/g, '<br>')
})

//参数表单数据，自动获取字段值，并绑定v-model
const formData = ref({})
// 参数字段配置
const paramFields = computed(() => {
  const fields = props.node.config.params?.map(buildConfigFields) || []
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
</script>

<style scoped lang="less">
.open-source {
  // margin-bottom: 5px;
}
.description {
  max-height: 200px;
  overflow: auto;
  font-size: 12px;
  padding: 5px;
}
</style>
