<template>
  <a-time-picker
    v-model="value"
    :placeholder="field.description"
    :disabled="field.disabled"
    :format="field.format || 'HH:mm:ss'"
    :step="field.step"
    :use12-hours="field.use12Hours"
    :disabled-time="field.disabledTime"
    v-model:popup-visible="visible"
    @blur="visible = false"
    style="width: 100%"
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
const visible = ref(false)

// 值变化时触发onChange
watch(value, (newVal) => {
  if (props.field.onChange) {
    props.field.onChange(newVal, formData)
  }
})
</script>
