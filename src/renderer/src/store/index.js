import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getProfile } from '@/api/user'

const { browserLocal: localBrowserAPI } = window.electronAPI
export const useStore = defineStore('store', () => {
  const clipboard = ref(null)
  const userInfo = ref(null)
  const updateVisible = ref(false)
  const hasUpdate = ref(false)
  const envList = ref([])
  const activeTab = ref('home')
  const openedTabs = ref({})
  const switchTab = (id) => {
    activeTab.value = id
    for (const tabId of Object.keys(openedTabs.value)) {
      openedTabs.value[tabId].visible = tabId === id
    }
  }

  const currentEnv = ref({
    url: '',
    browser_type: 'pc',
    browser_width: 1280,
    browser_height: 720,
    browser_ua: '',
    storage: {},
    cookies: []
  })

  const platform = ref('')
  window.electronAPI.app.getPlatform().then((res) => {
    platform.value = res
  })

  const isMacOS = computed(() => platform.value === 'darwin')

  // 全局登录 Modal
  const loginModalVisible = ref(false)
  const showLogin = () => { loginModalVisible.value = true }
  const closeLogin = () => { loginModalVisible.value = false }

  // 清空浏览器列表
  const clearStoreEnvList = () => {
    envList.value = []
  }

  // 获取浏览器列表
  const getEnvList = async (keyword = '', force = false) => {
    if (envList.value.length > 0 && !force) {
      return envList.value.filter((env) => env.name.includes(keyword))
    }
    const res = await localBrowserAPI.getBrowsers({
      page: 1,
      pageSize: 1000,
      keyword
    })
    envList.value = res.data
    return envList.value
  }


  const setUserInfo = (info) => {
    userInfo.value = info
  }

  setTimeout(() => {
    if (!userInfo.value && localStorage.getItem('userId')) {
      getProfile().then((res) => {
        setUserInfo(res)
      }).catch(() => {})
    }
    getEnvList().catch(() => {})
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
    envList,
    getEnvList,
    clearStoreEnvList,
    currentEnv,
    platform,
    isMacOS,
    loginModalVisible,
    showLogin,
    closeLogin
  }
})
