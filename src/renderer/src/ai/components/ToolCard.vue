<template>
  <!-- 工具调用行（对齐 dsh .tool）：状态 + 工具名 + 参数/结果摘要 + 耗时，点击展开详情 -->
  <div class="tool-card">
    <button
      type="button"
      class="tool-head"
      :class="{ 'tool-head--error': tcOk === false }"
      :data-running="running ? '' : undefined"
      :aria-expanded="detailsOpen"
      @click="toggleDetails"
    >
      <span class="tool-status">
        <span v-if="running" class="tool-spin"></span>
        <RiCheckLine v-else-if="tcOk !== false" :size="12" class="is-ok" />
        <RiCloseLine v-else :size="12" class="is-err" />
      </span>
      <span class="tool-name">{{ displayName }}</span>
      <span v-if="summaryText" class="tool-summary">{{ summaryText }}</span>
      <span class="tool-meta">
        <span v-if="durationText" class="tool-duration">{{ durationText }}</span>
        <RiArrowRightSLine class="tool-chevron" :class="{ 'tool-chevron--open': detailsOpen }" :size="12" />
      </span>
    </button>

    <div v-if="detailsOpen" class="tool-body">
      <div class="tool-block">
        <div class="tool-block__label">参数</div>
        <pre class="tool-pre">{{ argText || '（无参数）' }}</pre>
      </div>
      <div v-if="tcError || tcText" class="tool-block">
        <div class="tool-block__label">{{ tcOk === false ? '错误' : '结果' }}</div>
        <pre class="tool-pre" :class="{ 'is-error': tcOk === false }">{{
          tcOk === false ? tcError : cardExpanded ? tcText : summarizeText(tcText)
        }}</pre>
        <button
          v-if="tcOk !== false && needExpand(tcText)"
          type="button"
          class="tool-showall"
          @click.stop="toggleExpand"
        >
          {{ cardExpanded ? '收起' : '展开全部' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed } from 'vue';
  import { RiCheckLine, RiCloseLine, RiArrowRightSLine } from '@remixicon/vue';
  import { fmtDuration } from '../turnModel';
  import { toolDisplayName } from '../tools';

  const props = defineProps({
    /** 工具调用数据（turnModel 合并后含 ok/error/text/durationMs；或 OpenAI 风格原始 tool_calls 条目） */
    toolCall: {
      type: Object,
      default: null,
    },
    /** 流式调用中（渲染 loading 行） */
    calling: {
      type: Boolean,
      default: false,
    },
  });

  const tc = computed(() => (props.calling ? {} : props.toolCall || {}));
  const tcArgs = computed(() => tc.value?.function?.arguments ?? tc.value?.arguments);
  const tcText = computed(() => tc.value?.text || '');
  const tcError = computed(() => tc.value?.error || '');
  const tcDuration = computed(() => tc.value?.durationMs ?? null);
  const tcArgDelta = computed(() => tc.value?._argsDelta || '');

  // 结果状态：失败（红）/ 完成（绿）/ 尚未返回结果（执行中）
  const tcOk = computed(() =>
    props.calling ? undefined : tc.value?.ok !== undefined ? tc.value.ok : tc.value?.error ? false : undefined
  );
  const running = computed(() => props.calling || tcOk.value === undefined);

  const displayName = computed(() => (props.calling ? '调用工具中…' : toolDisplayName(tc.value)));

  const durationText = computed(() => {
    if (running.value || tcDuration.value == null) return '';
    return fmtDuration(tcDuration.value);
  });

  // 参数文本（对象/JSON 字符串统一美化；流式增量优先展示已接收内容）
  const argText = computed(() => {
    const delta = tcArgDelta.value;
    if (delta) return delta;
    const args = tcArgs.value;
    if (!args) return '';
    if (typeof args === 'string') {
      try {
        return JSON.stringify(JSON.parse(args), null, 2);
      } catch {
        return args;
      }
    }
    try {
      return JSON.stringify(args, null, 2);
    } catch {
      return String(args);
    }
  });

  // 头部单行摘要：执行中显示参数接收态，结束后仅展示简短纯文本结果（JSON 结构不铺在头部）
  const summaryText = computed(() => {
    if (running.value) return tcArgDelta.value ? '参数接收中…' : '';
    const text = (tcOk.value === false ? tcError.value : tcText.value || '').trim();
    if (!text || text.startsWith('{') || text.startsWith('[')) return '';
    const first = text.split(/\r?\n/)[0].replace(/\s+/g, ' ');
    return first.length > 60 ? `${first.slice(0, 59)}…` : first;
  });

  // 详情（参数/结果）默认收起，点击头部切换展开
  const detailsOpen = ref(false);
  const toggleDetails = () => {
    detailsOpen.value = !detailsOpen.value;
  };

  // 结果摘要（展示用 head/tail 截断；点击展开看全量）
  const RESULT_SUMMARY = 400;
  const summarizeText = (text) => {
    if (!text) return '';
    if (text.length <= RESULT_SUMMARY) return text;
    return `${text.slice(0, RESULT_SUMMARY)}…（共 ${text.length} 字符）`;
  };
  const needExpand = (text) => !!text && text.length > RESULT_SUMMARY;
  const expanded = ref(false);
  const cardExpanded = computed(() => expanded.value);
  const toggleExpand = () => {
    expanded.value = !expanded.value;
  };
</script>

<style scoped lang="less">
  .tool-card {
    min-width: 0;
    margin: 2px 0;
    border: var(--mac-hairline) solid rgba(0, 0, 0, 0.08);
    border-radius: var(--mac-radius-md);
    background: rgba(255, 255, 255, 0.6);
    overflow: hidden;
  }

  /* 工具头行：卡片标题栏，hover 高亮 */
  .tool-head {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    min-height: 30px;
    padding: 5px 10px;
    border: none;
    border-radius: 0;
    background: none;
    color: var(--mac-text-3);
    font: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    overflow: hidden;

    &:hover {
      background: var(--mac-fill);
    }

    &--error {
      color: var(--mac-red);
    }
  }

  .tool-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    flex-shrink: 0;

    .is-ok {
      color: var(--mac-green);
    }
    .is-err {
      color: var(--mac-red);
    }
  }

  .tool-spin {
    width: 10px;
    height: 10px;
    border: 2px solid var(--mac-fill-strong);
    border-top-color: var(--mac-text-2);
    border-radius: 50%;
    animation: tool-spin 0.9s linear infinite;
  }

  .tool-name {
    flex-shrink: 0;
    font-family: var(--font-code-family, var(--mac-font-mono));
    font-size: 12px;
    font-weight: 600;
    color: var(--mac-text);
  }

  /* 执行中：工具名 shimmer 扫光（对齐 dsh tool__head[data-running]） */
  .tool-head[data-running] .tool-name {
    background: linear-gradient(105deg, #9aa1ab 0%, #9aa1ab 38%, #1d1d1f 46%, #1d1d1f 54%, #9aa1ab 62%, #9aa1ab 100%);
    background-size: 220% 100%;
    background-position: 100% 0;
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    animation: tool-shimmer 5s linear infinite;
  }
  .tool-head[data-running]:hover .tool-name {
    animation-play-state: paused;
    background: none;
    color: var(--mac-text);
  }

  .tool-summary {
    flex: 1 1 auto;
    min-width: 0;
    color: var(--mac-text-3);
    font-family: var(--font-code-family, var(--mac-font-mono));
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tool-meta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    flex-shrink: 0;
    color: var(--mac-text-3);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .tool-chevron {
    flex-shrink: 0;
    color: var(--mac-text-4);
    transition: transform 0.2s;

    &--open {
      transform: rotate(90deg);
    }
  }

  /* 展开区：卡片内分隔线 + 内容缩进 */
  .tool-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 8px 10px 10px;
    border-top: var(--mac-hairline) solid var(--mac-separator);
    min-width: 0;
  }

  .tool-block {
    min-width: 0;

    &__label {
      margin-bottom: 3px;
      font-size: 11px;
      color: var(--mac-text-4);
    }
  }

  .tool-pre {
    max-height: 180px;
    margin: 0;
    padding: 6px 8px;
    background: var(--mac-fill);
    border: var(--mac-hairline) solid var(--mac-separator);
    border-radius: var(--mac-radius-control-sm);
    color: var(--mac-text-2);
    font-family: var(--font-code-family, var(--mac-font-mono));
    font-size: 11.5px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
    overflow-y: auto;
    user-select: text;

    &.is-error {
      color: var(--mac-red);
      background: rgba(255, 59, 48, 0.08);
      border-color: rgba(255, 59, 48, 0.2);
    }
  }

  .tool-showall {
    align-self: flex-start;
    margin-top: 4px;
    padding: 2px 8px;
    border: none;
    border-radius: var(--mac-radius-xs);
    background: rgba(120, 120, 128, 0.08);
    color: var(--mac-text-2);
    font-size: 11px;
    line-height: 1.6;
    cursor: pointer;

    &:hover {
      background: rgba(120, 120, 128, 0.14);
      color: var(--mac-text);
    }
  }

  @keyframes tool-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes tool-shimmer {
    0% {
      background-position: 220% 0;
    }
    100% {
      background-position: -220% 0;
    }
  }
</style>
