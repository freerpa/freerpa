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
    <div v-if="pathError" class="path-error-message">
      <icon-exclamation-circle />
      <span>
        选择无效：必须在
        <a-tooltip>
          <template #content>
            为了您的计算机安全，工作流只能选择文件目录下的文件或目录，可自行去
            <b>设置 - 权限管理</b> 中修改
            <br />
            文件目录：{{ allowedRoot || '未配置（请到设置 - 权限管理添加目录）' }}
          </template>
          <span style="cursor: pointer; font-weight: bold" @click="openAllowedRoot">
            文件目录
          </span>
        </a-tooltip>
        下
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import refInput from './Text.vue'
import { IconFolder, IconExclamationCircle } from '@arco-design/web-vue/es/icon'
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

const pathError = ref(false)

const allowedRoot = ref('')

// 文件主目录 = 权限管理 io.roots[0]（迁移自旧安全目录 allowedRoot）
const fetchRoot = async () => {
  const perms = await window.electronAPI.store.get('permissions')
  allowedRoot.value = perms?.io?.roots?.[0] || ''
}

const openAllowedRoot = async () => {
  await fetchRoot()
  if (allowedRoot.value) window.electronAPI.shell.openPath(allowedRoot.value)
}

// 处理选择路径
const handleSelect = async () => {
  // 获取文件主目录
  await fetchRoot()
  try {
    // 根据field.pathType判断是选择文件还是文件夹
    const properties = props.field.pathType === 'file' ? ['openFile'] : ['openDirectory']
    let defaultPath = allowedRoot.value + '/' + modelValue.value
    if (props.field.multiple) {
      properties.push('multiSelections')
      defaultPath = allowedRoot.value
    }
    const options = {
      title: props.field.name || '选择路径',
      properties,
      defaultPath
    }

    // 如果有文件类型限制
    if (props.field.extensions) {
      options.filters = [{ name: '允许的文件类型', extensions: props.field.extensions }]
    }

    const result = await window.electronAPI.dialog.openPath(options)

    if (!result.canceled && result.filePaths.length > 0) {
      if (props.field.multiple) {
        modelValue.value = result.filePaths.map((filePath) => {
          if (!filePath.startsWith(allowedRoot.value)) {
            pathError.value = true
            return
          }
          filePath = filePath.replace(allowedRoot.value, '')
          // 去除第一位
          filePath = filePath.slice(1)
          return filePath
        })
      } else {
        let filePath = result.filePaths[0]
        if (!filePath.startsWith(allowedRoot.value)) {
          pathError.value = true
          return
        }
        filePath = filePath.replace(allowedRoot.value, '')
        // 去除第一位
        filePath = filePath.slice(1)
        modelValue.value = filePath
      }

      pathError.value = false
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
  .path-error-message {
    display: flex;
    align-items: center;
    color: rgb(var(--danger-6));
    font-size: 12px;
    gap: 4px;
  }
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
