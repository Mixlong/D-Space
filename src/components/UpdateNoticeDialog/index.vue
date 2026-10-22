<template>
  <el-dialog
    v-model="dialogVisible"
    :title="(currentNotice?.noticeTitle || '版本') + '更新说明'"
    width="600px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="currentIndex === totalNotices - 1"
    center
  >
    <div v-if="currentNotice" class="update-notice-content">
      
      <div ref="noticeBodyRef" class="notice-body" v-html="currentNotice.noticeContent"></div>
      
    </div>

    <template #footer>
      <div class="dialog-footer">
    
      </div>
    </template>
  </el-dialog>
  
  <!-- 图片预览 -->
  <el-image-viewer
    v-if="showImageViewer"
    :url-list="previewImages"
    :initial-index="currentImageIndex"
    @close="showImageViewer = false"
  />
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { ElMessage, ElImageViewer } from 'element-plus'
import { listNotice } from '@/api/system/notice'
import useUserStore from '@/store/modules/user'
import packageJson from '../../../package.json'

const userStore = useUserStore()
const dialogVisible = ref(false)
const notices = ref([])
const currentIndex = ref(0)
const currentNotice = computed(() => notices.value[currentIndex.value])
const totalNotices = computed(() => notices.value.length)
const hasChecked = ref(false)

// 图片预览相关
const noticeBodyRef = ref(null)
const showImageViewer = ref(false)
const previewImages = ref([])
const currentImageIndex = ref(0)

// 先声明所有函数
const fetchUpdateNotices = async (version) => {
  console.log('🔔 [更新通知] fetchUpdateNotices 被调用，version:', version)
  try {
    console.log('🔔 [更新通知] 尝试精确匹配版本号，查询参数:', {
      pageNum: 1,
      pageSize: 50,
      noticeTitle: packageJson.version,
      noticeType: '1'
    })
    console.log('🔔 [更新通知] 准备调用 listNotice API...')
    
    // 先尝试简单查询 - 获取所有通知类型为1的数据
    let response = await listNotice({
      pageNum: 1,
      pageSize: 50,
      noticeType: '1'
    }).catch(err => {
      console.error('🔔 [更新通知] listNotice API 调用失败:', err)
      return { code: -1, rows: [], msg: err.message }
    })
    
    console.log('🔔 [更新通知] listNotice API 调用完成')
    console.log('🔔 [更新通知] 响应:', response)
    console.log('🔔 [更新通知] 响应code:', response?.code)
    console.log('🔔 [更新通知] 响应rows:', response?.rows)
    console.log('🔔 [更新通知] rows长度:', response?.rows?.length)
    
    // 从所有通知中筛选出匹配当前版本的
    if (response.code === 200 && response.rows) {
      console.log('🔔 [更新通知] 开始筛选版本号匹配的通知...')
      const filteredNotices = response.rows.filter(notice => {
        const match = notice.noticeTitle && notice.noticeTitle.includes(version)
        console.log('🔔 [更新通知] 检查通知:', notice.noticeTitle, '是否包含版本', version, '结果:', match)
        return match
      })
      console.log('🔔 [更新通知] 筛选结果，找到', filteredNotices.length, '条匹配的通知')
      response.rows = filteredNotices
    }
    
    console.log('🔔 [更新通知] 准备判断：code===200?', response.code === 200, 'rows存在?', !!response.rows, 'rows长度>0?', response.rows?.length > 0)
    
    if (response.code === 200 && response.rows && response.rows.length > 0) {
      notices.value = response.rows.sort((a, b) => 
        new Date(b.createTime) - new Date(a.createTime)
      )
      
      console.log('✅ [更新通知] 找到版本', version, '的更新说明，共', notices.value.length, '条')
      currentIndex.value = 0
      dialogVisible.value = true
      
      // 等待 DOM 更新后，给图片添加点击事件
      nextTick(() => {
        setupImagePreview()
      })
      
      return true
    } else {
      console.log('❌ [更新通知] 未找到版本', version, '的更新说明')
      console.log('🔔 [更新通知] 未找到原因 - code:', response.code, 'rows:', response.rows, 'length:', response.rows?.length)
      return false
    }
  } catch (error) {
    console.error('🔔 [更新通知] fetchUpdateNotices 错误:', error)
    return false
  }
}

const checkAndShowUpdateNotice = async (forceCheck = false) => {
  console.log('🔔 [更新通知] checkAndShowUpdateNotice 被调用，forceCheck:', forceCheck)
  
  if (!userStore.token) {
    console.log('🔔 [更新通知] 用户未登录，跳过检查')
    return
  }

  const today = new Date().toDateString()
  const lastCheckDate = localStorage.getItem('last_update_check_date')
  const currentVersion = packageJson.version
  const lastShownVersion = localStorage.getItem('last_update_notice_version')
  const versionChanged = currentVersion !== lastShownVersion

  console.log('[更新通知] 当前版本:', currentVersion, '上次弹出版本:', lastShownVersion, 'versionChanged:', versionChanged)

  try {
    // 如果版本已经弹出过，且不是强制检查，直接跳过
    if (!forceCheck && !versionChanged) {
      console.log('🔔 [更新通知] 版本', currentVersion, '已经弹出过，跳过检查')
      hasChecked.value = true
      return
    }

    // 版本有变化或强制检查，获取更新通知
    console.log('🔔 [更新通知] 开始获取更新通知...')
    const success = await fetchUpdateNotices(currentVersion)
    console.log('🔔 [更新通知] fetchUpdateNotices 返回结果:', success)
    
    if (success) {
      // 只有成功弹出通知后，才记录这个版本
      localStorage.setItem('last_update_notice_version', currentVersion)
      localStorage.setItem('last_update_check_date', today)
      console.log('✅ [更新通知] 已更新最后弹出版本为', currentVersion)
    } else {
      console.log('❌ [更新通知] 未获取到更新通知或获取失败')
    }
    
    hasChecked.value = true
  } catch (error) {
    console.error('[更新通知] 检查更新失败:', error)
  }
}

const manualCheck = async (version, forceCheck = true) => {
  if (!userStore.token) {
    console.log('🔔 [更新通知] 手动检查失败：用户未登录')
    ElMessage.warning('请先登录后再检查更新')
    return
  }
  
  if (forceCheck) {
    await checkAndShowUpdateNotice(true)
  } else {
    await fetchUpdateNotices(version || packageJson.version)
  }
}

const resetCheckStatus = () => {
  localStorage.removeItem('last_update_notice_version')
  localStorage.removeItem('last_update_check_date')
  hasChecked.value = false
  console.log('[更新通知] 已重置检查状态')
}

const forceCheck = async () => {
  if (!userStore.token) {
    console.log('🔔 [更新通知] 强制检查失败：用户未登录')
    ElMessage.warning('请先登录后再检查更新')
    return
  }
  
  console.log('[更新通知] 强制检查更新...')
  await checkAndShowUpdateNotice(true)
}

const prevNotice = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

const nextNotice = () => {
  if (currentIndex.value < totalNotices.value - 1) {
    currentIndex.value++
  }
}

const closeDialog = () => {
  dialogVisible.value = false
  currentIndex.value = 0
  notices.value = []
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 设置图片预览
const setupImagePreview = () => {
  if (!noticeBodyRef.value) return
  
  const images = noticeBodyRef.value.querySelectorAll('img')
  if (images.length === 0) return
  
  // 收集所有图片的 src
  const imageSrcs = Array.from(images).map(img => img.src)
  
  // 给每个图片添加点击事件
  images.forEach((img, index) => {
    img.style.cursor = 'pointer'
    img.onclick = () => {
      previewImages.value = imageSrcs
      currentImageIndex.value = index
      showImageViewer.value = true
    }
  })
  
  console.log('📸 [更新通知] 已为', images.length, '张图片添加预览功能')
}

// 监听当前通知变化，重新设置图片预览
watch(currentNotice, () => {
  nextTick(() => {
    setupImagePreview()
  })
})

// 组件挂载时检查更新
onMounted(() => {
  console.log('🔔🔔🔔 [更新通知] 组件已挂载！！！')
  
  window.updateNoticeDialogInstance = {
    forceCheck,
    resetCheckStatus,
    manualCheck,
    checkAndShowUpdateNotice,
    fetchUpdateNotices
  }
  
  console.log('🔔 [更新通知] 用户登录状态:', !!userStore.token)
  console.log('🔔 [更新通知] localStorage 状态:', {
    lastShownVersion: localStorage.getItem('last_update_notice_version'),
    lastCheckDate: localStorage.getItem('last_update_check_date'),
    today: new Date().toDateString()
  })
})

watch(
  () => userStore.token,
  (newToken, oldToken) => {
    if (newToken && !oldToken) {
      console.log('🔔 [更新通知] 检测到用户刚登录，检查更新...')
      checkAndShowUpdateNotice()
    }
  },
  { immediate: true }
)

defineExpose({
  manualCheck,
  resetCheckStatus,
  forceCheck
})
</script>

<style scoped lang="scss">
.update-notice-content {
  max-height: 70vh;
  overflow: auto;
  
  .notice-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
 
    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }

  .notice-body {
    min-height: 100px;
    max-height: 400px;
    overflow-y: auto;
    padding: 16px;
    background-color: #f5f7fa;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.8;
    color: #606266;

    :deep(p) {
      margin: 8px 0;
    }

    :deep(ul), :deep(ol) {
      padding-left: 24px;
      margin: 8px 0;
    }

    :deep(li) {
      margin: 4px 0;
    }

    :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
      margin: 12px 0 8px;
      font-weight: 600;
    }

    :deep(strong), :deep(b) {
      font-weight: 600;
      color: #303133;
    }

    :deep(code) {
      padding: 2px 6px;
      background-color: #e6e8eb;
      border-radius: 3px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
    }

    :deep(pre) {
      padding: 12px;
      background-color: #282c34;
      color: #abb2bf;
      border-radius: 4px;
      overflow-x: auto;
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
      margin: 8px 0;
      cursor: pointer;
      transition: transform 0.2s;
      
      &:hover {
        transform: scale(1.02);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
    }
  }

  .notice-footer {
    margin-top: 16px;
    text-align: right;

    .notice-time {
      font-size: 12px;
      color: #909399;
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
