<template>
  <div class="update-indicator-wrapper">
    <!-- 下载中的动画图标 -->
    <el-tooltip 
      v-if="isDownloading" 
      :content="`正在下载更新 ${downloadPercent}%`" 
      effect="dark" 
      placement="bottom"
    >
      <div class="update-icon downloading" @click="showProgressDialog" style="-webkit-app-region: no-drag;">
        <svg class="download-icon" viewBox="0 0 24 24" width="20" height="20">
          <circle class="progress-ring" cx="12" cy="12" r="10" 
            :style="{
              strokeDasharray: `${downloadPercent * 0.628} 62.8`,
              strokeDashoffset: 0
            }"
          />
          <path class="arrow" d="M12 4 L12 16 M8 12 L12 16 L16 12" 
            stroke="currentColor" 
            stroke-width="2" 
            fill="none" 
            stroke-linecap="round" 
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </el-tooltip>

    <!-- 下载完成的提示图标 -->
    <el-tooltip 
      v-else-if="isDownloaded" 
      :content="isMac ? '检查版本更新点击查看' : '更新已下载完成，点击重启安装'" 
      effect="dark" 
      placement="bottom"
    >
    <div class="update-icon downloaded" @click="showInstallDialog" style="-webkit-app-region: no-drag;">
        <svg viewBox="0 0 30 30" width="30" height="30">
          <circle cx="15" cy="15" r="12" fill="none" stroke="currentColor" stroke-width="4"/>
          <path d="M10 15 L13 18 L20 11" 
            stroke="currentColor" 
            stroke-width="2.5" 
            fill="none" 
            stroke-linecap="round" 
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </el-tooltip>

    <!-- 下载进度对话框（一旦开始下载就强制不可关闭，下载完会自动走安装流程） -->
    <el-dialog
      v-model="progressDialogVisible"
      title="正在下载更新"
      width="400px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      z-index="1000"
      append-to-body
      top="30vh"
    >
      <div class="progress-content">
        <div class="progress-info">
          <div class="info-row">
            <span class="label">当前版本：</span>
            <span class="value">{{ currentVersion }}</span>
          </div>
          <div class="info-row">
            <span class="label">新版本：</span>
            <span class="value">{{ newVersion }}</span>
          </div>
        </div>

        <el-progress 
          :percentage="downloadPercent" 
          :stroke-width="20"
          :text-inside="true"
          status="success"
        />

        <div class="download-stats">
          <div class="stat-item">
            <span class="stat-label">已下载：</span>
            <span class="stat-value">{{ formatBytes(downloadedBytes) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">总大小：</span>
            <span class="stat-value">{{ formatBytes(totalBytes) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">下载速度：</span>
            <span class="stat-value">{{ formatBytes(downloadSpeed) }}/s</span>
          </div>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <!-- 收起弹窗：下载继续在后台跑（右上角图标会显示进度），
               下载完成时会自动重启安装。无法取消下载本身。 -->
          <el-button @click="progressDialogVisible = false">
            隐藏到后台
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 安装确认对话框（仅作为兜底：Mac 静默安装失败时弹出，给用户选"手动下载安装"）。
         正常下载完成不再弹这个对话框，直接 installUpdate 自动重启。 -->
    <el-dialog
      v-model="installDialogVisible"
      :title="isMac ? '检测到新版本' : '更新已准备就绪'"
      width="450px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      z-index="3000"
      append-to-body
      top="25vh"
    >
      <div class="install-content">
        <el-icon :size="60" color="#67C23A" class="success-icon">
          <CircleCheck />
        </el-icon>
        <p class="install-message">
          新版本 <strong>{{ newVersion }}</strong> 已下载完成
        </p>
        <p class="install-tip">
          应用将自动重启以完成更新安装
        </p>
        <p v-if="isMac" class="install-tip-secondary">
          如自动安装失败，可点击"手动下载安装"
        </p>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="installUpdate" size="large">
            立即重启安装
          </el-button>
          <el-button v-if="isMac" @click="downloadManually" size="large">
            手动下载安装
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck } from '@element-plus/icons-vue'

// 状态
const isDownloading = ref(false)
const isDownloaded = ref(false)
const downloadPercent = ref(0)
const downloadedBytes = ref(0)
const totalBytes = ref(0)
const downloadSpeed = ref(0)
const currentVersion = ref('')
const newVersion = ref('')
const isMac = ref(false) // 是否是 Mac 平台

// 对话框显示状态
const progressDialogVisible = ref(false)
const installDialogVisible = ref(false)

// 监听更新事件
// 流程：发现新版本 → 直接弹下载进度对话框（不可关闭）→ 下载完成自动重启安装
const handleUpdateAvailable = (info) => {
  console.log('[UpdateIndicator] 发现新版本:', info)
  newVersion.value = info.version
  isDownloading.value = true
  // 重置进度（防止上次残留）
  downloadPercent.value = 0
  downloadedBytes.value = 0
  totalBytes.value = 0
  downloadSpeed.value = 0
  // 直接弹进度对话框，把整个下载流程展示给用户，且不允许关闭
  progressDialogVisible.value = true
}

const handleDownloadProgress = (progressObj) => {
  console.log('[UpdateIndicator] 下载进度:', progressObj)
  downloadPercent.value = Math.round(progressObj.percent)
  downloadedBytes.value = progressObj.transferred
  totalBytes.value = progressObj.total
  downloadSpeed.value = progressObj.bytesPerSecond || 0
}

const handleUpdateDownloaded = (data) => {
  console.log('[UpdateIndicator] 下载完成:', data)
  isDownloading.value = false
  isDownloaded.value = true

  // 保存平台信息（installUpdate 内部要用 isMac 判断走哪条安装路径）
  if (data && typeof data.isMac !== 'undefined') {
    isMac.value = data.isMac
  }

  // 把进度条停在 100% 让用户看到"下载完成"再切走，避免突然消失
  downloadPercent.value = 100

  // 直接进入安装流程，不再弹"已下载完成"确认对话框（避免用户操作）
  // 短暂延迟让用户看清进度条到达 100%
  setTimeout(() => {
    progressDialogVisible.value = false
    installUpdate()
  }, 600)
}

// 显示进度对话框
const showProgressDialog = () => {
  progressDialogVisible.value = true
}

// 显示安装对话框
const showInstallDialog = () => {
  installDialogVisible.value = true
}

// 处理安装失败
const handleInstallFailed = (data) => {
  console.log('[UpdateIndicator] 安装失败:', data)
  installDialogVisible.value = false
  progressDialogVisible.value = false

  if (data.useManualDownload) {
    // Mac 静默安装失败（典型：当前 .app 不可写），自动降级到手动下载流程
    ElMessage.warning({
      message: '自动安装失败，已为你切换到手动下载方式',
      duration: 4000
    })
    // 自动触发手动下载，用户体验更顺
    downloadManually()
  } else {
    ElMessage.error(data.message || '安装失败，请稍后重试')
  }
}

// Mac 静默安装进度（下载、解压、替换、重启）
const handleMacSilentInstallProgress = (data) => {
  if (!data) return
  const { phase, percent } = data
  if (phase === 'downloading' && typeof percent === 'number') {
    downloadPercent.value = Math.round(percent)
    progressDialogVisible.value = true
  } else if (phase === 'extracting') {
    downloadPercent.value = 100
  } else if (phase === 'installing' || phase === 'relaunching') {
    progressDialogVisible.value = false
    ElMessage.success({
      message: phase === 'relaunching' ? '正在重启应用...' : '正在安装新版本...',
      duration: 2000
    })
  }
}

// 安装更新（下载完成后自动触发，也可由用户点击安装对话框按钮触发）
const installUpdate = () => {
  console.log('[UpdateIndicator] 触发安装更新', { isMac: isMac.value })

  if (!(window.electronAPI && window.electronAPI.installUpdate)) {
    console.error('[UpdateIndicator] electronAPI 或 installUpdate 方法不可用')
    ElMessage.error('无法执行更新，请使用手动下载方式')
    return
  }

  try {
    // Mac 走自管理静默安装：把 zip 下载地址作为后端的回退方案传过去
    // （后端优先用 electron-updater 已下载的缓存，失败时才用这个 URL 重新下载）
    const payload = isMac.value
      ? { downloadUrl: getMacDownloadUrl() }
      : undefined

    window.electronAPI.installUpdate(payload)
    console.log('[UpdateIndicator] installUpdate() 调用成功')
    installDialogVisible.value = false

    // Mac 上显示 "安装中" 提示（实际进度由 mac-silent-install-progress 推送）
    if (isMac.value) {
      ElMessage.info({
        message: '正在准备安装，请稍候...',
        duration: 2000
      })
    }
  } catch (error) {
    console.error('[UpdateIndicator] installUpdate() 调用失败:', error)
    ElMessage.error('自动更新失败，请尝试手动下载安装')
  }
}

// 计算 Mac 下载地址（两处复用：手动下载 / 静默安装兜底）
const getMacDownloadUrl = () => {
  // 检测 Apple Silicon。navigator.userAgentData 在新版 Chromium 可用，否则回退启发式判断
  const isAppleSilicon = navigator.userAgent.includes('Mac') &&
    navigator.platform === 'MacIntel' &&
    navigator.maxTouchPoints > 1
  const arch = isAppleSilicon ? 'arm64' : 'x64'
  // 必须与 scripts/upload-to-oss.cjs / main.cjs setFeedURL 的目录一致
  return `https://bikewise.oss-cn-shenzhen.aliyuncs.com/d-space/digismart-desktop/D-Space-${arch}.zip`
}

// Mac 手动下载更新
const downloadManually = async () => {
  console.log('[UpdateIndicator] Mac 用户选择手动下载')

  const downloadUrl = getMacDownloadUrl()
  const arch = downloadUrl.includes('arm64') ? 'arm64' : 'x64'

  console.log('[UpdateIndicator] 下载链接:', downloadUrl)
  console.log('[UpdateIndicator] 芯片架构:', arch)
  
  // 关闭安装对话框
  installDialogVisible.value = false
  
  // 🔧 关键修复：标记为下载中状态
  isDownloading.value = true
  isDownloaded.value = false
  
  if (window.electronAPI && window.electronAPI.downloadUpdateManually) {
    // Electron 环境：使用自定义下载（可选择保存位置）
    try {
      // 监听下载进度
      const progressHandler = (progress) => {
        downloadPercent.value = progress.percent
        console.log(`[下载] 进度: ${progress.percent.toFixed(2)}%`)
      }
      
      const completeHandler = (data) => {
        console.log('[下载] 下载完成:', data.filePath)
        
        // 🔧 重置下载状态
        isDownloading.value = false
        isDownloaded.value = true
        progressDialogVisible.value = false
        
        // 显示成功提示并询问是否打开文件夹
        ElMessageBox.confirm(
          `文件已保存到: ${data.filePath}`,
          '下载完成',
          {
            confirmButtonText: '在文件夹中显示',
            cancelButtonText: '关闭',
            type: 'success'
          }
        ).then(() => {
          if (window.electronAPI.showItemInFolder) {
            window.electronAPI.showItemInFolder(data.filePath)
          }
        }).catch(() => {
          // 用户点击关闭
        })
        
        // 移除监听器
        window.electronAPI.removeUpdateListeners()
      }
      
      // 注册监听器
      if (window.electronAPI.onDownloadProgressManual) {
        window.electronAPI.onDownloadProgressManual(progressHandler)
      }
      if (window.electronAPI.onDownloadCompleteManual) {
        window.electronAPI.onDownloadCompleteManual(completeHandler)
      }
      
      // 显示进度对话框
      downloadPercent.value = 0
      progressDialogVisible.value = true
      
      // 开始下载
      const result = await window.electronAPI.downloadUpdateManually({
        downloadUrl,
        version: newVersion.value,
        arch
      })
      
      console.log('[下载] 下载结果:', result)
      
      if (result.canceled) {
        // 🔧 取消下载，重置状态回到"检测到新版本"
        isDownloading.value = false
        isDownloaded.value = true
        progressDialogVisible.value = false
        ElMessage.info('已取消下载')
      } else if (!result.success) {
        // 🔧 下载失败，重置状态回到"检测到新版本"
        isDownloading.value = false
        isDownloaded.value = true
        progressDialogVisible.value = false
        ElMessage.error(result.error || '下载失败，请稍后重试')
      }
      
    } catch (error) {
      console.error('[下载] 下载失败:', error)
      // 🔧 异常情况，重置状态
      isDownloading.value = false
      isDownloaded.value = true
      progressDialogVisible.value = false
      ElMessage.error('下载失败: ' + error.message)
    }
  } else {
    // 浏览器环境：直接打开下载链接
    window.open(downloadUrl, '_blank')
    ElMessage.success({
      message: '已打开下载页面，下载完成后请手动安装',
      duration: 5000
    })
  }
}

// 格式化字节
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// 获取当前版本
const getCurrentVersion = () => {
  // 从 package.json 读取版本号（需要在构建时注入）
  currentVersion.value = import.meta.env.VITE_APP_VERSION || '3.9.13'
}

onMounted(() => {
  getCurrentVersion()
  
  // 注册事件监听器
  if (window.electronAPI) {
    window.electronAPI.onUpdateAvailable(handleUpdateAvailable)
    window.electronAPI.onDownloadProgress(handleDownloadProgress)
    window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded)
    
    // 监听安装失败事件
    if (window.electronAPI.onUpdateInstallFailed) {
      window.electronAPI.onUpdateInstallFailed(handleInstallFailed)
    }

    // Mac 静默安装进度推送
    if (window.electronAPI.onMacSilentInstallProgress) {
      window.electronAPI.onMacSilentInstallProgress(handleMacSilentInstallProgress)
    }
  }
})

onUnmounted(() => {
  // 清理事件监听器
  if (window.electronAPI) {
    // 注意：这里需要在 preload 中实现 removeListener 方法
    // 或者使用 once 方法来避免内存泄漏
  }
})
</script>

<style lang="scss" scoped>
.update-indicator-wrapper {
  display: inline-block;
  margin-right: 10px;
}

.update-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  cursor: pointer;
  color: #ffffff;
  transition: all 0.3s;
  font-size: 32px;
  transform: scale(1);
  &:hover {
    transform: scale(1.1);
  }

  &.downloading {
    .download-icon {
      animation: pulse 2s ease-in-out infinite;
    }

    .progress-ring {
      fill: none;
      stroke: #67C23A;
      stroke-width: 2;
      transform: rotate(-90deg);
      transform-origin: center;
      transition: stroke-dasharray 0.3s ease;
    }

    .arrow {
      animation: bounce 1s ease-in-out infinite;
    }
  }

  &.downloaded {
    animation: glow 1.5s ease-in-out infinite;
    color: #67C23A;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(2px);
  }
}

@keyframes glow {
  0%, 100% {
    filter: drop-shadow(0 0 2px #67C23A);
  }
  50% {
    filter: drop-shadow(0 0 8px #67C23A);
  }
}

.progress-content {
  padding: 10px 0;

  .progress-info {
    margin-bottom: 20px;

    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 14px;

      .label {
        color: #909399;
      }

      .value {
        font-weight: bold;
        color: #303133;
      }
    }
  }

  .download-stats {
    margin-top: 20px;
    display: flex;
    justify-content: space-between;
    padding: 15px;
    background: #f5f7fa;
    border-radius: 4px;

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;

      .stat-label {
        font-size: 12px;
        color: #909399;
        margin-bottom: 5px;
      }

      .stat-value {
        font-size: 14px;
        font-weight: bold;
        color: #303133;
      }
    }
  }
}

.install-content {
  text-align: center;
  padding: 20px 0;

  .success-icon {
    margin-bottom: 20px;
  }

  .install-message {
    font-size: 16px;
    color: #303133;
    margin-bottom: 10px;

    strong {
      color: #409EFF;
    }
  }

  .install-tip {
    font-size: 14px;
    color: #909399;
    line-height: 1.8;
    
    &.mac-tip {
      background: #FFF7E6;
      border: 1px solid #FFD666;
      border-radius: 8px;
      padding: 15px;
      margin-top: 15px;
      color: #874D00;
      
      .tip-icon {
        font-size: 18px;
        margin-right: 5px;
      }
      
      strong {
        color: #D46B08;
        font-weight: 600;
      }
    }
  }

  .install-tip-secondary {
    font-size: 12px;
    color: #C0C4CC;
    line-height: 1.6;
    margin-top: 6px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  
  .el-button {
    min-width: 120px;
  }
}
</style>
