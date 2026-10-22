<template>
  <div class="login">
    <!-- 窗口控制按钮 -->
    <WindowControls />
    <!-- 左侧：品牌和插图区域 -->
    <div class="login-left">
      <div class="brand-section">
        <div class="brand-tag">DigiSmart</div>
        <h1 class="brand-title">D-Space</h1>
      </div>
      <div class="illustration-section">
        <img src="../assets/images/login-3d-illustration.png" alt="3D Illustration" class="illustration-img" />
      </div>
    </div>

    <!-- 右侧：登录表单区域 -->
    <div class="login-right">
      <div class="login-form-container">
        <el-form ref="loginRef" :model="loginForm" :rules="loginRules" class="login-form">
          <h3 class="form-title">登录</h3>
          <p class="form-subtitle">Login your account</p>
          
          <el-form-item prop="username" class="form-item">
            <label class="form-label">账号</label>
            <el-input
              v-model="loginForm.username"
              type="text"
              auto-complete="off"
              placeholder="请输入账号"
              class="form-input"
            />
          </el-form-item>

          <el-form-item prop="password" class="form-item">
            <label class="form-label">密码</label>
            <el-input
              v-model="loginForm.password"
              type="password"
              auto-complete="off"
              placeholder="请输入密码"
              class="form-input"
              show-password
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <el-form-item class="form-item remember-item">
            <el-checkbox v-model="loginForm.rememberMe" class="remember-checkbox">
              记住密码
            </el-checkbox>
          </el-form-item>

          <!-- <el-form-item prop="code" v-if="captchaEnabled" class="form-item">
            <label class="form-label">验证码</label>
            <div class="code-input-wrapper">
              <el-input
                v-model="loginForm.code"
                auto-complete="off"
                placeholder="请输入验证码"
                class="form-input"
                style="width: 63%"
                @keyup.enter="handleLogin"
              />
              <div class="login-code">
                <img :src="codeUrl" @click="getCode" class="login-code-img"/>
              </div>
            </div>
          </el-form-item> -->

          <el-form-item style="width:100%;">
            <el-button
              :loading="loading"
              type="primary"
              class="login-button"
              @click.prevent="handleLogin"
            >
              <span v-if="!loading">登录</span>
              <span v-else>登录中...</span>
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <!-- 短信验证码弹窗 - 专业设计版 -->
    <el-dialog 
      v-model="isCodeDiag" 
      width="600px" 
      center 
      append-to-body 
      :close-on-click-modal="false"
      class="sms-dialog-professional"
      :show-close="false"
    >
      <div class="professional-dialog">
        <!-- 关闭按钮 -->
        <div class="dialog-close-btn" @click="isCodeDiag = false">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
          </svg>
        </div>

        <!-- 头部图标和标题 -->
        <div class="dialog-header-pro">
          <div class="header-icon-pro">
            <div class="icon-bg-circle"></div>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1Z" fill="url(#gradient1)"/>
              <defs>
                <linearGradient id="gradient1" x1="3" y1="12" x2="21" y2="12">
                  <stop offset="0%" stop-color="#4F7CFF"/>
                  <stop offset="100%" stop-color="#6B97FF"/>
                </linearGradient>
              </defs>
            </svg>
            <div class="icon-checkmark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/>
              </svg>
            </div>
          </div>
          <h2 class="dialog-title-pro">身份验证</h2>
          <p class="dialog-subtitle-pro">为确保账户安全，请完成以下验证步骤</p>
        </div>

        <!-- 表单区域 -->
        <div class="dialog-body-pro">
          <el-form 
            ref="codeFormRef" 
            :model="codeForm" 
            label-position="top"
            class="verification-form"
          >
            <!-- 步骤1：选择管理员 -->
            <div class="form-section">
              <div class="section-header">
                <span class="step-badge">1</span>
                <span class="section-title">选择接收验证码的管理员</span>
              </div>
              <el-form-item prop="phone">
                <div class="admin-selector-pro">
                  <div 
                    v-for="(item, index) in adminList" 
                    :key="index" 
                    :class="['admin-item-pro', { 'active': codeForm.phone === item.dictValue }]"
                    @click="codeForm.phone = item.dictValue"
                  >
                    <div class="admin-avatar-pro">
                      <span>{{ item.dictLabel.charAt(0) }}</span>
                    </div>
                    <span class="admin-name-pro">{{ item.dictLabel }}</span>
                    <div class="selection-indicator" v-if="codeForm.phone === item.dictValue">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="#4F7CFF"/>
                        <path d="M9 12L11 14L15 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </el-form-item>
            </div>

            <!-- 步骤2：输入验证码 -->
            <div class="form-section">
              <div class="section-header">
                <span class="step-badge">2</span>
                <span class="section-title">输入验证码</span>
              </div>
              <el-form-item prop="code">
                <div class="verification-input-group">
                  <div class="verification-input-wrapper">
                    <el-input 
                      v-model="codeForm.code" 
                      placeholder="请输入 6 位验证码" 
                      clearable
                      maxlength="6"
                      class="verification-code-input"
                      @input="codeForm.code = codeForm.code.replace(/[^\d]/g, '')"
                      @keyup.enter="submitSmsCode"
                    />
                  </div>
                  <el-button 
                    :disabled="getSmsCodeWaiting || !codeForm.phone" 
                    @click="getSmsCode"
                    class="send-code-btn-pro"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" v-if="!getSmsCodeWaiting">
                      <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
                    </svg>
                    {{ codeButtonText }}
                  </el-button>
                </div>
              </el-form-item>
            </div>
          </el-form>
        </div>

        <!-- 底部操作按钮 -->
        <div class="dialog-footer-pro">
          <el-button @click="isCodeDiag = false" class="btn-secondary-pro">
            取消
          </el-button>
          <el-button 
            type="primary" 
            :loading="isCodeLoading" 
            @click="submitSmsCode" 
            class="btn-primary-pro"
          >
            <span v-if="!isCodeLoading">完成验证</span>
            <span v-else>验证中...</span>
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, getCurrentInstance } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCodeImg, getSmsUser, getSmsSend, getSmsVerify } from "@/api/login"
import Cookies from "js-cookie"
import { encrypt, decrypt } from "@/utils/jsencrypt"
import useUserStore from '@/store/modules/user'
import { initMqtt } from '@/plugins/mqtt'
import { CaretBottom } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { setToken } from '@/utils/auth'
import WindowControls from '@/components/WindowControls'

const title = import.meta.env.VITE_APP_TITLE
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const { proxy } = getCurrentInstance()

const loginForm = ref({
  username: "",
  password: "",
  rememberMe: false,
  code: "",
  uuid: ""
})

const loginRules = {
  username: [{ required: true, trigger: "blur", message: "请输入您的账号" }],
  password: [{ required: true, trigger: "blur", message: "请输入您的密码" }],
  code: [{ required: true, trigger: "change", message: "请输入验证码" }]
}

const codeUrl = ref("")
const loading = ref(false)
// 验证码开关
const captchaEnabled = ref(true)
// 注册开关
const register = ref(false)
const redirect = ref(undefined)

// 短信验证码相关
const isCodeDiag = ref(false)
const isCodeLoading = ref(false)
const adminList = ref([])
const getSmsCodeWaiting = ref(false)
const codeButtonText = ref('获取验证码')
const codeTimer = ref(null)
const codeFormRef = ref(null)

const codeForm = ref({
  code: '',
  phone: '',
  username: '',
  password: ''
})

watch(route, (newRoute) => {
    redirect.value = newRoute.query && newRoute.query.redirect
}, { immediate: true })

function handleLogin() {
  // 防止重复点击
  if (loading.value) {
    return
  }
  
  proxy.$refs.loginRef.validate(valid => {
    if (valid) {
      loading.value = true
      // 勾选了需要记住密码，保存到 localStorage
      if (loginForm.value.rememberMe) {
        localStorage.setItem("username", loginForm.value.username)
        localStorage.setItem("password", encrypt(loginForm.value.password))
        localStorage.setItem("rememberMe", "true")
      } else {
        // 否则移除
        localStorage.removeItem("username")
        localStorage.removeItem("password")
        localStorage.removeItem("rememberMe")
      }
      // 调用action的登录方法
      userStore.login(loginForm.value).then(async () => {
        // 登录成功后，初始化MQTT长连接
        console.log('[Login] 登录成功，初始化MQTT长连接...')
        try {
          await initMqtt()
          console.log('[Login] MQTT连接成功')
        } catch (error) {
          console.error('[Login] MQTT连接失败:', error)
          // MQTT连接失败不影响登录，继续跳转
        }
        
        const query = route.query
        const otherQueryParams = Object.keys(query).reduce((acc, cur) => {
          if (cur !== "redirect") {
            acc[cur] = query[cur]
          }
          return acc
        }, {})
        // 跳转到首页，让权限守卫处理路由加载和重定向
        router.push({ path: redirect.value || "/", query: otherQueryParams })
      }).catch((err) => {
        // 如果返回错误码 40010，表示需要短信验证
        if (err === 40010) {
          resetCodeForm()
          isCodeDiag.value = true
          getAdminList()
        }
        loading.value = false
        // 重新获取验证码
        if (captchaEnabled.value) {
          getCode()
        }
      })
    }
  })
}

function getCode() {
  getCodeImg().then(res => {
    captchaEnabled.value = res.captchaEnabled === undefined ? true : res.captchaEnabled
    if (captchaEnabled.value) {
      codeUrl.value = "data:image/gif;base64," + res.img
      loginForm.value.uuid = res.uuid
    }
  })
}

function getCookie() {
  const username = localStorage.getItem("username")
  const password = localStorage.getItem("password")
  const rememberMe = localStorage.getItem("rememberMe")
  loginForm.value = {
    username: username || "",
    password: password ? decrypt(password) : "",
    rememberMe: rememberMe === "true"
  }
}

// 获取短信验证码
function getSmsCode() {
  if (!codeForm.value.phone) {
    ElMessage({ type: 'error', message: '请选择接收验证码用户' })
    return
  }
  
  let holdTime = 60
  getSmsCodeWaiting.value = true
  codeButtonText.value = '重新获取(60)'
  
  codeTimer.value = setInterval(() => {
    if (holdTime <= 0) {
      getSmsCodeWaiting.value = false
      codeButtonText.value = '获取验证码'
      clearInterval(codeTimer.value)
      return
    }
    codeButtonText.value = '重新获取(' + --holdTime + ')'
  }, 1000)
  
  const data = {
    username: loginForm.value.username,
    password: loginForm.value.password,
    phone: codeForm.value.phone
  }
  
  getSmsSend(data).then(() => {
    ElMessage({
      showClose: true,
      message: '验证码已发送，请向管理员获取',
      type: 'success'
    })
  }).catch(() => {
    // 发送失败，重置倒计时
    getSmsCodeWaiting.value = false
    codeButtonText.value = '获取验证码'
    clearInterval(codeTimer.value)
  })
}

// 提交短信验证码
function submitSmsCode() {
  // 防止重复点击
  if (isCodeLoading.value) {
    return
  }
  
  // 手动验证
  if (!codeForm.value.phone) {
    ElMessage({ type: 'warning', message: '请选择接收验证码的管理员' })
    return
  }
  
  if (!codeForm.value.code) {
    ElMessage({ type: 'warning', message: '请输入验证码' })
    return
  }
  
  isCodeLoading.value = true
  codeForm.value.username = loginForm.value.username
  codeForm.value.password = loginForm.value.password
  
  getSmsVerify(codeForm.value)
    .then((res) => {
      const { token } = res.data
      setToken(token)
      
      // 如果有其他认证信息，也保存（使用 localStorage 兼容 Electron）
      if (res.data.iamKey && res.data.iamValue) {
        localStorage.setItem('iamKeys', res.data.iamKey)  // 修复：保存键名而不是键值
        localStorage.setItem('iamValue', res.data.iamValue)
      }
      
      ElMessage({
        message: '登录成功',
        type: 'success'
      })
      
      // 关闭短信验证对话框
      isCodeDiag.value = false
      isCodeLoading.value = false
      
      // 跳转到首页，让路由守卫自动处理用户信息获取和MQTT初始化
      const query = route.query
      const otherQueryParams = Object.keys(query).reduce((acc, cur) => {
        if (cur !== "redirect") {
          acc[cur] = query[cur]
        }
        return acc
      }, {})
      router.push({ path: redirect.value || '/my-todo', query: otherQueryParams })
    })
    .catch(() => {
      isCodeLoading.value = false
    })
}

// 获取管理员列表
function getAdminList() {
  getSmsUser().then((res) => {
    adminList.value = res.data
  })
}

// 重置验证码表单
function resetCodeForm() {
  codeForm.value = {
    code: '',
    phone: '',
    username: '',
    password: ''
  }
  if (proxy.$refs.codeFormRef) {
    proxy.$refs.codeFormRef.resetFields()
  }
}

// 组件卸载时清除定时器
onBeforeUnmount(() => {
  if (codeTimer.value) {
    clearInterval(codeTimer.value)
  }
})

getCode()
getCookie()
</script>

<style lang='scss' scoped>
.login {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background:#fff;
  position: relative;

  // 窗口控制按钮定位
  :deep(.window-controls) {
    position: absolute;
    top: 0;
    right: 0;
    height: 48px;
    z-index: 1000;
    
    .window-btn {
      color: #606266;
      
      &:hover {
        background: rgba(0, 0, 0, 0.05);
      }
      
      &.close-btn:hover {
        background: #e81123;
        color: white;
      }
    }
  }
}

/* 左侧：品牌和插图区域 */
.login-left {
  position: relative;
  flex: 1;
  min-width: 400px;
  height: 100%;
  background: linear-gradient(270deg, #e8f1fa 0%, #ffffff 43.958%);
  display: flex;
  flex-direction: column;
}

.brand-section {
  position: absolute;
  left: 40px;
  top: 40px;
  z-index: 2;
}

.brand-tag {
  display: inline-block;
  padding: 3px 16px;
  background: linear-gradient(90deg, #d1e6fb 0%, #ffffff 100%);
  border-radius: 29px;
  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: #4a4a4a;
  margin-bottom: 6px;
}

.brand-title {
  font-family: 'PangMenZhengDao', 'Microsoft YaHei', sans-serif;
  font-size: 40px;
  font-weight: normal;
  color: #0778fd;
  margin: 0;
  line-height: 1.2;
}

.illustration-section {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.illustration-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

/* 右侧：登录表单区域 */
.login-right {
  flex: 0 0 auto;
  width: 680px;
  min-width: 520px;
  max-width: 800px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 40px;
  position: relative;
}

.login-form-container {
  width: 100%;
  max-width: 421px;
  min-height: 502px;
  background: #ffffff;
  border-radius: 8px;
  padding: 0;
  position: relative;
}

.form-title {
  font-family: 'Alibaba PuHuiTi', 'Microsoft YaHei', sans-serif;
  font-size: 30px;
  font-weight: 500;
  color: #2e74ff;
  margin: 0 0 4px 0;
  padding: 47px 42px 0 0;
  line-height: normal;
  letter-spacing: 0.5px;
}

.form-subtitle {
  font-family: 'Alibaba PuHuiTi', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: #2e74ff;
  opacity: 0.4;
  margin: 0 0 32px 0;
  padding: 0 42px 0 0;
  line-height: normal;
}

.login-form {
  width: 100%;
  padding: 0 42px 42px 42px;
  background: linear-gradient(143.13deg, #FBFCFF -9.47%, #EDF5FF 100%);
  border-radius: 8px;
  
  :deep(.el-form-item__error) {
    padding-top: 4px;
  }
}

.form-item {
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  &.remember-item {
    
    :deep(.el-form-item__content) {
      line-height: normal;
    }
  }
}

.remember-checkbox {
  :deep(.el-checkbox__label) {
    font-family: 'Alibaba PuHuiTi', 'Microsoft YaHei', sans-serif;
    font-size: 14px;
    color: #606266;
    padding-left: 8px;
  }
  
  :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
    background-color: #2e74ff;
    border-color: #2e74ff;
  }
  
  :deep(.el-checkbox__inner:hover) {
    border-color: #2e74ff;
  }
}

.form-label {
  font-family: 'Alibaba PuHuiTi', 'Microsoft YaHei', sans-serif;
  font-size: 16px;
  font-weight: 400;
  color: #394047;
  margin-bottom: 4px;
  display: block;
  line-height: 1.5;
}

.form-input {
  width: 100%;
  
  :deep(.el-input__wrapper) {
    background: #ffffff;
    border: 1px solid #d8e9ff;
    border-radius: 8px;
    box-shadow: none;
    height: 45px;
    padding: 0 12px;
    transition: all 0.3s ease;
  }
  
  .input-icon {
    font-size: 14px;
    color: #909399;
    cursor: pointer;
    transition: color 0.3s;
    
    &:hover {
      color: #2e74ff;
    }
  }
  
  :deep(.el-input__inner) {
    font-family: 'Alibaba PuHuiTi', 'Microsoft YaHei', sans-serif;
    font-size: 14px;
    color: #394047;
    line-height: 45px;
    
    &::placeholder {
      color: #aeaeae;
      font-size: 14px;
    }
  }
  
  :deep(.el-input__wrapper:hover) {
    box-shadow: none;
    border-color: #2e74ff;
  }
  
  :deep(.el-input__wrapper.is-focus) {
    box-shadow: 0 0 0 2px rgba(46, 116, 255, 0.1);
    border-color: #2e74ff;
  }
  
  :deep(.el-input__suffix) {
    display: flex;
    align-items: center;
  }
  
  :deep(.el-input__suffix-inner) {
    display: flex;
    align-items: center;
  }
}

.code-input-wrapper {
  display: flex;
  gap: 10px;
  width: 100%;
}

.login-code {
  flex: 0 0 auto;
  height: 45px;
  
  img {
    height: 45px;
    border-radius: 8px;
    cursor: pointer;
    vertical-align: middle;
  }
}

.login-code-img {
  height: 45px;
  border-radius: 8px;
  border: 1px solid #d8e9ff;
}

.login-button {
  width: 100%;
  height: 47px;
  background: linear-gradient(135deg, #4d8fff 0%, #2e74ff 100%);
  border: none;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 500;
  color: #ffffff;
  margin-top: 24px;
  transition: all 0.3s ease;
  cursor: pointer;
  
  &:hover {
    background: linear-gradient(135deg, #5a9aff 0%, #4d8fff 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(46, 116, 255, 0.4);
  }
  
  &:active {
    background: #1a5cd7;
    transform: translateY(0);
  }
  
  :deep(span) {
    font-size: 18px;
  }
}

/* ============================================
   短信验证码弹窗 - 专业设计风格
   设计原则：简洁、清晰、舒适
   ============================================ */

.sms-dialog-professional {
  :deep(.el-overlay-dialog) {
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10px);
    background: rgba(15, 23, 42, 0.6);
  }
  
  :deep(.el-dialog) {
    margin: 0 !important;
    border-radius: 20px;
    box-shadow: 
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    overflow: hidden;
    background: transparent;
    padding: 0;
  }
  
  :deep(.el-dialog__header),
  :deep(.el-dialog__footer) {
    display: none;
    padding: 0;
  }
  
  :deep(.el-dialog__body) {
    padding: 0;
    overflow: visible;
  }
}

/* 主容器 */
.professional-dialog {
  position: relative;
  background: #FFFFFF;
  border-radius: 20px;
  overflow: hidden;
}

/* 关闭按钮 */
.dialog-close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(100, 116, 139, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #64748B;
  z-index: 10;
  
  &:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #EF4444;
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
}

/* 头部区域 */
.dialog-header-pro {
  position: relative;
  padding: 36px 32px 24px;
  text-align: center;
  background: linear-gradient(180deg, #FAFBFF 0%, #FFFFFF 100%);
  
  .header-icon-pro {
    position: relative;
    width: 72px;
    height: 72px;
    margin: 0 auto 18px;
    
    .icon-bg-circle {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 72px;
      height: 72px;
      background: linear-gradient(135deg, rgba(79, 124, 255, 0.12) 0%, rgba(107, 151, 255, 0.08) 100%);
      border-radius: 50%;
      animation: icon-pulse 2.5s ease-in-out infinite;
    }
    
    > svg {
      position: relative;
      z-index: 2;
      width: 36px;
      height: 36px;
    }
    
    .icon-checkmark {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #4F7CFF 0%, #6B97FF 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(79, 124, 255, 0.3);
      border: 3px solid #FFFFFF;
      z-index: 3;
      
      svg {
        width: 16px;
        height: 16px;
      }
    }
  }
  
  .dialog-title-pro {
    font-size: 24px;
    font-weight: 700;
    color: #0F172A;
    margin: 0 0 8px 0;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }
  
  .dialog-subtitle-pro {
    font-size: 14px;
    color: #64748B;
    margin: 0;
    line-height: 1.6;
    font-weight: 400;
  }
}

@keyframes icon-pulse {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.8;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.12);
    opacity: 0.5;
  }
}

/* 表单主体 */
.dialog-body-pro {
  padding: 6px 32px 24px;
  background: #FFFFFF;
}

.verification-form {
  :deep(.el-form-item) {
    margin-bottom: 0;
  }
}

/* 表单区块 */
.form-section {
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    
    .step-badge {
      width: 22px;
      height: 22px;
      background: linear-gradient(135deg, #4F7CFF 0%, #6B97FF 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
      box-shadow: 0 2px 5px rgba(79, 124, 255, 0.25);
    }
    
    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #1E293B;
      letter-spacing: -0.01em;
    }
  }
}

/* 管理员选择器 */
.admin-selector-pro {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  width: 100%;
}

.admin-item-pro {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  background: #F8FAFC;
  border: 2px solid #E2E8F0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 50px;
  width: 100%;
  
  &:hover {
    background: #F1F5F9;
    border-color: #CBD5E1;
    transform: translateY(-1px);
  }
  
  &.active {
    background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
    border-color: #4F7CFF;
    box-shadow: 0 3px 10px rgba(79, 124, 255, 0.15);
    
    .admin-avatar-pro {
      background: linear-gradient(135deg, #4F7CFF 0%, #6B97FF 100%);
      color: white;
      box-shadow: 0 3px 6px rgba(79, 124, 255, 0.25);
    }
    
    .admin-name-pro {
      color: #1E3A8A;
      font-weight: 600;
    }
  }
  
  .admin-avatar-pro {
    width: 32px;
    height: 32px;
    background: #FFFFFF;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    color: #64748B;
    flex-shrink: 0;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
  }
  
  .admin-name-pro {
    flex: 1;
    font-size: 13px;
    color: #475569;
    font-weight: 500;
    transition: all 0.2s ease;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }
  
  .selection-indicator {
    position: absolute;
    right: 12px;
    flex-shrink: 0;
    animation: check-appear 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    
    svg {
      width: 18px;
      height: 18px;
    }
  }
}

@keyframes check-appear {
  0% {
    opacity: 0;
    transform: scale(0.5) rotate(-45deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

/* 验证码输入组 */
.verification-input-group {
  display: flex;
  gap: 8px;
  align-items: stretch;
  width: 100%;
}

.verification-input-wrapper {
  flex: 1;
  min-width: 0;
  
  :deep(.verification-code-input) {
    width: 100%;
    
    .el-input__wrapper {
      background: #F8FAFC;
      border: 2px solid #E2E8F0;
      border-radius: 10px;
      box-shadow: none;
      height: 42px;
      padding: 0 12px;
      transition: all 0.2s ease;
      width: 100%;
      
      &:hover {
        background: #FFFFFF;
        border-color: #CBD5E1;
      }
      
      &.is-focus {
        background: #FFFFFF;
        border-color: #4F7CFF;
        box-shadow: 0 0 0 3px rgba(79, 124, 255, 0.1);
      }
    }
    
    .el-input__inner {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 5px;
      color: #0F172A;
      text-align: center;
      
      &::placeholder {
        font-size: 12px;
        font-weight: 400;
        letter-spacing: normal;
        color: #94A3B8;
      }
    }
  }
}

.send-code-btn-pro {
  flex-shrink: 0;
  min-width: 105px;
  height: 42px;
  padding: 0 14px;
  background: linear-gradient(135deg, #4F7CFF 0%, #6B97FF 100%);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(79, 124, 255, 0.3);
  
  svg {
    width: 13px;
    height: 13px;
  }
  
  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #5A8CFF 0%, #7BA5FF 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(79, 124, 255, 0.4);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &:disabled {
    background: #F1F5F9;
    color: #94A3B8;
    cursor: not-allowed;
    box-shadow: none;
  }
}

/* 底部按钮区 */
.dialog-footer-pro {
  padding: 16px 32px 22px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-secondary-pro {
  min-width: 80px;
  height: 38px;
  padding: 0 18px;
  border: 2px solid #E2E8F0;
  border-radius: 10px;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #F8FAFC;
    border-color: #CBD5E1;
    color: #1E293B;
  }
  
  &:active {
    transform: scale(0.98);
  }
}

.btn-primary-pro {
  min-width: 110px;
  height: 38px;
  padding: 0 22px;
  background: linear-gradient(135deg, #4F7CFF 0%, #6B97FF 100%);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(79, 124, 255, 0.3);
  
  &:hover:not(:disabled):not(.is-loading) {
    background: linear-gradient(135deg, #5A8CFF 0%, #7BA5FF 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(79, 124, 255, 0.4);
  }
  
  &:active:not(:disabled):not(.is-loading) {
    transform: translateY(0);
  }
  
  &.is-loading {
    cursor: not-allowed;
    opacity: 0.8;
  }
}

/* 响应式设计 */
@media screen and (max-width: 1200px) {
  .login-left {
    min-width: 350px;
  }
  
  .login-right {
    width: 420px;
    min-width: 380px;
    padding: 0 30px;
  }
  
  .brand-section {
    left: 30px;
    top: 30px;
  }
  
  .brand-title {
    font-size: 36px;
  }
}

@media screen and (max-width: 1000px) {
  .login-left {
    min-width: 300px;
  }
  
  .login-right {
    width: 400px;
    min-width: 360px;
    padding: 0 24px;
  }
  
  .login-form-container {
    max-width: 380px;
  }
  
  .brand-title {
    font-size: 32px;
  }
  
  .brand-tag {
    font-size: 12px;
    padding: 2px 12px;
  }
}

@media screen and (max-width: 900px) {
  .login-left {
    display: none;
  }
  
  .login-right {
    width: 100%;
    max-width: 100%;
    justify-content: center;
  }
}

@media screen and (max-width: 768px) {
  .login-right {
    padding: 0 20px;
  }
  
  .login-form-container {
    width: 100%;
    max-width: 400px;
  }
  
  .login-form {
    padding: 0 30px 30px 30px;
  }
  
  .form-title {
    font-size: 24px;
    padding: 35px 30px 0 0;
  }
  
  .form-subtitle {
    padding: 0 30px 0 0;
  }
}
</style>

