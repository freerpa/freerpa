import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getProfile } from '@/api/user'

export const useStore = defineStore('store', () => {
  const clipboard = ref(null)
  const userInfo = ref(null)
  const updateVisible = ref(false)
  const hasUpdate = ref(false)
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

  // 全局登录 Modal
  const loginModalVisible = ref(false)
  const showLogin = () => { loginModalVisible.value = true }
  const closeLogin = () => { loginModalVisible.value = false }

  const setUserInfo = (info) => {
    userInfo.value = info
  }

  setTimeout(() => {
    if (!userInfo.value && localStorage.getItem('userId')) {
      getProfile().then((res) => {
        setUserInfo(res)
      }).catch(() => {})
    }
  }, 100)

  return {
    userInfo,
    clipboard,
    setUserInfo,
    openedTabs,
    switchTab,
    activeTab,
    updateVisible,
    setUpdateVisible: (visible) => {
      updateVisible.value = visible
    },
    hasUpdate,
    platform,
    isMacOS,
    loginModalVisible,
    showLogin,
    closeLogin
  }
})
