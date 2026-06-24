<template>
  <div
    class="bubble"
    :class="{ 'bubble--user': role === 'user', 'bubble--assistant': role === 'assistant' }"
  >
    <div class="bubble-content--reasoning" v-if="reasoning_content">
      <div class="toggle" @click="isCollapsed = !isCollapsed">
        <icon-loading v-if="!content && loading" />
        <RiBrainLine v-else size="12" />
        <span>深度思考</span>
        <icon-down
          :style="{
            transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.3s'
          }"
        />
      </div>
      <div class="content" v-if="isCollapsed">
        <MdPreview style="background-color: transparent" :modelValue="reasoning_content" />
      </div>
    </div>
    <div class="bubble-content" v-if="content">
      <MdPreview style="background-color: transparent" :modelValue="content" />
    </div>
    <div class="bubble-tool" v-if="tool_calling || (tool_calls && tool_calls.length > 0)">
      <a-tag
        :color="tool_calling === 'loading' ? 'gray' : 'green'"
        bordered
        v-if="(tool_calls && tool_calls.length > 0) || tool_calling === 'loading'"
      >
        <template #icon>
          <icon-loading v-if="tool_calling === 'loading'" />
          <icon-check-circle-fill v-else />
        </template>
        {{ tool_calling === 'loading' ? '正在搭建中...' : '搭建完成' }}
      </a-tag>
    </div>
    <div v-if="loading" class="loading-content"><icon-loading /> 加载中...</div>
    <div class="toolbar" v-if="role === 'user'">
      <div class="toolbar-content">
        <span v-show="tipShow">{{ tip }}</span>
        <a-button type="text" size="mini" @click="copyContent(content)">
          <template #icon>
            <icon-copy />
          </template>
        </a-button>
        <a-popconfirm content="确认删除吗？" @ok="deleteBubble">
          <a-button type="text" size="mini">
            <template #icon>
              <icon-delete />
            </template>
          </a-button>
        </a-popconfirm>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, ref } from 'vue'
import {
  IconDown,
  IconUp,
  IconCopy,
  IconDelete,
  IconLoading,
  IconCheckCircleFill
} from '@arco-design/web-vue/es/icon'
import { RiBrainLine } from '@remixicon/vue'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'
const props = defineProps({
  reasoning_content: {
    type: String,
    default: ''
  },
  content: {
    type: String,
    required: true
  },
  tool_calls: {
    type: [Array, String],
    default: () => []
  },
  tool_calling: {
    type: String,
    default: ''
  },
  loading: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    default: 'user',
    validator: (value) => ['user', 'assistant'].includes(value)
  }
})

const isCollapsed = ref(props.content ? false : true)
const tip = ref('')
const tipShow = ref(false)
const showSuccessMessage = (msg, duration = 1000) => {
  tip.value = msg
  tipShow.value = true
  setTimeout(() => {
    tipShow.value = false
  }, duration)
}
const emit = defineEmits(['copy', 'delete'])

const copyContent = (text) => {
  navigator.clipboard.writeText(text)
  showSuccessMessage('复制成功')
  emit('copy', text)
}

const deleteBubble = () => {
  emit('delete')
}
</script>

<style scoped lang="less">
.bubble {
  display: flex;
  width: 100%;
  max-width: 100%;
  word-wrap: break-word;
  flex-direction: column;
  margin-bottom: 12px;
  :deep(.md-editor-preview) {
    font-size: inherit;
    p {
      line-height: inherit;
      margin: 0;
    }
  }
  .toolbar {
    margin-top: 4px;
    height: 24px;
  }
  .toolbar-content {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    span {
      font-size: 12px;
      color: var(--color-text-3);
    }
  }
  // &:hover {
  //   .toolbar-content {
  //     display: flex;
  //   }
  // }
}

.bubble-content--reasoning {
  display: flex;
  flex-direction: column;
  color: var(--color-text-3);
  max-width: 100%;
  .toggle {
    cursor: pointer;
    padding: 4px 0px;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: transform 0.3s;
    user-select: none;
  }
  .content {
    font-size: 12px;
    color: var(--color-text-3);
    line-height: 1.4;
    border-left: 2px solid var(--color-border);
    padding: 0px 12px;
    margin: 0 0 12px 0px;
    user-select: text;
  }
}

.bubble-content {
  width: fit-content;
  max-width: 100%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.4;
  user-select: text;
}

.bubble-tool {
  margin-top: 6px;
}

.bubble--user {
  color: #fff;
  align-items: flex-end;
  .bubble-content {
    background-color: rgb(var(--primary-6));
    border-bottom-right-radius: 4px;
    :deep(.md-editor-preview) {
      color: #fff;
    }
  }
}

.bubble--assistant {
  color: #333;
  align-items: flex-start;
  .toolbar-content {
    flex-direction: row-reverse;
  }
  .bubble-content {
    background-color: #f0f0f0;
    border-bottom-left-radius: 4px;
    .md-editor-preview {
      color: #333;
    }
  }
}
</style>
