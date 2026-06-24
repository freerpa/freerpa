<template>
  <div class="sender">
    <a-textarea
      :auto-size="{ minRows: 3, maxRows: 3 }"
      :max-length="{ length: 1024 }"
      allow-clear
      show-word-limit
      :placeholder="placeholder"
      v-model="inputValue"
      @keydown.enter.exact="(e) => e.preventDefault()"
      @keyup.enter="handleEnter"
    />
    <div class="toolbar">
      <div class="left">
        <a-tag style="height: 28px" type="primary">积分：{{ userInfo?.points || 0 }}</a-tag>
      </div>
      <div class="right">
        <a-select size="small" v-model="selectedModel" :options="models" />
        <a-button
          style="width: 35px"
          type="primary"
          size="small"
          @click="handleSend"
          :disabled="inputValue.trim() === '' && !loading"
        >
          <template #icon>
            <icon-record-stop v-if="loading" />
            <icon-arrow-up v-else />
          </template>
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue'
import { IconRecordStop, IconArrowUp } from '@arco-design/web-vue/es/icon'
import { getModels } from '@/api/aiModels'
import { useStore } from '@/store'
import { v4 as uuidv4 } from 'uuid'
const { userInfo } = useStore()
const props = defineProps({
  placeholder: {
    type: String,
    default: '请输入'
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['send', 'cancel'])

const inputValue = ref('')
const models = ref([])
const selectedModel = ref('')

// 加载模型列表
const loadModels = async () => {
  try {
    const result = await getModels()
    models.value =
      result.map((item) => ({
        label: item.title,
        value: item.title
      })) || []
    selectedModel.value = models.value[0]?.value || ''
  } catch (err) {
    console.error('加载模型列表失败:', err)
  }
}
loadModels()

const handleEnter = () => {
  if (props.loading) {
    return
  }
  handleSend()
}

const handleSend = () => {
  if (props.loading) {
    emit('cancel')
    return
  }
  if (inputValue.value.trim()) {
    emit('send', {
      id: uuidv4(),
      model: selectedModel.value,
      role: 'user',
      content: inputValue.value
    })
    inputValue.value = ''
  }
}
</script>

<style scoped>
.sender {
  position: relative;
  display: flex;
  gap: 8px;
  flex-direction: column;
  /* .arco-textarea-wrapper {
    padding-bottom: 44px;
  } */
}
.toolbar {
  z-index: 100;
  display: flex;
  justify-content: space-between;
  width: 100%;
  align-items: center;
  .right {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
.sender__input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  transition: all 0.3s;
}

.sender__input:focus {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.sender__button {
  padding: 8px 16px;
  background-color: #1890ff;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.sender__button:hover {
  background-color: #40a9ff;
}

.sender__button:active {
  background-color: #096dd9;
}
</style>
