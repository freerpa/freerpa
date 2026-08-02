import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import terser from '@rollup/plugin-terser'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const _terser =
  process.env.NODE_ENV === 'production'
    ? terser({
        compress: {
          arrows: true,
          // 仅移除 console.log，保留 console.error/warn 便于生产排查
          pure_funcs: ['console.log'],
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

export default defineConfig({
  main: {
    plugins: [_terser],
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
    plugins: [],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.js'),
          bvm: resolve('src/preload/bvm.js')
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
