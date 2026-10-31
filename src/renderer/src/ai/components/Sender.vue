<template>
  <div class="sender">
    <!-- @ 资源引用菜单：按 tabs 列出工作流/数据表/浏览器/元素集 -->
    <ReferenceMenu
      v-if="mentionOpen"
      ref="mentionMenuRef"
      class="mention-menu"
      :keyword="mentionKeyword"
      @pick="handleMentionPick"
    />

    <div class="input-card">
      <!-- 文件附件展示区（资源引用以输入框内联 pill 呈现，不再堆在这里） -->
      <div class="attachments-area" v-if="attachments.length > 0">
        <div v-for="(att, index) in attachments" :key="index" class="ai-attach-chip attachment-item">
          <component :is="getAttachmentMeta(att.type).icon" :size="12" />
          <span class="attachment-item__name">{{ att.name }}</span>
          <a-button class="attachment-item__del" type="secondary" size="mini" @click="attachments.splice(index, 1)">
            <RiCloseLine :size="12" />
          </a-button>
        </div>
      </div>

      <!-- 可编辑输入区：@资源引用渲染为带类型颜色/标签的内联 pill -->
      <div class="editor-wrap">
        <div
          id="msg-input"
          ref="editorRef"
          class="msg-editor"
          contenteditable="true"
          role="textbox"
          aria-multiline="true"
          spellcheck="false"
          @input="handleEditorInput"
          @keydown="handleKeydown"
          @mouseup="syncMention"
          @blur="closeMention"
          @paste="handlePaste"
          @compositionstart="composing = true"
          @compositionend="handleCompositionEnd"
        ></div>
        <span v-if="isEmpty" class="editor-placeholder">{{ placeholder }}</span>
      </div>

      <!-- 底部工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <!-- 模型选择（展开时重新拉取，保证设置中变更后立即生效） -->
          <a-select
            class="model-select"
            size="small"
            v-model="selectedModel"
            :options="modelOptions"
            placeholder="选择模型"
            @popup-visible-change="(visible) => visible && loadModels()"
          />

          <!-- 添加文件 -->
          <div class="dropup">
            <a-button class="ai-icon-btn" type="text" title="添加文件" @click="fileInput?.click()">
              <RiAttachmentLine :size="15" />
            </a-button>
            <input ref="fileInput" type="file" multiple class="hidden-input" @change="handleFiles" />
          </div>
        </div>

        <!-- 发送按钮 -->
        <a-button class="send-btn" type="primary" :disabled="inputText.trim() === '' && !loading" @click="handleSend">
          <template #icon>
            <RiStopCircleLine v-if="loading" :size="16" />
            <RiSendPlaneFill v-else :size="16" />
          </template>
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { RiCloseLine, RiAttachmentLine, RiStopCircleLine, RiSendPlaneFill } from '@remixicon/vue';
  import { getModels } from '@/api/aiModels';
  import { v4 as uuidv4 } from 'uuid';
  import ReferenceMenu from './ReferenceMenu.vue';
  import { getAttachmentMeta } from '../attachmentMeta';
  import { loadAllResources, getCachedResources } from '../resourceIndex';

  const props = defineProps({
    placeholder: {
      type: String,
      default: '描述你的需求，输入 @ 引用资源，Enter 发送，Shift+Enter 换行...',
    },
    loading: {
      type: Boolean,
      default: false,
    },
  });

  const emit = defineEmits(['send', 'cancel']);

  // ---- 输入（contenteditable 无法 v-model，内部维护序列化文本） ----
  const editorRef = ref(null);
  const inputText = ref('');
  const isEmpty = ref(true);
  let composing = false;

  /**
   * 序列化可编辑区：文本节点原样拼接；引用 pill 还原为 @名称 并收集为 attachments；
   * <br> 视为换行；块级元素（粘贴产生的 div/p）补换行。
   */
  const serializeEditor = (root) => {
    let text = '';
    const refs = [];
    const seen = new Set();

    const visit = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += (node.textContent || '').replace(/\u00A0/g, ' ');
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node;
      if (el.classList.contains('ref-pill') && el.dataset.type && el.dataset.name) {
        const key = `${el.dataset.type}:${el.dataset.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          refs.push({ type: el.dataset.type, id: el.dataset.id, name: el.dataset.name });
        }
        text += `@${el.dataset.name}`;
        return;
      }
      if (el.tagName === 'BR') {
        text += '\n';
        return;
      }
      el.childNodes.forEach(visit);
      if ((el.tagName === 'DIV' || el.tagName === 'P') && el.nextSibling) text += '\n';
    };

    root?.childNodes?.forEach(visit);
    return { text, refs };
  };

  const autoResize = () => {
    const el = editorRef.value;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 60), 160)}px`;
  };

  const onEditorChanged = () => {
    const { text } = serializeEditor(editorRef.value);
    inputText.value = text;
    isEmpty.value = text.length === 0;
    autoResize();
  };

  const handleEditorInput = () => {
    onEditorChanged();
    // 中文输入法组合期间不要触发 @ 菜单，避免打断输入
    if (!composing) syncMention();
  };

  const handleCompositionEnd = () => {
    composing = false;
    onEditorChanged();
    syncMention();
  };

  // ---- 模型选择 ----
  const models = ref([]);
  const selectedModel = ref('');
  const modelOptions = computed(() => {
    const groups = {};
    models.value.forEach((m) => {
      const key = m.providerId;
      if (!groups[key]) {
        groups[key] = { isGroup: true, label: m.providerName, options: [] };
      }
      groups[key].options.push({
        // 模型 ID 是唯一标识：显示名直接取 ID，避免历史数据中残留的旧 name 导致下拉显示与配置不一致
        label: m.modelId,
        value: JSON.stringify({ providerId: m.providerId, modelId: m.modelId }),
      });
    });
    return Object.values(groups);
  });

  const loadModels = async () => {
    try {
      const list = (await getModels()) || [];
      models.value = list;
      const current = selectedModel.value;
      if (current && list.some((m) => JSON.stringify({ providerId: m.providerId, modelId: m.modelId }) === current)) {
        return;
      }
      selectedModel.value = list[0] ? JSON.stringify({ providerId: list[0].providerId, modelId: list[0].modelId }) : '';
    } catch (err) {
      console.error('加载模型列表失败:', err);
    }
  };
  loadModels();
  defineExpose({ loadModels });

  let offProvidersChanged = null;
  onMounted(() => {
    // 双通道刷新：主进程广播（跨窗口/设置保存）+ 渲染进程自定义事件（设置弹窗内保存即时生效）
    offProvidersChanged = window.electronAPI.ai.onProvidersChanged(() => loadModels());
    window.addEventListener('ai:models-changed', loadModels);
    isEmpty.value = true;
    // 预热资源索引（不阻塞输入）：保证粘贴含 @资源名 的历史会话时能立即还原引用 pill
    loadAllResources();
  });
  onUnmounted(() => {
    offProvidersChanged?.();
    window.removeEventListener('ai:models-changed', loadModels);
  });

  // ---- 文件附件 ----
  const attachments = ref([]); // [{ type: 'file', name }]
  const fileInput = ref(null);
  const handleFiles = (e) => {
    Array.from(e.target.files || []).forEach((file) => {
      attachments.value.push({ type: 'file', name: file.name });
    });
    e.target.value = '';
  };

  // ---- @ 资源引用（工作流/数据表/浏览器/元素集） ----
  const mentionOpen = ref(false);
  const mentionKeyword = ref('');
  const mentionMenuRef = ref(null);
  // 光标快照：DOM 节点 + 偏移（非响应式，避免 Vue 代理 DOM 节点）
  let mentionCaret = null;

  const closeMention = () => {
    mentionOpen.value = false;
    mentionKeyword.value = '';
    mentionCaret = null;
  };

  /** 读取编辑器光标前的纯文本（pill 按 @名称 计算） */
  const textBeforeCaret = (caret) => {
    const editor = editorRef.value;
    if (!editor || !caret) return '';
    const range = document.createRange();
    try {
      range.setStart(editor, 0);
      range.setEnd(caret.node, caret.offset);
    } catch {
      return '';
    }
    return serializeEditor(range.cloneContents()).text;
  };

  /**
   * 同步 @ 菜单状态：光标前文本匹配「行首/空白/非字母数字 + @ + 非空白关键字」时展开。
   * 用 \w 排除邮箱场景（a@b.c 不触发），中文等非 ASCII 字符前允许触发。
   */
  const syncMention = () => {
    const editor = editorRef.value;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) {
      closeMention();
      return;
    }
    const range = selection.getRangeAt(0);
    if (!range.collapsed || !editor.contains(range.startContainer)) {
      closeMention();
      return;
    }
    const caret = { node: range.startContainer, offset: range.startOffset };
    const before = textBeforeCaret(caret);
    const matched = before.match(/(^|[^\w@])@([^\s@]*)$/);
    if (!matched) {
      closeMention();
      return;
    }
    mentionOpen.value = true;
    mentionKeyword.value = matched[2];
    mentionCaret = caret;
  };

  /** 创建带类型颜色/标签的内联引用 pill（contenteditable=false，整体不可逐字编辑） */
  const createPill = (item) => {
    const pill = document.createElement('span');
    pill.className = `ref-pill ref-pill--${item.type}`;
    pill.contentEditable = 'false';
    pill.dataset.type = item.type;
    pill.dataset.id = String(item.id ?? '');
    pill.dataset.name = item.name;
    pill.title = `${getAttachmentMeta(item.type).label}：${item.name}`;

    const tag = document.createElement('span');
    tag.className = 'ref-pill__tag';
    tag.textContent = getAttachmentMeta(item.type).label;

    const name = document.createElement('span');
    name.className = 'ref-pill__name';
    name.textContent = `@${item.name}`;

    pill.append(tag, name);
    return pill;
  };

  /**
   * 选中资源后：用 Range 把光标前的 @关键字 替换成内联 pill（参考 dsh RichComposerInput 的原子 token 设计），
   * 引用与用户语义位置一一对应，并通过类型颜色/标签避免引错类型。
   */
  const handleMentionPick = (item) => {
    const editor = editorRef.value;
    const caret = mentionCaret;
    if (!editor || !caret) {
      closeMention();
      return;
    }

    const range = document.createRange();
    let startNode = caret.node;
    let startOffset = caret.offset;
    if (startNode.nodeType === Node.TEXT_NODE) {
      startOffset = caret.offset - mentionKeyword.value.length - 1;
      if (startOffset < 0) {
        const text = startNode.textContent || '';
        const at = text.lastIndexOf('@', Math.max(0, caret.offset - 1));
        startOffset = at >= 0 ? at : caret.offset;
      }
    }
    try {
      range.setStart(startNode, startOffset);
      range.setEnd(caret.node, caret.offset);
    } catch {
      closeMention();
      return;
    }
    range.deleteContents();

    const pill = createPill(item);
    range.insertNode(pill);
    // 插入一个不换行空格作为光标锚点，保证 pill 后能继续输入且 token 边界完整
    const space = document.createTextNode('\u00A0');
    pill.after(space);

    const after = document.createRange();
    after.setStart(space, 1);
    after.collapse(true);
    const selection = window.getSelection();
    editor.focus();
    selection.removeAllRanges();
    selection.addRange(after);

    onEditorChanged();
    closeMention();
  };

  /** 文本片段 → DOM（换行转为 <br>，保留完整内容） */
  const appendText = (fragment, text) => {
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      if (index > 0) fragment.append(document.createElement('br'));
      if (line) fragment.append(document.createTextNode(line));
    });
  };

  /** 是否为 ASCII 单词字符（用于排除邮箱 a@b 这类非引用场景；中文相邻仍视为引用边界） */
  const isWordChar = (char) => !!char && /[A-Za-z0-9_]/.test(char);

  /**
   * 粘贴文本 → DOM 片段：把其中能被资源索引命中的 @资源名 还原为引用 pill，
   * 未命中的部分按纯文本保留（换行完整保留），避免带入外部 HTML。
   */
  const buildPasteFragment = (text, resources) => {
    const fragment = document.createDocumentFragment();
    // 名称长的优先匹配，避免短名称抢先匹配长名称的前缀
    const sorted = [...resources].filter((item) => item?.name).sort((a, b) => b.name.length - a.name.length);
    let buffer = '';
    let index = 0;
    while (index < text.length) {
      const char = text[index];
      if (char === '@' && !isWordChar(index > 0 ? text[index - 1] : '')) {
        const hit = sorted.find((item) => {
          if (!text.startsWith(item.name, index + 1)) return false;
          return !isWordChar(text[index + 1 + item.name.length] || '');
        });
        if (hit) {
          if (buffer) {
            appendText(fragment, buffer);
            buffer = '';
          }
          fragment.append(createPill(hit));
          index += 1 + hit.name.length;
          continue;
        }
      }
      buffer += char;
      index += 1;
    }
    if (buffer) appendText(fragment, buffer);
    return fragment;
  };

  /** 粘贴：纯文本兜底（防止外部 HTML），同时把 @资源名 还原为引用 pill */
  const handlePaste = async (e) => {
    const text = (e.clipboardData?.getData('text/plain') || '').replace(/\r\n?/g, '\n');
    if (!text) return;
    e.preventDefault();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();

    // 资源索引未就绪时等待加载（首次启动），保证历史会话里的引用能完整还原
    const resources = getCachedResources() || (await loadAllResources());
    const fragment = buildPasteFragment(text, resources);
    const last = fragment.lastChild;
    range.insertNode(fragment);

    const after = document.createRange();
    if (last) after.setStartAfter(last);
    else after.setStart(range.startContainer, range.startOffset);
    after.collapse(true);
    selection.removeAllRanges();
    selection.addRange(after);

    onEditorChanged();
    syncMention();
  };

  const handleKeydown = (e) => {
    // 输入法组合期间不处理 Enter/@ 菜单，交给输入法
    if (e.isComposing || composing) return;

    if (mentionOpen.value) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        mentionMenuRef.value?.move(1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        mentionMenuRef.value?.move(-1);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        mentionMenuRef.value?.nextTab();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMention();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        const item = mentionMenuRef.value?.activeItem();
        if (item) {
          e.preventDefault();
          handleMentionPick(item);
          return;
        }
        // 无匹配项时关闭菜单，继续按普通 Enter 发送
        closeMention();
      }
    }

    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // 手动换行
        e.preventDefault();
        document.execCommand('insertLineBreak');
        onEditorChanged();
        return;
      }
      e.preventDefault();
      handleSend();
    }
  };

  // ---- 发送 ----
  const handleSend = () => {
    if (props.loading) {
      emit('cancel');
      return;
    }
    if (!selectedModel.value) {
      window.alert?.('请先在「设置 → 模型管理」中配置供应商与模型');
      return;
    }
    let model = null;
    try {
      model = JSON.parse(selectedModel.value);
    } catch {
      model = null;
    }
    if (!model?.providerId || !model?.modelId) return;

    // 引用直接来自输入框内的 pill，删除 pill 即取消引用
    const { text, refs } = serializeEditor(editorRef.value);
    const content = text.trim();
    if (!content && attachments.value.length === 0 && refs.length === 0) return;

    emit('send', {
      id: uuidv4(),
      model,
      role: 'user',
      content,
      attachments: [...refs, ...attachments.value.map((a) => ({ ...a }))],
    });

    const editor = editorRef.value;
    if (editor) editor.innerHTML = '';
    inputText.value = '';
    isEmpty.value = true;
    attachments.value = [];
    autoResize();
    closeMention();
  };
</script>

<style scoped lang="less">
  .sender {
    position: relative;
  }

  // @ 资源引用菜单：输入框正上方弹出
  .mention-menu {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: calc(100% + 8px);
    z-index: 200;
  }

  .input-card {
    background: rgba(255, 255, 255, 0.82);
    border: 0.5px solid rgba(0, 0, 0, 0.1);
    border-radius: var(--mac-radius-md);
    box-shadow:
      inset 0 1px 1.5px rgba(0, 0, 0, 0.04),
      0 1px 2px rgba(0, 0, 0, 0.03);
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
    &:focus-within {
      border-color: var(--mac-accent);
      box-shadow: none;
    }
  }

  .attachments-area {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px 12px 0;
  }

  .attachment-item {
    gap: 6px;
    padding: 4px 8px;
    max-width: 200px;
    .attachment-item__name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .attachment-item__del {
      display: flex;
      align-items: center;
      color: var(--mac-text-3);
      padding: 0 4px;
      opacity: 0.6;
      transition: opacity 0.15s ease;
      &:hover {
        opacity: 1;
        color: var(--mac-red);
      }
    }
  }

  .editor-wrap {
    position: relative;
  }

  .msg-editor {
    width: 100%;
    min-height: 60px;
    max-height: 160px;
    padding: 12px 16px 6px;
    font-size: 13px;
    color: var(--mac-text);
    line-height: 1.6;
    outline: none;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .editor-placeholder {
    position: absolute;
    top: 12px;
    left: 16px;
    right: 16px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--mac-text-4);
    pointer-events: none;
    white-space: pre-wrap;
  }

  // 内联引用 pill：按资源类型着色 + 类型标签（工作流/数据表/浏览器/元素集）
  // DOM 动态插入，需用 :deep 才能命中 scoped 样式
  .msg-editor :deep(.ref-pill) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 20px;
    margin: 1px 2px;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: var(--mac-radius-xs);
    font-size: 12px;
    line-height: 1;
    vertical-align: middle;
    user-select: none;
    cursor: default;
    white-space: nowrap;
  }

  .msg-editor :deep(.ref-pill__tag) {
    font-size: 10px;
    font-weight: 600;
    opacity: 0.72;
  }

  .msg-editor :deep(.ref-pill__name) {
    font-weight: 500;
  }

  .msg-editor :deep(.ref-pill--workflow) {
    color: #1d4ed8;
    background: #eff6ff;
    border-color: #bfdbfe;
  }

  .msg-editor :deep(.ref-pill--table) {
    color: #15803d;
    background: #f0fdf4;
    border-color: #bbf7d0;
  }

  .msg-editor :deep(.ref-pill--browser) {
    color: #7c3aed;
    background: #f5f3ff;
    border-color: #ddd6fe;
  }

  .msg-editor :deep(.ref-pill--element) {
    color: #c2410c;
    background: #fff7ed;
    border-color: #ffedd5;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .model-select {
    width: 160px;
    margin-right: 2px;
  }

  .hidden-input {
    display: none;
  }

  // 上拉菜单容器（文件按钮）
  .dropup {
    position: relative;
  }

  .send-btn {
    width: 28px;
    height: 28px;
    border-radius: var(--mac-radius-sm);
    transition: background 0.15s ease;
    flex-shrink: 0;
    &:hover {
      background: var(--mac-accent-hover);
      color: #fff;
    }
    &:disabled {
      background: var(--mac-fill);
      color: var(--mac-text-4);
    }
  }
</style>
