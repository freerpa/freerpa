import { storeToRefs } from 'pinia'
import { useFlowStore } from '../store'
import { Message } from '@arco-design/web-vue'
import { locateNode } from '../utils'
import {
  validateWorkflow,
  findUnconnectedNodes,
  findMissingInputs
} from './validate'
export class WorkflowEngine {
  constructor(workflowId) {
    this.store = useFlowStore(workflowId)
    this.flowId = workflowId
    this.eventHandlers = new Map()
    this.status = 'idle'
    this.listener = []
  }

  // 事件处理
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event).add(handler)
    return () => this.eventHandlers.get(event)?.delete(handler)
  }

  // 触发事件
  emit(event, ...args) {
    this.eventHandlers.get(event)?.forEach((handler) => handler(...args))
  }

  // 设置工作流状态（状态源：engine.status；store 经 statusChange 事件同步 workflowStatus/isExecuting）
  setStatus(status) {
    this.status = status
    this.emit('statusChange', status)
    if (status === 'stopped' || status === 'error' || status === 'completed') {
      this.emit('beforeStop')
      this.cleanup()
      if (status === 'error') {
        throw new Error('工作流执行失败')
      }
    }
  }

  // 注册工作流状态事件（onFlowEvent 的 stateChange/onNotice 通道）
  registerStatusEvent() {
    // 监听工作流状态
    this.listener.push(
      window.electronAPI.onFlowEvent('stateChange', this.flowId, null, (event, state) => {
        this.setStatus(state.state)
      })
    )
    this.listener.push(
      window.electronAPI.onFlowEvent('onNotice', this.flowId, null, (event, data) => {
        this.store.onNotice(data)
      })
    )
  }

  // 创建工作流（运行前检测 + 构建执行数据）
  async create() {
    const { unConnectedNodes, needConnects } = storeToRefs(this.store)
    // 运行前完整检测（同步项 + 异步节点表单校验）；flowData 由 quickValidateWorkflow 生成并完成参数引用替换，检测与执行共用避免重复序列化
    const { errors, flowData } = await validateWorkflow(this.store)
    const byCode = (code) => errors.find((e) => e.code === code)

    // 缺少节点定义（本地插件被移除等）：阻止运行并定位第一个缺失节点
    const missing = byCode('missing-node')
    if (missing) {
      locateNode(this.store.vueFlowRef, missing.nodeIds)
      throw new Error(missing.message)
    }
    // 未连接节点：同步画布高亮状态并阻止运行
    const unconnectedList = findUnconnectedNodes(flowData)
    unConnectedNodes.value = unconnectedList
    const unconnected = byCode('unconnected')
    if (unconnected) {
      locateNode(this.store.vueFlowRef, unconnected.nodeIds)
      throw new Error(unconnected.message)
    }
    // required 输入未连接：同步画布高亮状态
    needConnects.value = findMissingInputs(flowData)
    const missingInput = byCode('missing-input')
    if (missingInput) {
      locateNode(this.store.vueFlowRef, missingInput.nodeIds)
      throw new Error(missingInput.message)
    }
    // 子流程结构损坏（容器/起始节点缺失）
    const subFlowBroken = byCode('subflow-structure')
    if (subFlowBroken) {
      locateNode(this.store.vueFlowRef, subFlowBroken.nodeIds)
      throw new Error(subFlowBroken.message)
    }
    // 节点配置表单校验失败
    const configInvalid = byCode('config-invalid')
    if (configInvalid) {
      locateNode(this.store.vueFlowRef, [configInvalid.nodeId])
      throw new Error(configInvalid.message)
    }
    // 参数引用无法解析
    const paramRef = byCode('param-ref')
    if (paramRef) {
      locateNode(this.store.vueFlowRef, paramRef.nodeIds)
      throw new Error(paramRef.message)
    }
    // 参数引用已由 quickValidateWorkflow 在副本上完成替换（检测通过则必然成功）
    return await window.electronAPI.emitFlowEvent('createEngine', null, null, flowData)
  }

  // 工作流执行
  async start() {
    try {
      const res = await this.create()
      if (!res.success) {
        throw new Error(res.message)
      }
    } catch (error) {
      Message.error(error.message)
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
    this.cleanup()
    this.emit('beforeStart')
    // 注册工作流状态事件
    this.registerStatusEvent()
    // 开始工作流
    await window.electronAPI.emitFlowEvent('startFlow', null, null, this.flowId)
    // 设置工作流状态为运行中
    this.setStatus('running')
    // 返回工作流id
    return this.flowId
  }

  // 停止工作流
  async stop() {
    try {
      // 如果工作流id存在，停止工作流
      if (this.flowId) {
        await window.electronAPI.emitFlowEvent('stopFlow', null, null, this.flowId)
      }
    } finally {
      // 清理工作流
      // this.cleanup()
    }
  }
  // 清理
  async cleanup() {
    this.listener.forEach((listener) => listener())
    this.listener = []
    this.emit('cleanup')
  }
}
