<template>
  <div class="icon-switch" @click="handleClick" :class="{ disabled: disabled }">
    <slot></slot>
    <div class="switch-icon">
      <RiToggleFill v-if="value" size="10" />
      <RiToggleLine v-else size="10" />
    </div>
  </div>
</template>
<script setup>
import { RiToggleLine, RiToggleFill } from '@remixicon/vue'
const emit = defineEmits(['click'])
const handleClick = () => {
  if (props.disabled) return
  emit('click', !value.value)
  value.value = !value.value
}

const props = defineProps({
  disabled: {
    default: false,
    type: Boolean
  }
})

const value = defineModel({
  default: false,
  type: Boolean
})
</script>
<style scoped lang="less">
.icon-switch {
  position: relative;
  cursor: pointer;
  &.disabled {
    cursor: not-allowed;
    .switch-icon svg{
      opacity: 0.5;
    }
  }
  .switch-icon {
    color: rgb(var(--primary-6));
    width: 10px;
    height: 7px;
    position: absolute;
    background: #fff;
    border-radius: 7px;
    bottom: 3px;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
