<template>
  <ModalPopover
    trigger="none"
    trigger-style="width: 100%"
    ref="modalPopoverRef"
    v-model:visible="visible"
    @visible-change="handleVisibleChange"
    v-if="isAvailable || showTrigger"
  >
    <div @click="handleClick"><slot></slot></div>
    <template #content>
      <div class="param-selector">
        <div class="param-selector-header">
          <template v-if="headerText">{{ headerText }}</template>
          <template v-else><icon-code-block /> 参数引用（文本框内 {{ isMacOS ? 'Opt' : 'Alt' }} 键唤起）</template>
        </div>
        <div class="target" v-if="props.field">
          <span>
            <span>字段：</span>
            <span>
              <a-popover>
                <svg class="param-type" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <path
                    v-for="(item, i) in getTypeColor(allowTypes)"
                    :key="i"
                    :d="item.d"
                    :fill="item.fill"
                  />
                  <circle cx="50" cy="50" r="30" fill="white" />
                </svg>
                <template #content>
                  <div
                    style="display: flex; align-items: center; gap: 4px"
                    v-for="(item, i) in getTypeColor(allowTypes)"
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
              {{ props.field.name }}
            </span>
          </span>
          <span v-if="props.field?.options?.length > 0">
            限定值：
            <span class="allowValueVisible" @click="allowValueVisible = true"> 点击查看 </span>
          </span>
          <a-modal
            v-model:visible="allowValueVisible"
            :footer="false"
            body-style="padding: 6px 12px 6px 12px"
          >
            <template #title> 限定值 </template>
            <div class="allow-value-alert">
              <span>
                <span>
                  <icon-exclamation-polygon-fill />
                </span>
                如引用值不在限定值范围内，可能会出现异常
              </span>
              <span>
                <a-checkbox v-model="onlyValue">仅查看值</a-checkbox>
              </span>
            </div>
            <div class="allow-value">
              <a-textarea :model-value="allowValue" :auto-size="{ minRows: 10, maxRows: 20 }" />
            </div>
          </a-modal>
        </div>
        <a-input
          v-model="searchText"
          placeholder="搜索节点或者输出"
          allow-clear
          size="mini"
          class="param-search"
        >
          <template #prefix>
            <icon-search />
          </template>
        </a-input>
        <a-empty v-if="filterednodeParamsData.length === 0"> 工作流内没有可引用的节点输出 </a-empty>
        <a-tree
          v-else
          :data="filterednodeParamsData"
          :field-names="{
            key: 'id',
            title: 'name',
            children: 'children'
          }"
          @select="handleSelect"
          size="mini"
          :show-line="true"
          :auto-expand-parent="true"
        >
          <template #title="{ children, type, name }">
            <span class="param-tree-node">
              <span class="param-icon" v-if="children">
                <icon-common />
              </span>
              <a-popover v-if="!children">
                <svg class="param-type" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <path
                    v-for="(item, i) in getTypeColor(type)"
                    :key="i"
                    :d="item.d"
                    :fill="item.fill"
                  />
                  <circle cx="50" cy="50" r="30" fill="white" />
                </svg>
                <template #content>
                  <div
                    style="display: flex; align-items: center; gap: 4px"
                    v-for="(item, i) in getTypeColor(type)"
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
              <span class="param-name"> {{ name }}</span>
            </span>
          </template>
        </a-tree>
      </div>
    </template>
  </ModalPopover>
</template>

<script setup>
import { inject, computed, ref } from 'vue'
import {
  IconCommon,
  IconSearch,
  IconCodeBlock,
  IconExclamationPolygonFill
} from '@arco-design/web-vue/es/icon'
import { useFlowStore } from '../../../store'
import { getNodeParamsTreeData, getTypeColor, typeColor } from '../../../utils'
import ModalPopover from '../../ModalPopover.vue'
import fieldRenders from '../index.js'

import { useStore } from '@/store'
const { isMacOS } = useStore()
const workflowId = inject('workflowId')
const thisNodeId = inject('nodeId')
// 无 field 场景（如 workflowStart 薄壳）未 provide isPreview/isExecuting，容错为 false
const isPreview = inject('isPreview') || ref(false)
const isExecuting = inject('isExecuting') || ref(false)
const flowStore = useFlowStore(workflowId)
const visible = ref(false)

const props = defineProps({
  trigger: {
    type: String,
    default: 'click'
  },
  field: {
    type: Object,
    required: false,
    default: null
  },
  showTrigger: {
    type: Boolean,
    default: true
  },
  allTypes: {
    type: Boolean,
    default: false
  },
  // 选择输出格式：'text'（写入 {{fullName}} 文本，字段引用）| 'object'（输出节点对象，workflowStart 透传参数）
  outputFormat: {
    type: String,
    default: 'text'
  },
  // 数据源范围：'default'（同级节点，按允许类型过滤）| 'parentLevel'（父级同级节点，全类型，workflowStart 子流程场景）
  dataSourceMode: {
    type: String,
    default: 'default'
  },
  // 自定义标题文案（缺省用字段引用提示）
  headerText: {
    type: String,
    default: ''
  }
})

const nodeData = computed(() => {
  const node = flowStore.vueFlowRef.getNodes.find((n) => n.id === thisNodeId)
  return node?.data || {}
})
// 不可引用参数节点类型
const noRefNodes = ['workflowStart', 'workflowEnd']
const isAvailable = computed(() => {
  if (!props.field) return true
  return (
    props.field?.paramRef !== false &&
    !noRefNodes.includes(nodeData.value.type) &&
    !isPreview.value &&
    !isExecuting.value
  )
})

const allowValueVisible = ref(false)
const onlyValue = ref(false)
const allowValue = computed(() => {
  if (onlyValue.value) {
    return props.field.options.map((item) => item.value).toString()
  }
  return JSON.stringify(props.field.options, null, 2)
})
const allowTypes = computed(() => {
  let types = [fieldRenders.find((item) => item.name === props.field.type)?.dataType || 'string']
  if (props.field.multiple) {
    types = ['array']
  }
  return types
})

const nodeParamsData = computed(() => {
  const allNodes = flowStore.vueFlowRef.getNodes
  const thisNode = allNodes.find((node) => node.id === thisNodeId)
  if (props.dataSourceMode === 'parentLevel') {
    // 子流程场景：可引用父级同级节点的输出（workflowStart 透传参数）
    const thisParentNode = allNodes.find(
      (node) => node.id === thisNode?.parentNode?.replace('-subFlow', '')
    )
    if (!thisParentNode) return []
    return getNodeParamsTreeData(
      allNodes.filter(
        (node) => node.parentNode === thisParentNode.parentNode && node.id !== thisParentNode.id
      ),
      Object.keys(typeColor)
    )
  }
  const sameLevelNodes = allNodes.filter(
    (node) => node.parentNode === thisNode?.parentNode && node.id !== thisNodeId
  )
  //可引用参数节点为同级且不是当前节点
  return getNodeParamsTreeData(
    sameLevelNodes,
    props.allTypes ? ['string', 'number', 'boolean', 'array', 'object'] : allowTypes.value
  )
})

const searchText = ref('')
// 过滤树数据
const filterednodeParamsData = computed(() => {
  if (!searchText.value) return nodeParamsData.value
  const searchValue = searchText.value.toLowerCase()

  return nodeParamsData.value
    .map((node) => {
      const clonedNode = { ...node }
      clonedNode.children = node.children
        .map((child) => ({
          ...child
        }))
        .filter(
          (item) =>
            item.name.toLowerCase().includes(searchValue) ||
            item.fullName.toLowerCase().includes(searchValue)
        )
      return clonedNode
    })
    .filter((node) => node.children.length > 0)
})

const emits = defineEmits(['visible-change', 'onSelect'])
const handleVisibleChange = () => {
  emits('visible-change', visible.value)
}

// 选择参数时插入
function handleSelect(selectedKeys, { selectedNodes }) {
  if (selectedNodes[0].children) return
  if (props.outputFormat === 'object') {
    emits('onSelect', selectedNodes[0])
  } else {
    const paramText = `{{${selectedNodes[0].fullName}}}`
    emits('onSelect', paramText)
  }
  visible.value = false
}

const handleClick = () => {
  if (props.trigger !== 'click') return
  show(true)
}

const show = (isShow) => {
  if (isShow && !isAvailable.value) return
  visible.value = isShow
}

defineExpose({
  visible,
  show
})
</script>

<style lang="less" scoped>
.param-selector {
  width: 100%;
  &-header {
    font-size: 14px;
    font-weight: 800;
    color: #303133;
    margin-bottom: 4px;
  }
  .param-search {
    margin-bottom: 8px;
  }

  .param-tree-node {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .target {
    display: flex;
    padding: 2px 0px;
    border-radius: 4px;
    gap: 8px;
    font-size: 12px;
    color: var(--color-text-2);
    margin-bottom: 6px;
  }
  .allowValueVisible {
    color: #409eff;
    cursor: pointer;
  }
  .param-type {
    width: 8px;
    height: 8px;
  }
}

.allow-value-alert {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  background: var(--color-fill-2);
  padding: 4px 12px;
  border-radius: var(--border-radius-small);
}
.allow-value {
  user-select: text;
}
:deep(.arco-tree-node-title) {
  width: 100%;
}
</style>
