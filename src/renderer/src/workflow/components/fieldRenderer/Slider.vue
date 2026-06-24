<template>
  <a-slider
    v-model="value"
    :min="field.min"
    :max="field.max"
    :step="field.step"
    :disabled="field.disabled"
    :show-ticks="field.showTicks"
    :show-input="field.showInput"
    :marks="field.marks"
    :range="field.range"
  />
</template>

<script setup>
import { ref, watch, inject } from 'vue'

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const formData = inject('formData')
const value = defineModel()

// 值变化时触发onChange
watch(value, (newVal) => {
  if(props.field.onChange) {
    props.field.onChange(newVal, formData)
  }
})
</script> 