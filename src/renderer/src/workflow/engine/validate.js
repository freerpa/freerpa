/**
 * @file: 工作流运行前检测（独立于 WorkflowEngine，供「运行前」与「AI 改动后」复用）
 * - getFlowData：构建工作流执行数据（与 WorkflowEngine 原实现一致，检测与执行共用）
 * - resolveParamRefs：参数引用替换（纯函数，在副本上替换；错误可独立收集）
 * - quickValidateWorkflow：同步快速检测（缺节点定义/未连接/required 输入/参数引用/子流程结构）
 * - validateWorkflow：完整检测（含异步节点表单校验 validate）
 * 错误统一为 { code, nodeId?, nodeIds?, message }，code 便于定位与展示分级。
 */
import nodes from '@nodes-path'
import { getNodeGroupBySubFlow, getGlobleNodes, getLeafPathMap, paramReferRegex } from '../utils'

/** 构建工作流执行数据（深拷贝 config/inputs/outputs，排除 comment/subFlow 容器与停用节点）。id 为工作流 ID（engine 传入；检测场景可省略） */
export const getFlowData = (store, id) => {
  const flowData = {
    id: id ?? store.$id.replace(/^flow_/, ''),
    debug: store.debug,
    nodes: store.vueFlowRef.getNodes.filter(
      // 排除 comment 与 subFlow 容器节点：容器只作画布分组（子节点经 parentNode 关联），不参与执行
      (node) => node.type !== 'comment' && node.type !== 'subFlow' && !node.data.deactivate
    ).map((node) => {
      // 一次深拷贝（inputs/outputs/config 合并），避免逐字段 stringify+parse
      const data = JSON.parse(
        JSON.stringify({
          inputs: node.data.inputs || [],
          outputs: node.data.outputs || [],
          config: node.data.config || {}
        })
      )
      return {
        id: node.id,
        name: node.data.name,
        type: node.data.type,
        version: node.data.version || 'V1',
        deactivate: node.data.deactivate,
        parentNode: node.parentNode,
        subFlow: !!nodes[node.data.type]?.subFlow,
        inputs: data.inputs,
        outputs: data.outputs,
        config: data.config
      }
    }),
    edges: store.vueFlowRef.getEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      logic: edge.data.logic || 'and',
      condition: JSON.parse(JSON.stringify(edge.data.condition || [])),
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle
    }))
  }
  return flowData
}

/**
 * 参数引用替换（原 WorkflowEngine.replaceParamRefer 纯化）：
 * 在 flowData 副本上把配置中的 {{参数路径}} 替换为节点 id，返回替换结果与错误列表。
 * @returns {{ flowData: Object, errors: Array<{nodeId,nodeName,error}> }}
 */
export const resolveParamRefs = (flowData, vueFlowRef) => {
  const errors = []
  // 按照子流程分组（root 为主流程）
  const NodeGroupBySubFlow = getNodeGroupBySubFlow(vueFlowRef.getNodes)
  // 全局节点（参数可跨容器引用）
  const globalNodes = getGlobleNodes(vueFlowRef.getNodes)
  const LeafPathMaps = new Map()
  Object.keys(NodeGroupBySubFlow).forEach((parent) => {
    const groupNodes = NodeGroupBySubFlow[parent]
    // 合并全局参数节点
    groupNodes.push(...globalNodes)
    LeafPathMaps.set(parent, getLeafPathMap(groupNodes))
  })
  // 替换配置中的参数路径为节点 id
  flowData.nodes.forEach((node) => {
    // 特殊处理子流程节点（配置和输入项），同级参数引用规则限制，需要父节点传给子流程开始节点
    if (node.subFlow) {
      const startNode = flowData.nodes.find(
        (n) => n.parentNode === node.id + '-subFlow' && n.type === 'workflowStart'
      )
      if (startNode) {
        node.config = Object.assign(node.config, startNode.config)
        startNode.config = []
      }
    }
    try {
      // 无参数引用（{{...}}）的节点跳过序列化往返；有引用才 stringify → 替换 → parse
      const nodeConfigStr = JSON.stringify(node.config)
      if (nodeConfigStr.includes('{{')) {
        node.config = JSON.parse(
          nodeConfigStr.replace(paramReferRegex, (match) => {
            const paramPath = match.slice(2, -2) // 获取参数路径
            const LeafPathMap = LeafPathMaps.get(node.parentNode || 'root')
            const realPath = LeafPathMap.get(paramPath)
            if (realPath) {
              return '{{' + realPath.id + '}}'
            }
            throw new Error(`找不到【${paramPath}】的引用`)
          })
        )
      }
    } catch (error) {
      errors.push({
        nodeId: node.id,
        nodeName: node.name,
        error: `节点【${node.name}】错误：${error.message}`
      })
    }
  })
  return { flowData, errors }
}

/** 未连接节点（无 prev 输入连线；排除 start/comment/subFlow 容器）。O(n+m) 版，返回节点对象数组（含 id 供 UI 高亮） */
export const findUnconnectedNodes = (flowData) => {
  const prevConnected = new Set(
    flowData.edges.filter((edge) => edge.targetHandle === 'prev').map((edge) => edge.target)
  )
  return flowData.nodes.filter(
    (node) =>
      node.type !== 'workflowStart' && !node.id.includes('subFlow') && node.type !== 'comment' &&
      !prevConnected.has(node.id)
  )
}

/** required 输入未连接检测。O(n+m) 版，返回 [{nodeId,nodeName,inputId,inputName}] 供 UI 高亮 */
export const findMissingInputs = (flowData) => {
  const needConnect = []
  // target + targetHandle → edge 映射，避免逐输入线性扫描边
  const edgeMap = new Map()
  flowData.edges.forEach((edge) => {
    edgeMap.set(`${edge.target}|${edge.targetHandle}`, edge)
  })
  flowData.nodes.forEach((node) => {
    ;(node.inputs || []).forEach((input) => {
      if (input.required && !edgeMap.has(`${node.id}|${input.id}`)) {
        needConnect.push({
          nodeId: node.id,
          nodeName: node.name,
          inputId: input.id,
          inputName: input.name
        })
      }
    })
  })
  return needConnect
}

/** 子流程结构检测：subFlow 节点必须存在容器（id-subFlow）与容器内起始节点，否则渲染/执行会崩溃 */
const findSubFlowBroken = (flowData) => {
  const errors = []
  flowData.nodes
    .filter((node) => node.subFlow)
    .forEach((node) => {
      const container = flowData.nodes.find((n) => n.id === node.id + '-subFlow')
      if (!container) {
        errors.push({
          code: 'subflow-structure',
          nodeId: node.id,
          message: `节点【${node.name}】缺少子流程容器，请删除后重新添加`
        })
        return
      }
      const startNode = flowData.nodes.find(
        (n) => n.parentNode === node.id + '-subFlow' && n.type === 'workflowStart'
      )
      if (!startNode) {
        errors.push({
          code: 'subflow-structure',
          nodeId: node.id,
          message: `节点【${node.name}】子流程容器缺少起始节点，请删除后重新添加`
        })
      }
    })
  return errors
}

/**
 * 同步快速检测（AI 每次改动后与运行前共用，低开销）：
 * 缺节点定义（插件缺失）/ 未连接节点 / required 输入 / 参数引用 / 子流程结构。
 * @param {Object} store flowStore 实例
 * @returns {{ ok: boolean, errors: Array<{code,nodeId?,nodeIds?,message}> }}
 */
export const quickValidateWorkflow = (store) => {
  const errors = []
  const flowData = getFlowData(store)

  // 1. 缺少节点定义（本地插件被移除等）
  const missingNodes = flowData.nodes.filter((n) => !nodes[n.type])
  if (missingNodes.length > 0) {
    errors.push({
      code: 'missing-node',
      nodeIds: missingNodes.map((n) => n.id),
      message: `工作流包含 ${missingNodes.length} 个缺少本地插件的节点：${missingNodes
        .map((n) => `【${n.name}】`)
        .join('、')}，请安装对应插件后重新加载工作流`
    })
  }

  // 2. 未连接节点（无 prev 输入）
  const unconnected = findUnconnectedNodes(flowData)
  if (unconnected.length > 0) {
    errors.push({
      code: 'unconnected',
      nodeIds: unconnected.map((n) => n.id),
      message: `有未连接的节点：${unconnected.map((n) => `【${n.name}】`).join('、')}`
    })
  }

  // 3. required 输入未连接
  const missingInputs = findMissingInputs(flowData)
  if (missingInputs.length > 0) {
    errors.push({
      code: 'missing-input',
      nodeIds: missingInputs.map((i) => i.nodeId),
      message: `节点必填输入未连接：${missingInputs
        .map((i) => `【${i.nodeName}】的【${i.inputName}】`)
        .join('、')}`
    })
  }

  // 4. 子流程结构（容器/起始节点缺失）
  errors.push(...findSubFlowBroken(flowData))

  // 5. 参数引用解析（在副本上替换并收集错误，不修改画布数据）
  const { errors: paramRefErrors } = resolveParamRefs(flowData, store.vueFlowRef)
  if (paramRefErrors.length > 0) {
    errors.push({
      code: 'param-ref',
      nodeIds: paramRefErrors.map((e) => e.nodeId),
      message: paramRefErrors[0].error
    })
  }

  return { ok: errors.length === 0, errors, flowData }
}

/** 节点配置表单校验（async）：遍历节点 ref 的 validate 方法。返回 { code:'config-invalid', nodeId, message } */
const validateNodeForms = async (store) => {
  const errors = []
  const nodeRefs = store.nodeRefs
  for (const [nodeId, nodeRef] of nodeRefs) {
    if (!nodeRef || !nodeRef.validate) continue
    const node = store.vueFlowRef.getNode(nodeId)
    if (!node || node.data.deactivate) continue
    try {
      const res = await nodeRef.validate(true)
      if (!res) continue
      // 归一化校验结果：{ fieldId: { message } } → 提取 message 文本
      const fieldErrors = Object.keys(res)
        .filter((k) => Object.prototype.hasOwnProperty.call(res, k))
        .map((k) => res[k]?.message || res[k])
        .filter(Boolean)
      errors.push({
        code: 'config-invalid',
        nodeId,
        message: `节点【${node.data.name}】配置错误：${fieldErrors.join('；')}`
      })
    } catch {
      // 节点校验失败：错误已通过 event 上报，此处静默
    }
  }
  return errors
}

/**
 * 完整检测（运行前）：快速检测 + 节点配置表单校验（异步）。
 * @param {Object} store flowStore 实例
 * @param {Object} [opts]
 * @param {boolean} [opts.deep=true] 是否执行异步节点表单校验（AI 高频调用时可置 false）
 * @returns {Promise<{ ok: boolean, errors: Array }>}
 */
export const validateWorkflow = async (store, { deep = true } = {}) => {
  const quick = quickValidateWorkflow(store)
  if (!deep) return quick
  const configErrors = await validateNodeForms(store)
  return { ok: quick.ok && configErrors.length === 0, errors: [...quick.errors, ...configErrors], flowData: quick.flowData }
}
