/**
 * @file: 可引用资源索引（工作流/数据表/浏览器/元素集）
 * 统一 @ 菜单与粘贴还原引用的列表来源，避免两处各写一套 IPC 加载逻辑。
 * 按类型懒加载并缓存；`loadAllResources` 供粘贴时一次性解析全部资源名称。
 */

const listOf = (res) => (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);

/** 资源类型定义（图标由 UI 层自行补充，这里只保留数据源与名称字段） */
export const RESOURCE_TABS = [
  {
    key: 'workflow',
    label: '工作流',
    nameKey: 'name',
    loader: () => window.electronAPI.workflow.getWorkflows({ page: 1, pageSize: 100 }),
  },
  {
    key: 'table',
    label: '数据表',
    nameKey: 'name',
    loader: () => window.electronAPI.data.getModels({ page: 1, pageSize: 100 }),
  },
  {
    key: 'browser',
    label: '浏览器',
    nameKey: 'name',
    loader: () => window.electronAPI.browserLocal.getBrowsers({ page: 1, pageSize: 100 }),
  },
  {
    key: 'element',
    label: '元素集',
    nameKey: 'title',
    loader: () => window.electronAPI.elementSet.getElementSets({ page: 1, pageSize: 100 }),
  },
];

/** 各类型资源缓存：{ [type]: [{ type, id, name }] } */
const cache = {};
/** 各类型加载中的 Promise（并发去重） */
const pending = {};

/**
 * 加载单个类型资源（已缓存则直接返回）
 * @param {string} key 资源类型（workflow/table/browser/element）
 * @returns {Promise<Array<{type:string,id:string,name:string}>>}
 */
export const loadResourceType = async (key) => {
  if (cache[key]) return cache[key];
  if (pending[key]) return pending[key];
  const tab = RESOURCE_TABS.find((t) => t.key === key);
  if (!tab) return [];
  pending[key] = (async () => {
    try {
      const list = listOf(await tab.loader()).map((item) => ({
        type: tab.key,
        id: String(item.id ?? ''),
        name: item[tab.nameKey] || item.name || item.title || String(item.id ?? ''),
      }));
      cache[key] = list;
      return list;
    } catch (error) {
      console.error(`加载${tab.label}列表失败:`, error);
      cache[key] = [];
      return [];
    } finally {
      delete pending[key];
    }
  })();
  return pending[key];
};

/** 加载全部类型资源（粘贴还原引用用）；返回扁平数组 */
export const loadAllResources = async () => {
  const lists = await Promise.all(RESOURCE_TABS.map((tab) => loadResourceType(tab.key)));
  return lists.flat();
};

/** 同步读取已缓存资源（未加载完时返回 null，用于粘贴时避免等待） */
export const getCachedResources = () => {
  if (RESOURCE_TABS.some((tab) => !cache[tab.key])) return null;
  return RESOURCE_TABS.flatMap((tab) => cache[tab.key] || []);
};

/** 按名称查找已缓存资源（精确匹配） */
export const findCachedResource = (name) => {
  const list = getCachedResources();
  return list?.find((item) => item.name === name) || null;
};
