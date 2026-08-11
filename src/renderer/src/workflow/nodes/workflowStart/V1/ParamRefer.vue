<script setup>
import ParamRefer from '@/workflow/components/fieldRenderer/components/ParamRefer.vue'
</script>
<template>
  <ParamRefer
    trigger="click"
    output-format="object"
    data-source-mode="parentLevel"
    header-text="快速创建父级节点输出引用"
  >
    <slot />
  </ParamRefer>
</template>
