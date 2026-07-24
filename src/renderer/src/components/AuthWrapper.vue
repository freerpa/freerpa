<template>
  <div class="auth-wrapper">
    <slot name="authorized" />
  </div>
</template>

<script setup>
// 离线模式：无需登录，始终展示已授权内容
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
