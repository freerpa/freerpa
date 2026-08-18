import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useStore = defineStore('store', () => {
  const clipboard = ref(null)
  const activeTab = ref('home')
  const openedTabs = ref({})
  const switchTab = (id) => {
    activeTab.value = id
    for (const tabId of Object.keys(openedTabs.value)) {
      openedTabs.value[tabId].visible = tabId === id
    }
  }

  const platform = ref('')
  window.electronAPI.app.getPlatform().then((res) => {
    platform.value = res
  })

  const isMacOS = computed(() => platform.value === 'darwin')

  // ═══ 应用更新状态 ══════════════════════════════
  const updateInfo = ref(null) // checkUpdate 结果：{ hasUpdate, version, updateLog, downloadUrl, currentVersion }
  const updateModalVisible = ref(false)
  const updateVisible = ref(false) // 标题栏「有更新」按钮显隐

  /** 检查更新（主进程 IPC）；检测到新版本时亮起标题栏按钮，用户点击打开更新弹窗 */
  const checkUpdate = async () => {
    try {
      const res = await window.electronAPI.app.checkUpdate()
      if (res?.error) {
        console.warn('[update] 自动检查更新失败:', res.error)
        updateInfo.value = null
        updateVisible.value = false
        return { ok: false, error: res.error }
      }
      if (!res.hasUpdate) {
        updateInfo.value = null
        updateVisible.value = false
        return { ok: true, hasUpdate: false }
      }
      updateInfo.value = res
      updateVisible.value = true
      return { ok: true, hasUpdate: true }
    } catch (e) {
      console.error('[update] 检查更新异常:', e?.message || e)
      updateInfo.value = null
      return { ok: false, error: e?.message || String(e) }
    }
  }

  return {
    clipboard,
    openedTabs,
    switchTab,
    activeTab,
    platform,
    isMacOS,
    updateInfo,
    updateModalVisible,
    updateVisible,
    checkUpdate,
  }
})
