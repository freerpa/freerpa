import { typeText } from '../utils/typeColor'
import { IO_FIELD_MAP_STANDARD } from '../io-conventions'

/**
 * 单类型数据处理节点定义工厂（dataHandler{Array,Number,Object,String} 共用）
 */
export const createDataHandlerNode = ({ type, name, icon, description }) => ({
  type,
  name,
  icon,
  description,
  view: true,
  config: [],
  inputs: [
    {
      type: 'dynamic',
      dataPath: '__nodeIO.inputs',
      legacyDataPath: 'nodeIO.inputs',
      fieldMap: IO_FIELD_MAP_STANDARD
    }
  ],
  outputs: [
    {
      type: 'dynamic',
      dataPath: '__nodeIO.outputs',
      legacyDataPath: 'nodeIO.outputs',
      fieldMap: IO_FIELD_MAP_STANDARD
    }
  ]
})

/**
 * 动态输入/输出项字段（工厂函数：每次返回独立副本，避免多个节点定义共享同一可变对象）
 */
export const createDynamicFields = () => [
  {
    id: 'type',
    name: '参数类型',
    type: 'select',
    paramRef: false,
    options: Object.keys(typeText).map((key) => ({ label: typeText[key], value: key })),
    default: 'string'
  },
  {
    id: 'name',
    name: '参数名称',
    type: 'string',
    paramRef: false,
    required: true
  },
  {
    id: 'description',
    paramRef: false,
    name: '参数说明',
    type: 'string'
  },
  {
    id: 'stringValue',
    name: '默认值',
    type: 'text',
    show: '${type} === "string"',
    paramRef: false,
    default: ''
  },
  {
    id: 'numberValue',
    name: '默认值',
    type: 'number',
    paramRef: false,
    show: '${type} === "number"',
    default: 0
  },
  {
    id: 'switchValue',
    name: '默认值',
    type: 'switch',
    paramRef: false,
    show: '${type} === "boolean"',
    default: false
  },
  {
    id: 'arrayValue',
    name: '默认值',
    type: 'code',
    show: '${type} === "array"',
    paramRef: false,
    default: `[]`
  },
  {
    id: 'objectValue',
    name: '默认值',
    type: 'code',
    show: '${type} === "object"',
    paramRef: false,
    default: '{}'
  },
  {
    id: 'anyValue',
    name: '默认值',
    type: 'code',
    paramRef: false,
    show: '${type} === "any"',
    default: ''
  },
  {
    id: 'required',
    name: '是否必填',
    type: 'switch',
    show: false,
    paramRef: false,
    default: true
  }
]

const filters = {
  document: {
    name: '文档',
    extensions: [
      // 文本与文档
      'txt',
      'md',
      'rtf',
      'log',
      'json',
      'xml',
      'yaml',
      'yml',
      // Microsoft Office
      'doc',
      'docx',
      'xls',
      'xlsx',
      'ppt',
      'pptx',
      'pub',
      // 其他办公格式
      'odt',
      'ods',
      'odp',
      'pdf',
      'pages',
      'numbers',
      'key',
      // 表单与数据
      'csv',
      'tsv',
      'ics',
      'vcf'
    ]
  },
  image: {
    name: '图片',
    extensions: [
      // 常见图片
      'jpg',
      'jpeg',
      'png',
      'gif',
      'bmp',
      'webp',
      'svg',
      // 专业格式
      'tiff',
      'tif',
      'psd',
      'ai',
      'eps',
      'raw',
      'cr2',
      'nef',
      'orf',
      'sr2',
      // 图标与其他
      'ico',
      'heic',
      'heif'
    ]
  },
  video: {
    name: '视频',
    extensions: [
      // 常见视频
      'mp4',
      'avi',
      'mkv',
      'mov',
      'wmv',
      'flv',
      'webm',
      // 专业与流媒体
      'm4v',
      '3gp',
      '3g2',
      'rm',
      'rmvb',
      'mpeg',
      'mpg',
      'vob',
      'ts',
      'mts',
      'm2ts'
    ]
  },
  audio: {
    name: '音频',
    extensions: [
      // 常见音频
      'mp3',
      'wav',
      'ogg',
      'flac',
      'aac',
      'm4a',
      'wma',
      // 其他格式
      'amr',
      'opus',
      'mid',
      'midi',
      'aiff',
      'alac'
    ]
  },
  archive: {
    name: '压缩包',
    extensions: [
      'zip',
      'rar',
      '7z',
      'tar',
      'gz',
      'bz2',
      'xz',
      'tgz',
      'tbz2',
      'iso',
      'dmg',
      'cab',
      'pkg'
    ]
  },
  code: {
    name: '代码文件',
    extensions: [
      // 编程语言
      'js',
      'jsx',
      'ts',
      'tsx',
      'css',
      'scss',
      'sass',
      'less',
      'html',
      'htm',
      'php',
      'py',
      'java',
      'cpp',
      'c',
      'cs',
      'go',
      'rb',
      'swift',
      'kt',
      'kts',
      'pl',
      'perl',
      'sh',
      'bash',
      'cmd',
      'ps1',
      'bat',
      'json',
      'json5',
      'xml',
      'yaml',
      'yml',
      'toml',
      // 配置与模板
      'config',
      'conf',
      'ini',
      'browser',
      'properties',
      'htaccess',
      'lock',
      'md',
      'markdown',
      'txt',
      'log',
      'sql',
      'db',
      'sqlite',
      'sqlite3',
      'graphql',
      'gql',
      'vue',
      'svelte',
      'astro',
      'mdx',
      'njk',
      'hbs',
      'ejs',
      'pug',
      'twig'
    ]
  },
  executable: {
    name: '可执行文件',
    extensions: [
      'exe',
      'msi',
      'app',
      'dmg',
      'apk',
      'jar',
      'com',
      'bat',
      'sh',
      'run',
      'bin',
      'command'
    ]
  },
  font: {
    name: '字体文件',
    extensions: ['ttf', 'otf', 'woff', 'woff2', 'eot', 'svg']
  },
  other: {
    name: '自定义文件',
    extensions: []
  }
}

export const configFields = [
  {
    id: 'type',
    name: '配置类型',
    type: 'select',
    paramRef: false,
    options: [
      { label: '文本', value: 'string' },
      { label: '数字', value: 'number' },
      { label: '开关', value: 'switch' },
      { label: '日期', value: 'date' },
      { label: '选择器', value: 'select' },
      { label: '颜色', value: 'color' },
      { label: '文件路径', value: 'file' },
      { label: '文件夹路径', value: 'folder' },
      { label: '浏览器', value: 'browser' },
      { label: '数据表', value: 'model' },
      { label: '元素选择器', value: 'selector' }
    ],
    onChange: (value, formData) => {
      if (
        [
          'select',
          'string',
          'date',
          'file',
          'folder',
          'color',
          'selector',
          'browser',
          'model'
        ].includes(value)
      ) {
        formData.value.dataType = 'string'
      } else if (value === 'switch') {
        formData.value.dataType = 'boolean'
      } else {
        formData.value.dataType = value
      }
    },
    default: 'string'
  },
  {
    id: 'name',
    name: '配置名称',
    type: 'string',
    paramRef: false,
    required: true
  },
  {
    id: 'description',
    name: '配置说明',
    paramRef: false,
    type: 'string'
  },
  {
    id: 'showTime',
    name: '显示时间',
    type: 'switch',
    paramRef: false,
    show: "${type} == 'date'",
    default: false,
    onChange: (value, formData) => {
      if (value) {
        formData.value.format = 'YYYY-MM-DD HH:mm:ss'
      } else {
        formData.value.format = 'YYYY-MM-DD'
      }
    }
  },
  {
    id: 'format',
    name: '日期格式',
    type: 'text',
    paramRef: false,
    show: "${type} == 'date'",
    default: 'YYYY-MM-DD'
  },
  {
    id: 'dataType',
    name: '数据类型',
    type: 'text',
    paramRef: false,
    description: '数据类型',
    show: false,
    default: 'string'
  },
  // 文件类型
  {
    id: 'fileType',
    name: '文件类型',
    show: "${type} === 'file'",
    type: 'select',
    paramRef: false,
    options: Object.keys(filters).map((key) => ({
      label: filters[key].name,
      value: key
    })),
    default: 'other'
  },
  //文件格式后缀名
  {
    id: 'fileExt',
    name: '文件格式',
    description: '文件格式后缀名如 txt png mp4 为空则表示所有文件',
    type: 'text',
    paramRef: false,
    default: '',
    show: "${fileType} === 'other'"
  },
  // 多选
  {
    id: 'multiple',
    name: '是否多选',
    show: "['select', 'file', 'folder', 'browser', 'model'].includes(${type})",
    type: 'switch',
    paramRef: false,
    default: false,
    onChange: (value, formData) => {
      if (value) {
        formData.value.dataType = 'array'
        formData.value[formData.value.type + 'Value'] = []
      } else {
        formData.value.dataType = 'string'
        formData.value[formData.value.type + 'Value'] = ''
      }
    }
  },
  {
    id: 'remote',
    name: '远程选项',
    show: "${type} === 'select'",
    type: 'switch',
    paramRef: false,
    default: false
  },
  {
    id: 'remoteRules',
    name: '远程规则',
    show: "${type} === 'select' && ${remote}",
    type: 'object',
    fields: [
      {
        id: 'method',
        name: '请求方法',
        type: 'select',
        options: ['GET', 'POST', 'PUT', 'DELETE'],
        default: 'GET'
      },
      {
        id: 'url',
        name: '远程接口',
        type: 'string',
        default: '',
        required: true
      },
      {
        id: 'headers',
        name: '请求头',
        type: 'string',
        default: ''
      },
      {
        id: 'body',
        name: '请求体',
        type: 'string',
        show: "${method} === 'POST' || ${method} === 'PUT'",
        default: ''
      },
      {
        id: 'data',
        name: '数据路径',
        description: '选项列表路径 如 data.users',
        required: true,
        type: 'string',
        default: ''
      },
      {
        id: 'label',
        name: '标签字段',
        description: '选项标签字段 如 name',
        required: true,
        type: 'string',
        default: ''
      },
      {
        id: 'value',
        name: '值字段',
        description: '选项值字段 如 id',
        required: true,
        type: 'string',
        default: ''
      }
    ],
    paramRef: false,
  },
  {
    id: 'options',
    name: '选项列表',
    type: 'array',
    paramRef: false,
    show: "${type} === 'select' && !${remote}",
    codeView: true,
    default: [],
    fields: [
      {
        id: 'label',
        name: '选项名',
        type: 'string',
        paramRef: false
      },
      {
        id: 'value',
        name: '选项值',
        type: 'string',
        paramRef: false
      }
    ]
  },
  {
    id: 'min',
    name: '最小值',
    type: 'number',
    paramRef: false,
    show: "${type} === 'number'",
    default: 0
  },
  {
    id: 'max',
    name: '最大值',
    type: 'number',
    paramRef: false,
    show: "${type} === 'number'",
    default: 100
  },
  {
    id: 'required',
    name: '是否必填',
    type: 'switch',
    paramRef: false,
    default: false
  },
  {
    id: 'show',
    name: '条件显示',
    description: '支持字段引用 如 ${字段名} == "1"',
    type: 'text',
    paramRef: false,
    default: ''
  },
  {
    id: 'stringValue',
    name: '配置值',
    type: 'text',
    show: false,
    default: ''
  },
  {
    id: 'numberValue',
    name: '配置值',
    type: 'number',
    show: false,
    default: 0
  },
  {
    id: 'switchValue',
    name: '配置值',
    type: 'switch',
    show: false,
    default: false
  },
  {
    id: 'dateValue',
    name: '配置值',
    type: 'date',
    show: false,
    default: ''
  },
  {
    id: 'selectValue',
    name: '配置值',
    type: 'text',
    show: false,
    default: ''
  },
  {
    id: 'colorValue',
    name: '配置值',
    type: 'color',
    show: false,
    default: '#ffffff00'
  },
  {
    id: 'fileValue',
    name: '配置值',
    type: 'path',
    show: false,
    pathType: 'file',
    default: ''
  },
  {
    id: 'folderValue',
    name: '配置值',
    type: 'path',
    show: false,
    pathType: 'folder',
    default: ''
  },
  {
    id: 'selectorValue',
    name: '配置值',
    type: 'selector',
    show: false,
    default: ''
  },
  {
    id: 'modelValue',
    name: '配置值',
    type: 'selector',
    show: false,
    default: ''
  },
  {
    id: 'browserValue',
    name: '配置值',
    type: 'selector',
    show: false,
    default: ''
  }
]

export const buildConfigFields = (config) => {
  const field = {
    id: config.name,
    name: config.name,
    type: config.type === 'file' || config.type === 'folder' ? 'path' : config.type,
    paramRef: true,
    show: config.show || true,
    min: config.min,
    max: config.max,
    multiple: config.multiple,
    pathType: config.type === 'file' || config.type === 'folder' ? config.type : null,
    rules: [{ required: config.required, message: config.name + '是必填项' }],
    options: config.options || [],
    description: config.description,
    default: config[config.type + 'Value']
  }
  if (config.type === 'date') {
    field.showTime = config.showTime
    field.format = config.format || 'YYYY-MM-DD'
  }
  if (config.type === 'file') {
    if (!config.fileType) {
      config.fileType = 'other'
    }
    if (!config.fileExt) {
      config.fileExt = ''
    }
    if (config.fileType === 'other') {
      if (config.fileExt.trim() === '') {
        field.extensions = ['*']
      } else {
        field.extensions = config.fileExt.trim().split(' ')
      }
    } else {
      field.extensions = filters[config.fileType].extensions
    }
  }

  if (config.type === 'select') {
    if (config.remote) {
      field.remote = true
      field.remoteMethod = async (keyWord = '', formData = {}) => {
        try {
          const getOptionsFunc = new Function('keyWord', 'formData', `return (async function(keyWord = '',formData) {
            ${config.remoteMethod}
          })('${keyWord.toString() || ''}',${JSON.stringify(formData.value)})`)
          const result = getOptionsFunc()
          return result
        } catch {
          return []
        }
      }
    } else {
      field.remote = false
      field.remoteMethod = null
    }
  }
  return field
}
export const format = {
  id: 'format',
  name: '格式化',
  type: 'object',
  description: '数据格式化配置',
  fields: [
    {
      id: 'type',
      name: '类型',
      type: 'select',
      options: [
        { label: '无', value: 'none' },
        { label: '时间', value: 'time' },
        { label: '金额', value: 'currency' },
        { label: '数字', value: 'number' },
        { label: '百分比', value: 'percentage' },
        { label: '文件大小', value: 'filesize' },
        { label: '自定义', value: 'custom' }
      ],
      default: 'none'
    },
    {
      id: 'pattern',
      name: '模板',
      type: 'input',
      show: "${type} == 'time'",
      default: '',
      description: '格式化模板,如日期: YYYY-MM-DD'
    },
    {
      id: 'currency',
      name: '货币单位',
      type: 'select',
      show: "${type} === 'currency'",
      options: [
        { label: '人民币', value: 'CNY' },
        { label: '美元', value: 'USD' },
        { label: '欧元', value: 'EUR' },
        { label: '英镑', value: 'GBP' }
      ],
      default: 'CNY'
    },
    {
      id: 'precision',
      name: '小数位数',
      type: 'number',
      show: "${type} === 'number' || ${type} === 'currency' || ${type} === 'percentage'",
      min: 0,
      max: 20,
      default: 2
    },
    {
      id: 'separator',
      name: '分隔符',
      type: 'switch',
      show: "${type} === 'number' || ${type} === 'currency'",
      default: true,
      description: '是否使用千分位分隔符'
    },
    {
      id: 'customFormat',
      name: '代码',
      type: 'code',
      language: 'javascript',
      show: "${type} === 'custom'",
      description: '自定义格式化函数',
      prefix: 'function handler(data, source){',
      default: 'return data',
      suffix: '}'
    }
  ]
}

/**
 * 构建节点「执行配置」（错误处理）分组
 * useNodeConfig 与 FlowCanvas.getNodeConfigFields 共用，消除双份定义漂移
 * @param {Function} [remoteMethod] errorHandleSpecifyNode 的远程选项加载器（(keyword)=>Promise<[{label,value}]>；可空，runtime 场景由调用方注入）
 * @returns {{name:string, fields:Object}} 配置分组
 */
export const buildErrorHandleGroup = (remoteMethod) => ({
  id: 'errorHandle',
  name: '执行配置',
  fields: [
    {
      id: 'errorHandleType',
      name: '错误处理',
      type: 'select',
      description: '节点遇到错误时的处理方式',
      default: 'stop',
      paramRef: false,
      options: [
        { label: '忽略错误', value: 'ignore' },
        { label: '重试节点', value: 'retry' },
        { label: '指定节点', value: 'specify' },
        { label: '重试流程', value: 'retryFlow' },
        { label: '终止流程', value: 'stop' }
      ]
    },
    {
      id: 'errorHandleRetryCount',
      name: '重试次数',
      type: 'number',
      description: '重试次数',
      show: "${errorHandleType}==='retry'",
      default: 3,
      paramRef: false
    },
    {
      id: 'errorHandleRetryInterval',
      name: '重试间隔',
      type: 'number',
      description: '重试间隔（毫秒）',
      show: "${errorHandleType}==='retry'",
      default: 1000,
      paramRef: false
    },
    {
      id: 'errorHandleRetryFailed',
      name: '重试失败',
      type: 'select',
      description: '重试次数超过最大重试次数时的处理方式',
      default: 'stop',
      show: "${errorHandleType}==='retry'",
      paramRef: false,
      options: [
        { label: '忽略错误', value: 'ignore' },
        { label: '指定节点', value: 'specify' },
        { label: '终止流程', value: 'stop' },
        { label: '重试流程', value: 'retryFlow' }
      ]
    },
    {
      id: 'errorHandleSpecifyNode',
      name: '指定节点',
      type: 'select',
      description: '指定要跳转的节点',
      show: "${errorHandleType}==='specify' || ${errorHandleRetryFailed}==='specify'",
      paramRef: false,
      remote: true,
      options: [],
      remoteMethod: remoteMethod || null,
      default: ''
    }
  ]
})

/**
 * 将节点定义的 config 分组（数组形态）转换为 { groupName: [] } 扁平结构
 * useNodeConfig.allConfigFieldsWithGroup 与 FlowCanvas.getNodeConfigFields 共用
 * @param {{config?:Array}} nodeDefinition 节点定义（config 为数组分组）
 * @returns {Object<string, Array>} groupName → 字段数组
 */
export const getConfigFieldGroups = (nodeDefinition) => {
  const groups = {}
  for (const group of nodeDefinition?.config || []) {
    groups[group?.name] = group?.fields ? [...group.fields] : []
  }
  return groups
}
