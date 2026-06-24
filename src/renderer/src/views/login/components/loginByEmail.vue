<template>
  <!-- 登录表单 -->
  <div class="login-form">
    <a-form ref="loginFormRef" :model="loginForm" auto-label-width @submit="handleLogin">
      <a-form-item label="邮箱" field="email" :rules="[{ required: true, message: '请输入邮箱' }]">
        <a-input v-model="loginForm.email" placeholder="请输入邮箱" allow-clear>
          <template #prefix>
            <icon-email />
          </template>
        </a-input>
      </a-form-item>
      <a-form-item
        label="验证码"
        field="code"
        :rules="[{ required: true, message: '请输入验证码' }]"
      >
        <div class="verification-code">
          <a-input v-model="loginForm.code" placeholder="请输入验证码" allow-clear>
            <template #prefix>
              <icon-safe />
            </template>
          </a-input>
          <a-button
            type="outline"
            :disabled="!!countdown"
            :loading="sendingCode"
            @click="preSendSms"
          >
            {{ countdown ? `${countdown}s` : '获取验证码' }}
          </a-button>
        </div>
      </a-form-item>

      <a-form-item label="邀请码" field="invite_code">
        <a-input
          v-model="loginForm.invite_code"
          placeholder="邮箱登录暂不支持"
          allow-clear
          disabled
        >
          <template #prefix>
            <icon-user-group />
          </template>
        </a-input>
      </a-form-item>

      <a-button type="primary" html-type="submit" long :loading="loading">
        同意协议 并 登录
      </a-button>
    </a-form>
    <a-modal
      v-model:visible="captchaVisible"
      title="验证码"
      @before-ok="handleSendCode"
      width="400px"
    >
      <a-input
        v-model="captchaCode"
        placeholder="请输入验证码"
        allow-clear
        @press-enter="handleSendCode"
      >
        <template #prefix>
          <icon-safe />
        </template>
        <template #append>
          <a-image :preview="false" @click="() => _getCaptcha()" :src="captcha" />
        </template>
      </a-input>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import router from '@/router'
import { IconEmail, IconSafe, IconUserGroup } from '@arco-design/web-vue/es/icon'
import { getCaptcha, getEmailCode, loginByEmail } from '@/api/login'
import { setToken } from '@/utils/token'

const loading = ref(false)
const countdown = ref(0)

// 登录表单
const loginFormRef = ref(null)
const loginForm = ref({
  invite_code: '',
  email: localStorage.getItem('email') || '',
  code: ''
})

// 发送验证码状态
const sendingCode = ref(false)
let sendCodeTimer = null

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

//是否通过验证码
const captchaVisible = ref(false)
const captcha = ref('')
const captchaKey = ref('')
const captchaCode = ref('')

const _getCaptcha = async () => {
  const result = await getCaptcha()
  captchaCode.value = ''
  captcha.value = result.image
  captchaKey.value = result.uuid
}

const preSendSms = async () => {
  const email = loginForm.value.email
  if (!email) {
    return Message.warning('请先输入邮箱')
  }
  //验证手机号
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    return Message.warning('请输入正确的邮箱')
  }

  captchaVisible.value = true
  _getCaptcha()
}

// 发送验证码
const handleSendCode = async (done) => {
  if (!captchaCode.value) {
    Message.warning('请先输入验证码')
    done(false)
    return
  }
  if (captchaCode.value.length !== 4) {
    Message.warning('请输入正确的验证码')
    done(false)
    return
  }

  if (sendingCode.value) return
  try {
    sendingCode.value = true
    // 清除之前的定时器
    if (sendCodeTimer) {
      clearInterval(sendCodeTimer)
    }

    await getEmailCode(loginForm.value.email, 'login', captchaKey.value, captchaCode.value)

    Message.success('验证码已发送')
    captchaVisible.value = false

    countdown.value = 60
    sendCodeTimer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(sendCodeTimer)
        sendCodeTimer = null
      }
    }, 1000)
  } finally {
    _getCaptcha()
    sendingCode.value = false
  }
}

// 组件卸载时清理定时器
onUnmounted(() => {
  if (sendCodeTimer) {
    clearInterval(sendCodeTimer)
  }
})
</script>

<style lang="less" scoped>
.verification-code {
  display: flex;
  gap: 8px;

  :deep(.arco-input-wrapper) {
    flex: 1;
  }
}
</style>
