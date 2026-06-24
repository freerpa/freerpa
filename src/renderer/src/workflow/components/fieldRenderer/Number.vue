<template>
  <a-input-number
    v-model="value"
    :min="field.min"
    :max="field.max"
    :step="field.step || 1"
    @keydown="unDoReDoInterceptor"
    @keyup="unDoReDoInterceptor"
    mode="button"
    model-event="input"
    allow-clear
    @blur="handleBlur"
    @change="handleChange"
  />
</template>

<script setup>
import { inject } from 'vue'
import { unDoReDoInterceptor } from '@/workflow/utils'

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const formData = inject('formData')
const value = defineModel()
// 验证值是否有效
const isValueValid = (value) => {
  if (value === null || value === undefined || value === '') {
    return false
  }
  return true
}

const handleBlur = () => {
  if (!isValueValid(value.value)) {
    value.value = props.field.min || 0
  }
}
const handleChange = (nowValue) => {
  if (props.field.onChange) {
    props.field.onChange(value.value, formData)
  }
}
</script>
