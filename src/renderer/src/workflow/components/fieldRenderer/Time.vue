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
import { ref, inject } from 'vue'
import { useFieldWatch } from './composables/useFieldValue'

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const value = defineModel()
useFieldWatch(props, value)
const visible = ref(false)
</script>
