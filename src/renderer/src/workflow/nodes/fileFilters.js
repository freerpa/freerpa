/**
 * @file: 文件类型 → 扩展名映射（工作流「文件路径」配置的过滤器选项）
 * 与 configFields 分离，控制 common.js 单文件规模；buildConfigFields 据此生成文件选择器过滤器
 */
export const filters = {
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
