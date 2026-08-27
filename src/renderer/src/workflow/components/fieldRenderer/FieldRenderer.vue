<template>
  <a-form
    ref="formRef"
    :model="formData"
    :rules="formRules"
    @submit="handleSubmit"
    :layout="layout"
    auto-label-width
    :disabled="isExecuting && !allowExecutingEdit"
    :size="layout === 'horizontal' ? 'mini' : 'small'"
  >
    <template v-for="field in expFields.filter((f) => (f.onlyQuick && isQuickConfig) || !f.onlyQuick)" :key="field.id">
      <a-form-item
        :field="field.id"
        :rules="field.rules"
        :validate-trigger="field.validateTrigger || ['change', 'blur']"
        :class="{
          'arco-form-item-code': field.type === 'code' && !isQuickConfig,
          'no-label': field.nolabel,
        }"
      >
        <template #label>
          <a-space :size="2" v-if="!field.nolabel">
            <a-tooltip v-if="field.description">
              <template #content>
                <div v-html="field.description.replace(/\n/g, '<br />')"></div>
              </template>
              <span>
                <icon-question-circle />
              </span>
            </a-tooltip>
            <span v-if="field.name" class="label">{{ field.name }}</span>
            <ParamRefer
              :field="field"
              @onSelect="selectParamRefer(field.id, $event)"
              :show-trigger="false"
              :all-types="true"
            >
              <a-tooltip content="引用其他节点的输出">
                <div class="param-ref">
                  <icon-code-block />
                </div>
              </a-tooltip>
            </ParamRefer>
          </a-space>
        </template>
        <component
          class="no-wheel no-drag"
          :is="getFieldComponent(field.type)"
          v-model="formData[field.id]"
          :field="field"
          v-bind="field.props"
          v-if="!isParamRefer(formData[field.id])"
          @click.stop
        />
        <a-tag
          v-else
          class="param-tag"
          :class="{ disabled: isExecuting && !allowExecutingEdit }"
          :closable="!isExecuting && !allowExecutingEdit"
          @close="clearParamRefe(field.id)"
        >
          <a-popover>
            <a-space :size="2" class="content">
              <span><icon-common /></span>
              {{ getRefer(formData[field.id]).slice(2, -2) }}
            </a-space>
            <template #content>
              {{ getRefer(formData[field.id]).slice(2, -2) }}
            </template>
          </a-popover>
        </a-tag>
      </a-form-item>
    </template>
  </a-form>
</template>

<script setup>
  import { IconQuestionCircle, IconCodeBlock, IconCommon } from '@arco-design/web-vue/es/icon';
  import { ref, computed, watch, provide, inject } from 'vue';
  import ParamRefer from './components/ParamRefer.vue';
  import fieldRenders from './index.js';
  import {
    parseConfigExpression,
    isParamRefer,
    makeParamReferValue,
    getOldValue,
    getDefaultFieldValue,
    getRefer,
  } from '../../utils';

  const props = defineProps({
    fields: {
      type: Array,
      required: true,
    },
    allowExecutingEdit: {
      type: Boolean,
      default: false,
    },
    isQuickConfig: {
      type: Boolean,
      default: false,
    },
    layout: {
      type: String,
      default: 'horizontal',
    },
  });

  const isExecuting = inject('isExecuting');
  provide('isQuickConfig', props.isQuickConfig);

  const emit = defineEmits(['validate', 'submit']);
  const formRef = ref(null);
  const formData = defineModel({
    set(value) {
      if (value === undefined || value === null || value === '') {
        return {};
      }
      return value;
    },
    default: () => ({}),
  });

  const selectParamRefer = (fieldId, refer) => {
    // 清除字段校验状态
    formRef.value.clearValidate(fieldId);
    formData.value[fieldId] = makeParamReferValue(formData.value[fieldId], refer);
  };

  const clearParamRefe = (fieldId) => {
    const oldValue = getOldValue(formData.value[fieldId]);
    formData.value[fieldId] = oldValue;
  };

  // 设置表单数据
  props.fields.forEach((field) => {
    // 防御：formData 若被污染成字符串/非对象（历史数据把 array 字段包成「数组包字符串」，
    // 或直接赋了参数引用串），跳过字段初始化，避免对字符串赋属性报
    // 「Cannot create property 'xxx' on string」
    if (!formData.value || typeof formData.value !== 'object') {
      return;
    }
    if (!formData.value.hasOwnProperty(field.id)) {
      // console.error(formData.value, field)

      formData.value[field.id] = field.hasOwnProperty('default') ? field.default : getDefaultFieldValue(field);
    }
  });
  // 提供表单数据
  provide('formData', formData);

  // 获取节点数据
  const nodeData = inject('nodeData');

  // 预定义所有字段组件（静态导入，无需异步包装）
  const fieldComponents = Object.fromEntries(fieldRenders.map((r) => [r.name, r.component]));
  fieldComponents._default = fieldComponents.text;

  // 获取字段组件
  const getFieldComponent = (type) => {
    return fieldComponents[type] || fieldComponents.text;
  };

  // 构建表单验证规则（返回新数组，避免 push 污染字段定义共享的 rules）
  const buildRules = (field) => {
    const rules = [...(field.rules || [])];
    if (field.required) {
      rules.push({ required: true, message: field.name + '是必填项' });
    }
    return rules;
  };

  //使用计算属性获取表达式解析后的字段
  const expFields = computed(() => {
    const fields = [];
    const values = { ...nodeData.config, ...formData.value };
    props.fields.forEach((field) => {
      const fieldCacheKey = field.id + '_show';
      // Only re-evaluate parseConfigExpression if values changed (computed dependency tracks this)
      const shouldShow = field.hasOwnProperty('show')
        ? parseConfigExpression(props.fields, 'show', field.show, values)
        : true;

      if (!shouldShow) return;

      const newField = { ...field };
      newField.rules = buildRules(newField);
      fields.push(newField);
    });
    return fields;
  });

  // 构建表单验证规则
  const formRules = computed(() => {
    const rules = {};
    props.fields.forEach((field) => {
      if (field.rules) {
        rules[field.id] = field.rules;
      }
    });
    return rules;
  });

  // 表单提交
  const handleSubmit = async (e) => {
    if (validate()) {
      emit('submit', formData.value);
    }
  };

  // 表单验证
  const validate = async (returnErrors = false) => {
    const error = await formRef.value.validate();
    if (returnErrors) {
      emit('validate', error);
      return error;
    } else {
      emit('validate', !error);
      return !error;
    }
  };

  defineExpose({
    validate,
  });
</script>

<style scoped lang="less">
  .arco-form-item {
    margin-bottom: 2px;
    &:last-child {
      margin-bottom: 0;
    }
    // .label {
    //   height: 24px;
    // }
    .param-ref {
      cursor: pointer;
      // position: absolute;
      // top: 0px;
      :hover {
        color: #000;
        font-weight: bold;
      }
    }
    .param-tag {
      max-width: 100%;
      & .content {
        max-width: 100%;
        padding: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      &.disabled {
        color: var(--color-text-4);
        background-color: var(--color-fill-2);
        border-color: transparent;
        cursor: not-allowed;
      }
    }
  }

  :deep(.arco-form-item-code) {
    min-width: 400px;
  }
  :deep(.no-label > .arco-form-item-label-col) {
    display: none;
  }
  :deep(.arco-form-item-label-col) {
    padding-right: 2px;
  }
  :deep(.arco-form-item-layout-vertical > .arco-form-item-label-col) {
    margin-bottom: 0px;
    // margin-top: 8px;
    // font-weight: bold;
  }
  .arco-form-layout-vertical > .arco-form-item {
    margin-bottom: 8px;
  }
  .arco-form-layout-vertical .arco-tag {
    height: 28px;
    font-size: 14px;
  }
</style>
