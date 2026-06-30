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
import { useFieldWatch } from './composables/useFieldValue'

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const value = defineModel()
useFieldWatch(props, value)
</script> 