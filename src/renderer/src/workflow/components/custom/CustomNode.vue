<template>
  <div
    class="custom-node scrollbar"
    :class="{
      folded: false,
      selected: selected,
      'status-running': nodeStatus === 'running' || nodeStatus === 'retrying',
      'status-success': nodeStatus === 'success',
      'status-error': nodeStatus === 'error'
    }"
  >
    <div
      class="node-toolbar-box"
      v-if="!isExecuting && !data?.deactivate"
      :style="[configVisible ? { display: 'block' } : {}]"
    >
      <div class="node-toolbar">
        <a-tooltip v-if="nodeDefinition.type !== 'endNode'">
          <template #content>
            设为全局：{{ data?.global ? '是' : '否' }} <br />
            全局节点：节点输出可被 <b>所有</b> 节点引用 <br />
            普通节点：节点输出可被 <b>同级</b> 节点引用
          </template>
          <IconSwitch :modelValue="data?.global" @click="actionSelect('global')">
            <icon-public />
          </IconSwitch>
        </a-tooltip>
        <template v-if="nodeDefinition.type !== 'startNode'">
          <template v-if="nodeDefinition.type !== 'endNode'">
            <a-tooltip content="重命名：双击标题可快速编辑">
              <icon-edit @click="actionSelect('rename')" />
            </a-tooltip>
            <a-tooltip content="复制节点">
              <icon-copy @click="actionSelect('copy')" />
            </a-tooltip>
            <a-tooltip content="停用节点">
              <icon-stop @click="actionSelect('deactivate')" />
            </a-tooltip>
            <a-tooltip content="节点详情" v-if="nodeDefinition.subFlow && data?.workFlow?.store">
              <icon-file @click="actionSelect('detail')" />
            </a-tooltip>
          </template>
          <a-tooltip content="删除节点">
            <icon-delete @click="actionSelect('delete')" />
          </a-tooltip>
        </template>
      </div>
    </div>
    <div v-if="data.deactivate" class="deactivate">
      <b>节点已停用（停用后不再执行）</b>
      <a-button
        size="small"
        type="primary"
        @click="data.deactivate = false"
        :disabled="isExecuting || isPreview"
      >
        <template #icon>
          <icon-check-circle />
        </template>
        启用节点
      </a-button>
    </div>
    <FlowHandles
      :id="props.id"
      :node="nodeDefinition"
      @showQuickConnect="$emit('showQuickConnect', $event)"
      @addNode="$emit('addNode', $event)"
    />
    <!-- 节点头部 -->
    <div class="node-header">
      <a-avatar
        v-if="data.icon"
        :image-url="data.icon"
        :size="18"
        shape="square"
        class="node-icon"
      />
      <a-tooltip v-else>
        <template #content>
          节点：{{ nodeDefinition.name }} <br />
          <div v-html="'描述：' + nodeDefinition.description.replace(/\n/g, '<br />')"></div>
        </template>
        <component
          title="点击查看节点详情"
          :is="nodeDefinition.icon"
          class="node-icon"
          :style="[data.type == 'logicIf' ? 'transform: rotate(90deg)' : '']"
        />
      </a-tooltip>
      <div class="node-title">
        <a-typography-text
          v-if="!renameMode"
          ellipsis
          style="margin: 0px"
          @dblclick="actionSelect('rename')"
        >
          {{ data.name }}
        </a-typography-text>
        <div v-else class="rename-input-box">
          <a-input
            class="node-name-input no-drag no-wheel"
            @keydown.stop
            @keyup.stop
            v-model="nodeName"
            :error="checkNodeName(nodeName)"
            @blur="saveNodeName"
            @pressEnter="$event.target.blur()"
            ref="renameInputRef"
          />
          <div class="rename-tips">同级名称不能重复,仅允许中,英,数,下划线</div>
        </div>
      </div>
      <div class="node-actions">
        <a-space>
          <a-tag v-if="nodeStatus === 'retrying'" size="small" color="red">
            第 {{ errMsg }} 次重试中...
          </a-tag>
          <ModalPopover v-if="errMsg && nodeStatus !== 'retrying'">
            <template #content>
              <div class="node-error-msg">
                {{ errMsg }}
              </div>
            </template>
            <div class="exclamation">
              <icon-exclamation-polygon-fill />
            </div>
          </ModalPopover>

          <ModalPopover v-if="debug">
            <template #content>
              <DebugInfo :id="props.id" :data="debugInfos" @clear="debugInfos = []" />
            </template>
            <a-tooltip content="查看调试信息">
              <icon-bug />
            </a-tooltip>
          </ModalPopover>

          <ModalPopover
            @visible-change="configVisible = $event"
            position="right"
            v-if="
              !isExecuting &&
              !data?.deactivate &&
              (nodeDefinition.type !== 'customNode' || nodeConfig.openSource || isMyNode) &&
              Object.keys(allConfigFieldsWithGroup).length > 0
            "
          >
            <template #content>
              <a-tabs
                type="card-gutter"
                tabindex="0"
                @keydown="unDoReDoInterceptor"
                @keyup="unDoReDoInterceptor"
                @mouseenter="isFocus = true"
              >
                <a-tab-pane
                  :title="name"
                  v-for="(fields, name) in allConfigFieldsWithGroup"
                  :key="name"
                >
                  <div class="config-content" style="padding: 10px">
                    <FieldRenderer v-model="nodeConfig" :fields="fields" />
                  </div>
                </a-tab-pane>
              </a-tabs>
            </template>
            <a-tooltip content="节点完整配置">
              <icon-settings />
            </a-tooltip>
          </ModalPopover>
        </a-space>
      </div>
    </div>

    <!-- 节点内容 -->
    <div class="node-content">
      <!-- 上部分：输入输出区域 -->
      <div class="io-section" v-if="nodeInputs.length || nodeOutputs.length">
        <!-- 输入参数 -->
        <div class="params-container input-params">
          <div v-for="input in nodeInputs" :key="input.id" class="param-item">
            <a-popover>
              <Handle
                :connectable="!isExecuting"
                type="target"
                :id="input.id"
                :position="Position.Left"
                :class="[
                  'handle',
                  `handle-${input.type || 'default'}`,
                  {
                    is_self_hover:
                      props.id === pendingConnection?.nodeId &&
                      pendingConnection?.handleId === input.id
                  },
                  getConnectionClass(
                    {
                      id: props.id,
                      handle: input.id,
                      type: 'target'
                    },
                    pendingConnection,
                    validateConnection
                  )
                ]"
                :is-valid-connection="validateConnection"
              >
                <svg class="param-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <path
                    v-for="(item, i) in getTypeColor(input.type)"
                    :key="i"
                    :d="item.d"
                    :fill="item.fill"
                  />
                  <circle cx="50" cy="50" r="30" fill="white" />
                </svg>
              </Handle>
              <template #content>
                <div
                  style="display: flex; align-items: center; gap: 4px"
                  v-for="(item, i) in getTypeColor(input.type)"
                  :key="i"
                >
                  <div
                    style="width: 10px; height: 10px; border-radius: 50%"
                    :style="{ background: item.fill }"
                  />
                  <span style="font-size: 10px; color: var(--color-text-2)">{{ item.text }}</span>
                </div>
              </template>
            </a-popover>
            <a-space :size="1">
              <span
                class="param-name"
                :class="{
                  'need-connect': flowStore.needConnects.some(
                    (item) => item.nodeId === props.id && item.inputId === input.id
                  )
                }"
              >
                {{ input.name }}
              </span>
              <span v-if="input.required" class="param-required">
                <svg fill="currentColor" viewBox="0 0 1024 1024" width="1em" height="1em">
                  <path
                    d="M583.338667 17.066667c18.773333 0 34.133333 15.36 34.133333 34.133333v349.013333l313.344-101.888a34.133333 34.133333 0 0 1 43.008 22.016l42.154667 129.706667a34.133333 34.133333 0 0 1-21.845334 43.178667l-315.733333 102.4 208.896 287.744a34.133333 34.133333 0 0 1-7.509333 47.786666l-110.421334 80.213334a34.133333 34.133333 0 0 1-47.786666-7.509334L505.685333 706.218667 288.426667 1005.226667a34.133333 34.133333 0 0 1-47.786667 7.509333l-110.421333-80.213333a34.133333 34.133333 0 0 1-7.509334-47.786667l214.186667-295.253333L29.013333 489.813333a34.133333 34.133333 0 0 1-22.016-43.008l42.154667-129.877333a34.133333 34.133333 0 0 1 43.008-22.016l320.512 104.106667L412.672 51.2c0-18.773333 15.36-34.133333 34.133333-34.133333h136.533334z"
                  ></path>
                </svg>
              </span>
              <a-tooltip v-if="input.description" :content="input.description">
                <icon-question-circle class="param-description" />
              </a-tooltip>
            </a-space>
          </div>
        </div>

        <!-- 输出参数 -->
        <div class="params-container output-params">
          <div v-for="output in nodeOutputs" :key="output.id" class="param-item">
            <a-tooltip v-if="output.description" :content="output.description">
              <icon-question-circle class="param-description" />
            </a-tooltip>
            <span class="param-name">{{ output.name }}</span>
            <a-popover>
              <Handle
                :connectable="!isExecuting"
                type="source"
                :id="output.id"
                :position="Position.Right"
                :class="[
                  'handle',
                  `handle-${output.type || 'default'}`,
                  {
                    is_self_hover:
                      props.id === pendingConnection?.nodeId &&
                      pendingConnection?.handleId === output.id
                  },
                  getConnectionClass(
                    {
                      id: props.id,
                      handle: output.id,
                      type: 'source'
                    },
                    pendingConnection,
                    validateConnection
                  )
                ]"
                :is-valid-connection="validateConnection"
              >
                <svg class="param-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <path
                    v-for="(item, i) in getTypeColor(output.type)"
                    :key="i"
                    :d="item.d"
                    :fill="item.fill"
                  />
                  <circle cx="50" cy="50" r="30" fill="white" />
                </svg>
              </Handle>
              <template #content>
                <div
                  style="display: flex; align-items: center; gap: 4px"
                  v-for="(item, i) in getTypeColor(output.type)"
                  :key="i"
                >
                  <div
                    style="width: 10px; height: 10px; border-radius: 50%"
                    :style="{ background: item.fill }"
                  />
                  <span style="font-size: 10px; color: var(--color-text-2)">{{ item.text }}</span>
                </div>
              </template>
            </a-popover>
          </div>
        </div>
      </div>

      <!-- 快捷配置区域 -->
      <div class="quick-config" :class="{ preview: isPreview }" v-if="quickConfigFields.length">
        <FieldRenderer
          ref="quickConfigRef"
          v-model="nodeConfig"
          :fields="quickConfigFields"
          :disabled="isExecuting"
          :is-quick-config="true"
        />
      </div>

      <!-- 节点视图 -->
      <div
        class="execute-view no-wheel no-drag no-pan"
        :class="{ preview: isPreview }"
        v-if="nodeView"
      >
        <component
          :is="nodeView"
          :node="{ id: props.id, ...props.data }"
          :node-status="nodeStatus"
          ref="nodeViewRef"
        />
      </div>
    </div>
    <!-- 子流程连接点 -->
    <div class="subFlow-container" v-if="isAllowExpand">
      <Handle
        id="subFlow"
        type="source"
        position="bottom"
        style="bottom: -48px; opacity: 0"
        :connectable="false"
      />
      <div
        class="toggleSubFlow"
        :class="{ disabled: isExecuting }"
        @click.stop="toggleSubFlow(props.id + '-subFlow')"
      >
        <icon-branch
          :style="{ transform: props.data.subFlowExpand ? 'rotate(0deg)' : 'rotate(180deg)' }"
          style="transition: all 0.2s"
        />
        {{ props.data.subFlowExpand ? '收起' : '展开' }}{{ nodeDefinition.subFlow.name }}
      </div>
    </div>
  </div>
  <NodeResizer
    v-if="nodeDefinition.resizable"
    :min-width="nodeDefinition?.size?.width || 300"
    :min-height="nodeDefinition?.size?.height || 30"
    @resize="handleResize"
  />
  <div v-if="nodeDefinition.resizable" class="node-resizer"></div>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
  ref,
  inject,
  defineProps,
  defineEmits,
  provide,
  nextTick,
  watch,
  onUnmounted
} from 'vue'
import { Handle, Position } from '@vue-flow/core'
import {
  IconSettings,
  IconMoreVertical,
  IconQuestionCircle,
  IconExclamationPolygonFill,
  IconPlus,
  IconBranch,
  IconEdit,
  IconCopy,
  IconDelete,
  IconCheckCircle,
  IconStop,
  IconFile,
  IconPublic,
  IconCheckCircleFill,
  IconBug
} from '@arco-design/web-vue/es/icon'
import FieldRenderer from '../fieldRenderer/FieldRenderer.vue'
import ModalPopover from '../ModalPopover.vue'
import FlowHandles from './components/FlowHandles.vue'
import IconSwitch from './components/iconSwitch.vue'
import { NodeResizer } from '@vue-flow/node-resizer'
import nodes from '@nodes-path'
import { useFlowStore } from '../../store'
const workflowId = inject('workflowId')
//获取工作流数据
const flowStore = useFlowStore(workflowId)
import { storeToRefs } from 'pinia'
const { debug } = storeToRefs(flowStore)
import DebugInfo from './components/debugInfo.vue'
import { ConnectionRules, parseConfigExpression } from '../../utils'
import { useStore } from '@/store'
const { userInfo } = useStore()
const isMyNode = computed(() => props.data.user_id === userInfo.id)
import {
  deepClone,
  getTypeColor,
  getConnectionClass,
  adjustParentSize,
  unDoReDoInterceptor
} from '../../utils'
provide('isMyNode', isMyNode)
provide('storeScene', 'nodeDetail')
const { validateConnection } = new ConnectionRules(workflowId)
const isExecuting = inject('isExecuting')
const isPreview = inject('isPreview')
const isFocus = inject('isFocus')
const props = defineProps({
  id: {
    type: String,
    required: true
  },
  data: {
    type: Object,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  }
})
provide('nodeData', props.data)
provide('nodeId', props.id)
// 快捷配置是否可见
const configVisible = ref(false)
// 节点视图组件
const nodeViewRef = ref(null)
// 定义事件
const emit = defineEmits([
  'addNode',
  'action',
  'addNodeToSubFlow',
  'showQuickConnect',
  'openWorkflowDetail'
])
// 是否处于重命名模式
const renameMode = ref(false)
// 重命名输入框
const renameInputRef = ref(null)
// 节点名称
const nodeName = ref(props.data.name)
// 检查节点名称是否重复 = 是否存在同名节点
const checkNodeName = (name) => {
  if (
    !name ||
    ['开始流程', '结束流程'].includes(name) ||
    !/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(name)
  )
    return true
  const node = flowStore.vueFlowRef.findNode(props.id)
  return flowStore.vueFlowRef.getNodes
    .filter((n) => n.parentNode === node.parentNode && n.id !== node.id)
    .some((el) => el.data.name === name)
}

// 保存节点名称
const saveNodeName = () => {
  // 检查节点名称是否重复
  if (!checkNodeName(nodeName.value)) {
    // 更新节点名称
    props.data.name = nodeName.value
    flowStore.onNodesChange([
      {
        id: props.id,
        type: 'data'
      }
    ])
  }
  // 关闭重命名模式
  renameMode.value = false
}
// 处理节点操作
const actionSelect = (key) => {
  if (key === 'delete') {
    emit('action', 'delete', props.id)
  } else if (key === 'copy') {
    emit('action', 'copy', props.id)
  } else if (key === 'rename') {
    if (['startNode', 'endNode'].includes(props.data.type)) {
      return
    }
    nodeName.value = props.data.name
    renameMode.value = true
    nextTick(() => {
      renameInputRef.value.inputRef.select()
    })
  } else if (key === 'detail') {
    openWorkflowDetail(props.data?.workFlow?.id)
  } else if (key === 'deactivate') {
    props.data.deactivate = true
  } else if (key === 'global') {
    props.data.global = !props.data.global
  }
}

// 快捷配置
const quickConfigRef = ref(null)
// 监听快捷配置ref初始化
watch(
  () => quickConfigRef.value,
  (value) => {
    console.log('quickConfigRef', value)
    if (value) {
      flowStore.nodeRefs.set(props.id, quickConfigRef.value)
    } else {
      flowStore.nodeRefs.delete(props.id)
    }
  }
)
// 打开工作流详情弹窗
const openWorkflowDetail = (workflowId) => {
  emit('openWorkflowDetail', workflowId)
}
// 卸载时移除节点引用
onUnmounted(() => {
  flowStore.nodeRefs.delete(props.id)
})

// 获取连线状态
const pendingConnection = inject('pendingConnection')
// 获取节点定义
const nodeDefinition = nodes[props.data.type]

//添加其他节点的异常处理
if (nodeDefinition.type !== 'startNode' && nodeDefinition.type !== 'endNode') {
  //异常处理
  nodeDefinition.config.errorHandle = {
    name: '执行配置',
    fields: {
      errorHandleType: {
        id: 'errorHandleType',
        name: '错误处理',
        type: 'select',
        description: '节点遇到错误时的处理方式',
        default: 'stop',
        paramRef: false,
        options: [
          {
            label: '忽略错误',
            value: 'ignore'
          },
          {
            label: '重试节点',
            value: 'retry'
          },
          {
            label: '指定节点',
            value: 'specify'
          },
          {
            label: '重试流程',
            value: 'retryFlow'
          },
          {
            label: '终止流程',
            value: 'stop'
          }
        ]
      },
      errorHandleRetryCount: {
        id: 'errorHandleRetryCount',
        name: '重试次数',
        type: 'number',
        description: '重试次数',
        show: "${errorHandleType}==='retry'",
        default: 3,
        paramRef: false
      },
      errorHandleRetryInterval: {
        id: 'errorHandleRetryInterval',
        name: '重试间隔',
        type: 'number',
        description: '重试间隔（毫秒）',
        show: "${errorHandleType}==='retry'",
        default: 1000,
        paramRef: false
      },
      errorHandleRetryFailed: {
        id: 'errorHandleRetryFailed',
        name: '重试失败',
        type: 'select',
        description: '重试次数超过最大重试次数时的处理方式',
        default: 'stop',
        show: "${errorHandleType}==='retry'",
        paramRef: false,
        options: [
          {
            label: '忽略错误',
            value: 'ignore'
          },
          {
            label: '指定节点',
            value: 'specify'
          },
          {
            label: '终止流程',
            value: 'stop'
          },
          {
            label: '重试流程',
            value: 'retryFlow'
          }
        ]
      },
      errorHandleSpecifyNode: {
        id: 'errorHandleSpecifyNode',
        name: '指定节点',
        type: 'select',
        description: '指定要跳转的节点',
        show: "${errorHandleType}==='specify' || ${errorHandleRetryFailed}==='specify'",
        paramRef: false,
        remote: true,
        options: [],
        remoteMethod: async (keyword = '') => {
          const node = flowStore.vueFlowRef.findNode(props.id)
          let nodes = flowStore.vueFlowRef.getNodes.filter(
            (n) => n.parentNode === node.parentNode && n.id !== node.id
          )
          if (keyword) {
            nodes = nodes.filter((n) => n.data.name.includes(keyword))
          }
          const options = nodes.map((el) => ({
            label: el.data.name,
            value: el.id
          }))
          return options
        },
        default: ''
      }
      // nodeExecute: {
      //   id: 'nodeExecute',
      //   name: '执行超时',
      //   type: 'switch',
      //   description: '是否启用执行超时',
      //   default: false
      // },
      // nodeExecuteTimeout: {
      //   id: 'nodeExecuteTimeout',
      //   name: '超时时间',
      //   type: 'number',
      //   description: '节点执行超时时间（毫秒）',
      //   show: '${nodeExecute}',
      //   min: 1000,
      //   default: 60000
      // }
    }
  }
}

// 节点配置数据
const nodeConfig = computed({
  get() {
    const config = props.data.config
    return isPreview.value ? {} : config
  },
  set(value) {
    props.data.config = value
  }
})

//监听节点的停用状态，发送至历史记录
watch(
  () => [props.data.deactivate, props.data.global],
  (newVal) => {
    flowStore.onNodesChange([
      {
        id: props.id,
        type: 'data'
      }
    ])
  }
)
//监听节点的数据变化，发送至历史记录
watch(
  nodeConfig,
  () => {
    flowStore.onNodesChange([
      {
        id: props.id,
        type: 'data'
      }
    ])
  },
  {
    deep: true
  }
)

// 获取所有配置字段，包含分组信息
const allConfigFieldsWithGroup = computed(() => {
  const groups = {}
  const config = nodeDefinition?.config
  // 遍历节点配置
  Object.values(config || {}).forEach((group) => {
    groups[group.name] = []
    // 遍历节点配置组
    Object.values(group.fields || {}).forEach((field) => {
      groups[group.name].push(field)
    })
  })
  return groups
})

// 获取快捷配置字段
const quickConfigFields = computed(() => {
  const fields = []
  const config = nodeDefinition?.config
  // 遍历节点配置
  Object.values(config || {}).forEach((group) => {
    // 遍历节点配置组
    Object.values(group.fields || {}).forEach((field) => {
      // 如果字段是快捷配置
      if (field.quickConfig || field.required) {
        // 将字段添加到快捷配置字段数组
        fields.push(field)
      }
    })
  })

  return fields
})

// 获取节点输入
const nodeInputs = computed(() => {
  const inputs = nodeDefinition?.inputs.filter((input) => input.type !== 'dynamic')
  let dynamicInputs = []
  nodeDefinition?.inputs
    .filter((input) => input.type == 'dynamic')
    .forEach((input) => {
      const data =
        input.dataPath.split('.').reduce((obj, key) => obj?.[key], props.data.config) || []
      if (Array.isArray(data)) {
        data.forEach((item) => {
          dynamicInputs.push({
            id: item[input.fieldMap.id],
            name: item[input.fieldMap.name],
            type: item[input.fieldMap.type] || 'any',
            description: item[input.fieldMap.description] || '',
            required: item[input.fieldMap.required] || false
          })
        })
      }
    })
  dynamicInputs = dynamicInputs.filter((input) => input.id)
  let startNodeOutputs = []
  //如果是子流程，获取子流程的开始节点输入
  if (nodeDefinition.subFlow) {
    const startNode = flowStore.vueFlowRef.getNodes.find(
      (node) => node.data.type === 'startNode' && node.parentNode == props.id + '-subFlow'
    )
    if (startNode) {
      startNodeOutputs = startNode.data.outputs.filter((output) => !output.isConfig)
    }
  }
  //计算动态输入的显示条件
  props.data.inputs = [...inputs, ...dynamicInputs, ...startNodeOutputs].filter((input) =>
    input.show
      ? parseConfigExpression(
          Object.values(allConfigFieldsWithGroup.value).flat(),
          'show',
          input.show,
          props.data.config
        )
      : true
  )
  return props.data.inputs
})

// 获取节点输出
const nodeOutputs = computed(() => {
  try {
    const outputs = nodeDefinition?.outputs.filter((output) => output.type !== 'dynamic')

    // 子流程的开始节点输出处理
    if (props.data.type === 'startNode') {
      const node = flowStore.vueFlowRef.findNode(props.id)
      if (node.parentNode) {
        const parentNode = flowStore.vueFlowRef.findNode(node.parentNode.replace('-subFlow', ''))
        const parentNodeDefinition = nodes[parentNode.data.type]
        if (parentNode && parentNodeDefinition.subFlow) {
          parentNodeDefinition.subFlow.startOutputs.forEach((item) => {
            outputs.push({
              id: item.id,
              name: item.name,
              type: item.type,
              description: item.description,
              isConfig: true
            })
          })
        }
      }
    }

    let dynamicOutputs = []
    nodeDefinition?.outputs
      .filter((output) => output.type == 'dynamic')
      .forEach((output) => {
        const data =
          output.dataPath.split('.').reduce((obj, key) => obj?.[key], props.data.config) || []
        if (Array.isArray(data)) {
          data.forEach((item) => {
            dynamicOutputs.push({
              id: item[output.fieldMap.id],
              name: item[output.fieldMap.name],
              type: item[output.fieldMap.type] || 'any',
              description: item[output.fieldMap.description] || '',
              required: item[output.fieldMap.required] || false,
              isConfig: output.fieldMap.isConfig || false
            })
          })
        }
      })
    dynamicOutputs = dynamicOutputs.filter((output) => output.id)

    let endNodeInputs = []
    if (nodeDefinition.subFlow && nodeDefinition.subFlow.endOutputs !== false) {
      const endNode = flowStore.vueFlowRef.getNodes.find(
        (node) => node.data.type === 'endNode' && node.parentNode == props.id + '-subFlow'
      )
      if (endNode) {
        endNodeInputs = endNode.data.inputs
      }
    }
    //计算动态输出的显示条件
    props.data.outputs = [...outputs, ...dynamicOutputs, ...endNodeInputs].filter((output) =>
      output.show
        ? parseConfigExpression(
            Object.values(allConfigFieldsWithGroup.value).flat(),
            'show',
            output.show,
            props.data.config
          )
        : true
    )
    return props.data.outputs
  } catch (error) {
    return []
  }
})

//监听输入和输出检查连线类型是否匹配，如果不匹配则删除连线
watch([nodeOutputs, nodeInputs], () => {
  const expireEdges = flowStore.vueFlowRef.getEdges
    .filter(
      (edge) =>
        [edge.source, edge.target].includes(props.id) &&
        edge.sourceHandle !== 'next' &&
        edge.sourceHandle !== 'next-false' &&
        edge.sourceHandle !== 'subFlow'
    )
    .filter((edge) => {
      return !validateConnection(
        {
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle
        },
        true
      )
    })
  if (expireEdges.length) {
    flowStore.vueFlowRef.removeEdges(expireEdges)
  }
})

// 加载节点视图组件
const nodeView = computed(() => {
  if (nodeDefinition.view) {
    return defineAsyncComponent(() => import(`@nodes-path/${nodeDefinition.type}/view.vue`))
  }
  return null
})

const isAllowExpand = computed(() => {
  return nodeDefinition.subFlow && !(props.data.workFlow && props.data.workFlow.only_node)
})

// 切换子流程显示状态
const toggleSubFlow = (id, isChild = false) => {
  if (isExecuting.value) {
    return
  }
  const subFlowNode = flowStore.vueFlowRef.getNode(id)
  const isFirstExpand = subFlowNode.dimensions.width === 0 && subFlowNode.dimensions.height === 0
  const hidden = isChild ? subFlowNode.hidden : !subFlowNode.hidden
  subFlowNode.hidden = hidden

  //展开时判断子流程是否和父节点发生覆盖，如果是则调整子流程相对位置
  if (id.endsWith('subFlow')) {
    const subFlowParentNode = flowStore.vueFlowRef.getNode(id.slice(0, -8))
    subFlowParentNode.data.subFlowExpand = !hidden
    if (!hidden) {
      if (subFlowParentNode.dimensions.height + 50 > subFlowNode.position.y) {
        subFlowNode.position.y = subFlowParentNode.dimensions.height + 100
      }
    }
  }

  const getChildNodes = (node) => {
    return flowStore.vueFlowRef.getNodes.filter((el) => el.parentNode === node.id)
  }

  const childNodes = getChildNodes(subFlowNode)

  childNodes.forEach((node) => {
    node.hidden = hidden
    //如果节点是仅节点则不进行展开收起
    if (!isAllowExpand.value) {
      return
    }
    //如果收起则递归收起子节点，展开则仅一层即可
    if (hidden && getChildNodes(node).length > 0) {
      toggleSubFlow(node.id, true)
    }
  })

  //如果是第一次展开，需要调整子流程节点的位置
  if (isFirstExpand && !hidden) {
    const { off: offNodesInitialized } = flowStore.vueFlowRef.onNodesInitialized(() => {
      offNodesInitialized()
      setTimeout(() => {
        adjustParentSize(childNodes, flowStore.vueFlowRef)
      }, 49)
    })
  }
  flowStore.onNodesChange([
    {
      id,
      type: 'hidden'
    }
  ])
}

// 发送节点事件
const sendNodeEvent = async (params) => {
  return new Promise((resolve, reject) => {
    try {
      // 发送事件到主进程
      window.electronAPI.emitFlowEvent(
        'nodeEvent',
        workflowId,
        props.id,
        deepClone(params),
        (response) => {
          if (response.error) {
            reject(new Error(response.error))
          } else {
            resolve(response)
          }
        }
      )
    } catch (error) {
      reject(error)
    }
  })
}

// 处理节点大小调整
const handleResize = (event) => {
  const { width, height } = event.params
  if (nodeViewRef.value?.onNodeResize) {
    // 直接传递回调函数
    nodeViewRef.value.onNodeResize({ width, height })
  }
}

provide('sendNodeEvent', sendNodeEvent)
// 节点状态
const nodeStatus = ref('initializing')
// 错误信息
const errMsg = ref('')
// 调试信息
const debugInfos = ref([])
// 注册节点事件监听
const registerNodeEvents = () => {
  // 注册其他事件监听
  const unsubscribeEvent = window.electronAPI.onFlowEvent(
    'nodeEvent',
    workflowId,
    props.id,
    async (event, params, callback) => {
      try {
        // 如果节点视图存在
        if (nodeViewRef.value?.onNodeEvent) {
          // 直接传递回调函数
          await nodeViewRef.value.onNodeEvent(params, callback)
        }
      } catch (error) {
        // 如果回调函数存在
        if (callback) {
          // 传递错误信息
          callback({ error: error.message })
        }
      }
    }
  )

  // 注册节点状态监听
  const unsubscribeStatus = window.electronAPI.onFlowEvent(
    'nodeStatus',
    workflowId,
    props.id,
    (event, status) => {
      console.log('status.state', status.state)
      if (status.state !== 'stopped') {
        nodeStatus.value = status.state
      } else if (
        status.state === 'stopped' &&
        (nodeStatus.value === 'running' || nodeStatus.value === 'retrying')
      ) {
        nodeStatus.value = status.state
      }
      if (status.result) {
        props.data.result = status.result
      }
      if (status.error) {
        errMsg.value = status.error
      }
    }
  )

  // 注册节点调试信息监听
  const unsubscribeDebug =
    (debug.value &&
      window.electronAPI.onFlowEvent('debug', workflowId, props.id, (event, debugInfo) => {
        debugInfos.value.push(debugInfo)
      })) ||
    (() => {})
  return () => {
    unsubscribeStatus()
    unsubscribeEvent()
    unsubscribeDebug()
  }
}

const engine = flowStore.engine
let cleanup = null
engine.on('beforeStart', () => {
  if (cleanup) {
    cleanup()
  }
  // 节点初始化
  nodeStatus.value = 'initializing'
  errMsg.value = ''
  // 注册节点事件监听
  cleanup = registerNodeEvents()
})
engine.on('beforeStop', async () => {
  if (nodeStatus.value === 'running' || nodeStatus.value === 'retrying') {
    nodeStatus.value = 'initializing'
    errMsg.value = ''
  }
  if (cleanup) {
    await cleanup()
  }
})
</script>

<style lang="less" scoped>
.node-error-msg {
  padding: 10px;
  background: rgb(var(--red-1));
  border-radius: var(--border-radius-small);
  user-select: text;
}
.custom-node {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: fit-content;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-small);
  cursor: pointer;
  overflow: auto;
  overflow-x: hidden;
  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    .toggleSubFlow {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }
    .quick-config {
      display: block !important;
    }
    .node-toolbar-box {
      display: block;
    }
  }
  .node-toolbar-box {
    display: none;
    height: 32px;
    position: absolute;
    top: -30px;
    width: 100%;
    z-index: 1000;
    left: 0;
    .node-toolbar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      height: 32px;
      font-weight: bold;
      font-size: 14px;
      color: var(--color-text-1);
      /* padding: 0 11px; */
      background: rgba(255, 255, 255, 0.3);
      height: 24px;
      padding: 0 12px;
      border-radius: var(--border-radius-small);
      border: 1px solid var(--color-border);
    }
  }

  &.folded {
    .quick-config {
      display: none;
    }
  }

  &.selected {
    border-color: rgb(var(--primary-6)) !important;
    box-shadow: 0 4px 8px rgba(var(--primary-6), 0.2) !important;
    .quick-config {
      display: block !important;
    }
    .toggleSubFlow {
      border-color: rgb(var(--primary-6)) !important;
      box-shadow: 0 4px 8px rgba(var(--primary-6), 0.2) !important;
      &::before {
        background: rgb(var(--primary-6)) !important;
      }
    }
  }
  .custom-node-quick-connect {
    position: fixed;
  }

  .deactivate {
    position: absolute;
    width: calc(100% - 2px);
    height: calc(100% - 2px);
    background: rgba(255, 255, 255, 0.8);
    z-index: 99;
    border-radius: var(--border-radius-small);
    display: flex;
    gap: 16px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .node-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    // border-bottom: 1px solid var(--color-border);
    background: linear-gradient(to bottom, rgb(var(--primary-1)), #fff);
    border-radius: 2px 2px 0 0;

    .node-icon {
      width: 18px;
      height: 18px;
      margin-right: 8px;
    }

    .node-title {
      flex: 1;
      font-size: 16px;
      font-weight: bold;
      color: var(--color-text-1);
      position: relative;
      .node-name-input {
        height: 25px;
      }
      .rename-tips {
        font-weight: normal;
        position: absolute;
        top: 27px;
        left: 0;
        font-size: 10px;
        background: #fff;
        color: var(--color-text-2);
      }
    }

    .node-actions {
      margin-left: 8px;
      opacity: 1;
      display: flex;
      position: relative;
      .exclamation {
        color: #ff4d4f;
      }
      .disabled {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
      }
    }
  }

  .node-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    .io-section {
      padding: 10px;
      display: flex;
      justify-content: space-between;

      .params-container {
        flex: 1;

        .param-item {
          display: flex;
          align-items: center;
          height: 20px;
          position: relative;
          cursor: default;

          .param-icon {
            position: absolute;
            pointer-events: none;
          }

          .param-icon-description {
            display: flex;
            align-items: center;
            gap: 4px;
            &-color {
              width: 10px;
              height: 10px;
              border-radius: 50%;
            }
            &-text {
              font-size: 10px;
              color: var(--color-text-2);
            }
          }

          .param-name {
            font-size: 10px;
            color: var(--color-text-2);
            &.need-connect {
              padding: 0 2px;
              background: var(--color-danger-light-1);
              color: rgb(var(--danger-6));
              border: 1px solid rgb(var(--danger-3));
              &::after {
                content: '[必传]';
                color: rgb(var(--danger-6));
                margin-left: 2px;
              }
            }
          }
          .param-required {
            color: rgb(var(--danger-6));
            margin-left: 2px;
            margin-top: 2px;
            font-size: 6px;
          }
          .param-description {
            font-size: 12px;
            color: #b1b1b7;
            margin: 0 2px;
          }

          .handle {
            width: 10px;
            height: 10px;
            background: white;
            &:hover {
              width: 12px;
              height: 12px;
            }
          }
          .is_self_hover {
            cursor: crosshair !important;
          }
          .no-connection {
            opacity: 0.5;
            cursor: no-drop;
            &:hover {
              width: 10px !important;
              height: 10px !important;
              border: 2px solid var(--color-border) !important;
            }
          }

          .yes-connection {
            opacity: 1;
            transition: all 0.2s;
            width: 12px;
            height: 12px;
            border-width: 0;
          }
        }
      }

      .input-params .param-item {
        padding-left: 10px;
      }

      .output-params .param-item {
        padding-right: 10px;
        justify-content: flex-end;
      }
    }

    .quick-config {
      padding: 6px;
      border-top: 1px dashed var(--color-border);
      cursor: default;
      &.preview {
        :deep(.arco-form-item-wrapper-col) {
          filter: blur(3px);
          &::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
          }
        }
      }

      .config-item {
        display: flex;
        align-items: center;
        .config-item-title {
          font-size: 12px;
          display: flex;
          margin-right: 8px;
          gap: 2px;
          align-items: center;
        }
        .config-item-content {
          flex: 1;
        }
        &:last-child {
          margin-bottom: 0;
        }
      }
    }

    .quick-config-title {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 8px;
      color: var(--color-text-1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
    }
    .execute-view {
      flex: 1;
      padding: 6px;
      border-top: 1px dashed var(--color-border);
      overflow: hidden;
      &.preview {
        :deep(.arco-form-item-wrapper-col) {
          filter: blur(3px);
          &::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
          }
        }
      }
    }
  }

  // 执行状态样式
  &.status-running {
    border-color: rgb(var(--warning-6));
    // box-shadow: 0 4px 8px rgba(var(--warning-6), 0.2);
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: 2px solid rgb(var(--warning-6));
      border-radius: 4px;
      animation: border-flow 1s linear infinite;
    }
  }

  &.status-success {
    border-color: rgb(var(--success-6));
    // box-shadow: 0 4px 8px rgba(var(--success-6), 0.2);
  }

  &.status-error {
    border-color: rgb(var(--danger-6));
    // box-shadow: 0 4px 8px rgba(var(--danger-6), 0.2);
  }
}

@keyframes border-flow {
  0% {
    clip-path: inset(0 0 95% 0);
  }
  25% {
    clip-path: inset(0 0 0 95%);
  }
  50% {
    clip-path: inset(95% 0 0 0);
  }
  75% {
    clip-path: inset(0 95% 0 0);
  }
  100% {
    clip-path: inset(0 0 95% 0);
  }
}

// 修改连线样式
:deep(.react-flow__edge-path) {
  stroke-width: 2px;

  &[data-type='flow'] {
    stroke-width: 3px;
    stroke: rgb(var(--primary-6));
  }
}
.toggleSubFlow {
  position: fixed;
  bottom: -50px;
  left: 50%;
  background: #fff;
  width: 100px;
  margin-left: -50px;
  border-radius: var(--border-radius-small);
  border: 1px solid var(--color-border);
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  &::before {
    height: 20px;
    width: 1px;
    background: var(--color-border);
    content: '';
    position: absolute;
    top: -11px;
    left: 50%;
    transform: translate(-50%, -50%);
  }
}

.node-resizer {
  position: absolute;
  width: 8px;
  height: 8px;
  border-bottom: 1px solid #000;
  bottom: 0px;
  right: 0px;
  border-right: 1px solid #000;
  border-bottom-right-radius: var(--border-radius-small);
  pointer-events: none;
  &:before {
    content: '';
    position: absolute;
    width: 8px;
    height: 8px;
    border-top: 1px solid #000;
    pointer-events: none;
    transform: translate(-50%, -50%) rotate(135deg);
  }
  &:after {
    content: '';
    position: absolute;
    width: 3px;
    height: 12px;
    border-top: 1px solid #000;
    pointer-events: none;
    transform: translate(-50%, -50%) rotate(135deg);
  }
}
.config-content {
  max-height: calc(90vh - 40px);
  overflow: auto;
}
</style>
