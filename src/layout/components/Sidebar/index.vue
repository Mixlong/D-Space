<template>
  <div class="sidebar-container narrow-sidebar">
    <el-scrollbar wrap-class="scrollbar-wrapper">
      <div class="menu-list">
        <router-link
          v-for="(routeItem, index) in sidebarRouters"
          :key="routeItem.path + index"
          :to="routeItem.path"
          class="menu-item"
          :class="{ 'is-active': isActiveRoute(routeItem) }"
          @contextmenu.prevent="handleContextMenu($event, routeItem)"
        >
          <img
            v-if="hasMenuIcon(routeItem)"
            :src="getMenuIcon(routeItem, isActiveRoute(routeItem))"
            class="menu-icon"
            alt=""
            @error="handleMenuIconError($event, routeItem)"
          />
          <span class="menu-title">
            {{ getMenuTitle(routeItem) }}
          </span>
          <!-- 进行中数量徽章（我的待办、我的交办、我的流程） -->
          <span
            v-if="getInProgressCount(routeItem.path) > 0"
            class="menu-badge"
          >
            {{ getInProgressCount(routeItem.path) > 99 ? '99+' : getInProgressCount(routeItem.path) }}
          </span>
        </router-link>
        <!-- 占位符，防止内容被底部版权遮挡 -->
        <div class="copyright-placeholder"></div>
      </div>
    </el-scrollbar>
    <!-- 固定在底部的版权信息 -->
    <div class="sidebar-copyright">
      © {{ currentYear }} D-Space v{{ version }}
    </div>

    <!-- 右键菜单 -->
    <div
      v-show="contextMenuVisible"
      class="context-menu"
      :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
    >
      <div class="context-menu-item" @click="handleRefresh">
        <el-icon><Refresh /></el-icon>
        <span>刷新页面</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import usePermissionStore from '@/store/modules/permission'
import useMqttStore from '@/store/modules/mqtt'
import { findMenuOverride } from '@/utils/menuConfig'
import packageJson from '../../../../package.json'

const currentYear = new Date().getFullYear()
const version = packageJson.version

// 导入图标
import menuTodoIcon from '@/assets/images/menu-todo.svg'
import menuTodoActiveIcon from '@/assets/images/menu-todo-active.svg'
import menuAssignIcon from '@/assets/images/menu-assign.svg'
import menuAssignActiveIcon from '@/assets/images/menu-assign-active.svg'
import menuUserIcon from '@/assets/images/menu-user.svg'
import menuUserActiveIcon from '@/assets/images/menu-user-active.svg'
import myProcessIcon from '@/assets/images/my-process.svg'
import myProcessActiveIcon from '@/assets/images/my-process-active.svg'
import dtyIcon from '@/assets/images/dty.svg'
import dtyActiveIcon from '@/assets/images/dty-active.svg'
import msgActiveIcon from '@/assets/images/msg-active.svg'
import msgIcon from '@/assets/images/msg.svg'
import docIcon from '@/assets/images/doc.svg'
import docActiveIcon from '@/assets/images/doc-active.svg'
import issueTrackingIcon from '@/assets/images/issue-tracking.svg'
import issueTrackingActiveIcon from '@/assets/images/issue-tracking-active.svg'

const route = useRoute()
const permissionStore = usePermissionStore()
const mqttStore = useMqttStore()

// 右键菜单状态
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const currentContextRoute = ref(null)

// 可刷新的路由列表（包含 iframe 的页面）
const refreshableRoutes = ['/ditai-cloud', '/document-process', '/issue-tracking']

const isCommonWebviewRoute = (routeItem) => {
  const meta = getRouteMeta(routeItem)
  const override = getMenuOverride(routeItem)
  return meta.webviewConfig?.type === 'webview' || override?.type === 'webview'
}

const isRefreshableRoute = (routeItem) => {
  return refreshableRoutes.some(path => routeItem.path.includes(path)) || isCommonWebviewRoute(routeItem)
}

// 处理右键菜单
const handleContextMenu = (event, routeItem) => {
  console.log('[Sidebar] 右键菜单:', routeItem.path, '可刷新:', isRefreshableRoute(routeItem))

  // 只有可刷新的页面才显示右键菜单
  if (!isRefreshableRoute(routeItem)) {
    return
  }

  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  currentContextRoute.value = routeItem
  contextMenuVisible.value = true
}

// 处理刷新（完全重置 iframe 页面）
// 步骤：
//   1. 先调主进程 clearCache 清掉 Chromium HTTP 缓存（含内存缓存）
//      —— 否则远程 SPA 的子接口（比如 space/list）会被 Chromium 复用旧响应，
//      导致刷新后看到的还是旧数据。
//   2. 派发 reset-* 事件，AppMain 通过递增 :key 销毁 iframe 组件并重建，
//      连同父组件的 isLoading / retryCount / cacheBustToken 也归零。
const handleRefresh = async () => {
  if (!currentContextRoute.value) return

  const path = currentContextRoute.value.path
  const isDiTai = path.includes('/ditai-cloud')
  const isDocument = path.includes('/document-process')
  const isIssue = path.includes('/issue-tracking')
  const isCommonWebview = isCommonWebviewRoute(currentContextRoute.value)

  if (!isDiTai && !isDocument && !isIssue && !isCommonWebview) {
    contextMenuVisible.value = false
    return
  }

  // 关闭右键菜单（让用户感知到操作已响应，避免清缓存延迟造成卡顿错觉）
  contextMenuVisible.value = false

  // 1) 清 HTTP 缓存（仅 Electron 环境下可用）
  if (window.electronAPI && typeof window.electronAPI.clearCache === 'function') {
    try {
      await window.electronAPI.clearCache()
    } catch (e) {
      console.warn('[Sidebar] 清缓存失败，继续重建 iframe:', e)
    }
  }

  // 2) 派发 reset 事件让 AppMain 销毁重建组件
  if (isDiTai) {
    window.dispatchEvent(new CustomEvent('reset-ditai-cloud'))
    ElMessage.success('正在刷新运营管理...')
  } else if (isDocument) {
    window.dispatchEvent(new CustomEvent('reset-document-process'))
    ElMessage.success('正在刷新文档与流程...')
  } else if (isIssue) {
    window.dispatchEvent(new CustomEvent('reset-issue-tracking'))
    ElMessage.success('正在刷新问题反馈...')
  } else {
    window.dispatchEvent(new CustomEvent('refresh-common-webview', { detail: { path } }))
    ElMessage.success('正在刷新页面...')
  }
}

// 点击其他区域关闭右键菜单
const closeContextMenu = () => {
  contextMenuVisible.value = false
}

onMounted(() => {
  document.addEventListener('click', closeContextMenu)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu)
})

// 根据路由路径获取对应的进行中数量
const getInProgressCount = (path) => {
  if (path.includes('/my-todo')) {
    return mqttStore.myTodoInProgress
  } else if (path.includes('/my-assign')) {
    return mqttStore.myAssignmentInProgress
  } else if (path.includes('/my-process')) {
    return mqttStore.myProcessInProgress
  } else if (path.includes('/chat')) {
    return mqttStore.unreadMessageCount
  }
  return 0
}

// 获取路由的 meta 信息（处理嵌套路由）
const getRouteMeta = (routeItem) => {
  // 如果有 children 且只有一个子路由，使用子路由的 meta
  if (routeItem.children && routeItem.children.length === 1) {
    return routeItem.children[0].meta || {}
  }
  // 否则使用路由自己的 meta
  return routeItem.meta || {}
}

const getMenuOverride = (routeItem) => {
  return findMenuOverride(permissionStore.menuConfig, routeItem)
}

const getMenuTitle = (routeItem) => {
  const override = getMenuOverride(routeItem)
  return override?.title || getRouteMeta(routeItem).title || routeItem.name || '菜单'
}

const hasMenuIcon = (routeItem) => {
  const override = getMenuOverride(routeItem)
  return Boolean(override?.icon || override?.activeIcon || getRouteMeta(routeItem).icon)
}

const sidebarRouters = computed(() => {
  const routes = permissionStore.sidebarRouters
  // 过滤掉 hidden 的路由
  const visibleRoutes = routes.filter(r => !r.hidden && !getMenuOverride(r)?.hidden)
  
  console.log('🔍 Sidebar Routes Debug:')
  console.log('所有路由:', routes)
  console.log('可见路由:', visibleRoutes)
  visibleRoutes.forEach((r, i) => {
    const meta = getRouteMeta(r)
  })
  
  return visibleRoutes
})

// 判断路由是否激活
const isActiveRoute = (routeItem) => {
  return route.path.startsWith(routeItem.path)
}

// 获取菜单图标
const getLocalMenuIcon = (iconName, isActive) => {
  const iconMap = {
    'menu-todo': isActive ? menuTodoActiveIcon : menuTodoIcon,
    'menu-assign': isActive ? menuAssignActiveIcon : menuAssignIcon,
    'menu-user': isActive ? menuUserActiveIcon : menuUserIcon,
    'my-process': isActive ? myProcessActiveIcon : myProcessIcon,
    'dty': isActive ? dtyActiveIcon : dtyIcon,
    'message': isActive ? msgActiveIcon : msgIcon,
    'doc': isActive ? docActiveIcon : docIcon,
    'issue-tracking': isActive ? issueTrackingActiveIcon : issueTrackingIcon
  }
  const result = iconMap[iconName] || menuTodoIcon
  return result
}

const getMenuIcon = (routeItem, isActive) => {
  const override = getMenuOverride(routeItem)
  if (override?.activeIcon && isActive) {
    return override.activeIcon
  }
  if (override?.icon) {
    return override.icon
  }

  return getLocalMenuIcon(getRouteMeta(routeItem).icon, isActive)
}

const handleMenuIconError = (event, routeItem) => {
  const fallbackIcon = getLocalMenuIcon(getRouteMeta(routeItem).icon, isActiveRoute(routeItem))
  if (event.target.src !== fallbackIcon) {
    event.target.src = fallbackIcon
  }
}
</script>

<style lang="scss" scoped>
.sidebar-container {
  width: 160px;
  height: calc(100vh - 54px);
  background-color: #f4f9ff;
  position: fixed;
  left: 0;
  top: 54px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #ebf3ff;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.02);
  
  .scrollbar-wrapper {
    background-color: #f4f9ff;
    flex: 1;
    overflow: hidden;
  }

  .menu-list {
    padding: 16px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
    align-items: center !important;
    min-height: 100%;
  }

  .copyright-placeholder {
    height: 50px;
    width: 100%;
    flex-shrink: 0;
  }

  .menu-item {
    width: 128px !important;
    height: 80px !important;
    background: transparent !important;
    border-radius: 8px !important;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    text-decoration: none;
    position: relative;
    overflow: hidden;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 8px !important;

    .menu-icon {
      width: 28px !important;
      height: 28px !important;
      object-fit: contain;
      transform: translateY(4px);
      transition: transform 0.25s ease;
    }

    .menu-title {
      font-family: 'Alibaba PuHuiTi', 'Microsoft YaHei', sans-serif;
      font-size: 14px !important;
      font-weight: 400;
      color: #888888 !important;
      text-align: center;
      transition: color 0.25s ease;
      white-space: nowrap;
      line-height: 1.2;
      width: 100% !important;
      padding: 0 8px !important;
      box-sizing: border-box;
    }

    &:hover {
      background: rgba(224, 235, 255, 0.6) !important;
      
      .menu-title {
        color: var(--el-color-primary) !important;
      }
    }

    &.is-active {
      background: #e0ebff !important;
      box-shadow: 0 4px 12px rgba(224, 235, 255, 0.4) !important;
      
      .menu-title {
        color: var(--el-color-primary) !important;
        font-weight: 600;
      }
    }

    // 数量徽章样式
    .menu-badge {
      position: absolute !important;
      top: 6px !important;
      right: 10px !important;
      min-width: 20px !important;
      height: 20px !important;
      line-height: 20px !important;
      padding: 0 6px !important;
      background: #ff4d4f !important;
      color: #ffffff !important;
      font-size: 12px !important;
      font-weight: bold !important;
      text-align: center !important;
      border-radius: 10px !important;
      box-shadow: 0 2px 4px rgba(255, 77, 79, 0.3) !important;
      z-index: 10 !important;
    }
  }

  .sidebar-copyright {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 12px 8px;
    text-align: center;
    font-size: 11px;
    color: #999;
    background-color: #f4f9ff;
    border-top: 1px solid #ebf3ff;
    flex-shrink: 0;
  }

  // 右键菜单样式
  .context-menu {
    position: fixed;
    z-index: 9999;
    background: #ffffff;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 4px 0;
    min-width: 120px;

    .context-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 14px;
      color: #333;
      transition: all 0.2s;

      .el-icon {
        font-size: 16px;
        color: #666;
      }

      &:hover {
        background: #f0f7ff;
        color: var(--el-color-primary);

        .el-icon {
          color: var(--el-color-primary);
        }
      }
    }
  }
}
</style>
