<template>
  <div class="flow-toolbar">
    <a-space>
      <a-button-group>
        <a-button type="secondary" size="small" @click="flowStore.vueFlowRef.zoomIn()">
          <template #icon><icon-plus /></template>
        </a-button>
        <a-button type="secondary" size="small" @click="flowStore.vueFlowRef.zoomOut()">
          <template #icon><icon-minus /></template>
        </a-button>
        <a-tooltip content="适应视图(D)">
          <a-button
            type="secondary"
            size="small"
            @click="
              flowStore.vueFlowRef.fitView({
                padding: 0.05,
                includeHiddenNodes: false,
                maxZoom: 1
              })
            "
          >
            <template #icon><icon-fullscreen /></template>
          </a-button>
        </a-tooltip>
      </a-button-group>
      <a-tooltip content="自动布局(K)">
        <a-button
          type="text"
          size="small"
          @click="autoLayout(flowStore.vueFlowRef)"
          :disabled="isExecuting"
        >
          <template #icon><RiDashboardLine size="20" /></template>
        </a-button>
      </a-tooltip>
    </a-space>
    <a-divider direction="vertical" />
    <a-space>
      <a-button
        type="primary"
        size="small"
        @click="saveWorkflow"
        :disabled="isSaved"
        :loading="saveIng"
      >
        <template #icon><icon-save /></template>
        保存
      </a-button>
      <a-tooltip>
        <template #content>
          <div>
            <p>调试模式: {{ debug ? '已开启' : '已关闭' }}</p>
            <p v-if="debug">
              节点右上角【小虫子】查看调试信息<br>影响性能和稳定性！非调试请勿开启！
            </p>
          </div>
        </template>
        <a-button type="text" size="small" @click="debug = !debug" :disabled="isExecuting">
          <template #icon>
            <IconSwitch :modelValue="debug" :disabled="isExecuting">
              <icon-bug size="20" />
            </IconSwitch>
          </template>
        </a-button>
      </a-tooltip>
      <a-button-group>
        <a-button
          type="primary"
          size="small"
          :loading="isExecuting"
          @click="flowStore.engine.start()"
          :disabled="isExecuting"
        >
          <template #icon><icon-play-circle /></template>
          {{ isExecuting ? formattedDuration : '执行' }}
        </a-button>
        <a-button
          type="primary"
          status="danger"
          size="small"
          @click="flowStore.engine.stop()"
          :disabled="!isExecuting"
        >
          <template #icon><icon-pause-circle /></template>
          停止
        </a-button>
      </a-button-group>
    </a-space>
    <a-divider direction="vertical" />
    <a-space>
      <a-button-group>
        <a-button
          type="secondary"
          size="small"
          @click="flowStore.undo()"
          :disabled="!flowStore?.canUndo || isExecuting"
        >
          <template #icon><icon-undo /></template>
        </a-button>
        <a-button
          type="secondary"
          size="small"
          @click="flowStore.redo()"
          :disabled="!flowStore?.canRedo || isExecuting"
        >
          <template #icon><icon-redo /></template>
        </a-button>
      </a-button-group>
    </a-space>
    <a-divider direction="vertical" />
    <a-space>

      <a-popover trigger="click" :duration="100" position="top">
        <template #title>
          <div class="noticeTitle">
            <span><icon-notification /> &nbsp;通知中心</span>
            <a-space>
              <a-checkbox v-model="playAudio">通知声音</a-checkbox>
              <a-button type="text" size="small" @click="notices = []">
                <icon-delete />
                清空
              </a-button>
            </a-space>
          </div>
        </template>
        <template #content>
          <a-table
            style="width: 510px"
            :scroll="{ x: 500, y: 200 }"
            :columns="columns"
            :data="notices"
            :pagination="false"
          >
            <template #type="{ record }">
              <span
                :style="{ backgroundColor: noticeTypes[record.type].color }"
                style="
                  color: white;
                  padding: 2px 4px;
                  border-radius: var(--border-radius-small);
                  font-size: 10px;
                "
              >
                {{ noticeTypes[record.type].text || record.type }}
              </span>
            </template>
            <template #content="{ record }">
              <span :style="{ color: noticeTypes[record.type].color }">{{ record.content }}</span>
            </template>
          </a-table>
        </template>
        <a-badge
          :offset="[-3, 0]"
          :dot-style="{ transform: 'scale(.7) translate(10px, -4px)' }"
          :count="noticeNum"
          :max-count="99"
        >
          <a-tooltip content="通知中心">
            <a-button type="text" size="small">
              <template #icon><icon-notification size="20" /></template>
            </a-button>
          </a-tooltip>
        </a-badge>
      </a-popover>

      <a-tooltip content="添加一个注释节点到画布">
        <a-button type="text" size="small" @click="addComment()" :disabled="isExecuting">
          <template #icon><icon-message size="20" /></template>
        </a-button>
      </a-tooltip>
      <a-popover trigger="hover" :duration="100" position="top">
        <a-button type="primary" size="small">
          <template #icon><icon-plus /></template>
          添加节点
        </a-button>
        <template #content>
          <NodeList
            :disabled="isExecuting"
          />
        </template>
      </a-popover>
      <a-tooltip content="AI助手">
        <a-button type="text" size="small" @click="$emit('toggleChat')">
          <template #icon><icon-robot size="20" /></template>
        </a-button>
      </a-tooltip>
    </a-space>
  </div>
</template>

<script setup>
import {
  IconFullscreen,
  IconSave,
  IconPlayCircle,
  IconPauseCircle,
  IconUndo,
  IconRedo,
  IconPlus,
  IconMinus,
  IconMessage,
  IconNotification,
  IconDelete,
  IconBug,
  IconRobot
} from '@arco-design/web-vue/es/icon'
import { RiDashboardLine } from '@remixicon/vue'
import NodeList from './NodeList.vue'
import IconSwitch from './custom/components/IconSwitch.vue'
import { useFlowStore } from '../store'
import { inject, computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { autoLayout } from '../utils'
import { v4 as uuidv4 } from 'uuid'
const workflowId = inject('workflowId')
const flowStore = useFlowStore(workflowId)
const { isExecuting, isSaved, saveIng, debug, noticeNum, notices, playAudio } =
  storeToRefs(flowStore)
import { debounce } from 'lodash-es'
const saveWorkflow = debounce(() => {
  flowStore.saveWorkflow()
}, 300)
const duration = ref(0)
const formattedDuration = computed(() => {
  const minutes = Math.floor(duration.value / 60)
  const seconds = duration.value % 60
  return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
})
let timer = null
// 监听执行状态
watch(isExecuting, (val) => {
  if (val) {
    // 开始执行时记录时间
    timer = setInterval(() => {
      duration.value = duration.value + 1
    }, 1000)
  } else {
    // 停止执行时计算持续时间
    clearInterval(timer)
    duration.value = 0
  }
})
// 添加注释
const addComment = () => {
  //获取屏幕中心点
  const screenCenter = {
    x: window.innerWidth / 2,
    y: (window.innerHeight - 40) / 2
  }
  // 转换为工作流坐标
  const position = flowStore.vueFlowRef.screenToFlowCoordinate(screenCenter)
  flowStore.vueFlowRef.removeSelectedNodes()
  flowStore.vueFlowRef.addNodes([
    {
      id: 'node-' + uuidv4(),
      type: 'comment',
      selectable: true,
      focusable: true,
      deletable: true,
      position: {
        x: position.x - 150,
        y: position.y - 105
      },
      selected: true,
      zIndex: -1,
      data: {
        type: 'comment',
        name: '注释',
        inputs: [],
        outputs: [],
        config: {} // 初始化空配置
      }
    }
  ])
}
const noticeTypes = {
  success: {
    text: '成功',
    color: 'rgb(var(--success-6))'
  },
  error: {
    text: '错误',
    color: 'rgb(var(--danger-6))'
  },
  warning: {
    text: '警告',
    color: 'rgb(var(--warning-6))'
  },
  default: {
    text: '默认',
    color: 'var(--color-text-2)'
  }
}
// 表格列
const columns = [
  {
    title: '类型',
    dataIndex: 'type',
    width: 40,
    align: 'center',
    key: 'type',
    slotName: 'type'
  },
  {
    title: '内容',
    dataIndex: 'content',
    key: 'content',
    slotName: 'content'
  },
  {
    title: '时间',
    dataIndex: 'time',
    width: 100,
    key: 'time'
  }
]
defineEmits(['execute', 'stop', 'toggleChat'])
</script>

<style lang="less" scoped>
.flow-toolbar {
  display: flex;
  align-items: center;
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 4px;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-small);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.noticeTitle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
:deep(.arco-table-cell) {
  padding: 2px 0 0 10px;
}
</style>
