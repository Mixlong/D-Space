import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import createVitePlugins from './vite/plugins'
import { readFileSync } from 'fs'

// 读取 package.json 获取版本号
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd())
  const { VITE_APP_ENV, VITE_APP_BASE_API } = env
  
  // 后端接口地址（从环境变量读取）
  const baseUrl = VITE_APP_BASE_API || 'http://localhost:8080'
  
  // 判断是否为Electron开发环境
  const isElectronDev = process.env.NODE_ENV === 'development' && process.env.IS_ELECTRON === 'true';
  
  return {
    // 部署生产环境和开发环境下的URL。
    // 默认情况下，vite 会假设你的应用是被部署在一个域名的根路径上
    // 例如 https://www.ruoyi.vip/。如果应用被部署在一个子路径上，你就需要用这个选项指定这个子路径。例如，如果你的应用被部署在 https://www.ruoyi.vip/admin/，则设置 baseUrl 为 /admin/。
    base: VITE_APP_ENV === 'production' ? './' : '/',
    plugins: createVitePlugins(env, command === 'build'),
    // Vue 配置
    vue: {
      template: {
        compilerOptions: {
          // 将 webview 标记为自定义元素（Electron webview 标签）
          isCustomElement: (tag) => tag === 'webview'
        }
      }
    },
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)
    },
    resolve: {
      // https://cn.vitejs.dev/config/#resolve-alias
      alias: {
        // 设置路径
        '~': path.resolve(__dirname, './'),
        // 设置别名
        '@': path.resolve(__dirname, './src')
      },
      // https://cn.vitejs.dev/config/#resolve-extensions
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
    },
    // 打包配置
    build: {
      // https://vite.dev/config/build-options.html
      sourcemap: command === 'build' ? false : 'inline',
      outDir: 'dist',
      assetsDir: 'assets',
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          chunkFileNames: 'static/js/[name]-[hash].js',
          entryFileNames: 'static/js/[name]-[hash].js',
          assetFileNames: 'static/[ext]/[name]-[hash].[ext]',
          manualChunks: {
            // 将 Vue 相关库分离
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            // 将 Element Plus 分离
            'element-plus': ['element-plus', '@element-plus/icons-vue'],
            // 将 echarts 分离
            'echarts': ['echarts'],
            // 将编辑器相关分离
            'editor': ['@vueup/vue-quill'],
            // 将其他大型库分离
            'utils': ['axios', 'js-cookie', 'nprogress', 'crypto-js']
          }
        }
      }
    },
    // vite 相关配置
    server: {
      port: 8080,
      host: true,
      strictPort: true, // 强制使用指定端口,如果端口被占用则报错
      open: !isElectronDev, // Electron开发环境下不自动打开浏览器
      proxy: {
        // https://cn.vitejs.dev/config/#server-proxy
        '/dev-api': {
          target: baseUrl,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/dev-api/, '')
        },
         // springdoc proxy
         '^/v3/api-docs/(.*)': {
          target: baseUrl,
          changeOrigin: true,
        }
      }
    },
    css: {
      postcss: {
        plugins: [
          {
            postcssPlugin: 'internal:charset-removal',
            AtRule: {
              charset: (atRule) => {
                if (atRule.name === 'charset') {
                  atRule.remove()
                }
              }
            }
          }
        ]
      }
    }
  }
})
