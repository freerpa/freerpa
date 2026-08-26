import { isTypeConnectable } from './typeMatch'

//自动连线
export const autoConnect = async (
  vueFlowRef,
  createConnection,
  sourceNode,
  targetNode,
  handleId = 'next'
) => {

  const specialOutputMap = new Map()
  const edges = []
  const specialDataTypes = ['page', 'websocket', 'tempStore', 'dataQuery', 'counter','timer','workbook','worksheet']
  vueFlowRef.getNodes
    .filter((node) => node.parentNode === targetNode.parentNode)
    .forEach((node) => {
      // subFlow 容器节点（type='subFlow'）没有 outputs 字段，必须防 undefined
      ;(node.data?.outputs || [])
        .filter((output) => specialDataTypes.includes(output.type))
        .forEach((output) => {
          const outputSet = specialOutputMap.get(output.type) || new Set()
          outputSet.add(node)
          specialOutputMap.set(output.type, outputSet)
        })
    })
  // 如果sourceNode和targetNode都存在则流程连线
  if (sourceNode && targetNode) {
    const edge = createConnection({
      source: sourceNode.id,
      target: targetNode.id,
      sourceHandle: handleId,
      targetHandle: 'prev'
    })
    // createConnection 不做校验（Vue Flow 拖线时由 validate-connection 拦截）；
    // 编程式调用必须自己防 null/残缺边，否则后续 isConnected/addEdges 读 null 崩溃
    if (edge && edge.source && edge.target) {
      edges.push(edge)
    }
  }
  const sourceOutputs = sourceNode ? sourceNode.data.outputs : []
  const targetInputs = targetNode ? targetNode.data.inputs : []

  // 如果sourceNode的输出和targetNode的输入都存在且只有一个并且类型相同则连线
  if (
    sourceOutputs.length == 1 &&
    targetInputs.length == 1 &&
    isTypeConnectable(sourceOutputs[0].type, targetInputs[0].type) &&
    !specialDataTypes.includes(targetInputs[0].type)
  ) {
    const edge = createConnection({
      source: sourceNode.id,
      target: targetNode.id,
      sourceHandle: sourceOutputs[0].id,
      targetHandle: targetInputs[0].id
    })
    if (edge && edge.source && edge.target) {
      edges.push(edge)
    }
  } else {
    //遍历targetNode的输入
    targetInputs.forEach((input) => {
      //如果输入是特殊类型节点且特殊类型节点只有一个并且输入节点没有连线则连线
      const inputEdges = vueFlowRef.getEdges.filter(
        (edge) => edge.target == targetNode.id && edge.targetHandle == input.id
      )
      //根据输入类型获取特殊类型节点
      const outputSet = specialOutputMap.get(input.type) || new Set()
      //如果特殊类型节点只有一个并且输入节点没有连线则连线
      if (outputSet.size == 1 && inputEdges.length == 0) {
        const output = outputSet.values().next().value
        const sourceHandle = output.data.outputs.find((item) => item.type == input.type)?.id
        if (!sourceHandle) return
        edges.push(
          createConnection({
            source: output.id,
            target: targetNode.id,
            sourceHandle,
            targetHandle: input.id
          })
        )
        return
      } else if (sourceNode && input.type == 'page') {
        const sourcePageEdge = vueFlowRef.getEdges.find(
          (edge) => edge.target == sourceNode.id && edge.sourceHandle === 'page'
        )
        if (sourcePageEdge) {
          edges.push(
            createConnection({
              source: sourcePageEdge.source,
              target: targetNode.id,
              sourceHandle: 'page',
              targetHandle: input.id
            })
          )
        }
      }
    })
  }
  // 把已有边浇铸为组合键 Set，O(1) 判重（原 `edges.filter(!isConnected)` 内嵌 find 为 O(边数²)）
  const existingKeySet = new Set(
    vueFlowRef.getEdges.map(
      (item) => `${item.source}|${item.target}|${item.sourceHandle}|${item.targetHandle}`
    )
  )
  vueFlowRef.addEdges(
    edges.filter((edge) => {
      if (!edge || !edge.source || !edge.target) return false
      const key = `${edge.source}|${edge.target}|${edge.sourceHandle}|${edge.targetHandle}`
      if (existingKeySet.has(key)) return false
      existingKeySet.add(key) // 多个候选同 key 时只保留第一个
      return true
    })
  )
}
