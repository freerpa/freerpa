import { computed, watch, ref } from 'vue'
import nodes from '@nodes-path'

/**
 * Composable for node configuration management
 * Extracts config fields grouping, quickConfig filtering, and config-related watchers
 */
export function useNodeConfig(props, flowStore, isPreview) {
  const nodeDefinition = nodes[props.data.type]

  // Inject error handling config for non-start/end nodes
  if (
    nodeDefinition &&
    nodeDefinition.type !== 'workflowStart' &&
    nodeDefinition.type !== 'workflowEnd'
  ) {
    nodeDefinition.config = nodeDefinition.config || {}
    nodeDefinition.config.errorHandle = {
      name: '执行配置',
      fields: {
        errorHandleType: {
          id: 'errorHandleType',
          name: '错误处理',
          type: 'select',
          description: '节点遇到错误时的处理方式',
          default: 'stop',
          paramRef: false,
          options: [
            { label: '忽略错误', value: 'ignore' },
            { label: '重试节点', value: 'retry' },
            { label: '指定节点', value: 'specify' },
            { label: '重试流程', value: 'retryFlow' },
            { label: '终止流程', value: 'stop' }
          ]
        },
        errorHandleRetryCount: {
          id: 'errorHandleRetryCount',
          name: '重试次数',
          type: 'number',
          description: '重试次数',
          show: "${errorHandleType}==='retry'",
          default: 3,
          paramRef: false
        },
        errorHandleRetryInterval: {
          id: 'errorHandleRetryInterval',
          name: '重试间隔',
          type: 'number',
          description: '重试间隔（毫秒）',
          show: "${errorHandleType}==='retry'",
          default: 1000,
          paramRef: false
        },
        errorHandleRetryFailed: {
          id: 'errorHandleRetryFailed',
          name: '重试失败',
          type: 'select',
          description: '重试次数超过最大重试次数时的处理方式',
          default: 'stop',
          show: "${errorHandleType}==='retry'",
          paramRef: false,
          options: [
            { label: '忽略错误', value: 'ignore' },
            { label: '指定节点', value: 'specify' },
            { label: '终止流程', value: 'stop' },
            { label: '重试流程', value: 'retryFlow' }
          ]
        },
        errorHandleSpecifyNode: {
          id: 'errorHandleSpecifyNode',
          name: '指定节点',
          type: 'select',
          description: '指定要跳转的节点',
          show: "${errorHandleType}==='specify' || ${errorHandleRetryFailed}==='specify'",
          paramRef: false,
          remote: true,
          options: [],
          remoteMethod: async (keyword = '') => {
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
          },
          default: ''
        }
      }
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
  const allConfigFieldsWithGroup = computed(() => {
    const groups = {}
    const config = nodeDefinition?.config
    if (!config) return groups
    Object.values(config).forEach((group) => {
      groups[group.name] = []
      Object.values(group.fields || {}).forEach((field) => {
        groups[group.name].push(field)
      })
    })
    return groups
  })

  // Quick config fields (marked as quickConfig or required)
  const quickConfigFields = computed(() => {
    const fields = []
    const config = nodeDefinition?.config
    if (!config) return fields
    Object.values(config).forEach((group) => {
      Object.values(group.fields || {}).forEach((field) => {
        if (field.quickConfig || field.required) {
          fields.push(field)
        }
      })
    })
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

    // Watch deactivate/global changes for history
    watch(
      () => [props.data.deactivate, props.data.global],
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
