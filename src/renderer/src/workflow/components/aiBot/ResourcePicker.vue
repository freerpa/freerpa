<template>
  <div class="resource-picker" @click.stop>
    <!-- 顶部：搜索框 -->
    <div class="rp-head">
      <div class="rp-search">
        <RiSearchLine :size="12" class="rp-search__icon" />
        <input v-model="keyword" :placeholder="'搜索' + title" />
      </div>
    </div>

    <!-- 列表 -->
    <div class="rp-list">
      <div
        v-for="item in filtered"
        :key="item.id"
        class="rp-item"
        @click="emit('pick', item)"
      >
        <slot name="icon" :item="item"><RiFileLine :size="12" /></slot>
        <span class="rp-item__name">{{ item[props.nameKey] }}</span>
      </div>
      <div v-if="filtered.length === 0" class="rp-empty">暂无{{ title }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RiSearchLine, RiFileLine } from '@remixicon/vue'

const props = defineProps({
  /** 菜单标题（搜索框 placeholder / 空态提示） */
  title: {
    type: String,
    default: '列表'
  },
  /** 列表加载函数：() => Promise<Array<{ id, name }>> */
  loader: {
    type: Function,
    required: true
  },
  /** 名称字段名（元素集等用 title） */
  nameKey: {
    type: String,
    default: 'name'
  }
})

const emit = defineEmits(['pick'])

const items = ref([])
const keyword = ref('')

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return items.value
  return items.value.filter((i) => (i[props.nameKey] || '').toLowerCase().includes(kw))
})

const load = async () => {
  try {
    const res = await props.loader()
    items.value = Array.isArray(res) ? res : []
  } catch (error) {
    console.error(`加载${props.title}列表失败:`, error)
    items.value = []
  }
}

onMounted(() => load())
</script>

<style scoped lang="less">
.resource-picker {
  background: #fff;
  border: 1px solid #e5e5e8;
  border-radius: var(--border-radius-small);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  overflow: hidden;

  .rp-head {
    padding: 8px;
    border-bottom: 1px solid #e5e5e8;

    .rp-search {
      position: relative;
      .rp-search__icon {
        position: absolute;
        left: 8px;
        top: 50%;
        transform: translateY(-50%);
        color: #6b7280;
      }
      input {
        width: 100%;
        background: #f7f7f8;
        border: 1px solid #e5e5e8;
        border-radius: var(--border-radius-small);
        padding: 5px 8px 5px 24px;
        font-size: 12px;
        outline: none;
        &:focus { border-color: #d1d5db; }
      }
    }
  }

  .rp-list {
    max-height: 224px;
    overflow-y: auto;
    padding: 4px;
  }

  .rp-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: var(--border-radius-small);
    font-size: 13px;
    color: #111114;
    cursor: pointer;
    &:hover { background: #f7f7f8; }
    :deep(svg) {
      flex-shrink: 0;
      color: #111114;
    }
    .rp-item__name {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .rp-empty {
    padding: 16px 8px;
    text-align: center;
    font-size: 12px;
    color: #9ca3af;
  }
}
</style>
