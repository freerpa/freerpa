<template>
  <a-modal
    v-model:visible="visible"
    :title="modelId ? '编辑数据表' : '新建数据表'"
    @before-ok="handleBeforeOk"
    @cancel="resetForm"
    @open="open"
    :mask-closable="false"
    width="1000px"
  >
    <a-form ref="formRef" :model="modelForm" auto-label-width>
      <a-form-item
        field="name"
        label="名称"
        :rules="[
          { required: true, message: '请输入名称' },
          { minLength: 2, message: '名称至少2个字符' },
          { maxLength: 50, message: '名称最多50个字符' }
        ]"
      >
        <a-input v-model="modelForm.name" placeholder="请输入名称" allow-clear>
          <template #prepend>
            <CategorySelect v-model="modelForm.category" type="model" />
          </template>
        </a-input>
      </a-form-item>

      <a-form-item field="description" label="描述">
        <a-textarea
          v-model="modelForm.description"
          placeholder="请输入描述"
          allow-clear
          :max-length="200"
          show-word-limit
        />
      </a-form-item>

      <a-form-item
        field="fields"
        label="字段"
        :disabled="modelId && hasData"
        :rules="[
          {
            required: true,
            validator: validateFields
          }
        ]"
      >
        <div class="fields-config">
          <!-- 有数据时的警告提示 -->
          <a-alert v-if="modelId && hasData" type="warning" class="mb-4">
            该数据表已有数据，字段配置不可修改。如需修改字段，请先清空数据。
          </a-alert>

          <a-table
            :data="modelForm.fields"
            :bordered="false"
            :pagination="false"
            :hoverable="false"
            :scroll="{ y: 600 }"
            @change="
              (data) => {
                modelForm.fields = data
              }
            "
            :draggable="
              modelId && hasData
                ? null
                : {
                    type: 'handle',
                    width: 30
                  }
            "
          >
            <template #columns>
              <a-table-column title="描述（中文 · 一般作为表头展示）">
                <template #cell="{ record, rowIndex }">
                  <a-input
                    v-model="record.description"
                    placeholder="请输入描述"
                    allow-clear
                    @input="autoFieldName(record)"
                    @keyup.enter="addField(rowIndex + 1)"
                    :ref="(el) => (inputRefs[rowIndex] = el)"
                  />
                </template>
              </a-table-column>

              <a-table-column title="字段名（英文）" align="center" :width="150">
                <template #cell="{ record }">
                  <a-input
                    v-model="record.name"
                    placeholder="请输入字段名"
                    allow-clear
                    :disabled="modelId && hasData"
                    :status="record.name ? '' : 'error'"
                  />
                </template>
              </a-table-column>

              <a-table-column title="类型" align="center" :width="150">
                <template #cell="{ record }">
                  <a-select
                    v-model="record.type"
                    placeholder="请选择类型"
                    :disabled="modelId && hasData"
                  >
                    <a-option value="string">文本</a-option>
                    <a-option value="number">数字</a-option>
                    <a-option value="date">日期</a-option>
                  </a-select>
                </template>
              </a-table-column>

              <a-table-column title="约束" align="center" :width="150">
                <template #cell="{ record }">
                  <a-space>
                    <a-checkbox v-model="record.required">必填</a-checkbox>
                    <a-checkbox v-model="record.unique">唯一</a-checkbox>
                  </a-space>
                </template>
              </a-table-column>

              <a-table-column title="操作" align="center" :width="60">
                <template #cell="{ rowIndex }">
                  <a-button
                    @click="removeField(rowIndex)"
                    type="text"
                    status="danger"
                    :disabled="modelId && hasData"
                  >
                    <template #icon><icon-delete /></template>
                  </a-button>
                </template>
              </a-table-column>
            </template>
          </a-table>
          <div class="add-field">
            <a-button
              type="dashed"
              long
              @click="addField()"
              :disabled="modelId && hasData"
              style="margin-top: 16px"
            >
              <template #icon><icon-plus /></template>
              添加字段
            </a-button>
          </div>
        </div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconPlus, IconDelete } from '@arco-design/web-vue/es/icon'
import CategorySelect from '@/components/CategorySelect.vue'
import { deepClone } from '@/workflow/utils'
import pinyin from 'pinyin'
// 自动生成字段名
const autoFieldName = (record) => {
  // 只取首字母
  const result3 = pinyin(record.description, {
    style: pinyin.STYLE_NORMAL
  })
  record.name = result3.join('')
}

const props = defineProps({
  modelId: String
})

const emit = defineEmits(['success'])
const visible = defineModel('visible')

// API 引用
const { data: dataAPI } = window.electronAPI

// 表单数据
const formRef = ref(null)
const modelForm = ref({
  name: '',
  description: '',
  category: '',
  type: 'string',
  fields: []
})

// 检查数据表是否有数据
const hasData = ref(false)
const checkHasData = async () => {
  if (!props.modelId) {
    hasData.value = false
    return
  }
  try {
    const result = await dataAPI.getModelData({
      modelId: props.modelId,
      page: 1,
      pageSize: 1
    })
    hasData.value = result.total > 0
  } catch (error) {
    console.error(error)
    hasData.value = false
  }
}

const open = async () => {
  resetForm()
  if (props.modelId) {
    const model = await dataAPI.getModel(props.modelId)
    modelForm.value = {
      name: model.name,
      description: model.description,
      category: model.category_id || '',
      type: model.type,
      fields: JSON.parse(model.fields)
    }
  }
  await checkHasData()
}
const inputRefs = ref([])
// 添加字段
const addField = (index = modelForm.value.fields.length) => {
  modelForm.value.fields.splice(index, 0, {
    name: '',
    type: 'string',
    description: '',
    required: false,
    unique: false
  })
  nextTick(() => {
    inputRefs.value[index].focus()
  })
}

// 删除字段
const removeField = (index) => {
  modelForm.value.fields.splice(index, 1)
}

// 验证字段
const validateFields = async (value, callback) => {
  const fields = modelForm.value.fields
  if (!fields || fields.length === 0) {
    return callback('至少添加一个字段')
  }

  const fieldNamePattern = /^[a-zA-Z][a-zA-Z0-9_]*$/
  const invalidFields = fields.filter((field) => {
    return (
      !field.name ||
      !fieldNamePattern.test(field.name) ||
      ['id', 'color', 'created_at'].includes(field.name.trim().toLowerCase())
    )
  })

  if (invalidFields.length > 0) {
    return callback(
      '字段名称只能包含字母、数字和下划线，且必须以字母开头，且不能为id、color或created_at'
    )
  }

  const fieldNames = fields.map((f) => f.name)
  const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index)

  if (duplicates.length > 0) {
    return callback('字段名称不能重复')
  }

  if (!fields.every((field) => field.description && field.description.trim())) {
    return callback('字段描述不能为空')
  }

  callback()
}

// 处理提交前验证
const handleBeforeOk = async () => {
  try {
    const result = await formRef.value.validate()
    if (result) {
      return false
    }
    const model = deepClone(modelForm.value)
    model.category_id = model.category
    delete model.category
    if (props.modelId) {
      await dataAPI.updateModel({
        id: props.modelId,
        ...model
      })
      Message.success('更新成功')
    } else {
      await dataAPI.createModel(model)
      Message.success('创建成功')
    }
    emit('success', model)
    resetForm()
    return true
  } catch (error) {
    Message.error(error.message || '保存失败')
    throw error
  }
}

// 重置表单
const resetForm = () => {
  modelForm.value = {
    name: '',
    description: '',
    category: '',
    type: 'string',
    fields: []
  }
  formRef.value?.resetFields()
}
</script>

<style lang="less" scoped>
.drag-handle {
  cursor: move;
  color: var(--color-text-3);

  &.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.mb-4 {
  margin-bottom: 16px;
}
</style>
