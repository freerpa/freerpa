/**
 * @file: 工作流历史记录管理
 */
import { computed, ref } from 'vue'
import { adjustParentSize } from './adjustParentSize'
import { ConnectionRules } from './connectionRules'
import nodes from '@nodes-path'
import { v4 as uuidv4 } from 'uuid'
import * as jsondiffpatch from 'jsondiffpatch';
class History {
  constructor(maxSize = 100, workflowId) {
    this.maxSize = maxSize
    this.undoStack = ref([])
    this.redoStack = ref([])
    this.currentState = null
    const { validateConnection } = new ConnectionRules(workflowId)
    this.validateConnection = validateConnection
  }

  // 计算两个状态之间的差异
  calculateDiff(oldState, newState) {
    const diff = {
      id: uuidv4(),
      added: [],
      removed: [],
      modified: [],
      dataChanged: []
    }

    // 计算节点差异
    const oldNodes = new Map(oldState.map((node) => [node.id, node]))
    const newNodes = new Map(newState.map((node) => [node.id, node]))

    // 找出添加和修改的节点
    newState.forEach((node) => {
      const oldNode = oldNodes.get(node.id)
      if (!oldNode) {
        diff.added.push(node)
      } else {
        if (oldNode?.hasOwnProperty('position') && oldNode?.hasOwnProperty('dimensions')) {
          const before = {}
          const after = {}
          if (oldNode.position.x !== node.position.x || oldNode.position.y !== node.position.y) {
            before.position = {
              x: oldNode.position.x,
              y: oldNode.position.y
            }
            after.position = {
              x: node.position.x,
              y: node.position.y
            }
          }
          // 子流程容器节点（vue-flow type='subFlow'）不记录尺寸变化（本身就是动态计算的会冲突）
          if (
            (oldNode.dimensions.width !== node.dimensions.width ||
              oldNode.dimensions.height !== node.dimensions.height) &&
            oldNode.type !== 'subFlow' &&
            (oldNode.dimensions.width || oldNode.dimensions.height)
          ) {
            before.dimensions = {
              width: oldNode.dimensions.width,
              height: oldNode.dimensions.height
            }
            after.dimensions = {
              width: node.dimensions.width,
              height: node.dimensions.height
            }

            // 可调整大小的节点才记录样式变化
            if (nodes[oldNode.data.type]?.resizable) {
              before.style = {
                width: oldNode.dimensions.width + 'px',
                height: oldNode.dimensions.height + 'px'
              }
              after.style = {
                width: node.dimensions.width + 'px',
                height: node.dimensions.height + 'px'
              }
            }
          }

          if (oldNode.parentNode !== node.parentNode) {
            before.parentNode = oldNode.parentNode
            after.parentNode = node.parentNode
          }

          if (oldNode.data.name !== node.data.name) {
            before.data = oldNode.data
            after.data = node.data
          }

          if (oldNode.hidden !== node.hidden) {
            before.hidden = oldNode.hidden
            after.hidden = node.hidden
          }
          const dataDiff = jsondiffpatch.diff(oldNode.data, node.data)
          if (dataDiff) {
            diff.dataChanged.push({
              id: node.id,
              diff: dataDiff
            })
          }

          if (Object.keys(before).length) {
            diff.modified.push({
              id: node.id,
              before,
              after
            })
          }
        }
      }
    })

    // 找出删除的节点
    oldState.forEach((node) => {
      if (!newNodes.has(node.id)) {
        diff.removed.push(node)
      }
    })

    return diff
  }

  // 应用差异
  applyDiff(flowRef, diff, isUndo = false) {
    if (isUndo) {
      // 撤销时反向应用差异
      // 1. 删除添加的节点和边
      const removedNodes = diff.added.filter((element) => element.id.startsWith('node-'))
      const removedEdges = diff.added.filter((element) => element.id.startsWith('edge-'))
      removedNodes.length &&
        flowRef.removeNodes(
          removedNodes.map((node) => node.id),
          true,
          true
        )
      removedEdges.length &&
        flowRef.removeEdges(removedEdges.filter((edge) => !edge.parentNode).map((edge) => edge.id))

      // 2. 恢复删除的节点和边
      const addedNodes = diff.removed.filter((element) => element.id.startsWith('node-'))
      addedNodes.length && flowRef.addNodes(addedNodes)
      const addedEdges = diff.removed
        .filter((element) => element.id.startsWith('edge-'))
        .filter(
          (edge) =>
            this.validateConnection(
              {
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle,
                targetHandle: edge.targetHandle
              },
              false,
              true
            ) || edge.targetHandle === 'subFlow'
        )
      addedEdges.length && flowRef.addEdges(addedEdges)

      // 3. 修改节点位置大小
      const modifiedNodes = diff.modified.map(({ id, before }) => ({
        id,
        ...before
      }))

      modifiedNodes.forEach((node) => {
        flowRef.updateNode(node.id, node)
      })
      adjustParentSize([...addedNodes, ...modifiedNodes, ...removedNodes], flowRef)
      // flowRef.updateNodePositions(modifiedNodes, true)

      //4.恢复数据变动
      diff.dataChanged.forEach(({ id, diff: dataDiff }) => {
        flowRef.updateNodeData(id, (node) => {
          // 恢复数据变动时，需要反向应用差异
          jsondiffpatch.unpatch(node.data, dataDiff)
        })
      })
    } else {
      // 重做时正向应用差异
      // 1. 添加新节点和边
      const addedNodes = diff.added.filter((element) => element.id.startsWith('node-'))
      addedNodes.length && flowRef.addNodes(addedNodes)
      const addedEdges = diff.added
        .filter((element) => element.id.startsWith('edge-'))
        .filter(
          (edge) =>
            this.validateConnection(
              {
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle,
                targetHandle: edge.targetHandle
              },
              false,
              true
            ) || edge.targetHandle === 'subFlow'
        )
      addedEdges.length && flowRef.addEdges(addedEdges)

      // 2. 删除需要删除的节点和边
      const removedNodes = diff.removed.filter((element) => element.id.startsWith('node-'))
      const removedEdges = diff.removed.filter((element) => element.id.startsWith('edge-'))
      removedNodes.length &&
        flowRef.removeNodes(
          removedNodes.map((node) => node.id),
          true,
          true
        )
      removedEdges.length &&
        flowRef.removeEdges(removedEdges.filter((edge) => !edge.parentNode).map((edge) => edge.id))

      // 3. 修改节点位置大小
      const modifiedNodes = diff.modified.map(({ id, after }) => ({
        id,
        ...after
      }))
      modifiedNodes.forEach((node) => {
        flowRef.updateNode(node.id, node)
      })
      adjustParentSize([...addedNodes, ...modifiedNodes, ...removedNodes], flowRef)
      // flowRef.updateNodePositions(modifiedNodes, true)

      //4.恢复数据变动
      diff.dataChanged.forEach(({ id, diff: dataDiff }) => {
        flowRef.updateNodeData(id, (node) => {
          // 重做时正向应用差异
          jsondiffpatch.patch(node.data, dataDiff)
        })
      })
    }
  }

  // 添加新状态
  push(state, flowRef) {
    if (this.currentState === null) {
      this.currentState = JSON.parse(JSON.stringify(state))
      return null
    }
    const diff = this.calculateDiff(this.currentState, state)
    // 如果有实际的改动才记录
    if (
      diff.added.length ||
      diff.removed.length ||
      diff.modified.length ||
      diff.dataChanged.length
    ) {
      this.undoStack.value.push(diff)
      this.redoStack.value = [] // 清空重做栈
      this.currentState = JSON.parse(JSON.stringify(state))
      // 限制栈大小
      if (this.undoStack.value.length > this.maxSize) {
        this.undoStack.value.shift()
      }
      if (diff.added.length || diff.removed.length) {
        adjustParentSize([...diff.added, ...diff.removed], flowRef)
      }
      return diff.id
    }
    return null
  }

  // 撤销
  undo(flowRef) {
    if (!this.canUndo.value) {
      return null
    }
    const diff = this.undoStack.value.pop()
    this.redoStack.value.push(diff)
    this.applyDiff(flowRef, diff, true)
    this.currentState = JSON.parse(JSON.stringify(flowRef.getElements))
    if (this.undoStack.value.length) {
      return this.undoStack.value[this.undoStack.value.length - 1].id
    }
    return null
  }

  // 重做
  redo(flowRef) {
    if (!this.canRedo.value) {
      return null
    }
    const diff = this.redoStack.value.pop()
    this.undoStack.value.push(diff)
    this.applyDiff(flowRef, diff, false)
    this.currentState = JSON.parse(JSON.stringify(flowRef.getElements))
    return diff.id
  }

  // 清空历史
  clear() {
    this.undoStack.value = []
    this.redoStack.value = []
    this.currentState = null
  }

  // 是否可以撤销
  canUndo = computed(() => {
    return this.undoStack.value.length > 0
  })

  // 是否可以重做
  canRedo = computed(() => {
    return this.redoStack.value.length > 0
  })
}

export { History }
