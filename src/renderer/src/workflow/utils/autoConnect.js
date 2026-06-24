//判断类型是否互相包含
const isConnectable = (sourceOutput, targetInput) => {
  let sourceType = sourceOutput.type || 'string'
  let targetType = targetInput.type || 'string'

  if (typeof sourceType == 'string') {
    sourceType = [sourceType]
  }

  if (typeof targetType == 'string') {
    targetType = [targetType]
  }

  return (
    sourceType.some((type) => targetType.includes(type)) ||
    targetType.some((type) => sourceType.includes(type)) ||
    targetType.includes('any') ||
    sourceType.includes('any')
  )
}

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
      node.data.outputs
        .filter((output) => specialDataTypes.includes(output.type))
        .forEach((output) => {
          const outputSet = specialOutputMap.get(output.type) || new Set()
          outputSet.add(node)
          specialOutputMap.set(output.type, outputSet)
        })
    })
  // 如果sourceNode和targetNode都存在则流程连线
  if (sourceNode && targetNode) {
    edges.push(
      createConnection({
        source: sourceNode.id,
        target: targetNode.id,
        sourceHandle: handleId,
        targetHandle: 'prev'
      })
    )
  }
  //获取sourceNode的输出和targetNode的输入
  await new Promise((resolve) => setTimeout(resolve, 1))
  const sourceOutputs = sourceNode ? sourceNode.data.outputs : []
  const targetInputs = targetNode ? targetNode.data.inputs : []

  // 如果sourceNode的输出和targetNode的输入都存在且只有一个并且类型相同则连线
  if (
    sourceOutputs.length == 1 &&
    targetInputs.length == 1 &&
    isConnectable(sourceOutputs[0], targetInputs[0]) &&
    !specialDataTypes.includes(targetInputs[0].type)
  ) {
    edges.push(
      createConnection({
        source: sourceNode.id,
        target: targetNode.id,
        sourceHandle: sourceOutputs[0].id,
        targetHandle: targetInputs[0].id
      })
    )
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
        edges.push(
          createConnection({
            source: output.id,
            target: targetNode.id,
            sourceHandle: output.data.outputs.find((item) => item.type == input.type).id,
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
      // 遍历sourceNode的输出（有可能出现同一个输出同时连接多个输入）所以先不用此规则
      // sourceOutputs.forEach((output) => {
      //   // 如果输入和输出类型相同或输入和输出类型为any则连线
      //   if (input.type == output.type) {
      //     edges.push(
      //       createConnection({
      //         source: sourceNode.id,
      //         target: targetNode.id,
      //         sourceHandle: output.id,
      //         targetHandle: input.id
      //       })
      //     )
      //   }
      // })
    })
    // 添加连线
  }
  //判断是否有相同的连线
  const isConnected = (edge) => {
    return vueFlowRef.getEdges.find(
      (item) =>
        item.source == edge.source &&
        item.target == edge.target &&
        item.sourceHandle == edge.sourceHandle &&
        item.targetHandle == edge.targetHandle
    )
  }
  //过滤出没有相同连线的连线
  vueFlowRef.addEdges(edges.filter((edge) => !isConnected(edge)))
}
