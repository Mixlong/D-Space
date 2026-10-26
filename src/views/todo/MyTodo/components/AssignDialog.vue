<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title=""
    width="400px"
    :close-on-click-modal="true"
    :show-close="true"
    center
    top='30vh'  
  >
    <div class="assign-dialog-content">
      <!-- 选择接办人标题 -->
      <div class="assign-title">选择接办人:</div>

      <!-- 人员选择下拉框 -->
      <el-select
        v-model="selectedUser"
        placeholder="请选择接办人"
        class="user-select"
        filterable
        popper-class="assign-user-select-popper"
      >
        <el-option
          v-for="user in userList"
          :key="user.userId"
          :label="user.userName"
          :value="user.userId"
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
import { memberDictUser } from '@/api/system/user'

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

// 选中的用户
const selectedUser = ref('')

// 用户列表数据
const userList = ref([])

// 获取用户列表
const getUserList = async () => {
  try {
    const res = await memberDictUser()
    if (res.code === 200) {
      userList.value = res.data || []
    }
  } catch (error) {
    console.error('获取用户列表失败:', error)
  }
}

// 确认交办
const handleConfirm = () => {
  if (!selectedUser.value) {
    ElMessage.warning('请选择接办人')
    return
  }

  const selectedUserInfo = userList.value.find(u => u.userId === selectedUser.value)
  
  emit('confirm', {
    item: props.todoItem,
    userId: selectedUser.value,
    userName: selectedUserInfo?.userName
  })
  emit('update:modelValue', false)
  
  // 重置表单
  selectedUser.value = ''
}

// 监听对话框打开，重置表单
watch(() => props.modelValue, (val) => {
  if (val) {
    selectedUser.value = ''
  }
})

// 组件挂载时获取用户列表
onMounted(() => {
  getUserList()
})
</script>

<style scoped lang="scss">
.assign-dialog-content{
  padding:15px 40px;
}
.assign-title {
  font-size: 18px;
  color: #333333;
  margin-bottom: 20px;
  font-weight: 400;
}

.user-select {
  width: 100%;
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
    color: #6c747c;
    height: 35px;
    line-height: 35px;

    &::placeholder {
      color: #aeaeae;
    }
  }

  :deep(.el-input__prefix) {
    display: flex;
    align-items: center;
  }

  :deep(.el-input__suffix) {
    display: flex;
    align-items: center;
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
    width: 108px;
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

<style lang="scss">
.assign-user-select-popper {
  border-radius: 8px;
  box-shadow: 0px 2px 10px 0px rgba(0, 0, 0, 0.25);
  border: none;
  margin-top: 4px !important;

  .el-select-dropdown__item {
    font-size: 14px;
    color: #6c747c;
    height: 29px;
    line-height: 29px;
    padding: 0 10px;

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
