<template>
  <div class="object-field">
    <!-- 对象字段列表 -->
    <div class="object-fields">
      <field-renderer
        v-model="objectData"
        :layout="parentLayout"
        :fields="fields || []"
        :is-quick-config="isQuickConfig"
      />
    </div>

    <!-- 添加字段按钮(如果允许动态添加字段) -->
    <div v-if="field.allowCustomFields" class="object-actions">
      <a-button type="outline" @click="showAddField = true">
        <template #icon>
          <icon-plus />
        </template>
        添加字段
      </a-button>
    </div>

    <!-- 添加字段弹窗 -->
    <a-modal
      v-model:visible="showAddField"
      title="添加字段"
      @ok="handleAddField"
      @cancel="showAddField = false"
    >
      <a-form :model="newField" layout="vertical">
        <a-form-item field="name" label="字段名">
          <a-input v-model="newField.name" placeholder="请输入字段名" />
        </a-form-item>
        <a-form-item field="type" label="字段类型">
          <a-select v-model="newField.type" placeholder="请选择字段类型">
            <a-option value="text">文本</a-option>
            <a-option value="number">数字</a-option>
            <a-option value="boolean">布尔</a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { IconPlus } from '@arco-design/web-vue/es/icon'
import FieldRenderer from './FieldRenderer.vue'
import { getDefaultFieldValue } from '../../utils'
import { useFieldWatch } from './composables/useFieldValue'

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const fields = computed(() => props.field.fields || [])

const objectData = defineModel({
  set(value) {
    if (value === undefined || value === null || value === '') {
      return {}
    }
    return value
  },
  default: () => ({})
})

if (JSON.stringify(objectData.value) === '{}') {
  const defaultValue = {}
  fields.value.forEach((field) => {
    defaultValue[field.id] = Object.hasOwn(field, 'default')
      ? field.default
      : getDefaultFieldValue(field)
  })
  objectData.value = defaultValue
}

// 添加字段相关
const showAddField = ref(false)
const newField = ref({
  name: '',
  type: 'text'
})

// 添加自定义字段
const handleAddField = () => {
  if (!newField.value.name) return

  // 添加到fields配置（统一数组形态）
  props.field.fields = props.field.fields || []
  props.field.fields.push({
    id: newField.value.name,
    name: newField.value.name,
    type: newField.value.type
  })

  // 重置表单
  newField.value = {
    name: '',
    type: 'text'
  }
  showAddField.value = false
}

const isQuickConfig = inject('isQuickConfig')
// 跟随父级表单布局（抽屉竖排 / 节点横排）
const parentLayout = inject('fieldLayout', 'horizontal')
useFieldWatch(props, objectData)
</script>

<style lang="less" scoped>
.object-field {
  width: 100%;

  .object-fields {
    width: 100%;
    padding: 6px;
    border-radius: var(--mac-radius-sm);
    border: var(--mac-hairline) solid var(--mac-separator);
  }

  .object-actions {
    margin-top: 2px;
  }
}
</style>
