<template>
  <!-- size 继承 ConfigProvider：mini/small 为 16px，medium/large 为默认 24px -->
  <a-switch v-model="value" :disabled="field.disabled" />
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
