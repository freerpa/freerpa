<template>
  <div class="editor-layout">
    <a-form ref="formRef" :model="form" auto-label-width>
      <!-- 分类 + 名称（合并为一行，参考工作流样式） -->
      <a-form-item
        field="name"
        label="环境名称"
        :rules="[
          { required: true, message: '请输入环境名称' },
          { minLength: 2, message: '环境名称至少2个字符' },
          { maxLength: 50, message: '环境名称最多50个字符' }
        ]"
      >
        <a-input
          v-model="form.name"
          placeholder="请输入环境名称"
          allow-clear
          @press-enter="handleBeforeOk"
        >
          <template #prepend>
            <CategorySelect v-model="form.category" type="environment" />
          </template>
        </a-input>
      </a-form-item>
      <!-- 描述 -->
      <a-form-item field="description" label="描述">
        <a-textarea
          v-model="form.description"
          placeholder="请输入环境描述"
          allow-clear
          :max-length="200"
          :auto-size="{ minRows: 2, maxRows: 4 }"
          show-word-limit
        />
      </a-form-item>
      <!-- 内核（大版本） -->
      <a-form-item field="major_version" label="内核">
        <a-select
          v-model="form.major_version"
          placeholder="请选择内核版本"
          allow-clear
          :loading="kernelLoading"
        >
          <a-option
            v-for="k in kernelList"
            :key="k.major_version"
            :value="k.major_version"
            :label="k.label"
          />
        </a-select>
      </a-form-item>
      <!-- 代理地址 -->
      <a-form-item field="proxy_url" label="代理地址">
        <template #extra>
          <div
            v-if="proxyResult"
            class="proxy-result"
            :class="{ success: proxyResult.success, fail: !proxyResult.success }"
          >
            <template v-if="proxyResult.success">
              <icon-check-circle-fill /> 代理可用:
              <br>
              IP: {{ proxyResult.ip }}
              <br>
              时区: {{ proxyResult.timeZone }}
              <br>
              语言: {{ proxyResult.language }}
              <br>
              位置: {{ proxyResult.country }} {{ proxyResult.region }} {{ proxyResult.city }}
              <br>
              ISP: {{ proxyResult.isp }}
            </template>
            <template v-else>
              <icon-close-circle-fill /> 代理不可用: {{ proxyResult.error }}
            </template>
          </div>
        </template>
        <a-input-group style="width: 100%">
          <a-select
            v-model="form.proxy_protocol"
            style="width: 120px"
            @change="handleProtocolChange"
          >
            <a-option value="http://">HTTP</a-option>
            <a-option value="https://">HTTPS</a-option>
            <a-option value="socks5://">SOCKS5</a-option>
            <a-option value="direct">直连</a-option>
          </a-select>
          <a-input
            v-model="form.proxy_url"
            placeholder="用户名:密码@地址:端口"
            allow-clear
            :disabled="isDirect"
          >
          </a-input>
          <a-button
            type="primary"
            :loading="proxyChecking"
            :disabled="isDirect"
            @click="handleProxyCheck"
          >
            一键检测
          </a-button>
        </a-input-group>
      </a-form-item>
    </a-form>
    <!-- 保存按钮 -->
    <div class="env-button-group">
      <a-button type="secondary" @click="handleCancel">取消</a-button>
      <a-button type="primary" @click="handleBeforeOk">确定</a-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { IconCheckCircleFill, IconCloseCircleFill } from '@arco-design/web-vue/es/icon'
import { Message } from '@arco-design/web-vue'
import CategorySelect from '@/components/CategorySelect.vue'
import { getEnvironmentDetail, saveEnvironment } from '@/api/browser'
import { API_CONFIG } from '@/api/config'

const countryLang = {
  CN: 'zh-CN',
  TW: 'zh-TW',
  HK: 'zh-HK',
  US: 'en-US',
  GB: 'en-GB',
  CA: 'en-CA',
  AU: 'en-AU',
  JP: 'ja-JP',
  KR: 'ko-KR',
  DE: 'de-DE',
  FR: 'fr-FR',
  ES: 'es-ES',
  MX: 'es-MX',
  IT: 'it-IT',
  RU: 'ru-RU',
  BR: 'pt-BR',
  PT: 'pt-PT',
  NL: 'nl-NL',
  SE: 'sv-SE',
  NO: 'nb-NO',
  DK: 'da-DK',
  FI: 'fi-FI',
  PL: 'pl-PL',
  TR: 'tr-TR',
  IN: 'hi-IN',
  SA: 'ar-SA',
  AE: 'ar-AE',
  IL: 'he-IL',
  TH: 'th-TH',
  VN: 'vi-VN',
  ID: 'id-ID'
}

const props = defineProps({
  envId: [String, Number]
})

const emit = defineEmits(['success', 'cancel'])

// 是否直连模式（协议下拉选择"直连"时）
const isDirect = computed(() => form.value.proxy_protocol === 'direct')

// 表单状态
const formRef = ref(null)
const form = ref({
  id: '',
  name: '',
  description: '',
  category: '',
  major_version: '',
  proxy_protocol: 'http://',
  proxy_url: ''
})

// 内核列表
const kernelList = ref([])
const kernelLoading = ref(false)

// 代理检测
const proxyChecking = ref(false)
const proxyResult = ref(null)

// 获取大版本列表
const fetchKernelList = async () => {
  kernelLoading.value = true
  try {
    const envAPI = window.electronAPI.env
    const res = await envAPI.getMajorVersionList()
    if (res.code === 200 && res.data && res.data.length > 0) {
      kernelList.value = res.data
      return
    }
    // 降级：从 flat 列表中提取大版本
    console.warn('majorList 为空，尝试从 flat list 提取')
    const flatRes = await envAPI.getKernelList()
    if (flatRes.code === 200 && flatRes.data) {
      const seen = {}
      flatRes.data.forEach((k) => {
        const mv = k.major_version || (k.version || '').split('.')[0]
        if (mv && !seen[mv]) {
          seen[mv] = true
          kernelList.value.push({ major_version: mv, label: 'Chrome ' + mv })
        }
      })
      kernelList.value.sort((a, b) =>
        b.major_version.localeCompare(a.major_version, undefined, { numeric: true })
      )
    }
  } catch (e) {
    console.warn('获取内核版本列表失败:', e)
  } finally {
    kernelLoading.value = false
  }
}

// 协议切换时清理 proxy_url 中的旧协议前缀，直连时清空地址
const handleProtocolChange = () => {
  if (form.value.proxy_protocol === 'direct') {
    form.value.proxy_url = ''
    proxyResult.value = null
  } else {
    form.value.proxy_url = form.value.proxy_url.replace(/^(https?|socks[45]):\/\//, '')
  }
}

// 直连模式切换：开启时清理代理相关数据（已合入 handleProtocolChange）

// 一键检测代理
const handleProxyCheck = async () => {
  if (!form.value.proxy_url) {
    Message.warning('请先输入代理地址')
    return
  }

  proxyChecking.value = true
  proxyResult.value = null

  try {
    const baseUrl = API_CONFIG.BASE_URL
    // 使用完整代理地址（含协议前缀）进行检测
    let fullProxyUrl = form.value.proxy_url
    if (fullProxyUrl && !fullProxyUrl.startsWith('http') && !fullProxyUrl.startsWith('socks')) {
      fullProxyUrl = form.value.proxy_protocol + fullProxyUrl
    }
    const proxy = encodeURIComponent(fullProxyUrl)
    const response = await fetch(`${baseUrl}/geo/query?proxy=${proxy}`)
    const data = await response.json()

    if (data.code === 200 && data.data) {
      const cc = (data.data.countryCode || '').toUpperCase()
      proxyResult.value = {
        success: true,
        ip: data.data.ipAddress || data.data.ip || data.data.query || '未知',
        country: data.data.countryName || '',
        region: data.data.regionName || '',
        city: data.data.cityName || '',
        isp: data.data.isp || '',
        timeZone: data.data.timeZone || '-',
        language: countryLang[cc] || cc || '-'
      }
    } else {
      proxyResult.value = {
        success: false,
        error: data.message || '代理检测失败'
      }
    }
  } catch (error) {
    proxyResult.value = {
      success: false,
      error: error.message || '检测请求失败'
    }
  } finally {
    proxyChecking.value = false
  }
}

// 表单处理
const handleBeforeOk = async () => {
  try {
    const res = await formRef.value.validate()
    if (res) return
    await handleSubmit()
  } catch (error) {
    Message.error(error.message || '保存失败')
  }
}

const handleSubmit = async () => {
  try {
    // 组装完整代理地址（协议 + 地址）
    let proxyUrl = form.value.proxy_url
    if (proxyUrl && !proxyUrl.startsWith('http') && !proxyUrl.startsWith('socks')) {
      proxyUrl = form.value.proxy_protocol + proxyUrl
    }

    const env = {
      id: props.envId,
      name: form.value.name,
      description: form.value.description,
      category: form.value.category,
      major_version: form.value.major_version,
      proxy_direct: isDirect.value,
      proxy_url: proxyUrl
    }
    await saveEnvironment(env)
    Message.success(props.envId ? '更新成功' : '创建成功')
    emit('success', env)
    handleCancel()
  } catch (error) {
    Message.error(error.message || '保存失败')
  }
}

const handleCancel = () => {
  formRef.value?.resetFields()
  form.value = {
    id: '',
    name: '',
    description: '',
    category: '',
    major_version: '',
    proxy_protocol: 'http://',
    proxy_url: ''
  }
  proxyResult.value = null
  emit('cancel')
}

// 获取环境详情
const fetchEnvironmentDetail = async (id) => {
  try {
    const result = await getEnvironmentDetail(id)
    if (result) {
      const isDirectMode =
        result.proxy_direct === true || result.proxy_direct === 1 || result.proxy_direct === 'true'

      if (isDirectMode) {
        form.value = {
          id: result.id,
          name: result.name,
          description: result.description || '',
          category: result.category || '',
          major_version: result.major_version || '',
          proxy_protocol: 'direct',
          proxy_url: ''
        }
      } else {
        // 解析代理地址中的协议前缀
        let proxyProtocol = 'http://'
        let proxyUrl = result.proxy_url || ''
        const protocolMatch = proxyUrl.match(/^(https?|socks[45]):\/\//)
        if (protocolMatch) {
          proxyProtocol = protocolMatch[1] + '://'
          proxyUrl = proxyUrl.slice(protocolMatch[0].length)
        }

        form.value = {
          id: result.id,
          name: result.name,
          description: result.description || '',
          category: result.category || '',
          major_version: result.major_version || '',
          proxy_protocol: proxyProtocol,
          proxy_url: proxyUrl
        }
      }
    }
  } catch (error) {
    Message.error('获取环境详情失败')
  }
}

onMounted(async () => {
  await nextTick()
  await fetchKernelList()
  if (props.envId) {
    await fetchEnvironmentDetail(props.envId)
  }
})
</script>

<style lang="less" scoped>
.editor-layout {
  padding: 0 4px;
}

.env-button-group {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.proxy-result {
  font-size: 12px;
  margin-top: 4px;
  padding: 4px 8px;
  border-radius: 4px;

  &.success {
    color: #00b42a;
    background: #e8ffea;
  }

  &.fail {
    color: #f53f3f;
    background: #ffece8;
  }
}
</style>
