<template>
  <div class="password-form-shell">
    <el-form
      ref="pwdRef"
      :model="user"
      :rules="rules"
      label-width="96px"
      class="password-form"
      status-icon
    >
      <el-form-item label="旧密码" prop="oldPassword">
        <el-input v-model="user.oldPassword" placeholder="请输入旧密码" type="password" show-password />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input v-model="user.newPassword" placeholder="请输入新密码" type="password" show-password />
      </el-form-item>

      <div class="password-strength" :class="passwordStrength.className" v-if="user.newPassword">
        <span class="strength-label">密码强度</span>
        <div class="strength-bars" aria-hidden="true">
          <span v-for="item in 3" :key="item" :class="{ active: item <= passwordStrength.level }"></span>
        </div>
        <strong>{{ passwordStrength.label }}</strong>
      </div>

      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input v-model="user.confirmPassword" placeholder="请再次输入新密码" type="password" show-password />
      </el-form-item>

      <div class="password-tips">
        <div class="tips-title">密码要求</div>
        <ul>
          <li>8-20 位字符</li>
          <li>至少包含字母和数字</li>
          <li>不能包含 &lt; &gt; " ' \ | 等非法字符</li>
        </ul>
      </div>

      <el-form-item class="form-actions-item">
        <el-button
          type="primary"
          class="btn-submit"
          :loading="isSubmitting"
          :disabled="!isFormReady || isSubmitting"
          @click="submit"
        >
          保存修改
        </el-button>
        <el-button class="btn-close" @click="close">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { updateUserPwd } from "@/api/system/user"

const { proxy } = getCurrentInstance()

const user = reactive({
  oldPassword: undefined,
  newPassword: undefined,
  confirmPassword: undefined
})

const isSubmitting = ref(false)

const hasIllegalChar = value => /[<>"'|\\]/.test(value || "")
const hasLetterAndNumber = value => /^(?=.*[A-Za-z])(?=.*\d).+$/.test(value || "")

const passwordStrength = computed(() => {
  const value = user.newPassword || ""
  if (!value) {
    return { label: "弱", level: 0, className: "is-weak" }
  }

  let score = 0
  if (value.length >= 8) score += 1
  if (hasLetterAndNumber(value)) score += 1
  if (value.length >= 12 || /[^A-Za-z0-9]/.test(value)) score += 1

  if (score >= 3) {
    return { label: "强", level: 3, className: "is-strong" }
  }
  if (score === 2) {
    return { label: "中", level: 2, className: "is-medium" }
  }
  return { label: "弱", level: 1, className: "is-weak" }
})

const isFormReady = computed(() => {
  return Boolean(
    user.oldPassword &&
    user.newPassword &&
    user.confirmPassword &&
    user.newPassword === user.confirmPassword &&
    user.newPassword.length >= 8 &&
    user.newPassword.length <= 20 &&
    hasLetterAndNumber(user.newPassword) &&
    !hasIllegalChar(user.newPassword)
  )
})

const equalToPassword = (rule, value, callback) => {
  if (user.newPassword !== value) {
    callback(new Error("两次输入的密码不一致"))
  } else {
    callback()
  }
}

const validatePasswordContent = (rule, value, callback) => {
  if (!hasLetterAndNumber(value)) {
    callback(new Error("密码至少包含字母和数字"))
  } else if (hasIllegalChar(value)) {
    callback(new Error("不能包含非法字符：< > \" ' \\ |"))
  } else {
    callback()
  }
}

const rules = ref({
  oldPassword: [{ required: true, message: "旧密码不能为空", trigger: "blur" }],
  newPassword: [
    { required: true, message: "新密码不能为空", trigger: "blur" },
    { min: 8, max: 20, message: "长度在 8 到 20 个字符", trigger: "blur" },
    { validator: validatePasswordContent, trigger: ["blur", "change"] }
  ],
  confirmPassword: [
    { required: true, message: "确认密码不能为空", trigger: "blur" },
    { validator: equalToPassword, trigger: ["blur", "change"] }
  ]
})

/** 提交按钮 */
function submit() {
  proxy.$refs.pwdRef.validate(valid => {
    if (!valid || isSubmitting.value) {
      return
    }

    isSubmitting.value = true
    updateUserPwd(user.oldPassword, user.newPassword)
      .then(() => {
        proxy.$modal.msgSuccess("修改成功")
        proxy.$refs.pwdRef.resetFields()
      })
      .finally(() => {
        isSubmitting.value = false
      })
  })
}

/** 取消按钮 */
function close() {
  proxy.$tab.closePage()
}
</script>

<style lang="scss" scoped>
.password-form-shell {
  width: 560px;
  max-width: 100%;
}

.password-form {
  width: 100%;
}

:deep(.el-form-item) {
  margin-bottom: 16px;

  .el-form-item__label {
    justify-content: flex-start;
    padding-right: 14px;
    color: #475569;
    font-weight: 500;
    line-height: 40px;
    text-align: left;
    white-space: nowrap;
  }

  .el-form-item__content {
    line-height: 40px;
  }
}

:deep(.el-input__wrapper) {
  min-height: 40px;
  padding: 0 12px;
  border-radius: 8px;
  background-color: #ffffff;
  box-shadow: 0 0 0 1px #d8dee8 inset;
  transition: box-shadow 0.2s ease, background-color 0.2s ease !important;

  &:hover {
    box-shadow: 0 0 0 1px #93c5fd inset !important;
  }

  &.is-focus {
    background-color: #ffffff;
    box-shadow: 0 0 0 1px #2563eb inset, 0 0 0 3px rgba(37, 99, 235, 0.12) !important;
  }
}

.password-strength {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: -4px 0 16px 96px;
  min-height: 24px;
  color: #64748b;
  font-size: 13px;

  strong {
    font-weight: 600;
  }
}

.strength-label {
  color: #64748b;
}

.strength-bars {
  display: flex;
  gap: 5px;

  span {
    display: block;
    width: 40px;
    height: 6px;
    border-radius: 999px;
    background: #e5e7eb;
  }
}

.password-strength.is-weak {
  strong {
    color: #dc2626;
  }

  .strength-bars span.active {
    background: #ef4444;
  }
}

.password-strength.is-medium {
  strong {
    color: #d97706;
  }

  .strength-bars span.active {
    background: #f59e0b;
  }
}

.password-strength.is-strong {
  strong {
    color: #059669;
  }

  .strength-bars span.active {
    background: #10b981;
  }
}

.password-tips {
  margin: 0 0 18px 96px;
  padding: 12px 14px;
  border: 1px solid #e0e7ff;
  border-radius: 8px;
  background: #f8fafc;
  color: #475569;
  font-size: 13px;
  line-height: 1.7;

  .tips-title {
    margin-bottom: 4px;
    color: #1f2937;
    font-weight: 600;
  }

  ul {
    margin: 0;
    padding-left: 18px;
  }
}

.form-actions-item {
  margin-top: 8px;
  margin-bottom: 0;

  :deep(.el-form-item__content) {
    display: flex;
    gap: 12px;
    margin-left: 96px !important;
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

  &.is-disabled,
  &.is-disabled:hover {
    background: #93c5fd;
    color: #ffffff;
    box-shadow: none;
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

  .password-strength,
  .password-tips,
  .form-actions-item :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }

  .strength-bars span {
    width: 32px;
  }
}
</style>
