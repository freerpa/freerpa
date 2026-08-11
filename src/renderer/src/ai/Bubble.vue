<template>
  <div class="message-item" :class="{ 'message-item--user': role === 'user' }">
    <!-- 用户消息：右侧黑底白字气泡 + 附件 + 底部操作 -->
    <template v-if="role === 'user'">
      <div class="user-content">
        <div class="user-block">
          <!-- 引用的资源 -->
          <div class="attachments-inline" v-if="safeAttachments.length > 0">
            <span v-for="att in safeAttachments" :key="att.type + att.name" class="ai-attach-chip">
              <component :is="attMeta(att.type).icon" :size="11" />
              {{ att.name }}
            </span>
          </div>
          <div class="bubble bubble--user" v-if="safeContent">
            <MdPreview style="background-color: transparent" :modelValue="safeContent" />
          </div>
          <BubbleActions :text="copyText" @delete="deleteBubble" />
        </div>
      </div>
    </template>

    <!-- 助手消息：内容块 + 底部操作（无头像，纯消息流） -->
    <template v-else>
      <div class="assistant-content">
        <!-- 思考折叠块 -->
        <ReasoningPanel v-if="safeReasoning" :content="safeReasoning" :loading="loading" />

        <!-- 工具调用卡片（流式加载态 + 结果卡） -->
        <ToolCard v-if="tool_calling === 'loading'" :calling="true" />
        <ToolCard v-for="tc in toolCallList" :key="tc.id" :tool-call="tc" />

        <!-- 内容气泡 -->
        <div class="bubble bubble--assistant" v-if="safeContent">
          <MdPreview style="background-color: transparent" :modelValue="safeContent" />
          <!-- 用量信息（token 数，轻量展示） -->
          <div class="bubble__meta" v-if="usageTotal">
            <RiFlashlightFill :size="11" /> {{ usageTotal }} tokens
          </div>
        </div>
        <!-- 加载动画 -->
        <div class="typing" v-if="loading && !safeContent && !tool_calling">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>

        <BubbleActions :text="copyText" @delete="deleteBubble" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { RiFlashlightFill } from '@remixicon/vue'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'
import BubbleActions from './BubbleActions.vue'
import ReasoningPanel from './ReasoningPanel.vue'
import ToolCard from './ToolCard.vue'
import { attMeta } from './attachMeta'

const props = defineProps({
  reasoning_content: {
    type: String,
    default: ''
  },
  content: {
    type: String,
    default: ''
  },
  tool_calls: {
    type: [Array, String],
    default: () => []
  },
  // turnModel 合并后的工具卡片数据：[{ id, name, arguments, ok, error, text, durationMs }]；
  // 未提供时（无结果合并）回退用 tool_calls 渲染
  tool_cards: {
    type: Array,
    default: null
  },
  tool_calling: {
    type: String,
    default: ''
  },
  // token 用量（AI SDK v7 usage：{ inputTokens, outputTokens, totalTokens }，非持久化）
  usage: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    default: 'user',
    validator: (value) => ['user', 'assistant'].includes(value)
  },
  attachments: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['delete'])

// 渲染兜底：清洗历史脏数据（'undefined' 字面量 / 非法值），避免显示 undefined
const safeContent = computed(() => {
  const c = props.content
  return !c || c === 'undefined' || c === '[object Object]' ? '' : c
})
const safeReasoning = computed(() => {
  const c = props.reasoning_content
  return !c || c === 'undefined' ? '' : c
})
// 复制内容：内容优先，其次思考过程
const copyText = computed(() => safeContent.value || safeReasoning.value)
// token 用量展示（千分位格式，轻量）
const usageTotal = computed(() => {
  const n = props.usage?.totalTokens
  if (!n) return ''
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
})
const safeAttachments = computed(() =>
  Array.isArray(props.attachments) ? props.attachments.filter((a) => a && a.name) : []
)

// 工具卡片：优先 turnModel 合并数据（含结果/错误/耗时），回退 tool_calls（OpenAI 风格 {id, function:{name,arguments}}）
const toolCallList = computed(() => {
  if (Array.isArray(props.tool_cards) && props.tool_cards.length > 0) return props.tool_cards
  const raw = props.tool_calls
  return Array.isArray(raw) ? raw : []
})

const deleteBubble = () => emit('delete')
</script>

<style scoped lang="less">
.message-item {
  position: relative;
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}

.user-content {
  flex: 1;
  display: flex;
  justify-content: flex-end;
}

.user-block {
  max-width: 480px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.assistant-content {
  flex: 1;
}

.bubble {
  padding: 12px 16px;
  border-radius: var(--border-radius-small);
  font-size: 14px;
  line-height: 1.6;
  user-select: text;
  word-break: break-word;
  :deep(.md-editor-preview) {
    font-size: inherit;
    p { line-height: inherit; margin: 0; }
  }
  &--user {
    background: #111114;
    color: #fff;
    border-bottom-right-radius: var(--border-radius-small);
    :deep(.md-editor-preview) { color: #fff; }
  }
  &--assistant {
    background: #f0f0f2;
    border: 1px solid #e5e5e8;
    max-width: 100%;
    border-bottom-left-radius: var(--border-radius-small);
    color: #333;
    margin-bottom: 4px;
  }
}

// 用户气泡内引用的资源 chips
.attachments-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
  margin-bottom: 8px;
  .ai-attach-chip {
    gap: 4px;
    padding: 4px 8px;
    font-size: 12px;
    max-width: 100%;
  }
}

// 用量信息（token 数，轻量展示）
.bubble__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 11px;
  color: #9ca3af;
}

.typing {
  display: flex;
  gap: 4px;
  padding: 10px 16px;
  background: #f0f0f2;
  border: 1px solid #e5e5e8;
  border-radius: var(--border-radius-small);
  border-bottom-left-radius: var(--border-radius-small);
  width: fit-content;
  margin-bottom: 8px;
  .typing-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #9ca3af;
    animation: typing-bounce 1.4s infinite ease-in-out both;
    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
  }
}

@keyframes typing-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
  40% { transform: translateY(-4px); opacity: 1; }
}
</style>
