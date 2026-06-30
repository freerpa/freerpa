<template>
  <a-date-picker
    v-model="value"
    :placeholder="field.description"
    :disabled="field.disabled"
    :format="field.format || (field.showTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD')"
    :value-format="field.format || (field.showTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD')"
    :show-time="field.showTime"
    :popup-visible="visible"
    @blur.capture="visible = false"
    @click.capture="visible = true"
    @change="visible = false"
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
