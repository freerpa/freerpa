<template>
  <div class="element-item" :class="{ 'no-remove': !showRemove }">
    <!-- 匹配条件 + 名称 + 删除 合并行 -->
    <div class="name-row">
      <span class="name-label">元素名称</span>
      <a-input size="medium" v-model="model.name" placeholder="元素名称" allow-clear class="name-input" />
      <a-button v-if="showRemove" size="medium" type="text" status="danger" @click="emit('remove')">
        <template #icon><icon-delete /></template>
      </a-button>
    </div>
    <div class="selector-header">
      <div class="match-condition">
        <span class="match-condition-label" style="width: 60px">匹配模式</span>
        <a-radio-group v-model="model.match_condition" type="button" size="mini">
          <a-radio value="any">任一匹配</a-radio>
          <a-radio value="all">全部匹配</a-radio>
        </a-radio-group>
      </div>

      <a-button type="secondary" @click="addSelector" size="mini">
        <template #icon><RiCrosshair2Line /></template>
        添加选择器
      </a-button>
    </div>
    <!-- 选择器表格（可拖拽排序） -->
    <a-table
      :data="model.selectors"
      :bordered="false"
      :pagination="false"
      :hoverable="false"
      :show-header="false"
      size="mini"
      @change="onTableChange"
      :draggable="{ type: 'handle', width: 24 }"
      class="selector-table"
    >
      <template #empty>
        <div class="empty-state">暂无选择器</div>
      </template>
      <template #columns>
        <a-table-column :width="90">
          <template #cell="{ record }">
            <a-select v-model="record.type" size="mini" style="width: 100%" @change="onSelectorTypeChange(record)">
              <a-option value="css">CSS</a-option>
              <a-option value="xpath">XPath</a-option>
              <a-option value="image">截图</a-option>
              <a-option value="text">文本</a-option>
              <a-option value="position">坐标</a-option>
            </a-select>
          </template>
        </a-table-column>
        <a-table-column>
          <template #cell="{ record }">
            <div class="expr-cell">
              <!-- 文本类型：子类型 + 表达式 -->
              <template v-if="record.type === 'text'">
                <a-select v-model="record.text_subtype" size="mini" style="width: 80px" class="text-sub-select">
                  <a-option value="start">开头</a-option>
                  <a-option value="end">结束</a-option>
                  <a-option value="equals">等于</a-option>
                  <a-option value="contains">包含</a-option>
                </a-select>
                <a-input
                  v-model="record.expression"
                  size="mini"
                  placeholder="匹配文本"
                  allow-clear
                  class="expr-input"
                />
              </template>
              <!-- 图片类型 -->
              <template v-else-if="record.type === 'image'">
                <a-space size="mini">
                  <a-button size="mini" @click="handleUpload(record)">上传</a-button>
                  <a-button size="mini" @click="handlePaste(record)">粘贴</a-button>
                </a-space>
                <a-image v-if="record.expression" height="24" :src="record.expression" />
                <span v-if="record._sizeError" class="size-error">超过500KB</span>
                <input
                  type="file"
                  accept="image/*"
                  style="display: none"
                  :ref="(el) => (fileInputs[record._key] = el)"
                  @change="(e) => onFileChange(e, record)"
                />
              </template>
              <!-- 其他类型 -->
              <a-input
                v-else
                v-model="record.expression"
                size="mini"
                :placeholder="getPlaceholder(record.type)"
                allow-clear
                class="expr-input"
              />
            </div>
          </template>
        </a-table-column>
        <a-table-column :width="36" align="center">
          <template #cell="{ rowIndex }">
            <a-button type="text" size="mini" status="danger" @click="removeSelector(rowIndex)">
              <template #icon><icon-minus-circle-fill /></template>
            </a-button>
          </template>
        </a-table-column>
      </template>
    </a-table>
  </div>
</template>

<script setup>
  import { ref } from 'vue';
  import { Message } from '@arco-design/web-vue';
  import { IconDelete, IconPlus, IconMinusCircleFill } from '@arco-design/web-vue/es/icon';
  import { RiCrosshair2Line } from '@remixicon/vue';

  const props = defineProps({
    index: { type: Number, default: 0 },
    showRemove: { type: Boolean, default: true },
  });

  const model = defineModel({ type: Object, required: true });
  const emit = defineEmits(['remove']);

  let _keyCounter = 10000;
  const newSelector = () => ({
    _key: ++_keyCounter,
    type: 'css',
    text_subtype: '',
    expression: '',
    _sizeError: false,
  });

  const addSelector = () => {
    if (!model.value.selectors) model.value.selectors = [];
    model.value.selectors.push(newSelector());
  };

  const removeSelector = (i) => model.value.selectors.splice(i, 1);

  const onTableChange = (data) => {
    model.value.selectors = data;
  };

  const onSelectorTypeChange = (record) => {
    record.expression = '';
    record.text_subtype = 'equals';
    record._sizeError = false;
  };

  const getPlaceholder = (type) => {
    return { css: '.class-name', xpath: '//div[@id]', position: 'x,y,w,h' }[type] || '表达式';
  };

  // ─── 图片处理 ──────────────────────────
  const MAX_SIZE = 500 * 1024;
  const fileInputs = ref({});

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      if (file.size > MAX_SIZE) {
        reject(new Error('超过500KB'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = (record) => {
    fileInputs.value[record._key]?.click();
  };

  const onFileChange = async (e, record) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      record._sizeError = false;
      record.expression = await fileToBase64(file);
    } catch {
      record._sizeError = true;
      Message.error('图片超过500KB限制');
    }
    if (fileInputs.value[record._key]) fileInputs.value[record._key].value = '';
  };

  const handlePaste = async (record) => {
    try {
      record._sizeError = false;
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageTypes = item.types.filter((t) => t.startsWith('image/'));
        if (imageTypes.length > 0) {
          const blob = await item.getType(imageTypes[0]);
          if (blob.size > MAX_SIZE) {
            record._sizeError = true;
            Message.error('图片超过500KB限制');
            return;
          }
          const reader = new FileReader();
          record.expression = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          return;
        }
      }
      Message.warning('剪贴板中没有图片');
    } catch {
      Message.error('读取剪贴板失败');
    }
  };
</script>

<style lang="less" scoped>
  .no-remove {
    border: none !important;
  }
  .element-item {
    margin-bottom: 8px;
    border: 1px solid var(--color-border-2);
    border-radius: var(--border-radius-small);
    padding: 8px;
    box-sizing: border-box;
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    .name-label {
      width: 60px;
    }
    .name-input {
      flex: 1;
    }
  }

  .selector-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    .match-condition {
      display: flex;
      align-items: center;
      gap: 8px;
      .match-condition-label {
        width: 60px;
      }
    }
  }

  .selector-table {
    :deep(.arco-table-cell) {
      padding: 3px 6px;
    }
    :deep(.arco-table-td) {
      border: none;
    }
    :deep(.arco-table-th) {
      display: none;
    }
    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      padding: 1px;
      color: var(--color-text-3);
    }
  }

  .expr-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    .text-sub-select {
      flex-shrink: 0;
    }
    .expr-input {
      flex: 1;
      min-width: 60px;
    }
  }

  .image-thumb {
    width: 36px;
    height: 24px;
    object-fit: cover;
    display: block;
  }

  .size-error {
    color: rgb(var(--danger-6));
    font-size: 11px;
  }
</style>
