<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="延期提醒"
    width="50vw"
    :close-on-click-modal="true"
    :show-close="true"
    top="0vh"
    class="dialog-scroll"
    center
  >
    <div class="delay-reminder-dialog-content">
      <!-- 延期记录表格 -->
      <el-table 
        :data="delayRecords" 
        style="width: 100%"
        class="delay-table"
        border
       max-height="600px"
      >
        <el-table-column 
          prop="description" 
          label="延期记录"
        />
        <el-table-column 
          label="操作" 
          width="150"
          align="center"
        >
          <template #default="{ row }">
            <el-button 
              text 
              class="action-btn reject-btn" 
              @click="handleReject(row)"
            >
              拒绝
            </el-button>
            <el-button 
              text 
              class="action-btn approve-btn" 
              @click="handleApprove(row)"
            >
              同意
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getExtensionList } from '@/api/todo'

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

const emit = defineEmits(['update:modelValue', 'reject', 'approve'])

// 延期记录列表
const delayRecords = ref([])

// 加载延期记录
const loadExtensionRecords = async () => {
  if (!props.todoItem || !props.todoItem.id) return
  
  try {
    const res = await getExtensionList({
      assignmentId: props.todoItem.id,
      applyState: 1  // 1=申请中
    })
    
    if (res.code === 200) {
      // 转换数据格式
      delayRecords.value = res.data.list.map(item => ({
        id: item.id,
        description: `${item.todoTitle || '待办'} ${item.originalDueDate} 申请延期至 ${item.newDueDate}`,
        originalDueDate: item.originalDueDate,
        newDueDate: item.newDueDate,
        extensionReason: item.extensionReason,
        applyTime: item.applyTime,
        todoId: item.todoId,
        todoTitle: item.todoTitle
      }))
    }
  } catch (error) {
    console.error('获取延期记录失败:', error)
  }
}

// 拒绝延期
const handleReject = async (record) => {
  // 发出拒绝事件给父组件处理
  emit('reject', { item: props.todoItem, record })
  
  // 等待一小段时间让父组件处理完成
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // 重新加载延期记录列表
  await loadExtensionRecords()
}

// 同意延期
const handleApprove = async (record) => {
  // 发出同意事件给父组件处理
  emit('approve', { item: props.todoItem, record })
  
  // 等待一小段时间让父组件处理完成
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // 重新加载延期记录列表
  await loadExtensionRecords()
}

// 监听对话框打开，加载延期记录
watch(() => props.modelValue, (val) => {
  if (val && props.todoItem) {
    loadExtensionRecords()  // 加载真实的延期记录数据
  }
})
</script>

<style scoped lang="scss">
.delay-reminder-dialog-content {
  padding: 0;
}

.delay-table {
  :deep(.el-table__header-wrapper) {
    .el-table__header {
      th {
        background: #f9f9f9;
        color: #333333;
        font-size: 16px;
        font-weight: 400;
        padding: 16px 0;
        border-bottom: 1px solid #e4e4e4;
      }
    }
  }

  :deep(.el-table__body-wrapper) {
    .el-table__body {
      td {
        padding: 16px 0;
        font-size: 14px;
        color: #333333;
        border-bottom: 1px solid #f0f0f0;
      }
    }
  }

  :deep(.el-table__row:last-child) {
    td {
      border-bottom: none;
    }
  }
}

.action-btn {
  font-size: 14px;
  padding: 0;
  height: auto;
  font-weight: 400;
  margin: 0 10px;
  
  &.reject-btn {
    color: #ff5959;
    
    &:hover {
      color: #ff7979;
    }
    
    &:active {
      color: #ff3939;
    }
  }
  
  &.approve-btn {
    color: #2e74ff;
    
    &:hover {
      color: #5a8dff;
    }
    
    &:active {
      color: #1e5edf;
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

// 滚动条样式
.delay-list::-webkit-scrollbar {
  width: 6px;
}

.delay-list::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 3px;
}

.delay-list::-webkit-scrollbar-thumb {
  background: #d9d9d9;
  border-radius: 3px;
  
  &:hover {
    background: #bfbfbf;
  }
}
</style>
