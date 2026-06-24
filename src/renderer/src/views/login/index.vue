<template>
  <div class="login-container">
    <div class="title-bar"><TitleBar /></div>

    <div class="login-box">
      <div class="login-header">
        <img :src="logoImg" alt="logo" class="logo" />
        <h2>{{ appName }}</h2>
      </div>
      <LoginByPhone />
      <div class="form-actions">
        <a-link @click="openTermsModal">用户协议</a-link>
        <a-divider direction="vertical" />
        <a-link @click="contactCustomerService">联系客服</a-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, h } from 'vue'
import { Modal } from '@arco-design/web-vue'
import TitleBar from '@/layout/components/TitleBar.vue'
import logoImg from '../../../../../build/icon.png'
import { getUserAgreement, getCustomerService } from '@/api/login'
import LoginByPhone from './components/loginByPhone.vue'
import pkg from '../../../../../package.json'
const appName = ref(pkg.name)

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

// 登录类型
const loginType = ref('phone')
</script>

<style lang="less" scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  // background: linear-gradient(to right bottom, #50a3a2 0%, #53e3a6 100%);
  .arco-link {
    color: var(--color-text-1);
  }
  .title-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
  }
  .login-box {
    width: 400px;
    padding: 40px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 8px;
    // box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
    // z-index: 1000;

    .login-header {
      text-align: center;
      margin-bottom: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;

      .logo {
        width: 64px;
        height: 64px;
      }

      h2 {
        margin: 0;
        font-size: 40px;
        font-weight: bold;
        color: var(--color-text-1);
      }
    }

    .login-type {
      margin-bottom: 20px;
      display: flex;
      justify-content: center;
      flex-direction: column;
      align-items: center;
    }

    .form-actions {
      margin-top: 20px;
      text-align: center;
    }
  }
}
</style>
