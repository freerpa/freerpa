<template>
  <div class="permission-manager">
    <!-- 全局权限（默认）：改动即保存 -->
    <a-card title="全局权限" :bordered="false">
      <template #extra>
        <a-space>
          <a-popover content="基于 deno 最小权限机制：每个工作流创建时按其生效权限生成隔离的 Worker，越权操作（目录外读写、未授权网络/子进程等）将被运行时拒绝。">
            <icon-info-circle class="info-icon" />
          </a-popover>
          <a-button size="small" @click="resetGlobal">恢复默认</a-button>
        </a-space>
      </template>
      <PermissionForm v-model="globalPermissions" />
    </a-card>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconInfoCircle } from '@arco-design/web-vue/es/icon'
import PermissionForm from './PermissionForm.vue'
import { DEFAULTS, loadGlobalPermissions, toPlain } from '@/utils/permissions'

const globalPermissions = ref(DEFAULTS())
let loaded = false
let saveTimer = null

const loadGlobal = async () => {
  globalPermissions.value = await loadGlobalPermissions()
  // watch 回调经微任务异步 flush：先 nextTick 让首轮（loaded=false）回调执行完，再放行后续写回
  await nextTick()
  loaded = true
}

const resetGlobal = async () => {
  // 恢复主进程单点生成的最安全默认（含预置 FREERPA-DATA 目录），IPC 失败回退静态 DEFAULTS
  try {
    const defaults = await window.electronAPI.permissions.getDefaults()
    globalPermissions.value = defaults || DEFAULTS()
  } catch {
    globalPermissions.value = DEFAULTS()
  }
  Message.success('已恢复默认')
}

// 改动即保存（防抖，避免输入过程频繁写；静默无提示）
watch(globalPermissions, async (val) => {
  if (!loaded) return // 首次加载不触发写回
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    try {
      await window.electronAPI.store.set('permissions', toPlain(val))
    } catch (e) {
      Message.error('权限保存失败: ' + (e?.message || e))
    }
  }, 400)
}, { deep: true })

onMounted(loadGlobal)
onUnmounted(() => {
  clearTimeout(saveTimer)
  // 卸载前落盘最后一次改动（防抖定时器尚未触发时）
  if (loaded && saveTimer !== null) {
    window.electronAPI.store.set('permissions', toPlain(globalPermissions.value)).catch(() => {})
  }
})
</script>

<style lang="less" scoped>
.permission-manager {
  .info-icon {
    cursor: pointer;
    color: var(--color-text-3);
    font-size: 16px;
  }
}
</style>
