<template>
  <div class="env-open-modal">
    <!-- 步骤 1：代理检测 -->
    <div
      class="step"
      :class="{ active: currentStep === 1, completed: currentStep > 1, failed: step1Failed }"
    >
      <div class="step-header">
        <a-space>
          <a-tag
            :color="
              step1Failed ? 'red' : currentStep > 1 ? 'green' : currentStep === 1 ? 'blue' : 'gray'
            "
            size="medium"
            bordered
          >
            <template #icon>
              <icon-close-circle-fill v-if="step1Failed" />
              <icon-check v-else-if="currentStep > 1" />
              <icon-loading v-else-if="currentStep === 1" />
              <icon-clock-circle v-else />
            </template>
            {{
              step1Failed
                ? '失败'
                : currentStep > 1
                  ? '已完成'
                  : currentStep === 1
                    ? '检测中'
                    : '待检测'
            }}
          </a-tag>
          <span class="step-title">步骤 1：代理检测</span>
        </a-space>
      </div>
      <div class="step-body" v-if="currentStep >= 1">
        <template v-if="!step1Failed && proxyResult">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item label="IP">{{ proxyResult.ip || '-' }}</a-descriptions-item>
            <a-descriptions-item label="时区">{{
              proxyResult.timeZone || '-'
            }}</a-descriptions-item>
            <a-descriptions-item label="语言">{{
              proxyResult.language || '-'
            }}</a-descriptions-item>
            <a-descriptions-item label="位置">{{ geoInfo }}</a-descriptions-item>
          </a-descriptions>
        </template>
        <span v-else-if="step1Failed">
          {{ proxyError }}
        </span>
        <a-result v-else status="info" title="检测中...">
          <template #icon><icon-loading /></template>
        </a-result>
      </div>
    </div>

    <!-- 步骤 2：打开浏览器 -->
    <div
      class="step"
      :class="{ active: currentStep === 2, completed: currentStep > 2, failed: step2Failed }"
    >
      <div class="step-header">
        <a-space>
          <a-tag
            :color="
              step2Failed ? 'red' : currentStep > 2 ? 'green' : currentStep === 2 ? 'blue' : 'gray'
            "
            size="medium"
            bordered
          >
            <template #icon>
              <icon-close-circle-fill v-if="step2Failed" />
              <icon-check v-else-if="currentStep > 2" />
              <icon-loading v-else-if="currentStep === 2" />
              <icon-clock-circle v-else />
            </template>
            {{
              step2Failed
                ? '失败'
                : currentStep > 2
                  ? '已完成'
                  : currentStep === 2
                    ? '打开中'
                    : '待打开'
            }}
          </a-tag>
          <span class="step-title">步骤 2：打开浏览器</span>
        </a-space>
      </div>
      <div class="step-body" v-if="currentStep >= 2">
        <span v-if="step2Failed"> {{ openError }} </span>
        <a-result v-else status="info" title="打开中...">
          <template #icon><icon-loading /></template>
        </a-result>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, toRaw } from 'vue'
import {
  IconCheck,
  IconLoading,
  IconClockCircle,
  IconCloseCircleFill
} from '@arco-design/web-vue/es/icon'
import { API_CONFIG } from '@/api/config'

const props = defineProps({ env: { type: Object, required: true } })
const emit = defineEmits(['success', 'cancel'])

const isDirectMode = computed(
  () =>
    props.env?.proxy_direct === true ||
    props.env?.proxy_direct === 1 ||
    props.env?.proxy_direct === 'true'
)

let aborted = false
const currentStep = ref(1)
const step1Failed = ref(false),
  step2Failed = ref(false)
const proxyResult = ref(null),
  proxyError = ref('')
const openError = ref('')

import { countryLang } from '@/utils/geoLang'

const geoInfo = computed(() => {
  if (!proxyResult.value) return '-'
  const parts = []
  if (proxyResult.value.country) parts.push(proxyResult.value.country)
  if (proxyResult.value.region) parts.push(proxyResult.value.region)
  if (proxyResult.value.city) parts.push(proxyResult.value.city)
  return parts.join(' ') || '-'
})

const checkAborted = () => {
  if (aborted) throw new Error('ABORTED')
}

const checkProxy = async () => {
  checkAborted()
  const baseUrl = API_CONFIG.BASE_URL
  if (isDirectMode.value || !props.env.proxy_url) {
    proxyResult.value = {
      ip: '-',
      country: '-',
      region: '-',
      city: '-',
      isp: '-',
      timeZone: '-',
      language: '-'
    }
    return
  }
  try {
    const proxy = encodeURIComponent(props.env.proxy_url)
    const res = await fetch(`${baseUrl}/geo/query?proxy=${proxy}`)
    checkAborted()
    const d = await res.json()
    if (d.code !== 200 || !d.data) throw new Error(d.message || '代理检测失败')
    const cc = (d.data.countryCode || '').toUpperCase()
    proxyResult.value = {
      ip: d.data.ipAddress || d.data.ip || d.data.query || '未知',
      country: d.data.countryName || '',
      region: d.data.regionName || '',
      city: d.data.cityName || '',
      isp: d.data.isp || '',
      timeZone: d.data.timeZone || '-',
      language: countryLang[cc] || cc || '-'
    }
  } catch (e) {
    if (e.message === 'ABORTED') throw e
    throw new Error('代理检测失败: ' + (e.message || '连接超时'))
  }
}

const openBrowser = async () => {
  checkAborted()
  const envAPI = window.electronAPI.env
  if (!envAPI.openBrowser) throw new Error('浏览器打开功能不可用')
  const res = await envAPI.openBrowser({
    envId: props.env.id,
    proxy: isDirectMode.value ? '' : props.env.proxy_url || '',
    fingerprint: toRaw(props.env?.fingerprint || undefined)
  })
  checkAborted()
  if (res.code !== 200) {
    throw new Error(res.message || '打开浏览器失败')
  }
}

const run = async () => {
  try {
    currentStep.value = 1
    try {
      await checkProxy()
      checkAborted()
    } catch (e) {
      if (e.message === 'ABORTED') return
      step1Failed.value = true
      proxyError.value = e.message
      return
    }

    currentStep.value = 2
    try {
      await openBrowser()
      checkAborted()
      emit('success', props.env.id)
    } catch (e) {
      if (e.message === 'ABORTED') return
      step2Failed.value = true
      openError.value = e.message
    }
  } catch (e) {
    if (e.message === 'ABORTED') return
  }
}

onMounted(() => nextTick(() => run()))
onBeforeUnmount(() => {
  aborted = true
})
</script>

<style lang="less" scoped>
.env-open-modal {
  .step {
    margin-bottom: 16px;
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    transition: all 0.3s;
    &.active {
      border-color: rgb(var(--primary-6));
      background: var(--color-bg-2);
    }
    &.completed {
      border-color: var(--color-border);
      background: var(--color-fill-1);
    }
    &.failed {
      border-color: rgb(var(--danger-6));
      background: #ffece8;
    }
    .step-header {
      margin-bottom: 8px;
      .step-title {
        font-weight: 500;
        font-size: 14px;
      }
    }
    .step-body {
      padding: 8px 0;
    }
  }
}
</style>
