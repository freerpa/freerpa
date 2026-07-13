<template>
  <a-cascader
    v-model="pathValue"
    :placeholder="field.description || '选择浏览器'"
    :loading="loading"
    :disabled="field.disabled"
    :options="treeOptions"
    allow-search
    allow-clear
    @change="onCascaderChange"
    @click.stop="loadData"
    @keydown="unDoReDoInterceptor"
    @keyup="unDoReDoInterceptor"
  />
</template>

<script setup>
  import { ref, watch, onMounted } from 'vue';
  import { useFieldWatch } from './composables/useFieldValue';
  import { unDoReDoInterceptor } from '@/workflow/utils';

  const { browserLocal, category } = window.electronAPI;

  const props = defineProps({
    field: { type: Object, required: true },
  });

  const value = defineModel();
  useFieldWatch(props, value);

  const loading = ref(false);
  const treeOptions = ref([]);
  const pathValue = ref('');

  const loadData = async () => {
    loading.value = true;
    try {
      const [cats, res] = await Promise.all([
        category.getCategories('browser').catch(() => []),
        browserLocal.getBrowsers({ page: 1, pageSize: 1000 }),
      ]);
      const browsers = (res && res.data) || [];

      const tree = [];
      const matchedIds = new Set();
      for (const c of cats) {
        const children = browsers
          .filter((b) => b.category_id === c.id)
          .map((b) => {
            matchedIds.add(b.id);
            return { label: b.name, value: b.id };
          });
        if (children.length) {
          tree.push({ label: c.name, value: c.id, children });
        }
      }

      // 未分类的归入「全部」
      const uncategorized = browsers.filter((b) => !b.category_id || !matchedIds.has(b.id));
      if (uncategorized.length) {
        tree.push({
          label: '未分类',
          value: '_uncategorized',
          children: uncategorized.map((b) => ({ label: b.name, value: b.id })),
        });
      }
      treeOptions.value = tree;
    } catch (err) {
      console.error('Browser loadData failed:', err);
    } finally {
      loading.value = false;
    }
  };

  onMounted(loadData);

  const onCascaderChange = (val) => {
    value.value = val || '';
  };

  // 回显：value 变化时同步到 pathValue
  watch(
    () => value.value,
    (val) => {
      pathValue.value = val || '';
    }
  );

  // 数据加载后回显
  watch(treeOptions, (opts) => {
    if (value.value && opts.length) {
      pathValue.value = value.value;
    }
  });
</script>
