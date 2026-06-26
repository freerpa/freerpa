<template>
  <div class="category">
    <div class="category-header">
      <div class="title">{{ title }}分类</div>
      <a-popover
        position="bottom"
        trigger="click"
        v-model:popup-visible="addPopoverVisible"
        @popup-visible-change="handleAddPopoverVisibleChange"
      >
        <a-button type="text">
          <template #icon><icon-plus /></template>
        </a-button>
        <template #content>
          <a-input-search
            ref="addCategoryInput"
            placeholder="请输入分类名称"
            v-model="categoryName"
            search-button
            :loading="loading"
            @search="handleAddCategory"
            @press-enter="handleAddCategory"
          >
            <template #button-icon>
              <icon-check />
            </template>
          </a-input-search>
        </template>
      </a-popover>
    </div>
    <a-scrollbar style="height: calc(100vh - 116px); overflow: auto">
      <a-menu v-model:selectedKeys="selectedKeys" class="workflow-cate-menu">
        <a-menu-item key="all">全部</a-menu-item>
        <a-menu-item v-for="item in categoryList" :key="item.id" :title="item.name">
          <div class="category-item">
            <span>{{ item.name }}</span>
            <icon-settings @click.stop="handleActionSelect(item)" class="action" />
          </div>
        </a-menu-item>
      </a-menu>
    </a-scrollbar>
    <a-modal
      v-model:visible="actionVisible"
      :title="title"
      :footer="null"
      @before-close="((categoryId = ''), (categoryName = ''))"
      width="300px"
    >
      <template #title>编辑分类</template>
      <a-input
        v-model="categoryName"
        allow-clear
        @press-enter="handleAddCategory"
        placeholder="请输入分类名称"
        :disabled="loading"
      />
      <div class="category-edit-footer">
        <a-popconfirm content="确认删除?" @ok="handleDelete">
          <a-button type="primary" status="danger" :loading="loading"> 删除分类 </a-button>
        </a-popconfirm>
        <a-button type="primary" @click="handleAddCategory" :loading="loading">保存分类</a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import { IconPlus, IconCheck, IconSettings } from '@arco-design/web-vue/es/icon'
import { addCategory, getCategoryList, updateCategory, deleteCategory } from '@/api/category'
const props = defineProps({
  type: {
    type: String,
    default: 'workflow'
  }
})

const emits = defineEmits(['change'])

watch(
  () => props.type,
  async () => {
    await _getCategoryList()
  }
)

const title = computed(() => {
  if (props.type === 'workflow') {
    return '工作流'
  } else if (props.type === 'model') {
    return '模型'
  } else if (props.type === 'environment') {
    return '浏览器'
  }
})

const categoryList = ref([])
const _getCategoryList = async () => {
  const res = await getCategoryList(props.type)
  categoryList.value = res
}

onMounted(() => {
  _getCategoryList()
})

const selectedKeys = ref(['all'])

const addPopoverVisible = ref(false)
const categoryName = ref('')
const categoryId = ref('')
const loading = ref(false)
const handleAddCategory = async () => {
  if (!categoryName.value) {
    return
  }
  loading.value = true
  if (categoryId.value) {
    await updateCategory(categoryId.value, categoryName.value)
  } else {
    await addCategory(props.type, categoryName.value)
  }
  categoryName.value = ''
  categoryId.value = ''
  _getCategoryList()
  loading.value = false
  addPopoverVisible.value = false
  actionVisible.value = false
}

const handleDelete = async () => {
  if (!categoryId.value) {
    return
  }
  loading.value = true
  await deleteCategory(categoryId.value)
  _getCategoryList()
  if (selectedKeys.value[0] === categoryId.value) {
    selectedKeys.value = ['all']
  }
  loading.value = false
  actionVisible.value = false
}

watch(
  () => selectedKeys.value,
  (newVal) => {
    emits('change', newVal[0])
  }
)

const addCategoryInput = ref(null)
const handleAddPopoverVisibleChange = (visible) => {
  if (visible) {
    nextTick(() => {
      addCategoryInput.value.focus()
    })
  }
}
const actionVisible = ref(false)
const handleActionSelect = (item) => {
  actionVisible.value = true
  categoryId.value = item.id
  categoryName.value = item.name
}
</script>

<style lang="less" scoped>
.category {
  flex-shrink: 0;
  width: 200px;
  height: 100%;
  border-right: 1px solid var(--color-border);
  &-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 11px 12px 10px;
    .title {
      font-size: 18px;
      font-weight: bold;
    }
  }
  .category-item {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .action {
      margin: 0px;
      color: var(--color-primary) !important;
      &:hover {
        color: var(--color-primary);
      }
    }
  }
}

.category-edit-footer {
  margin-top: 16px;
  display: flex;
  width: 100%;
  justify-content: center;
  gap: 8px;
  .arco-btn {
    width: 160px;
  }
}
</style>
