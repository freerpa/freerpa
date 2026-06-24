<template>
  <div class="debug-info-title">
    <a-space>
      <b>调试信息</b>
      <a-checkbox-group size="mini" v-model="stateSelected" @change="handleStateChange">
        <a-checkbox :value="index" v-for="(item, index) in stateText" :key="index">{{
          item
        }}</a-checkbox>
      </a-checkbox-group>
    </a-space>
    <a-button size="small" type="text" @click="clearDebugInfos">
      <template #icon>
        <icon-delete />
      </template>
      清空
    </a-button>
  </div>
  <a-list
    class="debug-info-list"
    :virtualListProps="{
      height: 400
    }"
    :data="list"
    size="mini"
  >
    <template #item="{ item: record, index }">
      <a-list-item :key="index">
        <div class="debug-info-item">
          <div class="debug-info-item-title">
            <span :class="`state-tag ${record.state}`">{{ stateText[record.state] }}</span>
            <small>{{ record.timestamp }}</small>
          </div>
          <div class="debug-info-item-content">
            <div class="data-space">
              <div class="data-space-item" v-if="record.inputs">
                <span>输入：</span>
                <JsonViewer
                  :value="JSON.parse(record.inputs)"
                  :expanded="true"
                  :expand-depth="0"
                  :sort="false"
                />
              </div>
              <div class="data-space-item" v-if="record.config">
                <span>配置：</span>
                <JsonViewer
                  :value="JSON.parse(record.config)"
                  :expanded="true"
                  :expand-depth="0"
                  :sort="false"
                />
              </div>
              <div class="data-space-item" v-if="record.outputs">
                <span>输出：</span>
                <JsonViewer
                  :value="JSON.parse(record.outputs)"
                  :expanded="true"
                  :expand-depth="0"
                  :sort="false"
                />
              </div>
              <div class="data-space-item" v-if="record.store">
                <span>存储：</span>
                <JsonViewer
                  :value="JSON.parse(record.store)"
                  :expanded="true"
                  :expand-depth="0"
                  :sort="false"
                />
              </div>
              <div class="data-space-item" v-if="record.error">
                <span>{{ record.state === 'error' ? '错误：' : '重试：' }}</span>
                <span class="error-text">{{ record.error }}</span>
              </div>
            </div>
          </div>
        </div>
      </a-list-item>
    </template>
  </a-list>
</template>
<script setup>
import { ref, computed } from 'vue'
import JsonViewer from 'vue-json-viewer'
import { IconDelete } from '@arco-design/web-vue/es/icon'
const emit = defineEmits(['clear'])
const clearDebugInfos = () => {
  emit('clear')
}
const props = defineProps({
  id: {
    type: String,
    default: ''
  },
  data: {
    type: Map,
    default: () => new Map()
  }
})

const list = computed(() => {
  return [...props.data.values()].filter((item) => stateSelected.value.includes(item.state))
})

const stateText = ref({
  initialized: '初始化',
  running: '执行中',
  next: '下一步',
  success: '节点完成',
  retrying: '重试中',
  error: '执行错误'
})

const stateSelected = ref(Object.keys(stateText.value))
</script>
<style scoped lang="less">
.debug-info-title {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  font-size: 16px;
}
.debug-info-list {
  width: 45vw;
  user-select: text;
}
.debug-info-item {
  &-title {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-border);
    padding: 8px;
  }
  &-content {
    padding: 8px;
    font-size: 12px;
  }
  .data-space {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: start;
    .data-space-item {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: start;
    }
  }
  .state-tag {
    padding: 1px 2px;
    font-size: 10px;
    border: 1px solid;
    border-radius: var(--border-radius-small);
    &.initialized {
      color: rgb(var(--color-neutral-4));
    }
    &.running,
    &.next,
    &.retrying {
      color: rgb(var(--warning-6));
    }
    &.success {
      color: rgb(var(--success-6));
    }
    &.error {
      color: rgb(var(--danger-6));
    }
  }
}
.error-text {
  color: rgb(var(--danger-6));
}
:deep(.jv-container) {
  background: transparent !important;
  font-size: 12px !important;
}
:deep(.jv-code),
:deep(.open) {
  padding: 0 !important;
}
</style>
