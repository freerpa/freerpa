<template>
  <a-date-picker
    v-model="value"
    :placeholder="field.description"
    :disabled="field.disabled"
    :format="field.format || 'YYYY-MM-DD HH:mm:ss'"
    :show-time="true"
    :time-picker-props="{
      format: field.timeFormat || 'HH:mm:ss',
      step: field.step,
      use12Hours: field.use12Hours,
    }"
    :disabled-date="field.disabledDate"
    :disabled-time="field.disabledTime"
    v-model:popup-visible="visible"
    @blur="visible = false"
  />
</template>

<script setup>
import { ref, watch, inject } from "vue"

const props = defineProps({
  field: {
    type: Object,
    required: true,
  },
})

const formData = inject("formData")
const value = defineModel()
const visible = ref(false)
// 值变化时触发onChange
watch(value, newVal => {
  if (props.field.onChange) {
    props.field.onChange(newVal, formData)
  }
})
</script>
