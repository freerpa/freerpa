<template>
  <div class="chat">
    <!-- 顶部标题栏 + 对话列表（独立组件） -->
    <ChatHeader
      :conversations="conversations"
      :current-conversation-id="currentConversationId"
      @new="handleNewChat"
      @switch="handleSwitchConversation"
      @remove="removeConversation"
      @close="emit('close')"
    />

    <!-- 消息列表：纯消息流平铺（无轮次包裹、无处理过程包裹、无头像） -->
    <div class="chat__messages" ref="messagesContainer" @scroll="onMessagesScroll">
      <template v-if="flatMessages.length > 0">
        <Bubble
          v-for="message in flatMessages"
          :key="message.message_id"
          :tool_calls="message.tool_calls"
          :tool_cards="message._toolCards"
          :content="message.content"
          :reasoning_content="message.reasoning_content"
          :role="message.role"
          :tool_calling="message.tool_calling"
          :loading="message.loading"
          :attachments="message.attachments"
          :usage="message._usage"
          @delete="handleDelete(indexOfMessage(message))"
        />
      </template>
      <!-- 空状态：AI 欢迎消息 -->
      <div class="message-item message-item--welcome" v-else>
        <div class="assistant-content">
          <div class="bubble bubble--assistant">
            <p>你好，我已连接工作流引擎，可以帮你设计、编辑和运行自动化工作流。</p>
            <p>请描述你的自动化需求，我会通过思考、调用工具逐步为你生成可执行的工作流配置。</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 会话统计：会话 tokens / 缓存命中率 / 上下文长度 / 当前会话轮数（usage 随消息持久化，跨会话恢复） -->
    <div class="chat__stats">
      <span>会话 {{ fmtTokens(sessionTokens) }} tokens</span>
      <span>缓存命中 {{ cacheHitRate }}</span>
      <span>上下文 {{ fmtTokens(lastInputTokens) }} tokens</span>
      <span>{{ userTurnCount }} 轮</span>
    </div>

    <!-- 底部输入区 -->
    <Sender ref="senderRef" class="chat__sender" @send="handleSend" @cancel="handleCancel" :loading="loading" />
  </div>
</template>

<script setup>
  import { ref, computed, nextTick, onMounted, watch } from 'vue';
  import Bubble from './Bubble.vue';
  import Sender from './Sender.vue';
  import ChatHeader from './ChatHeader.vue';
  import { buildRoundGroups } from './turnModel';
  import { useFlowStore } from '@/workflow/store';
  import { useAiChat } from './composables/useAiChat';
  import { buildTools, buildExecutors } from './tools';
  import { createPromptContext } from './prompt';

  const props = defineProps({
    workflowId: {
      type: String,
      required: true,
    },
    /** FlowCanvas 组件 ref（提供 addNode / handleNodeDelete） */
    workflowRef: {
      type: Object,
      required: true,
    },
    /** VueFlow 实例 ref（storeToRefs(flowStore) 解构而来） */
    vueFlowRef: {
      type: Object,
      required: true,
    },
    /** 面板显隐（index.vue 控制）：打开时刷新模型下拉，确保配置模型后立即可选 */
    visible: {
      type: Boolean,
      default: false,
    },
  });

  const emit = defineEmits(['close', 'workflow']);

  const flowStore = useFlowStore(props.workflowId);
  const senderRef = ref(null);
  const messagesContainer = ref(null);
  // 智能自动滚动：有新消息时滚动到底部，但用户主动向上翻阅时暂停跟随（避免打断阅读），
  // 用户滚回底部后恢复自动跟随
  let userScrolledUp = false;
  let lastScrollTop = 0;
  const onMessagesScroll = () => {
    const el = messagesContainer.value;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (atBottom) {
      userScrolledUp = false;
    } else if (el.scrollTop < lastScrollTop) {
      userScrolledUp = true;
    }
    lastScrollTop = el.scrollTop;
  };
  const scrollToBottom = () => {
    nextTick(() => {
      if (!messagesContainer.value || userScrolledUp) return;
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    });
  };

  // 面板打开时刷新模型列表（Sender 常驻挂载，配置模型后需主动重新加载）
  watch(
    () => props.visible,
    (visible) => {
      if (visible) senderRef.value?.loadModels();
    }
  );

  // 工具定义与执行器（画布上下文注入）
  const ctx = { workflowId: props.workflowId };
  const tools = buildTools(ctx);
  const executors = buildExecutors(ctx);

  // prompt 构建（系统提示 / 每轮快照 / 记忆）独立于 prompt.js，此处取实例上下文
  const { buildSystem, buildTurn, loadMemories } = createPromptContext({
    workflowId: props.workflowId,
    flowStore,
  });

  const {
    messages,
    conversations,
    currentConversationId,
    loading,
    init,
    newConversation,
    switchConversation,
    removeConversation,
    allMessages,
    send,
    cancel,
    removeMessage,
  } = useAiChat({
    workflowId: props.workflowId,
    tools,
    executors,
    buildSystem,
    buildTurn,
    scrollToBottom,
  });

  onMounted(() => {
    init();
    loadMemories();
  });

  const handleSend = (payload) => send(payload);
  const handleCancel = () => cancel();
  const handleDelete = (index) => removeMessage(index);
  // 轮次分组（turn 分区模型）：仅用于给每条消息挂 _toolCards（工具结果按 toolCallId 合并）
  // 渲染不再分组包裹——纯消息流平铺，由 flatMessages 展开
  const roundGroups = computed(() =>
    buildRoundGroups(
      messages.value,
      allMessages.value.filter((m) => m.role === 'tool')
    )
  );
  // 平铺消息流：按原顺序展开（组首用户消息 + 各段消息），保留 buildRoundGroups 的结果合并副作用
  const flatMessages = computed(() => {
    const out = [];
    for (const g of roundGroups.value) {
      if (g.user) out.push(g.user);
      for (const seg of g.segments) out.push(...seg.items);
    }
    return out;
  });
  const indexOfMessage = (message) => messages.value.indexOf(message);

  // 会话统计：会话 tokens = 全部 assistant 用量求和；
  // 缓存命中率 = 会话累计 cacheHit / (cacheHit + cacheMiss)——参照 DeepSeek-Reasonix：
  // 分母为命中+未命中（不含其他计费项），两位小数，无缓存明细（分母 ≤ 0）显示 —。
  // 数据来源：AI SDK v7 usage.inputTokenDetails.{cacheReadTokens, noCacheTokens}（DeepSeek
  // prompt_tokens_details.cached_tokens 归一化于此），raw 顶层 prompt_cache_{hit,miss}_tokens 兜底；
  // 上下文长度 = 最后一条 assistant 调用提交的 inputTokens；轮数 = 用户消息条数
  // （usage 随消息持久化在 usage 列，跨会话/重启恢复）
  const sessionTokens = computed(() => allMessages.value.reduce((sum, m) => sum + (m._usage?.totalTokens || 0), 0));
  const cacheOf = (m) => m._usage?.inputTokenDetails?.cacheReadTokens ?? m._usage?.raw?.prompt_cache_hit_tokens ?? 0;
  const missOf = (m) => m._usage?.inputTokenDetails?.noCacheTokens ?? m._usage?.raw?.prompt_cache_miss_tokens ?? 0;
  const cacheHitTokens = computed(() => allMessages.value.reduce((sum, m) => sum + cacheOf(m), 0));
  const cacheMissTokens = computed(() => allMessages.value.reduce((sum, m) => sum + missOf(m), 0));
  const cacheHitRate = computed(() => {
    const denom = cacheHitTokens.value + cacheMissTokens.value;
    if (denom <= 0) return '—';
    return `${((cacheHitTokens.value / denom) * 100).toFixed(2)}%`;
  });
  const lastInputTokens = computed(() => {
    const list = allMessages.value.filter((m) => m.role === 'assistant' && m._usage?.inputTokens);
    return list.length > 0 ? list[list.length - 1]._usage.inputTokens : 0;
  });
  const userTurnCount = computed(() => allMessages.value.filter((m) => m.role === 'user').length);
  const fmtTokens = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
  const handleNewChat = () => {
    newConversation();
  };
  const handleSwitchConversation = async (conversationId) => {
    await switchConversation(conversationId);
  };
</script>

<style lang="less">
  @import './ai.less';
</style>

<style scoped lang="less">
  .chat {
    display: flex;
    flex-direction: column;
    width: 520px;
    height: 100%;
    background: #fff;

    .chat__messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    // 会话统计条（输入框与消息记录之间）
    .chat__stats {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 6px 12px;
      font-size: 12px;
      color: #9ca3af;
      border-top: 1px solid #e5e5e8;
      background: #fafafa;
    }

    .chat__sender {
      flex-shrink: 0;
      padding: 12px;
      border-top: 1px solid #e5e5e8;
      background: #f7f7f8;
    }
  }

  // 空状态欢迎消息（与 Bubble 助手消息样式一致）
  .message-item--welcome {
    display: flex;
    gap: 12px;
    .assistant-content {
      flex: 1;
      max-width: 100%;
    }
    .bubble--assistant {
      background: #f0f0f2;
      border: 1px solid #e5e5e8;
      border-radius: var(--border-radius-small);
      border-bottom-left-radius: var(--border-radius-small);
      padding: 12px 16px;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      max-width: 100%;
      p {
        margin: 0;
      }
      p + p {
        margin-top: 8px;
      }
    }
  }
</style>
