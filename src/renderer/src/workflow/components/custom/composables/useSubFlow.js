import { computed } from 'vue'
import { adjustParentSize } from '../../../utils'

/**
 * Composable for sub-flow expand/collapse management
 */
export function useSubFlow(props, flowStore, nodeDefinition, isExecuting) {
  // Whether the node can have sub-flow expansion
  const isAllowExpand = computed(() => {
    return nodeDefinition?.subFlow && !(props.data.workFlow && props.data.workFlow.only_node)
  })

  // Toggle sub-flow visibility
  const toggleSubFlow = (id, isChild = false) => {
    if (isExecuting.value) return

    const subFlowNode = flowStore.vueFlowRef.getNode(id)
    if (!subFlowNode) return

    const isFirstExpand =
      subFlowNode.dimensions.width === 0 && subFlowNode.dimensions.height === 0
    const hidden = isChild ? subFlowNode.hidden : !subFlowNode.hidden
    subFlowNode.hidden = hidden

    // When expanding, adjust position if overlap
    if (id.endsWith('subFlow')) {
      const subFlowParentNode = flowStore.vueFlowRef.getNode(id.slice(0, -8))
      if (subFlowParentNode) {
        subFlowParentNode.data.subFlowExpand = !hidden
        if (!hidden) {
          if (subFlowParentNode.dimensions.height + 50 > subFlowNode.position.y) {
            subFlowNode.position.y = subFlowParentNode.dimensions.height + 100
          }
        }
      }
    }

    const getChildNodes = (node) => {
      return flowStore.vueFlowRef.getNodes.filter((el) => el.parentNode === node.id)
    }

    const childNodes = getChildNodes(subFlowNode)
    childNodes.forEach((node) => {
      node.hidden = hidden
      if (!isAllowExpand.value) return
      if (hidden && getChildNodes(node).length > 0) {
        toggleSubFlow(node.id, true)
      }
    })

    // On first expand, adjust parent size after layout
    if (isFirstExpand && !hidden) {
      const { off: offNodesInitialized } = flowStore.vueFlowRef.onNodesInitialized(() => {
        offNodesInitialized()
        setTimeout(() => {
          adjustParentSize(childNodes, flowStore.vueFlowRef)
        }, 49)
      })
    }

    flowStore.onNodesChange([{ id, type: 'hidden' }])
  }

  return {
    isAllowExpand,
    toggleSubFlow
  }
}
