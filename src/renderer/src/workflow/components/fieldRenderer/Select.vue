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
import { watch, inject, onMounted } from 'vue'
import { debounce } from 'lodash-es'
import { unDoReDoInterceptor } from '@/workflow/utils'
import { useFieldWatch } from './composables/useFieldValue'
import { useRemoteOptions } from './composables/useRemoteOptions'

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const formData = inject('formData')
const value = defineModel()
useFieldWatch(props, value)
// 远程加载统一（useRemoteOptions）；Select 的静态 options 支持 async 函数，由 resolveOptions 处理
const { loading, options, loadOptions: loadRemote } = useRemoteOptions(props.field, (kw) => kw, formData.value)

// 解析 options：支持数组、async 函数
const resolveOptions = async (rawOptions) => {
  if (typeof rawOptions === 'function') {
    try {
      options.value = await rawOptions()
    } catch {
      options.value = []
    }
  } else {
    options.value = rawOptions || []
  }
}

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
    await resolveOptions(props.field.options)
    return
  }
  try {
    loading.value = true
    const result = await props.field.remoteMethod(keyword, formData.value)
    options.value = result || []
  } finally {
    loading.value = false
  }
}

// 组件挂载时自动加载选项（静态：resolveOptions；远程：useRemoteOptions 的 loadRemote）
onMounted(() => {
  if (!props.field.remote || typeof props.field.remoteMethod !== 'function') {
    resolveOptions(props.field.options).then(() => valueValid())
  } else {
    loadRemote().then(() => valueValid())
  }
})

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

</script>
