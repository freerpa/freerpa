<template>
  <div class="browser-node-view">
    <template v-if="node.config.browser === 'bit'">
      <div class="browser-alert">
        请确认打开比特浏览器并正确配置服务端口<br />
        配置路径：比特首页 - 系统设置 - Local API<br />
        注意不要开启 Local API Token<br />
        使用无头模式时，需要清空已同步或者设置的url<br />
      </div>
      <a class="link" href="https://www.bitbrowser.cn/?code=ei8xt5" target="_blank">
        下载比特指纹浏览器
      </a>
    </template>
    <!-- 控制按钮 -->
    <template v-if="node.config.browser === 'automan'">
      <a-button
        :disabled="!status || !isExecuting || node.config.offscreen"
        type="secondary"
        size="mini"
        long
        @click="handleAction('show')"
      >
        <template #icon><icon-desktop /></template>
        {{ '显示/隐藏浏览器' }}
      </a-button>
    </template>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import { IconDesktop, IconLink } from '@arco-design/web-vue/es/icon'

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

// 状态相关
const status = ref(false)
// 注入的方法
const sendNodeEvent = inject('sendNodeEvent')
const isExecuting = inject('isExecuting')

const handleAction = (action) => {
  sendNodeEvent({
    type: action
  })
}

// 处理节点事件
const onNodeEvent = ({ type, data }) => {
  switch (type) {
    case 'status':
      status.value = data
      break
  }
}

defineExpose({
  onNodeEvent
})
</script>

<style lang="less" scoped>
.browser-node-view {
  .browser-alert {
    width: 100%;
    padding: 8px;
    background: var(--color-fill-2);
    font-size: 12px;
    border-radius: 4px;
    text-align: left;
    line-height: 18px;
  }
  .link {
    color: rgb(var(--arcoblue-6));
    cursor: pointer;
    font-size: 12px;
    width: 100%;
    margin-top: 4px;
    text-align: center;
    display: block;
    text-decoration: none;
    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
