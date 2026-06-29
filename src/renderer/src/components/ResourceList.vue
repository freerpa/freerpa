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

      <!-- 卡片列表 -->
      <a-spin :loading="loading" tip="加载中..." class="item-list scrollbar" @scroll="handleScroll">
        <div v-if="items.length === 0" class="empty-wrapper">
          <a-empty>
            <p class="empty-text">
              <template v-if="searchKeyword">
                未找到"<span class="keyword">{{ searchKeyword }}</span>"相关的{{ typeLabel }}
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
            @dblclick="emit('edit', item)"
          >
            <slot name="card" :item="item" :index="index" />
          </a-col>
        </a-row>
        <LoadMoreState v-if="items.length > 0" :has-more="hasMore" />
      </a-spin>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { IconPlus, IconImport, IconRefresh, IconSearch } from '@arco-design/web-vue/es/icon'
import Category from '@/components/Category.vue'
import LoadMoreState from '@/components/LoadMoreState.vue'

const props = defineProps({
  type: { type: String, required: true },
  createLabel: { type: String, default: '新建' },
  searchPlaceholder: { type: String, default: '搜索' },
  emptyText: { type: String, default: '暂无数据' },
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: true },
  searchKeyword: { type: String, default: '' }
})

const emit = defineEmits(['create', 'import', 'refresh', 'edit', 'categoryChange', 'scroll', 'update:searchKeyword'])

const typeLabel = computed(() => {
  const map = { workflow: '工作流', model: '数据表', environment: '浏览器' }
  return map[props.type] || ''
})

const handleCategoryChange = (val) => {
  emit('categoryChange', val === 'all' ? '' : val)
}

const handleScroll = (e) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target
  if (scrollTop >= scrollHeight - clientHeight && props.hasMore && !props.loading) {
    emit('scroll')
  }
}
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
}
</style>
