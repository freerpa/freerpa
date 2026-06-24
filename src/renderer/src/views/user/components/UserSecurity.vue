<template>
  <a-card title="" :bordered="false">
    <a-list>
      <!-- 修改密码 -->
      <!-- <a-list-item>
        <div class="security-item">
          <div class="item-info">
            <div class="title">登录密码</div>
            <div class="desc">建议您定期更换密码，设置一个包含字母、数字和符号的密码会更安全</div>
          </div>
          <a-button type="text" @click="showPasswordModal = true">修改</a-button>
        </div>
      </a-list-item> -->

      <!-- 绑定手机 -->
      <a-list-item>
        <div class="security-item">
          <div class="item-info">
            <div class="title">手机绑定</div>
            <div class="desc">
              {{ profileForm.phone ? `已绑定手机：${profileForm.phone}` : '未绑定手机号' }}
            </div>
          </div>
          <!-- <a-button type="text" @click="showPhoneModal = true">
            {{ profileForm.phone ? '修改' : '绑定' }}
          </a-button> -->
        </div>
      </a-list-item>

      <!-- 安全目录 -->
      <a-list-item>
        <div class="security-item">
          <div class="item-info">
            <div class="title">
              安全目录
              <a-typography-text type="danger">
                <small>注意：为了您的计算机安全，工作流仅能操作安全目录下的文件</small>
              </a-typography-text>
            </div>
            <div class="desc">
              {{ profileForm.allowedRoot ?? '未设置' }}
            </div>
          </div>
          <div class="actions">
            <a-button type="text" @click="setAllowedRoot">设置</a-button>
            <a-button type="text" @click="openAllowedRoot">打开</a-button>
          </div>
        </div>
      </a-list-item>
      <!-- 邮箱绑定 -->
      <!-- <a-list-item>
        <div class="security-item">
          <div class="item-info">
            <div class="title">邮箱绑定</div>
            <div class="desc">{{ profileForm.email }}</div>
          </div>
          <a-button type="text" disabled>已绑定</a-button>
        </div>
      </a-list-item> -->
    </a-list>

    <!-- 修改手机号弹窗 -->
    <a-modal v-model:visible="showPhoneModal" title="绑定手机" @before-ok="handleChangePhone">
      <a-form ref="phoneFormRef" :model="phoneForm">
        <a-form-item
          field="phone"
          label="手机号"
          :rules="[
            { required: true, message: '请输入手机号' },
            { match: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }
          ]"
        >
          <a-input v-model="phoneForm.phone" placeholder="请输入手机号" allow-clear />
        </a-form-item>

        <a-form-item
          field="code"
          label="验证码"
          :rules="[{ required: true, message: '请输入验证码' }]"
        >
          <div class="verification-code">
            <a-input v-model="phoneForm.code" placeholder="请输入验证码" allow-clear />
            <a-button type="outline" :disabled="!!countdown" @click="handleSendCode">
              {{ countdown ? `${countdown}s` : '获取验证码' }}
            </a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { bindPhone } from '@/api/user'

const showPhoneModal = ref(false)
const phoneFormRef = ref(null)
const countdown = ref(0)

import { useStore } from '@/store'
const { userInfo } = useStore()

const setAllowedRoot = async () => {
  const res = await window.electronAPI.dialog.openPath({
    title: '选择安全目录',
    buttonLabel: '选择',
    properties: ['openDirectory']
  })
  if (!res.canceled) {
    window.electronAPI.store.set('allowedRoot', res.filePaths[0])
    profileForm.value.allowedRoot = res.filePaths[0]
  }
}

const openAllowedRoot = async () => {
  window.electronAPI.shell.openPath(profileForm.value.allowedRoot)
}

// 用户资料
const profileForm = ref({
  phone: userInfo.phone,
  allowedRoot: ''
})

onMounted(async () => {
  profileForm.value.allowedRoot = await window.electronAPI.store.get('allowedRoot')
})

const phoneForm = ref({
  phone: userInfo.phone,
  code: ''
})

// 处理修改手机号
const handleChangePhone = async () => {
  try {
    const valid = await phoneFormRef.value.validate()
    if (valid) return false
    await bindPhone(phoneForm.value)
    Message.success('手机号绑定成功')
    showPhoneModal.value = false
    phoneFormRef.value.resetFields()
    return true
  } catch (error) {
    return false
  }
}

// 发送验证码
const handleSendCode = async () => {
  if (!phoneForm.value.phone) {
    return Message.warning('请先输入手机号')
  }

  try {
    // TODO: 调用发送验证码接口
    countdown.value = 60
    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
    Message.success('验证码已发送')
  } catch (error) {
    Message.error('发送验证码失败')
  }
}
</script>

<style lang="less" scoped>
.security-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  .item-info {
    .title {
      font-size: 14px;
      color: var(--color-text-1);
      margin-bottom: 4px;
    }
    .desc {
      font-size: 12px;
      color: var(--color-text-3);
    }
  }
}

.verification-code {
  display: flex;
  gap: 8px;

  :deep(.arco-input-wrapper) {
    flex: 1;
  }
}
</style>
