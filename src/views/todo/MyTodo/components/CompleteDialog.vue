<template>
  <el-dialog
    v-model="visible"
    width="434px"
    :show-close="false"
    :close-on-click-modal="true"
    :close-on-press-escape="false"
    class="complete-dialog dialog-scroll"
    @closed="handleClosed"
  >
    <div class="dialog-content">
      <h3 class="dialog-title">该任务是否已完成？</h3>
      <el-input
        v-model="completionNote"
        type="textarea"
        :rows="4"
        show-word-limit
        placeholder="请输入完成说明（选填）"
        class="remark-input"
      />
      <div class="dialog-actions">
        <el-button class="cancel-btn" @click="handleCancel">
          取消
        </el-button>
        <el-button class="confirm-btn" type="primary" @click="handleConfirm" :loading="loading">
          确定
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  todoItem: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const visible = ref(false)
const completionNote = ref('')
const loading = ref(false)

// 监听外部传入的显示状态
watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) {
    // 打开弹窗时重置输入
    completionNote.value = ''
    loading.value = false
  }
})

// 监听内部状态变化
watch(visible, (val) => {
  emit('update:modelValue', val)
})

const handleCancel = () => {
  if (loading.value) return
  visible.value = false
}

const handleConfirm = () => {
  if (loading.value) return
  
  // 验证任务信息
  if (!props.todoItem || !props.todoItem.id) {
    ElMessage.warning('任务信息不完整')
    return
  }
  
  loading.value = true
  
  // 触发确认事件，传递完成说明
  emit('confirm', {
    item: props.todoItem,
    completionNote: completionNote.value.trim() // 传入完成说明
  })
  
  // 关闭弹窗（由父组件在接口调用成功后处理）
  setTimeout(() => {
    loading.value = false
    visible.value = false
  }, 300)
}

const handleClosed = () => {
  completionNote.value = ''
  loading.value = false
}
</script>

<style lang="scss" scoped>
.complete-dialog {
  :deep(.el-dialog) {
    border-radius: 8px;
    
    .el-dialog__header {
      display: none;
    }
    
    .el-dialog__body {
      padding: 0;
    }
  }
  
  .dialog-content {
    padding: 0px 0 26px;
    display: flex;
    flex-direction: column;
    align-items: center;
    
    .dialog-title {
      font-size: 20px;
      font-weight: 600;
      color: #333333;
      margin: 0 0 24px 0;
      text-align: center;
    }
    
    .dialog-subtitle {
      font-size: 14px;
      color: #6c747c;
      margin: 0 0 24px 0;
      text-align: center;
    }
    
    .remark-input {
      width: 340px;
      margin-bottom: 32px;
      
      :deep(.el-textarea__inner) {
        background: #f5f7fa;
        border: 1px solid #dcdfe6;
        border-radius: 6px;
        padding: 10px 12px;
        font-size: 14px;
        color: #394047;
        line-height: 1.6;
        resize: none;
        min-height: 80px;
        transition: all 0.2s;
        
        &::placeholder {
          color: #a8abb2;
        }
        
        &:hover {
          border-color: #c0c4cc;
        }
        
        &:focus {
          background: #ffffff;
          border-color: var(--el-color-primary);
        }
      }
      
      :deep(.el-input__count) {
        background: transparent;
        font-size: 12px;
        color: #909399;
      }
    }
    
    .dialog-actions {
      display: flex;
      gap: 55px;
      
      .cancel-btn,
      .confirm-btn {
        width: 106px;
        height: 39px;
        border-radius: 8px;
        font-size: 16px;
        border: none;
      }
      
      .cancel-btn {
        background: #f2f3f5;
        color: #394047;
        
        &:hover {
          background: #e8e9eb;
        }
      }
      
      .confirm-btn {
        background: #2e74ff;
        color: #ffffff;
        
        &:hover {
          background: #5a8fff;
        }
      }
    }
  }
}
</style>

