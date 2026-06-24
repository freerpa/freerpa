<template>
  <div class="editor-layout">
    <!-- 左侧表单 -->
    <div class="form-section">
      <a-form ref="formRef" layout="vertical" :model="form" auto-label-width>
        <a-form-item
          field="name"
          label="名称"
          hide-label
          :rules="[
            { required: true, message: '请输入环境名称' },
            { minLength: 2, message: '环境名称至少2个字符' },
            { maxLength: 50, message: '环境名称最多50个字符' }
          ]"
        >
          <a-input v-model="form.name" placeholder="请输入环境名称" allow-clear />
        </a-form-item>

        <a-form-item field="description" label="描述" hide-label>
          <a-textarea
            v-model="form.description"
            placeholder="请输入环境描述"
            allow-clear
            :max-length="200"
            :auto-size="{
              minRows: 4,
              maxRows: 8
            }"
            show-word-limit
          />
        </a-form-item>
        <!-- 浏览器类型 -->
        <a-form-item field="browser_type" label="设备" hide-label>
          <a-radio-group v-model="form.browser_type" type="button">
            <a-radio value="pc"><icon-desktop /> 电脑 </a-radio>
            <a-radio value="mobile">
              <svg
                viewBox="0 0 1024 1024"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                stroke="currentColor"
                class="arco-icon"
                stroke-width="4"
                stroke-linecap="butt"
                stroke-linejoin="miter"
              >
                <path
                  d="M760.672616 62.534242 263.326361 62.534242c-19.780509 0-35.815717 15.783475-35.815717 35.253922l0 828.422649c0 19.470447 16.035208 35.253922 35.815717 35.253922l497.346255 0c19.780509 0 35.815717-15.783475 35.815717-35.253922L796.488333 97.788164C796.488333 78.31874 780.453125 62.534242 760.672616 62.534242zM482.069317 111.140263l59.860343 0c11.019984 0 19.953448 8.933463 19.953448 19.953448 0 11.019984-8.933463 19.953448-19.953448 19.953448l-59.860343 0c-11.019984 0-19.953448-8.933463-19.953448-19.953448C462.115869 120.073726 471.049333 111.140263 482.069317 111.140263zM551.906895 918.487921l-79.81379 0L472.093105 838.674131l79.81379 0L551.906895 918.487921zM736.092801 779.502473c0 19.780509-16.035208 35.815717-35.815717 35.815717L323.722916 815.31819c-19.780509 0-35.815717-16.035208-35.815717-35.815717L287.907199 209.552643c0-19.780509 16.035208-35.815717 35.815717-35.815717l376.554168 0c19.780509 0 35.815717 16.035208 35.815717 35.815717L736.092801 779.502473z"
                  fill="#4e5969"
                  p-id="5930"
                ></path>
              </svg>
              手机
            </a-radio>
            <a-radio value="custom"> 自定义 </a-radio>
          </a-radio-group>
        </a-form-item>
        <template v-if="form.browser_type === 'custom'">
          <!-- 浏览器UA -->
          <a-form-item field="browser_ua" label="标识" hide-label>
            <a-input
              v-model="form.browser_ua"
              @change="handleChangeBrowserUA"
              placeholder="请输入浏览器UA"
              allow-clear
            />
          </a-form-item>
          <!-- 浏览器尺寸 -->
          <a-form-item field="browser_width" label="尺寸" hide-label>
            <a-input-number v-model="form.browser_width" placeholder="请输入">
              <template #prefix> 宽 </template>
              <template #suffix> px </template>
            </a-input-number>
            <a-divider direction="vertical" />
            <a-input-number v-model="form.browser_height" placeholder="请输入">
              <template #prefix> 高 </template>
              <template #suffix> px </template>
            </a-input-number>
          </a-form-item>
        </template>
      </a-form>

      <div class="env-button-group">
        <a-button type="secondary" size="medium" @click="beforeClose"> 取消 </a-button>
        <a-button type="primary" size="medium" long @click="handleBeforeOk"> 确定 </a-button>
      </div>
    </div>
    <!-- 右侧预览 -->
    <div class="preview-section">
      <browser v-model="form" v-if="showWebView" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, toRaw, nextTick, onMounted, onUnmounted } from 'vue'
import { IconDesktop } from '@arco-design/web-vue/es/icon'
import { Message } from '@arco-design/web-vue'
import Browser from '@/components/Browser.vue'
import { getEnvironmentDetail, saveEnvironment } from '@/api/env'

// API 引用
const { env: envAPI } = window.electronAPI
const props = defineProps({
  envId: [String, Number]
})

const visible = defineModel('visible')
const emit = defineEmits(['success', 'cancel'])
// 表单状态
const formRef = ref(null)
const form = ref({
  id: '',
  name: '',
  description: '',
  browser_type: 'pc',
  browser_width: 1280,
  browser_height: 720,
  browser_ua: '',
  url: '',
  storage: {},
  cookies: []
})

// 表单处理
const handleBeforeOk = async () => {
  try {
    const res = await formRef.value.validate()
    if (!res) {
      await handleSubmit()
    }
  } catch (error) {}
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()

    // 获取当前webview的状态
    const { storage, cookies } = await envAPI.getEnvironmentFromView()
    const env = {
      id: props.envId,
      ...form.value,
      storage, // 从webview获取的storage数据
      cookies // 从webview获取的cookies数据
    }
    // 保存环境
    await saveEnvironment(env)

    Message.success(props.envId ? '更新成功' : '创建成功')
    emit('success', env)
    handleClose()
  } catch (error) {
    // Message.error(error.message || "保存失败")
  }
}

const beforeClose = async () => {
  emit('cancel')
}

// 获取环境详情
const fetchEnvironmentDetail = async (id) => {
  try {
    const result = await getEnvironmentDetail(id)
    if (result) {
      form.value = {
        id: result.id,
        name: result.name,
        description: result.description,
        url: result.url,
        browser_type: result.browser_type,
        browser_width: result.browser_width,
        browser_height: result.browser_height,
        browser_ua: result.browser_ua,
        storage: result.storage,
        cookies: result.cookies
      }
    }
  } catch (error) {
    Message.error('获取环境详情失败')
  }
}

const showWebView = ref(false)
onMounted(async () => {
  await nextTick()
  if (props.envId) {
    await fetchEnvironmentDetail(props.envId)
  } else {
    form.value = {
      name: '',
      description: '',
      browser_type: 'pc',
      browser_width: 1280,
      browser_height: 720,
      browser_ua: '',
      url: '',
      storage: {},
      cookies: []
    }
  }
  showWebView.value = true
})

const handleChangeBrowserUA = () => {
  envAPI.updateWebView({
    url: form.value.url,
    env: toRaw(form.value)
  })
}

onUnmounted(async () => {
  formRef.value?.resetFields()
  await envAPI.destroyWebView()
})
// 修改 watch 部分
watch(
  () => form.value.browser_type,
  (val) => {
    if (val === 'mobile') {
      form.value.browser_width = 345
      form.value.browser_height = 700
    } else if (val === 'pc') {
      form.value.browser_width = 1280
      form.value.browser_height = 720
    } else {
      form.value.browser_width = form.value.browser_width || 1280
      form.value.browser_height = form.value.browser_height || 720
    }
  }
)
</script>

<style lang="less" scoped>
// 布局样式
.editor-layout {
  display: flex;
  gap: 20px;
  height: 100%;

  .form-section {
    width: 240px;
    flex-shrink: 0;
    overflow-y: auto;
    padding-right: 20px;
    border-right: 1px solid var(--color-border);
  }

  .preview-section {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
}
.env-button-group {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
  margin-top: 16px;
}
// 添加UA选择器样式
:deep(.arco-select) {
  &.mobile-size-select {
    width: 120px;
  }
  &.ua-select {
    min-width: 300px;
  }
}
</style>
