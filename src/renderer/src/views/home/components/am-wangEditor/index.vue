<template>
  <div class="am-wang-editor">
    <Toolbar
      style="border-bottom: 1px solid var(--color-border-1)"
      :editor="editorRef"
      :defaultConfig="toolbarConfig"
    />
    <Editor
      class="am-wang-editor-content"
      v-model="valueHtml"
      :defaultConfig="editorConfig"
      @onCreated="handleCreated"
    />
  </div>
</template>

<script setup>
import '@wangeditor/editor/dist/css/style.css' // 引入 css

import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { debounce } from 'lodash-es'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { uploadImage, deleteImage } from '@/api/upload'

const props = defineProps({
  placeholder: {
    type: String,
    default: '请输入内容...'
  }
})

// 编辑器实例，必须用 shallowRef
const editorRef = shallowRef()

// 内容 HTML
const valueHtml = defineModel('modelValue')

const toolbarConfig = {
  toolbarKeys: [
    'headerSelect',
    'blockquote',
    'bold',
    'underline',
    'italic',
    {
      key: 'group-more-style',
      title: '更多',
      iconSvg:
        '<svg viewBox="0 0 1024 1024"><path d="M204.8 505.6m-76.8 0a76.8 76.8 0 1 0 153.6 0 76.8 76.8 0 1 0-153.6 0Z"></path><path d="M505.6 505.6m-76.8 0a76.8 76.8 0 1 0 153.6 0 76.8 76.8 0 1 0-153.6 0Z"></path><path d="M806.4 505.6m-76.8 0a76.8 76.8 0 1 0 153.6 0 76.8 76.8 0 1 0-153.6 0Z"></path></svg>',
      menuKeys: ['through', 'code', 'sup', 'sub', 'clearStyle']
    },
    'color',
    'bgColor',
    'fontSize',
    'fontFamily',
    'lineHeight',
    'bulletedList',
    'numberedList',
    {
      key: 'group-justify',
      title: '对齐',
      iconSvg:
        '<svg viewBox="0 0 1024 1024"><path d="M768 793.6v102.4H51.2v-102.4h716.8z m204.8-230.4v102.4H51.2v-102.4h921.6z m-204.8-230.4v102.4H51.2v-102.4h716.8zM972.8 102.4v102.4H51.2V102.4h921.6z"></path></svg>',
      menuKeys: ['justifyLeft', 'justifyRight', 'justifyCenter', 'justifyJustify']
    },
    {
      key: 'group-indent',
      title: '缩进',
      iconSvg:
        '<svg viewBox="0 0 1024 1024"><path d="M0 64h1024v128H0z m384 192h640v128H384z m0 192h640v128H384z m0 192h640v128H384zM0 832h1024v128H0z m0-128V320l256 192z"></path></svg>',
      menuKeys: ['indent', 'delIndent']
    },
    'emotion',
    'insertLink',
    {
      key: 'group-image',
      title: '图片',
      iconSvg:
        '<svg viewBox="0 0 1024 1024"><path d="M959.877 128l0.123 0.123v767.775l-0.123 0.122H64.102l-0.122-0.122V128.123l0.122-0.123h895.775zM960 64H64C28.795 64 0 92.795 0 128v768c0 35.205 28.795 64 64 64h896c35.205 0 64-28.795 64-64V128c0-35.205-28.795-64-64-64zM832 288.01c0 53.023-42.988 96.01-96.01 96.01s-96.01-42.987-96.01-96.01S682.967 192 735.99 192 832 234.988 832 288.01zM896 832H128V704l224.01-384 256 320h64l224.01-192z"></path></svg>',
      menuKeys: ['insertImage', 'uploadImage']
    },
    'insertVideo',
    'insertTable',
    'codeBlock',
    'divider',
    'undo',
    'redo'
  ]
}
const editorConfig = { placeholder: props.placeholder, MENU_CONF: {} }

let UploadImageList = []
let AllOldImageList = []
editorConfig.MENU_CONF['uploadImage'] = {
  async customUpload(file, insertFn) {
    // 构建FormData
    const formData = new FormData()
    formData.append('file', file, file.name)

    // 上传图片
    const result = await uploadImage(formData)
    UploadImageList.push(result.url)
    insertFn(result.url, '', result.url)
  }
}

defineExpose({
  deleteImage(isSubmit = false) {
    const allImages = editorRef.value.getElemsByType('image').map((item) => item.src)
    let deleteImageList = []
    if (!isSubmit) {
      // 如果没有提交，则删除所有图片
      deleteImageList = UploadImageList
    } else {
      // 如果提交了则对比 AllOldImageList 和 allImages 的 url ,不同的就是删除的
      deleteImageList = AllOldImageList.filter((url) => !allImages.includes(url))
    }
    deleteImageList.forEach(async (url) => {
      deleteImage({ url })
    })
  }
})

// 组件销毁时，也及时销毁编辑器
onBeforeUnmount(() => {
  const editor = editorRef.value
  if (editor == null) return
  editor.destroy()
})

const handleCreated = (editor) => {
  editorRef.value = editor // 记录 editor 实例，重要！
}

const getImageList = () => {
  const imageList = editorRef.value.getElemsByType('image')
  //和UploadImageList合并并去重,只增不减，保留所有记录
  AllOldImageList = [...new Set([...AllOldImageList, ...imageList.map((item) => item.src)])]
}

watch(
  valueHtml,
  debounce(() => {
    getImageList()
  }, 500)
)
</script>

<style lang="less" scoped>
.am-wang-editor {
  height: 100%;
  width: 100%;
  border: 1px solid var(--color-border-1);
}
.am-wang-editor-content {
  height: calc(100% - 81px) !important;
  overflow-y: auto;
}
</style>
