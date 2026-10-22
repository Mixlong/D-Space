<template>
  <div class="navbar" style="-webkit-app-region: drag;" @dblclick="maximizeWindow">
    <div class="navbar-left">
      <div class="brand-container">
        <img src="@/assets/logo/menu-logo.png" alt="Logo" class="brand-logo" />
        <span class="brand-name">D-Space</span>
      </div>
    </div>
    
    <div class="navbar-center">
      <h1 class="page-title">{{ currentPageTitle }}</h1>
    </div>

    <div class="right-menu">
      <!-- 已隐藏：搜索、GitHub、文档、全屏、深色模式、文本大小 -->
      <template v-if="false">
        <header-search id="header-search" class="right-menu-item" />

        <el-tooltip content="源码地址" effect="dark" placement="bottom">
          <ruo-yi-git id="ruoyi-git" class="right-menu-item hover-effect" />
        </el-tooltip>

        <el-tooltip content="文档地址" effect="dark" placement="bottom">
          <ruo-yi-doc id="ruoyi-doc" class="right-menu-item hover-effect" />
        </el-tooltip>

        <screenfull id="screenfull" class="right-menu-item hover-effect" />

        <el-tooltip content="主题模式" effect="dark" placement="bottom">
          <div class="right-menu-item hover-effect theme-switch-wrapper" @click="toggleTheme">
            <svg-icon v-if="settingsStore.isDark" icon-class="sunny" />
            <svg-icon v-if="!settingsStore.isDark" icon-class="moon" />
          </div>
        </el-tooltip>

        <el-tooltip content="布局大小" effect="dark" placement="bottom">
          <size-select id="size-select" class="right-menu-item hover-effect" />
        </el-tooltip>
      </template>

      <!-- 更新下载指示器 -->
      <update-indicator class="right-menu-item" />

      <el-dropdown @command="handleCommand" class="avatar-container right-menu-item hover-effect" trigger="hover" style="-webkit-app-region: no-drag;padding-right: 12px;">
        <div class="avatar-wrapper">
          <el-avatar :src="userStore.avatar" :size="30" shape="square" class="user-avatar">
            {{ userStore.nickName?.charAt(0) }}
          </el-avatar>
          <span class="user-nickname"> {{ userStore.nickName }} </span>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <router-link to="/user/profile">
              <el-dropdown-item>个人中心</el-dropdown-item>
            </router-link>
            <!-- <el-dropdown-item command="setLayout" v-if="settingsStore.showSettings">
                <span>布局设置</span>
              </el-dropdown-item> -->
            <el-dropdown-item divided command="logout">
              <span>退出登录</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- 窗口控制按钮 -->
      <div class="window-controls" style="-webkit-app-region: no-drag;">
        <button class="window-btn minimize-btn" @click="minimizeWindow" title="最小化">
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect fill="currentColor" width="10" height="1"/>
          </svg>
        </button>
        <button class="window-btn maximize-btn" @click="maximizeWindow" title="最大化/还原">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0" y="0" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
        <button class="window-btn close-btn" @click="closeWindow" title="关闭">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path fill="currentColor" d="M0,0 L10,10 M10,0 L0,10" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import Breadcrumb from '@/components/Breadcrumb'
import TopNav from '@/components/TopNav'
import Hamburger from '@/components/Hamburger'
import Screenfull from '@/components/Screenfull'
import SizeSelect from '@/components/SizeSelect'
import HeaderSearch from '@/components/HeaderSearch'
import RuoYiGit from '@/components/RuoYi/Git'
import RuoYiDoc from '@/components/RuoYi/Doc'
import UpdateIndicator from '@/components/UpdateIndicator'
import useAppStore from '@/store/modules/app'
import useUserStore from '@/store/modules/user'
import useSettingsStore from '@/store/modules/settings'
import { disconnectMqtt } from '@/plugins/mqtt'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const settingsStore = useSettingsStore()

// 获取当前页面标题
const currentPageTitle = computed(() => {
  return route.meta?.title || 'D-Space管理系统'
})

function handleCommand(command) {
  switch (command) {
    case "setLayout":
      setLayout()
      break
    case "logout":
      logout()
      break
    default:
      break
  }
}

function logout() {
  ElMessageBox.confirm('确定注销并退出系统吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    // 断开MQTT长连接
    console.log('[Navbar] 登出时断开MQTT连接...')
    try {
      disconnectMqtt()
      console.log('[Navbar] MQTT连接已断开')
    } catch (error) {
      console.error('[Navbar] 断开MQTT失败:', error)
    }
    
    userStore.logOut().then(() => {
      router.push('/login')
    })
  }).catch(() => { })
}

const emits = defineEmits(['setLayout'])
function setLayout() {
  emits('setLayout')
}

function toggleTheme() {
  settingsStore.toggleTheme()
}

// 窗口控制方法
function minimizeWindow() {
  if (window.electronAPI && window.electronAPI.minimizeWindow) {
    window.electronAPI.minimizeWindow()
  }
}

function maximizeWindow() {
  if (window.electronAPI && window.electronAPI.maximizeWindow) {
    window.electronAPI.maximizeWindow()
  }
}

function closeWindow() {
  if (window.electronAPI && window.electronAPI.closeWindow) {
    window.electronAPI.closeWindow()
  }
}
</script>

<style lang='scss' scoped>
.navbar {
  height: 54px;
  overflow: hidden;
  position: relative;
  background: var(--el-color-primary);
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;

  .navbar-left {
    width: 200px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding-left: 20px;
    flex-shrink: 0;

    .brand-container {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .brand-logo {
        width: 32px;
        height: 39px;
      }
      
      .brand-name {
        font-family: 'Alibaba PuHuiTi', 'Microsoft YaHei', sans-serif;
        font-size: 18px;
        color: #ffffff;
        font-weight: 600;
        white-space: nowrap;
        letter-spacing: 0.5px;
      }
    }
  }

  .navbar-center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;

    .page-title {
      font-family: 'Alibaba PuHuiTi', 'Microsoft YaHei', sans-serif;
      font-size: 20px;
      font-weight: bold;
      color: #ffffff;
      margin: 0;
      white-space: nowrap;
    }
  }

  .right-menu {
    height: 100%;
    line-height: 54px;
    display: flex;
    align-items: center;
    padding-right: 20px;

    &:focus {
      outline: none;
    }

    .right-menu-item {
      display: flex;
      align-items: center;
      padding: 0 12px;
      height: 100%;
      font-size: 18px;
      color: #ffffff;
      vertical-align: text-bottom;

      &.hover-effect {
        cursor: pointer;
        transition: background 0.3s;

        &:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      }

      &.theme-switch-wrapper {
        display: flex;
        align-items: center;

        svg {
          transition: transform 0.3s;
          
          &:hover {
            transform: scale(1.15);
          }
        }
      }
    }

    .avatar-container {
      margin-right: 0px;
      padding-right: 0px;
      height: 100%;
      display: flex;
      align-items: center;

      .avatar-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        height: auto;

        .user-avatar {
          width: 30px;
          height: 30px;
        }

        .user-nickname {
          font-size: 14px;
          font-weight: bold;
          color: #ffffff;
        }

        i {
          font-size: 12px;
          color: #ffffff;
        }
      }
    }
  }

  // 窗口控制按钮
  .window-controls {
    display: flex;
    align-items: center;
    height: 100%;
    margin-left: 10px;

    .window-btn {
      width: 46px;
      height: 100%;
      border: none;
      background: transparent;
      color: rgba(255, 255, 255, 0.9);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      &.close-btn:hover {
        background: #e81123;
        color: white;
      }

      svg {
        display: block;
      }
    }
  }
}
</style>
