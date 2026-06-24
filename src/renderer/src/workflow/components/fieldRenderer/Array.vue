<template>
  <div class="array-field">
    <!-- 数组项列表 -->
    <VueDraggable class="array-items" v-model="arrayData" handle=".sort-handle">
      <div v-for="(item, index) in arrayData" :key="Math.random()" class="array-item">
        <!-- 操作按钮 -->
        <div class="array-item-actions">
          <div class="sort-handle">
            <icon-list size="12" />
          </div>
          <div class="delete-handle" @click="removeItem(index)">
            <icon-close size="12" />
          </div>
        </div>
        <div class="array-item-content">
          <!-- 渲染数组项的字段 -->
          <field-renderer
            v-model="arrayData[index]"
            :is-quick-config="isQuickConfig"
            :fields="
              itemFields || [
                {
                  id: 'value',
                  name: '值',
                  type: field.itemType || 'text'
                }
              ]
            "
          />
        </div>
      </div>
    </VueDraggable>

    <!-- 添加按钮 -->
    <div class="array-actions">
      <a-button-group>
        <a-button
          type="secondary"
          size="mini"
          @click="addItem"
          :disabled="field.maxItems && value.length >= field.maxItems"
        >
          <icon-plus />
          添加{{ field.name || '项' }}
        </a-button>
        <a-button v-if="field.codeView" type="secondary" size="mini" @click="showCodeEditor">
          <icon-code />
          代码视图
        </a-button>
        <a-popconfirm
          v-model:visible="popupVisible"
          v-if="arrayData?.length > 0"
          :content="`确定清空所有${field.name || '项'}？`"
          @ok="clear"
        >
          <a-button type="secondary" size="mini" @click.stop="popupVisible = true">
            <icon-delete />
            清空
          </a-button>
        </a-popconfirm>
      </a-button-group>
    </div>

    <a-modal
      v-model:visible="visible"
      title="代码视图"
      :width="800"
      unmount-on-close
      @before-ok="handleCodeEditorOk"
    >
      <codemirror
        v-model="code"
        :style="{ height: '400px' }"
        :autofocus="false"
        :indent-with-tab="true"
        :tab-size="2"
        @keydown="unDoReDoInterceptor"
        @keyup="unDoReDoInterceptor"
        :extensions="extensions"
      />
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue'
import { IconList, IconClose, IconPlus, IconCode, IconDelete } from '@arco-design/web-vue/es/icon'
import { Message } from '@arco-design/web-vue'
import FieldRenderer from './FieldRenderer.vue'
import { Codemirror } from 'vue-codemirror'
import { json } from '@codemirror/lang-json'
import { EditorView } from '@codemirror/view'
import { getDefaultFieldValue, unDoReDoInterceptor } from '@/workflow/utils'
import { VueDraggable } from 'vue-draggable-plus'

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const visible = ref(false)
const popupVisible = ref(false)
const code = ref('')

const getCode = () => {
  if (props.field?.codeView?.type == 'object') {
    const kvcode = {}
    arrayData.value.forEach((item) => {
      kvcode[item[props.field.codeView.key]] = item[props.field.codeView.value]
    })
    return JSON.stringify(kvcode, null, 2)
  } else {
    return JSON.stringify(arrayData.value, null, 2)
  }
}

const getArrayData = () => {
  const data = JSON.parse(code.value)
  if (props.field?.codeView?.type == 'object') {
    return Object.keys(data).map((key) => ({
      [props.field.codeView.key]: key,
      [props.field.codeView.value]: data[key]
    }))
  } else {
    return data
  }
}

const showCodeEditor = () => {
  visible.value = true
  code.value = getCode()
}
const handleCodeEditorOk = (done) => {
  try {
    arrayData.value = getArrayData()
  } catch (error) {
    Message.error('代码格式错误')
    done(false)
    return
  }
  done(true)
}

// 编辑器扩展配置
const extensions = computed(() => {
  const exts = [EditorView.lineWrapping, json()]
  return exts
})

const arrayData = defineModel({ type: Array })
if (!arrayData.value) {
  arrayData.value = []
}

const itemFields = computed(() => {
  return Object.keys(props.field.fields || {}).map((key) => props.field.fields[key])
})
const isQuickConfig = inject('isQuickConfig')
const formData = inject('formData')
watch(arrayData, (value) => {
  if (props.field.hasOwnProperty('onChange')) {
    props.field.onChange(value, formData)
  }
})

// 清空
const clear = () => {
  arrayData.value = []
}

// 添加项
const addItem = () => {
  const defaultValue = {}
  itemFields.value.forEach((field) => {
    defaultValue[field.id] = getDefaultFieldValue(field)
  })
  arrayData.value.push(defaultValue)
}

// 移除项
const removeItem = (index) => {
  arrayData.value.splice(index, 1)
}
</script>

<style lang="less" scoped>
.array-field {
  width: 100%;

  .array-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .array-item {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--color-border);
    border-radius: 4px;

    .array-item-content {
      flex: 1;
      width: 100%;
    }

    .array-item-actions {
      width: 100%;
      height: 12px;
      display: flex;
      justify-content: space-between;
      padding-top: 2px;
      margin-top: -4px;
      .sort-handle {
        cursor: move;
        width: 12px;
        height: 12px;
        line-height: 12px;
        text-align: center;
        border-radius: 4px;
      }
      .delete-handle {
        cursor: pointer;
        width: 12px;
        height: 12px;
        line-height: 12px;
        text-align: center;
        border-radius: 4px;
      }
      button {
        padding: 0px;
        height: 12px;
        line-height: 12px;
      }
    }
  }

  .array-actions {
    margin-top: 2px;
    .arco-btn-group {
      border-radius: var(--border-radius-small);
      overflow: hidden;
    }
  }
}
:deep(.cm-editor) {
  width: 100%;
  height: 400px;
  cursor: text;
  border-radius: var(--border-radius-small);
  background-color: var(--color-fill-2);
  &.cm-focused {
    outline: none;
  }
  .cm-gutters.cm-gutters-before {
    display: none;
  }
  .cm-activeLine {
    background-color: transparent;
  }
  .cm-content {
    padding: 4px 0;
    // background-color: var(--color-fill-1);
  }
}
</style>
