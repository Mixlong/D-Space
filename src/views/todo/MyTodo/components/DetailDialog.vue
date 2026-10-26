<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title=""
    width="50vw"
    :close-on-click-modal="true"
    :show-close="true"
    top="0vh"
    center
    class="dialog-scroll"
  >
    <div class="detail-dialog-content">
      <!-- 任务标题 -->
      <div class="task-title">{{ todoItem?.assignmentTitle || todoItem?.title || '待办详情' }}</div>
      
      <!-- 任务信息栏 -->
      <div class="task-info-bar">
        <!-- 交办人信息 -->
        <div class="info-item" v-if="todoItem?.assignor">
          <span class="info-label">交办人：</span>
          <span class="info-value assignor-name">{{ todoItem.assignor }}</span>
        </div>
        
        <!-- 创建时间 -->
        <div class="info-item" v-if="todoItem?.createTime">
          <span class="info-label">创建时间：</span>
          <span class="info-value">{{ formatTime(todoItem.createTime) }}</span>
        </div>
        
        <!-- 截止时间 -->
        <div class="info-item" v-if="todoItem?.deadline || todoItem?.dueDate">
          <span class="info-label">截止时间：</span>
          <span :class="['info-value', 'deadline-time', getDeadlineClass(todoItem)]">{{ formatTime(todoItem.deadline || todoItem.dueDate) }}</span>
        </div>
        
        <!-- 完成时间 -->
        <div class="info-item" v-if="todoItem?.finishTime">
          <span class="info-label">完成时间：</span>
          <span class="info-value finish-time">{{ formatTime(todoItem.finishTime) }}</span>
        </div>
        
        <!-- 任务状态 -->
        <div class="info-item">
          <span class="info-label">任务状态：</span>
          <el-tag :type="getStatusTagType(todoItem?.status)" size="small">
            {{ todoItem?.statusName || getStatusText(todoItem?.status) }}
          </el-tag>
        </div>
      </div>
      
      <!-- 任务状态和交办信息 -->
      <div v-if="todoItem?.status === -1 || todoItem?.status === '-1'" class="assign-info">
        <el-tag type="warning" size="large">
          <el-icon><UserFilled /></el-icon>
          已交办给：{{ todoItem?.nextAssignee || '未知用户' }}
        </el-tag>
      </div>

      <!-- 外部链接区域 -->
      <div v-if="todoItem?.assignmentUrl" class="external-link-section">
        <div class="link-header">
          <div class="link-label">相关链接</div>
          <el-tag size="small" type="info" effect="light">可跳转</el-tag>
        </div>
        <div class="link-card">
          <div class="link-url">
            <a 
              href="javascript:void(0)"
              @click="handleOpenInNewWindow"
              class="external-link"
            >
              {{ builtLink }}
            </a>
          </div>
        </div>
      </div>

      <!-- 项目描述 -->
      <div class="task-description" v-html="description">
      </div>

      <!-- 图片展示区域 -->
      <div class="images-grid">
        <div 
          v-for="(image, index) in displayImages" 
          :key="index"
          class="image-item"
          @click="handleImageClick(image, index)"
        >
          <img :src="image" alt="任务图片" />
        </div>
        <!-- 如果有更多图片，显示 +N -->
        <div 
          v-if="imageList.length > 4"
          class="image-item more-images-item"
          @click="handleImageClick(imageList[3], 3)"
        >
          <img :src="imageList[3]" alt="任务图片" />
          <div class="more-images-overlay">
            +{{ imageList.length - 4 }}
          </div>
        </div>
      </div>

      <!-- 钟加乐反馈列表 -->
      <!-- <div class="feedback-grid">
        <div 
          v-for="(feedback, index) in feedbackList" 
          :key="index"
          class="feedback-item"
          @click="handleFeedbackClick(feedback)"
        >
          <div class="feedback-header">
            <span class="feedback-label">钟加乐:</span>
            <span :class="['feedback-status', feedback.statusClass]">
              {{ feedback.status }}
            </span>
          </div>
          <div class="feedback-content">
            {{ feedback.content }}
          </div>
        </div>
      </div> -->
    </div>

    <!-- 图片预览 -->
    <el-image-viewer
      v-if="imageViewerVisible"
      :url-list="imageList"
      :initial-index="currentImageIndex"
      @close="closeImageViewer"
    />

    <!-- 反馈详情对话框 -->
    <el-dialog
      v-model="feedbackDetailVisible"
      title=""
      width="800px"
      :close-on-click-modal="true"
      :show-close="true"
      append-to-body
      top="10vh"
      center
    >
      <div class="feedback-detail-content">
        <div class="detail-header">
          <span class="detail-label">钟加乐:</span>
          <span :class="['detail-status', currentFeedback?.statusClass]">
            {{ currentFeedback?.status }}
          </span>
        </div>
        <div class="detail-description">
          {{ currentFeedback?.content }}
        </div>
        
        <!-- 功能清单表格 -->
        <div class="detail-table-title">1.4功能清单</div>
        <el-table 
          :data="currentFeedback?.tableData || []" 
          border
          style="width: 100%"
          class="detail-table"
        >
          <el-table-column prop="module" label="模块" width="100" />
          <el-table-column prop="function" label="功能点" width="120" />
          <el-table-column prop="description" label="功能描述" min-width="200" />
          <el-table-column prop="priority" label="优先级" width="80" align="center" />
        </el-table>
      </div>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { UserFilled, Link, Monitor, CopyDocument } from '@element-plus/icons-vue'
import { buildUrlWithToken } from '@/utils/linkOpener'
import { getBusinessLinkRouteLocation, getIssueTrackingIdFromItem } from '@/utils/issueTracking'
import { ElMessage } from 'element-plus'
import useUserStore from '@/store/modules/user'
import useCloudNavigatorStore from '@/store/modules/cloudNavigator'

const router = useRouter()
const userStore = useUserStore()
const cloudNavigatorStore = useCloudNavigatorStore()
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  todoItem: {
    type: Object,
    default: () => null
  }
})

const emit = defineEmits(['update:modelValue'])

// 描述文本
const description = ref('')

// 图片列表
const imageList = ref([])

// 显示的图片（最多显示3张，第4张用于显示更多）
const displayImages = computed(() => {
  return imageList.value.slice(0, 3)
})

// 反馈列表（操作记录）
const feedbackList = ref([])

// 图片查看器
const imageViewerVisible = ref(false)
const currentImage = ref('')
const currentImageIndex = ref(0)

// 点击图片
const handleImageClick = (image, index) => {
  currentImageIndex.value = index
  imageViewerVisible.value = true
  
  // 下一帧添加遮罩层点击事件
  nextTick(() => {
    const mask = document.querySelector('.el-image-viewer__mask')
    if (mask) {
      mask.style.cursor = 'pointer'
      mask.addEventListener('click', closeImageViewer)
    }
  })
}

// 关闭图片查看器
const closeImageViewer = () => {
  imageViewerVisible.value = false
  // 移除事件监听
  const mask = document.querySelector('.el-image-viewer__mask')
  if (mask) {
    mask.removeEventListener('click', closeImageViewer)
  }
}

// 反馈详情对话框
const feedbackDetailVisible = ref(false)
const currentFeedback = ref(null)

// 点击反馈项
const handleFeedbackClick = (feedback) => {
  currentFeedback.value = feedback
  feedbackDetailVisible.value = true
}

// 构建带token的跳转URL（用于实际跳转）
const buildJumpUrl = () => {
  const baseUrl = props.todoItem?.assignmentUrl || ''
  if (!baseUrl) return ''
  return buildUrlWithToken(baseUrl, userStore.token, {
    paramName: 'ddsToken',
    stripBearer: false
  })
}

// 显示的链接（不包含token，用于页面展示）
const builtLink = computed(() => props.todoItem?.assignmentUrl || '')

// 处理打开链接 - 跳转到迪太云管理页面
const handleOpenExternalLink = () => {
  const url = props.todoItem?.assignmentUrl
  if (!url) return
  const builtUrl = buildJumpUrl()
  cloudNavigatorStore.setTarget({
    url,
    builtUrl,
    token: userStore.token
  })
  router.push(getBusinessLinkRouteLocation(url, {
    id: getIssueTrackingIdFromItem(props.todoItem)
  }))
}

// 处理在新窗口中打开链接 - 同样跳转到迪太云管理页面
const handleOpenInNewWindow = () => {
  handleOpenExternalLink()
}

// 复制链接
const handleCopyLink = async () => {
  const url = buildJumpUrl()
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('复制成功')
  } catch (error) {
    console.error('复制链接失败:', error)
    ElMessage.error('复制失败，请手动复制')
  }
}

// 基础URL
const baseUrl = import.meta.env.VITE_APP_BASE_API

// 处理图片URL
const processImageUrl = (imgPath) => {
  if (!imgPath) return ''
  if (imgPath.startsWith('http')) {
    return imgPath
  } else {
    return baseUrl + imgPath
  }
}

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    '-2': '已拒绝',
    '-1': '已交办',
    '0': '待处理',
    '1': '进行中',
    '2': '已完成'
  }
  return statusMap[String(status)] || '未知状态'
}

// 获取状态标签类型
const getStatusTagType = (status) => {
  const typeMap = {
    '-2': 'danger',    // 已拒绝 - 红色
    '-1': 'warning',   // 已交办 - 橙色
    '0': 'info',       // 待处理 - 灰色
    '1': 'primary',    // 进行中 - 蓝色
    '2': 'success'     // 已完成 - 绿色
  }
  return typeMap[String(status)] || 'info'
}

// 获取截止时间的颜色类（根据剩余时间）
const getDeadlineClass = (item) => {
  // 已完成的任务显示灰色
  if (item?.status === 2) {
    return 'deadline-completed'
  }
  
  const deadline = item?.deadline || item?.dueDate
  if (!deadline) return ''
  
  const now = new Date()
  const deadlineDate = new Date(deadline)
  const diff = deadlineDate - now
  
  // 已超时：红色
  if (diff <= 0) {
    return 'deadline-expired'
  }
  
  // 计算剩余天数
  const days = diff / (24 * 60 * 60 * 1000)
  
  // ≥2天：绿色
  if (days >= 2) {
    return 'deadline-safe'
  }
  // 1-2天：橙色
  else if (days >= 1) {
    return 'deadline-warning'
  }
  // ≤1天：红色
  else {
    return 'deadline-urgent'
  }
}

// 监听对话框打开，初始化数据
watch(() => props.modelValue, (val) => {
  if (val && props.todoItem) {
    // 更新描述
    description.value = props.todoItem.assignmentContent || props.todoItem.content || '暂无内容描述'
    
    // 更新图片列表
    if (props.todoItem.assignmentImgs) {
      const imgs = props.todoItem.assignmentImgs.split(',').filter(img => img.trim())
      imageList.value = imgs.map(img => processImageUrl(img))
    } else {
      imageList.value = []
    }
    
    // TODO: 从API获取反馈列表（操作记录）
    // 这里需要调用操作记录接口来获取反馈数据
  }
})
</script>

<style scoped lang="scss">
.detail-dialog-content {
  padding: 30px 40px;
  max-height: 70vh;
  overflow-y: auto;
}

.task-title {
  font-size: 18px;
  color: #333333;
  margin-bottom: 16px;
  font-weight: 400;
}

.task-info-bar {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.info-label {
  color: #606266;
  font-weight: 500;
  white-space: nowrap;
}

.info-value {
  color: #303133;
  
  &.assignor-name {
    color: #409eff;
    font-weight: 500;
  }
  
  &.finish-time {
    color: #67c23a;
    font-weight: 500;
  }
  
  &.deadline-time {
    font-weight: 500;
    
    &.deadline-safe {
      color: #00bc16; // 绿色：≥2天
    }
    
    &.deadline-warning {
      color: #f2b900; // 橙色：1-2天
    }
    
    &.deadline-urgent {
      color: #ff5959; // 红色：≤1天
    }
    
    &.deadline-expired {
      color: #ff5959; // 红色：已超时
    }
    
    &.deadline-completed {
      color: #9f9f9f; // 灰色：已完成
    }
  }
}

.assign-info {
  margin-bottom: 16px;
  
  .el-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    font-size: 14px;
    
    .el-icon {
      font-size: 16px;
    }
  }
}

.external-link-section {
  margin-bottom: 16px;
  padding: 16px;
  background: #f7fbff;
  border: 1px solid #e5f1ff;
  border-radius: 10px;
  
  .link-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  
  .link-label {
    font-size: 13px;
    color: #1f2d3d;
    font-weight: 600;
  }
  
  .link-card {
    background: #ffffff;
    border: 1px dashed #d4e6ff;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .link-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  .external-link-btn {
    flex-shrink: 0;
    
    .el-icon {
      margin-right: 4px;
    }
  }
  
  .link-url {
    font-size: 12px;
    color: #4a68a0;
    word-break: break-all;
    line-height: 1.5;
    min-height: 18px;
    
    &.empty {
      color: #c0c4cc;
    }
    
    .external-link {
      color: #2e74ff;
      text-decoration: none;
      cursor: pointer;
      transition: color 0.2s ease;
      
      &:hover {
        color: #1a5ad9;
        text-decoration: underline;
      }
    }
  }
}

.task-description {
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.6;
  margin-bottom: 20px;
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.image-item {
  position: relative;
  width: 100%;
  padding-bottom: 100%;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid #e4e4e4;
  transition: all 0.3s;

  &:hover {
    border-color: #2e74ff;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(46, 116, 255, 0.2);
  }

  img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

}

.more-images-item {
  position: relative;
  
  .more-images-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    color: #ffffff;
    font-weight: bold;
  }
}

.feedback-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.feedback-item {
  background: #f9f9f9;
  border-radius: 4px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    background: #f0f0f0;
    transform: translateY(-2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.feedback-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.feedback-label {
  font-size: 14px;
  color: #333333;
  font-weight: 400;
}

.feedback-status {
  font-size: 14px;
  font-weight: 400;
  
  &.status-complete {
    color: #00bc16;
  }
  
  &.status-reject {
    color: #ff5959;
  }
  
  &.status-delay {
    color: #f2b900;
  }
  
  &.status-processing {
    color: #2e74ff;
  }
}

.feedback-content {
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.5;
}

// 反馈详情对话框样式
.feedback-detail-content {
  padding: 20px 30px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-label {
  font-size: 14px;
  color: #333333;
  font-weight: 400;
}

.detail-status {
  font-size: 14px;
  font-weight: 400;
  
  &.status-complete {
    color: #00bc16;
  }
  
  &.status-reject {
    color: #ff5959;
  }
  
  &.status-delay {
    color: #f2b900;
  }
  
  &.status-processing {
    color: #2e74ff;
  }
}

.detail-description {
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.5;
  margin-bottom: 20px;
  background: #f9f9f9;
  padding: 12px;
  border-radius: 4px;
}

.detail-table-title {
  font-size: 16px;
  color: #333333;
  font-weight: 500;
  margin-bottom: 12px;
}

.detail-table {
  :deep(.el-table__header-wrapper) {
    .el-table__header {
      th {
        background: #2e74ff;
        color: #ffffff;
        font-size: 14px;
        font-weight: 400;
        padding: 12px 0;
        text-align: center;
      }
    }
  }

  :deep(.el-table__body-wrapper) {
    .el-table__body {
      td {
        padding: 10px 8px;
        font-size: 12px;
        color: #333333;
      }
    }
    
    .el-table__row {
      &:nth-child(even) {
        background: #f5f7fa;
      }
    }
  }
}

// 覆盖 el-dialog 样式
:deep(.el-dialog) {
  border-radius: 8px;

  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    padding: 0;
  }

  .el-dialog__close {
    font-size: 24px;
    color: #999;
    top: 16px;
    right: 16px;

    &:hover {
      color: #333;
    }
  }
}

// 滚动条样式
.detail-dialog-content::-webkit-scrollbar {
  width: 6px;
}

.detail-dialog-content::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 3px;
}

.detail-dialog-content::-webkit-scrollbar-thumb {
  background: #d9d9d9;
  border-radius: 3px;
  
  &:hover {
    background: #bfbfbf;
  }
}
</style>
