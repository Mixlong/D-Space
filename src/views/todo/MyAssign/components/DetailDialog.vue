<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="todoItem?.title || '软件释放'"
    width="900px"
    :close-on-click-modal="true"
    :show-close="true"
    top="0vh"
    center
    class="dialog-scroll"
  >

    <div class="detail-dialog-content">
      <!-- 任务信息栏 -->
      <div class="task-info-bar">
        <!-- 交办人信息（当前用户就是交办人） -->
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
        
        <!-- 完成时间（取todoList中最晚的完成时间） -->
        <div class="info-item" v-if="latestFinishTime">
          <span class="info-label">完成时间：</span>
          <span class="info-value finish-time">{{ formatTime(latestFinishTime) }}</span>
        </div>
        
        <!-- 待办人数量 -->
        <div class="info-item" v-if="todoItem?.todoList && todoItem.todoList.length > 0">
          <span class="info-label">待办人数：</span>
          <span class="info-value">{{ todoItem.todoList.length }} 人</span>
        </div>
      </div>

      <!-- 项目描述 -->
      <div class="task-description">
        {{ description }}
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

      <!-- 闹钟提醒信息 -->
      <div class="reminder-section" v-if="reminderList.length > 0">
        <div class="section-title">
          <el-icon><Bell /></el-icon>
          <span>闹钟提醒</span>
          <span class="reminder-count">（{{ reminderList.length }}）</span>
        </div>
        <div class="reminder-list">
          <div 
            v-for="(reminder, index) in reminderList" 
            :key="reminder.id || index"
            class="reminder-card"
          >
            <div class="reminder-header">
              <span class="reminder-name">{{ reminder.reminderName }}</span>
              <el-tag 
                :type="reminder.enabled === 1 ? 'success' : 'info'" 
                size="small"
              >
                {{ reminder.enabled === 1 ? '已启用' : '已禁用' }}
              </el-tag>
            </div>
            <div class="reminder-info">
              <div class="reminder-info-item">
                <span class="label">提醒类型：</span>
                <span class="value">{{ reminder.reminderType === 1 ? '周期性提醒' : '一次性提醒' }}</span>
              </div>
              <div class="reminder-info-item">
                <span class="label">提醒时间：</span>
                <span class="value">{{ reminder.reminderTime }}</span>
              </div>
              <div class="reminder-info-item" v-if="reminder.reminderType === 1">
                <span class="label">重复：</span>
                <span class="value">{{ formatWeekdays(reminder.reminderWeekdays) }}</span>
              </div>
              <div class="reminder-info-item" v-if="reminder.reminderType === 2">
                <span class="label">提醒日期：</span>
                <span class="value">{{ reminder.reminderOnceDate }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 待办人反馈列表 -->
      <div class="feedback-grid" v-if="feedbackList.length > 0">
        <div 
          v-for="(feedback, index) in feedbackList" 
          :key="index"
          class="feedback-item"
          @click="handleFeedbackClick(feedback)"
        >
          <div class="feedback-header">
            <span class="feedback-label">{{ feedback.assignee || '待办人' }}:</span>
            <div class="feedback-header-right">
              <span :class="['feedback-status', feedback.statusClass]">
                {{ feedback.status }}
              </span>
              <!-- 撤销按钮（仅在从撤销入口进入时显示） -->
              <el-button 
                v-if="showRevoke"
                size="small" 
                class="revoke-btn"
                @click.stop="handleRevokeTodo(feedback)"
              >
                撤销
              </el-button>
            </div>
          </div>
          <div class="feedback-content">
            {{ feedback.content }}
          </div>
          <!-- 完成时间 -->
          <div class="feedback-finish-time" v-if="feedback.finishTime">
            <el-icon><Clock /></el-icon>
            <span>{{ formatTime(feedback.finishTime) }}</span>
          </div>
        </div>
      </div>
      
      <!-- 暂无反馈 -->
      <div v-else class="no-feedback">
        暂无待办人反馈
      </div>
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
      top="0vh"
      class=“dialog-scroll”
      center
    >
      <div class="feedback-detail-content">
        <div class="detail-header">
          <span class="detail-label">{{ currentFeedback?.assignee || '待办人' }}:</span>
          <span :class="['detail-status', currentFeedback?.statusClass]">
            {{ currentFeedback?.status }}
          </span>
        </div>
        <div class="detail-description">
          {{ currentFeedback?.content }}
        </div>
 
 
      </div>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bell, Clock } from '@element-plus/icons-vue'
import { batchDeleteTodo } from '@/api/todo'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  todoItem: {
    type: Object,
    default: () => null
  },
  showRevoke: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'revoke-success'])

// 描述文本
const description = ref('')

// 闹钟列表
const reminderList = ref([])

// 图片列表
const imageList = ref([])

// 基础URL
const baseUrl = import.meta.env.VITE_APP_BASE_API

// 显示的图片（最多显示3张，第4张用于显示更多）
const displayImages = computed(() => {
  return imageList.value.slice(0, 3)
})

// 获取最晚的完成时间（从todoList中）
const latestFinishTime = computed(() => {
  if (!props.todoItem?.todoList || props.todoItem.todoList.length === 0) {
    return null
  }
  // 过滤出有完成时间的记录
  const finishTimes = props.todoItem.todoList
    .filter(todo => todo.finishTime)
    .map(todo => new Date(todo.finishTime).getTime())
  
  if (finishTimes.length === 0) return null
  
  // 返回最晚的完成时间
  const latestTime = Math.max(...finishTimes)
  return new Date(latestTime).toISOString()
})

// 反馈列表（从 API 获取，不使用测试数据）
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

// 格式化星期几
const formatWeekdays = (weekdays) => {
  if (!weekdays) return ''
  const weekMap = {
    '1': '周一',
    '2': '周二',
    '3': '周三',
    '4': '周四',
    '5': '周五',
    '6': '周六',
    '7': '周日'
  }
  return weekdays.split(',').map(day => weekMap[day] || day).join('、')
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

// 撤销待办
const handleRevokeTodo = async (feedback) => {
  try {
    await ElMessageBox.confirm(
      `确定要撤销「${feedback.assignee}」的待办吗？撤销后该用户将无法看到此交办。`,
      '撤销确认',
      {
        confirmButtonText: '确定撤销',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 调用批量删除待办接口（body传入待办ID数组，query传入用户昵称）
    if (feedback.id && feedback.assignee) {
      await batchDeleteTodo([feedback.id], feedback.assignee)
      ElMessage.success('撤销成功')
      
      // 通知父组件刷新列表（不关闭对话框）
      emit('revoke-success')
      
      // 从本地列表中移除已撤销的待办人
      const index = feedbackList.value.findIndex(item => item.id === feedback.id)
      if (index !== -1) {
        feedbackList.value.splice(index, 1)
      }
    } else {
      ElMessage.error('无法获取待办 ID')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('撤销待办失败:', error)
    }
  }
}

// 监听对话框打开，初始化数据
watch(() => props.modelValue, (val) => {
  if (val && props.todoItem) {
    // 设置描述内容
    description.value = props.todoItem.content || '暂无内容描述'
    
    // 处理图片列表
    if (props.todoItem.imgs) {
      // imgs 是逗号分隔的字符串，需要转换为数组
      const imgPaths = props.todoItem.imgs.split(',').filter(img => img.trim())
      imageList.value = imgPaths.map(path => {
        // 如果路径不是完整URL，添加baseUrl
        if (path.startsWith('http')) {
          return path
        } else {
          return baseUrl + path
        }
      })
    } else {
      imageList.value = []
    }
    
    // 处理闹钟列表
    if (props.todoItem.reminderList && props.todoItem.reminderList.length > 0) {
      reminderList.value = props.todoItem.reminderList
    } else {
      reminderList.value = []
    }
    
    // 处理待办人反馈列表（从 todoList 获取）
    if (props.todoItem.todoList && props.todoItem.todoList.length > 0) {
      feedbackList.value = props.todoItem.todoList.map(todo => {
        // 根据状态映射状态文本和样式类
        let status = '待处理'
        let statusClass = 'status-processing'
        
        switch (todo.status) {
          case -2:
            status = '已拒绝'
            statusClass = 'status-reject'
            break
          case -1:
            status = '已交办'
            statusClass = 'status-delay'
            break
          case 0:
            status = '待处理'
            statusClass = 'status-processing'
            break
          case 1:
            status = '进行中'
            statusClass = 'status-processing'
            break
          case 2:
            status = '已完成'
            statusClass = 'status-complete'
            break
        }
        
        return {
          id: todo.id,  // 添加待办ID，用于撤销操作
          status,
          statusClass,
          content: todo.completionNote || todo.rejectReason || '暂无说明',
          assignee: todo.assignee,
          finishTime: todo.finishTime,  // 添加完成时间
          todoData: todo
        }
      })
    } else {
      feedbackList.value = []
    }
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
    border-color: var(--el-color-primary);
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

.no-feedback {
  text-align: center;
  padding: 40px 0;
  color: #8c8c8c;
  font-size: 14px;
}

.feedback-item {
  background: #f5f7fa;
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
  justify-content: space-between;
  margin-bottom: 8px;
}

.feedback-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .revoke-btn {
    font-size: 12px;
    padding: 4px 12px;
    height: 24px;
    border-radius: 12px;
    background: transparent;
    border: 1px solid #f2b900;
    color: #f2b900;
    
    &:hover {
      background: #f2b900;
      border-color: #f2b900;
      color: #ffffff;
    }
  }
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
    color: var(--el-color-primary);
  }
}

.feedback-content {
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.5;
}

.feedback-finish-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #67c23a;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e4e7ed;
  
  .el-icon {
    font-size: 14px;
  }
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
    color: var(--el-color-primary);
  }
}

.detail-description {
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.5;
  margin-bottom: 20px;
  background: #f5f7fa;
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
        background: var(--el-color-primary);
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

// 闹钟提醒区域样式
.reminder-section {
  margin: 20px 0;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  
  .el-icon {
    font-size: 18px;
    color: #409eff;
  }
  
  .reminder-count {
    color: #409eff;
    font-size: 14px;
  }
}

.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reminder-card {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  transition: all 0.3s;
  
  &:hover {
    border-color: #c0c4cc;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }
}

.reminder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f2f5;
}

.reminder-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.reminder-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reminder-info-item {
  display: flex;
  font-size: 13px;
  
  .label {
    color: #909399;
    min-width: 80px;
  }
  
  .value {
    color: #606266;
    font-weight: 500;
  }
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
