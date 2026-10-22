<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title=""
    width="662px"
    :close-on-click-modal="true"
    :show-close="true"
    top="20vh"
    center
  >
    <div class="create-assign-dialog-content">
      <!-- 标题 -->
      <div class="dialog-title">创建交办:</div>

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
      <div class="datetime-row">
        <el-date-picker
          v-model="formData.deadlineDate"
          type="date"
          placeholder="截止日期"
          format="YYYY/MM/DD"
          value-format="YYYY-MM-DD"
          class="date-picker"
          :prefix-icon="Calendar"
          :disabled-date="disabledDate"
          style="width: calc(50% - 5.5px)"
        />
        <el-time-picker
          v-model="formData.deadlineTime"
          placeholder="截止时间"
          format="HH:mm"
          value-format="HH:mm:ss"
          class="time-picker"
          :prefix-icon="Clock"
          style="width: calc(50% - 5.5px)"
        />
      </div>

      <!-- 选择接办人 -->
      <el-select
        v-model="formData.assigneeId"
        placeholder="选择接办人"
        class="assignee-select"
      >
        <el-option
          v-for="user in userList"
          :key="user.id"
          :label="user.name"
          :value="user.id"
        />
      </el-select>

      <!-- 确定按钮 -->
      <div class="dialog-footer">
        <el-button type="primary" @click="handleConfirm" class="confirm-btn">
          确定
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Calendar, Clock } from '@element-plus/icons-vue'
import ImageUpload from '@/components/ImageUpload/index.vue'
import { memberDictUser } from '@/api/system/user'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

// 表单数据
const formData = ref({
  title: '',
  content: '',
  images: '',
  deadlineDate: '',
  deadlineTime: '',
  assigneeId: ''
})

// 用户列表
const userList = ref([])

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
  if (!formData.value.deadlineDate) {
    ElMessage.warning('请选择截止日期')
    return
  }
  if (!formData.value.deadlineTime) {
    ElMessage.warning('请选择截止时间')
    return
  }
  if (!formData.value.assigneeId) {
    ElMessage.warning('请选择接办人')
    return
  }

  // 验证截止时间不能小于当前时间
  const deadlineDateTime = new Date(`${formData.value.deadlineDate} ${formData.value.deadlineTime}`)
  const now = new Date()
  if (deadlineDateTime <= now) {
    ElMessage.warning('截止时间不能小于当前时间')
    return
  }

  const selectedUser = userList.value.find(u => u.id === formData.value.assigneeId)
  
  emit('confirm', {
    ...formData.value,
    assigneeName: selectedUser?.name,
    deadline: `${formData.value.deadlineDate} ${formData.value.deadlineTime}`
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
    deadlineDate: '',
    deadlineTime: '',
    assigneeId: ''
  }
}

// 监听对话框打开，重置表单
watch(() => props.modelValue, (val) => {
  if (val) {
    resetForm()
  }
})

// 初始化加载用户列表
onMounted(() => {
  fetchUserList()
})
</script>

<style scoped lang="scss">
.create-assign-dialog-content {
  padding: 20px 60px;
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
  margin-bottom: 8px;
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
        width: 38px;
        height: 38px;
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
        width: 38px;
        height: 38px;
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

.dialog-footer {
  display: flex;
  justify-content: center;
  margin-top: 30px;

  .confirm-btn {
    width: 177px;
    height: 39px;
    border-radius: 8px;
    font-size: 16px;
  }
}

// 覆盖 el-dialog 样式
:deep(.el-dialog) {
  border-radius: 8px;
  padding: 40px 0;

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
