<template>
  <a-select
    v-model="value"
    :placeholder="field.description"
    :loading="loading"
    :disabled="field.disabled"
    :multiple="field.multiple"
    allow-search
    :options="options"
    :filter-option="field.remote ? false : undefined"
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
import { ref, watch, inject } from 'vue'
import { debounce } from 'lodash-es'
import { unDoReDoInterceptor } from '@/workflow/utils'

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const formData = inject('formData')
const value = defineModel()
const loading = ref(false)
const options = ref(props.field.options || [])

// 全选/取消全选
const handleCheckAll = (checked) => {
  if (checked) {
    value.value = options.value.map((opt) => opt.value)
  } else {
    value.value = []
  }
}

const loadOptions = async (keyword = '') => {
  if (!props.field.remote || !props.field.remoteMethod) {
    options.value = props.field.options || []
    return
  }
  try {
    loading.value = true
    const result = await props.field.remoteMethod(keyword, formData)
    options.value = result || []
  } finally {
    loading.value = false
  }
}

// 远程加载选项
if (props.field.remote) {
  loadOptions().then(() => valueValid())
}

const valueValid = debounce(() => {
  if (props.field.multiple) {
    value.value = value.value.filter((item) => options.value.some((opt) => opt.value === item))
  } else {
    value.value = options.value.find((opt) => opt.value === value.value) ? value.value : ''
  }
}, 300)

// 监听选项变化
watch(
  () => options,
  () => {
    valueValid()
  },
  { deep: true }
)

// 监听选项方法变化
watch(
  () => props.field.remoteMethod,
  () => {
    loadOptions().then(() => valueValid())
  }
)

// 监听选项变化
watch(
  () => props.field.options,
  () => {
    loadOptions().then(() => valueValid())
  }
)

// 远程搜索
const handleSearch = debounce(async (searchValue) => {
  if (!props.field.remote || !props.field.remoteMethod) return
  await loadOptions(searchValue)
  valueValid()
}, 300)

// 值变化时触发onChange
watch(value, (newVal) => {
  if (props.field.onChange) {
    props.field.onChange(newVal, formData)
  }
})
</script>
