<template>
  <div class="image-upload">
    <a-upload
      list-type="picture-card"
      :file-list="fileList"
      :limit="Number(props.limit)"
      :show-upload-button="true"
      @before-remove="handleRemove"
      image-preview
      :auto-upload="false"
      accept="image/*"
      @before-upload="beforeUpload"
    >
      <template #upload-button>
        <div class="upload-button">
          <icon-plus />
          <div class="upload-text">{{ uploadText }}</div>
        </div>
      </template>
    </a-upload>

    <!-- 裁剪弹窗 -->
    <a-modal
      v-model:visible="showCropper"
      title="图片裁剪"
      @before-ok="handleCropOk"
      :mask-closable="false"
    >
      <div class="cropper-container">
        <vue-cropper
          ref="cropperRef"
          :img="cropperImage"
          :info="true"
          :autoCrop="true"
          :fixed="fixed"
          :fixedNumber="[1, 1]"
          :centerBox="true"
          :boxWidth="400"
          :boxHeight="400"
          outputType="png"
          :outputSize="1"
          :full="true"
          maxImgSize="800"
        />
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, watch, toRaw } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { IconPlus } from '@arco-design/web-vue/es/icon'
import { uploadImage, deleteImage } from '@/api/upload'
import { VueCropper } from 'vue-cropper'
import 'vue-cropper/dist/index.css'

const props = defineProps({
  // 上传文本提示
  uploadText: {
    type: String,
    default: '上传图片'
  },
  // 图片URL
  modelValue: {
    type: [String, Array],
    default: ''
  },
  // 限制上传数量
  limit: {
    type: [Number, String],
    default: 1
  },
  // 是否固定比例
  fixed: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

// 文件列表
const fileList = ref([])
// 裁剪相关
const showCropper = ref(false)
const cropperRef = ref(null)
const cropperImage = ref('')
const currentFile = ref(null)

// 监听value变化
watch(
  () => props.modelValue,
  (url) => {
    if (url) {
      if (Array.isArray(url)) {
        fileList.value = url
      } else {
        fileList.value = [
          {
            name: '图片',
            url: url
          }
        ]
      }
    } else {
      fileList.value = []
    }
  },
  { immediate: true }
)

// 上传前处理
const beforeUpload = (file) => {
  // 验证文件类型
  if (!file.type.includes('image/')) {
    Message.error('请上传图片文件')
    return false
  }

  // 读取文件预览
  const reader = new FileReader()
  reader.onload = () => {
    cropperImage.value = reader.result
    currentFile.value = file
    showCropper.value = true
  }
  reader.readAsDataURL(file)

  // 阻止自动上传
  return false
}

//待上传列表
const uploadList = ref([])
// 处理裁剪确认
const handleCropOk = async () => {
  try {
    // 获取裁剪后的blob数据
    const blob = await new Promise((resolve) => {
      cropperRef.value.getCropBlob((data) => {
        resolve(data)
      })
    })

    // 将blob转换为File对象
    const file = new File([blob], currentFile.value.name, {
      type: 'image/png',
      lastModified: Date.now()
    })

    // 构建FormData
    const formData = new FormData()
    formData.append('file', file, file.name)
    // 构建blobUrl
    const blobUrl = URL.createObjectURL(blob)
    uploadList.value.push({
      blobUrl: blobUrl,
      formData: formData
    })

    // 上传图片
    // const result = await uploadImage(formData)

    fileList.value.push({
      name: currentFile.value.name,
      url: blobUrl
    })

    emitValue()
    showCropper.value = false
    return true
  } catch (error) {
    console.error('上传失败:', error)
    Message.error('上传失败')
    return false
  }
}

const emitValue = async () => {
  let value = toRaw(fileList.value)
  if (props.limit == 1) {
    value = value[0]?.url
  }
  // 更新数据
  emit('update:modelValue', value)
  emit('change', value)
}

//待删除列表
const deleteList = ref([])
// 处理删除
const handleRemove = async (file) => {
  if (file.url.startsWith('blob:')) {
    uploadList.value = uploadList.value.filter((item) => item.blobUrl !== file.url)
  } else {
    deleteList.value.push(file.url)
  }
  fileList.value = fileList.value.filter((item) => item.url !== file.url)
  emitValue()
}

const upload = async () => {
  const loading = Message.loading('图片上传中...')
  for (let i = 0; i < uploadList.value.length; i++) {
    const result = await uploadImage(uploadList.value[i].formData)
    fileList.value.map((listItem) => {
      if (listItem.url === uploadList.value[i].blobUrl) {
        listItem.url = result.url
      }
    })
  }
  loading.close()
  emitValue()
  // 删除图片
  uploadList.value = []
  deleteList.value.forEach(async (item) => {
    deleteImage({ url: item })
  })
  deleteList.value = []
}

defineExpose({
  upload
})
</script>

<style lang="less" scoped>
.image-upload {
  .upload-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 80px;
    width: 80px;
    margin-bottom: 8px;
    border: 1px dashed var(--color-border-2);
    border-radius: var(--border-radius-small);

    .upload-text {
      margin-top: 8px;
      font-size: 12px;
      color: var(--color-text-3);
    }
  }

  :deep(.arco-upload-list-picture) {
    display: flex;
    align-items: center;
    justify-content: center;
    img {
      margin: auto;
      height: auto !important;
    }
  }
}

.cropper-container {
  width: 100%;
  height: 400px;
}
</style>
