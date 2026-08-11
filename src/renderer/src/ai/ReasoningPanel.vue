<template>
  <!-- 思考折叠块：流式思考中自动展开，思考完毕自动收起成标题行；用户手动干预后不再自动 -->
  <div class="ai-panel reasoning-panel" v-if="content">
    <div class="ai-panel-head" @click="toggleReasoning">
      <div class="ai-panel-head__left">
        <RiBrainLine class="brain-icon" size="12" />
        <span>思考过程</span>
      </div>
      <RiArrowDownSLine
        class="panel-head__chevron"
        :size="14"
        :style="{ transform: reasoningExpanded ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }"
      />
    </div>
    <div class="ai-panel-body" v-if="reasoningExpanded">
      <div class="reasoning-text">{{ content }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { RiBrainLine, RiArrowDownSLine } from '@remixicon/vue'

const props = defineProps({
  /** 思考内容（纯文本） */
  content: {
    type: String,
    default: ''
  },
  /** 消息加载中（新一轮思考开始自动展开） */
  loading: {
    type: Boolean,
    default: false
  }
})

// 流式思考中自动展开（用户可见思考过程），思考完毕（loading 结束）自动收起成标题行；
// 用户手动点击展开/收起后不再自动干预（userToggled）
const reasoningExpanded = ref(false)
const reasoningUserToggled = ref(false)
// 初始挂载时若正在加载（新一轮思考开始），直接展开——watch 不触发初始值，避免流式开始但推理折叠
if (props.loading) reasoningExpanded.value = true
watch(
  () => props.loading,
  (loading) => {
    if (loading) {
      // 新一轮思考开始：自动展开
      reasoningExpanded.value = true
      reasoningUserToggled.value = false
    } else if (!reasoningUserToggled.value) {
      // 思考/流式完毕：自动收起
      reasoningExpanded.value = false
    }
  }
)
const toggleReasoning = () => {
  reasoningUserToggled.value = true
  reasoningExpanded.value = !reasoningExpanded.value
}
</script>

<style scoped lang="less">
.reasoning-panel .ai-panel-head {
  cursor: pointer;
  &:hover { background: rgba(240, 240, 242, 0.6); }
  .brain-icon { color: #8b5cf6; }
  .panel-head__chevron {
    color: #6b7280;
    font-size: 12px;
    cursor: pointer;
  }
}
</style>
