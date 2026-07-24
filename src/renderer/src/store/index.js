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

  return {
    clipboard,
    openedTabs,
    switchTab,
    activeTab,
    platform,
    isMacOS,
  }
})
