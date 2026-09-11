<template>
  <div class="round-nav" @mouseenter="open = true" @mouseleave="open = false">
    <!-- 默认窄条：每一轮一个灰色小圆点 -->
    <div class="round-nav__dots">
      <div
        v-for="round in rounds"
        :key="round.roundId"
        class="round-dot"
        :class="{ 'round-dot--active': round.roundId === activeRoundId }"
        :title="round.content || '（空）'"
        @click="$emit('select', round.roundId)"
      ></div>
    </div>
    <!-- hover 向右展开：展示每轮用户消息（溢出省略号） -->
    <div class="round-nav__items">
      <div
        v-for="round in rounds"
        :key="round.roundId"
        class="round-item"
        :class="{ 'round-item--active': round.roundId === activeRoundId }"
        @click="$emit('select', round.roundId)"
      >
        <span class="round-item__text">{{ round.content || '（空）' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { ref } from 'vue';

  defineProps({
    // 轮次列表：[{ roundId, content }]（按对话顺序，roundId 为该轮用户消息标识）
    rounds: { type: Array, default: () => [] },
    // 当前定位的轮次（可选高亮）
    activeRoundId: { type: String, default: '' },
  });

  defineEmits(['select']);

  const open = ref(false);
</script>

<style scoped lang="less">
  .round-nav {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 20;
    display: flex;
    max-height: 70%;
    background: #fff;
    border: 1px solid #e5e5e8;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    transition: all 0.2s ease;

    &:hover {
      width: 230px;
      padding: 8px;

      .round-dot {
        display: none;
      }
    }

    &__dots {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex-shrink: 0;
    }

    .round-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #c9cdd4;
      margin: 5px 3px;
      flex-shrink: 0;
      transition: background 0.2s;

      &:hover {
        background: rgb(var(--primary-6));
      }

      &.round-dot--active {
        background: rgb(var(--primary-6));
      }
    }

    &__items {
      display: none;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      overflow-y: auto;
    }

    &:hover .round-nav__items {
      display: flex;
      gap: 4px;
    }

    .round-item {
      padding: 4px 6px;
      border-radius: var(--border-radius-small);
      font-size: 12px;
      line-height: 1.4;
      color: var(--color-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      &:hover {
        background: var(--color-fill-2);
        color: var(--color-text-1);
      }

      &.round-item--active {
        background: rgb(var(--primary-1));
        color: rgb(var(--primary-6));
      }
    }
  }
</style>
