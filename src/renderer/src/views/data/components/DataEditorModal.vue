<template>
  <a-modal
    :visible="visible"
    :title="editingRecord ? '编辑数据' : '新增数据'"
    @before-ok="handleBeforeOk"
    @cancel="handleCancel"
    :mask-closable="false"
    :body-style="{ maxHeight: 'calc(90vh - 200px)' }"
    width="800px"
  >
    <a-form ref="formRef" :model="form" auto-label-width>
      <template v-for="field in fields" :key="field.name">
        <a-form-item :field="field.name" :label="field.description" :rules="getFieldRules(field)">
          <!-- 根据字段类型渲染不同的表单控件 -->
          <template v-if="field.type === 'date'">
            <a-date-picker v-model="form[field.name]" style="width: 100%" />
          </template>
          <template v-else-if="field.type === 'number'">
            <a-input-number
              v-model="form[field.name]"
              :placeholder="`请输入${field.description}`"
              allow-clear
            />
          </template>
          <template v-else>
            <a-textarea
              v-model="form[field.name]"
              :placeholder="`请输入${field.description}`"
              :auto-size="{ minRows: 1, maxRows: 5 }"
              allow-clear
            />
          </template>
        </a-form-item>
      </template>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { deepClone } from '@/workflow/utils'

const props = defineProps({
  visible: { type: Boolean, default: false },
  editingRecord: { type: Object, default: null },
  fields: { type: Array, required: true },
  model: { type: Object, required: true }
})
const emit = defineEmits(['update:visible', 'saved'])

const { data: dataAPI } = window.electronAPI

const formRef = ref(null)
const form = ref({})

// 打开时根据编辑/新增初始化表单
watch(
  () => props.visible,
  (val) => {
    if (!val) return
    form.value = props.editingRecord ? deepClone(props.editingRecord) : {}
  }
)

// 获取字段验证规则
const getFieldRules = (field) => {
  const rules = []
  if (field.required) {
    rules.push({ required: true, message: `请输入${field.description}` })
  }
  return rules
}

// 处理确认前的验证
const handleBeforeOk = async (done) => {
  try {
    const res = await formRef.value.validate()
    if (res) {
      done(false)
    } else {
      await handleSubmit()
      done()
    }
  } catch {
    done(false)
  }
}

// 提交表单（错误经 handleBeforeOk 的 catch 拦截，此处直接抛出即可）
const handleSubmit = async () => {
  if (props.editingRecord) {
    await dataAPI.updateModelData({
      modelId: props.model.id,
      ids: [props.editingRecord.id],
      data: deepClone(form.value)
    })
  } else {
    await dataAPI.createModelData({
      modelId: props.model.id,
      data: deepClone(form.value)
    })
  }
  resetForm()
  emit('saved')
}

// 重置表单
const resetForm = () => {
  formRef.value?.resetFields()
  form.value = {}
}

// 取消：重置表单
const handleCancel = () => {
  resetForm()
  emit('update:visible', false)
}
</script>
