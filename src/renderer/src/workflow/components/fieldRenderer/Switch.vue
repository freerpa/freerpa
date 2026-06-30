<template>
  <a-switch
    v-model="value"
    :disabled="field.disabled"
    size="small"
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