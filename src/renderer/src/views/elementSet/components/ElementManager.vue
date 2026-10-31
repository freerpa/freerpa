<template>
  <a-modal
    v-model:visible="visible"
    title="元素管理"
    :footer="false"
    :mask-closable="false"
    unmount-on-close
    width="880px"
  >
    <div class="manager">
      <div class="manager-toolbar">
        <a-input v-model="keyword" placeholder="搜索元素名称" allow-clear class="search">
          <template #prefix><icon-search /></template>
        </a-input>
        <a-button type="primary" @click="openCreate">
          <template #icon><icon-plus /></template>
          添加元素
        </a-button>
      </div>

      <a-table
        class="element-table"
        :data="filtered"
        :loading="loading"
        :bordered="false"
        :pagination="false"
        :scroll="{ y: 420 }"
        row-key="_key"
        size="medium"
      >
        <template #columns>
          <a-table-column title="元素名称" data-index="name" :ellipsis="true" :tooltip="true" />
          <a-table-column title="匹配模式" :width="110">
            <template #cell="{ record }">
              <a-tag size="small" :color="record.match_condition === 'all' ? 'arcoblue' : 'gray'">
                {{ record.match_condition === 'all' ? '全部匹配' : '任一匹配' }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="选择器" :width="190">
            <template #cell="{ record }">
              <span class="selector-summary">{{ selectorSummary(record) }}</span>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="96" align="right">
            <template #cell="{ record }">
              <a-space :size="2">
                <a-button type="text" size="medium" @click="openEdit(record)">
                  <template #icon><icon-edit /></template>
                </a-button>
                <a-button type="text" size="medium" status="danger" @click="remove(record)">
                  <template #icon><icon-delete /></template>
                </a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
        <template #empty>
          <a-empty description="暂无元素，点击右上角「添加元素」开始创建" />
        </template>
      </a-table>

      <div class="manager-footer">
        <span class="manager-count">共 {{ elements.length }} 个元素</span>
        <a-space :size="8">
          <a-button @click="visible = false">取消</a-button>
          <a-button type="primary" :loading="saving" @click="save">保存</a-button>
        </a-space>
      </div>
    </div>
  </a-modal>

  <a-modal
    v-model:visible="editVisible"
    :title="isNew ? '添加元素' : '编辑元素'"
    :footer="false"
    :mask-closable="false"
    unmount-on-close
    width="720px"
    :body-style="{ maxHeight: '60vh', overflow: 'auto' }"
  >
    <ElementItem v-if="editVisible" v-model="draft" :show-remove="false" />
    <div class="edit-actions">
      <a-button @click="editVisible = false">取消</a-button>
      <a-button type="primary" @click="saveDraft">保存</a-button>
    </div>
  </a-modal>
</template>

<script setup>
  import { computed, ref, watch } from 'vue';
  import { Message } from '@arco-design/web-vue';
  import { IconSearch, IconPlus, IconEdit, IconDelete } from '@arco-design/web-vue/es/icon';
  import ElementItem from './ElementItem.vue';

  const { elementSet: elementSetAPI } = window.electronAPI;

  const props = defineProps({
    modelId: { type: [String, Number] },
  });

  const visible = defineModel('visible', { type: Boolean, default: false });
  const emit = defineEmits(['success']);

  const elements = ref([]);
  const keyword = ref('');
  const loading = ref(false);
  const saving = ref(false);
  const editVisible = ref(false);
  const isNew = ref(false);
  const editIndex = ref(-1);
  const draft = ref(null);
  let keyCounter = 10000;
  const nextKey = () => ++keyCounter;

  const filtered = computed(() => {
    const kw = keyword.value.trim();
    if (!kw) return elements.value;
    return elements.value.filter((el) => (el.name || '').includes(kw));
  });

  const selectorSummary = (record) => {
    const list = record.selectors || [];
    if (!list.length) return '—';
    const labels = { css: 'CSS', xpath: 'XPath', image: '截图', text: '文本', position: '坐标' };
    const types = [...new Set(list.map((s) => labels[s.type] || s.type))];
    return `${list.length} 个 · ${types.join(' / ')}`;
  };

  const cloneElement = (el) => ({
    _key: el._key ?? nextKey(),
    name: el.name || '',
    match_condition: el.match_condition || 'any',
    selectors: (el.selectors || []).map((s) => ({
      _key: s._key ?? nextKey(),
      type: s.type || 'css',
      text_subtype: s.text_subtype || '',
      expression: s.expression || '',
    })),
  });

  // 打开时加载该元素集的完整元素列表
  watch(visible, async (val) => {
    if (!val) return;
    keyword.value = '';
    editVisible.value = false;
    keyCounter = 10000;
    loading.value = true;
    try {
      const data = await elementSetAPI.getElementSet(props.modelId);
      elements.value = (data.elements || []).map(cloneElement);
    } catch {
      elements.value = [];
      Message.error('获取元素列表失败');
    } finally {
      loading.value = false;
    }
  });

  const openCreate = () => {
    isNew.value = true;
    editIndex.value = -1;
    draft.value = {
      _key: nextKey(),
      name: '',
      match_condition: 'any',
      selectors: [{ _key: nextKey(), type: 'css', text_subtype: '', expression: '' }],
    };
    editVisible.value = true;
  };

  const openEdit = (record) => {
    isNew.value = false;
    editIndex.value = elements.value.findIndex((el) => el._key === record._key);
    draft.value = cloneElement(record);
    editVisible.value = true;
  };

  const saveDraft = () => {
    const value = draft.value;
    if (!value || !value.name || !value.name.trim()) {
      Message.error('请填写元素名称');
      return;
    }
    value.name = value.name.trim();
    if (isNew.value) {
      elements.value.push(value);
    } else if (editIndex.value > -1) {
      elements.value.splice(editIndex.value, 1, value);
    }
    editVisible.value = false;
  };

  const remove = (record) => {
    const index = elements.value.findIndex((el) => el._key === record._key);
    if (index > -1) elements.value.splice(index, 1);
  };

  const save = async () => {
    // 搜索过滤时也要校验全部元素
    const invalid = elements.value.find((el) => !el.name || !el.name.trim());
    if (invalid) {
      keyword.value = '';
      Message.error('请填写所有元素的名称');
      return;
    }
    saving.value = true;
    try {
      const payload = elements.value.map((el) => {
        const rest = { ...el };
        delete rest._key;
        return {
          ...rest,
          selectors: (rest.selectors || []).map((sel) => {
            const clean = { ...sel };
            delete clean._key;
            delete clean._sizeError;
            return clean;
          }),
        };
      });
      await elementSetAPI.updateElementSet({ id: props.modelId, elements: payload });
      Message.success('元素已保存');
      emit('success');
      visible.value = false;
    } catch (e) {
      Message.error(e.message || '保存失败');
    } finally {
      saving.value = false;
    }
  };
</script>

<style lang="less" scoped>
  .manager-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;

    .search {
      width: 280px;
    }
  }

  .element-table {
    :deep(.arco-table-container) {
      border: var(--mac-hairline) solid var(--mac-separator);
    }
  }

  .selector-summary {
    color: var(--mac-text-3);
    font-size: 12px;
  }

  .manager-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 14px;

    .manager-count {
      font-size: 12px;
      color: var(--mac-text-3);
    }
  }

  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }
</style>
