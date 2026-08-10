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
          <div class="ai-bubble-actions">
            <a-button class="ai-bubble-action" type="secondary" size="mini" title="复制" @click="copyContent">
              <template #icon>
                <RiFileCopyLine :size="13" />
              </template>
            </a-button>
            <a-button
              class="ai-bubble-action ai-bubble-action--danger"
              type="secondary"
              size="mini"
              title="删除"
              @click="deleteBubble"
            >
              <template #icon>
                <RiDeleteBin6Line :size="13" />
              </template>
            </a-button>
          </div>
        </div>
      </div>
    </template>

    <!-- 助手消息：内容块 + 底部操作（无头像，纯消息流） -->
    <template v-else>
      <div class="assistant-content">
        <!-- 思考折叠块 -->
        <div class="ai-panel reasoning-panel" v-if="safeReasoning">
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
            <div class="reasoning-text">{{ safeReasoning }}</div>
          </div>
        </div>

        <!-- 工具调用卡片 -->
        <div class="ai-panel tool-panel" v-if="tool_calling === 'loading'">
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
        <div class="ai-panel tool-panel" v-for="tc in toolCallList" :key="tc.id">
          <div class="ai-panel-head">
            <div class="ai-panel-head__left">
              <span class="tool-icon"><RiFlowChart :size="12" /></span>
              <span class="tool-title">调用工具：{{ toolGroupLabel(tcName(tc)) }}</span>
            </div>
            <span
              class="tool-status"
              :class="tcOk(tc) === false ? 'tool-status--error' : 'tool-status--done'"
            >
              <span class="dot" :class="tcOk(tc) === false ? 'dot--red' : 'dot--green'"></span>
              {{ tcOk(tc) === false ? '失败' : tcDuration(tc) != null ? '已执行 · ' + fmtDuration(tcDuration(tc)) : '已完成' }}
            </span>
          </div>
          <div class="ai-panel-body panel-body--mono">
            <div class="cmd">
              &gt; {{ tcName(tc) }}
              <template v-if="tcArgDelta(tc) && !hasRealArgs(tc)">{{ tcArgDelta(tc) }}</template>
              <template v-else>{{ argsText(tcArgs(tc)) }}</template>
            </div>
          </div>
          <!-- 结果区：成功摘要 / 失败错误，过长可展开全量 -->
          <div class="tool-result" v-if="tcError(tc) || tcText(tc)">
            <div class="tool-result__body" :class="{ 'is-error': tcOk(tc) === false }">
              {{ tcOk(tc) === false ? tcError(tc) : cardExpanded(tc.id) ? tcText(tc) : summarizeText(tcText(tc)) }}
            </div>
            <span
              class="tool-result__toggle"
              v-if="tcOk(tc) !== false && needExpand(tcText(tc))"
              @click="toggleCardExpand(tc.id)"
            >
              {{ cardExpanded(tc.id) ? '收起' : '展开全部' }}
            </span>
          </div>
        </div>

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

        <!-- 底部操作 -->
        <div class="ai-bubble-actions">
          <a-button class="ai-bubble-action" type="secondary" size="mini" title="复制" @click="copyContent">
            <template #icon>
              <RiFileCopyLine :size="13" />
            </template>
          </a-button>
          <a-button
            class="ai-bubble-action ai-bubble-action--danger"
            type="secondary"
            size="mini"
            title="删除"
            @click="deleteBubble"
          >
            <template #icon>
              <RiDeleteBin6Line :size="13" />
            </template>
          </a-button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import {
  RiBrainLine,
  RiArrowDownSLine,
  RiLoader4Line,
  RiFlowChart,
  RiFileLine,
  RiGlobalLine,
  RiDatabase2Line,
  RiStackLine,
  RiFileCopyLine,
  RiDeleteBin6Line
} from '@remixicon/vue'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'
import { fmtDuration } from './turnModel'

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

const emit = defineEmits(['copy', 'delete'])

// 渲染兜底：清洗历史脏数据（'undefined' 字面量 / 非法值），避免显示 undefined
const safeContent = computed(() => {
  const c = props.content
  return !c || c === 'undefined' || c === '[object Object]' ? '' : c
})
const safeReasoning = computed(() => {
  const c = props.reasoning_content
  return !c || c === 'undefined' ? '' : c
})
// token 用量展示（千分位格式，轻量）
const usageTotal = computed(() => {
  const n = props.usage?.totalTokens
  if (!n) return ''
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
})
const safeAttachments = computed(() =>
  Array.isArray(props.attachments) ? props.attachments.filter((a) => a && a.name) : []
)

// 附件图标映射（数据表统一 RiDatabase2Line）
const ATTACH_META = {
  file: { icon: RiFileLine },
  workflow: { icon: RiFlowChart },
  browser: { icon: RiGlobalLine },
  table: { icon: RiDatabase2Line },
  element: { icon: RiStackLine }
}
const attMeta = (type) => ATTACH_META[type] || ATTACH_META.file

// 思考过程：流式思考中自动展开（用户可见思考过程），思考完毕（loading 结束）自动收起成标题行；
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
// 工具卡片：优先 turnModel 合并数据（含结果/错误/耗时），回退 tool_calls（OpenAI 风格 {id, function:{name,arguments}}）
const toolCallList = computed(() => {
  if (Array.isArray(props.tool_cards) && props.tool_cards.length > 0) return props.tool_cards
  const raw = props.tool_calls
  return Array.isArray(raw) ? raw : []
})
const tcName = (tc) => tc?.function?.name || tc?.name || ''
const tcArgs = (tc) => tc?.function?.arguments ?? tc?.arguments
const tcOk = (tc) => (tc?.ok !== undefined ? tc.ok : tc?.error ? false : undefined)
const tcText = (tc) => tc?.text || ''
const tcError = (tc) => tc?.error || ''
const tcDuration = (tc) => tc?.durationMs ?? null
const tcArgDelta = (tc) => tc?._argsDelta || ''
// 是否有"真实"完整参数（对象需非空；空对象/undefined/null 视为无——流式 delta 展示优先）
const hasRealArgs = (tc) => {
  const a = tcArgs(tc)
  if (!a) return false
  return typeof a === 'object' ? Object.keys(a).length > 0 : !!a
}

// 结果摘要（展示用 head/tail 截断；点击展开看全量）
const RESULT_SUMMARY = 200
const summarizeText = (text) => {
  if (!text) return ''
  if (text.length <= RESULT_SUMMARY) return text
  return `${text.slice(0, RESULT_SUMMARY)}...（共 ${text.length} 字符，点击下方展开）`
}
const needExpand = (text) => !!text && text.length > RESULT_SUMMARY
// 展开态（卡片 id → 是否展开全量结果）
const expandedCards = ref(new Set())
const toggleCardExpand = (id) => {
  const next = new Set(expandedCards.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedCards.value = next
}
const cardExpanded = (id) => expandedCards.value.has(id)

// 工具名 → 所属模块标签（与 tools/ 分组对应）
const toolGroupLabel = (name = '') => {
  if (!name) return '未知工具'
  if (name.startsWith('addNode_') || ['deleteNode', 'addEdge', 'deleteEdge', 'getWorkflows', 'getWorkflow', 'finish'].includes(name)) return '工作流引擎'
  if (['openBrowser', 'closeBrowser', 'getAllBrowserStatus', 'getKernelList', 'getMajorVersionList', 'checkKernel', 'downloadKernel', 'createBrowser'].includes(name)) return '浏览器'
  if (['listTables', 'getTable', 'queryData', 'createData', 'updateData', 'deleteData', 'createTable', 'deleteTable'].includes(name)) return '数据表'
  if (['listElementSets', 'getElementSet', 'createElementSet'].includes(name)) return '元素集'
  return '工作流引擎'
}

const argsText = (args) => {
  if (!args || Object.keys(args).length === 0) return ''
  const text = JSON.stringify(args)
  return text.length > 80 ? `(${text.slice(0, 80)}...)` : `(${text})`
}

const copied = ref(false)
const copyContent = async () => {
  const text = safeContent.value || safeReasoning.value
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
  emit('copy', text)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1200)
}

const deleteBubble = () => emit('delete')
</script>

<style scoped lang="less">
.message-item {
  position: relative;
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
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
    margin-bottom: 8px;
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
    padding: 2px 8px;
    font-size: 11px;
    max-width: 180px;
  }
}

// 思考折叠块局部样式
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

.tool-panel {
  .tool-icon {
    width: 22px;
    height: 22px;
    border-radius: var(--border-radius-small);
    background: rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: #111114;
    flex-shrink: 0;
  }
  .tool-title {
    font-size: 13px;
    font-weight: 500;
    color: #111114;
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
  }
  .cmd {
    color: #6b7280;
    word-break: break-all;
  }
  .panel-body--mono {
    font-family: monospace;
    background: rgba(247, 247, 248, 0.6);
  }

  .bubble__meta {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    font-size: 11px;
    color: #9ca3af;
  }

  // 工具结果区（成功摘要 / 失败错误，过长可展开全量）
  .tool-result {
    margin: 6px 8px 8px;
    padding: 8px 10px;
    border-top: 1px dashed #e5e5e8;
    font-size: 12px;

    .tool-result__body {
      color: #44444e;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 180px;
      overflow-y: auto;
      font-family: monospace;

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

.spin {
  animation: icon-spin 1s linear infinite;
}

@keyframes icon-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes typing-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
  40% { transform: translateY(-4px); opacity: 1; }
}
</style>
