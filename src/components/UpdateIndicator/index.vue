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
          <circle
            class="progress-ring"
            cx="12"
            cy="12"
            r="10"
            :style="{
              strokeDasharray: `${downloadPercent * 0.628} 62.8`,
              strokeDashoffset: 0
            }"
          />
          <path
            class="arrow"
            d="M12 4 L12 16 M8 12 L12 16 L16 12"
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
      :content="isMac ? '新版本已就绪，点击查看' : '更新已下载完成，点击重启安装'"
      effect="dark"
      placement="bottom"
    >
      <div class="update-icon downloaded" @click="showProgressDialog" style="-webkit-app-region: no-drag;">
        <svg viewBox="0 0 30 30" width="30" height="30">
          <circle cx="15" cy="15" r="12" fill="none" stroke="currentColor" stroke-width="4" />
          <path
            d="M10 15 L13 18 L20 11"
            stroke="currentColor"
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </el-tooltip>

    <!-- 版本更新与下载进度合并弹窗（水平+垂直居中，简洁克制） -->
    <el-dialog
      v-model="progressDialogVisible"
      width="480px"
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="!isForceUpdate"
      :z-index="2000"
      append-to-body
      class="desktop-update-dialog"
    >
      <template #header>
        <div class="update-dialog-header">
          <span class="dialog-main-title">{{ progressDialogTitle }}</span>
          <span class="version-meta">v{{ currentVersion }} → v{{ newVersion }}</span>
        </div>
      </template>

      <div class="update-dialog-body">
        <!-- 更新说明：沿用后台通知公告（类型 1，标题为版本号） -->
        <div v-if="updateNotices.length" class="update-notes-section">
          <div class="section-label">更新说明</div>
          <div ref="noticeBodyRef" class="update-notes-card">
            <div v-for="notice in updateNotices" :key="notice.noticeId" class="update-notes-item">
              <div
                v-if="updateNotices.length > 1 && notice.noticeTitle && notice.noticeTitle !== newVersion"
                class="update-notes-title"
              >
                {{ notice.noticeTitle }}
              </div>
              <div class="notice-body" v-html="notice.noticeContent"></div>
            </div>
          </div>
        </div>

        <!-- 下载进度区 -->
        <div class="download-progress-section" :class="{ 'is-error': !!downloadError }">
          <div class="progress-meta-row">
            <span class="progress-status-text">
              <template v-if="downloadError">{{ downloadError }}</template>
              <template v-else-if="isDownloaded">下载完成，重启应用即可完成安装</template>
              <template v-else>正在下载更新包...</template>
            </span>
            <span v-if="!downloadError" class="progress-percent-text">{{ downloadPercent }}%</span>
          </div>

          <el-progress
            :percentage="downloadPercent"
            :stroke-width="6"
            :show-text="false"
            :status="downloadError ? 'exception' : (isDownloaded ? 'success' : undefined)"
          />

          <div v-if="!downloadError" class="progress-detail-row">
            <span>
              {{ formatBytes(downloadedBytes) }}
              <template v-if="totalBytes > 0"> / {{ formatBytes(totalBytes) }}</template>
            </span>
            <span v-if="isDownloading && downloadSpeed > 0">
              {{ formatBytes(downloadSpeed) }}/s
            </span>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="update-dialog-footer">
          <template v-if="downloadError">
            <el-button v-if="!isForceUpdate" @click="progressDialogVisible = false">暂不更新</el-button>
            <el-button v-if="requiresManualUpdate" type="primary" @click="downloadLegacyInstaller">下载安装包</el-button>
            <el-button v-else type="primary" @click="retryDownload">重新下载</el-button>
          </template>
          <template v-else-if="awaitingInstallConfirm || isDownloaded">
            <el-button v-if="!isForceUpdate" :disabled="isInstalling" @click="progressDialogVisible = false">稍后安装</el-button>
            <el-button type="primary" :loading="isInstalling" @click="confirmInstallFromDialog">
              {{ isInstalling ? '正在准备安装...' : '立即重启安装' }}
            </el-button>
          </template>
          <template v-else>
            <el-button v-if="!isForceUpdate" @click="progressDialogVisible = false">后台下载</el-button>
            <span v-else class="force-update-tip">当前版本需升级后继续使用，请稍候...</span>
          </template>
        </div>
      </template>
    </el-dialog>

    <!-- 安装确认对话框（仅作为兜底：Mac 静默安装失败时弹出，给用户选"手动下载安装"） -->
    <el-dialog
      v-model="installDialogVisible"
      :title="isMac ? '检测到新版本' : '更新已准备就绪'"
      width="420px"
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      :z-index="3000"
      append-to-body
    >
      <div class="install-content">
        <el-icon :size="52" color="#67C23A" class="success-icon">
          <CircleCheck />
        </el-icon>
        <p class="install-message">
          新版本 <strong>v{{ newVersion }}</strong> 已下载完成
        </p>
        <p class="install-tip">
          应用将自动重启以完成更新安装
        </p>
        <p v-if="isMac" class="install-tip-secondary">
          如自动安装失败，可点击“手动下载安装”
        </p>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" :loading="isInstalling" @click="installUpdate">
            {{ isInstalling ? '正在准备安装...' : '立即重启安装' }}
          </el-button>
          <el-button v-if="isMac" :disabled="isInstalling" @click="downloadManually">
            手动下载安装
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 富文本更新说明中的图片预览 -->
    <el-image-viewer
      v-if="showImageViewer"
      :url-list="previewImages"
      :initial-index="currentImageIndex"
      @close="showImageViewer = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox, ElImageViewer } from 'element-plus'
import { CircleCheck } from '@element-plus/icons-vue'
import { fetchUpdateNoticesByVersion } from '@/utils/updateNotice'
import { getLatestAvailableUpdate, retryAppUpdateCheck } from '@/utils/appUpdate'
import packageJson from '../../../package.json'

// 状态
const isDownloading = ref(false)
const isDownloaded = ref(false)
const downloadPercent = ref(0)
const downloadedBytes = ref(0)
const totalBytes = ref(0)
const downloadSpeed = ref(0)
const downloadError = ref('')
const requiresManualUpdate = ref(false)
let noProgressTimer = null
const currentVersion = ref('')
const newVersion = ref('')
const isMac = ref(false)
const runtimeInfo = ref(null)
const isForceUpdate = ref(false)
const updateDownloadUrl = ref('')
const updateNotices = ref([])
const awaitingInstallConfirm = ref(false)
const isInstalling = ref(false)
let noticesPromise = Promise.resolve()

// 富文本图片预览
const noticeBodyRef = ref(null)
const showImageViewer = ref(false)
const previewImages = ref([])
const currentImageIndex = ref(0)

// 对话框显示状态
const progressDialogVisible = ref(false)
const progressDialogTitle = computed(() => {
  if (downloadError.value) return '版本更新'
  if (awaitingInstallConfirm.value || isDownloaded.value) return '新版本已就绪'
  return '发现新版本'
})
const installDialogVisible = ref(false)

const setupImagePreview = () => {
  if (!noticeBodyRef.value) return
  const images = noticeBodyRef.value.querySelectorAll('img')
  if (!images.length) return
  const urls = Array.from(images).map(img => img.src)
  images.forEach((img, index) => {
    img.style.cursor = 'zoom-in'
    img.onclick = () => {
      previewImages.value = urls
      currentImageIndex.value = index
      showImageViewer.value = true
    }
  })
}

// 读取新版本的更新说明（失败/没有则只显示下载进度）
const loadUpdateNotices = async (version) => {
  const notices = await fetchUpdateNoticesByVersion(version)
  if (newVersion.value !== version) return
  updateNotices.value = notices
  nextTick(() => {
    setupImagePreview()
  })
}

const retryDownload = async () => {
  clearNoProgressTimer()
  if (requiresManualUpdate.value) {
    downloadLegacyInstaller()
    return
  }
  downloadError.value = ''
  isDownloading.value = true
  isDownloaded.value = false
  isInstalling.value = false
  awaitingInstallConfirm.value = false
  downloadPercent.value = 0
  downloadedBytes.value = 0
  totalBytes.value = 0
  downloadSpeed.value = 0

  if (window.electronAPI?.checkForUpdatesWithConfig && runtimeInfo.value?.updateTransport === 'dict-v1') {
    // 重新读取完整字典配置，确保 sha512 和当前架构下载地址不丢失。
    const triggered = await retryAppUpdateCheck()
    if (!triggered) {
      isDownloading.value = false
      downloadError.value = '无法获取有效的更新配置或下载地址，请稍后重试'
    }
  } else {
    requiresManualUpdate.value = true
    isDownloading.value = false
    downloadError.value = '当前客户端更新模块较旧，请下载安装包升级'
  }
}

const clearNoProgressTimer = () => {
  if (noProgressTimer) clearTimeout(noProgressTimer)
  noProgressTimer = null
}

// 主进程 IPC 没有响应时也不能永远显示 0 B。
const watchDownloadStart = () => {
  clearNoProgressTimer()
  if (requiresManualUpdate.value) return
  noProgressTimer = setTimeout(() => {
    if (isDownloading.value && downloadedBytes.value === 0) {
      isDownloading.value = false
      downloadError.value = '下载未启动或服务器无响应，请检查网络并重新下载'
    }
  }, 45000)
}

const downloadLegacyInstaller = () => {
  try {
    const link = new URL(updateDownloadUrl.value)
    if (link.protocol !== 'https:' ||
        (link.hostname !== 'file.riding-evolved.com' && !link.hostname.endsWith('.file.riding-evolved.com'))) {
      throw new Error('untrusted')
    }
    if (window.electronAPI?.openExternal) window.electronAPI.openExternal(link.href)
    else window.open(link.href, '_blank', 'noopener,noreferrer')
    ElMessage.info('已通过浏览器打开安装包下载地址，下载完成后请关闭旧版并安装')
  } catch (error) {
    ElMessage.error('更新下载地址无效，请检查更新字典配置')
  }
}

const handleUpdateAvailable = (info) => {
  if (!info || !info.version) return
  // 旧 electron-updater 发来的事件没有字典下载地址，不得覆盖手动升级入口。
  if (requiresManualUpdate.value && newVersion.value === info.version && !info.downloadUrl) return
  if (newVersion.value === info.version && !downloadError.value &&
      (progressDialogVisible.value || isDownloading.value || isDownloaded.value)) {
    return
  }
  console.log('[UpdateIndicator] 发现新版本:', info)
  if (info.currentVersion) {
    currentVersion.value = info.currentVersion
  }
  newVersion.value = info.version
  updateDownloadUrl.value = info.downloadUrl || ''
  isForceUpdate.value = info.policy?.force === true
  requiresManualUpdate.value = info.requiresManualUpdate === true
  awaitingInstallConfirm.value = false
  isInstalling.value = false
  downloadError.value = ''
  updateNotices.value = []
  noticesPromise = loadUpdateNotices(info.version)
  isDownloading.value = true
  isDownloaded.value = false
  downloadPercent.value = 0
  downloadedBytes.value = 0
  totalBytes.value = 0
  downloadSpeed.value = 0
  progressDialogVisible.value = true
  if (requiresManualUpdate.value) {
    isDownloading.value = false
    downloadError.value = '当前客户端更新模块较旧，无法自动下载，请下载安装包升级'
  } else {
    watchDownloadStart()
  }
}

const handleDesktopUpdateEvent = (event) => {
  if (event?.detail) {
    handleUpdateAvailable(event.detail)
  }
}

const handleDownloadProgress = (progressObj) => {
  if ((progressObj?.transferred || 0) > 0) clearNoProgressTimer()
  requiresManualUpdate.value = false
  isDownloading.value = true
  isDownloaded.value = false
  downloadError.value = ''
  downloadPercent.value = Math.round(progressObj.percent || 0)
  downloadedBytes.value = progressObj.transferred || 0
  totalBytes.value = progressObj.total || 0
  downloadSpeed.value = progressObj.bytesPerSecond || 0
}

const handleUpdateDownloaded = async (data) => {
  clearNoProgressTimer()
  requiresManualUpdate.value = false
  console.log('[UpdateIndicator] 下载完成:', data)
  isDownloading.value = false
  isDownloaded.value = true
  downloadError.value = ''

  if (data && typeof data.isMac !== 'undefined') {
    isMac.value = data.isMac
  }

  downloadPercent.value = 100
  if (totalBytes.value > 0) {
    downloadedBytes.value = totalBytes.value
  }

  await noticesPromise

  // 非强制更新：停留在弹窗里，等用户点击"立即重启安装"
  if (!isForceUpdate.value) {
    awaitingInstallConfirm.value = true
    progressDialogVisible.value = true
    return
  }

  // 强制更新：自动触发安装
  setTimeout(() => {
    installUpdate()
  }, 600)
}

// 用户在更新说明弹窗里点击"立即重启安装"
const confirmInstallFromDialog = () => {
  installUpdate()
}

// 显示进度对话框
const showProgressDialog = () => {
  progressDialogVisible.value = true
}

// 开发环境调试安装完成回调
const handleUpdateInstallDevDone = (data) => {
  console.log('[UpdateIndicator] 开发模式更新调试触发完成:', data)
  isInstalling.value = false
  progressDialogVisible.value = false
  installDialogVisible.value = false
  ElMessage.success({
    message: data?.message || '开发调试模式：已完成更新包校验与安装调用，打包后将自动静默安装并重启应用',
    duration: 5000
  })
}

// 处理安装或下载失败
const handleInstallFailed = (data) => {
  clearNoProgressTimer()
  console.log('[UpdateIndicator] 安装或下载失败:', data)
  isDownloading.value = false
  isInstalling.value = false

  if (data?.useManualDownload) {
    installDialogVisible.value = false
    progressDialogVisible.value = false
    ElMessage.warning({
      message: '自动安装失败，已为你切换到手动下载方式',
      duration: 4000
    })
    downloadManually()
  } else {
    downloadError.value = data?.message || '更新包下载或安装失败，请稍后重试'
    progressDialogVisible.value = true
  }
}

// Mac 静默安装进度（下载、解压、替换、重启）
const handleMacSilentInstallProgress = (data) => {
  if (!data) return
  const { phase, percent } = data
  if (phase === 'downloading' && typeof percent === 'number') {
    downloadPercent.value = Math.round(percent)
  } else if (phase === 'extracting') {
    downloadPercent.value = 100
  } else if (phase === 'installing' || phase === 'relaunching') {
    isInstalling.value = true
    progressDialogVisible.value = false
    installDialogVisible.value = false
    ElMessage.success({
      message: phase === 'relaunching' ? '更新安装完成，正在重启应用...' : '正在静默安装新版本...',
      duration: 3000
    })
  }
}

// 安装更新
const installUpdate = () => {
  console.log('[UpdateIndicator] 触发安装更新', { isMac: isMac.value })
  downloadError.value = ''
  isInstalling.value = true

  // 非 Electron 纯网页环境
  if (!(window.electronAPI && window.electronAPI.installUpdate)) {
    isInstalling.value = false
    progressDialogVisible.value = false
    downloadManually()
    return
  }

  try {
    const payload = {
      downloadUrl: getMacDownloadUrl()
    }

    window.electronAPI.installUpdate(payload)

    if (isMac.value) {
      ElMessage.info({
        message: '正在准备安装与重启，请稍候...',
        duration: 2500
      })
    }
  } catch (error) {
    console.error('[UpdateIndicator] installUpdate() 调用失败:', error)
    isInstalling.value = false
    ElMessage.error('自动更新失败，请尝试手动下载安装')
  }
}

const getMacDownloadUrl = () => updateDownloadUrl.value

// 手动下载更新兜底
const downloadManually = async () => {
  const downloadUrl = getMacDownloadUrl()
  if (!downloadUrl) {
    ElMessage.error('暂无可用的下载地址，请稍后重试')
    return
  }
  const arch = downloadUrl.includes('arm64') ? 'arm64' : 'x64'
  installDialogVisible.value = false

  if (window.electronAPI && window.electronAPI.downloadUpdateManually) {
    try {
      isDownloading.value = true
      isDownloaded.value = false
      const progressHandler = (progress) => {
        downloadPercent.value = Math.round(progress.percent || 0)
      }
      const completeHandler = (data) => {
        isDownloading.value = false
        isDownloaded.value = true
        progressDialogVisible.value = false
        ElMessageBox.confirm(
          `文件已保存到: ${data.filePath}`,
          '下载完成',
          {
            confirmButtonText: '在文件夹中显示',
            cancelButtonText: '关闭',
            type: 'success'
          }
        ).then(() => {
          window.electronAPI.showItemInFolder?.(data.filePath)
        }).catch(() => {})
        window.electronAPI.removeUpdateListeners?.()
      }

      window.electronAPI.onDownloadProgressManual?.(progressHandler)
      window.electronAPI.onDownloadCompleteManual?.(completeHandler)

      downloadPercent.value = 0
      progressDialogVisible.value = true

      const result = await window.electronAPI.downloadUpdateManually({
        downloadUrl,
        version: newVersion.value,
        arch
      })

      if (result.canceled) {
        isDownloading.value = false
        isDownloaded.value = true
        progressDialogVisible.value = false
      } else if (!result.success) {
        isDownloading.value = false
        downloadError.value = result.error || '下载失败，请稍后重试'
      }
    } catch (error) {
      isDownloading.value = false
      downloadError.value = '下载失败: ' + error.message
    }
  } else {
    // 浏览器网页端：Mac 下将 .zip 替换为 .dmg 便于新用户直接双击安装
    const browserDownloadUrl = isMac.value && downloadUrl.endsWith('.zip')
      ? downloadUrl.replace(/\.zip$/i, '.dmg')
      : downloadUrl
    window.open(browserDownloadUrl, '_blank')
    ElMessage.success({
      message: '已开始下载安装包，下载完成后请手动安装',
      duration: 4000
    })
  }
}

// 格式化字节
const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0) + ' ' + sizes[i]
}

const getCurrentVersion = () => {
  currentVersion.value = packageJson.version || import.meta.env.VITE_APP_VERSION || '1.0.0'
}

onMounted(() => {
  getCurrentVersion()
  window.addEventListener('desktop-update-available', handleDesktopUpdateEvent)

  if (window.electronAPI) {
    window.electronAPI.onUpdateAvailable(handleUpdateAvailable)
    window.electronAPI.onDownloadProgress(handleDownloadProgress)
    window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded)

    if (window.electronAPI.onUpdateInstallFailed) {
      window.electronAPI.onUpdateInstallFailed(handleInstallFailed)
    }

    if (window.electronAPI.onMacSilentInstallProgress) {
      window.electronAPI.onMacSilentInstallProgress(handleMacSilentInstallProgress)
    }

    if (window.electronAPI.onUpdateInstallDevDone) {
      window.electronAPI.onUpdateInstallDevDone(handleUpdateInstallDevDone)
    }

    if (window.electronAPI.getRuntimeInfo) {
      window.electronAPI.getRuntimeInfo()
        .then((info) => {
          runtimeInfo.value = info
          if (info?.versions?.app) {
            currentVersion.value = info.versions.app
          }
          if (info?.platform === 'darwin') {
            isMac.value = true
          }
        })
        .catch((err) => {
          console.warn('[UpdateIndicator] 获取运行时信息失败:', err)
        })
    }
  }

  const pendingUpdate = getLatestAvailableUpdate()
  if (pendingUpdate) {
    handleUpdateAvailable(pendingUpdate)
  }
})

onUnmounted(() => {
  clearNoProgressTimer()
  window.removeEventListener('desktop-update-available', handleDesktopUpdateEvent)
  if (window.electronAPI?.removeUpdateListeners) {
    window.electronAPI.removeUpdateListeners()
  }
})
</script>

<style lang="scss">
.desktop-update-dialog {
  border-radius: 8px !important;
  overflow: hidden;
  padding: 0 !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14) !important;

  .el-dialog__header {
    position: relative !important;
    padding: 16px 20px !important;
    margin: 0 !important;
    background: #ffffff !important;
    border-bottom: 1px solid #ebeef5;
    box-sizing: border-box !important;
  }

  .el-dialog__headerbtn {
    position: absolute !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    right: 20px !important;
    width: 24px !important;
    height: 24px !important;
    padding: 0 !important;
    margin: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;

    .el-dialog__close {
      font-size: 16px !important;
      color: #909399;
      transition: color 0.2s;

      &:hover {
        color: #606266;
      }
    }
  }

  .el-dialog__body {
    padding: 18px 20px !important;
    background: #ffffff;
  }

  .el-dialog__footer {
    padding: 12px 20px 16px !important;
    background: #ffffff;
    border-top: 1px solid #f2f4f7;
  }
}
</style>

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
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(2px); }
}

@keyframes glow {
  0%, 100% { filter: drop-shadow(0 0 2px #67C23A); }
  50% { filter: drop-shadow(0 0 8px #67C23A); }
}

.update-dialog-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 36px;
  min-height: 24px;
  line-height: 1.5;

  .dialog-main-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  .version-meta {
    font-size: 13px;
    color: #909399;
  }
}

.update-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.update-notes-section {
  .section-label {
    font-size: 13px;
    font-weight: 500;
    color: #606266;
    margin-bottom: 8px;
  }

  .update-notes-card {
    max-height: 240px;
    overflow-y: auto;
    padding: 12px 14px;
    background: #f8f9fb;
    border: 1px solid #ebeef5;
    border-radius: 6px;
    font-size: 14px;
    line-height: 1.75;
    color: #606266;

    .update-notes-title {
      margin-bottom: 6px;
      font-weight: 600;
      color: #303133;
    }

    .update-notes-item + .update-notes-item {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed #ebeef5;
    }

    :deep(p) {
      margin: 6px 0;
    }

    :deep(ul),
    :deep(ol) {
      padding-left: 22px;
      margin: 6px 0;
    }

    :deep(li) {
      margin: 3px 0;
    }

    :deep(h1),
    :deep(h2),
    :deep(h3),
    :deep(h4),
    :deep(h5),
    :deep(h6) {
      margin: 10px 0 6px;
      font-weight: 600;
      color: #303133;
    }

    :deep(strong),
    :deep(b) {
      font-weight: 600;
      color: #303133;
    }

    :deep(code) {
      padding: 2px 5px;
      background-color: #ebedf0;
      border-radius: 3px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
    }

    :deep(pre) {
      padding: 10px 12px;
      background-color: #282c34;
      color: #abb2bf;
      border-radius: 4px;
      overflow-x: auto;
      margin: 6px 0;
    }

    :deep(a) {
      color: #409eff;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    :deep(img) {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 6px 0;
      cursor: zoom-in;
    }
  }
}

.download-progress-section {
  &.is-error {
    .progress-status-text {
      color: #f56c6c;
    }
  }

  .progress-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    gap: 12px;
  }

  .progress-status-text {
    font-size: 13px;
    color: #606266;
  }

  .progress-percent-text {
    font-size: 13px;
    font-weight: 500;
    color: #303133;
    font-variant-numeric: tabular-nums;
  }

  .progress-detail-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 12px;
    color: #909399;
    font-variant-numeric: tabular-nums;
  }
}

.update-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;

  .force-update-tip {
    font-size: 12px;
    color: #909399;
  }
}

.install-content {
  text-align: center;
  padding: 16px 0;

  .success-icon {
    margin-bottom: 14px;
  }

  .install-message {
    font-size: 15px;
    color: #303133;
    margin-bottom: 8px;

    strong {
      color: #409eff;
    }
  }

  .install-tip {
    font-size: 13px;
    color: #909399;
    line-height: 1.6;
  }

  .install-tip-secondary {
    font-size: 12px;
    color: #c0c4cc;
    margin-top: 6px;
  }
}
</style>
