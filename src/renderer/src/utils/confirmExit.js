import { Modal } from '@arco-design/web-vue'

let confirmModal = null

/**
 * 退出软件确认框（与标题栏原「关闭软件」确认一致）：
 * 确认后走 window.electronAPI.window.close()（主进程清理引擎/浏览器后 app.exit）
 * @param {string} content 确认文案（可附带未保存提示）
 */
export const confirmExit = (content = '确认关闭软件吗？') => {
  confirmModal?.close()
  confirmModal = Modal.confirm({
    title: '关闭软件',
    width: 350,
    content,
    okText: '关闭',
    okButtonProps: {
      status: 'danger',
      type: 'primary',
      style: {
        width: '135px'
      }
    },
    cancelButtonProps: {
      style: {
        width: '135px'
      }
    },
    onOk() {
      window.electronAPI.window.close()
    }
  })
}
