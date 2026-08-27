<template>
  <div class="text-field-container">
    <ParamRefer
      trigger="none"
      trigger-style="width: 100%"
      ref="ParamReferRef"
      :field="field"
      all-types
      @visible-change="handleVisibleChange"
      @onSelect="handleSelect"
    >
      <div class="textarea-container" :class="{ hasSuffix, hasPrefix }">
        <div class="prefix-container">
          <slot name="prefix"></slot>
        </div>
        <a-textarea
          ref="inputRef"
          v-model="value"
          :placeholder="placeholder || field?.placeholder || field?.description || field?.name"
          :auto-size="autoSize"
          spellcheck="false"
          @keydown="handleKeydown"
          @keyup="interceptor"
          @mouseup="handleMouseUp"
        />
        <div class="suffix-container">
          <slot name="suffix"></slot>
        </div>
      </div>
    </ParamRefer>
  </div>
</template>

<script setup>
import { watch, inject, ref, computed, useSlots } from 'vue'
import ParamRefer from './components/ParamRefer.vue'
import { unDoReDoInterceptor, paramReferRegex } from '@/workflow/utils'
import { useFieldWatch } from './composables/useFieldValue'

const props = defineProps({
  field: {
    type: Object,
    required: true
  },
  autoSize: {
    type: Object,
    default: () => ({ minRows: 1, maxRows: 5 })
  },
  placeholder: {
    type: String,
    default: ''
  },
  intercept: {
    type: Boolean,
    default: true
  }
})

const interceptor = (e) => {
  if (props.intercept) {
    unDoReDoInterceptor(e)
  }
}

const slots = useSlots()
const hasSuffix = computed(() => slots.suffix?.() || null)
const hasPrefix = computed(() => slots.prefix?.() || null)
const value = defineModel({
  default: ''
})
useFieldWatch(props, value)
const ParamReferRef = ref(null)
const inputRef = ref(null)
// 获取真实的textarea元素
const getTextarea = () => {
  return inputRef.value?.$el.querySelector('textarea')
}

// 监听键盘输入
const handleKeydown = async (e) => {
  interceptor(e)
  if (e.key === 'Alt' && (!props.field.hasOwnProperty('paramRef') || props.field.paramRef)) {
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

    const input = getTextarea()
    if (!input) return

    const start = input.selectionStart
    const end = input.selectionEnd
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
          input.setSelectionRange(paramStart, paramEnd)
          document.execCommand('delete', false)
          return
        }
      } else if (e.key === 'Delete') {
        // 如果光标在参数前面，删除整个参数
        if (start === paramStart) {
          e.preventDefault()
          input.setSelectionRange(paramStart, paramEnd)
          document.execCommand('delete', false)
          return
        }
      }

      // 如果光标在参数内部，删除整个参数
      if (start > paramStart && start <= paramEnd) {
        e.preventDefault()
        input.setSelectionRange(paramStart, paramEnd)
        document.execCommand('delete', false)
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
    const input = getTextarea()
    if (!input) return

    const start = input.selectionStart
    const text = value.value
    let match

    while ((match = paramReferRegex.exec(text)) !== null) {
      const paramStart = match.index
      const paramEnd = paramStart + match[0].length

      // 如果光标在参数内部
      if (start > paramStart && start < paramEnd) {
        e.preventDefault()
        setTimeout(() => {
          input.focus()
          // 根据方向键移动到参数前面或后面
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            input.setSelectionRange(paramStart, paramStart)
          } else {
            input.setSelectionRange(paramEnd, paramEnd)
          }
        }, 0)
        return
      }
    }
  }
}
const selectionRange = ref(null)
const handleVisibleChange = (visible) => {
  if (!visible) {
    if (selectionRange.value !== null) {
      const input = getTextarea()
      if (!input) return
      input.focus()
      input.setSelectionRange(selectionRange.value.start, selectionRange.value.start)
      handleKeydown({ key: 'ArrowRight', preventDefault: () => {} })
      selectionRange.value = null
    }
  }
}
// 处理鼠标抬起事件
const handleMouseUp = () => {
  const input = getTextarea()
  if (!input) return
  const start = input.selectionStart
  const text = value.value
  let match

  while ((match = paramReferRegex.exec(text)) !== null) {
    const paramStart = match.index
    const paramEnd = paramStart + match[0].length
    // 如果点击在参数内部，移动光标到参数后面
    if (start > paramStart && start < paramEnd) {
      setTimeout(() => {
        input.focus()
        input.setSelectionRange(paramStart, paramEnd)
        if (!props.field.hasOwnProperty('paramRef') || props.field.paramRef) {
          ParamReferRef.value.show(true)
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

// 选择参数时插入
function handleSelect(paramText) {
  const input = getTextarea()
  if (!input) return

  if (value.value === undefined || value.value === null) {
    value.value = ''
  }

  // 使用 execCommand 插入文本以支持撤销/重做
  input.focus()
  document.execCommand('insertText', false, paramText)
  ParamReferRef.value.show(false)
}
</script>

<style scoped lang="less">
.text-field-container {
  position: relative;
  width: 100%;
  background-color: var(--color-fill-2);
  border-radius: var(--border-radius-small);
  overflow: hidden;
  .textarea-container {
    display: flex;
  }
  // :deep(.arco-textarea-wrapper) {
  //   border-top-left-radius: 0px;
  //   border-bottom-left-radius: 0px;
  // }
  & .hasSuffix {
    :deep(.arco-textarea-wrapper) {
      border-top-right-radius: 0px;
      border-bottom-right-radius: 0px;
    }
  }
  & .hasPrefix {
    :deep(.arco-textarea-wrapper) {
      border-top-left-radius: 0px;
      border-bottom-left-radius: 0px;
    }
  }
  
  :deep(.arco-textarea) {
    resize: none;
    font-size: 12px;
    padding: 1px 12px;
    min-height: 20px;

    &::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background-color: var(--color-text-4);
      border-radius: 4px;
    }
  }
}
</style>
