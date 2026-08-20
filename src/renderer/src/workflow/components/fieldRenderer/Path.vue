/** * @description 路径选择器组件 * @author dabao * @date 2024-03-17 */

<template>
  <div class="path-selector">
    <a-input-tag v-if="field.multiple" v-model="modelValue" :style="{ width: '100%' }">
      <template #prefix v-if="!modelValue.length || !modelValue">
        <span style="color: var(--color-text-3)">请选择路径</span>
      </template>
      <template #suffix>
        <a-button class="select-btn" @click="handleSelect">
          <icon-folder />
        </a-button>
      </template>
    </a-input-tag>
    <refInput v-else v-model="modelValue" :field="field">
      <template #suffix>
        <a-button class="select-btn" @click="handleSelect">
          <icon-folder />
        </a-button>
      </template>
    </refInput>
  </div>
</template>

<script setup>
import { watch } from 'vue'
import refInput from './Text.vue'
import { IconFolder } from '@arco-design/web-vue/es/icon'
// 定义属性
const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

// 定义双向绑定
const modelValue = defineModel({
  default: ''
})

// 处理选择路径（使用绝对路径，不做安全目录限制）
const handleSelect = async () => {
  const properties = props.field.pathType === 'file' ? ['openFile'] : ['openDirectory']
  if (props.field.multiple) properties.push('multiSelections')
  const options = {
    title: props.field.name || '选择路径',
    properties,
    defaultPath: props.field.multiple ? '' : (modelValue.value || '')
  }

  // 如果有文件类型限制
  if (props.field.extensions) {
    options.filters = [{ name: '允许的文件类型', extensions: props.field.extensions }]
  }

  try {
    const result = await window.electronAPI.dialog.openPath(options)

    if (!result.canceled && result.filePaths.length > 0) {
      modelValue.value = props.field.multiple ? result.filePaths : result.filePaths[0]
    }
  } catch (error) {
    console.error('选择路径失败:', error)
  }
}

watch(
  () => props.field.multiple,
  (newVal) => {
    if (newVal) {
      modelValue.value = []
    } else {
      modelValue.value = ''
    }
  }
)
</script>

<style scoped lang="less">
.path-selector {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: self-start;
  width: 100%;
  .path-selector-input-mutiple {
    display: flex;
    flex-direction: row;
    height: 100%;
    background: var(--color-fill-2);
    border-radius: var(--border-radius-small);
    width: 100%;
    overflow: auto;
    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
      flex: 1;
      padding: 2px;
      .tag {
        background: var(--color-white);
        height: auto;
        text-wrap: auto;
      }
    }
  }
  .select-btn-container {
    height: initial;
    flex: 0;
  }
  .select-btn {
    width: 38px;
    min-height: 24px;
    height: 100%;
    flex: 0;
  }
}

:deep(.arco-btn) {
  border-radius: 0px;
  height: 100%;
  width: 100%;
  border-top-right-radius: var(--border-radius-small);
  border-bottom-right-radius: var(--border-radius-small);
}
:deep(.arco-input-tag.arco-input-tag-has-suffix) {
  padding-right: 0px;
}
:deep(.arco-input-tag-input) {
  display: none;
}
:deep(.arco-input-tag) {
  border-width: 0px;
  cursor: pointer;
}
</style>
