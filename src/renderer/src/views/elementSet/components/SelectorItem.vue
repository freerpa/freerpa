<template>
  <div class="selector-row">
    <div class="drag-area">
      <icon-drag-dot-vertical />
    </div>
    <a-select v-model="model.type" size="mini" style="width:90px" @change="onTypeChange">
      <a-option value="css">CSS</a-option>
      <a-option value="xpath">XPath</a-option>
      <a-option value="image">图片</a-option>
      <a-option value="text">文本</a-option>
      <a-option value="position">Position</a-option>
    </a-select>
    <a-select v-if="model.type === 'text'" v-model="model.text_subtype" size="mini" style="width:80px">
      <a-option value="start">开头</a-option>
      <a-option value="end">结束</a-option>
      <a-option value="equals">等于</a-option>
      <a-option value="contains">包含</a-option>
    </a-select>
    <template v-if="model.type === 'image'">
      <a-space size="mini">
        <a-button size="mini" @click="handleUpload">上传</a-button>
        <a-button size="mini" @click="handlePaste">粘贴</a-button>
      </a-space>
      <div v-if="model.expression" class="image-thumb" @click="showPreview = true">
        <img :src="model.expression" />
      </div>
      <span v-if="sizeError" class="size-error">超过500KB</span>
      <input type="file" accept="image/*" style="display:none" ref="fileInputRef" @change="onFileChange" />
    </template>
    <a-input v-else v-model="model.expression" size="mini" :placeholder="placeholder" allow-clear class="expr-input" />
    <a-button type="text" size="mini" status="danger" @click="emit('remove')">
      <template #icon><icon-delete /></template>
    </a-button>

    <a-modal v-model:visible="showPreview" title="图片预览" :footer="false" width="auto" :body-style="{padding:'12px',textAlign:'center'}">
      <img :src="model.expression" style="max-width:80vw;max-height:80vh" />
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconDragDotVertical, IconDelete } from '@arco-design/web-vue/es/icon'

const props = defineProps({ index: { type: Number, default: 0 } })
const model = defineModel({ type: Object, required: true })
const emit = defineEmits(['remove'])

const placeholder = computed(() => ({ css: '.class-name', xpath: '//div[@id]', text: '匹配文本', position: 'x,y,w,h' }[model.value.type] || '表达式'))

const MAX_SIZE = 500 * 1024
const fileInputRef = ref(null)
const showPreview = ref(false)
const sizeError = ref(false)

const onTypeChange = () => { model.value.expression = ''; model.value.text_subtype = ''; sizeError.value = false }

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  if (file.size > MAX_SIZE) { reject(new Error('超过500KB')); return }
  const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file)
})

const handleUpload = () => fileInputRef.value?.click()

const onFileChange = async (e) => {
  const file = e.target.files?.[0]; if (!file) return
  try { sizeError.value = false; model.value.expression = await fileToBase64(file) } catch { sizeError.value = true; Message.error('图片超过500KB限制') }
  if (fileInputRef.value) fileInputRef.value.value = ''
}

const handlePaste = async () => {
  try {
    sizeError.value = false
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const types = item.types.filter(t => t.startsWith('image/'))
      if (types.length > 0) {
        const blob = await item.getType(types[0])
        if (blob.size > MAX_SIZE) { sizeError.value = true; Message.error('图片超过500KB限制'); return }
        model.value.expression = await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(blob) })
        return
      }
    }
    Message.warning('剪贴板中没有图片')
  } catch { Message.error('读取剪贴板失败') }
}
</script>

<style lang="less" scoped>
.selector-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}
.drag-area {
  cursor: move;
  color: var(--color-text-3);
  display: flex;
  align-items: center;
}
.expr-input {
  flex: 1;
  min-width: 80px;
}
.image-thumb {
  cursor: pointer; border: 1px solid var(--color-border-2); border-radius: 3px; overflow: hidden; flex-shrink: 0;
  img { width: 32px; height: 22px; object-fit: cover; display: block; }
}
.size-error {
  color: rgb(var(--danger-6)); font-size: 11px;
}
</style>
