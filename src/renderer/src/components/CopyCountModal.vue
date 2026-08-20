<template>
  <a-modal
    v-model:visible="visible"
    :title="`复制${name}`"
    width="360px"
    :ok-text="`复制 ${count} 份`"
    :cancel-text="'取消'"
    :mask-closable="false"
    :unmount-on-close="true"
    @before-ok="handleBeforeOk"
  >
    <a-form layout="vertical">
      <a-form-item label="复制份数">
        <a-input-number v-model="count" :min="1" :max="100" :precision="0" style="width: 100%" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'

const visible = defineModel('visible')
const props = defineProps({
  name: { type: String, default: '' }
})
const emit = defineEmits(['confirm'])

const count = ref(1)

// 每次打开重置为 1
watch(visible, (val) => {
  if (val) count.value = 1
})

const handleBeforeOk = (done) => {
  const n = Math.floor(Number(count.value))
  if (!n || n < 1 || n > 100) {
    done(false)
    return
  }
  emit('confirm', n)
  done(true)
}
</script>
