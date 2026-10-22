<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title=""
    width="1089px"
    :close-on-click-modal="true"
    :show-close="true"
    center
  >
    <div class="handle-dialog-content">
      <!-- 任务标题 -->
      <div class="task-title">{{ todoItem?.title || '软件释放' }}:</div>

      <!-- 项目描述文本框 -->
      <el-input
        v-model="description"
        type="textarea"
        :rows="8"
        placeholder="项目描述..."
        class="description-input"
        readonly
      />

      <!-- 图片上传区域 -->
      <div class="upload-area">
        <ImageUpload
          v-model="imageUrls"
          :limit="20"
          :file-size="50"
          :is-show-tip="false"
          :drag="true"
        />
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
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ImageUpload from '@/components/ImageUpload/index.vue'

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

// 描述文本
const description = ref('')
// 图片URL字符串（逗号分隔）
const imageUrls = ref('')

// 确认办理
const handleConfirm = () => {
  emit('confirm', {
    item: props.todoItem,
    description: description.value,
    images: imageUrls.value
  })
  emit('update:modelValue', false)
  
  // 重置表单
  description.value = ''
  imageUrls.value = ''
}

// 监听对话框打开，初始化数据
watch(() => props.modelValue, (val) => {
  if (val && props.todoItem) {
    description.value = props.todoItem.description || '请输入项目描述'
    imageUrls.value = props.todoItem.images || ''
  }
})
</script>

<style scoped lang="scss">
.handle-dialog-content {
  padding: 20px 60px;
}

.task-title {
  font-size: 18px;
  color: #333333;
  margin-bottom: 20px;
  font-weight: 400;
}

.description-input {
  margin-bottom: 12px;

  :deep(.el-textarea__inner) {
    background: #f2f3f5;
    border: none;
    border-radius: 8px;
    padding: 13px;
    font-size: 12px;
    color: #8c8c8c;
    line-height: 1.5;
    resize: none;
  }
}

.upload-area {
  margin-bottom: 30px;

  :deep(.component-upload-image) {
    .el-upload-list {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .el-upload--picture-card {
      width: 218px;
      height: 218px;
      background: #f2f3f5;
      border: 1px solid #c0c0c0;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        border-color: #2e74ff;
      }

      .el-icon {
        font-size: 28px;
        color: #8c8c8c;
      }
    }

    .el-upload-list__item {
      width: 218px;
      height: 218px;
      border: 1px solid #c0c0c0;
      border-radius: 8px;
      margin: 0;
      padding: 0;
    }

    .el-upload-list__item-thumbnail {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .el-upload-list__item-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .el-upload__tip {
      display: none;
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: center;
  margin-top: 20px;

  .confirm-btn {
    width: 177px;
    height: 39px;
    background: #2e74ff;
    border-radius: 8px;
    font-size: 16px;
    border: none;

    &:hover,
    &:focus {
      background: #5a8dff;
    }

    &:active {
      background: #1e5edf;
    }
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
</style>
