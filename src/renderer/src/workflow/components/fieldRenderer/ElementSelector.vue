<template>
  <div class="element-selector">
    <a-input-search
      :model-value="displayName"
      :placeholder="field?.placeholder || field?.description || '选择元素'"

      readonly
      :button-props="{ type: 'secondary', style: { width: '38px' } }"
      search-button
      @search="openModal"
    >
      <template #button-icon>
        <ri-stack-line size="14px" />
      </template>
    </a-input-search>

    <a-modal
      v-model:visible="showModal"
      title="元素选择器"
      :mask-closable="false"
      width="900px"
      :footer="false"
      @before-open="onModalOpen"
      @cancel="onModalCancel"
    >
      <div class="selector-layout">
        <div class="tree-panel">
          <div class="panel-header">元素集</div>
          <a-tree
            ref="treeRef"
            :data="treeData"
            :selected-keys="selectedKeys"
            :default-expanded-keys="expandedKeys"
            @select="onTreeSelect"
            :block-node="true"
          >
            <template #title="node">
              <span class="tree-node-title">{{ node.title }}</span>
            </template>
          </a-tree>
        </div>
        <div class="edit-panel">
          <div class="panel-header">
            <span>目标元素</span>
            <span v-if="hasSelected" class="panel-subtitle">{{ editingElement.name || '未命名元素' }}</span>
          </div>
          <div class="edit-body">
            <ElementItem v-if="hasSelected" v-model="editingElement" :show-remove="false" param-ref />
            <div v-else class="edit-empty">
              <RiStackLine size="28px" />
              <p>请从左侧选择一个元素</p>
            </div>
          </div>
          <div class="edit-footer">
            <a-button size="medium" @click="onModalCancel">取消</a-button>
            <a-button size="medium" type="primary" :disabled="!hasSelected" @click="onConfirm">确定</a-button>
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import ElementItem from '@/views/elementSet/components/ElementItem.vue'
import { RiStackLine } from '@remixicon/vue'

const { elementSet: elementSetAPI, category: categoryAPI } = window.electronAPI

defineProps({ field: { type: Object, required: true } })

const value = defineModel({ default: null })

const displayName = computed(() => value.value?.name || '')

const showModal = ref(false)
const hasSelected = ref(false)
const editingElement = ref(emptyElement())
const treeData = ref([])
const selectedKeys = ref([])
const expandedKeys = ref([])

function emptyElement() {
  return { _key: 1, name: '', match_condition: 'any', selectors: [] }
}

const openModal = () => {
  const d = value.value
  if (d?.selectors) {
    editingElement.value = {
      _key: 1,
      name: d.name || '',
      match_condition: d.match_condition || 'any',
      selectors: d.selectors.map((s, i) => ({ ...s, _key: i + 2, _sizeError: false }))
    }
    hasSelected.value = true
  } else {
    editingElement.value = emptyElement()
    hasSelected.value = false
  }
  showModal.value = true
}

const onModalCancel = () => { showModal.value = false }

const onModalOpen = async () => {
  try {
    const [cats, setsRes] = await Promise.all([
      categoryAPI.getCategories('elementSet').catch(() => []),
      elementSetAPI.getElementSets({ page: 1, pageSize: 1000 }).catch(() => ({ data: [] }))
    ])
    const sets = setsRes.data || []
    const catMap = new Map()
    const tree = [], expKeys = []

    for (const cat of (cats || [])) {
      const catNode = { title: cat.name, key: `cat:${cat.id}`, children: [] }
      catMap.set(cat.id, catNode)
      tree.push(catNode)
      expKeys.push(catNode.key)
    }

    const uncatSets = []
    for (const es of sets) {
      const setNode = { title: es.title, key: `set:${es.id}`, children: [], isLeaf: false, _setId: es.id }
      const parent = (es.category_id && catMap.get(es.category_id)) || null
      if (parent) parent.children.push(setNode)
      else uncatSets.push(setNode)
    }
    if (uncatSets.length) tree.push({ title: '未分类', key: 'cat:_uncat', children: uncatSets })

    for (const branch of tree) {
      for (const setNode of (branch.children || [])) {
        if (setNode._setId) {
          try {
            const full = await elementSetAPI.getElementSet(setNode._setId)
            if (full?.elements) {
              setNode.children = full.elements.map((el) => ({
                title: el.name || '(未命名)',
                key: `el:${el.id}`,
                isLeaf: true,
                _elementData: el
              }))
            }
          } catch { /* skip */ }
        }
      }
    }

    treeData.value = tree
    expandedKeys.value = expKeys
  } catch (e) {
    console.error('ElementSelector loadTree failed:', e)
  }
}
const treeRef = ref(null)
const onTreeSelect = (keys, { node }) => {
  if (!node?.isLeaf || !node?._elementData){
    treeRef.value?.expandNode(node.key,!node.isExpanded)
    node.isExpanded = !node.isExpanded
    return
  } 
  selectedKeys.value = keys
  hasSelected.value = true
  const el = node._elementData
  editingElement.value = {
    _key: 1,
    name: el.name || '',
    match_condition: el.match_condition || 'any',
    selectors: (el.selectors || []).map((s, i) => ({
      _key: i + 2, type: s.type, text_subtype: s.text_subtype || 'equals',
      expression: s.expression || '', _sizeError: false
    }))
  }
}

const onConfirm = () => {
  const el = editingElement.value
  if (!el.name || !el.name.trim()) {
    Message.warning('请输入元素名称')
    return
  }
  value.value = {
    name: el.name.trim() || '',
    match_condition: el.match_condition || 'any',
    selectors: (el.selectors || []).map((sel) => {
      const clean = { ...sel }
      delete clean._key
      delete clean._sizeError
      return clean
    })
  }
  showModal.value = false
}
</script>

<style lang="less" scoped>
.element-selector {
  width: 100%;
  :deep(.arco-input-group) {
    .arco-btn { height: 100%; padding: 0 8px; }
  }
}

.selector-layout {
  display: flex;
  height: 62vh;
  min-height: 440px;
  gap: 10px;
}

.tree-panel,
.edit-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 10px;
  background: rgba(120, 120, 128, 0.06);
  border: 0.5px solid var(--mac-separator);
  border-radius: var(--mac-radius-md);
}

.tree-panel {
  width: 264px;
  flex-shrink: 0;
  :deep(.arco-tree) {
    flex: 1;
    min-height: 0;
    overflow: auto;
    background: transparent;
    padding: 2px 0;
  }
}

.edit-panel {
  flex: 1;
  min-width: 0;
  .edit-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 2px;
  }
  .edit-empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--mac-text-3);
    font-size: 13px;
    svg { color: var(--mac-text-4); }
    p { margin: 0; }
  }
  .edit-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 12px;
    margin-top: 10px;
    border-top: 0.5px solid var(--mac-separator);
  }
}

.panel-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--mac-text);
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 0.5px solid var(--mac-separator);
  .panel-subtitle {
    font-size: 12px;
    font-weight: 400;
    color: var(--mac-text-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.tree-node-title {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
