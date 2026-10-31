<!--
  @file: 多线程执行面板
  - 「多线程」：填写数量点击执行即并发启动 N 条线程（创建即执行，无并发上限、不排队）
  - 执行中禁止再次执行，按钮只保留「执行 / 停止」；停止 = 终止全部线程并保留本轮记录（下次执行时清空）
  - 数据源为模块级单例 BatchRunner（不持有线程生命周期：关闭面板/离开页面都不停止线程）
  - 列表仅展示：编号、运行状态、错误信息；底部统计：总线程数 / 运行中 / 失败 / 成功 / 本轮总耗时
-->
<template>
  <div class="batch">
    <div class="batch__header">
      <span class="batch__title">多线程 · 批量执行</span>
      <a-button type="text" size="mini" @click="emit('close')">
        <template #icon><icon-close /></template>
      </a-button>
    </div>

    <div class="batch__actions">
      <a-input-number v-model="count" :min="1" :max="999" size="small" style="width: 150px" :disabled="hasLive">
        <template #prefix>数量</template>
      </a-input-number>
      <a-checkbox v-model="retryOnError" :disabled="hasLive">错误重试</a-checkbox>
      <a-button-group class="batch__actions-btns">
        <a-button type="primary" size="small" :loading="hasLive" :disabled="hasLive" @click="onCreate">
          <template #icon><icon-play-circle /></template>
          执行
        </a-button>
        <a-button type="primary" status="danger" size="small" :disabled="!hasLive" @click="runner.terminate()">
          <template #icon><icon-pause-circle /></template>
          停止
        </a-button>
      </a-button-group>
    </div>

    <div class="batch__list">
      <a-empty v-if="rows.length === 0" description="暂无线程，填写数量后点击执行" />
      <div v-for="row in rows" :key="row.rowId" class="batch-row">
        <span class="batch-row__no">#{{ row.no }}</span>
        <div class="batch-row__error" :title="row.errorMsg">{{ row.errorMsg }}</div>
        <a-tag class="batch-row__status" :color="statusColor(row.status)" size="small">
          {{ statusText(row.status) }}
        </a-tag>
      </div>
    </div>

    <div class="batch__stats">
      <span>共 {{ rows.length }} 条线程</span>
      <span>运行中 {{ activeCount }}</span>
      <span>失败 {{ failedCount }}</span>
      <span>成功 {{ completedCount }}</span>
      <span class="batch__stats-elapsed">总耗时 {{ elapsedText }}</span>
    </div>
  </div>
</template>

<script setup>
  import { computed, onBeforeUnmount, ref, watch } from 'vue';
  import { Message } from '@arco-design/web-vue';
  import { IconClose, IconPlayCircle, IconPauseCircle } from '@arco-design/web-vue/es/icon';
  import { getRunner } from '../batch/BatchRunner';

  const props = defineProps({
    workflowId: { type: [String, Number], required: true },
  });
  const emit = defineEmits(['close']);

  const runner = computed(() => getRunner(props.workflowId));
  const rows = computed(() => runner.value.state.rows);
  const activeCount = computed(() => runner.value.activeCount);
  const hasLive = computed(() => runner.value.hasLive);
  const failedCount = computed(() => rows.value.filter((row) => row.status === 'error').length);
  const completedCount = computed(() => rows.value.filter((row) => row.status === 'completed').length);

  // 本轮总耗时：执行中每秒刷新，最后一条线程结束后定格（endedAt 由 BatchRunner 写入，见 settle）
  const now = ref(Date.now());
  let tickTimer = null;
  watch(
    hasLive,
    (live) => {
      if (tickTimer) {
        clearInterval(tickTimer);
        tickTimer = null;
      }
      if (live) tickTimer = setInterval(() => (now.value = Date.now()), 1000);
    },
    { immediate: true }
  );
  onBeforeUnmount(() => {
    if (tickTimer) clearInterval(tickTimer);
  });
  const elapsedText = computed(() => {
    const { startedAt, endedAt } = runner.value.state;
    if (!startedAt) return '--';
    const total = Math.max(0, Math.floor(((endedAt || now.value) - startedAt) / 1000));
    const pad = (v) => String(v).padStart(2, '0');
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  });
  const count = ref(1);
  // 「错误重试」开关存于 runner（模块级单例）：关闭面板/切换页面后仍保留上次选择
  const retryOnError = computed({
    get: () => runner.value.state.retryOnError,
    set: (val) => {
      runner.value.state.retryOnError = val;
    },
  });

  const STATUS_TEXT = {
    starting: '启动中',
    retrying: '重试中',
    running: '运行中',
    completed: '已完成',
    stopped: '已停止',
    error: '出错',
  };
  const STATUS_COLOR = {
    starting: 'arcoblue',
    retrying: 'orange',
    running: 'arcoblue',
    completed: 'green',
    stopped: 'gray',
    error: 'red',
  };
  const statusText = (status) => STATUS_TEXT[status] || status;
  const statusColor = (status) => STATUS_COLOR[status] || 'gray';

  const onCreate = async () => {
    const res = await runner.value.create(count.value);
    if (!res.ok) Message.error(res.message);
  };
</script>

<style lang="less" scoped>
  .batch {
    width: 460px;
    height: 100%;
    background: transparent;
    display: flex;
    flex-direction: column;

    &__header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: var(--mac-hairline) solid var(--mac-separator);
    }

    &__title {
      font-size: 13.5px;
      font-weight: 600;
      color: var(--mac-text);
    }

    &__actions {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-bottom: var(--mac-hairline) solid var(--mac-separator);
    }

    /* 执行/停止按工作流工具栏样式，靠右对齐 */
    &__actions-btns {
      margin-left: auto;
    }

    &__list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px;
      align-content: center;
    }

    /* 底部统计：共 N 条线程 / 运行中 / 失败 / 成功 / 本轮总耗时 */
    &__stats {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 8px 14px;
      border-top: var(--mac-hairline) solid var(--mac-separator);
      font-size: 12px;
      color: var(--mac-text-2);
    }

    &__stats-elapsed {
      margin-left: auto;
      color: var(--mac-text);
      font-weight: 600;
    }
  }

  .batch-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    margin-bottom: 8px;
    border: var(--mac-hairline) solid var(--mac-separator);
    background: rgba(255, 255, 255, 0.6);
    border-radius: var(--mac-radius-sm);

    &__no {
      flex-shrink: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--mac-text);
    }

    &__error {
      flex: 1;
      min-width: 0;
      font-size: 12px;
      color: #f53f3f;
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__status {
      flex-shrink: 0;
      margin-left: auto;
    }
  }
</style>
