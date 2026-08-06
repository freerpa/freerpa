import { computed, watch } from 'vue'
import nodes from '@nodes-path'
import { parseConfigExpression } from '../../../utils'
import { resolveDynamicIO } from '../../../resolve-io.js'

/**
 * Composable for node input/output management
 * Handles dynamic inputs/outputs, sub-flow cross-boundary I/O, and edge validation
 */
export function useNodeIO(props, flowStore, nodeDefinition, allConfigFieldsWithGroup) {
  // Get node inputs (static + dynamic + subFlow start node outputs)
  const nodeInputs = computed(() => {
    const inputs = nodeDefinition?.inputs?.filter((input) => input.type !== 'dynamic') || []
    const dynamicInputs = resolveDynamicIO(
      nodeDefinition?.inputs?.filter((input) => input.type === 'dynamic'),
      props.data.config,
      'inputs'
    )

    let startNodeOutputs = []
    if (nodeDefinition?.subFlow) {
      const startNode = flowStore.vueFlowRef.getNodes.find(
        (node) => node.data.type === 'workflowStart' && node.parentNode === props.id + '-subFlow'
      )
      if (startNode) {
        startNodeOutputs = startNode.data.outputs.filter((output) => !output.isConfig)
      }
    }

    const allInputs = [...inputs, ...dynamicInputs, ...startNodeOutputs].filter((input) =>
      input.show
        ? parseConfigExpression(
            Object.values(allConfigFieldsWithGroup.value).flat(),
            'show',
            input.show,
            props.data.config
          )
        : true
    )
    props.data.inputs = allInputs
    return allInputs
  })

  // Get node outputs (static + dynamic + subFlow end node inputs)
  const nodeOutputs = computed(() => {
    try {
      const outputs = nodeDefinition?.outputs?.filter((output) => output.type !== 'dynamic') || []

      // Sub-flow start node: add parent's subFlow.startOutputs
      if (props.data.type === 'workflowStart') {
        const node = flowStore.vueFlowRef.findNode(props.id)
        if (node?.parentNode) {
          const parentId = node.parentNode.replace('-subFlow', '')
          const parentNode = flowStore.vueFlowRef.findNode(parentId)
          const parentDef = nodes[parentNode?.data?.type]
          if (parentNode && parentDef?.subFlow) {
            parentDef.subFlow.startOutputs?.forEach((item) => {
              outputs.push({
                id: item.id,
                name: item.name,
                type: item.type,
                description: item.description,
                isConfig: true
              })
            })
          }
        }
      }

      const dynamicOutputs = resolveDynamicIO(
        nodeDefinition?.outputs?.filter((output) => output.type === 'dynamic'),
        props.data.config,
        'outputs'
      )

      let endNodeInputs = []
      if (nodeDefinition?.subFlow && nodeDefinition.subFlow.endOutputs !== false) {
        const endNode = flowStore.vueFlowRef.getNodes.find(
          (node) => node.data.type === 'workflowEnd' && node.parentNode === props.id + '-subFlow'
        )
        if (endNode) {
          endNodeInputs = endNode.data.inputs
        }
      }

      const allOutputs = [...outputs, ...dynamicOutputs, ...endNodeInputs].filter((output) =>
        output.show
          ? parseConfigExpression(
              Object.values(allConfigFieldsWithGroup.value).flat(),
              'show',
              output.show,
              props.data.config
            )
          : true
      )
      props.data.outputs = allOutputs
      return allOutputs
    } catch {
      return []
    }
  })

  // Setup edge validation on I/O changes
  const setupEdgeValidation = (validateConnection) => {
    watch([nodeOutputs, nodeInputs], () => {
      const expireEdges = flowStore.vueFlowRef.getEdges
        .filter(
          (edge) =>
            [edge.source, edge.target].includes(props.id) &&
            edge.sourceHandle !== 'next' &&
            edge.sourceHandle !== 'next-false' &&
            edge.sourceHandle !== 'subFlow'
        )
        .filter((edge) => {
          return !validateConnection(
            {
              source: edge.source,
              target: edge.target,
              sourceHandle: edge.sourceHandle,
              targetHandle: edge.targetHandle
            },
            true
          )
        })
      if (expireEdges.length) {
        flowStore.vueFlowRef.removeEdges(expireEdges)
      }
    })
  }

  return {
    nodeInputs,
    nodeOutputs,
    setupEdgeValidation
  }
}
