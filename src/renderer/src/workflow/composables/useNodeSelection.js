import { ref, computed, nextTick } from 'vue'
import nodes from '@nodes-path'
import { getNodeConfigFields } from '../config/nodeConfigFields.js'

/**
 * 画布选中状态管理：节点选中追踪、配置抽屉显隐、选中节点配置字段（含 errorHandleSpecifyNode remoteMethod 注入）
 * 从 FlowCanvas 提取，负责 178-254 行区块
 * @param {Object} flowStore pinia store（onNodesChange）
 * @param {Object} vueFlowRef vue-flow 实例 ref
 */
export function useNodeSelection(flowStore, vueFlowRef) {
  const selectedNodes = ref([])

  /** 包装 store 的 onNodesChange，在节点增删或选择变化后同步选中状态 */
  const handleNodesChange = (changes) => {
    flowStore.onNodesChange(changes)
    if (changes.length === 0) return
    const type = changes[0]?.type
    if (type === 'select' || type === 'remove' || type === 'add') {
      nextTick(() => {
        selectedNodes.value = vueFlowRef.value?.getSelectedNodes || []
      })
    }
  }

  /** 选中的自定义节点（排除 comment/subFlow 类型） */
  const selectedCustomNodes = computed(() => {
    return selectedNodes.value.filter((n) => n.type === 'custom' && n.data?.type)
  })

  /** 有且仅有一个可配置节点选中时才显示抽屉 */
  const configDrawerVisible = computed(() => {
    if (selectedCustomNodes.value.length !== 1) return false
    const node = selectedCustomNodes.value[0]
    const def = nodes[node.data?.type]
    if (!def) return false
    // 检查是否有配置字段
    const groups = getNodeConfigFields(node.data?.type)
    return Object.keys(groups).length > 0
  })

  /** 缓存最后有效节点 ID — 确保关闭时 key 不变，让 Transition 正常触发 leave 动画 */
  const _cachedNodeId = ref('')

  /** 当前选中的节点 ID */
  const selectedNodeId = computed(() => {
    const id = configDrawerVisible.value ? selectedCustomNodes.value[0]?.id : ''
    if (id) _cachedNodeId.value = id
    return id || _cachedNodeId.value
  })

  /** 当前选中节点的 data 对象 */
  const selectedNodeData = computed(() => {
    return configDrawerVisible.value ? selectedCustomNodes.value[0]?.data : { config: {} }
  })

  /** 选中节点的配置字段分组 */
  const selectedNodeConfigFields = computed(() => {
    if (!configDrawerVisible.value) return {}
    const nodeId = selectedCustomNodes.value[0]?.id
    const fields = getNodeConfigFields(selectedCustomNodes.value[0]?.data?.type)

    // 为 errorHandleSpecifyNode 注入可用的 remoteMethod
    if (fields['执行配置']) {
      const specifyField = fields['执行配置'].find((f) => f.id === 'errorHandleSpecifyNode')
      if (specifyField) {
        specifyField.remoteMethod = async (keyword = '') => {
          const node = vueFlowRef.value?.findNode(nodeId)
          if (!node) return []
          let nodesList = vueFlowRef.value?.getNodes.filter(
            (n) => n.parentNode === node.parentNode && n.id !== node.id
          ) || []
          if (keyword) {
            nodesList = nodesList.filter((n) => n.data.name.includes(keyword))
          }
          return nodesList.map((el) => ({
            label: el.data.name,
            value: el.id
          }))
        }
      }
    }

    return fields
  })

  return {
    selectedNodes,
    handleNodesChange,
    selectedCustomNodes,
    configDrawerVisible,
    selectedNodeId,
    selectedNodeData,
    selectedNodeConfigFields
  }
}
