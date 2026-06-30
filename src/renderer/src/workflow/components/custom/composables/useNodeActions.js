import { ref } from 'vue'

/**
 * Composable for node action handling
 * rename, copy, delete, deactivate, global toggle, detail view
 */
export function useNodeActions(props, flowStore, emit) {
  const renameMode = ref(false)
  const nodeName = ref(props.data.name)

  // Check if node name is valid and non-duplicate
  const checkNodeName = (name) => {
    if (
      !name ||
      ['开始流程', '结束流程'].includes(name) ||
      !/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(name)
    )
      return true
    const node = flowStore.vueFlowRef.findNode(props.id)
    if (!node) return false
    return flowStore.vueFlowRef.getNodes
      .filter((n) => n.parentNode === node.parentNode && n.id !== node.id)
      .some((el) => el.data.name === name)
  }

  // Save node name after rename
  const saveNodeName = () => {
    if (!checkNodeName(nodeName.value)) {
      props.data.name = nodeName.value
      flowStore.onNodesChange([{ id: props.id, type: 'data' }])
    }
    renameMode.value = false
  }

  // Handle node toolbar actions
  const actionSelect = (key) => {
    switch (key) {
      case 'delete':
        emit('action', 'delete', props.id)
        break
      case 'copy':
        emit('action', 'copy', props.id)
        break
      case 'rename':
        if (['workflowStart', 'workflowEnd'].includes(props.data.type)) return
        nodeName.value = props.data.name
        renameMode.value = true
        break
      case 'detail':
        emit('openWorkflowDetail', props.data?.workFlow?.id)
        break
      case 'deactivate':
        props.data.deactivate = true
        break
      case 'global':
        props.data.global = !props.data.global
        break
    }
  }

  return {
    renameMode,
    nodeName,
    checkNodeName,
    saveNodeName,
    actionSelect
  }
}
