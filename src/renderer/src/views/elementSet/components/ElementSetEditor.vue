<template>
  <a-modal
    v-model:visible="visible"
    :title="modelId ? '编辑元素集' : '新建元素集'"
    @before-ok="handleBeforeOk"
    @cancel="handleClose"
    @before-open="handleOpen"
    unmount-on-close
    :mask-closable="false"
    width="720px"
    :body-style="{ padding: '20px 28px', maxHeight: '70vh', overflow: 'auto' }"
  >
    <a-form ref="formRef" :model="form" auto-label-width>
      <a-form-item
        field="title"
        label="标题"
        :rules="[
          { required: true, message: '请输入标题' },
          { maxLength: 50, message: '标题最多50个字符' }
        ]"
      >
        <a-input v-model="form.title" placeholder="请输入元素集标题" allow-clear>
          <template #prepend>
            <CategorySelect v-model="form.category" type="elementSet" />
          </template>
        </a-input>
      </a-form-item>
      <a-form-item field="description" label="描述">
        <a-textarea
          v-model="form.description"
          placeholder="请输入描述"
          allow-clear
          :max-length="200"
          style="height: 80px"
          show-word-limit
        />
      </a-form-item>
      <a-form-item label="元素">
        <div class="element-list">
          <ElementItem
            v-for="(el, i) in form.elements"
            :key="el._key"
            v-model="form.elements[i]"
            :index="i"
            @remove="removeElement(i)"
          />
          <a-button type="secondary" long @click="addElement">
            <template #icon><icon-plus /></template>
            添加元素
          </a-button>
        </div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconPlus } from '@arco-design/web-vue/es/icon'
import CategorySelect from '@/components/CategorySelect.vue'
import ElementItem from './ElementItem.vue'

const { elementSet: elementSetAPI } = window.electronAPI

const props = defineProps({
  modelId: [String, Number]
})

const visible = defineModel('visible')
const emit = defineEmits(['success'])

const formRef = ref(null)
const form = reactive({
  title: '',
  category: '',
  description: '',
  elements: []
})

let _keyCounter = 0
const newElement = () => ({
  _key: ++_keyCounter,
  name: '',
  match_condition: 'any',
  selectors: [newSelector()]
})
const newSelector = () => ({
  _key: ++_keyCounter,
  type: 'css',
  text_subtype: '',
  expression: ''
})

const addElement = () => form.elements.push(newElement())
const removeElement = (i) => form.elements.splice(i, 1)

const handleBeforeOk = async (done = (_visible) => { visible.value = !_visible }) => {
  try {
    const res = await formRef.value.validate()
    if (res) { done(false); return }
    // 验证元素
    for (const el of form.elements) {
      if (!el.name || !el.name.trim()) {
        Message.error('请填写所有元素的名称')
        done(false)
        return
      }
    }
    await handleSubmit()
    done(true)
  } catch (e) {
    done(false)
  }
}

const handleSubmit = async () => {
  try {
    const payload = {
      id: props.modelId,
      title: form.title,
      category_id: form.category,
      description: form.description,
      elements: form.elements.map(({ _key, ...rest }) => ({
        ...rest,
        selectors: (rest.selectors || []).map(({ _key: sk, _sizeError, ...srest }) => srest)
      }))
    }
    if (props.modelId) {
      await elementSetAPI.updateElementSet(payload)
    } else {
      await elementSetAPI.createElementSet(payload)
    }
    Message.success(props.modelId ? '更新成功' : '创建成功')
    emit('success')
    handleClose()
  } catch (e) {
    Message.error(e.message || '保存失败')
    throw e
  }
}

const handleClose = () => {
  formRef.value?.resetFields()
  form.title = ''
  form.category = ''
  form.description = ''
  form.elements = []
  visible.value = false
}

const handleOpen = async () => {
  _keyCounter = 0
  if (props.modelId) {
    try {
      const data = await elementSetAPI.getElementSet(props.modelId)
      form.title = data.title
      form.category = data.category_id || ''
      form.description = data.description
      form.elements = (data.elements || []).map((el) => ({
        _key: ++_keyCounter,
        name: el.name,
        match_condition: el.match_condition || 'any',
        selectors: (el.selectors || []).map((sel) => ({
          _key: ++_keyCounter,
          type: sel.type,
          text_subtype: sel.text_subtype || '',
          expression: sel.expression || ''
        }))
      }))
    } catch (e) {
      Message.error('获取元素集详情失败')
    }
  } else {
    form.title = ''
    form.category = ''
    form.description = ''
    form.elements = []
  }
}
</script>

<style lang="less" scoped>
.element-list {
  width: 100%;
}
</style>
