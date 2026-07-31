<template>
  <ModalPopover
    trigger="none"
    trigger-style="width: 100%"
    ref="modalPopoverRef"
    v-model:visible="visible"
    @visible-change="handleVisibleChange"
  >
    <div @click="handleClick"><slot></slot></div>
    <template #content>
      <div class="param-selector">
        <div class="param-selector-header">
          <span>快速创建父级节点输出引用</span>
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
  IconQuestionCircle,
  IconCodeBlock,
  IconExclamationPolygonFill
} from '@arco-design/web-vue/es/icon'
import { useFlowStore } from '../../../store'
import { getNodeParamsTreeData, getTypeColor, typeColor } from '../../../utils'
import ModalPopover from '../../../components/ModalPopover.vue'
const workflowId = inject('workflowId')
const thisNodeId = inject('nodeId')
const flowStore = useFlowStore(workflowId)
const visible = ref(false)

const props = defineProps({
  trigger: {
    type: String,
    default: 'click'
  }
})

const nodeParamsData = computed(() => {
  const allNodes = flowStore.vueFlowRef.getNodes
  const thisNode = allNodes.find((node) => node.id === thisNodeId)
  const thisParentNode = allNodes.find(
    (node) => node.id === thisNode.parentNode.replace('-subFlow', '')
  )
  //可引用参数节点为同级且不是当前节点
  return getNodeParamsTreeData(
    allNodes.filter(
      (node) => node.parentNode === thisParentNode.parentNode && node.id !== thisParentNode.id
    ),
    Object.keys(typeColor)
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
  emits('onSelect', selectedNodes[0])
  visible.value = false
}

const handleClick = () => {
  if (props.trigger !== 'click') return
  show(true)
}

const show = (isShow) => {
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
