<template>
  <!-- 无弹窗，只使用顶部消息通知 -->
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'

// 检查是否在Electron环境中
const isElectron = () => {
  return window.electronAPI !== undefined
}

// 格式化字节
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// 监听更新事件
const setupUpdateListeners = () => {
  if (!isElectron()) return

  // 发现新版本 - 自动下载
  window.electronAPI.onUpdateAvailable((info) => {
    console.log('[AppUpdater] 发现新版本:', info)
    ElMessage.success({
      message: `发现新版本 ${info.version}，正在后台下载...`,
      duration: 5000,
      showClose: true
    })
  })

  // 下载进度
  window.electronAPI.onDownloadProgress((progress) => {
    console.log('[AppUpdater] 下载进度:', Math.round(progress.percent) + '%')
    // 只在控制台显示进度，不弹窗
  })

  // 下载完成
  window.electronAPI.onUpdateDownloaded(() => {
    console.log('[AppUpdater] 下载完成')
    
    // 显示桌面通知，引导用户重启
    ElNotification({
      title: '更新下载完成',
      message: '新版本已下载完成！',
      type: 'success',
      duration: 10000,
      position: 'top-right'
    })
  })
}

// 暴露检查更新方法
const checkForUpdates = () => {
  if (isElectron()) {
    window.electronAPI.checkForUpdates()
  } else {
    ElMessage.warning('当前不在Electron环境中')
  }
}

onMounted(() => {
  setupUpdateListeners()
})

onUnmounted(() => {
  // 新API会自动管理监听器生命周期
})

// 导出方法供外部调用
defineExpose({
  checkForUpdates
})
</script>

<style scoped>
/* 无需样式 */
</style>
