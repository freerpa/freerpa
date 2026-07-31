import toolkitConfig from '@electron-toolkit/eslint-config'
import prettierConfig from '@electron-toolkit/eslint-config-prettier'
import vue from 'eslint-plugin-vue'

export default [
  {
    ignores: [
      'out/**',
      'dist/**',
      'build/**',
      'node_modules/**',
      'resources/**',
      'website/**',
      'mcp-server/**',
      'cache/**',
      'storage/**',
      'runtime/**',
      'engine.bin',
      '.reasonix/**',
      '.trae/**',
      '.vscode/**'
    ]
  },
  toolkitConfig,
  ...vue.configs['flat/recommended'],
  prettierConfig
]
