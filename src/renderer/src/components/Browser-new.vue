<template>
  <div class="webview-wrapper">
    <div class="webview-header">
      <div class="url-input">
        <a-tooltip content="清除缓存">
          <template #content>
            有些情况下旧的登录态过期后会导致无法二次登录，此时可以点击清除缓存后重新登录
          </template>
          <a-button size="medium" @click="handleAction('clear')">
            <template #icon><icon-empty /></template>
          </a-button>
        </a-tooltip>
        <a-input
          size="medium"
          v-model="env.url"
          placeholder="请输入目标网站地址"
          allow-clear
          @keyup.enter="handleAction('load')"
        >
          <template #prefix>
            <icon-link />
          </template>
          <template v-if="loadUrling" #suffix>
            <icon-loading />
          </template>
        </a-input>
        <a-space>
          <a-button size="medium" @click="handleAction('load')">
            <template #icon><icon-send /></template>
          </a-button>
          <a-button size="medium" @click="handleAction('refresh')">
            <template #icon><icon-refresh /></template>
          </a-button>
          <a-button size="medium" @click="handleAction('back')">
            <template #icon><icon-left /></template>
          </a-button>
          <a-button size="medium" @click="handleAction('forward')">
            <template #icon><icon-right /></template>
          </a-button>
          <a-button v-if="inspector" size="medium" @click="handleAction('debug')">
            <template #icon><icon-bug /></template>
          </a-button>
        </a-space>
      </div>
    </div>

    <div ref="previewContainerRef" class="preview-container-wrapper">
      <webview
        ref="webviewRef"
        :src="url"
        @did-start-navigation="
          (event) => {
            env.url = event.url
          }
        "
        @did-start-loading="showLoading(true)"
        @did-finish-load="showLoading(false)"
        @did-fail-load="showLoading(false)"
        @did-stop-loading="showLoading(false)"
        class="preview-container"
        :class="
          env.browser_type === 'custom'
            ? 'custom-preview'
            : env.browser_type === 'mobile'
              ? 'mobile-preview'
              : 'pc-preview'
        "
        :style="{
          width: browserSize.width - (env.browser_type === 'custom' ? 1 : 20) + 'px',
          height: browserSize.height - (env.browser_type === 'custom' ? 1 : 20) + 'px'
        }"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, reactive, watch, toRaw, nextTick } from 'vue'
import {
  IconSend,
  IconRefresh,
  IconLeft,
  IconRight,
  IconLink,
  IconDesktop,
  IconCode,
  IconLoading,
  IconEmpty,
  IconBug
} from '@arco-design/web-vue/es/icon'
import { useElementBounding } from '@vueuse/core'
// API 引用
let browserAPI = window.electronAPI.env

const env = defineModel()
const props = defineProps({
  inspector: {
    type: Boolean,
    default: false
  }
})

const url = ref(env.value.url)
const loadUrling = ref(false)

const showLoading = (show) => {
  loadUrling.value = show
}

const webviewRef = ref(null)
const browserSize = computed(() => {
  const rect = reactive(useElementBounding(previewContainerRef.value))
  let width = env.value.browser_width
  let height = env.value.browser_height
  if (rect.width < env.value.browser_width) {
    width = rect.width
    height = width * (env.value.browser_height / env.value.browser_width)
  }
  return {
    width,
    height
  }
})

// WebContentsView 状态
const previewContainerRef = ref(null)

const handleAction = async (action) => {
  switch (action) {
    case 'clear':
      loadUrling.value = true
      initWebView(
        {
          url: env.value.url,
          browser_type: env.value.browser_type,
          browser_width: env.value.browser_width,
          browser_height: env.value.browser_height,
          browser_ua: env.value.browser_ua,
          storage: {},
          cookies: []
        },
        true
      )
      loadUrling.value = false
      break
    case 'load':
      if (!env.value.url) return
      url.value = env.value.url
      break
    case 'refresh':
      await webviewRef.value.reload()
      break
    case 'back':
      await webviewRef.value.goBack()
      break
    case 'forward':
      await webviewRef.value.goForward()
      break
    case 'debug':
      await webviewRef.value.openDevTools()
      break
  }
}

const reInit = async () => {
  await initWebView(env.value, true)
}

const load = async (url) => {
  await browserAPI.updateWebView({
    url,
    env: toRaw(env.value)
  })
}

defineExpose({
  reInit,
  load
})

onBeforeUnmount(() => {
  browserAPI.destroyWebView()
})
</script>

<style lang="less" scoped>
.webview-wrapper {
  background-color: var(--color-bg-2);
  overflow: hidden;
  height: 100%;
  width: 100%;

  .webview-header {
    .url-input {
      display: flex;
      gap: 8px;
      :deep(.arco-input-wrapper) {
        flex: 1;
      }
    }
  }

  .preview-container {
    height: calc(100% - 160px);
    background-color: var(--color-fill-2);
    transition: all 0.05s ease;
    border-radius: 4px !important;
    // PC预览样式
    &.custom-preview {
      margin: 20px auto;
      border-radius: 4px;
      position: relative;
      background: #fff;
      border: 1px solid var(--color-border);
      padding-top: 32px;

      // 添加浏览器标题栏
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 32px;
        background: var(--color-bg-2);
        border-bottom: 1px solid var(--color-border);
        border-radius: 8px 8px 0 0;
      }

      // 添加浏览器按钮
      &::after {
        content: '';
        position: absolute;
        top: 10px;
        left: 12px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #ff5f57;
        box-shadow:
          20px 0 0 #febc2e,
          40px 0 0 #28c840;
      }
    }

    &.pc-preview {
      margin: 20px auto;
      border-radius: 4px;
      position: relative;
      background: #fff;
      box-shadow:
        0 0 0 10px #1d1d1f,
        0 15px 0 10px #1d1d1f,
        0 0 0 11px #424245;

      width: calc((100vh - 160px) * 0.4);

      // // 显示器底座
      // &::after {
      //   content: '';
      //   position: absolute;
      //   bottom: -100px;
      //   left: 50%;
      //   transform: translateX(-50%);
      //   width: 40%;
      //   height: 20px;
      //   background: #1d1d1f;
      //   border-radius: 4px;
      //   box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
      //   z-index: 1;
      // }

      // // 显示器底座连接处
      // &::before {
      //   content: '';
      //   position: absolute;
      //   bottom: -80px;
      //   left: 50%;
      //   transform: translateX(-50%);
      //   width: 60px;
      //   height: 60px;
      //   background: #1d1d1f;
      //   z-index: 1;
      // }
    }

    &.mobile-preview {
      margin: 20px auto;
      border-radius: 32px;
      position: relative;
      background: #fff;
      box-shadow:
        0 0 0 10px #1d1d1f,
        0 0 0 11px #424245;
      width: calc((100vh - 160px) * 0.4);

      // 添加手机刘海
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 150px;
        height: 24px;
        background: #1d1d1f;
        border-bottom-left-radius: 16px;
        border-bottom-right-radius: 16px;
        z-index: 1;
      }

      // 添加手机按钮
      &::after {
        content: '';
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        right: auto;
        bottom: 6px;
        width: 100px;
        height: 5px;
        background: #1d1d1f;
        border-radius: 4px;
      }
    }
  }
}
</style>
