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
          <a-button size="medium" @click="handleAction('debug')">
            <template #icon><icon-bug /></template>
          </a-button>
        </a-space>
      </div>
    </div>

    <div ref="previewContainerRef" class="preview-container-wrapper">
      <div
        ref="previewRef"
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
      >
        <a-spin dot> </a-spin>
      </div>
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
let webviewAPI = window.electronAPI.webview

const env = defineModel()
const props = defineProps({
  inspector: {
    type: Boolean,
    default: false
  }
})

if (props.inspector) {
  browserAPI = window.electronAPI.inspector
}

const loadUrling = ref(false)
webviewAPI.on(`did-start-navigation` + (props.inspector ? '-inspector' : '-env'), (url) => {
  env.value.url = url
})
webviewAPI.on(`did-start-loading` + (props.inspector ? '-inspector' : '-env'), () => {
  loadUrling.value = true
})
webviewAPI.on(`did-finish-load` + (props.inspector ? '-inspector' : '-env'), () => {
  loadUrling.value = false
})
webviewAPI.on(`did-fail-load` + (props.inspector ? '-inspector' : '-env'), () => {
  loadUrling.value = false
})
webviewAPI.on(`did-stop-loading` + (props.inspector ? '-inspector' : '-env'), () => {
  loadUrling.value = false
})

let updateBounds = null
const updateWebViewBounds = async (rect) => {
  if (loadUrling.value) {
    updateBounds = rect
    return
  }
  browserAPI.updateWebView({
    bounds: calculateBounds(rect),
    env: toRaw(env.value)
  })
  updateBounds = null
}

watch(loadUrling, (value) => {
  if (!value && updateBounds) {
    updateWebViewBounds(updateBounds)
  }
})

onMounted(() => {
  nextTick(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100))
    const rect = reactive(useElementBounding(previewRef.value))
    watch(
      rect,
      (rect) => {
        updateWebViewBounds(rect)
      },
      {
        immediate: true
      }
    )
    initWebView(env.value)
  })
})

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
const previewRef = ref(null)
const previewContainerRef = ref(null)

// 添加边框尺寸常量
const FRAME_SIZES = {
  pc: {
    top: 0, // 标题栏高度
    horizontal: 0, // 左右边框
    vertical: 0 // 上下边框
  },
  mobile: {
    top: 24, // 刘海高度
    horizontal: 10, // 手机边框宽度
    vertical: 10 // 手机边框高度
  },
  custom: {
    top: 32, // 标题栏高度
    horizontal: 0, // 左右边框
    vertical: 0 // 上下边框
  }
}

// 获取实际的bounds
const calculateBounds = ({ width, height, x, y }) => {
  const frameType = env.value.browser_type || 'pc'
  const sizes = FRAME_SIZES[frameType]
  const bounds = {
    width: width - sizes.horizontal * 2 - 2,
    height: height - sizes.top - sizes.vertical * 2 - 4,
    x: x + sizes.horizontal + 1,
    y: y + sizes.top + 2
  }
  return bounds
}
// WebContentsView 相关处理
const initWebView = async (env, force = false) => {
  if (!previewRef.value) return
  loadUrling.value = true
  const rect = reactive(useElementBounding(previewRef.value))
  await browserAPI.createWebView({
    url: env.url,
    bounds: calculateBounds(rect),
    env: toRaw(env),
    force
  })
  loadUrling.value = false
}

const handleAction = async (action) => {
  switch (action) {
    case 'clear':
      loadUrling.value = true
      await browserAPI.clear()
      // initWebView(
      //   {
      //     url: env.value.url,
      //     browser_type: env.value.browser_type,
      //     browser_width: env.value.browser_width,
      //     browser_height: env.value.browser_height,
      //     browser_ua: env.value.browser_ua,
      //     storage: {},
      //     cookies: []
      //   },
      //   true
      // )
      loadUrling.value = false
      break
    case 'load':
      if (!env.value.url) return
      if (!env.value.url.startsWith('http') && !env.value.url.startsWith('https')) {
        env.value.url = 'https://' + env.value.url
      }
      env.value.url = env.value.url.trim().replace(/,|，|。/g, '.')
      loadUrling.value = true
      await browserAPI.updateWebView({
        url: env.value.url,
        env: toRaw(env.value)
      })
      loadUrling.value = false
      break
    case 'refresh':
      await browserAPI.refresh()
      break
    case 'back':
      await browserAPI.goBack()
      break
    case 'forward':
      await browserAPI.goForward()
      break
    case 'debug':
      await browserAPI.debug()
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
    display: flex;
    align-items: center;
    justify-content: center;

    // PC预览样式
    &.custom-preview {
      margin: 20px auto 0;
      border-radius: 4px;
      position: relative;
      background: #fff;
      border: 1px solid var(--color-border);

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
