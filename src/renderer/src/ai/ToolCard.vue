<template>
  <!-- 工具调用中（流式加载态） -->
  <div class="ai-panel tool-panel" v-if="calling">
    <div class="ai-panel-head">
      <div class="ai-panel-head__left">
        <span class="tool-icon"><RiLoader4Line class="spin" :size="12" /></span>
        <span class="tool-title">调用工具中...</span>
      </div>
      <span class="tool-status tool-status--loading">
        <span class="dot dot--gray"></span>执行中
      </span>
    </div>
  </div>

  <!-- 工具调用卡片（含结果合并数据）；详情（参数/结果）默认收起，点击头部展开 -->
  <div class="ai-panel tool-panel" v-else>
    <div class="ai-panel-head" @click="toggleDetails">
      <div class="ai-panel-head__left">
        <span class="tool-icon"><RiFlowChart :size="12" /></span>
        <span class="tool-title">调用工具：{{ toolDisplayName(tc) }}</span>
      </div>
      <div class="ai-panel-head__right">
        <span class="tool-status" :class="`tool-status--${toolStatus.type}`">
          <span class="dot" :class="`dot--${DOT_CLASS[toolStatus.type]}`"></span>
          {{ toolStatus.label }}
        </span>
        <RiArrowDownSLine
          class="panel-head__chevron"
          :size="14"
          :style="{ transform: detailsOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }"
        />
      </div>
    </div>
    <template v-if="detailsOpen">
      <div class="ai-panel-body panel-body--mono">
        <div class="cmd">
          &gt; {{ tcName }}
          <template v-if="tcArgDelta && !hasRealArgs">{{ tcArgDelta }}</template>
          <template v-else>{{ argsText(tcArgs) }}</template>
        </div>
      </div>
      <!-- 结果区：成功摘要 / 失败错误，过长可展开全量 -->
      <div class="tool-result" v-if="tcError || tcText">
        <div class="tool-result__body" :class="{ 'is-error': tcOk === false }">
          {{ tcOk === false ? tcError : cardExpanded ? tcText : summarizeText(tcText) }}
        </div>
        <span class="tool-result__toggle" v-if="tcOk !== false && needExpand(tcText)" @click="toggleExpand">
          {{ cardExpanded ? '收起' : '展开全部' }}
        </span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { RiLoader4Line, RiFlowChart, RiArrowDownSLine } from '@remixicon/vue'
import { fmtDuration } from './turnModel'
import { toolDisplayName } from './tools'

const props = defineProps({
  /** 工具调用数据（turnModel 合并后含 ok/error/text/durationMs；或 OpenAI 风格原始 tool_calls 条目） */
  toolCall: {
    type: Object,
    default: null
  },
  /** 流式调用中（渲染 loading 卡） */
  calling: {
    type: Boolean,
    default: false
  }
})

const tc = computed(() => props.toolCall || {})
const tcName = computed(() => tc.value?.function?.name || tc.value?.name || '')
const tcArgs = computed(() => tc.value?.function?.arguments ?? tc.value?.arguments)
const tcOk = computed(() => (tc.value?.ok !== undefined ? tc.value.ok : tc.value?.error ? false : undefined))
const tcText = computed(() => tc.value?.text || '')
const tcError = computed(() => tc.value?.error || '')
const tcDuration = computed(() => tc.value?.durationMs ?? null)
const tcArgDelta = computed(() => tc.value?._argsDelta || '')

// 状态三级化：失败（红）/ 已执行或已完成（绿）/ 待定（灰）——
// 未合并结果的流式卡片（ok/durationMs 均无）显示"执行中"，避免"工具还在调用却显示已完成"的矛盾
const DOT_CLASS = { error: 'red', done: 'green', pending: 'gray' }
const toolStatus = computed(() => {
  if (tcOk.value === false) return { type: 'error', label: '失败' }
  if (tcOk.value !== undefined && tcDuration.value != null) {
    return { type: 'done', label: `已执行 · ${fmtDuration(tcDuration.value)}` }
  }
  if (tcOk.value !== undefined) return { type: 'done', label: '已完成' }
  return { type: 'pending', label: '执行中' }
})
// 是否有"真实"完整参数（对象需非空；空对象/undefined/null 视为无——流式 delta 展示优先）
const hasRealArgs = computed(() => {
  const a = tcArgs.value
  if (!a) return false
  return typeof a === 'object' ? Object.keys(a).length > 0 : !!a
})

const argsText = (args) => {
  if (!args || Object.keys(args).length === 0) return ''
  const text = JSON.stringify(args)
  return text.length > 80 ? `(${text.slice(0, 80)}...)` : `(${text})`
}

// 详情（参数/结果）默认收起，点击头部切换展开
const detailsOpen = ref(false)
const toggleDetails = () => {
  detailsOpen.value = !detailsOpen.value
}

// 结果摘要（展示用 head/tail 截断；点击展开看全量）
const RESULT_SUMMARY = 200
const summarizeText = (text) => {
  if (!text) return ''
  if (text.length <= RESULT_SUMMARY) return text
  return `${text.slice(0, RESULT_SUMMARY)}...（共 ${text.length} 字符，点击下方展开）`
}
const needExpand = (text) => !!text && text.length > RESULT_SUMMARY
const expanded = ref(false)
const cardExpanded = computed(() => expanded.value)
const toggleExpand = () => {
  expanded.value = !expanded.value
}
</script>

<style scoped lang="less">
.tool-panel {
  .ai-panel-head {
    cursor: pointer;
    &:hover { background: rgba(240, 240, 242, 0.6); }
    &__right {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .panel-head__chevron {
      color: #6b7280;
      font-size: 12px;
      cursor: pointer;
      flex-shrink: 0;
    }
  }

  .tool-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: #111114;
    flex-shrink: 0;
  }
  .tool-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tool-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    flex-shrink: 0;
    margin-left: 8px;
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      &--green { background: #10b981; }
      &--gray { background: #9ca3af; }
      &--red { background: #f04142; }
    }
    &--done { color: #10b981; }
    &--error { color: #f04142; }
    &--loading { color: #9ca3af; }
    &--pending { color: #9ca3af; }
  }
  .cmd {
    color: #6b7280;
    word-break: break-all;
  }
  // 与思考折叠块（.ai-panel-body）一致的副文本样式：12px / #6b7280，非等宽字体，不抢注意力
  .panel-body--mono {
    background: rgba(247, 247, 248, 0.6);
  }

  // 工具结果区（成功摘要 / 失败错误，过长可展开全量）
  .tool-result {
    margin: 6px 8px 8px;
    padding: 8px 10px;
    border-top: 1px dashed #e5e5e8;
    font-size: 12px;

    .tool-result__body {
      color: #6b7280;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 180px;
      overflow-y: auto;

      &.is-error {
        color: #f04142;
      }
    }

    .tool-result__toggle {
      display: inline-block;
      margin-top: 4px;
      color: #4b7bec;
      cursor: pointer;
      user-select: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

.spin {
  animation: icon-spin 1s linear infinite;
}

@keyframes icon-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
