import { ref, provide } from 'vue'
import { deepClone } from '../../../utils'

/**
 * Composable for node event registration and engine lifecycle
 * Handles event listeners, node status tracking, and cleanup
 */
export function useNodeEvents(props, workflowId, flowStore, nodeViewRef, debug) {
  const nodeStatus = ref('initializing')
  const errMsg = ref('')
  const debugInfos = ref([])

  // Send event to main process
  const sendNodeEvent = async (params) => {
    return new Promise((resolve, reject) => {
      try {
        window.electronAPI.emitFlowEvent(
          'nodeEvent',
          workflowId,
          props.id,
          deepClone(params),
          (response) => {
            if (response.error) {
              reject(new Error(response.error))
            } else {
              resolve(response)
            }
          }
        )
      } catch (error) {
        reject(error)
      }
    })
  }

  provide('sendNodeEvent', sendNodeEvent)

  // Register all node event listeners
  const registerNodeEvents = () => {
    const unsubscribeEvent = window.electronAPI.onFlowEvent(
      'nodeEvent',
      workflowId,
      props.id,
      async (event, params, callback) => {
        try {
          if (nodeViewRef.value?.onNodeEvent) {
            await nodeViewRef.value.onNodeEvent(params, callback)
          }
        } catch (error) {
          if (callback) {
            callback({ error: error.message })
          }
        }
      }
    )

    const unsubscribeStatus = window.electronAPI.onFlowEvent(
      'nodeStatus',
      workflowId,
      props.id,
      (event, status) => {
        if (status.state !== 'stopped') {
          nodeStatus.value = status.state
        } else if (
          status.state === 'stopped' &&
          (nodeStatus.value === 'running' || nodeStatus.value === 'retrying')
        ) {
          nodeStatus.value = status.state
        }
        if (status.result) {
          props.data.result = status.result
        }
        if (status.error) {
          errMsg.value = status.error
        }
      }
    )

    const unsubscribeDebug =
      (debug.value &&
        window.electronAPI.onFlowEvent('debug', workflowId, props.id, (event, debugInfo) => {
          debugInfos.value.push(debugInfo)
        })) ||
      (() => {})

    return () => {
      unsubscribeStatus()
      unsubscribeEvent()
      unsubscribeDebug()
    }
  }

  // Setup engine lifecycle hooks
  let cleanup = null
  const setupEngineLifecycle = () => {
    const engine = flowStore.engine
    engine.on('beforeStart', () => {
      if (cleanup) {
        cleanup()
      }
      nodeStatus.value = 'initializing'
      errMsg.value = ''
      cleanup = registerNodeEvents()
    })
    engine.on('beforeStop', async () => {
      if (nodeStatus.value === 'running' || nodeStatus.value === 'retrying') {
        nodeStatus.value = 'initializing'
        errMsg.value = ''
      }
      if (cleanup) {
        await cleanup()
      }
    })
  }

  return {
    nodeStatus,
    errMsg,
    debugInfos,
    sendNodeEvent,
    setupEngineLifecycle
  }
}
