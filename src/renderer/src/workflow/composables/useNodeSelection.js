import { ref, computed, nextTick } from 'vue'
import nodes from '@nodes-path'
import { getNodeConfigFields } from '../config/nodeConfigFields.js'

/**
 * 画布节点配置抽屉：仅在用户「点击节点并因此选中」时展示，
 * 框选、批量选中、程序化选中（如新增节点自动选中）都不会弹出，避免误触。
 * @param {Object} flowStore pinia store（onNodesChange）
 * @param {Object} vueFlowRef vue-flow 实例 ref
 */
export function useNodeSelection(flowStore, vueFlowRef) {
  /** 用户主动点击的节点 ID（配置抽屉的唯一触发源） */
  const clickedNodeId = ref('')

  /** 包装 store 的 onNodesChange：被点击节点取消选中/删除时关闭抽屉 */
  const handleNodesChange = (changes) => {
    flowStore.onNodesChange(changes)
    if (changes.length === 0 || !clickedNodeId.value) return
    const type = changes[0]?.type
    if (type === 'select' && changes.some((c) => c.id === clickedNodeId.value && c.selected === false)) {
      clickedNodeId.value = ''
    } else if (type === 'remove' && changes.some((c) => c.id === clickedNodeId.value)) {
      clickedNodeId.value = ''
    }
  }

  /** 节点点击：等选中态落定后判定，Cmd/Shift 多选时不弹出 */
  const handleNodeClick = ({ node }) => {
    if (!node) return
    const flow = vueFlowRef.value
    nextTick(() => {
      const selected = flow?.getSelectedNodes || []
      clickedNodeId.value = selected.length === 1 && selected[0].id === node.id ? node.id : ''
    })
  }

  /** 点击画布空白处关闭抽屉 */
  const clearClickedNode = () => {
    clickedNodeId.value = ''
  }

  /** 当前可配置节点（点击触发 + 自定义节点） */
  const activeNode = computed(() => {
    const id = clickedNodeId.value
    if (!id) return null
    const node = vueFlowRef.value?.findNode?.(id)
    if (!node || node.type !== 'custom' || !node.data?.type) return null
    return node
  })

  /** 点击的节点存在且拥有配置字段时才显示抽屉 */
  const configDrawerVisible = computed(() => {
    const node = activeNode.value
    if (!node || !nodes[node.data.type]) return false
    return Object.keys(getNodeConfigFields(node.data.type)).length > 0
  })

  /** 缓存最后有效节点 ID — 确保关闭时 key 不变，让 Transition 正常触发 leave 动画 */
  const _cachedNodeId = ref('')

  /** 当前配置的节点 ID */
  const selectedNodeId = computed(() => {
    const id = configDrawerVisible.value ? activeNode.value?.id : ''
    if (id) _cachedNodeId.value = id
    return id || _cachedNodeId.value
  })

  /** 当前配置节点的 data 对象 */
  const selectedNodeData = computed(() => {
    return configDrawerVisible.value ? activeNode.value?.data : { config: {} }
  })

  /** 当前配置节点的配置字段分组 */
  const selectedNodeConfigFields = computed(() => {
    if (!configDrawerVisible.value) return {}
    const nodeId = activeNode.value?.id
    const fields = getNodeConfigFields(activeNode.value?.data?.type)

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
    handleNodesChange,
    handleNodeClick,
    clearClickedNode,
    configDrawerVisible,
    selectedNodeId,
    selectedNodeData,
    selectedNodeConfigFields
  }
}
