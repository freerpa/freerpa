<template>
  <router-view></router-view>
  <a-modal
    v-model:visible="updateVisible"
    title="发现新版本"
    :esc-to-close="false"
    :mask-closable="false"
    :closable="false"
  >
    <a-space>
      <span>
        最新版本 &nbsp;<b>v{{ updateInfo.latest_version }}</b>
      </span>
      <a-tag v-if="updateInfo.force" color="red">强制更新</a-tag>
    </a-space>
    <div
      :style="{
        maxHeight: '300px',
        overflow: 'auto',
        margin: '16px 0',
        padding: '16px',
        background: 'var(--color-fill-2)',
        borderRadius: '4px'
      }"
      v-html="updateInfo?.content?.replace(/\r|\n/g, '<br/>')"
    />
    <div v-if="updateIng">
      <div><icon-loading />正在下载（{{ speed }}）</div>
      <a-progress :percent="percent" animation size="large" />
    </div>
    <template #footer>
      <a-button v-if="!updateInfo.force" type="text" @click="handleCancel" :disabled="updateIng">
        稍后再说
      </a-button>
      <a-button v-else type="primary" status="danger" @click="handleExit" :disabled="updateIng">
        退出程序
      </a-button>
      <a-button type="primary" @click="handleOk" :disabled="updateIng">
        <template #icon> </template>
        立即更新
      </a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { onMounted, ref, provide } from 'vue'
import { checkUpdate } from '@/utils/version'
import { useStore } from '@/store'
import { storeToRefs } from 'pinia'
import { IconLoading } from '@arco-design/web-vue/es/icon'
const store = useStore()
const { updateVisible, hasUpdate } = storeToRefs(store)
const updateInfo = ref({})
const updateIng = ref(false)
const percent = ref(0)
const speed = ref('0K/s')
const handleOk = () => {
  updateIng.value = true
  window.electronAPI.app.updateApp(updateInfo.value.download_url, (params) => {
    percent.value = params.percent / 100
    speed.value = params.speed
  })
}

const handleCancel = () => {
  updateVisible.value = false
}

const handleExit = () => {
  window.electronAPI.window.close()
}

// 检查更新 + 注册全局快捷键响应
onMounted(async () => {
  updateInfo.value = await checkUpdate()
  if (updateInfo.value.has_update) {
    hasUpdate.value = true
    if (updateInfo.value.force) {
      updateVisible.value = true
    }
  }
})

const keyDownFn = new Map()
const keyUpFn = new Map()

const keyDownEventListener = (fn, id) => {
  keyDownFn.set(id, fn)
  return () => {
    keyDownFn.delete(id)
  }
}

const keyUpEventListener = (fn, id) => {
  keyUpFn.set(id, fn)
  return () => {
    keyUpFn.delete(id)
  }
}

provide('keyDownEventListener', keyDownEventListener)
provide('keyUpEventListener', keyUpEventListener)

window.addEventListener('keydown', (e) => {
  // e.preventDefault()
  keyDownFn.forEach((fn) => fn(e))
})
window.addEventListener('keyup', (e) => {
  keyUpFn.forEach((fn) => fn(e))
})
</script>

<style lang="less">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  overflow: hidden;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
