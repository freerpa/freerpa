<template>
  <div class="market-container">
    <!-- 扩展市场（远程嵌入，无头模式 embed=1） -->
    <iframe
      v-if="marketUrl"
      :src="marketUrl"
      class="market-frame"
      frameborder="0"
    />
    <div v-else class="market-empty">
      <ri-apps-2-line style="font-size: 48px; color: rgb(var(--gray-5))" />
      <p>未配置扩展市场地址（VITE_MARKET_URL）</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { RiApps2Line } from '@remixicon/vue'

// 扩展市场地址（.env 的 VITE_MARKET_URL；dev/prod 由 electron-vite 注入）
const marketUrl = ref(import.meta.env.VITE_MARKET_URL || '')
</script>

<style scoped>
.market-container {
  height: 100%;
  overflow: hidden;
}
.market-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}
.market-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgb(var(--gray-6));
}
</style>
