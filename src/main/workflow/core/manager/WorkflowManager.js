import WorkflowExecutor from '../executor/WorkflowExecutor'

class WorkflowManager {
  constructor() {
    this.engines = new Map()
  }

  // 获取运行中的工作流数量
  getRunningWorkflowCount() {
    let count = 0
    this.engines.forEach((engine) => {
      if (engine.state === 'running') {
        count++
      } else {
        engine.cleanup()
        this.engines.delete(engine.id)
      }
    })
    return count
  }

  // 创建工作流引擎
  async createEngine(workflow) {
    try {
      // 免登录模式：不再从远程获取限制，使用高默认值
      const limits = { workflow_limit: 999 }

      if (limits.workflow_limit <= this.getRunningWorkflowCount()) {
        throw new Error(`同时运行的工作流数量超过限制：${limits.workflow_limit} 个`)
      }
      // 验证工作流数据
      if (!workflow || typeof workflow !== 'object') {
        throw new Error('Invalid workflow data')
      }
      if (!Array.isArray(workflow.nodes)) {
        throw new Error('Workflow nodes must be an array')
      }
      if (!Array.isArray(workflow.edges)) {
        throw new Error('Workflow edges must be an array')
      }

      const id = workflow.id
      if (!id) {
        throw new Error('Workflow id is required')
      }

      if (this.engines.has(id)) {
        await this.removeEngine(id)
      }

      const engine = new WorkflowExecutor({
        id,
        debug: workflow.debug,
        allNodes: workflow.nodes,
        allEdges: workflow.edges,
        nodes: workflow.nodes,
        edges: workflow.edges
      })
      this.engines.set(id, engine)
      return engine
    } catch (error) {
      throw new Error(error)
    }
  }

  // 获取工作流引擎
  getEngine(id) {
    return this.engines.get(id)
  }

  // 移除工作流引擎
  async removeEngine(id) {
    const engine = this.engines.get(id)
    if (engine) {
      await engine.cleanup()
      this.engines.delete(id)
    }
  }

  // 清理工作流引擎
  async cleanup() {
    await Promise.all(
      Array.from(this.engines.values()).map((engine) => engine.cleanup())
    )
    this.engines.clear()
  }
}

export default new WorkflowManager()
