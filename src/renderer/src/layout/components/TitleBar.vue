<template>
  <div class="title-bar">
    <div class="left">
      <div class="logo">
        <template v-if="platform !== 'darwin' || isFullscreen">{{ appName }}</template>
      </div>
      <div class="tabs">
        <div class="tab-item home" :class="{ active: activeTab === 'home' }" @click="switchTab('home')">
          <div class="tab-icon">
            <icon-home />
          </div>
          <span>首页</span>
        </div>
        <a-divider v-if="Object.keys(openedTabs).length > 0" style="margin: 0 8px" direction="vertical" />
        <div v-if="hasScrollbar" @click="scrollTabs('left')" class="scroll-btn" :class="{ disabled: !isLeftScroll }">
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
                <icon-loading v-if="tab.store.workflowStatus === 'running' || isBatchLive(id)" />
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
        <div v-if="hasScrollbar" @click="scrollTabs('right')" class="scroll-btn" :class="{ disabled: !isRightScroll }">
          <icon-right />
        </div>
      </div>
    </div>
    <div class="right">
      <!-- 有更新：标题栏「有更新」按钮，点击打开更新弹窗 -->
      <a-button
        v-if="store.updateVisible"
        class="update-btn"
        size="mini"
        type="secondary"
        status="danger"
        @click="store.updateModalVisible = true"
      >
        <icon-cloud-download />
        有新版本
      </a-button>
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

    <a-modal v-model:visible="confirmModalVisible" title="保存提示" :footer="false" width="350px" content>
      <div style="text-align: center">当前工作流尚未保存，请选择操作</div>
      <div class="confirm-modal-btn">
        <a-button type="primary" status="danger" @click="confirmModalHandle(false)" :loading="closeIng">
          不保存关闭
        </a-button>
        <a-button type="primary" @click="confirmModalHandle(true)" :loading="closeIng">保存并关闭</a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
  import { computed, ref, watch, nextTick } from 'vue';

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
    IconCloudDownload,
    IconStorage,
  } from '@arco-design/web-vue/es/icon';

  import { useStore } from '@/store/index';
  import { useFlowStore } from '@/workflow/store';
  import { getRunner } from '@/workflow/batch/BatchRunner';
  import { storeToRefs } from 'pinia';
  import { Message } from '@arco-design/web-vue';
  import pkg from '../../../../../package.json';
  const appName = ref(pkg.name);
  // 标题栏标签滚动容器
  const tabsContainer = ref(null);
  const hasScrollbar = ref(false);
  const clientWidth = ref(0);
  const scrollLeft = ref(0);
  const scrollWidth = ref(0);
  const isLeftScroll = computed(() => {
    return scrollLeft.value > 0 && hasScrollbar.value;
  });
  const isRightScroll = computed(() => {
    return scrollLeft.value + clientWidth.value < scrollWidth.value;
  });
  const scrollTabs = (direction, target) => {
    if (direction === 'left') {
      tabsContainer.value.scrollBy({
        left: -100,
        behavior: 'smooth',
      });
    } else if (direction === 'right') {
      tabsContainer.value.scrollBy({
        left: 100,
        behavior: 'smooth',
      });
    } else if (direction === 'to') {
      const targetRect = target.getBoundingClientRect();
      const containerRect = tabsContainer.value.getBoundingClientRect();
      const parentVisibleWidth = tabsContainer.value.clientWidth;
      const parentCenterX = parentVisibleWidth / 2;
      const childLeftInParent = targetRect.left - containerRect.left;
      const childHalfWidth = target.offsetWidth / 2;
      const childCenterX = childLeftInParent + childHalfWidth;
      const currentScrollLeft = tabsContainer.value.scrollLeft;
      const targetScrollLeft = currentScrollLeft + (childCenterX - parentCenterX);
      // 滚动到目标位置
      tabsContainer.value.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth',
      });
    }
  };
  const measureTabs = () => {
    const el = tabsContainer.value;
    if (!el) return;
    scrollWidth.value = el.scrollWidth;
    clientWidth.value = el.clientWidth;
    // 横向滚动条判断：内容总宽 > 可视宽（考虑 1px 误差）
    hasScrollbar.value = scrollWidth.value > clientWidth.value + 1;
  };
  watch(tabsContainer, (newVal) => {
    if (newVal) {
      new ResizeObserver(() => measureTabs()).observe(tabsContainer.value);
      // 监听滚动事件
      tabsContainer.value.addEventListener('scroll', () => {
        scrollLeft.value = tabsContainer.value.scrollLeft;
      });
      measureTabs();
    }
  });
  // 标签增删/重命名后内容宽度变化，需重新计算是否溢出

  const store = useStore();

  const { platform, openedTabs, activeTab } = storeToRefs(store);
  watch(
    () => Object.values(openedTabs.value).map((tab) => `${tab.name}-${tab.type}`).join('|'),
    () => nextTick(measureTabs)
  );
  const { switchTab } = store;

  // 该工作流是否存在未结束的多线程（状态为模块级单例，读 rows 保持响应式）
  const isBatchLive = (id) => getRunner(id).hasLive;

  const { window: windowAPI } = window.electronAPI;

  const isFullscreen = ref(false);
  windowAPI.onFullscreenChange((event, fullscreen) => {
    isFullscreen.value = fullscreen;
  });

  const minimizeWindow = () => {
    windowAPI.minimize();
  };

  const maximizeWindow = () => {
    windowAPI.maximize();
  };

  // 关闭按钮：开发模式直接退出（便于调试）；生产模式隐藏到托盘后台运行（从托盘恢复）
  const hideWindow = () => {
    if (import.meta.env.DEV) windowAPI.close();
    else windowAPI.hide();
  };

  const confirmModalVisible = ref(false);
  const confirmModalHandle = ref(null);
  const closeIng = ref(false);
  // 关闭工作流编辑器
  const closeTab = async (tab) => {
    if (tab.type === 'workflow') {
      await closeWorkflow(tab);
    } else if (tab.type === 'dataViewer') {
      await closeDataViewer(tab);
    }
  };
  // 关闭工作流编辑器
  const closeWorkflow = async (tab) => {
    // 多线程执行中：标签进入 loading 且禁止关闭（线程独立于页面存活，但仍阻止误关闭）
    if (isBatchLive(tab.id)) {
      Message.warning('当前工作流正在执行中，请先停止工作流');
      switchTab(tab.id);
      return;
    }
    const { isExecuting, isSaved, saveWorkflow, reset } = useFlowStore(tab.id);
    const close = async (isSave = false) => {
      closeIng.value = true;
      if (isSave) {
        await saveWorkflow();
      }
      confirmModalVisible.value = false;
      closeIng.value = false;
      delete openedTabs.value[tab.id];
      if (activeTab.value === tab.id) {
        switchTab('home');
      }
      setTimeout(() => {
        reset();
      }, 300);
    };
    if (isExecuting) {
      Message.warning('当前工作流正在执行中，请先停止工作流');
      switchTab(tab.id);
      return;
    } else if (!isSaved) {
      switchTab(tab.id);
      confirmModalVisible.value = true;
      confirmModalHandle.value = close;
    } else {
      close();
    }
  };
  const closeDataViewer = async (tab) => {
    delete openedTabs.value[tab.id];
    if (activeTab.value === tab.id) {
      switchTab('home');
    }
  };
</script>

<style lang="less" scoped>
  .title-bar {
    height: var(--mac-titlebar-height);
    background: linear-gradient(180deg, rgba(248, 248, 250, 0.74) 0%, rgba(241, 241, 245, 0.6) 100%);
    -webkit-backdrop-filter: blur(30px) saturate(180%);
    backdrop-filter: blur(30px) saturate(180%);
    display: flex;
    justify-content: space-between;
    align-items: center;
    -webkit-app-region: drag;
    border-bottom: var(--mac-hairline) solid var(--mac-separator);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
    width: 100%;
    .left {
      display: flex;
      align-items: center;
      gap: 10px;
      /* 整条左侧栏可拖拽（含双击放大）；仅交互元素单独 no-drag */
      -webkit-app-region: drag;
      overflow: hidden;
      height: 100%;
      flex: 1 1 auto;
      min-width: 0;
      .logo {
        width: 72px;
        height: 24px;
        margin-left: 12px;
        display: flex;
        align-items: center;
        font-weight: 600;
        font-size: 16px;
        letter-spacing: 0.02em;
        flex: 0 0 auto;
        color: var(--mac-text-2);
        line-height: 24px;
      }
      .tabs {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1 1 auto;
        min-width: 0;
        height: 100%;
      }

      /* 滚动按钮 */
      .scroll-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        color: var(--mac-text-2);
        background: transparent;
        border-radius: var(--mac-radius-sm);
        cursor: pointer;
        -webkit-app-region: no-drag;
        height: 24px;
        width: 24px;
        padding: 2px;
        font-size: 12px;
        &:not(.disabled):hover {
          background: var(--mac-fill);
          color: var(--mac-text);
        }
        &:not(.disabled):active {
          background: var(--mac-fill-strong);
        }
        &.disabled {
          opacity: 0.35;
          cursor: default;
        }
      }
      .editor-tabs {
        display: flex;
        align-items: center;
        flex: 1 1 0;
        min-width: 0;
        gap: 3px;
        padding: 2px;
        border-radius: var(--mac-radius-sm);
        overflow-x: auto;
        /* 标签条本身可拖拽：打开标签后空白区域仍能拖动窗口；标签单独 no-drag */
        -webkit-app-region: drag;
        &::-webkit-scrollbar {
          display: none;
        }
      }

      /* 标签页：Safari 风格分段标签 */
      .tab-item {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        height: 30px;
        /* 左侧留出图标流式布局的空间，右侧为关闭按钮预留位置 */
        padding: 0 24px 0 9px;
        font-size: 12px;
        font-weight: 500;
        border-radius: var(--mac-radius-sm);
        border: var(--mac-hairline) solid transparent;
        cursor: pointer;
        position: relative;
        color: var(--mac-text-2);
        background: transparent;
        -webkit-app-region: no-drag;
        transition:
          background-color 0.15s ease,
          color 0.15s ease,
          box-shadow 0.15s ease;
        .tab-name {
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        &.home {
          padding: 0 12px;
        }
        &.active {
          background: rgba(255, 255, 255, 0.92);
          border-color: rgba(0, 0, 0, 0.09);
          color: var(--mac-text);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            0 1px 2px rgba(0, 0, 0, 0.06);
          &:hover {
            background: rgba(255, 255, 255, 0.98);
          }
          & .nosave {
            background-color: var(--mac-orange);
          }
        }
        &:hover {
          background: var(--mac-fill);
          .close-btn {
            display: flex;
          }
          .nosave {
            display: none;
          }
        }
        .badge {
          background-color: var(--mac-red);
          color: #fff;
          padding: 0px 3px;
          height: 12px;
          font-size: 9px;
          font-weight: 600;
          border-radius: 999px;
          margin-left: 6px;
          line-height: 11px;
          min-width: 12px;
          text-align: center;
        }
        /* 图标参与 flex 流式布局（不再绝对定位），由父级 align-items 保证
           在不同平台/字体下（macOS PingFang / Windows 微软雅黑）都垂直居中 */
        .tab-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 16px;
          width: 16px;
          height: 16px;
          margin-right: 6px;
          font-size: 12px;
          pointer-events: none;
          color: inherit;
        }
        .close-btn {
          display: none;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          cursor: pointer;
          position: absolute;
          top: 7px;
          right: 5px;
          z-index: 1;
          color: var(--mac-text-3);
          &:hover {
            background-color: rgba(0, 0, 0, 0.08);
            color: var(--mac-text);
          }
        }
        .nosave {
          background-color: var(--mac-orange);
          width: 7px;
          height: 7px;
          border-radius: 50%;
          cursor: pointer;
          position: absolute;
          top: 11px;
          right: 10px;
        }
      }
    }

    .right {
      -webkit-app-region: no-drag;
      display: flex;
      align-items: center;
      padding: 0 10px;
      gap: 8px;
      flex: 0 0 auto;
    }

    .update-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 24px;
      padding: 0 10px;
      border-radius: var(--mac-radius-sm);
      -webkit-app-region: no-drag;
      font-weight: 500;
      font-size: 12px;
      color: #d63a2f !important;
      background: rgba(255, 59, 48, 0.1) !important;
      border: var(--mac-hairline) solid rgba(255, 59, 48, 0.28) !important;
      box-shadow: none !important;
      &:hover {
        background: rgba(255, 59, 48, 0.16) !important;
      }
    }

    .window-controls {
      margin-right: -10px;
      .arco-btn {
        padding-left: 12px;
        padding-right: 12px;
        border-radius: 0;
        height: var(--mac-titlebar-height);
        color: var(--mac-text-2);
        &:hover {
          background-color: var(--mac-fill);
        }

        &:last-child:hover {
          background-color: var(--mac-red);
          color: white;
        }
      }
    }
  }

  .confirm-modal-btn {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 24px;
    .arco-btn {
      width: 120px;
    }
  }
</style>
