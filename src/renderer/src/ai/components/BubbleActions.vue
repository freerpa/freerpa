<template>
  <!-- 气泡底部操作（hover 显示；复制 + 删除，user/assistant 共用） -->
  <div class="ai-bubble-actions">
    <a-button
      class="ai-bubble-action"
      :class="{ 'is-copied': copied }"
      type="secondary"
      size="mini"
      title="复制"
      @click="copyContent"
    >
      <template #icon>
        <RiCheckLine v-if="copied" :size="13" />
        <RiFileCopyLine v-else :size="13" />
      </template>
    </a-button>
    <a-button
      class="ai-bubble-action ai-bubble-action--danger"
      type="secondary"
      size="mini"
      title="删除"
      @click="emit('delete')"
    >
      <template #icon>
        <RiDeleteBin6Line :size="13" />
      </template>
    </a-button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { RiFileCopyLine, RiDeleteBin6Line, RiCheckLine } from '@remixicon/vue'

const props = defineProps({
  /** 复制内容（内容或思考过程，非空才可复制） */
  text: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['delete'])

const copied = ref(false)
const copyContent = async () => {
  const text = props.text
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Electron renderer 下 clipboard API 不可用时降级 execCommand
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 3000)
}
</script>

<style scoped lang="less">
/* 外观由 ai.less 的 .ai-bubble-actions / .ai-bubble-action 提供（含 hover 显隐） */
/* 复制成功反馈：图标对号 + 绿色 */
.ai-bubble-action.is-copied {
  color: #10b981;
  &:hover {
    color: #10b981;
  }
}
</style>
