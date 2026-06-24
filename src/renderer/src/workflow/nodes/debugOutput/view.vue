<template>
  <div class="debug-output-view">
    <a-tabs
      v-if="records.length"
      size="mini"
      v-model:active-key="activeKey"
      destroy-on-hide
      lazy-load
      scroll-position="center"
      justify
    >
      <template #extra>
        <a-space :size="40">
          <small class="clearbtn" @click="clearRecords">
            <icon-delete />
          </small>
        </a-space>
      </template>

      <a-tab-pane v-for="(record, index) in records" :key="index" :title="'输出' + (index + 1)">
        <codemirror
          :model-value="record"
          class="code-editor"
          :autofocus="false"
          :indent-with-tab="false"
          :tab-size="2"
          :extensions="extensions"
          @keydown="unDoReDoInterceptor"
          @keyup="unDoReDoInterceptor"
        />
      </a-tab-pane>
    </a-tabs>
    <a-empty v-else description="暂无输出记录" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { IconDelete } from '@arco-design/web-vue/es/icon'
import { Codemirror } from 'vue-codemirror'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { unDoReDoInterceptor } from '@/workflow/utils'

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

// 编辑器扩展配置
const extensions = computed(() => {
  const exts = [EditorView.lineWrapping, EditorState.readOnly.of(true)]
  return exts
})

// 记录列表
const records = ref([])
const activeKey = ref(0)

// 清空记录
const clearRecords = () => {
  records.value = []
}

// 处理节点事件
const onNodeEvent = async (params) => {
  if (params.type === 'output') {
    // 添加记录
    records.value.push(params.data.data)
    activeKey.value = records.value.length - 1
  }
}

defineExpose({
  onNodeEvent
})
</script>

<style lang="less" scoped>
.debug-output-view {
  height: 100%;
  :deep(.code-editor .cm-editor) {
    min-height: 60px;
    height: 100%;
    max-height: 300px;
    width: 100%;
    cursor: text;
    border-radius: var(--border-radius-small);
    background-color: var(--color-fill-2);
    &.cm-focused {
      outline: none;
    }
    .cm-gutters.cm-gutters-before {
      display: none;
    }
    .cm-activeLine {
      background-color: transparent;
    }
    .cm-content {
      padding: 4px 0;
      // background-color: var(--color-fill-1);
    }
  }
  .clearbtn {
    display: flex;
    cursor: pointer;
    font-size: 12px;
    &:hover {
      color: var(--color-text-2);
    }
  }
  :deep(.arco-tabs-content) {
    padding-top: 5px !important;
  }
  :deep(.arco-tabs-nav-type-line .arco-tabs-tab) {
    margin: 0 10px;
  }
}
</style>
