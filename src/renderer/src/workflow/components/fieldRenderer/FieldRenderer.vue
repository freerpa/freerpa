<template>
  <a-form
    ref="formRef"
    class="field-form"
    :class="`field-form--${layout}`"
    :model="formData"
    :rules="formRules"
    @submit="handleSubmit"
    :layout="layout"
    auto-label-width
    :disabled="isExecuting && !allowExecutingEdit"
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
  import { ref, computed, provide, inject } from 'vue';
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
  // 对象字段继承父级布局（数组项固定横排，不在此列）
  provide('fieldLayout', props.layout);

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
    if (!Object.hasOwn(formData.value, field.id)) {
      // console.error(formData.value, field)

      formData.value[field.id] = Object.hasOwn(field, 'default') ? field.default : getDefaultFieldValue(field);
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
      // Only re-evaluate parseConfigExpression if values changed (computed dependency tracks this)
      const shouldShow = Object.hasOwn(field, 'show')
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
  const handleSubmit = async () => {
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
  /**
   * 按表单尺寸统一控件高度与字体，供 Text / Alert 等自定义容器读取。
   * mini 24 / small 28 / medium 32 / large 36（--field-input-height 为去掉 1px 描边后的内部高度）
   */
  .field-form {
    &.arco-form-size-mini {
      --field-control-height: 24px;
      --field-input-height: 22px;
      --field-font-size: 12px;
      --field-line-height: 20px;
      --field-textarea-padding: 1px 12px;
    }
    &.arco-form-size-small {
      --field-control-height: 28px;
      --field-input-height: 26px;
      --field-font-size: 14px;
      --field-line-height: 22px;
      --field-textarea-padding: 2px 12px;
    }
    &.arco-form-size-medium {
      --field-control-height: 32px;
      --field-input-height: 30px;
      --field-font-size: 14px;
      --field-line-height: 22px;
      --field-textarea-padding: 4px 12px;
    }
    &.arco-form-size-large {
      --field-control-height: 36px;
      --field-input-height: 34px;
      --field-font-size: 14px;
      --field-line-height: 22px;
      --field-textarea-padding: 6px 12px;
    }
  }

  // 横排/竖排都让控件成为 flex 项：既保证 switch 等较矮控件垂直居中，
  // 也消除 inline-flex 控件（select/input）因基线不同产生的额外行高
  .field-form :deep(.arco-form-item-content) {
    display: flex;
    align-items: center;
    min-width: 0;
  }

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

  // 代码字段仅在横排（画布节点）下需要更宽的行内空间；竖排抽屉里强制 400px 会造成横向溢出
  .field-form--horizontal :deep(.arco-form-item-code) {
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
  // 参数引用标签与同尺寸控件等高（横排 mini / 抽屉 small 都适用）
  .arco-form-item .arco-tag {
    height: var(--field-control-height, 24px);
    font-size: var(--field-font-size, 12px);
  }
</style>
