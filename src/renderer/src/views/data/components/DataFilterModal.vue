<template>
  <a-modal
    :visible="visible"
    width="674px"
    :body-style="{ maxHeight: 'calc(90vh - 200px)' }"
    unmount-on-close
    @cancel="emit('update:visible', false)"
  >
    <template #title> 条件查询 </template>
    <a-empty v-if="conditions.length === 0" class="empty-message">请添加条件组</a-empty>
    <div class="filter-group">
      <a-card v-for="(group, index) in conditions" :key="index" size="mini">
        <template #title>
          <a-dropdown @select="(value) => (group.logic = value.value)">
            <a-button type="secondary" size="mini">
              {{ group.logic === 'and' ? '全部满足' : '任一满足' }}
            </a-button>
            <template #content>
              <a-doption :value="{ value: 'and' }">全部满足</a-doption>
              <a-doption :value="{ value: 'or' }">任一满足</a-doption>
            </template>
          </a-dropdown>
        </template>
        <template #extra>
          <a-button-group>
            <a-button
              type="secondary"
              size="mini"
              @click="group.conditions.push({ field: '', operator: '', value: '' })"
            >
              添加条件
            </a-button>
            <a-button
              type="secondary"
              size="mini"
              status="danger"
              @click="conditions.splice(index, 1)"
            >
              <IconDelete />
            </a-button>
          </a-button-group>
        </template>
        <a-config-provider size="mini">
          <div class="filter-group">
            <div v-for="(item, index) in group.conditions" :key="index" class="filter-item">
              <a-link
                :disabled="index === 0"
                type="secondary"
                status="danger"
                @click="group.conditions.splice(index, 1)"
              >
                <icon-minus-circle-fill />
              </a-link>
              <a-select
                :options="fields.map((f) => ({ label: f.description, value: f.name }))"
                :style="{ width: '160px' }"
                v-model="item.field"
                placeholder="选择字段"
                default-active-first-option
              />
              <div v-if="item.field === 'color'" class="color-picker">
                <div
                  v-for="(color, label) in colorOptions"
                  :key="label"
                  class="color-option color-marker"
                  :class="{
                    active: item.value?.includes(label)
                  }"
                  :style="{ backgroundColor: color }"
                  @click="
                    () => {
                      const values = item.value ? item.value?.split(',') || [] : []
                      const idx = values.findIndex((v) => v === label)
                      if (idx > -1) {
                        values.splice(idx, 1)
                      } else {
                        values.push(label)
                      }
                      item.operator = values.length == 0 ? '' : 'in'
                      item.value = values.join(',')
                    }
                  "
                >
                  {{ label }}
                </div>
              </div>

              <template v-else>
                <div class="filter-input">
                  <!-- 操作符选择 -->
                  <a-select
                    :options="operatorOptions.filter((o) => o.types.includes(getFiledType(item.field)))"
                    :style="{ width: '160px' }"
                    v-model="item.operator"
                    placeholder="选择操作符"
                    default-active-first-option
                    :fallback-option="false"
                  />

                  <!-- 日期选择 -->
                  <template
                    v-if="
                      getFiledType(item.field) === 'date' &&
                      !['isNull', 'isNotNull'].includes(item.operator)
                    "
                  >
                    <template v-if="['in', 'notIn'].includes(item.operator)">
                      <a-range-picker
                        :model-value="item.value?.split(',')"
                        show-time
                        style="flex: 1"
                        @change="(val) => { item.value = val?.join(',') }"
                      />
                    </template>
                    <template v-else>
                      <a-date-picker
                        :model-value="item.value"
                        show-time
                        style="flex: 1"
                        @change="(val) => { item.value = val }"
                      />
                    </template>
                  </template>
                  <!-- 数字值输入 -->
                  <template
                    v-else-if="
                      getFiledType(item.field) === 'number' &&
                      !['isNull', 'isNotNull'].includes(item.operator)
                    "
                  >
                    <template v-if="['in', 'notIn'].includes(item.operator)">
                      <a-space style="flex: 1">
                        <a-input-number
                          :model-value="Number(item.value?.toString().split(',')[0] || undefined)"
                          placeholder="最小值"
                          style="width: 100%"
                          @change="(val) => { const values = item.value?.toString().split(',') || []; values[0] = val; item.value = values.join(',') || '' }"
                        />
                        <a-input-number
                          :model-value="Number(item.value?.toString().split(',')[1] || undefined)"
                          placeholder="最大值"
                          style="width: 100%"
                          @change="(val) => { const values = item.value?.toString().split(',') || []; values[1] = val; item.value = values.join(',') || '' }"
                        />
                      </a-space>
                    </template>
                    <template v-else>
                      <a-input-number
                        placeholder="输入值"
                        style="width: 100%"
                        v-model="item.value"
                      />
                    </template>
                  </template>
                  <!-- 文本输入 -->
                  <template
                    v-else-if="
                      getFiledType(item.field) === 'string' &&
                      !['isNull', 'isNotNull'].includes(item.operator)
                    "
                  >
                    <a-input
                      v-model="item.value"
                      placeholder="输入值"
                      allow-clear
                      style="flex: 1"
                    />
                  </template>
                </div>
              </template>
            </div>
          </div>
        </a-config-provider>
      </a-card>
    </div>
    <template #footer>
      <a-space>
        <a-button type="secondary" @click="addConditionGroup">添加条件组</a-button>
        <a-button type="primary" @click="emit('search')">查询</a-button>
      </a-space>
    </template>
  </a-modal>
</template>

<script setup>
import { computed } from 'vue'
import { IconDelete } from '@arco-design/web-vue/es/icon'

const props = defineProps({
  visible: { type: Boolean, default: false },
  fields: { type: Array, required: true }
})
const conditions = defineModel('conditions', { type: Array, required: true })
const emit = defineEmits(['update:visible', 'search'])

// 统一的操作符选项
const operatorOptions = [
  { label: '等于', value: 'eq', types: ['date', 'number', 'string'] },
  { label: '不等于', value: 'ne', types: ['date', 'number', 'string'] },
  { label: '大于', value: 'gt', types: ['date', 'number'] },
  { label: '大于等于', value: 'gte', types: ['date', 'number'] },
  { label: '小于', value: 'lt', types: ['date', 'number'] },
  { label: '小于等于', value: 'lte', types: ['date', 'number'] },
  { label: '包含', value: 'like', types: ['string'] },
  { label: '不包含', value: 'notLike', types: ['string'] },
  { label: '在范围内', value: 'in', types: ['date', 'number'] },
  { label: '不在范围内', value: 'notIn', types: ['date', 'number'] },
  { label: '为空', value: 'isNull', types: ['date', 'number', 'string'] },
  { label: '不为空', value: 'isNotNull', types: ['date', 'number', 'string'] }
]

const colorOptions = {
  红: '#F53F3F',
  橙: '#F77234',
  黄: '#F7BA1E',
  绿: '#00B42A',
  青: '#14C9C9',
  蓝: '#165DFF',
  紫: '#722ED1'
}

const fieldTypeMap = computed(() => {
  const map = new Map()
  props.fields.forEach((f) => map.set(f.name, f.type))
  return map
})
const getFiledType = (field) => {
  if (!field) return ''
  return fieldTypeMap.value.get(field)
}

const addConditionGroup = () => {
  conditions.value.push({ conditions: [{ field: '', operator: '', value: '' }], logic: 'and' })
}
</script>

<style lang="less" scoped>
.color-picker {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 8px;
  .active {
    transform: scale(1.1);
    box-shadow:
      0 0 0 2px #fff,
      0 0 0 4px var(--color-primary);
    border: 2px solid #000;
  }
  .color-option {
    &.clear {
      background-color: #f2f3f5;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-3);
    }
  }
}
.filter-group {
  display: flex;
  gap: 8px;
  flex-direction: column;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 600px;
  .filter-input {
    display: flex;
    gap: 8px;
    flex: 1;
  }
}

.color-marker {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: bold;
  &:hover {
    transform: scale(1.1);
  }
}
</style>
