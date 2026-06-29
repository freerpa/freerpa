<template>
  <a-modal
    v-model:visible="visible"
    :title="modelId ? '编辑工作流' : '新建工作流'"
    @before-ok="handleBeforeOk"
    @cancel="handleClose"
    @before-open="handleOpen"
    unmount-on-close
    :mask-closable="false"
  >
    <a-form ref="formRef" :model="form" auto-label-width>
      <a-form-item
        field="name"
        label="工作流名称"
        :rules="[
          { required: true, message: '请输入工作流名称' },
          { minLength: 2, message: '工作流名称至少2个字符' },
          { maxLength: 50, message: '工作流名称最多50个字符' }
        ]"
      >
        <a-input
          v-model="form.name"
          placeholder="请输入工作流名称"
          allow-clear
          @press-enter="handleBeforeOk()"
        >
          <template #prepend>
            <CategorySelect v-model="form.category" type="workflow" />
          </template>
        </a-input>
      </a-form-item>
      <a-form-item field="description" label="工作流描述">
        <a-textarea
          v-model="form.description"
          placeholder="请输入工作流描述"
          allow-clear
          :max-length="200"
          style="height: 100px"
          show-word-limit
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, inject } from 'vue'
import { Message } from '@arco-design/web-vue'
import CategorySelect from '@/components/CategorySelect.vue'

const { workflow: workflowAPI } = window.electronAPI

const props = defineProps({
  modelId: [String, Number]
})

const visible = defineModel('visible')
const emit = defineEmits(['success'])
const category = inject('category', '')
// 表单状态
const formRef = ref(null)
const form = ref({
  name: '',
  category: '',
  description: ''
})
// 表单处理
const handleBeforeOk = async (
  done = (_visible) => {
    visible.value = !_visible
  }
) => {
  try {
    const res = await formRef.value.validate()
    if (res) {
      done(false)
    } else {
      await handleSubmit()
      done(true)
    }
  } catch (error) {
    done(false)
  }
}

const handleSubmit = async () => {
  try {
    const workflow = {
      id: props.modelId,
      name: form.value.name,
      category_id: form.value.category,
      description: form.value.description
    }
    if (props.modelId) {
      await workflowAPI.updateWorkflow(workflow)
    } else {
      const newId = await workflowAPI.createWorkflow(workflow)
      workflow.id = newId
    }

    Message.success(props.modelId ? '更新成功' : '创建成功')
    emit('success', workflow)
    handleClose()
  } catch (error) {
    Message.error(error.message || '保存失败')
    throw error
  }
}

const handleClose = () => {
  formRef.value?.resetFields()
  form.value = {
    name: '',
    category: '',
    description: ''
  }
  visible.value = false
}

// 获取工作流详情
const fetchWorkflowDetail = async (id) => {
  try {
    const result = await workflowAPI.getWorkflow(id)
    if (result) {
      form.value = {
        name: result.name,
        category: result.category_id || result.category || '',
        description: result.description
      }
    }
  } catch (error) {
    Message.error('获取工作流详情失败')
  }
}

const handleOpen = () => {
  if (props.modelId) {
    fetchWorkflowDetail(props.modelId)
  } else {
    form.value.category = category.value
  }
}
</script>
