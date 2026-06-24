<template>
  <div class="trigger-view">
    <!-- 触发器配置信息 -->
    <div class="trigger-info">
      <a-space wrap>
        <span> 触发方式：</span>
        <a-tag :color="getTriggerTypeColor">
          {{ getTriggerTypeName }}
        </a-tag>
      </a-space>
      <a-space wrap v-if="node.config.triggerType === 'schedule'">
        <span> 触发时间：</span>
        <a-tag>{{ getScheduleInfo }}</a-tag>
        <a-tag v-if="node.config.schedule.maxTimes !== 0">
          次数: {{ node.config.schedule.maxTimes }}
        </a-tag>
      </a-space>
      <a-space wrap v-if="node.config.triggerType === 'loop'">
        <span> 间隔时间：</span>
        <a-tag> {{ node.config.loop.interval }}ms</a-tag>
        <a-tag v-if="node.config.loop.maxTimes !== 0">
          最大次数: {{ node.config.loop.maxTimes }}
        </a-tag>
      </a-space>
    </div>

    <!-- 参数配置表单 -->
    <div class="params-form" :style="{ display: paramFields.length ? 'block' : 'none' }">
      <a-divider orientation="left">触发参数 <small>(不支持参数引用)</small></a-divider>
      <FormView :fields="paramFields" v-model="formData" :allow-executing-edit="true" />
    </div>

    <!-- 手动触发按钮 -->
    <div class="actions" v-if="node.config.triggerType === 'manual'">
      <a-button type="primary" :loading="isTriggering" long @click="handleTrigger" :disabled="!isExecuting || !isReady">
        {{ isTriggering ? '触发中...' : '点击触发' }}
      </a-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import FormView from '@/workflow/components/nodes/FormView.vue'
import { buildConfigFields } from '../common'

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

// 状态
const isTriggering = ref(false)
const count = ref(0)
const nextTime = ref(null)
let currentCallback = null
// 注入方法
const sendNodeEvent = inject('sendNodeEvent')
const isExecuting = inject('isExecuting')
//参数表单数据，自动获取字段值，并绑定v-model
const formData = ref({})
// 参数字段配置
const paramFields = computed(() => {
  const fields =
    props.node.config.params?.map(buildConfigFields) || []
  fields.map((field) => (field.paramRef = false))
  fields.forEach((field) => {
    formData.value[field.id] = field.default
  })
  return fields
})

watch(
  isExecuting,
  (value) => {
    if (!value) {
      isReady.value = false
    }
  }
)

watch(
  formData,
  (value) => {
    props.node.config.params.forEach((param) => {
      param[param.type + 'Value'] = value[param.name]
    })
  },
  { deep: true }
)

// 计算触发器类型显示
const getTriggerTypeName = computed(() => {
  const types = {
    direct: '直接触发',
    schedule: '定时触发',
    loop: '循环触发',
    manual: '手动触发'
  }
  return types[props.node.config.triggerType] || '未知类型'
})

// 计算触发器类型颜色
const getTriggerTypeColor = computed(() => {
  const colors = {
    schedule: 'blue',
    loop: 'green',
    manual: 'orange'
  }
  return colors[props.node.config.triggerType] || 'gray'
})

// 计算定时配置信息
const getScheduleInfo = computed(() => {
  const schedule = props.node.config.schedule || {}
  const types = {
    daily: '每天',
    weekly: '每周',
    monthly: '每月'
  }
  let info = types[schedule.type] || ''

  switch (schedule.type) {
    case 'daily':
      info += ` ${schedule.time || ''}`
      break
    case 'weekly':
      info += ` ${schedule?.weekDay
        ?.map((d) => ['日', '一', '二', '三', '四', '五', '六'][d])
        .join('/')}`
      break
    case 'monthly':
      info += ` ${schedule?.monthDay?.join('/')}号`
      break
  }
  return info
})
const isReady = ref(false)
// 处理节点事件
const onNodeEvent = async (params, callback) => {
  if (params.type === 'ready') {
    isReady.value = true
  }
}

// 处理触发
const handleTrigger = async () => {
  if (isTriggering.value) return

  try {
    // 验证表单
    if (props.node.config.params?.length) {
      const valid = await formRef.value?.validate()
      console.log('valid', valid)
      if (!valid) return
    }

    // 调用回调或发送事件
    if (currentCallback) {
      currentCallback({
        type: 'confirm',
        data: formData.value
      })
      currentCallback = null
    } else {
      sendNodeEvent({
        type: 'confirm',
        data: formData.value
      })
    }
  } catch (error) {
    console.error('触发失败:', error)
  } finally {
    isTriggering.value = false
  }
}

// 暴露方法
defineExpose({
  onNodeEvent
})
</script>

<style scoped lang="less">
.trigger-view {
  .trigger-info {
    display: flex;
    flex-direction: column;
  }
  .trigger-status {
    margin: 12px 0;
    padding: 8px;
    background: var(--color-fill-2);
    border-radius: 4px;

    .status-item {
      display: flex;
      align-items: center;
      margin: 4px 0;

      .label {
        color: var(--color-text-3);
        margin-right: 8px;
      }

      .value {
        color: var(--color-text-2);
        font-family: monospace;
      }
    }
  }

  .section-title {
    font-weight: 500;
    margin: 12px 0 8px;
    color: var(--color-text-2);
  }

  .params-form {
    margin: 16px 0 0 0;
  }

  .actions {
    margin-top: 16px;
    text-align: center;
  }
}
</style>
