import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { createWorkflowEngine } from '../engine'
import { saveWorkflow as saveWorkflowAPI } from '@/api/workflow'
import { adjustParentSize, encryptedData, History } from '../utils'
import { debounce } from 'lodash-es'
export const useFlowStore = (id) =>
  defineStore(`flow_${id}`, () => {
    const vueFlowRef = ref(null)
    const workflowStatus = ref('idle')
    // 初始化完成
    const initialized = ref(false)
    // 节点引用
    const nodeRefs = ref(new Map())
    // 是否在拖拽
    const isDragging = ref(false)
    // 开始拖拽节点
    const dragStartNode = ref(false)
    // 历史记录
    const history = new History(1000, id)
    // 是否在历史记录中
    const isHistorying = ref(false)
    // 未连接的节点
    const unConnectedNodes = ref([])
    // 需要传入的参数
    const needConnects = ref([])
    // 是否开启调试模式
    const debug = ref(false)
    // 交叉节点
    const IntersectingNode = ref(null)
    // 是否按住ctrl
    const isCtrl = ref(false)
    // 创建引擎
    const engine = ref(createWorkflowEngine(id))
    // 是否执行中
    const isExecuting = ref(false)
    // 当前激活的节点tab
    const activeNodeTab = ref('流程控制')
    // 监听状态变化
    engine.value.on('statusChange', (status, error) => {
      isExecuting.value = status === 'running'
      if (status === 'completed') {
        Message.success('工作流执行完成')
      }
      if (status === 'error') {
        Message.error(`工作流执行失败`)
      }
    })

    const onNodesChange = (e) => {
      // console.log('onNodesChange', e)
      if (e.length === 0) {
        return
      }
      if (e[0].type === 'select') {
        setEdgeSelected(e)
        return
      }
      // 更新父节点区域
      if (!isCtrl.value) {
        // console.log('adjustParentSize',e, vueFlowRef.value);
        adjustParentSize(
          e.filter((node) => node.dragging || node.resizing === false),
          vueFlowRef.value
        )
      }
      // 保存历史记录
      if (
        e[0]?.type === 'add' ||
        e[0]?.type === 'remove' ||
        e[0]?.type === 'data' ||
        e[0]?.type === 'hidden' ||
        e[0]?.dragging === false ||
        e[0]?.resizing === false
      ) {
        saveHistory()
      }
    }

    // 设置边的选中状态
    const setEdgeSelected = (e) => {
      e.forEach((item) => {
        vueFlowRef.value.getEdges
          .filter((edge) => edge.source === item.id || edge.target === item.id)
          .forEach((edge) => {
            setTimeout(
              () => {
                edge.selected = item.selected
              },
              item.selected ? 10 : 0
            )
          })
      })
    }

    const savedHistoryId = ref(null)
    const nowHistoryId = ref(null)
    const saveHistory = debounce(() => {
      if (!initialized.value) {
        return
      }
      // 判断是否在拖拽和操作历史记录中
      if (isHistorying.value) {
        return
      }
      // 保存当前状态到历史记录
      const historyId = history.push(vueFlowRef.value.getElements, vueFlowRef.value)
      if (historyId) {
        nowHistoryId.value = historyId
      }
    }, 100)

    //解除历史中状态
    const historyIngDebounce = debounce(() => {
      isHistorying.value = false
    }, 300)
    // 撤销
    const undo = () => {
      isHistorying.value = true
      nowHistoryId.value = history.undo(vueFlowRef.value, isHistorying)
      historyIngDebounce()
    }

    // 重做
    const redo = () => {
      isHistorying.value = true
      const redoId = history.redo(vueFlowRef.value, isHistorying)
      if (redoId) {
        nowHistoryId.value = redoId
      }
      historyIngDebounce()
    }

    const isSaved = computed(() => {
      return savedHistoryId.value === nowHistoryId.value
    })
    const saveIng = ref(false)
    // 保存工作流
    const saveWorkflow = async () => {
      if (isSaved.value || saveIng.value) {
        return
      }
      saveIng.value = true
      const elements = JSON.stringify(vueFlowRef.value.toObject())
      try {
        await saveWorkflowAPI({
          id: id,
          elements: await encryptedData(elements)
        })
        savedHistoryId.value = nowHistoryId.value
        Message.success('保存成功')
      } catch (error) {
        Message.error(`保存失败: ${error.message}`)
      } finally {
        saveIng.value = false
      }
    }
    const onNotice = (data) => {
      notices.value.unshift({
        type: data.type,
        nodeId: data.nodeId,
        content: data.content,
        time: new Date().toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
      })
      // 显示系统通知
      window.electronAPI.system.showNotification({
        id: id,
        title: '工作流通知',
        subtitle: data.content,
        silent: playAudio.value ? false : true,
        sound: 'system',
      }, (params) => {
        if (params.action === 'click') {
          console.log('点击了通知')
        }
      })
    }
    const notices = ref([])
    const noticeNum = computed(() => notices.value.length)
    const playAudio = ref(true)
    const reset = () => {
      vueFlowRef.value?.$reset()
      vueFlowRef.value = null
      noticeNum.value = 0
      notices.value = []
      playAudio.value = true
      needConnects.value = []
      nowHistoryId.value = null
      savedHistoryId.value = null
      setTimeout(() => {
        isExecuting.value = false
        isDragging.value = false
        workflowStatus.value = 'idle'
        history.clear()
      }, 200)
    }

    return {
      // 数据导出
      initialized,
      nodeRefs,
      isDragging,
      dragStartNode,
      notices,
      noticeNum,
      playAudio,
      vueFlowRef,
      unConnectedNodes,
      needConnects,
      isExecuting,
      engine,
      workflowStatus,
      saveIng,
      isSaved,
      saveWorkflow,
      IntersectingNode,
      activeNodeTab,
      isCtrl,
      debug,
      canUndo: computed(() => {
        if (isExecuting.value) {
          return false
        }
        return history.canUndo.value
      }),
      canRedo: computed(() => {
        if (isExecuting.value) {
          return false
        }
        return history.canRedo.value
      }),
      //函数导出
      reset,
      undo,
      redo,
      onNodesChange,
      saveHistory,
      onNotice,
    }
  })()
