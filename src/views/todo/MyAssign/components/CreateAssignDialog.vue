<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="editItem ? '修改交办:' : '创建交办:'"
    width="662px"
    :close-on-click-modal="true"
    :show-close="true"
    top="0vh"
    center
    class="create-assign-dialog dialog-scroll"
  >
    <div class="create-assign-dialog-wrapper">
      <!-- 可滚动内容区 -->
      <div class="dialog-content-scrollable">

      <!-- 事项名称 -->
      <el-input
        v-model="formData.title"
        placeholder="事项名称"
        class="form-input"
      />

      <!-- 事项内容 -->
      <div class="content-area">
        <el-input
          v-model="formData.content"
          type="textarea"
          :rows="3"
          placeholder="事项内容"
          class="content-textarea"
          :autosize="{ minRows: 3, maxRows: 5 }"
        />
        
        <!-- 图片上传 -->
        <div class="image-upload-mini">
          <ImageUpload
            v-model="formData.images"
            :limit="10"
            :file-size="50"
            :is-show-tip="false"
            :drag="false"
          />
        </div>
      </div>

      <!-- 截止日期和时间 -->
      <el-date-picker
        v-model="formData.deadline"
        type="datetime"
        placeholder="选择截止日期和时间"
        format="YYYY/MM/DD HH:mm"
        value-format="YYYY-MM-DD HH:mm:ss"
        class="deadline-picker"
        :prefix-icon="Calendar"
        placement='top'
        style="width: 100%;margin-bottom:12px;"
        :disabled-date="disabledDate"
      />

      <!-- 选择接办人 -->
      <el-select
        ref="assigneeSelectRef"
        v-model="formData.assigneeNames"
        placeholder="选择接办人"
        class="assignee-select"
        multiple
        filterable
        @change="handleAssigneeChange"
      >
        <el-option
          v-for="user in userList"
          :key="user.id"
          :label="user.name"
          :value="user.name"
        />
      </el-select>

      <!-- 闹钟设置（可折叠） -->
      <el-collapse v-model="activeCollapse" class="reminder-collapse">
        <el-collapse-item name="reminder">
          <template #title>
            <div class="collapse-title">
              <el-icon><Bell /></el-icon>
              <span>闹钟提醒</span>
              <span class="reminder-count" v-if="formData.reminderList.length > 0">
                （{{ formData.reminderList.length }}）
              </span>
            </div>
          </template>
          <ReminderSetting v-model="formData.reminderList" />
        </el-collapse-item>
      </el-collapse>
      
      </div>
      <!-- 结束可滚动内容区 -->
    </div>
    
    <!-- 使用 el-dialog 的 footer 插槽 -->
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="handleConfirm" class="confirm-btn">
          {{ editItem ? '保存修改' : '确定' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Calendar, Clock, Bell } from '@element-plus/icons-vue'
import ImageUpload from '@/components/ImageUpload/index.vue'
import ReminderSetting from './ReminderSetting.vue'
import { memberDictUser } from '@/api/system/user'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  editItem: {
    type: Object,
    default: null
  },
  preSelectedUsers: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

// 折叠面板激活项
const activeCollapse = ref([])

// 表单数据
const formData = ref({
  title: '',
  content: '',
  images: '',
  deadline: '',  // 合并后的日期时间
  assigneeNames: [],  // 用户名数组
  reminderList: []  // 闹钟列表
})

// 用户列表
const userList = ref([])

// 选择器引用
const assigneeSelectRef = ref(null)

// 原始接办人列表（编辑模式下不能删除）
const originalAssignees = ref([])

// 处理接办人选择变化
const handleAssigneeChange = (newValue) => {
  // 在编辑模式下，防止删除原有接办人
  if (props.editItem && originalAssignees.value.length > 0) {
    // 检查是否有原有接办人被删除
    const missingAssignees = originalAssignees.value.filter(name => !newValue.includes(name))
    
    if (missingAssignees.length > 0) {
      // 恢复被删除的原有接办人
      formData.value.assigneeNames = [...new Set([...originalAssignees.value, ...newValue])]
      ElMessage.warning('原有接办人不能删除，只能新增')
    }
  }
  
  // 清除搜索文字
  if (assigneeSelectRef.value) {
    // 使用 nextTick 确保在 DOM 更新后执行
    setTimeout(() => {
      const inputElement = assigneeSelectRef.value.$el.querySelector('input')
      if (inputElement) {
        inputElement.value = ''
      }
      // 同时清除 el-select 内部的查询字符串
      if (assigneeSelectRef.value.query) {
        assigneeSelectRef.value.query = ''
      }
    }, 0)
  }
}

// 获取用户列表
const fetchUserList = async () => {
  try {
    const res = await memberDictUser()
    if (res.code === 200) {
      userList.value = res.data.map(user => ({
        id: user.dictValue,
        name: user.dictLabel,
        roleKey: user.roleKey
      }))
    }
  } catch (error) {
    console.error('获取用户列表失败:', error)
  }
}

// 禁用今天之前的日期
const disabledDate = (time) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return time.getTime() < today.getTime()
}

// 确认创建
const handleConfirm = () => {
  // 验证必填项
  if (!formData.value.title) {
    ElMessage.warning('请输入事项名称')
    return
  }
  if (!formData.value.content) {
    ElMessage.warning('请输入事项内容')
    return
  }
  if (!formData.value.deadline) {
    ElMessage.warning('请选择截止日期和时间')
    return
  }
  if (!formData.value.assigneeNames || formData.value.assigneeNames.length === 0) {
    ElMessage.warning('请选择接办人')
    return
  }

  // 验证截止时间不能小于当前时间
  const deadlineDateTime = new Date(formData.value.deadline)
  const now = new Date()
  if (deadlineDateTime <= now) {
    ElMessage.warning('截止时间不能小于当前时间')
    return
  }

  // 验证闹钟数据
  const invalidReminders = []
  const validReminderList = formData.value.reminderList.filter((reminder, index) => {
    const errors = []
    
    // 必填项：闹钟名称、提醒时间
    if (!reminder.reminderName || !reminder.reminderName.trim()) {
      errors.push('缺少闹钟名称')
    }
    if (!reminder.reminderTime) {
      errors.push('缺少提醒时间')
    }
    
    // 周期性提醒：必须选择星期几
    if (reminder.reminderType === 1) {
      if (!reminder.reminderWeekdays || reminder.reminderWeekdays.trim() === '') {
        errors.push('缺少星期几')
      }
    }
    
    // 一次性提醒：必须选择日期
    if (reminder.reminderType === 2) {
      if (!reminder.reminderOnceDate) {
        errors.push('缺少提醒日期')
      }
    }
    
    if (errors.length > 0) {
      invalidReminders.push({
        index: index + 1,
        errors: errors
      })
      return false
    }
    
    return true
  })

  // 如果有不完整的闹钟，提示用户
  if (invalidReminders.length > 0) {
    const errorList = invalidReminders.map(item => 
      `<li>闹钟 ${item.index}：${item.errors.join('、')}</li>`
    ).join('')
    
    ElMessageBox.alert(
      `<div style="max-height: 300px; overflow-y: auto;">
        <p style="margin-bottom: 10px;">以下闹钟信息不完整，请补充完整后再提交：</p>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
          ${errorList}
        </ul>
      </div>`,
      '闹钟信息不完整',
      {
        dangerouslyUseHTMLString: true,
        confirmButtonText: '知道了',
        type: 'warning'
      }
    )
    return
  }

  console.log('[CreateAssignDialog] 原始闹钟数量:', formData.value.reminderList.length)
  console.log('[CreateAssignDialog] 有效闹钟数量:', validReminderList.length)

  // 后端需要的是数组格式：["用户A", "用户B"]
  console.log("🚀 ~ assigneeList (数组):", formData.value.assigneeNames)
  
  emit('confirm', {
    ...formData.value,
    assigneeList: formData.value.assigneeNames,  // 直接传数组
    reminderList: validReminderList,  // 只传递有效的闹钟
    // deadline 已经在 formData 中，格式为 "YYYY-MM-DD HH:mm:ss"
    isEdit: !!props.editItem  // 标记是否为编辑模式
  })
  emit('update:modelValue', false)
  
  // 重置表单
  resetForm()
}

// 重置表单
const resetForm = () => {
  formData.value = {
    title: '',
    content: '',
    images: '',
    deadline: '',
    assigneeNames: [],  // 重置为空数组
    reminderList: []  // 重置闹钟列表
  }
  originalAssignees.value = []  // 清空原始接办人
  activeCollapse.value = []  // 关闭折叠面板
}

// 监听对话框打开，加载数据
watch(() => props.modelValue, (val) => {
  if (val) {
    if (props.editItem) {
      // 编辑模式：填充数据
      loadEditData()
    } else {
      // 创建模式：重置表单并预填接办人
      resetForm()
      if (props.preSelectedUsers.length > 0) {
        formData.value.assigneeNames = [...props.preSelectedUsers]
      }
    }
  }
})

// 加载编辑数据
const loadEditData = () => {
  if (!props.editItem) return
  
  const item = props.editItem
  console.log("🚀 ~ file: CreateAssignDialog.vue:290 ~ item:", item)
  
  // 解析截止时间为 "YYYY-MM-DD HH:mm:ss" 格式
  let deadline = ''
  if (item.dueDate) {
    const dateTime = new Date(item.dueDate)
    const year = dateTime.getFullYear()
    const month = String(dateTime.getMonth() + 1).padStart(2, '0')
    const day = String(dateTime.getDate()).padStart(2, '0')
    const hours = String(dateTime.getHours()).padStart(2, '0')
    const minutes = String(dateTime.getMinutes()).padStart(2, '0')
    const seconds = String(dateTime.getSeconds()).padStart(2, '0')
    
    deadline = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }
  
  // 从 todoList 获取接办人名称（直接用名称，不转ID）
  let assigneeNames = []
  if (item.todoList && Array.isArray(item.todoList)) {
    assigneeNames = item.todoList.map(todo => todo.assignee || todo.todoUser).filter(name => name)
  }
  
  console.log('[CreateAssignDialog] 接办人名称:', assigneeNames)
  console.log('[CreateAssignDialog] 截止时间:', deadline)
  
  console.log('[CreateAssignDialog] 原始 reminderList:', item.reminderList)
  
  formData.value = {
    id: item.id,
    title: item.title || '',
    content: item.content || '',
    images: item.imgs || '',
    url: item.url || '',
    deadline: deadline,  // 合并后的日期时间
    assigneeNames: assigneeNames,  // 直接用名称数组
    reminderList: item.reminderList || []  // 加载闹钟列表
  }
  
  console.log('[CreateAssignDialog] formData.reminderList:', formData.value.reminderList)
  
  // 保存原始接办人列表（编辑模式下不能删除）
  originalAssignees.value = [...assigneeNames]
  
  // 如果有闹钟数据，自动展开折叠面板
  if (item.reminderList && item.reminderList.length > 0) {
    activeCollapse.value = ['reminder']
  }
}

// 初始化加载用户列表
onMounted(() => {
  fetchUserList()
})
</script>

<style scoped lang="scss">
// 对话框包装器 - 使用flex布局
.create-assign-dialog-wrapper {
  display: flex;
  flex-direction: column;}

// 固定头部
.dialog-header-fixed {
  flex-shrink: 0;  // 不收缩
  padding: 20px 60px 0 60px;
  background: #fff;
  border-bottom: 1px solid #f0f2f5;
}

// 可滚动内容区
.dialog-content-scrollable {
  flex: 1;  // 占据剩余空间
  overflow-y: auto;  // 垂直滚动
  padding: 0px 20px;
  
  // 美化滚动条
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #dcdfe6;
    border-radius: 3px;
    
    &:hover {
      background: #c0c4cc;
    }
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

 

.dialog-title {
  font-size: 18px;
  color: #333333;
  margin-bottom: 20px;
  font-weight: 400;
}

.form-input {
  margin-bottom: 8px;

  :deep(.el-input__wrapper) {
    border: 1px solid #e4e4e4;
    border-radius: 8px;
    padding: 0 11px;
    box-shadow: none;
    height: 35px;

    &:hover,
    &.is-focus {
      border-color: #2e74ff;
    }
  }

  :deep(.el-input__inner) {
    font-size: 16px;
    color: #333;

    &::placeholder {
      color: #aeaeae;
    }
  }
}

.content-area {
  border: 1px solid #e4e4e4;
  border-radius: 8px;
  padding: 9px 11px;
  margin-bottom: 12px;
  transition: border-color 0.2s;
  display: flex;
  flex-direction: column;

  &:hover {
    border-color: #c0c0c0;
  }

  &:focus-within {
    border-color: #2e74ff;
  }

  .content-textarea {
    margin-bottom: 8px;

    :deep(.el-textarea__inner) {
      border: none;
      padding: 0;
      font-size: 16px;
      color: #333;
      box-shadow: none;
      resize: none;

      &::placeholder {
        color: #aeaeae;
      }

      &:focus {
        box-shadow: none;
        outline: none;
      }
    }
  }

  .image-upload-mini {
    :deep(.component-upload-image) {
      .el-upload-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .el-upload--picture-card {
        width: 58px;
        height: 58px;
        background: transparent;
        border: 1px dashed #d7d7d7;
        border-radius: 2px;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          border-color: #2e74ff;
        }

        .el-icon {
          font-size: 14px;
          color: #999;
        }
      }

      .el-upload-list__item {
        width: 58px;
        height: 58px;
        border: none;
        border-radius: 2px;
        margin: 0;
        padding: 0;
      }

      .el-upload-list__item-thumbnail {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .el-upload__tip {
        display: none;
      }
    }
  }
}

.deadline-picker {
  width: 100%;
  margin-bottom: 16px;
}

.datetime-row {
  display: flex;
  gap: 11px;
  margin-bottom: 8px;

  .date-picker {
    flex: 1;

    :deep(.el-input__wrapper) {
      border: 1px solid #e4e4e4;
      border-radius: 8px;
      padding: 0 11px;
      box-shadow: none;
      height: 35px;

      &:hover,
      &.is-focus {
        border-color: #2e74ff;
      }
    }

    :deep(.el-input__inner) {
      font-size: 16px;
      color: #333;

      &::placeholder {
        color: #aeaeae;
      }
    }

    :deep(.el-input__prefix) {
      display: flex;
      align-items: center;

      .el-icon {
        font-size: 22px;
        color: #6c747c;
      }
    }
  }

  .time-picker {
    flex: 1;

    :deep(.el-input__wrapper) {
      border: 1px solid #e4e4e4;
      border-radius: 8px;
      padding: 0 11px;
      box-shadow: none;
      height: 35px;

      &:hover,
      &.is-focus {
        border-color: #2e74ff;
      }
    }

    :deep(.el-input__inner) {
      font-size: 16px;
      color: #333;

      &::placeholder {
        color: #aeaeae;
      }
    }

    :deep(.el-input__prefix) {
      display: flex;
      align-items: center;
      margin-right: 5px;

      .el-icon {
        font-size: 22px;
        color: #6c747c;
      }
    }

    :deep(.el-input__suffix) {
      display: none;
    }
  }
}

.assignee-select {
  width: 100%;
  margin-bottom: 20px;

  :deep(.el-input__wrapper) {
    border: 1px solid #e4e4e4;
    border-radius: 8px;
    padding: 0 11px;
    box-shadow: none;
    height: 35px;

    &:hover,
    &.is-focus {
      border-color: #2e74ff;
    }
  }

  :deep(.el-input__inner) {
    font-size: 16px;
    color: #333;

    &::placeholder {
      color: #aeaeae;
    }
  }

  :deep(.el-input__prefix) {
    display: flex;
    align-items: center;

    .el-icon {
      font-size: 20px;
      color: #6c747c;
    }
  }

  :deep(.el-select__caret) {
    color: #6c747c;
    font-size: 14px;
  }
}

.reminder-collapse {
  margin: 12px 0 20px 0;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;

  :deep(.el-collapse-item__header) {
    height: 44px;
    line-height: 44px;
    background: #fafafa;
    border: none;
    padding: 0 16px;
    font-size: 14px;
    color: #303133;
    transition: all 0.3s;

    &:hover {
      background: #f5f7fa;
    }

    .el-collapse-item__arrow {
      color: #909399;
      transition: transform 0.3s;
    }

    &.is-active {
      background: #f5f7fa;
      border-bottom: 1px solid #e4e7ed;
    }
  }

  :deep(.el-collapse-item__wrap) {
    border: none;
    background: #ffffff;
  }

  :deep(.el-collapse-item__content) {
    padding: 16px;
  }

  .collapse-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;

    .el-icon {
      font-size: 18px;
      color: #409eff;
    }

    .reminder-count {
      color: #409eff;
      font-weight: 600;
      font-size: 13px;
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
    max-height: 70vh;
    overflow: hidden;
  }

  .el-dialog__footer {
    padding: 0;
    border-top: 1px solid #f0f2f5;
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

// 下拉选项样式
:deep(.el-select-dropdown) {
  .el-select-dropdown__item {
    font-size: 14px;
    color: #6c747c;

    &.hover,
    &:hover {
      background: #f5f5f5;
    }

    &.selected {
      background: #e1ecfd;
      color: #6c747c;
      font-weight: normal;
    }
  }
}
</style>
