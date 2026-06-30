import { watch, inject } from 'vue'

/**
 * Shared composable for field renderers — eliminates the repeated
 * onChange watcher pattern across all renderers.
 *
 * Usage in <script setup>:
 *   const value = defineModel()
 *   useFieldWatch(props, value)
 */
export function useFieldWatch(props, value) {
  const formData = inject('formData')
  if (typeof props.field?.onChange === 'function') {
    watch(value, (newVal) => {
      props.field.onChange(newVal, formData)
    })
  }
}
