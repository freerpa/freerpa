<template>
  <a-switch
    v-model="value"
    :disabled="field.disabled"
    size="small"
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