<template>
  <div class="shortcut-manager">
    <a-card title="快捷键管理" :bordered="false">
      <template #extra>
        <a-popover content="点击要修改的快捷键，按下新按键组合录制。">
          <icon-info-circle class="info-icon" />
        </a-popover>
      </template>

      <a-collapse v-model:active-key="activeCategories" :bordered="true" expand-icon-position="right">
        <a-collapse-item v-for="group in grouped" :key="group.category" :header="`${group.category} (${group.items.length})`">
          <div class="shortcut-group">
            <div class="shortcut-row" v-for="item in group.items" :key="item.id">
              <div class="shortcut-info">
                <span class="shortcut-name">{{ item.name }}</span>
              </div>
              <div class="shortcut-keys">
                <a-tag
                  :color="recording === item.id ? 'red' : 'arcoblue'"
                  size="large" class="keys-tag"
                  @click="startRecord(item)"
                >
                  {{ recording === item.id ? (currentKeys || '按下按键...') : formatKeys(item.keys) }}
                </a-tag>
              </div>
              <a-button type="text" size="mini" status="warning" @click="handleResetOne(item.id)">
                恢复默认
              </a-button>
            </div>
          </div>
        </a-collapse-item>
      </a-collapse>

      <div style="margin-top: 16px; text-align: right">
        <a-button @click="handleResetAll">
          <template #icon><icon-refresh /></template>
          恢复全部默认
        </a-button>
      </div>
    </a-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconRefresh, IconInfoCircle } from '@arco-design/web-vue/es/icon'
import { getShortcuts, getDefaults, updateShortcut, resetShortcuts, formatKeys, eventToAccelerator, onChanged } from '@/utils/shortcut'

const shortcuts = ref([])
const recording = ref(null)
const currentKeys = ref('')
const activeCategories = ref([])
const grouped = ref([])
const defaultsList = ref(getDefaults())

const group = () => {
  const map = {}
  for (const s of shortcuts.value) {
    const cat = s.category || '其他'
    if (!map[cat]) map[cat] = []
    map[cat].push(s)
  }
  grouped.value = Object.entries(map).map(([category, items]) => ({ category, items }))
}

const fetchList = () => {
  shortcuts.value = getShortcuts()
  defaultsList.value = getDefaults()
  group()
  if (grouped.value.length && activeCategories.value.length === 0) {
    activeCategories.value = grouped.value.map((g) => g.category)
  }
}

const startRecord = (item) => {
  recording.value = item.id
  currentKeys.value = ''

  const onKeyDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const acc = eventToAccelerator(e)
    currentKeys.value = formatKeys(acc)

    const parts = acc.split('+')
    if (parts.some((k) => !['CommandOrControl', 'Shift', 'Alt'].includes(k))) {
      updateShortcut(item.id, acc)
      shortcuts.value.find((s) => s.id === item.id).keys = acc
      Message.success(`已更新: ${formatKeys(acc)}`)
      stop()
    }
  }

  const onKeyUp = (e) => {
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      currentKeys.value = formatKeys(e.key.toUpperCase())
    }
  }

  const stop = () => {
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('keyup', onKeyUp, true)
    recording.value = null
    currentKeys.value = ''
  }

  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp, true)
  setTimeout(() => { if (recording.value === item.id) { stop(); Message.info('录制超时') } }, 5000)
}

const handleResetOne = (id) => {
  const def = defaultsList.value.find((d) => d.id === id)
  if (def) {
    updateShortcut(id, def.keys)
    shortcuts.value.find((s) => s.id === id).keys = def.keys
    Message.success('已恢复默认')
  }
}

const handleResetAll = () => {
  resetShortcuts()
  fetchList()
  Message.success('已恢复全部默认快捷键')
}

let removeListener = null
onMounted(() => {
  fetchList()
  removeListener = onChanged(fetchList)
})
onUnmounted(() => removeListener?.())
</script>

<style lang="less" scoped>
.shortcut-manager {
  .shortcut-group {
    .shortcut-row {
      display: flex;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--color-border-2);
      &:last-child { border-bottom: none; }
      .shortcut-info { flex: 1; display: flex; align-items: center; gap: 8px; .shortcut-name { font-weight: 500; font-size: 13px; } }
      .shortcut-keys { margin-right: 12px; .keys-tag { cursor: pointer; min-width: 100px; text-align: center; user-select: none; } }
    }
  }
}
.info-icon { cursor: pointer; color: var(--color-text-3); font-size: 16px; }
</style>
