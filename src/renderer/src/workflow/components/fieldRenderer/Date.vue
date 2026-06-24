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
