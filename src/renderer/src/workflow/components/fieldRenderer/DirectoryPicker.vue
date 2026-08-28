<template>
  <a-modal
    :visible="visible"
    :title="multiLabel ? '选择多个文件夹或文件' : '选择文件夹或文件'"
    :width="880"
    :footer="false"
    :mask-closable="false"
    :keyboard="false"
    @cancel="onCancel"
  >
    <div class="dir-picker">
      <div class="dp-body">
        <!-- 左侧：已授权目录列表 + 增加授权 -->
        <div class="dp-side">
          <div class="dp-side-head">
            <span class="dp-side-title">授权目录</span>
            <a-button size="mini" type="text" @click="grantMore" title="选择目录加入授权">
              <template #icon><icon-plus /></template>
              增加授权
            </a-button>
          </div>
          <div v-if="!authRoots.length" class="dp-side-empty">暂无授权目录</div>
          <div
            v-for="(root, idx) in authRoots"
            :key="idx"
            class="dp-side-item"
            :class="{ active: isCurrentCtx(root) }"
            :title="root"
            @click="navigate(root)"
          >
            <icon-folder class="dp-side-icon" />
            <span class="dp-side-name">{{ basename(root) }}</span>
          </div>
        </div>

        <!-- 右侧：文件/文件夹列表 -->
        <div class="dp-main">
          <!-- 导航栏：面包屑 + 右侧工具 -->
          <div class="dp-nav">
            <div class="dp-crumbs">
              <span
                v-for="(seg, idx) in crumbs"
                :key="idx"
                class="dp-crumb"
                :class="{ last: idx === crumbs.length - 1 }"
                @click="navigate(seg.path)"
              >
                {{ seg.label }}
                <span v-if="idx < crumbs.length - 1" class="dp-crumb-sep">›</span>
              </span>
            </div>
            <div class="dp-nav-actions">
              <a-button-group size="mini">
                <a-button title="列表视图" @click="setView('list')">
                  <icon-menu />
                </a-button>
                <a-button title="卡片视图" @click="setView('card')">
                  <icon-apps />
                </a-button>
              </a-button-group>
            </div>
          </div>

          <!-- 无授权或空提示 -->
          <div v-if="!currentPath" class="dp-grant-empty">
            <icon-folder class="dp-grant-empty-icon" />
            <div class="dp-grant-empty-text">没有可浏览的授权目录</div>
          </div>

          <!-- 列表区 -->
          <div v-else class="dp-list" :class="{ loading }">
            <div v-if="loading" class="dp-loading"><a-spin /></div>
            <template v-else>
              <div v-if="!entries.length" class="dp-list-empty">该目录为空</div>
              <!-- 列表视图 -->
              <template v-else-if="view === 'list'">
                <div
                  v-for="entry in entries"
                  :key="entry.path"
                  class="dp-row"
                  :class="{ selected: isSelected(entry) }"
                  :title="entry.path"
                  @click="selectEntry(entry)"
                  @dblclick="openEntry(entry)"
                >
                  <icon-folder v-if="entry.type === 'dir'" class="dp-row-icon dir" />
                  <img v-else-if="entry._thumb" :src="entry._thumb" class="dp-row-thumb" alt="" />
                  <icon-file v-else class="dp-row-icon file" />
                  <span class="dp-row-name">{{ entry.name }}</span>
                  <span class="dp-row-type">{{ entry.type === 'dir' ? '文件夹' : '文件' }}</span>
                </div>
              </template>
              <!-- 卡片视图 -->
              <template v-else>
                <div class="dp-grid">
                  <div
                    v-for="entry in entries"
                    :key="entry.path"
                    class="dp-card"
                    :class="{ selected: isSelected(entry) }"
                    :title="entry.path"
                    @click="selectEntry(entry)"
                    @dblclick="openEntry(entry)"
                  >
                    <div class="dp-card-thumb">
                      <template v-if="entry.type === 'dir'">
                        <icon-folder class="dp-card-folder" />
                      </template>
                      <img v-else-if="entry._thumb" :src="entry._thumb" class="dp-card-img" alt="" />
                      <icon-file v-else class="dp-card-file" />
                    </div>
                    <div class="dp-card-name">{{ entry.name }}</div>
                  </div>
                </div>
              </template>
            </template>
          </div>
        </div>
      </div>

      <!-- 底部操作区 -->
      <div class="dp-footer">
        <div class="dp-footer-actions">
          <a-button size="small" @click="onCancel">取消</a-button>
          <a-button size="small" type="primary" :disabled="!canConfirm" @click="onConfirm">选择</a-button>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
  import { ref, computed, watch } from 'vue';
  import { Message } from '@arco-design/web-vue';
  import { IconFolder, IconFile, IconPlus, IconFolderAdd, IconMenu, IconApps } from '@arco-design/web-vue/es/icon';
  import { loadGlobalPermissions, toPlain } from '@/utils/permissions';

  const props = defineProps({
    modelValue: { type: String, default: '' },
    visible: { type: Boolean, default: false },
    multiple: { type: Boolean, default: false },
  });
  const emit = defineEmits(['update:modelValue', 'update:visible', 'select']);

  const multiLabel = computed(() => props.multiple);

  /** 判断 path 是否落在某个授权根内（根自身或其后代）；path 非字符串一律视为不命中 */
  const inRootOf = (path, root) => {
    if (typeof path !== 'string' || typeof root !== 'string' || !root) return false;
    const s = root === '/' ? '/' : root.includes('\\') ? '\\' : '/';
    return path === root || path.startsWith(root + s);
  };
  const inAnyRoot = (path) => authRoots.value.some((r) => inRootOf(path, r));
  const isCurrentCtx = (root) => !!currentPath.value && inRootOf(currentPath.value, root);

  const isSelected = (entry) => (props.multiple ? selected.value.includes(entry.path) : selected.value === entry.path);

  // ── 状态 ──
  const currentPath = ref('');
  const entries = ref([]); // {name, path, type:'dir'|'file'}
  const selected = ref(props.multiple ? [] : '');
  const loading = ref(false);
  const authRoots = ref([]);

  // ── 视图与图片缩略 ──
  const VIEW_KEY = 'freerpa.path.view';
  const view = ref(localStorage.getItem(VIEW_KEY) || 'list');
  const setView = (v) => {
    view.value = v;
    localStorage.setItem(VIEW_KEY, v);
  };
  const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'];
  const isImage = (entry) =>
    entry.type === 'file' && IMAGE_EXTS.includes((entry.name.split('.').pop() || '').toLowerCase());
  const thumbCache = new Map();
  const loadThumbs = async (list) => {
    for (const e of list) {
      if (!isImage(e)) continue;
      if (thumbCache.has(e.path)) {
        e._thumb = thumbCache.get(e.path);
        continue;
      }
      let d = '';
      try {
        const r = await window.electronAPI.fs.readThumb(e.path);
        d = r?.ok ? r.dataUrl : '';
      } catch {
        d = '';
      }
      thumbCache.set(e.path, d);
      e._thumb = d;
    }
  };

  const crumbs = computed(() => {
    if (!currentPath.value) return [];
    // 取当前路径命中的最深授权根，面包屑以它为根（不显示授权目录之上的层级）
    const roots = authRoots.value.filter((r) => inRootOf(currentPath.value, r));
    if (!roots.length) return [{ label: currentPath.value, path: currentPath.value }];
    const root = roots.sort((a, b) => b.length - a.length)[0];
    const s = root === '/' ? '/' : root.includes('\\') ? '\\' : '/';
    const rest = currentPath.value === root ? '' : currentPath.value.slice(root.length).replace(/^[/\\]+/, '');
    const segs = rest ? rest.split(/[/\\]/).filter(Boolean) : [];
    const out = [{ label: root, path: root }];
    let acc = root;
    segs.forEach((seg) => {
      acc = acc + (acc.endsWith(s) ? '' : s) + seg;
      out.push({ label: seg, path: acc });
    });
    return out;
  });
  const canConfirm = computed(() => {
    if (props.multiple) {
      return selected.value.length > 0 && selected.value.every((p) => inAnyRoot(p));
    }
    return !!selected.value && inAnyRoot(selected.value);
  });

  /** 取路径最后一级（Windows/macOS 分隔符都兼容） */
  const basename = (p) => {
    const s = p.includes('\\') ? '\\' : '/';
    const idx = p.lastIndexOf(s);
    return idx >= 0 ? p.slice(idx + 1) : p;
  };

  /** 读取目录内容；成功返回 true。toast: false 时静默处理（初始化探测用，避免对失效老授权根误报） */
  const listDir = async (dirPath, { toast = true } = {}) => {
    if (!dirPath) return false;
    loading.value = true;
    try {
      const res = await window.electronAPI.fs.listDirectory(dirPath);
      if (!res?.ok) {
        if (toast) Message.error(res?.error || '无法访问该目录');
        return false;
      }
      currentPath.value = res.current;
      entries.value = res.entries || [];
      loadThumbs(entries.value); // 图片缩略图异步加载
      return true;
    } catch (e) {
      if (toast) Message.error('目录读取失败: ' + (e?.message || e));
      return false;
    } finally {
      loading.value = false;
    }
  };

  const loadList = async (dirPath) => {
    const target = dirPath || currentPath.value;
    if (!target) return;
    if (!inAnyRoot(target)) {
      Message.warning('仅能浏览已授权目录');
      return;
    }
    await listDir(target);
  };
  const navigate = async (dirPath) => {
    if (!dirPath || !inAnyRoot(dirPath)) return;
    if (props.multiple) selected.value = [];
    await loadList(dirPath);
  };

  const selectEntry = (entry) => {
    if (props.multiple) {
      const i = selected.value.indexOf(entry.path);
      if (i >= 0) selected.value.splice(i, 1);
      else selected.value.push(entry.path);
    } else {
      selected.value = entry.path;
    }
  };
  const openEntry = (entry) => {
    // 目录双击进入；文件双击等同点击「选择」完成确认（双击前的 click 已将其置为选中）
    if (entry.type === 'dir') navigate(entry.path);
    else onConfirm();
  };

  /** 增加授权：原生选择器选择一个或多个目录，写入权限根并保存 */
  const grantMore = async () => {
    let result;
    try {
      result = await window.electronAPI.dialog.openPath({
        title: '选择要授权的目录',
        properties: ['openDirectory', 'multiSelections'],
      });
    } catch (e) {
      Message.error('打开原生选择器失败: ' + (e?.message || e));
      return;
    }
    if (result.canceled || !result.filePaths?.length) return;
    try {
      const perms = await loadGlobalPermissions();
      const roots = [...new Set([...(perms.io?.roots || []), ...result.filePaths])];
      perms.io = { ...(perms.io || {}), roots };
      await window.electronAPI.store.set('permissions', toPlain(perms));
      authRoots.value = roots;
      Message.success(`已授权 ${result.filePaths.length} 个目录`);
      // 若当前浏览未指向任何授权目录，则跳转到新授权的第一个
      if (!currentPath.value || !inAnyRoot(currentPath.value)) {
        await loadList(result.filePaths[0]);
      }
    } catch (e) {
      Message.error('授权保存失败: ' + (e?.message || e));
    }
  };

  const onConfirm = () => {
    const val = props.multiple ? [...selected.value] : selected.value;
    emit('update:modelValue', val);
    emit('select', val);
    close();
  };
  const onCancel = () => close();
  const close = () => emit('update:visible', false);

  // 打开时初始化
  watch(
    () => props.visible,
    async (v) => {
      if (!v) return;
      selected.value = props.multiple ? [] : '';
      try {
        const perms = await loadGlobalPermissions();
        authRoots.value = perms.io?.roots || [];
      } catch {
        authRoots.value = [];
      }
      // 初始浏览：优先已有值（需在授权内）；否则在授权根中静默探测第一个可用目录（跳过失效根，避免误报「不是有效目录」）
      const initial = props.multiple ? (Array.isArray(props.modelValue) ? props.modelValue[0] : '') : props.modelValue;
      const candidates = [];
      if (initial && inAnyRoot(initial)) candidates.push(initial);
      candidates.push(...authRoots.value);
      for (const c of candidates) {
        if (await listDir(c, { toast: false })) return;
      }
      currentPath.value = '';
      entries.value = [];
    }
  );
</script>

<style scoped lang="less">
  .dir-picker {
    display: flex;
    flex-direction: column;
    height: 460px;
    gap: 8px;
    font-size: 13px;

    .dp-nav {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      border-bottom: 1px solid var(--color-border-1);

      .dp-crumbs {
        flex: 1;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 2px;
        min-width: 0;
        .dp-crumb {
          color: var(--color-text-2);
          cursor: default;
          &:not(.last) {
            cursor: pointer;
            color: var(--color-link);
          }
          .dp-crumb-sep {
            color: var(--color-text-4);
            margin: 0 2px;
          }
        }
      }
    }

    .dp-body {
      display: flex;
      flex: 1;
      min-height: 0;
      border: 1px solid var(--color-border-2);
      border-radius: 4px;
      overflow: hidden;

      .dp-side {
        width: 220px;
        border-right: 1px solid var(--color-border-2);
        padding: 8px 4px;
        overflow: auto;
        flex-shrink: 0;
        background: var(--color-fill-1);

        .dp-side-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 2px 4px 6px;
        }
        .dp-side-title {
          font-size: 12px;
          color: var(--color-text-3);
        }
        .dp-side-empty {
          font-size: 12px;
          color: var(--color-text-4);
          padding: 6px 8px;
        }
        .dp-side-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          margin: 1px 0;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.15s;
          &:hover,
          &.active {
            background: var(--color-fill-3);
          }
          &.active {
            font-weight: 600;
          }
          .dp-side-icon {
            color: var(--color-text-2);
            flex-shrink: 0;
          }
          .dp-side-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }

      .dp-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;

        .dp-grant-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--color-text-3);
          .dp-grant-empty-icon {
            font-size: 40px;
            color: var(--color-text-4);
          }
          .dp-grant-empty-text {
            margin-bottom: 4px;
          }
        }

        .dp-list {
          flex: 1;
          overflow: auto;
          padding: 6px 0;
          position: relative;
          &.loading {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .dp-loading {
            padding: 24px;
          }
          .dp-list-empty {
            padding: 30px 0;
            text-align: center;
            color: var(--color-text-3);
          }

          .dp-row {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            cursor: pointer;
            &:hover,
            &.selected {
              background: var(--color-fill-2);
            }
            .dp-row-icon {
              flex-shrink: 0;
              &.dir {
                color: var(--color-warning-6);
              }
              &.file {
                color: var(--color-text-3);
              }
            }
            .dp-row-thumb {
              width: 28px;
              height: 28px;
              object-fit: cover;
              border-radius: 4px;
              flex-shrink: 0;
            }
            .dp-row-name {
              flex: 1;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .dp-row-type {
              flex-shrink: 0;
              font-size: 12px;
              color: var(--color-text-3);
            }
          }

          .dp-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
            gap: 10px;
            padding: 12px;
            .dp-card {
              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 10px 6px 8px;
              border: 1px solid var(--color-border-2);
              border-radius: 6px;
              cursor: pointer;
              transition:
                background-color 0.15s,
                border-color 0.15s;
              &:hover,
              &.selected {
                background: var(--color-fill-2);
              }
              .dp-card-thumb {
                width: 100%;
                height: 84px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                .dp-card-folder {
                  font-size: 60px;
                  color: var(--color-warning-6);
                }
                .dp-card-img {
                  max-width: 100%;
                  max-height: 84px;
                  object-fit: contain;
                }
                .dp-card-file {
                  font-size: 42px;
                  color: var(--color-text-3);
                }
              }
              .dp-card-name {
                width: 100%;
                margin-top: 6px;
                text-align: center;
                font-size: 12px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
            }
          }
        }
      }
    }

    .dp-footer {
      display: flex;
      justify-content: flex-end;
      .dp-footer-actions {
        display: flex;
        gap: 8px;
      }
    }
  }
</style>
