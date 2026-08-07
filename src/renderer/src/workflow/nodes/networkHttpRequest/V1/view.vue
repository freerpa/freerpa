<template>
  <div class="http-node-view">
    <a-button type="secondary" size="mini" long @click="visible = true">cURL导入</a-button>
    <a-modal
      v-model:visible="visible"
      title="cURL导入"
      :width="800"
      unmount-on-close
      @before-ok="handleCodeEditorOk"
    >
      <codemirror
        v-model="code"
        :style="{ height: '400px' }"
        :autofocus="false"
        :indent-with-tab="true"
        :tab-size="2"
        @keydown="unDoReDoInterceptor"
        @keyup="unDoReDoInterceptor"
        :extensions="extensions"
      />
      <a-alert type="warning" v-if="showErr" style="margin-top: 8px; height: 32px"
        >代码格式不对</a-alert
      >
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { json } from '@codemirror/lang-json'
import { EditorView } from '@codemirror/view'
import { unDoReDoInterceptor } from '@/workflow/utils'
import { parseCurl } from '@/workflow/utils/parseCurl'

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})
const visible = ref(false)
const code = ref(``)
// 编辑器扩展配置
const extensions = computed(() => {
  const exts = [EditorView.lineWrapping, json()]
  return exts
})
const showErr = ref(false)
//解析cURL命令
const handleCodeEditorOk = (done) => {
  try {
    const request = parseCurl(code.value)
    props.node.config.url = request.url
    props.node.config.method = request.method
    props.node.config.headers = Object.keys(request.headers).map((key) => ({
      key,
      value: request.headers[key]
    }))
    if (request.body) {
      const contentType = request.headers['content-type'] || ''
      if (contentType.includes('json')) {
        props.node.config.bodyType = 'json'
        props.node.config.bodyText = request.body
      } else if (contentType.includes('html')) {
        props.node.config.bodyType = 'html'
        props.node.config.bodyText = request.body
      } else if (contentType.includes('xml')) {
        props.node.config.bodyType = 'xml'
        props.node.config.bodyText = request.body
      } else if (contentType.includes('javascript')) {
        props.node.config.bodyType = 'javascript'
        props.node.config.bodyText = request.body
      } else if (contentType.includes('urlencoded') || contentType.includes('form-data')) {
        props.node.config.bodyType = 'urlencoded'
        props.node.config.bodyFormData = request.body.split('&').map((item) => ({
          key: item.split('=')[0],
          value: item.split('=')[1]
        }))
      } else {
        props.node.config.bodyType = 'plain'
        props.node.config.bodyText = request.body
      }
    }
    done()
  } catch (error) {
    showErr.value = true
  }
}

// 处理节点事件
const onNodeEvent = async (url) => {
  serverUrl.value = url
}
defineExpose({
  onNodeEvent
})
</script>

<style lang="less" scoped>
.http-server-node-view {
  font-size: 12px;
}
:deep(.cm-editor) {
  width: 100%;
  height: 400px;
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
</style>
