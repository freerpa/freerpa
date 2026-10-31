<template>
  <div class="ref-menu" @mousedown.prevent @click.stop>
    <!-- 资源类型 tabs -->
    <div class="ref-menu__tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="ref-menu__tab"
        :class="{ 'is-active': activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        <component :is="tab.icon" :size="13" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- 当前类型的资源列表 -->
    <div ref="listRef" class="ref-menu__list">
      <div v-if="loading" class="ref-menu__empty">正在加载…</div>
      <template v-else>
        <div
          v-for="(item, index) in filtered"
          :key="item.id"
          class="ref-menu__item"
          :class="{ 'is-active': index === activeIndex }"
          @mouseenter="activeIndex = index"
          @click="pickItem(item)"
        >
          <component :is="activeTabMeta.icon" :size="13" />
          <span class="ref-menu__name">{{ item.name }}</span>
          <span v-if="item.id" class="ref-menu__id">{{ item.id }}</span>
        </div>
        <div v-if="filtered.length === 0" class="ref-menu__empty">暂无{{ activeTabMeta.label }}</div>
      </template>
    </div>

    <div class="ref-menu__hint">↑↓ 选择 · Tab 切换类型 · Enter 确认 · Esc 关闭</div>
  </div>
</template>

<script setup>
  import { ref, reactive, computed, watch, nextTick, onMounted } from 'vue';
  import { RiFlowChart, RiDatabase2Line, RiGlobalLine, RiStackLine } from '@remixicon/vue';
  import { RESOURCE_TABS, loadResourceType } from '../resourceIndex';

  /**
   * @file: @ 资源引用菜单（输入 @ 时唤起）
   * tabs 列出全部可引用资源：工作流 / 数据表 / 浏览器 / 元素集。
   * 列表按需加载并缓存；输入 @ 后的关键字实时过滤当前 tab。
   */
  const props = defineProps({
    keyword: {
      type: String,
      default: '',
    },
  });

  const emit = defineEmits(['pick']);

  // 图标只在 UI 层绑定；数据源（IPC 加载 + 缓存）统一由 resourceIndex 提供
  const tabIcons = {
    workflow: RiFlowChart,
    table: RiDatabase2Line,
    browser: RiGlobalLine,
    element: RiStackLine,
  };
  const tabs = RESOURCE_TABS.map((tab) => ({ ...tab, icon: tabIcons[tab.key] }));

  const activeTab = ref('workflow');
  const activeIndex = ref(0);
  const listRef = ref(null);
  const cache = reactive({});
  // 按 tab 记录加载态：切换 tab 时不会互相干扰
  const loadingTabs = reactive({});
  const loading = computed(() => !!loadingTabs[activeTab.value]);

  const activeTabMeta = computed(() => tabs.find((t) => t.key === activeTab.value) || tabs[0]);

  const filtered = computed(() => {
    const list = cache[activeTab.value] || [];
    const kw = props.keyword.trim().toLowerCase();
    return kw ? list.filter((item) => item.name.toLowerCase().includes(kw)) : list;
  });

  const load = async (key) => {
    if (cache[key]) return;
    const tab = tabs.find((t) => t.key === key);
    if (!tab) return;
    loadingTabs[key] = true;
    try {
      cache[key] = (await loadResourceType(key)).map((item) => ({
        id: item.id,
        name: item.name,
      }));
    } finally {
      loadingTabs[key] = false;
    }
  };

  onMounted(() => load(activeTab.value));

  const switchTab = (key) => {
    if (activeTab.value === key) return;
    activeTab.value = key;
    activeIndex.value = 0;
    if (!cache[key]) load(key);
  };

  // 关键字 / 类型变化后重置选中项，并保证选中项在可视区内
  watch([() => props.keyword, activeTab], () => {
    activeIndex.value = 0;
    scrollActiveIntoView();
  });

  watch(filtered, () => {
    if (activeIndex.value >= filtered.value.length) activeIndex.value = 0;
  });

  watch(activeIndex, () => scrollActiveIntoView());

  const scrollActiveIntoView = () => {
    nextTick(() => {
      listRef.value?.querySelector('.ref-menu__item.is-active')?.scrollIntoView({ block: 'nearest' });
    });
  };

  const move = (delta) => {
    const total = filtered.value.length;
    if (total === 0) return;
    activeIndex.value = (activeIndex.value + delta + total) % total;
  };

  const nextTab = () => {
    const index = tabs.findIndex((t) => t.key === activeTab.value);
    switchTab(tabs[(index + 1) % tabs.length].key);
  };

  const pickItem = (item) => {
    emit('pick', { ...item, type: activeTab.value });
  };

  const activeItem = () => {
    const item = filtered.value[activeIndex.value];
    return item ? { ...item, type: activeTab.value } : null;
  };

  defineExpose({ move, nextTab, activeItem });
</script>

<style scoped lang="less">
  .ref-menu {
    display: flex;
    flex-direction: column;
    background: rgba(250, 250, 252, 0.94);
    -webkit-backdrop-filter: saturate(180%) blur(28px);
    backdrop-filter: saturate(180%) blur(28px);
    border: 0.5px solid rgba(0, 0, 0, 0.1);
    border-radius: var(--mac-radius-sm);
    box-shadow: var(--mac-shadow-3);
    overflow: hidden;

    &__tabs {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 4px;
      border-bottom: 0.5px solid var(--mac-separator);
      background: rgba(255, 255, 255, 0.35);
    }

    &__tab {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 1;
      justify-content: center;
      padding: 5px 4px;
      border: none;
      border-radius: var(--mac-radius-control-sm);
      background: transparent;
      font-size: 12px;
      color: var(--mac-text-2);
      cursor: pointer;
      white-space: nowrap;
      transition:
        background 0.15s ease,
        color 0.15s ease;

      &:hover {
        color: var(--mac-text);
        background: var(--mac-fill);
      }

      &.is-active {
        color: var(--mac-text);
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      }
    }

    &__list {
      max-height: 224px;
      overflow-y: auto;
      padding: 4px;
    }

    &__item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 8px;
      border-radius: var(--mac-radius-control-sm);
      font-size: 13px;
      color: var(--mac-text);
      cursor: pointer;

      &.is-active {
        background: var(--mac-accent-soft);
        color: var(--mac-accent);
      }

      :deep(svg) {
        flex-shrink: 0;
        color: var(--mac-text-2);
      }
    }

    &__name {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &__id {
      flex-shrink: 0;
      max-width: 40%;
      font-size: 11px;
      color: var(--mac-text-3);
      font-family: var(--mac-font-mono);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &__empty {
      padding: 16px 8px;
      text-align: center;
      font-size: 12px;
      color: var(--mac-text-3);
    }

    &__hint {
      padding: 5px 8px;
      border-top: 0.5px solid var(--mac-separator);
      font-size: 11px;
      color: var(--mac-text-3);
      background: rgba(255, 255, 255, 0.35);
    }
  }
</style>
