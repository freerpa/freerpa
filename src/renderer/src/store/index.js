import { defineStore } from 'pinia'
import { ref, h, defineComponent, markRaw, computed } from 'vue'
import { Modal } from '@arco-design/web-vue'
import router from '@/router'
import vipSvg from '../../../../resources/vip.svg?asset'
import { getProfile, getUserLimits } from '@/api/user'
import { getEnvironments } from '@/api/browser'
export const useStore = defineStore('store', () => {
  const clipboard = ref(null)
  const userInfo = ref(null)
  const userLimits = ref(null)
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

  // 清空浏览器列表
  const clearStoreEnvList = () => {
    envList.value = []
  }

  // 获取浏览器列表
  const getEnvList = async (keyword = '', force = false) => {
    if (envList.value.length > 0 && !force) {
      return envList.value.filter((env) => env.name.includes(keyword))
    }
    const res = await getEnvironments({
      page: 1,
      pageSize: 1000,
      keyword
    })
    envList.value = res.list
    return envList.value
  }


  const setUserInfo = (info) => {
    userInfo.value = info
    getUserLimits().then((res) => {
      userLimits.value = res
    })
  }

  setTimeout(() => {
    if (!userInfo.value && localStorage.getItem('userId')) {
      getProfile().then((res) => {
        setUserInfo(res)
      })
    }
    getEnvList()
  }, 100)

  const vipIcon = defineComponent({
    name: 'vipIcon',
    props: {
      size: {
        type: [String, Number],
        default: 16
      }
    },
    computed: {
      _size() {
        if (typeof this.size === 'number') {
          return this.size + 'px'
        }
        return this.size
      }
    },
    render() {
      return h(
        'div',
        {
          style: {
            height: this._size || '16px',
            width: this._size || '16px',
            fontSize: this._size || '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }
        },
        h('img', { src: vipSvg, style: { width: '100%', height: '100%' } })
      )
    }
  })

  const isVip = () => {
    if (!userInfo.value.vip || new Date(userInfo.value.vip).getTime() < new Date().getTime()) {
      Modal.open({
        title: h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }
          },
          [vipIcon.render(), '会员功能']
        ),
        content: '您还不是会员，无法使用该功能',
        width: 300,
        simple: false,
        hideCancel: false,
        okText: '去开通',
        onOk: () => {
          router.push('/user')
        }
      })
      return false
    }
    return true
  }

  return {
    userInfo,
    userLimits,
    clipboard,
    setUserInfo,
    isVip,
    openedTabs,
    switchTab,
    activeTab,
    vipIcon: markRaw(vipIcon),
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
    isMacOS
  }
})
