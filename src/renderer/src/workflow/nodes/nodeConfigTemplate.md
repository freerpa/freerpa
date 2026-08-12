# 节点配置模板（字段大全参考）

> **用途**：汇总 `nodes/` 目录下全部内置节点（79 个）`default export` 中出现的所有配置字段、字段键、字段 `type` 取值、`inputs`/`outputs` 结构与动态 IO 写法，作为新增节点或修改现有节点时的配置参考模板。
>
> **重要说明**：
> - 本文件为纯文档，不参与代码加载。节点定义通过 `nodes/index.js` 的 `import.meta.glob` 节点扫描（模式：`'./*' + '/V{num}/index.js'`）自动加载，`.md` 文件不会被注册为节点。
> - 节点目录规范：`nodes/{nodeType}/V{num}/index.js`（节点定义） + `execute.js`（执行器）。
> - 每个 `nodeType` 自动选取最大版本号（`V{num}`）作为当前定义，旧版本目录保留用于兼容。

---

## 一、节点定义顶层结构（default export）

每个节点 `index.js` 默认导出一个对象，结构如下：

```js
export default {
  // ── 必填 ──
  type: 'myNode',            // 节点类型唯一标识（小驼峰，全库唯一）
                             // 注意：可带数字后缀表示兼容版本，如 dataRead 节点 type 为 'dataReadV3'
  name: '我的节点',           // 节点在节点列表中的显示名称
  icon: RiFileLine,          // 节点图标组件
                             // 来源：@remixicon/vue 的 RiXxxLine，或
                             //       @arco-design/web-vue/es/icon 的 IconXxx
  description: '节点功能描述', // 节点列表与画布上的说明文字

  // ── 可选 ──
  view: false,               // 是否有自定义配置视图（存在同目录 view.vue 时设 true）
                             // 如 networkHttpRequest、timeSchedule、dataHandler* 等节点
  prev: false,               // 是否允许连接前置节点（workflowStart 设 false，流程开始节点无前置）
  next: true,                // 是否允许连接后续节点（workflowEnd 设 false，流程结束节点无后续）
  config: { ... },           // 配置分组（见「二、config 配置分组」）
  inputs: [ ... ],           // 输入端口定义（见「四、inputs / outputs」）
  outputs: [ ... ],          // 输出端口定义（见「四、inputs / outputs」）
  subFlow: { ... }           // 子流程容器定义（仅 workflowLoop 使用，见「五、subFlow 子流程」）
}
```

字段出现情况统计：

| 顶层键 | 说明 |
|---|---|
| `type` / `name` / `icon` / `description` / `config` / `inputs` / `outputs` | 全部节点均有 |
| `view` | 约一半节点有；无 view 时不写该键 |
| `prev` / `next` | 仅 workflowStart / workflowEnd 等流程边界节点使用 |
| `subFlow` | 仅 workflowLoop |

---

## 二、config 配置分组

`config` 为「分组名 → 分组对象」的映射，分组对象为 `{ name, fields }`：

```js
config: {
  basic: {                 // 分组 key（内部标识，一般用英文小写）
    name: '基础配置',        // 分组在表单中的标题
    fields: { ... }         // 分组内字段定义（字段 key → 字段对象，见「三、字段键大全」）
  },
  config: {                 // 可多个分组，如 workflowStart 有 basic（输入项）与 config（配置项）
    name: '配置项',
    fields: { ... }
  }
}
```

约定：

- 绝大多数节点只有一个 `basic` 分组（`name: '基础配置'`）。
- 无配置的节点写 `config: {}`（如 dataDelete、dataTemp、dataHandler*、fileStatus 等）。
- 分组名可自定义：dataParser 用 `name: '规则'`，dataExtract 用 `name: '提取规则'`。
- 执行配置（错误处理）分组可由公共函数 `buildErrorHandleGroup(remoteMethod)` 生成（见「六、公共常量」）。

---

## 三、字段键大全（fields 中每个字段对象可用的键）

字段对象示例（汇总全部节点后出现的所有键）：

```js
fieldKey: {
  // ── 基础 ──
  id: 'fieldKey',            // 字段唯一标识，一般与字段 key 同名（必填）
  name: '字段名称',           // 表单中显示的标签（必填）
  type: 'text',              // 控件类型（见「字段 type 取值大全」）
  default: '',               // 默认值；类型跟随控件：
                             //   text/string/input/code/date/path/select → '' 或具体值
                             //   number → 0 或具体数字（如 30000）
                             //   switch → false / true
                             //   checkbox/array → []（如 ['clearFirst']）
                             //   object → {} 或具体对象
  description: '字段说明',    // 悬停提示与表单下方说明文字

  // ── 联动显示（条件显示） ──
  show: '${otherField} === "value"',   // 控制字段显示/隐藏的表达式字符串。
                             // 语法：${字段key} 引用同表单其他字段的值，
                             // 支持 === / !== / includes() / 多条件 && || 及数组形式：
                             //   '${keyboardMode} === "key"'
                             //   "['POST','PUT'].includes(${method})"
                             //   '${launchOptions}.includes("--custom-arg")'
                             //   '${isDeep}'（布尔字段可直接引用）
                             //   show: false —— 隐藏字段（如内部驱动字段 outputs）
  required: true,            // 是否必填；可以是布尔值，也可以是表达式字符串：
                             //   required: '${getType} === "attribute"'

  // ── 选项类控件 ──
  options: [                 // select / radio / checkbox 的选项列表
    { label: '显示文本', value: '存储值' },
    { label: '显示文本2', value: '存储值2' }
  ],
  multiple: true,            // select 多选（值为数组，配合 default: []、props 使用）
  props: { allowClear: true },  // 透传给表单控件的属性（如 select 支持清除）
  remote: true,              // select 选项是否远程动态获取（此时 options 可留空）
  remoteMethod: async (keyword = '', formData) => {
    // 远程选项加载函数：接收搜索关键词（可选），返回 Promise<[{label, value}]>
    // 示例（获取数据表列表）：
    // const result = await window.electronAPI.data.getModels({ page: 1, pageSize: 1000, keyword })
    // return result.data.map((model) => ({ label: model.name, value: model.id }))
  },

  // ── 数字类控件 ──
  min: 0,                    // 最小值（number 字段）
  max: 100,                  // 最大值（number 字段）
  step: 1000,                // 步进值（number 字段，如超时时间按 1000 步进）

  // ── 数组/对象类控件 ──
  fields: { ... } 或 [ ... ], // 子字段定义：
                             //   array 类型：fields 可为对象（key→字段对象，对象型数组项）
                             //     或数组（[字段对象, ...]，数组型数组项，如 extraArgs）
                             //   object 类型：fields 为对象（key→字段对象），如 area、dragConfig
  defaultValue: [],          // array 字段的默认值（等价于 default: []）
  codeView: true,            // array 字段以代码视图展示（true 或 { type: 'object', key: 'key', value: 'value' }）
  nolabel: true,             // 不显示字段标签（同义写法：noLabel: true，注意大小写两种都有出现）

  // ── 代码类控件 ──
  language: 'javascript',    // code 字段的语言（也支持引用表达式：language: '${bodyType}'）
  prefix: 'function handler(data){',  // 代码编辑器自动包裹的前缀
  suffix: '}',                        // 代码编辑器自动包裹的后缀

  // ── 路径类控件 ──
  pathType: 'file',          // path 字段的路径类型：'file' / 'folder' / 'directory'
                             //   （'directory' 与 'folder' 等价，如 fileDirCreate 用 'directory'）

  // ── 交互与联动 ──
  onChange: (value, formData) => {
    // 字段值变化时的回调，可联动修改其他字段（formData.value.xxx）或调用主进程 API
    // 示例（选择浏览器环境后自动回填代理地址）：
    // if (!value) return
    // const env = await window.electronAPI.browserLocal.getBrowser(value)
    // if (env?.proxy_url && !formData.value.proxyUrl) formData.value.proxyUrl = env.proxy_url
  },
  quickConfig: true,         // 是否出现在画布节点的「快速配置」面板中
  onlyQuick: true,           // 仅在快速配置面板显示（主表单中不显示），通常配合 nolabel 提示类字段
  paramRef: false,           // 是否禁用「参数引用」（即该字段值不允许引用上游输出；默认可引用）
                             //   布尔字段、远程选项、程序化字段等通常设 false

  // ── 其他（较少用） ──
  extensions: ['xlsx'],      // 文件选择控件限制的文件后缀（workbookCreate.filePath 使用）
  content: '提示内容',        // alert 类型字段的提示正文（配合 type: 'alert'）
  placeholder: '占位提示',    // 输入框占位文字
}
```

### 字段 type 取值大全

合并全部节点 config 字段、嵌套 fields 与公共常量后的 `type` 取值：

| type | 说明 |
|---|---|
| `string` | 普通文本输入（如参数名、URL、数据路径） |
| `text` | 文本输入（与 string 类似，最常用；多数节点用 text） |
| `input` | 输入框（与 text/string 同类，部分节点用，如 cdpUrl、operator） |
| `textarea` | 多行文本输入 |
| `number` | 数字输入（min/max/step/default） |
| `switch` | 开关（布尔，default: false/true） |
| `select` | 下拉选择（options / multiple / remote / props） |
| `radio` | 单选（options，default 为选中 value） |
| `checkbox` | 多选（options，default 为数组） |
| `array` | 数组编辑器（fields 定义子字段；codeView 代码视图） |
| `object` | 对象编辑器（fields 定义子字段，如截图区域 area） |
| `code` | 代码编辑器（language / prefix / suffix） |
| `date` | 日期选择（default: 'YYYY-MM-DD' 或配合 format） |
| `color` | 颜色选择 |
| `path` | 路径选择（pathType: 'file' / 'folder'） |
| `selector` | 网页元素选择器（配合浏览器元素拾取） |
| `browser` | 浏览器环境选择（browserOpen.envId） |
| `alert` | 提示条（只读提示，配合 content/nolabel/onlyQuick，如拖拽提示） |
| `any` | 任意类型（对象/数组等，见 configFields 的 anyValue 场景） |

---

## 四、inputs / outputs 端口定义

### 固定端口（最常见）

数组内每项为一个端口对象：

```js
inputs: [
  {
    id: 'page',              // 端口唯一标识
    name: '网页',           // 端口显示名称
    type: 'page',            // 数据类型（可字符串或数组多类型，见下）
    required: true,          // 是否必连
    description: '浏览器'     // 端口说明
  }
],
outputs: [
  { id: 'content', name: '内容', type: ['string','array','object'], description: '获取到的内容' }
]
```

### 端口 type 取值

| type | 说明 |
|---|---|
| `string` | 文本（outputs 常用） |
| `number` | 数字（状态码、计数、条数等） |
| `boolean` | 布尔（元素状态 exists/visible/inViewport） |
| `object` | 对象（完整响应、位置大小 rect 等） |
| `array` | 数组（查询结果、路径列表） |
| `any` | 任意类型（脚本执行结果、响应数据） |
| `page` | 浏览器页面（browser* 节点间传递） |
| `dataQuery` | 数据表查询标识（dataSave/dataRead 输出，dataDelete/Update 输入） |
| `tempStore` | 暂存器引用（dataTemp 输出 / dataTempClear 输入） |
| `timer` | 计时器引用（timeBaseTimer 输出 / timeBaseTimerHandle 输入） |
| `counter` | 计数器引用（timeCounter 输出 / timeCounterHandle 输入） |
| `websocket` | WebSocket 连接（networkWebsocketConnect 输出 / Send 输入） |
| `worksheet` | Excel 工作表（workbook* 节点间传递） |
| `dynamic` | 动态端口（见「五、动态 IO」） |
| 数组形式 | 多类型声明，如 `type: ['string','array']`、`['array','object']` |

> 注意：outputs 项偶尔还带 `label` 键（browserDownloadListener），以及 `type: 'dynamic'` 的端口（见下）。

---

## 五、动态 IO（dynamic ports）

当节点的输入/输出字段由配置动态生成（如数组型配置的每一项对应一个输出）时，使用 `type: 'dynamic'` 端口，配合 `dataPath` / `fieldMap` / `legacyDataPath`：

```js
outputs: [
  {
    type: 'dynamic',
    dataPath: 'dataModel',            // 驱动动态端口的配置字段 key
    fieldMap: { ...IO_FIELD_MAP_NAME_ID, isConfig: true }
                                       // 字段映射：配置项字段 → 端口字段（见「六、公共常量」）
  }
]
```

典型用法：

| 节点 | 说明 |
|---|---|
| dataCreate | outputs 动态端口 `dataPath: 'dataModel'`（用户每配置一项数据即一个输出） |
| dataClipboard | config 中有一个隐藏字段 `outputs`（show: false, type: 'array'），输出端口用 `{ type:'dynamic', dataPath:'outputs', fieldMap: IO_FIELD_MAP_STANDARD }` |
| dataHandlerString/Number/Object/Array | inputs/outputs 均动态，`dataPath: '__nodeIO.inputs'` / `'__nodeIO.outputs'`（自定义视图 view.vue 中编辑的 IO），并带 `legacyDataPath: 'nodeIO.inputs'`（旧数据兼容路径） |
| workflowStart | outputs 动态端口 `dataPath: 'params'`（输入项）与 `dataPath: 'config'`（配置项） |
| workflowEnd / timeSchedule / workflowCustomNode | 同 params 类动态端口 |

`fieldMap` 键映射约定（见 `src/renderer/src/workflow/io-conventions.js`）：

```js
// IO_FIELD_MAP_STANDARD = { id:'id', name:'name', description:'description', type:'type', required:'required' }
//   —— 数据模型字段名即标准键（字段的 id 字段名为 'id'）
// IO_FIELD_MAP_NAME_ID   = { ...IO_FIELD_MAP_STANDARD, id: 'name' }
//   —— 「name 作 id」的变体（数据模型用 name 字段作 id），用于
//      workflowStart/End/CustomNode/timeSchedule/dataCreate 的 params 类数据模型
// isConfig: true —— 布尔标记，表示该动态输出整体为配置项（而非数据模型字段名）
```

---

## 六、subFlow 子流程容器（workflowLoop）

`subFlow` 仅 workflowLoop（循环）节点使用，定义循环体容器的端口：

```js
subFlow: {
  name: '循环体',              // 子流程容器显示名称
  startOutputs: [             // 循环体起始输出（循环体内可引用的数据）
    { id: 'item', name: '当前项', type: 'any', description: '当前循环的数据项', isConfig: true },
    { id: 'index', name: '循环索引', type: 'number', description: '当前循环的执行索引', isConfig: true },
    { id: 'totalTimes', name: '循环总数', type: 'number', description: '循环的总次数', isConfig: true }
  ],
  endOutputs: false           // 循环体结束输出（false 表示无）
}
```

---

## 七、公共常量与工具（`src/renderer/src/workflow/nodes/common.js`）

多个节点共享的字段模型，从 `common.js` 导入后直接放入 `fields`：

### 1. `dynamicFields` —— 动态参数模型

workflowStart 输入项 / workflowEnd 参数等。字段：`type`（select 参数类型，选项来自 `utils/typeColor.js` 的 `typeText`）、`name`（参数名）、`description`（参数说明）、`stringValue`/`numberValue`/`switchValue`/`arrayValue`/`objectValue`/`anyValue`（按类型条件显示的默认值）、`required`（是否必填）。

### 2. `configFields` —— 配置项模型

workflowStart 配置项。字段：`type`（配置类型 select：string/number/switch/date/select/color/file/folder/browser/model/selector，onChange 联动 dataType）、`name`、`description`、`showTime`、`format`（日期格式）、`dataType`、`fileType`/`fileExt`（文件类型与后缀）、`multiple`（是否多选）、`remote`/`remoteMethod`（远程选项）、`options`（选项列表）、`min`/`max`、`required`、`show`、`stringValue`/`numberValue`/`switchValue`/`dateValue`/`selectValue`/`colorValue`/`fileValue`/`folderValue`/`selectorValue`/`modelValue`/`browserValue`（各类型默认值字段）。

### 3. `format` —— 数据格式化配置

dataParser / dataExtract 的 `rules.fields.format` 使用。结构：`{ id:'format', name:'格式化', type:'object', fields:{ type, pattern, currency, precision, separator, customFormat } }`（格式化类型：none/time/currency/number/percentage/filesize/custom）。

### 4. `buildErrorHandleGroup(remoteMethod)` —— 错误处理分组

生成「执行配置」（错误处理）分组。字段：`errorHandleType`（ignore/retry/specify/retryFlow/stop）、`errorHandleRetryCount`、`errorHandleRetryInterval`、`errorHandleRetryFailed`、`errorHandleSpecifyNode`（远程节点选择）。用法：`config.exec = buildErrorHandleGroup(async (keyword) => [...])`。渲染端 `useNodeConfig` 与 `FlowCanvas.getNodeConfigFields` 共用此函数，避免定义漂移。

### 5. `getConfigFieldGroups(nodeDefinition)`

将 config 分组转换为 `{ groupName: [field, ...] }` 扁平结构，供表单渲染使用。

### 其他相关约定

- **图标**：`@remixicon/vue`（`RiXxxLine`）或 `@arco-design/web-vue/es/icon`（`IconXxx`）。
- **typeText**：`src/renderer/src/workflow/utils/typeColor.js` 导出的类型中文名映射，用于生成 type 的 options（string→文本、number→数字、boolean→是否、array→数组、object→对象）。
- **本地插件节点（`plu_<插件id>`）**：无源码目录，运行期由 `loadPluginNodes()` 动态注册，config 展开插件配置并注入隐藏 `pluginId`/`_pluginName`/`_pluginVersion` 字段，执行经 worker nodeLoader 的 `plu_` 前缀映射复用 pluginCall 执行器。

---

## 八、综合示例（演示上述全部能力）

```js
import { RiFileLine } from '@remixicon/vue'
import { format, buildErrorHandleGroup } from './common'
import { IO_FIELD_MAP_STANDARD } from '../io-conventions'

export default {
  type: 'myNode',
  name: '我的节点',
  icon: RiFileLine,
  description: '示例节点',
  view: false,
  config: {
    basic: {
      name: '基础配置',
      fields: {
        mode: {
          id: 'mode',
          name: '模式',
          type: 'radio',
          options: [
            { label: '模式A', value: 'a' },
            { label: '模式B', value: 'b' }
          ],
          default: 'a',
          description: '选择工作模式',
          quickConfig: true
        },
        target: {
          id: 'target',
          name: '目标元素',
          type: 'selector',
          required: true,
          show: '${mode} === "a"',
          description: '要操作的目标元素',
          quickConfig: true
        },
        count: {
          id: 'count',
          name: '次数',
          type: 'number',
          min: 1,
          max: 100,
          default: 10,
          show: '${mode} === "b"',
          description: '执行次数'
        },
        options: {
          id: 'options',
          name: '选项',
          type: 'array',
          default: [],
          fields: {
            key: { id: 'key', name: '键', type: 'text' },
            value: { id: 'value', name: '值', type: 'text' }
          },
          description: '键值对列表',
          quickConfig: true
        },
        script: {
          id: 'script',
          name: '脚本',
          type: 'code',
          language: 'javascript',
          prefix: 'function handler(data){',
          default: 'return data',
          suffix: '}',
          description: '自定义处理脚本'
        },
        format: format,   // 复用公共格式化配置
        items: {
          id: 'items',
          name: '数据项',
          type: 'array',
          default: [],
          fields: {
            name: { id: 'name', name: '名称', type: 'string', required: true },
            type: { id: 'type', name: '类型', type: 'select', options: [{ label: '文本', value: 'string' }], default: 'string' }
          },
          description: '要处理的数据项'
        }
      }
    },
    exec: buildErrorHandleGroup()   // 错误处理分组
  },
  inputs: [
    { id: 'data', name: '数据', type: ['array', 'object'], required: true, description: '输入数据' }
  ],
  outputs: [
    { id: 'result', name: '结果', type: 'any', description: '处理结果' },
    {
      type: 'dynamic',
      dataPath: 'items',
      fieldMap: IO_FIELD_MAP_STANDARD
    }
  ]
}
```
