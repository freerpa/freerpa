<template>
  <div class="category-select">
    <a-dropdown trigger="hover" @select="handleSelectStoreCategory">
      <span style="cursor: pointer">
        {{ categoryList.find((item) => item.id === modelValue)?.name || '全部' }}
        <icon-down />
      </span>
      <template #content>
        <a-doption value="">全部</a-doption>
        <a-doption v-for="item of categoryList" :key="item.id" :value="item.id">
          {{ item.name }}
        </a-doption>
      </template>
    </a-dropdown>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { IconDown } from '@arco-design/web-vue/lib/icon'

const { category: categoryAPI } = window.electronAPI
const modelValue = defineModel({
  type: String,
  default: ''
})

const props = defineProps({
  type: {
    type: String,
    default: 'workflow'
  }
})

const handleSelectStoreCategory = (value) => {
  modelValue.value = value
  emits('change', value)
}

const emits = defineEmits(['change'])

const categoryList = ref([])
const _getCategoryList = async () => {
  try {
    if (!window.electronAPI?.category) {
      console.error('[CategorySelect] electronAPI.category not available')
      return
    }
    const res = await categoryAPI.getCategories(props.type)
    categoryList.value = res || []
  } catch (e) {
    console.error('[CategorySelect] getCategories failed:', e)
    categoryList.value = []
  }
  isCategoryExist()
}

//判断当前选择的分类是否存在
const isCategoryExist = () => {
  if (!categoryList.value.find((item) => item.id === modelValue.value)) {
    modelValue.value = ''
  }
}

onMounted(async () => {
  await _getCategoryList()
  watch(
    () => modelValue.value,
    (val) => {
      isCategoryExist()
    }
  )
})
</script>

<style lang="less" scoped>
.category-select {
  width: 100%;
}
</style>
