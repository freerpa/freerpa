<template>
  <div class="env-open-modal">
    <!-- 步骤 1：内核检测 -->
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
          <span class="step-title">步骤 1：内核检测</span>
        </a-space>
      </div>
      <div class="step-body" v-if="currentStep >= 1">
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="平台">{{ kernelInfo?.platform || '-' }}</a-descriptions-item>
          <a-descriptions-item label="版本">{{ kernelInfo?.version || '-' }}</a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag v-if="step1Failed" color="red" bordered size="small">{{ kernelError }}</a-tag>
            <a-tag v-else-if="kernelExists" color="green" bordered size="small">已就绪</a-tag>
            <a-tag v-else-if="kernelDownloading" color="blue" bordered size="small"
              >下载中 {{ downloadPercent }}%</a-tag
            >
            <a-tag v-else color="orange" bordered size="small">未下载</a-tag>
          </a-descriptions-item>
        </a-descriptions>
      </div>
    </div>

    <!-- 步骤 2：代理检测 -->
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
                    ? '检测中'
                    : '待检测'
            }}
          </a-tag>
          <span class="step-title">步骤 2：代理检测</span>
        </a-space>
      </div>
      <div class="step-body" v-if="currentStep >= 2">
        <template v-if="!step2Failed && proxyResult">
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
        <span v-else-if="step2Failed">
          {{ proxyError }}
        </span>
        <a-result v-else status="info" title="检测中...">
          <template #icon><icon-loading /></template>
        </a-result>
      </div>
    </div>

    <!-- 步骤 3：打开浏览器 -->
    <div
      class="step"
      :class="{ active: currentStep === 3, completed: currentStep > 3, failed: step3Failed }"
    >
      <div class="step-header">
        <a-space>
          <a-tag
            :color="
              step3Failed ? 'red' : currentStep > 3 ? 'green' : currentStep === 3 ? 'blue' : 'gray'
            "
            size="medium"
            bordered
          >
            <template #icon>
              <icon-close-circle-fill v-if="step3Failed" />
              <icon-check v-else-if="currentStep > 3" />
              <icon-loading v-else-if="currentStep === 3" />
              <icon-clock-circle v-else />
            </template>
            {{
              step3Failed
                ? '失败'
                : currentStep > 3
                  ? '已完成'
                  : currentStep === 3
                    ? '打开中'
                    : '待打开'
            }}
          </a-tag>
          <span class="step-title">步骤 3：打开浏览器</span>
        </a-space>
      </div>
      <div class="step-body" v-if="currentStep >= 3">
        <span v-if="step3Failed"> {{ openError }} </span>
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

const { browserLocal: browserAPI } = window.electronAPI

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
  step2Failed = ref(false),
  step2Skipped = ref(false),
  step3Failed = ref(false)
const kernelInfo = ref(null),
  kernelExists = ref(false),
  kernelDownloading = ref(false),
  downloadPercent = ref(0),
  kernelError = ref('')
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

const getPlatform = () => {
  const p = navigator.platform || ''
  if (p.includes('Win')) return 'windows'
  if (p.includes('Mac')) return 'macos'
  if (p.includes('Linux')) return 'linux'
  return 'windows'
}

const fetchKernel = async () => {
  checkAborted()
  let majorVersion = props.env?.major_version || props.env?.kernel_id
  if (!majorVersion && props.env?.id) {
    try {
      const d = await browserAPI.getBrowser(props.env.id)
      if (d?.kernel_id) majorVersion = d.kernel_id
    } catch (_) {}
  }
  if (!majorVersion) throw new Error('未配置内核版本，请在环境编辑中选择 Chrome 大版本')
  const envAPI = window.electronAPI.env
  const platform = getPlatform()
  const res = await envAPI.resolveKernelVersion({ majorVersion, platform })
  checkAborted()
  if (res.code !== 200 || !res.data)
    throw new Error(`当前平台 (${platform}) 没有可用的 Chrome ${majorVersion} 内核`)
  kernelInfo.value = res.data
  if (envAPI.checkKernel) {
    const r = await envAPI.checkKernel({
      platform: kernelInfo.value.platform,
      version: kernelInfo.value.version
    })
    checkAborted()
    if (r.code === 200) kernelExists.value = r.data.exists
  }
}

const downloadKernel = async () => {
  kernelDownloading.value = true
  downloadPercent.value = 0
  const envAPI = window.electronAPI.env
  const rm = envAPI.onDownloadKernelProgress(({ percent }) => {
    downloadPercent.value = Math.round(percent)
  })
  try {
    const res = await envAPI.downloadKernel({
      platform: kernelInfo.value.platform,
      version: kernelInfo.value.version,
      download_url: kernelInfo.value.download_url
    })
    checkAborted()
    if (res.code === 200) {
      kernelExists.value = true
      downloadPercent.value = 100
    } else throw new Error(res.message || '下载失败')
  } catch (e) {
    throw new Error('内核下载失败: ' + (e.message || '未知错误'))
  } finally {
    rm()
    kernelDownloading.value = false
  }
}

const checkProxy = async () => {
  checkAborted()
  const baseUrl = API_CONFIG.BASE_URL
  if (isDirectMode.value || !props.env.proxy_url) {
    step2Skipped.value = true
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
    kernel: toRaw(kernelInfo.value),
    proxy: isDirectMode.value ? '' : props.env.proxy_url || '',
    fingerprint: toRaw(props.env?.fingerprint || undefined)
  })
  checkAborted()
  if (res.code === 400 && res.message === 'KERNEL_NEED_DOWNLOAD') {
    await downloadKernel()
    checkAborted()
    const retryRes = await envAPI.openBrowser({
      envId: props.env.id,
      kernel: kernelInfo.value,
      proxy: isDirectMode.value ? '' : props.env.proxy_url || '',
      fingerprint: props.env?.fingerprint || undefined
    })
    checkAborted()
    if (retryRes.code !== 200) throw new Error(retryRes.message || '打开浏览器失败')
  } else if (res.code !== 200) {
    throw new Error(res.message || '打开浏览器失败')
  }
}

const run = async () => {
  try {
    currentStep.value = 1
    try {
      await fetchKernel()
      checkAborted()
      if (!kernelInfo.value) throw new Error('未配置内核')
      if (!kernelExists.value) {
        await downloadKernel()
        checkAborted()
      }
    } catch (e) {
      if (e.message === 'ABORTED') return
      step1Failed.value = true
      kernelError.value = e.message
      return
    }

    currentStep.value = 2
    try {
      await checkProxy()
      checkAborted()
    } catch (e) {
      if (e.message === 'ABORTED') return
      step2Failed.value = true
      proxyError.value = e.message
      return
    }

    currentStep.value = 3
    try {
      await openBrowser()
      checkAborted()
      emit('success', props.env.id)
    } catch (e) {
      if (e.message === 'ABORTED') return
      step3Failed.value = true
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
