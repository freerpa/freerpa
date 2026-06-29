<template>
  <a-card :bordered="false">
    <template #title>
      个人资料
      <a-button type="text" @click="fetchProfile"> 刷新 </a-button>
    </template>
    <a-form ref="formRef" :model="profileForm" @submit="handleSubmit" auto-label-width>
      <a-form-item label="我的邀请码" field="invite_code">
        <a-typography-paragraph class="user-item" copyable>
          {{ profileForm?.my_invite_code }}
        </a-typography-paragraph>
      </a-form-item>

      <!-- 原有的个人资料表单内容 -->
      <a-form-item label="手机号" field="phone">
        <a-typography-paragraph class="user-item" copyable>
          {{ profileForm?.phone }}
        </a-typography-paragraph>
      </a-form-item>

      <a-form-item label="积分" field="points">
        <a-space>
          <a-typography-paragraph class="user-item">
            {{ profileForm?.points }}
          </a-typography-paragraph>
          <a-button type="secondary" @click="handleRecharge"> 获取积分 </a-button>
          <a-button type="secondary" @click="showPointsLog"> 积分记录 </a-button>
          <a-button type="secondary" @click="useExchangeCodeVisible = true"> 使用兑换码 </a-button>
        </a-space>
      </a-form-item>
      <!-- 会员 -->
      <a-form-item label="头像" field="avatar" :rules="[{ required: true, message: '请上传头像' }]">
        <image-upload
          ref="imageUploadRef"
          v-model="profileForm.avatar"
          v-model:image-id="profileForm.avatarId"
          upload-text="上传头像"
        />
      </a-form-item>
      <a-form-item
        label="昵称"
        field="nickname"
        :rules="[{ required: true, message: '请输入昵称' }]"
      >
        <a-input v-model="profileForm.nickname" placeholder="请输入昵称" />
      </a-form-item>
      <a-form-item label="个性签名" field="signed">
        <a-textarea
          v-model="profileForm.signed"
          placeholder="请输入个性签名"
          :max-length="200"
          show-word-limit
          allow-clear
        />
      </a-form-item>
      <a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit" :loading="loading"> 保存修改 </a-button>
          <!-- <a-button @click="resetForm">重置</a-button> -->
        </a-space>
      </a-form-item>
    </a-form>
    <!-- 获取积分弹窗 -->
    <a-modal v-model:visible="rechargeVisible" title="获取积分" :footer="false">
      <div v-html="rechargeInfo"></div>
    </a-modal>

    <!-- 积分记录弹窗 -->
    <a-modal v-model:visible="pointsVisible" title="积分记录" :footer="false" width="800px">
      <a-table :data="pointsLog" :columns="pointsColumns" />
    </a-modal>

    <!-- 使用兑换码弹窗 -->
    <a-modal
      v-model:visible="useExchangeCodeVisible"
      title="使用兑换码"
      @before-ok="handleUseExchangeCode"
    >
      <a-input v-model="exchangeCode" placeholder="请输入兑换码" allow-clear />
    </a-modal>
  </a-card>
</template>

<script setup>
import { ref, onActivated } from 'vue'
import { Message } from '@arco-design/web-vue'
import {
  getProfile,
  updateProfile,
  getRechargeInfo,
  getPointsLog,
  useExchangeCode
} from '@/api/user'
import ImageUpload from '@/components/ImageUpload.vue'

const formRef = ref(null)
const loading = ref(false)
const imageUploadRef = ref(null)
import { useStore } from '@/store'
const { setUserInfo, userInfo } = useStore()

// 表单数据
const profileForm = ref(userInfo || {})

// 获取个人资料
const fetchProfile = async () => {
  try {
    const data = await getProfile()
    profileForm.value = {
      phone: data.phone,
      nickname: data.nickname,
      avatar: data.avatar,
      signed: data.signed,
      points: data.points,
      my_invite_code: data.my_invite_code
    }
    setUserInfo(data)
  } catch (error) {
    Message.error('获取个人资料失败')
  }
}

// 处理提交
const handleSubmit = async () => {
  const validate = await formRef.value.validate()
  if (validate) return
  try {
    loading.value = true
    await imageUploadRef.value.upload()
    await updateProfile(profileForm.value)
    fetchProfile()
    Message.success('保存成功')
  } finally {
    loading.value = false
  }
}

const rechargeVisible = ref(false)
const rechargeInfo = ref('')

const handleRecharge = async () => {
  const data = await getRechargeInfo()
  rechargeVisible.value = true
  rechargeInfo.value = data
}

const useExchangeCodeVisible = ref(false)
const exchangeCode = ref('')
const handleUseExchangeCode = async (done) => {
  done(false)
  if (exchangeCode.value) {
    try {
      await useExchangeCode({
        code: exchangeCode.value
      })
      Message.success('兑换码使用成功')
      fetchProfile()
      useExchangeCodeVisible.value = false
    } catch (error) {}
  } else {
    Message.error('请输入兑换码')
  }
}

// 重置表单
// const resetForm = () => {
//   formRef.value?.resetFields()
//   fetchProfile()
// }

const pointsVisible = ref(false)
const pointsLog = ref([])

// 加载积分变动记录
const loadPointsLog = async () => {
  const data = await getPointsLog()
  pointsLog.value = data
}

// 积分变动记录表格列
const pointsColumns = [
  { title: '变动积分', dataIndex: 'points' },
  { title: '备注', dataIndex: 'remark' },
  { title: '变动时间', dataIndex: 'created_at' }
]

const showPointsLog = () => {
  pointsVisible.value = true
  loadPointsLog()
}

// 页面加载时获取数据
onActivated(() => {
  fetchProfile()
})
</script>

<style lang="less" scoped>
.user-item {
  margin-bottom: 0px;
  width: 250px;
  background-color: var(--color-secondary);
  border-radius: var(--border-radius-small);
  padding: 2px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 32px;
}
.avatar-uploader {
  width: 100px;
  height: 100px;
  border: 1px dashed var(--color-border);
  border-radius: 50%;
  cursor: pointser;
  position: relative;
  overflow: hidden;

  &:hover {
    border-color: var(--color-primary);
  }

  .avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-3);

    .text {
      margin-top: 4px;
      font-size: 12px;
    }
  }
}

.custom-radio-card {
  width: 200px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  .title {
    font-size: 16px;
    font-weight: 600;
  }
  .price {
    font-size: 14px;
  }
}

:deep(.arco-radio-group .arco-radio) {
  margin-right: 0;
}
.custom-radio-card-checked {
  border-color: var(--color-primary);
}
</style>
