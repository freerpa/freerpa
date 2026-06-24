<template>
  <!-- 登录表单 -->
  <div class="login-form">
    <div class="qrcode-container">
      <div class="qrcode-mask" v-if="!checked">
        <div class="qrcode-mask-content">
          <!-- <icon-wechat size="130" /> -->
          <div class="qrcode-mask-content-text">请先阅读并同意《用户协议》</div>
        </div>
      </div>
      <a-image class="qrcode-img" :preview="false" :src="qrcodeUrl" alt="微信登录二维码" />

      <a-button
        class="refresh-btn"
        shape="circle"
        @click="_getWeChatCode"
        :loading="loading"
        :disabled="!checked"
      >
        <template #icon>
          <icon-refresh />
        </template>
      </a-button>
    </div>
    <a-checkbox v-model="checked" @change="handleChecked" style="margin-top: 32px">
      <span>我已阅读并同意《用户协议》</span>
    </a-checkbox>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import router from '@/router'
import { IconRefresh, IconWechat } from '@arco-design/web-vue/es/icon'
import { getWeChatCode, loginByWeChat } from '@/api/login'
import { setToken } from '@/utils/token'

const loading = ref(false)
const checked = ref(false)
const qrcodeUrl = ref('')
onMounted(() => {
  _getWeChatCode()
})

const _getWeChatCode = async () => {
  loading.value = true
  const res = await getWeChatCode()
  qrcodeUrl.value = res
  loading.value = false
}
// 处理登录
const handleLogin = async () => {
  try {
    const validate = await loginFormRef.value.validate()
    if (validate) return
    loading.value = true

    const result = await loginByEmail({
      email: loginForm.value.email,
      code: loginForm.value.code,
      invite_code: loginForm.value.invite_code
    })
    // 设置token和过期时间(假设后端返回expires字段表示过期秒数)
    setToken(result.token.access_token, result.token.expires_in)
    localStorage.setItem('userId', result.userinfo.id)
    localStorage.setItem('email', loginForm.value.email)

    Message.success('登录成功')
    router.replace('/')
  } finally {
    loading.value = false
  }
}
</script>

<style lang="less" scoped>
.login-form {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  .qrcode-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    .qrcode-mask {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(255, 255, 255, 0.5);
      border-radius: 8px;
      z-index: 100;
      .qrcode-mask-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        .qrcode-mask-content-text {
          font-size: 14px;
          color: #000;
          font-weight: bold;
          text-align: center;
          background-color: #fff;
          padding: 30px 0;
          position: absolute;
          bottom: 0;
        }
      }
    }
    .qrcode-img {
      width: 202px;
      height: 220px;
      border-radius: 8px;
      box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
      border: 1px solid var(--color-border-2);
      overflow: hidden;
    }
    .refresh-btn {
      width: 30px;
      height: 30px;
      position: absolute;
      bottom: -15px;
      right: 50%;
      transform: translateX(50%);
      background-color: #fff;
      box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
      border: 1px solid var(--color-border-2);
      z-index: 100;
      &:hover {
        background-color: var(--color-primary-light-1);
      }
    }
  }
}
</style>
