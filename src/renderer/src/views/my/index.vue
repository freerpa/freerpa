<template>
  <div class="my-center">
    <div class="nav-menu">
      <a-menu :selected-keys="[activeTab]" @menu-item-click="handleMenuClick">
        <a-menu-item key="profile">
          <template #icon><icon-user /></template>
          个人资料
        </a-menu-item>
        <a-menu-item key="security">
          <template #icon><icon-safe /></template>
          安全设置
        </a-menu-item>
        <a-menu-item key="logout">
          <template #icon><icon-export /></template>
          退出登录
        </a-menu-item>
      </a-menu>
    </div>
    <div class="content">
      <UserProfile v-if="activeTab === 'profile'" />
      <UserSecurity v-if="activeTab === 'security'" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { IconUser, IconSafe, IconExport } from '@arco-design/web-vue/es/icon'
import UserProfile from '@/views/user/components/UserProfile.vue'
import UserSecurity from '@/views/user/components/UserSecurity.vue'
import { Modal } from '@arco-design/web-vue'
import { useRouter } from 'vue-router'
import { useStore } from '@/store'
import { storeToRefs } from 'pinia'

const store = useStore()
const { openedTabs } = storeToRefs(store)
const activeTab = ref('profile')
const router = useRouter()
const emit = defineEmits(['logout'])

const handleMenuClick = (key) => {
  if (key === 'logout') {
    handleLogout()
    return
  }
  activeTab.value = key
}

const handleLogout = () => {
  let content = '确认退出登录吗？'
  if (Object.keys(openedTabs.value).length > 0) {
    content = '确认退出登录吗？\n当前有未关闭的标签页，退出后将丢失未保存的内容。'
  }
  Modal.confirm({
    title: '退出登录',
    width: 350,
    content,
    okText: '退出',
    okButtonProps: { status: 'danger', type: 'primary', style: { width: '135px' } },
    cancelButtonProps: { style: { width: '135px' } },
    async onOk() {
      openedTabs.value = {}
      emit('logout')
      router.push('/login')
    }
  })
}
</script>

<style lang="less" scoped>
.my-center {
  display: flex;
  height: 100%;
  .nav-menu {
    width: 200px;
    background-color: var(--color-bg-2);
    padding: 8px;
    border-right: solid 1px var(--color-border);
  }
  .content {
    flex: 1;
    background-color: var(--color-bg-2);
    border-radius: 4px;
    overflow: auto;
  }
}
</style>
