<template>
  <div class="element-selector">
    <a-input-group style="width: 100%">
      <myText v-model="value" :field="field">
        <template #suffix>
          <a-button
            @click="
              () => {
                showSelector = true
                handleSelectorInputValue(value)
              }
            "
          >
            <svg
              class="icon"
              viewBox="0 0 1024 1024"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M862.08 480A350.08 350.08 0 0 0 544 161.92V64h-64v97.92A350.08 350.08 0 0 0 161.92 480H64v64h97.92a350.08 350.08 0 0 0 318.08 318.08V960h64v-97.92a350.08 350.08 0 0 0 318.08-318.08H960v-64h-97.92zM480 798.08A287.232 287.232 0 0 1 225.92 544H480v254.08z m0-318.08H225.92A287.232 287.232 0 0 1 480 225.92V480z m64-254.08c133.76 14.72 239.36 120.32 254.08 254.08H544V225.92z m0 572.16V544h254.08a287.232 287.232 0 0 1-254.08 254.08z"
                fill="currentColor"
              ></path>
            </svg>
          </a-button>
        </template>
      </myText>
    </a-input-group>

    <a-modal
      v-model:visible="showSelector"
      @open="handleSelectorOpen"
      @before-close="handleSelectorClose"
      title="选择器配置"
      :mask-closable="false"
      body-style="height: 100%;"
      unmount-on-close
      width="95vw"
      :footer="false"
    >
      <div class="selector-builder">
        <div class="selector-content">
          <a-select
            size="medium"
            placeholder="请选择浏览器"
            :model-value="currentEnv.id"
            @change="handleEnvChange"
            allow-search
            :trigger-props="{ trigger: 'focus' }"
          >
            <a-option v-for="item in envList" :key="item.id" :value="item.id">
              {{ item.name }}
            </a-option>
          </a-select>
          <!-- 选择器类型 -->
          <a-space>
            <a-radio-group size="medium" v-model="locateMethod" type="button">
              <a-radio value="selector" style="width: 93px; text-align: center">Selector</a-radio>
              <a-radio value="xpath" style="width: 70px; text-align: center">XPath</a-radio>
            </a-radio-group>
            <a-tag size="large" v-if="isValidSelector" color="green"> 有效 </a-tag>
            <a-tag size="large" v-else color="red"> 无效 </a-tag>
          </a-space>
          <!-- 选择器输入 -->
          <myText
            v-model="selectorInput"
            :placeholder="selectorPlaceholder"
            :auto-size="{ minRows: 4, maxRows: 10 }"
            :field="field"
            :intercept="false"
          />
          <template v-if="quickSelectors.filter((s) => s[locateMethod]).length > 0">
            <div class="quick-selector">
              <a-button
                v-for="selector in quickSelectors.filter((s) => s[locateMethod])"
                :key="selector.name"
                @click="handleQuickSelector(selector)"
              >
                {{ selector.name }}
              </a-button>
            </div>
          </template>
          <a-alert type="error" :show-icon="false">
            <b>模式介绍</b>
            <br />
            <b>自由模式：</b>跟随鼠标获取当前对应元素（按住
            <b>{{ isMacOS ? 'Cmd' : 'Ctrl' }}</b> 启用）
            <br />
            <b>列表模式：</b>自动识别页面中的列表元素（按住
            <b>{{ isMacOS ? 'Opt' : 'Alt' }}</b> 启用）
            <br />
            <b>子项模式：</b>获取相对于当前元素的子项（<b>Esc键</b> 退出模式）
            <br />
            <br />
            <b>选中目标(自由、列表模式下)</b>
            <br />
            单击目标获取选择器
            <br />
            双击目标直接确认
            <br />
            右键目标进入 <b>子项模式</b>
          </a-alert>
          <div class="selector-button-group">
            <a-button type="secondary" size="medium" @click="showSelector = false"> 取消 </a-button>
            <a-button type="primary" size="medium" long @click="handleConfirm"> 确定 </a-button>
          </div>
        </div>
        <div class="webview-container" :class="{ hidden: !showBrowser }">
          <Browser ref="browserRef" v-model="currentEnv" inspector />
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue'
import myText from './Text.vue'
import { Message } from '@arco-design/web-vue'
import {
  IconPlus,
  IconQuestionCircle,
  IconCheckCircle,
  IconCopy
} from '@arco-design/web-vue/es/icon'
import Browser from '@/components/Browser.vue'
import { useStore } from '@/store'
import { useFlowStore } from '@/workflow/store'
import { paramReferRegex } from '@/workflow/utils'
const { isMacOS } = useStore()

const props = defineProps({
  field: {
    type: Object,
    required: true
  }
})

const { browserLocal } = window.electronAPI

const envList = ref([])
const currentEnv = ref({ id: '', url: '', storage: {}, cookies: [] })

const loadEnvList = async () => {
  const res = await browserLocal.getBrowsers({ page: 1, pageSize: 1000 })
  envList.value = res.data || []
}
const nodeId = inject('nodeId')
// 工作流ID
const workflowId = inject('workflowId')
// 工作流store
const flowStore = useFlowStore(workflowId)
const showBrowser = ref(false)
// 打开选择器
const handleSelectorOpen = async () => {
  showBrowser.value = true
  // 获取浏览器列表
  await loadEnvList()
  // 获取节点连线
  const pageEdge = flowStore.vueFlowRef.getEdges.find(
    (edge) => edge.target === nodeId && edge.sourceHandle === 'page'
  )
  // 获取浏览器节点
  if (pageEdge) {
    const browserNode = flowStore.vueFlowRef.getNodes.find((node) => node.id === pageEdge.source)
    if (browserNode) {
      const envId = browserNode.data.config.envId
      if (envId && envId !== currentEnv.value.id) {
        await handleEnvChange(envId)
      }
      // 获取访问URL节点
      // const urlVisitNode = flowStore.vueFlowRef.getNodes.find(
      //   (node) =>
      //     node.data.type === 'urlVisit' &&
      //     node.data.config.action === 'goto' &&
      //     flowStore.vueFlowRef.getEdges.some(
      //       (edge) => edge.target === node.id && edge.source === browserNode.id
      //     )
      // )
      // if (urlVisitNode) {
      //   const url = urlVisitNode.data.config.url
      //   if (url) {
      //     await browserRef.value.load(url)
      //   }
      // }
    }
  }
}

const handleSelectorClose = () => {
  showBrowser.value = false
}

const browserRef = ref(null)
const handleEnvChange = async (value) => {
  const res = await window.electronAPI.browserLocal.getBrowser(value)
  currentEnv.value = res
  await new Promise((resolve) => setTimeout(resolve, 10))
  await browserRef.value.reInit()
}

const value = defineModel()
const selectorInput = ref('')
const isValidSelector = ref(true)
const locateMethod = ref('selector')

// 快速选择器
const quickSelectors = ref([
  {
    name: '包含文本',
    selector: '',
    xpath: '//*[contains(text(), "文本")]',
    append: false
  },
  {
    name: 'class 开头是',
    selector: '[class^="类名"]',
    xpath: '//*[starts-with(@class, "类名")]',
    append: false
  },
  {
    name: '属性匹配',
    selector: '[属性名="属性值"]',
    xpath: '//*[contains(@属性名, "属性值")]',
    append: false
  }
])

const handleQuickSelector = (selector) => {
  if (selector.append) {
    selectorInput.value = `${selectorInput.value} ${selector[locateMethod.value]}`
  } else {
    selectorInput.value = selector[locateMethod.value]
  }
}

// 选择器提示
const selectorPlaceholder = computed(() => {
  return locateMethod.value === 'selector'
    ? '输入selector选择器，例如: #id, .class, div > span'
    : "输入XPath表达式，例如: //div[@class='example']"
})

// 预览选择器
const previewSelector = computed(() => {
  if (!selectorInput.value) return ''
  return locateMethod.value === 'xpath' ? `::-p-xpath(${selectorInput.value})` : selectorInput.value
})

// 验证选择器
const validateSelector = () => {
  if (!selectorInput.value) {
    isValidSelector.value = false
    return
  }
  let selectorInputValue = selectorInput.value
  const paramMatch = selectorInputValue.match(paramReferRegex)

  if (paramMatch) {
    isValidSelector.value = true
    return
  }

  try {
    if (locateMethod.value === 'selector') {
      document.querySelector(selectorInputValue)
      isValidSelector.value = true
    } else {
      document.evaluate(selectorInputValue, document, null, XPathResult.ANY_TYPE, null)
      isValidSelector.value = true
    }
  } catch (err) {
    isValidSelector.value = false
  }
}

// API 引用
const { inspector } = window.electronAPI

const showSelector = ref(false)
let inspectorListener = null
let lastTriggerTime = Date.now()

// 注入是否获取焦点
const isFocus = inject('isFocus')
watch(showSelector, (newVal) => {
  isFocus.value = !newVal
  if (newVal) {
    inspectorListener = inspector.onInspector(({ xpath, selector }) => {
      if (showSelector.value) {
        const inspector = locateMethod.value === 'xpath' ? xpath : selector
        //如果短时间内连续触发，视为双击直接确认
        if (Date.now() - lastTriggerTime < 300 && inspector == selectorInput.value) {
          handleConfirm()
          return
        }
        lastTriggerTime = Date.now()
        selectorInput.value = inspector
      }
    })
  } else {
    inspectorListener && inspectorListener()
    inspectorListener = null
  }
})

// 确认选择
const handleConfirm = () => {
  if (!isValidSelector.value) {
    Message.warning('选择器表达式无效')
    return
  }
  value.value = previewSelector.value
  showSelector.value = false
}

watch(
  () => [selectorInput.value, locateMethod.value],
  () => {
    validateSelector()
  }
)

// 处理选择器输入
const handleSelectorInputValue = (value) => {
  // 解析选择器类型
  if (value.startsWith('::-p-xpath(')) {
    locateMethod.value = 'xpath'
    // 提取 XPath 表达式
    const match = value.match(/^::-p-xpath\((.*)\)$/)
    if (match) {
      selectorInput.value = match[1]
    }
  } else {
    locateMethod.value = 'selector'
    selectorInput.value = value
  }
}

// 修复回显问题
watch(
  () => value.value,
  (newVal) => {
    if (newVal) {
      handleSelectorInputValue(newVal)
      validateSelector()
    } else {
      selectorInput.value = ''
      isValidSelector.value = false
    }
  },
  { immediate: true }
)
</script>

<style lang="less" scoped>
.element-selector {
  width: 100%;
  margin-bottom: -5px;
  :deep(.arco-btn) {
    border-radius: 0px;
    height: 100%;
    width: 100%;
  }
}
.icon {
  width: 1em;
  height: 1em;
}

.selector-builder {
  display: flex;
  width: 100%;
  height: 100%;
  .selector-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 240px;
    border-right: 1px solid var(--color-border);
    padding-right: 12px;
    margin-right: 12px;
  }
  .webview-container {
    flex: 1;
    width: 100%;
    height: 100%;
    &.hidden {
      display: none;
    }
  }
  :deep(.arco-radio-group) {
    margin-bottom: 16px;
  }
  .selector-button-group {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    width: 100%;
    margin-top: 16px;
  }
  .quick-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
}
</style>
