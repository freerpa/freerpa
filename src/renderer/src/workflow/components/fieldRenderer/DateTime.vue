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
import { ref } from "vue"
import { useFieldWatch } from './composables/useFieldValue'

const props = defineProps({
  field: {
    type: Object,
    required: true,
  },
})

const value = defineModel()
useFieldWatch(props, value)
const visible = ref(false)
</script>
