<template>
  <div class="start-node-view">
    <div class="node-title">
      <span class="node-title-text">
        流程起始节点
        <a-tooltip>
          <template #content>
            可添加配置项和输入项。
            <br />
            输入项：在父节点接收，子流程节点可引用。
            <br />
            配置项：当工作流为子流程时，提升至父节点配置。
          </template>
          <icon-question-circle />
        </a-tooltip>
      </span>
      <div v-if="isSubFlow">
        <ParamRefer trigger="click" @onSelect="handleSelect">
          <a-button size="mini"> 快速引用 </a-button>
        </ParamRefer>
      </div>
    </div>
    <!-- 参数配置表单 -->
    <template v-if="configFields.length">
      <div class="configs-form">
        <a-divider orientation="left">配置项 <small>(不支持参数引用)</small></a-divider>
        <FormView v-if="!isSubFlow" :fields="configFields" v-model="formData" />
        <a-alert v-else type="warning" :show-icon="false" style="height: 32px">
          <icon-settings />
          子流程配置项提升至父节点配置
        </a-alert>
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
import ParamRefer from './ParamRefer.vue'
import { ConnectionRules } from '@/workflow/utils'
// 工作流ID
const workflowId = inject('workflowId')
const thisNodeId = inject('nodeId')
// 工作流store
const flowStore = useFlowStore(workflowId)
// 连线规则
const { createConnection } = new ConnectionRules(workflowId)
const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})
const isSubFlow = computed(() => {
  return !!flowStore.vueFlowRef.findNode(props.node.id).parentNode
})
const thisNode = flowStore.vueFlowRef.findNode(thisNodeId)
const thisParentNode = flowStore.vueFlowRef.findNode(thisNode.parentNode?.replace('-subFlow', ''))

const getParamName = (name) => {
  if (props.node.config.params.find((param) => param.name === name)) {
    let [namePrefix, nameSuffix] = name.split('-')
    name = getParamName(namePrefix + '-' + (Number(nameSuffix || 0) + 1))
  }
  return name
}

// 处理透传参数选择器选择事件
const handleSelect = (selected) => {
  const { id, name, type } = selected
  const paramsName = getParamName(name)
  props.node.config.params.push({
    name: paramsName,
    type,
    required: true
  })
  // 创建连线
  const [sourceId, sourceHandle] = id.split('.')
  flowStore.vueFlowRef.addEdges([
    createConnection({
      source: sourceId,
      target: thisParentNode.id,
      sourceHandle: sourceHandle,
      targetHandle: paramsName
    })
  ])
}

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

  .node-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    .node-title-text {
      flex: 1;
    }
  }
}
</style>
