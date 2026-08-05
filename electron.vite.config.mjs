import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

// 生产构建使用 vite 内置 esbuild 压缩。
// 原因：@rollup/plugin-terser + terser 5.49.x 在 Node 22 上存在间歇性崩溃
// （Cannot read properties of null (reading 'length')，与具体源码无关，基线同样触发）。
// 行为对齐原 terser 配置：仅移除 console.log 与 debugger，保留 console.error/warn 便于生产排查。
const _esbuild =
  process.env.NODE_ENV === 'production'
    ? {
        pure: ['console.log'],
        drop: ['debugger']
      }
    : undefined

export default defineConfig({
  main: {
    esbuild: _esbuild,
    build: {
      rollupOptions: {
        output: {
          chunkFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'data') {
              return '3A6EB0790F39AC87.js'
            }
            return '[hash][hash].js'
          },
          manualChunks(id) {
            if (id.includes('data/index')) {
              return 'data'
            }
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve('src/main')
      }
    }
  },
  preload: {
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
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
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
