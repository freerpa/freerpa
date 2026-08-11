<script setup>
import { HANDLERS } from './handlers.js'
import DataHandlerView from '@/workflow/components/nodes/dataHandlerView.vue'
const props = defineProps({ node: { type: Object, required: true } })
</script>
<template>
  <DataHandlerView :node="props.node" :handlers="HANDLERS" />
</template>
