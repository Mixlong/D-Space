import { createApp, nextTick } from 'vue'

import Cookies from 'js-cookie'

import ElementPlus, { ElMessage } from 'element-plus'
import 'element-plus/dist/index.css'
// import 'element-plus/theme-chalk/dark/css-vars.css' // 已禁用深色模式
import locale from 'element-plus/es/locale/lang/zh-cn'

import '@/assets/styles/index.scss' // global css

import App from './App'
import store from './store'
import router from './router'
import directive from './directive' // directive

// 注册指令
import plugins from './plugins' // plugins
import mqttPlugin from './plugins/mqtt' // MQTT插件
import { download } from '@/utils/request'
import { initializeIam } from '@/utils/iam'

// svg图标
import 'virtual:svg-icons-register'
import SvgIcon from '@/components/SvgIcon'
import elementIcons from '@/components/SvgIcon/svgicon'

import './permission' // permission control

import { useDict } from '@/utils/dict'
import { getConfigKey } from "@/api/system/config"
import { parseTime, resetForm, addDateRange, handleTree, selectDictLabel, selectDictLabels } from '@/utils/ruoyi'

// 分页组件
import Pagination from '@/components/Pagination'
// 自定义表格工具组件
import RightToolbar from '@/components/RightToolbar'
// 富文本组件
import Editor from "@/components/Editor"
// 文件上传组件
import FileUpload from "@/components/FileUpload"
// 图片上传组件
import ImageUpload from "@/components/ImageUpload"
// 图片预览组件
import ImagePreview from "@/components/ImagePreview"
// 字典标签组件
import DictTag from '@/components/DictTag'

const app = createApp(App)

// 全局方法挂载
app.config.globalProperties.useDict = useDict
app.config.globalProperties.download = download
app.config.globalProperties.parseTime = parseTime
app.config.globalProperties.resetForm = resetForm
app.config.globalProperties.handleTree = handleTree
app.config.globalProperties.addDateRange = addDateRange
app.config.globalProperties.getConfigKey = getConfigKey
app.config.globalProperties.selectDictLabel = selectDictLabel
app.config.globalProperties.selectDictLabels = selectDictLabels

// 全局组件挂载
app.component('DictTag', DictTag)
app.component('Pagination', Pagination)
app.component('FileUpload', FileUpload)
app.component('ImageUpload', ImageUpload)
app.component('ImagePreview', ImagePreview)
app.component('RightToolbar', RightToolbar)
app.component('Editor', Editor)

// 必须先恢复文件中的 IAM，再启动路由守卫及接口请求。
async function mountApplication() {
  let iamStatus
  try {
    iamStatus = await initializeIam()
  } catch (error) {
    console.error('[IAM] 启动恢复失败:', error)
    iamStatus = { ok: false, warning: 'IAM 恢复失败，可能需要重新完成身份验证' }
  }

  window.addEventListener('iam-storage-write-failed', () => {
    ElMessage.warning('IAM 已用于当前登录，但加密文件保存失败；下次启动可能需要重新验证')
  })

  app.use(router)
  app.use(store)
  app.use(plugins)
  app.use(mqttPlugin) // 注册MQTT插件
  app.use(elementIcons)
  app.component('svg-icon', SvgIcon)

  // 将 router 挂载到 window 对象，供 MQTT 客户端使用
  window.$router = router

  directive(app)

  // 使用element-plus 并且设置全局的大小
  app.use(ElementPlus, {
    locale: locale,
    // 支持 large、default、small
    size: Cookies.get('size') || 'default'
  })

  app.mount('#app')
  if (iamStatus?.ok === false) {
    console.warn('[IAM] 恢复失败（不弹窗，仅记录日志）:', iamStatus.warning)
  }

  // 页面挂载不代表异步路由已完成。等初始导航和 UI 刷新之后再允许关闭启动监控。
  await router.isReady()
  await nextTick()
  window.electronAPI?.notifyAppReady?.()
}

mountApplication().catch((error) => {
  console.error('[启动] Vue 初始化失败:', error)
  window.electronAPI?.reportAppStartupFailed?.(error?.message || 'startup failed')
})
