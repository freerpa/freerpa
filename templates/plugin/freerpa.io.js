/**
 * @file: 插件节点契约描述（可选，与 package.json 同层）
 *
 * 存在本文件时，插件节点的字段/输入/输出由这里声明，
 * 且允许函数钩子（onChange/remoteMethod/valueExpr）实现字段动态联动，能力与内置节点对齐。
 * （package.json 的 freerpa 现在只表示「所需最低客户端版本」，不再声明 IO。）
 *
 * 两个信任边界，请知悉：
 *  1. 本文件在客户端**渲染进程**执行（data-URL import），可访问渲染进程全部能力；
 *     .frp 打包时自动同梱，无需额外配置。
 *  2. 纯数据部分（type/name/show/options/default...）会随工作流文件序列化，函数不会。
 *
 * 结构：默认导出 { config, inputs, outputs } 三个数组（可只写需要的）。
 */

// ═══════════ 配置字段 ═══════════
// 字段通用属性：
//  - id(string)、name(string)、type、description(string)
//  - type ∈ string|number|boolean|select|text|code|date|color|file|folder
//  - show: 显隐表达式，用 ${字段id} 引用同表单其他字段，如 "${mode} === 'advanced'"
//  - options: select 的选项数组（[{label,value}] 或 值数组）
//  - default: 默认值；required: 是否必填
// 函数钩子（仅本文件可用）：
//  - onChange(value, form): 字段值变化时联动改写 form 内其它字段
//  - remoteMethod(keyword, form): select 远程动态加载选项，返回 Promise<[{label,value}]>
// 嵌套字段（array/object 类型）：用 fields 声明子字段，子字段同样支持 show/onChange。

export const config = [
  {
    id: 'source',
    name: '数据源',
    type: 'select',
    description: '选择数据来源',
    options: ['db', 'api'],
    default: 'db'
  },
  {
    id: 'port',
    name: '端口',
    type: 'number',
    description: '连接端口',
    show: "${source} === 'db'", // 仅数据源=db 时显示
    default: 5432,
    // onChange 联动：数据源切换时改写端口默认值。
    // 注意 form 是表单 ref，读写须用 form.value（与内置节点 configFields.onChange 一致）
    onChange(value, form) {
      form.value.port = value === 'db' ? 5432 : 80
    }
  },
  {
    id: 'remote',
    name: '远程地址',
    type: 'select',
    description: '选项由远程接口动态加载',
    show: "${source} === 'api'",
    // 远程动态选项：keyword 为用户输入；form 为表单 ref（此处演示用 form.value 读当前字段值）
    async remoteMethod(keyword, form) {
      const src = form?.value?.source || 'api'
      const res = await fetch(`https://example.com/options?src=${src}&q=${encodeURIComponent(keyword || '')}`)
      const data = await res.json()
      return (data || []).map((it) => ({ label: it.name, value: it.id }))
    }
  },
  {
    id: 'host',
    name: '主机名',
    type: 'string',
    show: "${source} === 'db'",
    default: 'localhost',
    // onChange 联动：host 变化时改写另一字段（form 为表单 ref，用 form.value 读写）
    onChange(value, form) {
      form.value.connectionLabel = `${form.value.source}@${value}:${form.value.port}`
    }
  },
  {
    id: 'connectionLabel',
    name: '连接标识',
    type: 'string',
    description: '由其它字段联动的只读结果（onChange 写入，演示动态引用）'
  }
]

// ═══════════ 输入 / 输出 ═══════════
// 输入是节点执行时收到的上游数据，输出是节点向上游返回的结果。
// 简单写法：字符串即字段名；复杂写法：{ id, name, type, description, fieldMap }

export const inputs = [{ id: 'data', name: '输入数据' }]

export const outputs = [
  { id: 'result', name: '执行结果' }
]

export default { config, inputs, outputs }