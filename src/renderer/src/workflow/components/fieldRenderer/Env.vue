<template>
  <a-select
    v-model="value"
    :placeholder="field.description"
    :loading="loading"
    :disabled="field.disabled"
    :multiple="field.multiple"
    allow-search
    allow-clear
    :options="options"
    filter-option
    @input-value-change="handleSearch"
    @keydown="unDoReDoInterceptor"
    @keyup="unDoReDoInterceptor"
    @click.stop="loadOptions()"
    :max-tag-count="3"
  >
    <template #header v-if="field.multiple">
      <div style="padding: 6px 12px">
        <a-checkbox value="1" @change="handleCheckAll">
          全选 ({{ value.length }}/{{ options.length }})
        </a-checkbox>
      </div>
    </template>
  </a-select>
</template>

<script setup>
import { ref, watch } from 'vue'
import { debounce } from 'lodash-es'
import { unDoReDoInterceptor } from '@/workflow/utils'
import { useFieldWatch } from './composables/useFieldValue'
import { useStore } from '@/store'
const { getEnvList } = useStore()

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const value = defineModel()
useFieldWatch(props, value)
const loading = ref(false)
const options = ref([])
// 全选/取消全选
const handleCheckAll = (checked) => {
  if (checked) {
    value.value = options.value.map((opt) => opt.value)
  } else {
    value.value = []
  }
}

const loadOptions = async (keyword = '') => {
  // 通过网络api获取浏览器列表
  const result = await getEnvList(keyword)
  options.value = result.map((env) => ({
    label: env.name,
    value: env.id
  }))
}

loadOptions()
const valueValid = debounce(() => {
  if (props.field.multiple) {
    value.value = value.value.filter((item) => options.value.some((opt) => opt.value === item))
  } else {
    value.value = options.value.find((opt) => opt.value === value.value) ? value.value : ''
  }
}, 300)

// 监听选项变化
watch(
  () => options.value,
  () => {
    valueValid()
  }
)

// 远程搜索
const handleSearch = debounce(async (searchValue) => {
  if (!props.field.remote || !props.field.remoteMethod) return
  await loadOptions(searchValue)
  valueValid()
}, 300)

</script>
