import { computed, watch, ref } from 'vue'
import nodes from '@nodes-path'
import { IconExclamationCircle } from '@arco-design/web-vue/es/icon'
import { buildErrorHandleGroup, getConfigFieldGroups } from '../../../nodes/common.js'

/**
 * 占位节点定义：当工作流中的节点类型（如 plu_<插件id>）未注册时兜底，
 * 通常是本地插件被移除/目录丢失。避免 CustomNode 模板因 nodeDefinition 缺失崩溃，
 * 并给出「缺少本地插件」的明确提示（_placeholder 标记供视图层展示）。
 */
const PLACEHOLDER_DEF = {
  name: '缺少本地插件',
  description: '本地插件未安装或已被移除，请安装对应插件后重新加载工作流',
  icon: IconExclamationCircle,
  view: false,
  subFlow: false,
  resizable: false,
  inputs: [],
  outputs: [],
  config: {},
  _placeholder: true
}

/**
 * Composable for node configuration management
 * Extracts config fields grouping, quickConfig filtering, and config-related watchers
 */
export function useNodeConfig(props, flowStore, isPreview) {
  // 占位定义：输入输出与配置字段定义取自节点保存的数据（_pluginConfig），
  // 使插件缺失时仍能渲染连线口与配置表单
  const nodeDefinition = nodes[props.data.type] || {
    ...PLACEHOLDER_DEF,
    type: props.data.type,
    inputs: props.data.inputs || [],
    outputs: props.data.outputs || [],
    config: props.data._pluginConfig || [],
    description: `本地插件「${props.data.config?._pluginName || props.data.name}」未安装或已被移除，请安装对应插件后重新加载工作流`
  }

  // Inject error handling config for non-start/end nodes
  if (
    nodeDefinition &&
    nodeDefinition.type !== 'workflowStart' &&
    nodeDefinition.type !== 'workflowEnd'
  ) {
    nodeDefinition.config = nodeDefinition.config || []
    if (!nodeDefinition.config.some((g) => g?.id === 'errorHandle')) {
      nodeDefinition.config.push(
        buildErrorHandleGroup(
          async (keyword = '') => {
            const node = flowStore.vueFlowRef.findNode(props.id)
            let nodesList = flowStore.vueFlowRef.getNodes.filter(
              (n) => n.parentNode === node.parentNode && n.id !== node.id
            )
            if (keyword) {
              nodesList = nodesList.filter((n) => n.data.name.includes(keyword))
            }
            return nodesList.map((el) => ({
              label: el.data.name,
              value: el.id
            }))
          }
        )
      )
    }
  }

  // Node config data with getter/setter
  const nodeConfig = computed({
    get() {
      return isPreview.value ? {} : props.data.config
    },
    set(value) {
      props.data.config = value
    }
  })

  // All config fields grouped by config group name
  const allConfigFieldsWithGroup = computed(() => getConfigFieldGroups(nodeDefinition))

  // Quick config fields (marked as quickConfig or required)
  const quickConfigFields = computed(() => {
    const fields = []
    for (const group of nodeDefinition?.config || []) {
      for (const field of group?.fields || []) {
        if (field.quickConfig || field.required) {
          fields.push(field)
        }
      }
    }
    return fields
  })

  // Quick config ref placeholder — set by parent
  const quickConfigRef = ref(null)

  const setupConfigWatchers = () => {

    // Watch quickConfigRef init
    watch(
      () => quickConfigRef.value,
      (value) => {
        if (value) {
          flowStore.nodeRefs.set(props.id, quickConfigRef.value)
        } else {
          flowStore.nodeRefs.delete(props.id)
        }
      }
    )

    // Watch deactivate changes for history
    watch(
      () => props.data.deactivate,
      () => {
        flowStore.onNodesChange([{ id: props.id, type: 'data' }])
      }
    )

    // Watch config changes for history (debounced)
    let configTimer = null
    watch(
      nodeConfig,
      () => {
        if (configTimer) clearTimeout(configTimer)
        configTimer = setTimeout(() => {
          flowStore.onNodesChange([{ id: props.id, type: 'data' }])
        }, 300)
      },
      { deep: true }
    )
  }

  return {
    nodeDefinition,
    nodeConfig,
    allConfigFieldsWithGroup,
    quickConfigFields,
    quickConfigRef,
    setupConfigWatchers
  }
}
