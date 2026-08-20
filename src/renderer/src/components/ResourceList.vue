<template>
  <div class="resource-list">
    <Category :type="type" @change="handleCategoryChange" />
    <div class="resource-content">
      <!-- 顶部操作栏 -->
      <div class="operation-bar">
        <a-space>
          <a-button type="primary" @click="emit('create')">
            <template #icon><icon-plus /></template>
            {{ createLabel }}
          </a-button>
          <a-button @click="emit('import')">
            <template #icon><icon-import /></template>
            导入{{ typeLabel }}
          </a-button>
          <a-button @click="emit('refresh')" :loading="loading">
            <template #icon><icon-refresh /></template>
            刷新
          </a-button>
          <slot name="extra-actions" />
          <a-input
            :model-value="searchKeyword"
            @update:model-value="emit('update:searchKeyword', $event)"
            :placeholder="searchPlaceholder"
            style="width: 300px"
            allow-clear
          >
            <template #prefix><icon-search /></template>
          </a-input>
        </a-space>
      </div>

      <!-- 多选工具栏：有选中项时显示 -->
      <div v-if="selectedIds.length > 0" class="selection-bar">
        <a-space>
          <span class="selection-count">已选 {{ selectedIds.length }} 项</span>
          <a-checkbox
            :model-value="isAllSelected"
            :indeterminate="selectedIds.length > 0 && !isAllSelected"
            @change="handleSelectAll"
          >
            {{ isAllSelected ? '取消全选' : '全选' }}
          </a-checkbox>
          <a-button size="small" type="primary" @click="handleBatchExport">
            <template #icon><icon-export /></template>
            批量导出
          </a-button>
          <a-popconfirm
            content="确定将选中的项移入回收站？"
            ok-text="移入回收站"
            cancel-text="取消"
            @ok="handleBatchDelete"
          >
            <a-button size="small" status="danger">移入回收站</a-button>
          </a-popconfirm>
        </a-space>
      </div>

      <!-- 卡片列表 -->
      <a-spin :loading="loading" tip="加载中..." class="item-list scrollbar" @scroll="handleScroll">
        <div v-if="items.length === 0" class="empty-wrapper">
          <a-empty>
            <p class="empty-text">
              <template v-if="searchKeyword">
                未找到"
                <span class="keyword">{{ searchKeyword }}</span>
                "相关的{{ typeLabel }}
              </template>
              <template v-else>{{ emptyText }}</template>
            </p>
          </a-empty>
        </div>

        <a-row :gutter="8">
          <a-col
            :xs="{ span: 24 }"
            :sm="{ span: 12 }"
            :md="{ span: 12 }"
            :lg="{ span: 8 }"
            :xl="{ span: 8 }"
            :xxl="{ span: 6 }"
            v-for="(item, index) in items"
            :key="item.id"
          >
            <div
              class="card-wrapper"
              :class="{ 'is-selected': isSelected(item.id) }"
              @mouseenter="hoveredId = item.id"
              @mouseleave="hoveredId = null"
              @dblclick="emit('edit', item)"
            >
              <a-checkbox
                v-show="hoveredId === item.id || isSelected(item.id)"
                class="card-checkbox"
                :model-value="isSelected(item.id)"
                @change="(checked) => toggleSelect(item.id, checked)"
                @click.stop
              />
              <slot name="card" :item="item" :index="index" />
            </div>
          </a-col>
        </a-row>
        <LoadMoreState v-if="items.length > 0" :has-more="hasMore" />
      </a-spin>
    </div>
  </div>
</template>

<script setup>
  import { ref, computed } from 'vue';
  import { IconPlus, IconImport, IconRefresh, IconSearch, IconExport } from '@arco-design/web-vue/es/icon';
  import Category from '@/components/Category.vue';
  import LoadMoreState from '@/components/LoadMoreState.vue';

  const props = defineProps({
    type: { type: String, required: true },
    createLabel: { type: String, default: '新建' },
    searchPlaceholder: { type: String, default: '搜索' },
    emptyText: { type: String, default: '暂无数据' },
    items: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    hasMore: { type: Boolean, default: true },
    searchKeyword: { type: String, default: '' },
  });

  const emit = defineEmits([
    'create',
    'import',
    'refresh',
    'edit',
    'categoryChange',
    'scroll',
    'update:searchKeyword',
    'batchDelete',
    'batchExport',
  ]);

  // 多选：选中 id 列表（当前已加载卡片）
  const selectedIds = defineModel('selectedIds', { default: () => [] });
  const hoveredId = ref(null);

  const typeLabel = computed(() => {
    const map = { workflow: '工作流', model: '数据表', browser: '浏览器', elementSet: '元素集' };
    return map[props.type] || '';
  });

  const isSelected = (id) => selectedIds.value.includes(id);

  const toggleSelect = (id, checked) => {
    if (checked) {
      if (!selectedIds.value.includes(id)) selectedIds.value = [...selectedIds.value, id];
    } else {
      selectedIds.value = selectedIds.value.filter((x) => x !== id);
    }
  };

  // 全选（作用于当前已加载的卡片）
  const isAllSelected = computed(
    () => props.items.length > 0 && props.items.every((i) => selectedIds.value.includes(i.id))
  );

  const handleSelectAll = (checked) => {
    const ids = new Set(props.items.map((i) => i.id));
    if (checked) {
      const cur = new Set(selectedIds.value);
      ids.forEach((id) => cur.add(id));
      selectedIds.value = [...cur];
    } else {
      selectedIds.value = selectedIds.value.filter((id) => !ids.has(id));
    }
  };

  const handleBatchDelete = () => {
    emit('batchDelete', [...selectedIds.value]);
  };

  const handleBatchExport = () => {
    emit('batchExport', [...selectedIds.value]);
  };

  const handleCategoryChange = (val) => {
    emit('categoryChange', val === 'all' ? '' : val);
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop >= scrollHeight - clientHeight && props.hasMore && !props.loading) {
      emit('scroll');
    }
  };
</script>

<style lang="less" scoped>
  .resource-list {
    display: flex;
    height: 100%;

    .resource-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .operation-bar {
      padding: 16px 16px 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .selection-bar {
      padding: 0 16px 8px 16px;

      .selection-count {
        color: var(--color-text-2);
        font-size: 13px;
      }
    }

    .item-list {
      flex: 1;
      min-height: 200px;
      overflow-y: auto;
      padding: 4px 16px 16px 16px;

      .empty-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 400px;
        background-color: var(--color-bg-2);
        border-radius: var(--border-radius-small);
        border: 1px dashed var(--color-border-2);
      }
    }

    .card-wrapper {
      position: relative;

      .card-checkbox {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 10;
      }

      &.is-selected {
        :deep(.arco-card) {
          border-color: #000;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
        }
      }
    }
  }
</style>
