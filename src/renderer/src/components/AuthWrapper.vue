<template>
  <div class="auth-wrapper">
    <!-- 已登录 -->
    <div v-if="isLoggedIn">
      <slot name="authorized" />
    </div>
    <!-- 未登录 -->
    <div v-else>
      <slot name="unauthorized">
        <div class="auth-placeholder">
          <a-empty description="请先登录后使用此功能">
            <template #image>
              <icon-user />
            </template>
          </a-empty>
          <a-button type="primary" @click="showLogin">登录</a-button>
        </div>
      </slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { IconUser } from '@arco-design/web-vue/es/icon'
import { useStore } from '@/store'
import { storeToRefs } from 'pinia'

const store = useStore()
const { userInfo } = storeToRefs(store)
const { showLogin } = store

const isLoggedIn = computed(() => !!userInfo.value)
</script>

<style lang="less" scoped>
.auth-wrapper {
  .auth-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    gap: 16px;
  }
}
</style>
