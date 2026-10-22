import defaultSettings from '@/settings'
// import { useDark, useToggle } from '@vueuse/core' // 已禁用深色模式
import { useDynamicTitle } from '@/utils/dynamicTitle'

const { sideTheme, showSettings, topNav, tagsView, tagsIcon, fixedHeader, sidebarLogo, dynamicTitle, footerVisible, footerContent } = defaultSettings

const storageSetting = JSON.parse(localStorage.getItem('layout-setting')) || ''

const useSettingsStore = defineStore(
  'settings',
  {
    state: () => ({
      title: '',
      theme: storageSetting.theme || '#2E74FF',
      sideTheme: storageSetting.sideTheme || sideTheme,
      showSettings: showSettings,
      topNav: storageSetting.topNav === undefined ? topNav : storageSetting.topNav,
      tagsView: storageSetting.tagsView === undefined ? tagsView : storageSetting.tagsView,
      tagsIcon: storageSetting.tagsIcon === undefined ? tagsIcon : storageSetting.tagsIcon,
      fixedHeader: storageSetting.fixedHeader === undefined ? fixedHeader : storageSetting.fixedHeader,
      sidebarLogo: storageSetting.sidebarLogo === undefined ? sidebarLogo : storageSetting.sidebarLogo,
      dynamicTitle: storageSetting.dynamicTitle === undefined ? dynamicTitle : storageSetting.dynamicTitle,
      footerVisible: storageSetting.footerVisible === undefined ? footerVisible : storageSetting.footerVisible,
      footerContent: footerContent,
      isDark: false // 深色模式已禁用
    }),
    actions: {
      // 修改布局设置
      changeSetting(data) {
        const { key, value } = data
        if (this.hasOwnProperty(key)) {
          this[key] = value
        }
      },
      // 设置网页标题
      setTitle(title) {
        this.title = title
        useDynamicTitle()
      },
      // 切换暗黑模式（已禁用）
      toggleTheme() {
        // 深色模式已被禁用
        console.warn('深色模式已被禁用')
      }
    }
  })

export default useSettingsStore
