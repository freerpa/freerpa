<template>
  <teleport to="body">
    <div
      :style="{
        position: 'fixed',
        width: '1px',
        height: '100px',
        top: paramRefRect.top + 8 + 'px',
        left: paramRefRect.left + 'px'
      }"
    >
      <ParamRefer
        trigger="none"
        trigger-style="width: 100%"
        ref="ParamReferRef"
        :field="field"
        all-types
        @visible-change="handleVisibleChange"
        @onSelect="handleSelect"
      >
      </ParamRefer>
    </div>
  </teleport>
  <a-modal
    :title="field.name"
    :mask-closable="false"
    :esc-to-close="false"
    unmount-on-close
    ok-text="保存编辑"
    cancel-text="取消编辑"
    :footer="false"
    :closable="false"
    v-model:visible="editorVisible"
    width="80vw"
    height="80vh"
    :body-style="{ padding: '0px', height: 'calc(90vh - 48px)' }"
    class="code-editor-container"
  >
    <template #title>
      代码编辑器
      <a-button-group class="code-editor-title-button">
        <a-button type="secondary" @click="handleCancel">取消编辑</a-button>
        <a-button type="primary" @click="handleOk">保存编辑</a-button>
      </a-button-group>
    </template>
    <codemirror
      v-if="field.prefix"
      disabled
      :modelValue="field.prefix"
      :extensions="[
        EditorState.readOnly.of(true),
        languageExtension(),
        lineNumbers({
          formatNumber: () => {
            return ''
          }
        })
      ]"
      :style="{ padding: '0px' }"
    />
    <codemirror
      ref="inputRef"
      :modelValue="value"
      :style="{
        height: 'calc(100% - ' + ((field.prefix ? 30 : 0) + (field.suffix ? 30 : 0)) + 'px)'
      }"
      :autofocus="false"
      :indent-with-tab="true"
      :tab-size="2"
      :extensions="extensions"
      @ready="handleEditorReady"
      @keydown="handleKeydown"
      @mouseup="handleMouseUp"
    />
    <codemirror
      v-if="field.suffix"
      disabled
      :modelValue="field.suffix"
      :extensions="[
        EditorState.readOnly.of(true),
        languageExtension(),
        lineNumbers({
          formatNumber: () => {
            return ''
          }
        })
      ]"
      :style="{ padding: '0px' }"
    />
  </a-modal>
  <a-button type="secondary" @click="editorVisible = true" style="line-height: 1">
    <template #icon>
      <icon-code-square />
    </template>
    打开代码编辑器</a-button
  >
  <!-- <a-alert
    v-else
    type="normal"
    style="height: 24px; padding: 0px 12px; font-size: 12px"
    :show-icon="false"
  >
    请点右上角配置按钮编辑代码
  </a-alert> -->
</template>

<script setup>
import { watch, inject, ref } from 'vue'
import { IconCodeSquare } from '@arco-design/web-vue/es/icon'
import { Codemirror } from 'vue-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorState, EditorSelection } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import ParamRefer from './components/ParamRefer.vue'
import { unDoReDoInterceptor, paramReferRegex } from '@/workflow/utils'
import { useFieldWatch } from './composables/useFieldValue'

const editorVisible = ref(false)
// 注入是否获取焦点
const isFocus = inject('isFocus')
watch(editorVisible, (newVal) => {
  isFocus.value = !newVal
})
// 禁用编辑器原生撤销和重做
// historyKeymap[0].run = (view) => {}
// historyKeymap[1].run = (view) => {}
const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const value = defineModel()
useFieldWatch(props, value)

const handleOk = () => {
  value.value = editorView.state.doc.toString()
  editorVisible.value = false
}
const handleCancel = () => {
  editorVisible.value = false
}
// 根据语言类型选择对应的语言扩展
const languageExtension = () => {
  const lang = props.field.language?.toLowerCase() || 'javascript'
  switch (lang) {
    case 'javascript':
    case 'js':
      return javascript()
    case 'json':
      return json()
    default:
      return javascript()
  }
}

// 编辑器扩展配置
const extensions = ref([languageExtension(), EditorView.lineWrapping])
if (props.field.theme === 'dark') {
  extensions.value.push(oneDark)
}

let editorView = null
// 编辑器初始化完成
const handleEditorReady = (editor) => {
  editorView = editor.view
}

// 在光标位置插入代码 - v6版本的实现方式
const insertAtCursor = (code) => {
  if (!editorView) return

  // 获取当前选择范围（光标位置）
  const selection = editorView.state.selection.main

  // 插入代码
  editorView.dispatch({
    changes: {
      from: selection.from,
      to: selection.to,
      insert: code
    },
    // 设置光标到插入内容的末尾
    selection: { anchor: selection.from + code.length }
  })

  // 确保编辑器获得焦点
  editorView.focus()
}

const ParamReferRef = ref(null)

// 单独获取光标位置的方法
const getCurrentCursorPosition = () => {
  if (!editorView) return null

  // 获取主选区（光标位置）
  const selection = editorView.state.selection.main

  // 转换为行号和列号（需要通过编辑器状态计算）
  const line = editorView.state.doc.lineAt(selection.from)
  const lineNumber = line.number - 1 // 转换为从0开始的行号
  const ch = selection.from - line.from // 列号（从0开始）

  return {
    line: lineNumber,
    ch: ch,
    // 原始位置信息（文档中的绝对偏移量）
    from: selection.from,
    to: selection.to
  }
}

// 设置选区的方法
const setTextSelection = (from, to) => {
  // 验证编辑器实例
  if (!editorView) {
    return false
  }

  // 验证参数有效性
  if (typeof from !== 'number' || typeof to !== 'number') {
    return false
  }

  // 确保from <= to
  if (from > to) {
    ;[from, to] = [to, from] // 交换位置
  }

  // 验证范围在文档内
  const docLength = editorView.state.doc.length
  if (from < 0 || to > docLength) {
    return false
  }

  try {
    // 执行选区设置
    editorView.dispatch({
      selection: EditorSelection.range(from, to),
      effects: EditorView.focus // 确保聚焦以显示选区
    })

    return true
  } catch (error) {
    return false
  }
}

// 主动删除选区内的代码
function deleteSelectedCode() {
  const cursorPosition = getCurrentCursorPosition()

  if (!cursorPosition) {
    return
  }

  // 执行删除操作
  editorView.dispatch({
    changes: {
      from: cursorPosition.from,
      to: cursorPosition.to,
      insert: '' // 插入空字符串即删除
    },
    // 删除后将光标定位到原选区开始位置
    selection: EditorSelection.cursor(cursorPosition.from)
  })
}
const selectionRange = ref(null)
const handleVisibleChange = (visible) => {
  if (!visible) {
    if (selectionRange.value !== null) {
      setTextSelection(selectionRange.value.start, selectionRange.value.start)
      handleKeydown({ key: 'ArrowRight', preventDefault: () => {} })
      selectionRange.value = null
    }
  }
}
// 处理鼠标抬起事件
const handleMouseUp = () => {
  const cursorPosition = getCurrentCursorPosition()
  const start = cursorPosition.from
  const text = value.value
  let match
  while ((match = paramReferRegex.exec(text)) !== null) {
    const paramStart = match.index
    const paramEnd = paramStart + match[0].length
    // 如果点击在参数内部，移动光标到参数后面
    if (start > paramStart && start < paramEnd) {
      setTimeout(() => {
        setTextSelection(paramStart, paramEnd)
        if (!props.field.hasOwnProperty('paramRef') || props.field.paramRef) {
          ParamReferRef.value.show(true)
          paramRefRect.value = editorView.coordsAtPos((paramStart + paramEnd) / 2)
          selectionRange.value = {
            start: paramStart,
            end: paramEnd
          }
        }
      }, 0)
      return
    }
  }
}
const paramRefRect = ref({})
// 监听键盘输入
const handleKeydown = async (e) => {
  unDoReDoInterceptor(e)
  if (e.key === 'Alt' && (!props.field.hasOwnProperty('paramRef') || props.field.paramRef)) {
    //获取光标位置
    const cursorPos = getCurrentCursorPosition()
    paramRefRect.value = editorView.coordsAtPos(cursorPos.to)
    if (!ParamReferRef.value.visible) {
      e.preventDefault()
      ParamReferRef.value.show(true)
    } else {
      ParamReferRef.value.show(false)
    }
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    // 按下删除按键时关闭参数选择器
    setTimeout(() => {
      ParamReferRef.value.show(false)
    }, 10)
    const cursorPosition = getCurrentCursorPosition()
    const start = cursorPosition.from
    const end = cursorPosition.to

    // 如果有选中内容，使用默认行为
    if (start !== end) return
    const text = value.value
    let match
    // 查找所有参数位置
    while ((match = paramReferRegex.exec(text)) !== null) {
      const paramStart = match.index
      const paramEnd = paramStart + match[0].length
      if (e.key === 'Backspace') {
        // 如果光标在参数后面，删除整个参数
        if (start + 1 === paramEnd) {
          e.preventDefault()
          setTextSelection(paramStart, paramEnd)
          deleteSelectedCode()
          return
        }
      } else if (e.key === 'Delete') {
        // 如果光标在参数前面，删除整个参数
        if (start === paramStart) {
          e.preventDefault()
          setTextSelection(paramStart, paramEnd)
          deleteSelectedCode()
          return
        }
      }

      // 如果光标在参数内部，删除整个参数
      if (start > paramStart && start < paramEnd) {
        e.preventDefault()
        setTextSelection(paramStart, paramEnd)
        deleteSelectedCode()
        return
      }
    }
  } else if (
    e.key === 'ArrowLeft' ||
    e.key === 'ArrowRight' ||
    e.key === 'ArrowUp' ||
    e.key === 'ArrowDown'
  ) {
    await new Promise((resolve) => setTimeout(resolve, 1))
    // 处理左右方向键
    const cursorPosition = getCurrentCursorPosition()
    const start = cursorPosition.from
    const text = value.value
    let match

    while ((match = paramReferRegex.exec(text)) !== null) {
      const paramStart = match.index
      const paramEnd = paramStart + match[0].length

      // 如果光标在参数内部
      if (start > paramStart && start < paramEnd) {
        e.preventDefault()
        setTimeout(() => {
          editorView.focus()
          // 根据方向键移动到参数前面或后面
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            setTextSelection(paramStart, paramStart)
          } else {
            setTextSelection(paramEnd, paramEnd)
          }
        }, 0)
        return
      }
    }
  }
}
// 选择参数时插入
function handleSelect(paramText) {
  insertAtCursor(paramText)
  ParamReferRef.value.show(false)
}
</script>

<style lang="less" scoped>
.code-editor-container {
  .code-editor-title-button {
    position: absolute;
    right: 8px;
  }

  // border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  overflow: auto;
  width: 100% - 0px;
  :deep(.cm-editor) {
    height: 100%;
    .cm-gutters {
      min-height: 1px !important;
    }

    .cm-content {
      padding: 1px 0px !important;
    }

    .cm-scroller {
      font-family: 'Fira Code', monospace;
      line-height: 1.5;
    }

    &.cm-focused {
      outline: none;
    }
  }
}
</style>
