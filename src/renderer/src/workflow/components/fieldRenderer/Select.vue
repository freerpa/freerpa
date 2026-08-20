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
import { ref, watch, inject, onMounted } from 'vue'
import axios from 'axios'
import { debounce, get } from 'lodash-es'
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
const { loading, options, loadOptions: loadRemote } = useRemoteOptions(props.field, (kw) => kw, formData)

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

// remoteRules 远程调用：通过 方法/地址/头/体/数据路径/标签/值 获取选项
// rules: { method, address, headers, body, dataPath, label, value }
// 地址/头/体中的字符串支持 {keyword} 占位符拼接搜索词
const loadRemoteRules = async (keyword = '') => {
  const rules = props.field.remoteRules || {}
  if (!rules.address) return
  const fill = (input) => {
    if (typeof input === 'string') return input.replaceAll('{keyword}', keyword)
    if (Array.isArray(input)) return input.map(fill)
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, fill(v)]))
    }
    return input
  }
  const method = (rules.method || 'GET').toUpperCase()
  loading.value = true
  try {
    const config = {
      method,
      url: fill(rules.address),
      headers: fill(rules.headers),
      timeout: 10000
    }
    const body = fill(rules.body)
    if (body && typeof body === 'object' && Object.keys(body).length) {
      // GET/HEAD 时 body 作为查询参数，其余作为请求体
      if (method === 'GET' || method === 'HEAD') config.params = body
      else config.data = body
    }
    const response = await axios(config)
    const root = response.data
    const list = rules.dataPath ? get(root, rules.dataPath) : root
    const items = Array.isArray(list) ? list : []
    options.value = items.map((item) => ({
      label: item?.[rules.label] ?? item?.label,
      value: item?.[rules.value] ?? item?.value
    }))
  } catch (err) {
    console.error('加载远程选项失败(remoteRules):', err)
    options.value = []
  } finally {
    loading.value = false
  }
}

const loadOptions = async (keyword = '') => {
  if (props.field.remoteRules && props.field.remoteRules.address) {
    await loadRemoteRules(keyword)
    return
  }
  if (!props.field.remote || !props.field.remoteMethod) {
    await resolveOptions(props.field.options)
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

// 组件挂载时自动加载选项（静态：resolveOptions；远程：useRemoteOptions 的 loadRemote；remoteRules：loadRemoteRules）
onMounted(() => {
  if (props.field.remoteRules && props.field.remoteRules.address) {
    loadOptions().then(() => valueValid())
  } else if (!props.field.remote || typeof props.field.remoteMethod !== 'function') {
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

// 监听 remoteRules 配置变化
watch(
  () => props.field.remoteRules,
  () => {
    loadOptions().then(() => valueValid())
  },
  { deep: true }
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
  if (!props.field.remoteRules && (!props.field.remote || !props.field.remoteMethod)) return
  await loadOptions(searchValue)
  valueValid()
}, 300)

</script>
