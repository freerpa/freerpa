<template>
  <div class="element-selector">
    <a-input-search
      :model-value="displayName"
      :placeholder="field?.placeholder || field?.description || '选择元素'"
      size="mini"
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
          <div class="panel-header">目标元素</div>
          <div class="edit-body">
            <ElementItem v-model="editingElement" :show-remove="false" />
          </div>
          <div class="edit-footer">
            <a-button @click="onModalCancel">取消</a-button>
            <a-button type="primary" @click="onConfirm">确定</a-button>
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
  } else {
    editingElement.value = emptyElement()
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

const onTreeSelect = (keys, { node }) => {
  if (!node?.isLeaf || !node?._elementData) return
  selectedKeys.value = keys
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
    name: el.name,
    match_condition: el.match_condition || 'any',
    selectors: (el.selectors || []).map(({ _key, _sizeError, ...rest }) => rest)
  }
  showModal.value = false
}
</script>

<style lang="less" scoped>
.element-selector {
  width: 100%;
  :deep(.arco-input-group) {
    .arco-btn { border-radius: 0; height: 100%; padding: 0 8px; }
  }
}
.icon { width: 1em; height: 1em; }
.selector-layout { display: flex; height: 55vh; min-height: 400px; gap: 0; }
.tree-panel {
  width: 260px; flex-shrink: 0; border-right: 1px solid var(--color-border-2); padding-right: 12px;
  display: flex; flex-direction: column;
  .panel-header { font-weight: 600; font-size: 14px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--color-border-2); }
}
.edit-panel {
  flex: 1; padding-left: 16px; display: flex; flex-direction: column;
  .panel-header { font-weight: 600; font-size: 14px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--color-border-2); }
  .edit-body { flex: 1; overflow-y: auto; padding: 4px 0; }
  .edit-footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 12px; border-top: 1px solid var(--color-border-2); margin-top: 8px; }
}
.tree-node-title { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
