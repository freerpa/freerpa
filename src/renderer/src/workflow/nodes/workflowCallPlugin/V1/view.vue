<template>
  <div class="workflow-call-plugin-view" v-if="hasPluginFields">
    <div class="plugin-config-title">{{ pluginName }} (v{{ pluginVersion }})</div>
    <a-divider margin="8px 0" />
    <FormView :fields="pluginConfigFields" v-model="formData" />
    <div class="plugin-info" v-if="pluginDescription">
      <a-typography-text type="secondary">{{ pluginDescription }}</a-typography-text>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue'
import FormView from '@/workflow/components/nodes/FormView.vue'

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
})

const workflowId = inject('workflowId')
const nodeId = inject('nodeId')
const formData = ref(props.node.config)

// 缓存的插件清单
const pluginManifest = ref(null)
const pluginName = ref('')
const pluginVersion = ref('')
const pluginDescription = ref('')
const isLoading = ref(false)

// 是否有插件配置字段需要展示
const hasPluginFields = computed(() => {
  return pluginConfigFields.value.length > 0
})

// 从插件清单生成配置字段列表
const pluginConfigFields = computed(() => {
  const manifest = pluginManifest.value
  if (!manifest?.config) return []
  const fields = []
  Object.values(manifest.config).forEach((group) => {
    if (group.fields) {
      Object.values(group.fields).forEach((field) => {
        fields.push(field)
      })
    }
  })
  return fields
})

/**
 * 加载插件清单并更新节点
 */
const loadPluginManifest = async (pluginId) => {
  if (!pluginId) {
    // 清空插件数据
    formData.value._pluginInputs = []
    formData.value._pluginOutputs = []
    pluginManifest.value = null
    pluginName.value = ''
    pluginVersion.value = ''
    pluginDescription.value = ''
    return
  }

  isLoading.value = true
  try {
    const manifest = await window.electronAPI.plugin.get(pluginId)
    if (!manifest) {
      console.warn(`[workflowCallPlugin] 插件未找到: ${pluginId}`)
      return
    }

    pluginManifest.value = manifest
    pluginName.value = manifest.name || ''
    pluginVersion.value = manifest.version || ''
    pluginDescription.value = manifest.description || ''

    // 将插件定义的 inputs/outputs 写入 config 的动态字段
    // useNodeIO.js 会从 config._pluginInputs / config._pluginOutputs 读取并生成连线口
    formData.value._pluginInputs = (manifest.inputs || []).map((input) => ({
      id: input.id,
      name: input.name,
      type: input.type || 'any',
      description: input.description || '',
      required: !!input.required
    }))

    formData.value._pluginOutputs = (manifest.outputs || []).map((output) => ({
      id: output.id,
      name: output.name,
      type: output.type || 'any',
      description: output.description || ''
    }))

    // 为插件配置字段设置默认值
    const configFields = pluginConfigFields.value
    configFields.forEach((field) => {
      if (field.default !== undefined && formData.value[field.id] === undefined) {
        formData.value[field.id] = field.default
      }
    })
  } catch (err) {
    console.error('[workflowCallPlugin] 加载插件失败:', err)
    formData.value._pluginInputs = []
    formData.value._pluginOutputs = []
    pluginManifest.value = null
  } finally {
    isLoading.value = false
  }
}

// 当 pluginId 变化时，重新加载插件清单
watch(
  () => formData.value.pluginId,
  (newPluginId, oldPluginId) => {
    if (newPluginId !== oldPluginId) {
      // 先清空旧插件字段的默认值
      if (oldPluginId && pluginConfigFields.value.length > 0) {
        pluginConfigFields.value.forEach((field) => {
          delete formData.value[field.id]
        })
      }
      loadPluginManifest(newPluginId)
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="less">
.workflow-call-plugin-view {
  padding: 4px 0;

  .plugin-config-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-1);
    margin-bottom: 4px;
  }

  .plugin-info {
    margin-top: 8px;
    font-size: 12px;
  }
}
</style>
