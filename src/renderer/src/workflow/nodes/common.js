import { typeText } from '../utils/typeColor'

export const dynamicFields = {
  type: {
    id: 'type',
    name: '参数类型',
    type: 'select',
    paramRef: false,
    options: Object.keys(typeText).map((key) => ({ label: typeText[key], value: key })),
    default: 'string'
  },
  name: {
    id: 'name',
    name: '参数名称',
    type: 'string',
    paramRef: false,
    required: true
  },
  description: {
    id: 'description',
    paramRef: false,
    name: '参数说明',
    type: 'string'
  },
  stringValue: {
    id: 'stringValue',
    name: '默认值',
    type: 'text',
    show: '${type} === "string"',
    paramRef: false,
    default: ''
  },
  numberValue: {
    id: 'numberValue',
    name: '默认值',
    type: 'number',
    paramRef: false,
    show: '${type} === "number"',
    default: 0
  },
  switchValue: {
    id: 'switchValue',
    name: '默认值',
    type: 'switch',
    paramRef: false,
    show: '${type} === "boolean"',
    default: false
  },
  arrayValue: {
    id: 'arrayValue',
    name: '默认值',
    type: 'code',
    show: '${type} === "array"',
    paramRef: false,
    default: `[]`
  },
  objectValue: {
    id: 'objectValue',
    name: '默认值',
    type: 'code',
    show: '${type} === "object"',
    paramRef: false,
    default: '{}'
  },
  anyValue: {
    id: 'anyValue',
    name: '默认值',
    type: 'code',
    paramRef: false,
    show: '${type} === "any"',
    default: ''
  },
  required: {
    id: 'required',
    name: '是否必填',
    type: 'switch',
    show: false,
    paramRef: false,
    default: true
  }
}

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
      'env',
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

export const configFields = {
  type: {
    id: 'type',
    name: '配置类型',
    type: 'select',
    paramRef: false,
    default: 'string',
    options: [
      { label: '文本', value: 'string' },
      { label: '数字', value: 'number' },
      { label: '开关', value: 'switch' },
      { label: '日期', value: 'date' },
      { label: '选择器', value: 'select' },
      { label: '颜色', value: 'color' },
      { label: '文件路径', value: 'file' },
      { label: '文件夹路径', value: 'folder' },
      { label: '浏览器', value: 'env' },
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
          'env',
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
  name: {
    id: 'name',
    name: '配置名称',
    type: 'string',
    paramRef: false,
    required: true
  },
  description: {
    id: 'description',
    name: '配置说明',
    paramRef: false,
    type: 'string'
  },
  showTime: {
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
  format: {
    id: 'format',
    name: '日期格式',
    type: 'text',
    paramRef: false,
    show: "${type} == 'date'",
    default: 'YYYY-MM-DD'
  },
  dataType: {
    id: 'dataType',
    name: '数据类型',
    type: 'text',
    paramRef: false,
    description: '数据类型',
    show: false,
    default: 'string'
  },
  // 文件类型
  fileType: {
    id: 'fileType',
    name: '文件类型',
    show: "${type} === 'file'",
    type: 'select',
    paramRef: false,
    options: Object.keys(filters).map((key) => ({
      label: filters[key].name,
      value: key
    })),
    default: 'other',
    show: "${type} === 'file'"
  },
  //文件格式后缀名
  fileExt: {
    id: 'fileExt',
    name: '文件格式',
    description: '文件格式后缀名如 txt png mp4 为空则表示所有文件',
    show: "${type} === 'file'",
    type: 'text',
    paramRef: false,
    default: '',
    show: "${fileType} === 'other'"
  },
  // 多选
  multiple: {
    id: 'multiple',
    name: '是否多选',
    show: "['select', 'file', 'folder', 'env', 'model'].includes(${type})",
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
  remote: {
    id: 'remote',
    name: '远程选项',
    show: "${type} === 'select'",
    type: 'switch',
    paramRef: false,
    default: false
  },
  remoteMethod: {
    id: 'remoteMethod',
    name: '远程方法',
    show: "${type} === 'select' && ${remote}",
    type: 'code',
    prefix: 'function handler(keyWord,formData) {',
    default: `//keyWord 搜索关键词
//formData 表单数据
//返回一个数组[{label:'选项名',value:'选项值'}]
//使用 fetch 方法请求远程接口获取数据`,
    suffix: '}',
    paramRef: false,
  },
  options: {
    id: 'options',
    name: '选项列表',
    type: 'array',
    paramRef: false,
    show: "${type} === 'select' && !${remote}",
    codeView: true,
    default: [],
    fields: {
      label: {
        id: 'label',
        name: '选项名',
        type: 'string',
        paramRef: false
      },
      value: {
        id: 'value',
        name: '选项值',
        type: 'string',
        paramRef: false
      }
    }
  },
  min: {
    id: 'min',
    name: '最小值',
    type: 'number',
    paramRef: false,
    show: "${type} === 'number'",
    default: 0
  },
  max: {
    id: 'max',
    name: '最大值',
    type: 'number',
    paramRef: false,
    show: "${type} === 'number'",
    default: 100
  },
  required: {
    id: 'required',
    name: '是否必填',
    type: 'switch',
    paramRef: false,
    default: false
  },
  show: {
    id: 'show',
    name: '条件显示',
    description: '支持字段引用 如 ${字段名} == "1"',
    type: 'text',
    paramRef: false,
    default: ''
  },
  stringValue: {
    id: 'stringValue',
    name: '配置值',
    type: 'text',
    show: false,
    default: ''
  },
  numberValue: {
    id: 'numberValue',
    name: '配置值',
    type: 'number',
    show: false,
    default: 0
  },
  switchValue: {
    id: 'switchValue',
    name: '配置值',
    type: 'switch',
    show: false,
    default: false
  },
  dateValue: {
    id: 'dateValue',
    name: '配置值',
    type: 'date',
    show: false,
    default: ''
  },
  selectValue: {
    id: 'selectValue',
    name: '配置值',
    type: 'text',
    show: false,
    default: ''
  },
  colorValue: {
    id: 'colorValue',
    name: '配置值',
    type: 'color',
    show: false,
    default: '#ffffff00'
  },
  fileValue: {
    id: 'fileValue',
    name: '配置值',
    type: 'path',
    show: false,
    pathType: 'file',
    default: ''
  },
  folderValue: {
    id: 'folderValue',
    name: '配置值',
    type: 'path',
    show: false,
    pathType: 'folder',
    default: ''
  },
  selectorValue: {
    id: 'selectorValue',
    name: '配置值',
    type: 'selector',
    show: false,
    default: ''
  },
  modelValue: {
    id: 'modelValue',
    name: '配置值',
    type: 'selector',
    show: false,
    default: ''
  },
  envValue: {
    id: 'envValue',
    name: '配置值',
    type: 'selector',
    show: false,
    default: ''
  }
}

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
        } catch (error) {
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
  fields: {
    type: {
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
    pattern: {
      id: 'pattern',
      name: '模板',
      type: 'input',
      show: "${type} == 'time'",
      default: '',
      description: '格式化模板,如日期: YYYY-MM-DD'
    },
    currency: {
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
    precision: {
      id: 'precision',
      name: '小数位数',
      type: 'number',
      show: "${type} === 'number' || ${type} === 'currency' || ${type} === 'percentage'",
      min: 0,
      max: 20,
      default: 2
    },
    separator: {
      id: 'separator',
      name: '分隔符',
      type: 'switch',
      show: "${type} === 'number' || ${type} === 'currency'",
      default: true,
      description: '是否使用千分位分隔符'
    },
    customFormat: {
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
  }
}
