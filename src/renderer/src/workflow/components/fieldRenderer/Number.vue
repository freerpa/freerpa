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
  />
</template>

<script setup>
import { inject } from 'vue'
import { unDoReDoInterceptor } from '@/workflow/utils'
import { useFieldWatch } from './composables/useFieldValue'

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const value = defineModel()
useFieldWatch(props, value)

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
</script>
