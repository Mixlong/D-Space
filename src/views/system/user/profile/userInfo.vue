<template>
   <el-form ref="userRef" :model="form" :rules="rules" label-width="96px" status-icon>
      <el-form-item label="用户昵称" prop="nickName">
         <el-input v-model="form.nickName" maxlength="30" />
      </el-form-item>
      <el-form-item label="手机号码" prop="phonenumber">
         <el-input v-model="form.phonenumber" maxlength="11" />
      </el-form-item>
      <el-form-item label="邮箱" prop="email">
         <el-input v-model="form.email" maxlength="50" />
      </el-form-item>
      <el-form-item label="性别">
         <el-radio-group v-model="form.sex">
            <el-radio value="0">男</el-radio>
            <el-radio value="1">女</el-radio>
         </el-radio-group>
      </el-form-item>
      <el-form-item class="form-actions-item">
         <el-button type="primary" class="btn-submit" @click="submit">保存修改</el-button>
         <el-button class="btn-close" @click="close">取消</el-button>
      </el-form-item>
   </el-form>
</template>

<script setup>
import { updateUserProfile } from "@/api/system/user"

const props = defineProps({
  user: {
    type: Object
  }
})

const { proxy } = getCurrentInstance()

const form = ref({})
const rules = ref({
  nickName: [{ required: true, message: "用户昵称不能为空", trigger: "blur" }],
  email: [{ required: true, message: "邮箱地址不能为空", trigger: "blur" }, { type: "email", message: "请输入正确的邮箱地址", trigger: ["blur", "change"] }],
  phonenumber: [{ required: true, message: "手机号码不能为空", trigger: "blur" }, { pattern: /^1[3|4|5|6|7|8|9][0-9]\d{8}$/, message: "请输入正确的手机号码", trigger: "blur" }],
})

/** 提交按钮 */
function submit() {
  proxy.$refs.userRef.validate(valid => {
    if (valid) {
      updateUserProfile({...props.user, ...form.value}).then(response => {
        proxy.$modal.msgSuccess("修改成功")
        props.user.phonenumber = form.value.phonenumber
        props.user.email = form.value.email
      })
    }
  })
}

/** 取消按钮 */
function close() {
  proxy.$tab.closePage()
}

// 回显当前登录用户信息
watch(() => props.user, user => {
  if (user) {
    form.value = { nickName: user.nickName, phonenumber: user.phonenumber, email: user.email, sex: user.sex }
  }
},{ immediate: true })
</script>

<style lang="scss" scoped>
/* 表单容器与项 */
.el-form {
  width: 560px;
  max-width: 100%;
  padding: 0;
}

:deep(.el-form-item) {
  margin-bottom: 16px;
  
  .el-form-item__label {
    justify-content: flex-start;
    font-weight: 500;
    color: #475569;
    padding-right: 14px;
    line-height: 40px;
    text-align: left;
    white-space: nowrap;
  }

  .el-form-item__content {
    line-height: 40px;
  }
}

/* 输入框优化 */
:deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #d8dee8 inset;
  min-height: 40px;
  padding: 0 12px;
  transition: box-shadow 0.2s ease, background-color 0.2s ease !important;
  background-color: #ffffff;

  &:hover {
    box-shadow: 0 0 0 1px #93c5fd inset !important;
  }

  &.is-focus {
    box-shadow: 0 0 0 1px #2563eb inset, 0 0 0 3px rgba(37, 99, 235, 0.12) !important;
    background-color: #ffffff;
  }
}

/* 单选框优化 */
:deep(.el-radio-group) {
  display: flex;
  gap: 10px;
  min-height: 40px;

  .el-radio {
    margin-right: 0;
    height: 40px;
    min-width: 70px;
    padding: 0 16px;
    border-radius: 8px;
    border: 1px solid #d8dee8;
    transition: border-color 0.2s ease, background-color 0.2s ease;
    background: #f8fafc;

    &.is-checked {
      border-color: #2563eb;
      background: #eff6ff;
      
      .el-radio__label {
        color: #1d4ed8;
        font-weight: 500;
      }
    }

    &:hover:not(.is-checked) {
      border-color: #c0c4cc;
      background: #f1f5f9;
    }

    .el-radio__inner {
      transition: all 0.2s ease;
    }
  }
}

/* 按钮组优化 */
.form-actions-item {
  margin-top: 8px;
  margin-bottom: 0;
  
  :deep(.el-form-item__content) {
    margin-left: 96px !important;
    gap: 12px;
    display: flex;
  }
}

.btn-submit,
.btn-close {
  min-width: 92px;
  height: 38px;
  border-radius: 8px;
  font-weight: 500;
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.btn-submit {
  border: none;
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.18);

  &:hover,
  &:focus {
    background: #1d4ed8;
    color: #ffffff;
  }
}

.btn-close {
  border-color: #d8dee8;
  background: #ffffff;
  color: #475569;

  &:hover,
  &:focus {
    border-color: #bfdbfe;
    background: #eff6ff;
    color: #1d4ed8;
  }
}

@media (max-width: 768px) {
  :deep(.el-form-item) {
    display: block;

    .el-form-item__label {
      display: block;
      width: auto !important;
      margin-bottom: 6px;
      text-align: left;
      line-height: 1.4;
    }

    .el-form-item__content {
      margin-left: 0 !important;
    }
  }

  .form-actions-item :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }
}
</style>
