<template>
  <div class="layout">
    <TitleBar />
    <div class="layout-content">
      <SideMenu @settingsCenter="showSettingsCenter" />
      <div class="layout-page">
        <router-view v-slot="{ Component }">
          <transition>
            <keep-alive>
              <component :is="Component" />
            </keep-alive>
          </transition>
        </router-view>
      </div>
    </div>
    <template v-for="(tab, id) in openedTabs" :key="id">
      <div class="tab-content" v-show="tab.visible">
        <div v-if="tab.type === 'workflow'" class="workflow-editor">
          <Workflow :show-editor="tab.visible" :workflow-id="id" :visible="tab.visible" />
        </div>
        <div v-if="tab.type === 'dataViewer'" class="data-viewer">
          <DataViewer :model="tab.model" :visible="tab.visible" />
        </div>
      </div>
    </template>

    <!-- 我的 -->
    <a-modal
      v-model:visible="myCenterVisible"
      title="我的"
      width="1000px"
      body-style="padding: 0;height: 600px"
      unmount-on-close
      :footer="false"
    >
      <MyCenter @logout="onLogout" />
    </a-modal>

    <!-- 设置 -->
    <a-modal
      v-model:visible="settingsCenterVisible"
      title="设置"
      width="900px"
      body-style="padding: 0;height: 600px"
      unmount-on-close
      :footer="false"
    >
      <SettingsCenter />
    </a-modal>

    <!-- 全局登录 Modal -->
    <a-modal
      v-model:visible="loginModalVisible"
      :footer="false"
      :mask-closable="false"
      width="420px"
      :body-style="{ padding: '32px 40px' }"
    >
      <div class="login-modal-box">
        <LoginByPhone @success="onLoginSuccess" />
        <div class="form-actions">
          <a-link @click="openTermsModal">用户协议</a-link>
          <a-divider direction="vertical" />
          <a-link @click="contactCustomerService">联系客服</a-link>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, h, provide } from 'vue'
import { Modal } from '@arco-design/web-vue'
import { storeToRefs } from 'pinia'
import TitleBar from './components/TitleBar.vue'
import SideMenu from './components/SideMenu.vue'
import MyCenter from '@/views/my/index.vue'
import SettingsCenter from '@/views/settings/index.vue'
import Workflow from '@/workflow/index.vue'
import DataViewer from '@/views/data/components/DataViewer.vue'
import LoginByPhone from '@/views/login/components/loginByPhone.vue'
import { getUserAgreement, getCustomerService } from '@/api/login'
import { getProfile } from '@/api/user'
import { useStore } from '@/store'

const store = useStore()
const { openedTabs, loginModalVisible } = storeToRefs(store)
const { closeLogin, setUserInfo, showLogin } = store

// 监听全局登录事件（API 401 时触发）
window.addEventListener('show-login', () => showLogin())

const myCenterVisible = ref(false)
const settingsCenterVisible = ref(false)

const showMyCenter = () => {
  myCenterVisible.value = true
}

const showSettingsCenter = () => {
  settingsCenterVisible.value = true
}

provide('showMyCenter', showMyCenter)

const onLogout = () => {
  myCenterVisible.value = false
}

// 登录成功回调
const onLoginSuccess = async () => {
  closeLogin()
  try {
    const info = await getProfile()
    setUserInfo(info)
  } catch (e) {
    // ignore
  }
}

// 联系客服
const contactCustomerService = async () => {
  const result = await getCustomerService()
  Modal.open({
    title: '联系客服',
    content: h('div', {
      class: 'editor-content-view',
      innerHTML: result
    }),
    width: '50%',
    bodyStyle: {
      padding: '20px',
      height: '70vh',
      overflow: 'auto'
    },
    footer: false,
    maskClosable: false
  })
}

// 打开用户协议模态框
const openTermsModal = async () => {
  const agreement = await getUserAgreement()
  Modal.open({
    title: '用户协议',
    content: h('div', {
      class: 'editor-content-view',
      innerHTML: agreement
    }),
    width: '80%',
    bodyStyle: {
      padding: '20px',
      height: '80vh',
      overflow: 'auto'
    },
    footer: false,
    maskClosable: false
  })
}
</script>

<style lang="less" scoped>
.layout {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-1);

  &-content {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  &-page {
    flex: 1;
    height: 100%;
    overflow: hidden;

    :deep(> *) {
      height: 100%;
    }
  }

  .tab-content {
    height: calc(100vh - 40px);
    background-color: var(--color-bg-2);
    position: fixed;
    top: 40px;
    left: 0;
    width: 100vw;
    z-index: 1000;
    .workflow-editor {
      height: 100%;
      width: 100%;
    }
    .data-viewer {
      padding: 20px;
      height: 100%;
      width: 100%;
    }
  }
}
</style>
