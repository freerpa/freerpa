/** * @description 路径选择器组件 * @author dabao * @date 2024-03-17 */

<template>
  <div class="path-selector">
    <a-input-tag v-if="field.multiple" v-model="modelValue" :style="{ width: '100%' }">
      <template #prefix v-if="!modelValue.length || !modelValue">
        <span style="color: var(--color-text-3)">请选择路径</span>
      </template>
      <template #suffix>
        <a-button class="select-btn" @click="handleSelect">
          <icon-file v-if="isFileType" />
          <icon-folder v-else />
        </a-button>
      </template>
    </a-input-tag>
    <refInput v-else v-model="modelValue" :field="field">
      <template #suffix>
        <a-button class="select-btn" @click="handleSelect">
          <icon-file v-if="isFileType" />
          <icon-folder v-else />
        </a-button>
      </template>
    </refInput>

    <!-- 自定义 Windows 风格文件选择器（按 pathType 限定文件/文件夹，未授权目录可在面板快速授权） -->
    <directoryPicker
      :visible="pickerVisible"
      :model-value="modelValue"
      :multiple="field.multiple"
      :path-type="field.pathType"
      @update:visible="pickerVisible = $event"
      @select="onPick"
    />
  </div>
</template>

<script setup>
import { watch, ref, computed } from 'vue'
import refInput from './Text.vue'
import { IconFolder, IconFile } from '@arco-design/web-vue/es/icon'
import directoryPicker from './DirectoryPicker.vue'
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

const pickerVisible = ref(false)
// 文件路径字段用文件图标，其余（文件夹/目录）用文件夹图标
const isFileType = computed(() => props.field.pathType === 'file')

// 处理选择路径：统一使用自定义文件选择器（按 pathType 限定文件/文件夹，未授权可快速授权）
const handleSelect = () => {
  pickerVisible.value = true
}

// 自定义目录选择器确定回调
const onPick = (val) => {
  modelValue.value = val
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
