<template>
  <router-view />
  <!-- 更新通知弹框 -->
  <UpdateNoticeDialog ref="updateNoticeDialogRef" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import useSettingsStore from '@/store/modules/settings'
import useUserStore from '@/store/modules/user'
import { handleThemeStyle } from '@/utils/theme'
import { initMqtt, disconnectMqtt } from '@/plugins/mqtt'
import UpdateNoticeDialog from '@/components/UpdateNoticeDialog/index.vue'

const userStore = useUserStore()

onMounted(() => {
  nextTick(() => {
    // 初始化主题样式
    handleThemeStyle(useSettingsStore().theme)
    
    // 如果用户已登录，自动连接MQTT长连接
    if (userStore.token && userStore.id) {
      console.log('[App] 检测到用户已登录，自动初始化MQTT连接...')
      initMqtt().catch(error => {
        console.error('[App] MQTT自动连接失败:', error)
      })
    } else {
      console.log('[App] 用户未登录，跳过MQTT初始化')
    }
  })
  
  // 监听窗口关闭事件（浏览器环境）
  window.addEventListener('beforeunload', handleBeforeUnload)
  
  // 监听 Electron 应用关闭事件（渲染进程）
  if (window.electronAPI) {
    window.electronAPI.on('app-closing', handleAppClosing)
  }
})

onBeforeUnmount(() => {
  // 组件卸载时清理
  handleBeforeUnload()
  window.removeEventListener('beforeunload', handleBeforeUnload)
  
  if (window.electronAPI) {
    window.electronAPI.removeListener('app-closing')
  }
})

// 浏览器标签页关闭
function handleBeforeUnload(e) {
  console.log('[App] 浏览器标签页即将关闭，断开MQTT连接...')
  // 同步发送下线状态（beforeunload 不支持异步）
  disconnectMqtt('browser_close')
}

// Electron 应用关闭
async function handleAppClosing() {
  console.log('[App] Electron 应用即将关闭，断开MQTT连接...')
  await disconnectMqtt('app_close')
}
</script>
