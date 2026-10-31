<template>
  <div class="message-item" :class="{ 'message-item--user': role === 'user' }">
    <!-- 用户消息：右侧浅色气泡 + 引用资源 + 时间/操作（dsh msg--user 结构） -->
    <template v-if="role === 'user'">
      <div class="user-block">
        <div v-if="safeContent" class="user-bubble">
          <div class="user-text">
            <template v-for="(seg, i) in userSegments">
              <span v-if="seg.type === 'text'" :key="`t-${i}`">{{ seg.text }}</span>
              <span v-else :key="`r-${i}`" class="user-ref" :class="`user-ref--${seg.ref.type}`">
                <component :is="getAttachmentMeta(seg.ref.type).icon" :size="12" />
                <span class="user-ref__tag">{{ getAttachmentMeta(seg.ref.type).label }}</span>
                <span class="user-ref__name">{{ seg.ref.name }}</span>
              </span>
            </template>
          </div>
        </div>
        <div v-if="displayChips.length > 0" class="user-refs">
          <span
            v-for="att in displayChips"
            :key="att.type + att.name"
            class="user-ref"
            :class="`user-ref--${att.type}`"
          >
            <component :is="getAttachmentMeta(att.type).icon" :size="12" />
            <span class="user-ref__tag">{{ getAttachmentMeta(att.type).label }}</span>
            <span class="user-ref__name">{{ att.name }}</span>
          </span>
        </div>
        <div class="msg-meta">
          <time v-if="timeText" class="msg-meta__time">{{ timeText }}</time>
          <BubbleActions :text="copyText" @delete="deleteBubble" />
        </div>
      </div>
    </template>

    <!-- 助手消息：思考过程 + 工具调用 + 正文（无气泡底色，对齐 dsh msg--assistant） -->
    <template v-else>
      <div class="assistant-block">
        <!-- 思考折叠块 -->
        <ReasoningPanel v-if="safeReasoning" :content="safeReasoning" :loading="loading" />

        <!-- 工具调用卡片（流式加载态 + 结果卡） -->
        <ToolCard v-if="tool_calling === 'loading' && toolCallList.length === 0" :calling="true" />
        <ToolCard v-for="tc in toolCallList" :key="tc.id" :tool-call="tc" />

        <!-- 最终回复正文 -->
        <div v-if="safeContent" class="answer">
          <MdPreview class="md-body" :model-value="safeContent" />
          <!-- 用量信息（token 数，轻量展示） -->
          <div v-if="usageTotal" class="answer__usage">
            <RiFlashlightFill :size="11" />
            {{ usageTotal }} tokens
          </div>
        </div>

        <!-- 加载动画 -->
        <div v-if="loading && !safeContent && !tool_calling" class="typing">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>

        <div class="msg-meta">
          <BubbleActions :text="copyText" @delete="deleteBubble" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
  import { computed } from 'vue';
  import { RiFlashlightFill } from '@remixicon/vue';
  import { MdPreview } from 'md-editor-v3';
  import 'md-editor-v3/lib/preview.css';
  import BubbleActions from './BubbleActions.vue';
  import ReasoningPanel from './ReasoningPanel.vue';
  import ToolCard from './ToolCard.vue';
  import { getAttachmentMeta } from '../attachmentMeta';

  const props = defineProps({
    reasoning_content: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      default: '',
    },
    tool_calls: {
      type: [Array, String],
      default: () => [],
    },
    // turnModel 合并后的工具卡片数据：[{ id, name, arguments, ok, error, text, durationMs }]；
    // 未提供时（无结果合并）回退用 tool_calls 渲染
    tool_cards: {
      type: Array,
      default: null,
    },
    tool_calling: {
      type: String,
      default: '',
    },
    // token 用量（AI SDK v7 usage：{ inputTokens, outputTokens, totalTokens }，非持久化）
    usage: {
      type: Object,
      default: null,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      default: 'user',
      validator: (value) => ['user', 'assistant'].includes(value),
    },
    attachments: {
      type: Array,
      default: () => [],
    },
    // 消息时间（内存消息 _ts 毫秒时间戳 / 历史消息 created_at 字符串）
    createdAt: {
      type: [Number, String],
      default: null,
    },
  });

  const emit = defineEmits(['delete']);

  // 渲染兜底：清洗历史脏数据（'undefined' 字面量 / 非法值），避免显示 undefined
  const safeContent = computed(() => {
    const c = props.content;
    return !c || c === 'undefined' || c === '[object Object]' ? '' : c;
  });
  const safeReasoning = computed(() => {
    const c = props.reasoning_content;
    return !c || c === 'undefined' ? '' : c;
  });
  // 复制内容：内容优先，其次思考过程
  const copyText = computed(() => safeContent.value || safeReasoning.value);
  // token 用量展示（千分位格式，轻量）
  const usageTotal = computed(() => {
    const n = props.usage?.totalTokens;
    if (!n) return '';
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  });
  const safeAttachments = computed(() =>
    Array.isArray(props.attachments) ? props.attachments.filter((a) => a && a.name) : []
  );

  // 资源引用（工作流/数据表/浏览器/元素集）：正文中以 @名称 内联展示为彩色 pill
  const REF_TYPES = ['workflow', 'table', 'browser', 'element'];
  const userSegments = computed(() => {
    const text = safeContent.value;
    const refs = safeAttachments.value.filter((a) => REF_TYPES.includes(a.type));
    if (!refs.length) return [{ type: 'text', text }];
    // 名称可能互相包含，按长度倒序匹配，避免短名称抢先吞掉长名称
    const tokens = refs.map((r) => ({ token: `@${r.name}`, ref: r })).sort((a, b) => b.token.length - a.token.length);
    const segments = [];
    let buffer = '';
    let i = 0;
    while (i < text.length) {
      const hit = text[i] === '@' ? tokens.find((t) => text.startsWith(t.token, i)) : null;
      if (hit) {
        if (buffer) {
          segments.push({ type: 'text', text: buffer });
          buffer = '';
        }
        segments.push({ type: 'ref', ref: hit.ref });
        i += hit.token.length;
        continue;
      }
      buffer += text[i];
      i++;
    }
    if (buffer) segments.push({ type: 'text', text: buffer });
    return segments;
  });

  // 未在正文中匹配到的引用（历史数据/异常序列化）与文件附件一起以 chips 兜底展示
  const displayChips = computed(() => {
    const refs = new Set(userSegments.value.filter((s) => s.type === 'ref').map((s) => `${s.ref.type}:${s.ref.name}`));
    return safeAttachments.value.filter((a) => !REF_TYPES.includes(a.type) || !refs.has(`${a.type}:${a.name}`));
  });

  // 消息时间：HH:mm（与 dsh msg-meta__time 一致）
  const timeText = computed(() => {
    const value = props.createdAt;
    if (!value) return '';
    const date = typeof value === 'number' ? new Date(value) : new Date(String(value).replace(' ', 'T'));
    if (isNaN(date.getTime())) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  });

  // 工具卡片：优先 turnModel 合并数据（含结果/错误/耗时），回退 tool_calls（OpenAI 风格 {id, function:{name,arguments}}）
  const toolCallList = computed(() => {
    if (Array.isArray(props.tool_cards) && props.tool_cards.length > 0) return props.tool_cards;
    const raw = props.tool_calls;
    return Array.isArray(raw) ? raw : [];
  });

  const deleteBubble = () => emit('delete');
</script>

<style scoped lang="less">
  .message-item {
    position: relative;
    display: flex;
    margin: 16px 0 0;
    &:first-child {
      margin-top: 0;
    }

    &--user {
      justify-content: flex-end;
    }
  }

  /* ── 用户消息 ─────────────────────────────────────────────── */
  .user-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    max-width: 82%;
    min-width: 0;
  }

  .user-bubble {
    max-width: 100%;
    padding: 9px 15px;
    border-radius: var(--mac-radius-lg);
    background: linear-gradient(180deg, var(--mac-accent-hover), var(--mac-accent));
    border: var(--mac-hairline) solid rgba(0, 0, 0, 0.16);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      0 1px 2px rgba(0, 0, 0, 0.16);
    color: #fff;
    font-size: 13.5px;
    line-height: 1.65;
    user-select: text;
    word-break: break-word;
  }

  .user-text {
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* 引用资源 chips：与输入框 pill 一致的按类型着色；正文内联时随文字基线 */
  .user-refs {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 6px;
  }

  .user-ref {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    height: 20px;
    margin: 1px 2px;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: var(--mac-radius-xs);
    font-size: 12px;
    line-height: 1;
    vertical-align: middle;
    white-space: nowrap;
    overflow: hidden;

    &__tag {
      font-size: 10px;
      font-weight: 600;
      opacity: 0.72;
    }
    &__name {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    &--workflow {
      color: #1d4ed8;
      background: #eff6ff;
      border-color: #bfdbfe;
    }
    &--table {
      color: #15803d;
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    &--browser {
      color: #7c3aed;
      background: #f5f3ff;
      border-color: #ddd6fe;
    }
    &--element {
      color: #c2410c;
      background: #fff7ed;
      border-color: #ffedd5;
    }
    &--file {
      color: var(--mac-text-2);
      background: var(--mac-fill);
      border-color: var(--mac-separator);
    }
  }

  /* ── 助手消息 ─────────────────────────────────────────────── */
  .assistant-block {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  /* 最终回复气泡：实心白色卡片承载正文，与工作台浅灰底色拉开层次 */
  .answer {
    min-width: 0;
    padding: 10px 14px;
    border: var(--mac-hairline) solid rgba(0, 0, 0, 0.08);
    border-radius: var(--mac-radius-md);
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    color: var(--mac-text);
    font-size: 13.5px;
    line-height: 1.72;
    user-select: text;
    word-break: break-word;
  }

  .answer__usage {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    font-size: 11px;
    color: var(--mac-text-3);
  }

  /* Markdown 预览：去掉编辑器默认底色/内边距，跟随消息排版 */
  .md-body {
    background: transparent;
    :deep(.md-editor-preview-wrapper) {
      background: transparent;
      padding: 0;
    }
    :deep(.md-editor-preview) {
      background: transparent;
      padding: 0;
      font-size: inherit;
      color: inherit;
      line-height: inherit;
    }
  }

  /* 底部 meta：时间 + 操作（hover 显示操作） */
  .msg-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 22px;
    margin-top: 2px;
    margin-right: 4px;
    color: var(--mac-text-3);
    font-size: 11px;
    line-height: 1;
    user-select: none;

    &__time {
      color: var(--mac-text-4);
      font-variant-numeric: tabular-nums;
    }
  }

  .typing {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0;
    .typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--mac-text-3);
      animation: typing-bounce 1.4s infinite ease-in-out both;
      &:nth-child(1) {
        animation-delay: -0.32s;
      }
      &:nth-child(2) {
        animation-delay: -0.16s;
      }
    }
  }

  @keyframes typing-bounce {
    0%,
    80%,
    100% {
      transform: translateY(0);
      opacity: 0.5;
    }
    40% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }
</style>
