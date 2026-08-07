<template>
  <div class="title-bar">
    <div class="left">
      <div class="logo">
        <template v-if="platform !== 'darwin' || isFullscreen"> {{ appName }} </template>
      </div>
      <div class="tabs">
        <div
          class="tab-item home"
          :class="{ active: activeTab === 'home' }"
          @click="switchTab('home')"
        >
          <div class="tab-icon">
            <icon-home />
          </div>
          主窗口
        </div>
        <a-divider
          v-if="Object.keys(openedTabs).length > 0"
          style="margin: 0 8px"
          direction="vertical"
        />
        <div
          v-if="hasScrollbar"
          @click="scrollTabs('left')"
          class="scroll-btn"
          :class="{ disabled: !isLeftScroll }"
        >
          <icon-left />
        </div>
        <div class="editor-tabs" ref="tabsContainer">
          <div
            v-for="(tab, id) in openedTabs"
            :key="id"
            class="tab-item"
            :class="{ active: tab.visible }"
            @click="(switchTab(id), scrollTabs('to', $event.target))"
          >
            <template v-if="tab.type === 'workflow'">
              <div class="tab-icon">
                <icon-loading v-if="tab.store.workflowStatus === 'running'" />
                <icon-check-circle-fill v-else-if="tab.store.workflowStatus === 'completed'" />
                <icon-exclamation-circle-fill v-else-if="tab.store.workflowStatus === 'error'" />
                <icon-branch v-else />
              </div>
              <a-popover :content="tab.name">
                <div class="tab-name" :title="tab.name">
                  {{ tab.name }}
                </div>
              </a-popover>
              <div v-if="tab.store.noticeNum > 0" class="badge">
                {{ tab.store.noticeNum <= 99 ? tab.store.noticeNum : '99+' }}
              </div>
              <div class="nosave" v-if="!tab.store.isSaved"></div>
            </template>
            <template v-if="tab.type === 'dataViewer'">
              <div class="tab-icon">
                <icon-storage />
              </div>
              <a-popover :content="tab.name">
                <div class="tab-name" :title="tab.name">
                  {{ tab.name }}
                </div>
              </a-popover>
            </template>
            <div class="close-btn" size="mini" @click.stop="closeTab(tab)">
              <icon-close />
            </div>
          </div>
        </div>
        <div
          v-if="hasScrollbar"
          @click="scrollTabs('right')"
          class="scroll-btn"
          :class="{ disabled: !isRightScroll }"
        >
          <icon-right />
        </div>
      </div>
    </div>
    <div class="right">
      <div class="window-controls" v-if="platform === 'win32'">
        <a-button type="text" @click="minimizeWindow">
          <icon-minus />
        </a-button>
        <a-button type="text" @click="maximizeWindow">
          <icon-fullscreen />
        </a-button>
        <a-button type="text" @click="hideWindow">
          <icon-close />
        </a-button>
      </div>
    </div>

    <a-modal
      v-model:visible="confirmModalVisible"
      title="保存提示"
      :footer="false"
      width="350px"
      content
    >
      <div style="text-align: center">当前工作流尚未保存，请选择操作</div>
      <div class="confirm-modal-btn">
        <a-button
          type="primary"
          status="danger"
          @click="confirmModalHandle(false)"
          :loading="closeIng"
        >
          不保存关闭
        </a-button>
        <a-button type="primary" @click="confirmModalHandle(true)" :loading="closeIng">
          保存并关闭
        </a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

import {
  IconMinus,
  IconFullscreen,
  IconClose,
  IconHome,
  IconBranch,
  IconLoading,
  IconCheckCircleFill,
  IconExclamationCircleFill,
  IconLeft,
  IconRight,
  IconStorage
} from '@arco-design/web-vue/es/icon'

import { useStore } from '@/store/index'
import { useFlowStore } from '@/workflow/store'
import { storeToRefs } from 'pinia'
import { Message } from '@arco-design/web-vue'
import pkg from '../../../../../package.json'
const appName = ref(pkg.name)
// 标题栏标签滚动容器
const tabsContainer = ref(null)
const hasScrollbar = ref(false)
const clientWidth = ref(0)
const scrollLeft = ref(0)
const scrollWidth = ref(0)
const isLeftScroll = computed(() => {
  return scrollLeft.value > 0 && hasScrollbar.value
})
const isRightScroll = computed(() => {
  return scrollLeft.value + clientWidth.value < scrollWidth.value
})
const scrollTabs = (direction, target) => {
  if (direction === 'left') {
    tabsContainer.value.scrollBy({
      left: -100,
      behavior: 'smooth'
    })
  } else if (direction === 'right') {
    tabsContainer.value.scrollBy({
      left: 100,
      behavior: 'smooth'
    })
  } else if (direction === 'to') {
    const targetRect = target.getBoundingClientRect()
    const containerRect = tabsContainer.value.getBoundingClientRect()
    const parentVisibleWidth = tabsContainer.value.clientWidth
    const parentCenterX = parentVisibleWidth / 2
    const childLeftInParent = targetRect.left - containerRect.left
    const childHalfWidth = target.offsetWidth / 2
    const childCenterX = childLeftInParent + childHalfWidth
    const currentScrollLeft = tabsContainer.value.scrollLeft
    const targetScrollLeft = currentScrollLeft + (childCenterX - parentCenterX)
    // 滚动到目标位置
    tabsContainer.value.scrollTo({
      left: targetScrollLeft,
      behavior: 'smooth'
    })
  }
}
watch(tabsContainer, (newVal) => {
  if (newVal) {
    new ResizeObserver((entries) => {
      for (const entry of entries) {
        scrollWidth.value = entry.target.scrollWidth
        clientWidth.value = entry.target.clientWidth
        // 横向滚动条判断：内容总宽 > 可视宽（考虑1px误差）
        hasScrollbar.value = scrollWidth.value > clientWidth.value + 1
      }
    }).observe(tabsContainer.value)
    // 监听滚动事件
    tabsContainer.value.addEventListener('scroll', () => {
      scrollLeft.value = tabsContainer.value.scrollLeft
    })
  }
})

const store = useStore()

const { platform, openedTabs, activeTab } = storeToRefs(store)
const { switchTab } = store

const { window: windowAPI } = window.electronAPI

const isFullscreen = ref(false)
windowAPI.onFullscreenChange((event, fullscreen) => {
  isFullscreen.value = fullscreen
})

const minimizeWindow = () => {
  windowAPI.minimize()
}

const maximizeWindow = () => {
  windowAPI.maximize()
}

// 关闭按钮：隐藏到后台运行（不弹确认、不退出；从托盘小窗恢复）
const hideWindow = () => {
  windowAPI.hide()
}

const confirmModalVisible = ref(false)
const confirmModalHandle = ref(null)
const closeIng = ref(false)
// 关闭工作流编辑器
const closeTab = async (tab) => {
  if (tab.type === 'workflow') {
    await closeWorkflow(tab)
  } else if (tab.type === 'dataViewer') {
    await closeDataViewer(tab)
  }
}
// 关闭工作流编辑器
const closeWorkflow = async (tab) => {
  const { isExecuting, isSaved, saveWorkflow, reset } = useFlowStore(tab.id)
  const close = async (isSave = false) => {
    closeIng.value = true
    if (isSave) {
      await saveWorkflow()
    }
    confirmModalVisible.value = false
    closeIng.value = false
    delete openedTabs.value[tab.id]
    if (activeTab.value === tab.id) {
      switchTab('home')
    }
    setTimeout(() => {
      reset()
    }, 300)
  }
  if (isExecuting) {
    Message.warning('当前工作流正在执行中，请先停止工作流')
    switchTab(tab.id)
    return
  } else if (!isSaved) {
    switchTab(tab.id)
    confirmModalVisible.value = true
    confirmModalHandle.value = close
  } else {
    close()
  }
}
const closeDataViewer = async (tab) => {
  delete openedTabs.value[tab.id]
  if (activeTab.value === tab.id) {
    switchTab('home')
  }
}
</script>

<style lang="less" scoped>
.title-bar {
  height: 40px;
  background: var(--color-bg-2);
  display: flex;
  justify-content: space-between;
  align-items: center;
  -webkit-app-region: drag;
  border-bottom: 1px solid var(--color-border);
  width: 100%;
  .left {
    display: flex;
    align-items: center;
    gap: 12px;
    -webkit-app-region: no-drag;
    overflow: hidden;
    .logo {
      width: 68px;
      height: 24px;
      margin-left: 12px;
      display: flex;
      align-items: center;
      font-weight: bold;
      flex: 0 0 auto;
      color: var(--color-text-3);
      line-height: 24px;
    }
    .tabs {
      display: flex;
      align-items: center;
      gap: 4px;
      width: calc(100% - 92px);
    }

    /* 滚动按钮样式 */
    .scroll-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-2);
      background-color: var(--color-secondary);
      border-radius: var(--border-radius-small);
      cursor: pointer;
      height: 24px;
      padding: 2px;
      font-size: 12px;
      &:not(.disabled):hover {
        background-color: var(--color-secondary-hover);
      }
      &:not(.disabled):active {
        background-color: var(--color-secondary-active);
      }
      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
    .editor-tabs {
      display: flex;
      align-items: center;
      gap: 4px;
      max-width: 100%;
      border-radius: var(--border-radius-small);
      overflow-x: auto;
      &::-webkit-scrollbar {
        display: none;
      }
    }

    .tab-item {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      height: 24px;
      padding: 0 24px;
      font-size: 12px;
      border-radius: var(--border-radius-small);
      cursor: pointer;
      position: relative;
      color: var(--color-text-2);
      background-color: var(--color-secondary);
      .tab-name {
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        // pointer-events: none;
      }
      &.home {
        padding: 0 8px 0 24px;
      }
      &.active {
        background-color: rgb(var(--primary-6));
        color: #fff;
        &:hover {
          background-color: rgb(var(--primary-6));
        }
        & .nosave {
          background-color: #fff;
        }
      }
      &:hover {
        background-color: var(--color-secondary-hover);
        .close-btn {
          display: flex;
        }
        .nosave {
          display: none;
        }
      }
      .badge {
        background-color: rgb(var(--danger-6));
        color: #fff;
        padding: 0px 2px;
        height: 11px;
        font-size: 8px;
        border-radius: 5px;
        border: 1px solid #fff;
        margin-left: 6px;
        line-height: 9px;
        min-width: 11px;
        text-align: center;
      }
      .tab-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        position: absolute;
        font-size: 12px;
        top: 4px;
        left: 6px;
        pointer-events: none;
      }
      .close-btn {
        display: none;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border-radius: var(--border-radius-small);
        cursor: pointer;
        position: absolute;
        top: 4px;
        right: 4px;
        z-index: 1;
        &:hover {
          // background-color: var(--color-fill-3);
        }
      }
      .nosave {
        background-color: var(--color-text-2);
        width: 8px;
        height: 8px;
        border-radius: 8px;
        cursor: pointer;
        position: absolute;
        top: 8px;
        right: 8px;
      }
    }
  }

  .right {
    -webkit-app-region: no-drag;
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 12px;
    flex: 0 0 auto;

  }

  .window-controls {
    margin-right: -12px;
    .arco-btn {
      padding-left: 12px;
      padding-right: 12px;
      border-radius: 0;
      height: 40px;
      &:hover {
        background-color: var(--color-fill-2);
      }

      &:last-child:hover {
        background-color: rgb(255, 77, 79);
        color: white;
      }
    }
  }
}

.confirm-modal-btn {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
  .arco-btn {
    width: 120px;
  }
}
</style>
