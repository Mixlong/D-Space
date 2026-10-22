<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title=""
    width="600px"
    :close-on-click-modal="true"
    :show-close="true"
    center
    class="dialog-scroll"
  >
    <div class="delay-dialog-content">
      <!-- 原计划时间 -->
      <div class="original-time">
        原计划时间：{{ formatDateTime(todoItem?.deadline) }}
      </div>

      <!-- 延期至标题 -->
      <div class="delay-title">改期至：</div>

      <!-- 快捷选项 -->
      <div class="quick-options">
        <el-radio-group v-model="delayType" @change="handleDelayTypeChange">
          <el-radio label="1hour" class="radio-item">
            <span class="radio-text">1小时后</span>
          </el-radio>
          <el-radio label="3hours" class="radio-item">
            <span class="radio-text">3小时后</span>
          </el-radio>
          <el-radio label="1day" class="radio-item">
            <span class="radio-text">1天后</span>
          </el-radio>
          <el-radio label="custom" class="radio-item">
            <el-date-picker
              v-model="customDateTime"
              type="datetime"
              placeholder="请选择时间"
              format="YY/MM/DD HH:mm"
              value-format="YYYY-MM-DD HH:mm:ss"
              :disabled-date="disabledDate"
              :clearable="false"
              style="width:410px"
              class="custom-date-picker"
              placement="top"
              @focus="handleCustomDateFocus"
            />
          </el-radio>
        </el-radio-group>
      </div>

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
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'

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

const emit = defineEmits(['update:modelValue', 'confirm'])

// 延期类型
const delayType = ref('1hour')
// 自定义日期时间
const customDateTime = ref('')

// 格式化日期时间
const formatDateTime = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const year = String(date.getFullYear()).slice(-2)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}/${month}/${day} ${hours}:${minutes}`
}

// 计算延期后的时间
const getDelayedDateTime = () => {
  // 基于原计划时间计算延期时间
  if (!props.todoItem?.deadline) {
    ElMessage.warning('无法获取原计划时间')
    return null
  }
  
  let delayedDate = new Date(props.todoItem.deadline)

  switch (delayType.value) {
    case '1hour':
      delayedDate.setHours(delayedDate.getHours() + 1)
      break
    case '3hours':
      delayedDate.setHours(delayedDate.getHours() + 3)
      break
    case '1day':
      delayedDate.setDate(delayedDate.getDate() + 1)
      break
    case 'custom':
      if (!customDateTime.value) {
        ElMessage.warning('请选择自定义时间')
        return null
      }
      return customDateTime.value
  }

  // 格式化为 YYYY-MM-DD HH:mm:ss
  const year = delayedDate.getFullYear()
  const month = String(delayedDate.getMonth() + 1).padStart(2, '0')
  const day = String(delayedDate.getDate()).padStart(2, '0')
  const hours = String(delayedDate.getHours()).padStart(2, '0')
  const minutes = String(delayedDate.getMinutes()).padStart(2, '0')
  const seconds = String(delayedDate.getSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// 禁用原计划时间之前的日期
const disabledDate = (time) => {
  if (!props.todoItem?.deadline) {
    // 如果没有原计划时间，则禁用今天之前的日期
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return time.getTime() < today.getTime()
  }
  
  // 获取原计划时间，并设置为当天的开始时间（00:00:00）
  const originalDate = new Date(props.todoItem.deadline)
  originalDate.setHours(0, 0, 0, 0)
  
  // 禁用原计划日期之前的所有日期
  return time.getTime() < originalDate.getTime()
}

// 处理延期类型变化
const handleDelayTypeChange = (value) => {
  if (value !== 'custom') {
    customDateTime.value = ''
  }
}

// 处理自定义日期选择器聚焦
const handleCustomDateFocus = () => {
  delayType.value = 'custom'
}

// 确认延期
const handleConfirm = () => {
  const delayedDateTime = getDelayedDateTime()
  if (!delayedDateTime) return

  emit('confirm', {
    item: props.todoItem,
    delayedDateTime,
    delayType: delayType.value
  })
  emit('update:modelValue', false)
  
  // 重置表单
  delayType.value = '1hour'
  customDateTime.value = ''
}

// 监听对话框打开，重置表单
watch(() => props.modelValue, (val) => {
  if (val) {
    delayType.value = '1hour'
    customDateTime.value = ''
  }
})
</script>

<style scoped lang="scss">
.delay-dialog-content {
  padding: 15px 60px;
}

.original-time {
  background: #f2f3f5;
  padding: 10px;
  border-radius: 8px;
  font-size: 16px;
  color: #6c747c;
  margin-bottom: 30px;
  text-align: center;
}

.delay-title {
  font-size: 18px;
  color: #333333;
  margin-bottom: 20px;
  font-weight: 400;
}

.quick-options {
  margin-bottom: 30px;

  :deep(.el-radio-group) {
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .radio-item {
    display: flex;
    align-items: center;
    height: 35px;

    :deep(.el-radio__input) {
      .el-radio__inner {
        width: 12px;
        height: 12px;
        background: #edf1fa;
        border: none;

        &::after {
          width: 6px;
          height: 6px;
          background: #2e74ff;
        }
      }

      &.is-checked .el-radio__inner {
        background: #2e74ff;
        border-color: #2e74ff;

        &::after {
          background: white;
        }
      }
    }

    :deep(.el-radio__label) {
      padding-left: 7px;
    }

    .radio-text {
      font-size: 16px;
      color: #6c747c;
    }
  }

  .custom-date-picker {
    width: 100%;

    :deep(.el-input__wrapper) {
      border: 1px solid #e4e4e4;
      border-radius: 8px;
      padding: 0 11px;
      box-shadow: none;

      &:hover,
      &.is-focus {
        border-color: #2e74ff;
      }
    }

    :deep(.el-input__inner) {
      font-size: 16px;
      color: #6c747c;

      &::placeholder {
        color: #aeaeae;
      }
    }

    :deep(.el-input__prefix) {
      font-size: 22px;
      color: #6c747c;
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: center;
  margin-top: 30px;

  .confirm-btn {
    width: 127px;
    height: 39px;
    border-radius: 8px;
    font-size: 16px;
    // 使用 Element Plus 主题色，不需要自定义背景色
  }
}

// 覆盖 el-dialog 样式
:deep(.el-dialog) {
  border-radius: 8px;
  padding: 40px 126px;

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
</style>
