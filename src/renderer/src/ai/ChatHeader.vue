<template>
  <div class="chat__title">
    <div class="chat__title-left">智能编排工作台</div>
    <div class="chat__title-right">
      <!-- 新建对话（创建新会话，不清空当前对话） -->
      <a-button class="ai-icon-btn" type="secondary" title="新建对话" @click="emit('new')">
        <RiAddLine :size="16" />
      </a-button>
      <!-- 对话列表（参考浏览器列表选择器：搜索 + 列表） -->
      <div class="dropup">
        <a-button class="ai-icon-btn" type="secondary" title="对话列表" @click.stop="toggleHistory">
          <RiHistoryLine :size="16" />
        </a-button>
        <div class="ai-menu history-menu" v-show="historyOpen" @click.stop>
          <div class="ai-menu-search">
            <RiSearchLine :size="12" class="ai-menu-search__icon" />
            <input v-model="historyKeyword" placeholder="搜索对话" />
          </div>
          <div class="ai-menu-list">
            <div
              v-for="conv in filteredConversations"
              :key="conv.id"
              class="ai-menu-item"
              :class="{ 'menu-item--active': conv.id === currentConversationId }"
              @click="emit('switch', conv.id)"
            >
              <RiMessage3Line :size="12" class="menu-item-icon" />
              <span class="menu-item-text">{{ conv.title }}</span>
              <span class="menu-item-count">{{ conv.messageCount }}条</span>
              <a-button class="menu-item-del" type="secondary" size="mini" @click.stop="emit('remove', conv.id)">
                <RiCloseLine :size="11" />
              </a-button>
            </div>
            <div v-if="filteredConversations.length === 0" class="ai-menu-empty">暂无对话</div>
          </div>
        </div>
      </div>
      <!-- 关闭面板 -->
      <a-button class="ai-icon-btn" type="secondary" title="关闭" @click="emit('close')">
        <RiCloseLine :size="16" />
      </a-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RiAddLine, RiHistoryLine, RiSearchLine, RiCloseLine, RiMessage3Line } from '@remixicon/vue'

const props = defineProps({
  conversations: {
    type: Array,
    default: () => []
  },
  currentConversationId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['new', 'switch', 'remove', 'close'])

// ---- 对话列表（会话切换） ----
const historyOpen = ref(false)
const historyKeyword = ref('')
const filteredConversations = computed(() => {
  const kw = historyKeyword.value.trim().toLowerCase()
  if (!kw) return props.conversations
  return props.conversations.filter((c) => (c.title || '').toLowerCase().includes(kw))
})
const toggleHistory = () => {
  historyOpen.value = !historyOpen.value
}
const closeHistory = () => {
  historyOpen.value = false
}

// 点击面板外部关闭对话列表
onMounted(() => {
  document.addEventListener('click', closeHistory)
})
onUnmounted(() => {
  document.removeEventListener('click', closeHistory)
})
</script>

<style scoped lang="less">
.chat__title {
  height: 44px;
  flex-shrink: 0;
  border-bottom: 1px solid #e5e5e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;

  &-left {
    font-size: 14px;
    font-weight: 500;
    color: #111114;
  }
  &-right {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.dropup {
  position: relative;

  // 对话列表（公共 ai-menu 提供外观，此处仅定位与局部修饰）
  .history-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 260px;

    .menu-item-icon {
      flex-shrink: 0;
      color: #6b7280;
    }
    .menu-item-text {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .menu-item-count {
      flex-shrink: 0;
      font-size: 11px;
      color: #9ca3af;
    }
    .menu-item--active {
      background: #f0f0f2;
    }
    .menu-item-del {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      padding: 0 4px;
      color: #9ca3af;
      opacity: 0;
      transition: opacity 0.15s ease;
      &:hover {
        color: #ef4444;
      }
    }
    .ai-menu-item:hover .menu-item-del {
      opacity: 1;
    }
  }
}
</style>
