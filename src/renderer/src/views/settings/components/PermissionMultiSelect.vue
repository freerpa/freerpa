<template>
  <div class="perm-multi">
    <!-- 已选项：标签显示，可删除 -->
    <div class="tag-list" v-if="modelValue.length">
      <a-tag v-for="(v, i) in modelValue" :key="i" closable @close="removeItem(i)">
        {{ v }}
      </a-tag>
    </div>
    <!-- 添加：auto-complete 输入（预设联想），回车/选择加入 -->
    <a-input-group style="width: 100%">
      <a-auto-complete
        v-model="inputValue"
        :data="optionValues"
        allowClear="true"
        :placeholder="placeholder"
        style="width: 100%"
        @select="addItem"
        @press-enter="addItem"
      />
      <a-button type="primary" @click="addItem">添加</a-button>
    </a-input-group>
  </div>
</template>

<script setup>
  import { ref, computed } from 'vue';

  const props = defineProps({
    modelValue: { type: Array, default: () => [] },
    // 预设选项：字符串或 [{ label, value }]（auto-complete 联想候选）
    options: { type: Array, default: () => [] },
    placeholder: { type: String, default: '输入后回车添加' },
  });
  const emit = defineEmits(['update:modelValue']);
  const inputValue = ref('');

  const optionValues = computed(() => props.options.map((o) => (typeof o === 'string' ? o : o.value)));

  const addItem = () => {
    const v = inputValue.value.trim();
    if (v && !props.modelValue.includes(v)) {
      emit('update:modelValue', [...props.modelValue, v]);
    }
    inputValue.value = '';
  };
  const removeItem = (i) => {
    const next = [...props.modelValue];
    next.splice(i, 1);
    emit('update:modelValue', next);
  };
</script>

<style lang="less" scoped>
  .perm-multi {
    width: 100%;
    .tag-list {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }
  }
</style>
