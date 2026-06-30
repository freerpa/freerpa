import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin, bytecodePlugin } from 'electron-vite'
import { terser } from 'rollup-plugin-terser'
import vue from '@vitejs/plugin-vue'
import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'

const nodes = fs.readdirSync(path.join(__dirname, './src/renderer/src/workflow/nodes'))
const nodeNames = nodes.filter((node) =>
  fs.statSync(path.join(__dirname, './src/renderer/src/workflow/nodes', node)).isDirectory()
)
const nodeNamesMap = nodeNames.reduce((acc, name) => {
  acc[name + '_execute'] = createHash('sha256')
    .update(name)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase()
  return acc
}, {})
const _terser =
  process.env.NODE_ENV === 'production'
    ? terser({
        compress: {
          arrows: true,
          drop_console: true, // 移除console
          drop_debugger: true, // 移除debugger
          dead_code: true,
          unused: true,
          keep_fargs: false,
          keep_fnames: false,
          keep_classnames: false,
          keep_infinity: false,
          passes: 3
        },
        mangle: {
          toplevel: true,
          eval: true
        },
        format: {
          comments: false
        }
      })
    : {}

const chunkAlias = ['index', ...Object.keys(nodeNamesMap), 'common']

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      bytecodePlugin({
        chunkAlias,
        protectedStrings: [
          '2bmd.vCK!ddOf0ke2ey6kjC@5Q^a++R_',
          'kgJsGk#4_^n%CRn~nD4oKDVgqwKG5T7+',
          'PEtbFYrwJnJz5s4B'
        ]
      }),
      _terser
    ],
    build: {
      rollupOptions: {
        output: {
          chunkFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'data') {
              return '3A6EB0790F39AC87.js'
            }
            if (chunkInfo.name === 'pageEval') {
              return '92A5DC04BD6F9FB8.js'
            }
            if (chunkInfo.name === 'common') {
              return 'BsXLohN0BsXLohN0.js'
            }
            if (chunkInfo.name.includes('_execute')) {
              return nodeNamesMap[chunkInfo.name] + '.js'
            }
            return '[hash][hash].js'
          },
          manualChunks(id) {
            if (id.includes('data/index')) {
              return 'data'
            }
            if (id.includes('main/common')) {
              return 'common'
            }
            if (id.includes('main/pageEval')) {
              return 'pageEval'
            }
            if (id.includes('execute')) {
              const ids = id.split('/')
              return ids[ids.length - 2] + '_execute'
            }
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve('src/main'),
        '@pageEval': resolve('src/main/pageEval'),
        '@renderer': resolve('src/renderer/src'),
        '@dataModule': resolve('src/main/data')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin(), bytecodePlugin({ chunkAlias: ['index'] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.js')
        }
      }
    }
  },
  renderer: {
    css: {
      preprocessorOptions: {
        less: {
          modifyVars: {
            'arcoblue-6': '#f85959'
          },
          javascriptEnabled: true
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          chunkFileNames: '[hash][hash].js',
          assetFileNames: '[hash][hash].[ext]'
        },
        plugins: [_terser]
      }
    },
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@main': resolve('src/main'),
        '@nodes-path': resolve('src/renderer/src/workflow/nodes')
      }
    },
    plugins: [vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => tag === 'webview'
        }
      }
    })]
  }
})
