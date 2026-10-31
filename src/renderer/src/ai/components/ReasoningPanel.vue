<template>
  <!-- 思考折叠块（对齐 dsh .reasoning）：标题行 + 折叠摘要 + 展开正文；思考中自动展开，结束后自动收起 -->
  <div v-if="content" class="reasoning">
    <button
      type="button"
      class="reasoning__head"
      :data-running="loading ? '' : undefined"
      :aria-expanded="reasoningExpanded"
      @click="toggleReasoning"
    >
      <RiBrainLine class="reasoning__icon" :size="12" />
      <span>{{ loading ? '思考中' : '思考过程' }}</span>
      <span v-if="!loading && content" class="reasoning__meta">{{ durationLabel }}</span>
      <RiArrowRightSLine
        class="reasoning__chevron"
        :class="{ 'reasoning__chevron--open': reasoningExpanded }"
        :size="12"
      />
    </button>
    <div v-if="reasoningExpanded" class="reasoning__body">{{ content }}</div>
    <button v-else-if="summaryText" type="button" class="reasoning-summary" @click="toggleReasoning">
      {{ summaryText }}
    </button>
  </div>
</template>

<script setup>
  import { ref, watch, computed } from 'vue';
  import { RiBrainLine, RiArrowRightSLine } from '@remixicon/vue';
  import { fmtDuration } from '../turnModel';

  const props = defineProps({
    /** 思考内容（纯文本） */
    content: {
      type: String,
      default: '',
    },
    /** 消息加载中（新一轮思考开始自动展开） */
    loading: {
      type: Boolean,
      default: false,
    },
    /** 思考耗时（毫秒，可选；无则不展示） */
    durationMs: {
      type: Number,
      default: null,
    },
  });

  // 流式思考中自动展开（用户可见思考过程），思考完毕（loading 结束）自动收起成标题行；
  // 用户手动点击展开/收起后不再自动干预（userToggled）
  const reasoningExpanded = ref(false);
  const reasoningUserToggled = ref(false);
  // 初始挂载时若正在加载（新一轮思考开始），直接展开——watch 不触发初始值，避免流式开始但推理折叠
  if (props.loading) reasoningExpanded.value = true;
  watch(
    () => props.loading,
    (loading) => {
      if (loading) {
        // 新一轮思考开始：自动展开
        reasoningExpanded.value = true;
        reasoningUserToggled.value = false;
      } else if (!reasoningUserToggled.value) {
        // 思考/流式完毕：自动收起
        reasoningExpanded.value = false;
      }
    }
  );
  const toggleReasoning = () => {
    reasoningUserToggled.value = true;
    reasoningExpanded.value = !reasoningExpanded.value;
  };

  const durationLabel = computed(() =>
    props.durationMs != null ? `已思考 · ${fmtDuration(props.durationMs)}` : '已思考'
  );

  // 折叠态单行摘要（对齐 dsh reasoning-summary）：
  // 思考中取最后一行非空文本（最新信号），结束后取首行非空文本，超长截断
  const SUMMARY_MAX = 180;
  const truncate = (text, fromEnd = false) => {
    const chars = Array.from(text);
    if (chars.length <= SUMMARY_MAX) return text;
    return fromEnd ? `…${chars.slice(-(SUMMARY_MAX - 1)).join('')}` : `${chars.slice(0, SUMMARY_MAX - 1).join('')}…`;
  };
  const summaryText = computed(() => {
    const lines = String(props.content || '').split(/\r?\n/);
    if (props.loading) {
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim().replace(/\s+/g, ' ');
        if (line) return truncate(line, true);
      }
      return '';
    }
    for (const raw of lines) {
      const line = raw.trim().replace(/\s+/g, ' ');
      if (line) return truncate(line);
    }
    return '';
  });
</script>

<style scoped lang="less">
  .reasoning {
    min-width: 0;
    margin: 2px 0 4px;
    padding: 3px 10px 3px 6px;
    border: 0.5px solid var(--mac-separator);
    border-radius: var(--mac-radius-md);
    background: rgba(255, 255, 255, 0.5);
  }

  .reasoning__head {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 24px;
    max-width: 100%;
    padding: 2px 7px;
    border: none;
    background: none;
    border-radius: var(--mac-radius-xs);
    color: var(--mac-text-3);
    font: inherit;
    font-size: 12px;
    font-weight: 560;
    text-align: left;
    cursor: pointer;

    &:hover {
      color: var(--mac-text);
      background: var(--mac-fill);
    }

    /* 思考中：文字做 shimmer 扫光（对齐 dsh data-running） */
    &[data-running] > span:first-of-type {
      background: linear-gradient(105deg, #9aa1ab 0%, #9aa1ab 38%, #1d1d1f 46%, #1d1d1f 54%, #9aa1ab 62%, #9aa1ab 100%);
      background-size: 220% 100%;
      background-position: 100% 0;
      background-clip: text;
      -webkit-background-clip: text;
      color: transparent;
      animation: reasoning-shimmer 5s linear infinite;
    }
    &[data-running]:hover > span:first-of-type {
      animation-play-state: paused;
      background: none;
      color: var(--mac-text);
    }
    &[data-running] .reasoning__icon,
    &[data-running] .reasoning__meta {
      color: var(--mac-text-3);
    }
  }

  .reasoning__icon {
    flex-shrink: 0;
    color: var(--mac-text-3);
  }

  .reasoning__meta {
    color: var(--mac-text-4);
    font-weight: 500;
    white-space: nowrap;
  }

  .reasoning__chevron {
    flex-shrink: 0;
    color: var(--mac-text-4);
    transition: transform 0.2s;

    &--open {
      transform: rotate(90deg);
    }
  }

  .reasoning__body {
    max-width: 100%;
    margin: 2px 0 6px 8px;
    padding-left: 12px;
    border-left: 2px solid var(--mac-separator);
    color: var(--mac-text-2);
    font-size: 12.5px;
    line-height: 1.72;
    white-space: pre-wrap;
    word-break: break-word;
    user-select: text;
  }

  .reasoning-summary {
    display: block;
    max-width: 100%;
    margin: 2px 0 6px 8px;
    padding: 0 0 0 12px;
    border: none;
    border-left: 2px solid var(--mac-separator);
    border-radius: 0;
    background: none;
    color: var(--mac-text-3);
    font: inherit;
    font-size: 12.5px;
    line-height: 1.72;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;

    &:hover {
      color: var(--mac-text);
    }
  }

  @keyframes reasoning-shimmer {
    0% {
      background-position: 220% 0;
    }
    100% {
      background-position: -220% 0;
    }
  }
</style>
