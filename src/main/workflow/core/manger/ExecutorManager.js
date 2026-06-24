import NodeExecutor from '../executor/NodeExecutor'

class ExecutorManager {
  constructor(engine) {
    this.engine = engine
    this.executors = new Map()
  }

  // 创建执行器
  create(node) {
    const executor = new NodeExecutor(node, {
      engine: this.engine,
      flowId: this.engine.id,
      nodeId: node.id
    })
    this.executors.set(node.id, executor)
    return executor
  }

  // 获取执行器
  get(nodeId) {
    return this.executors.get(nodeId)
  }

  // 清理执行器
  cleanup() {
    this.executors.forEach(async (executor) => {
      await executor.cleanup()
    })
    this.executors.clear()
  }
}

export default ExecutorManager
