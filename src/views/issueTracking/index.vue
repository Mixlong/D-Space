<template>
  <div class="issue-tracking-page">
    <div v-if="loadError" class="error-overlay">
      <p>⚠️ 页面加载失败</p>
      <span v-if="retryCount >= maxRetries" class="error-hint">已自动重试 {{ maxRetries }} 次，仍然失败</span>
      <span v-else class="error-hint">网络连接异常或服务器无响应</span>
      <button @click="retryLoad">点击重试</button>
    </div>

    <iframe
      ref="iframeRef"
      class="issue-tracking-webview"
      :class="{ 'iframe-hidden': loadError }"
      frameborder="0"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      @load="handleIframeLoad"
      @error="handleIframeError"
    ></iframe>
  </div>
</template>

<script>
export default {
  name: 'IssueTracking'
}
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { normalizeIssueTrackingUrl } from '@/utils/issueTracking'
import { buildUrlWithToken, buildUrlWithParams } from '@/utils/linkOpener'
import { getFirstQueryValue, getRouteQueryParams, getRouteWebviewConfig } from '@/utils/webviewMenu'
import usePermissionStore from '@/store/modules/permission'
import useUserStore from '@/store/modules/user'

const route = useRoute()
const userStore = useUserStore()
const permissionStore = usePermissionStore()

const iframeRef = ref(null)
const issueTrackingUrl = ref('')
const cacheBustToken = ref(Date.now().toString())
const isLoading = ref(true)
const loadError = ref(false)
const loadTimeout = ref(null)
const loadingSeconds = ref(0)
const loadingTimer = ref(null)
const retryCount = ref(0)

const maxRetries = 3
const loadTimeoutMs = 15000

const getPathFromFullPath = (fullPath = '') => {
  return String(fullPath).split(/[?#]/)[0]
}

const isIssueTrackingFullPath = (fullPath = '') => {
  return getPathFromFullPath(fullPath) === '/issue-tracking'
}

const startLoadingTimer = () => {
  loadingSeconds.value = 0
  if (loadingTimer.value) {
    clearInterval(loadingTimer.value)
  }
  loadingTimer.value = setInterval(() => {
    loadingSeconds.value++
  }, 1000)
}

const stopLoadingTimer = () => {
  if (loadingTimer.value) {
    clearInterval(loadingTimer.value)
    loadingTimer.value = null
  }
}

const handleIframeLoad = () => {
  console.log('[问题跟踪] ✅ iframe 加载完成，耗时:', loadingSeconds.value, '秒')
  isLoading.value = false
  loadError.value = false
  stopLoadingTimer()
  if (loadTimeout.value) {
    clearTimeout(loadTimeout.value)
    loadTimeout.value = null
  }
}

const handleIframeError = (error) => {
  console.error('[问题跟踪] ❌ iframe 加载失败:', error)
  isLoading.value = false
  loadError.value = true
  retryCount.value++
}

const startLoadTimeout = () => {
  if (loadTimeout.value) {
    clearTimeout(loadTimeout.value)
  }

  loadTimeout.value = setTimeout(() => {
    if (isLoading.value && !loadError.value) {
      console.warn('[问题跟踪] ⏰ 加载超时，尝试重新加载...')

      if (retryCount.value < maxRetries) {
        retryCount.value++
        console.log(`[问题跟踪] 🔄 自动重试 (${retryCount.value}/${maxRetries})`)
        loadUrl()
      } else {
        console.error('[问题跟踪] ❌ 达到最大重试次数，显示错误')
        isLoading.value = false
        loadError.value = true
      }
    }
  }, loadTimeoutMs)
}

const buildTargetUrl = () => {
  const webviewConfig = getRouteWebviewConfig(route, permissionStore.menuConfig)
  const url = getFirstQueryValue(route.query.url) || webviewConfig.url

  return normalizeIssueTrackingUrl(url, {
    ...(webviewConfig.urlParams || {}),
    ...getRouteQueryParams(route, ['url'])
  })
}

const loadUrl = (options = {}) => {
  const { forceRefresh = false } = options

  const webviewConfig = getRouteWebviewConfig(route, permissionStore.menuConfig)

  if (!userStore.token && webviewConfig.appendToken !== false) {
    console.error('[问题跟踪] ⚠️ token 为空！')
    isLoading.value = true
    loadError.value = false
    return
  }

  const targetUrl = buildTargetUrl()
  const nextCacheBustToken = forceRefresh ? Date.now().toString() : cacheBustToken.value
  if (forceRefresh) {
    cacheBustToken.value = nextCacheBustToken
  }

  const nextUrl = webviewConfig.appendToken === false
    ? buildUrlWithParams(targetUrl, { _t: nextCacheBustToken })
    : buildUrlWithToken(targetUrl, userStore.token, {
        paramName: webviewConfig.tokenParamName || 'token',
        stripBearer: webviewConfig.stripBearer !== false,
        extraParams: { _t: nextCacheBustToken }
      })

  console.log('[问题跟踪] 最终 iframe URL:', nextUrl)

  const currentSrc = iframeRef.value?.src || ''
  if (!forceRefresh && currentSrc === nextUrl) {
    console.log('[问题跟踪] ⏭️ iframe src 未变化，跳过加载')
    return
  }

  if (iframeRef.value) {
    console.log('[问题跟踪] ✅ 设置 iframe.src:', nextUrl)
    isLoading.value = true
    loadError.value = false
    iframeRef.value.src = nextUrl
    issueTrackingUrl.value = nextUrl
    startLoadingTimer()
    startLoadTimeout()
  }
}

const retryLoad = () => {
  console.log('[问题跟踪] 🔄 重试加载...')
  loadError.value = false
  isLoading.value = true
  retryCount.value = 0
  loadUrl({ forceRefresh: true })
}

const handleRefreshEvent = (event) => {
  const refreshPath = event.detail?.path
  if (!refreshPath || refreshPath === route.path) {
    console.log('[问题跟踪] 🔄 收到刷新事件，强制刷新 iframe')
    retryCount.value = 0
    loadUrl({ forceRefresh: true })
  }
}

onMounted(async () => {
  console.log('[问题跟踪] 🚀 组件已挂载')
  window.addEventListener('refresh-issue-tracking', handleRefreshEvent)

  await nextTick()

  if (iframeRef.value) {
    iframeRef.value.addEventListener('load', () => {
      console.log('[问题跟踪] iframe 加载完成')
      console.log('[问题跟踪] iframe.src:', iframeRef.value?.src)
    })

    iframeRef.value.addEventListener('error', (error) => {
      console.error('[问题跟踪] iframe 加载失败:', error)
    })
  }

  if (userStore.token) {
    loadUrl()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('refresh-issue-tracking', handleRefreshEvent)

  if (loadTimeout.value) {
    clearTimeout(loadTimeout.value)
    loadTimeout.value = null
  }

  stopLoadingTimer()
})

watch(() => userStore.token, (newToken) => {
  const currentSrc = iframeRef.value?.src || ''
  const isEmpty = !currentSrc || currentSrc === 'about:blank'
  if (newToken && iframeRef.value && (!issueTrackingUrl.value || loadError.value || isEmpty)) {
    console.log('[问题跟踪] token 已就绪，开始加载')
    loadUrl()
  }
})

watch(() => route.fullPath, (newFullPath, oldFullPath) => {
  console.log('[问题跟踪] 路由变化:', { newFullPath, oldFullPath })

  if (!isIssueTrackingFullPath(newFullPath)) {
    return
  }

  if (!isIssueTrackingFullPath(oldFullPath)) {
    console.log('[问题跟踪] 从其他菜单切回，保留现有 iframe，不主动刷新')
    return
  }

  if (newFullPath !== oldFullPath) {
    loadUrl()
  }
})
</script>

<style lang="scss" scoped>
.issue-tracking-page {
  width: 100%;
  height: calc(100vh - 54px);
  overflow: hidden;
  position: relative;
  background: #fff;

  .issue-tracking-webview {
    display: block;
    width: 100%;
    height: 100%;
    border: none;
    background: #fff;

    &.iframe-hidden {
      visibility: hidden;
    }
  }

  .error-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #f5f7fa;
    z-index: 10;

    p {
      margin-top: 16px;
      color: #606266;
      font-size: 14px;
    }

    .error-hint {
      margin-top: 8px;
      color: #909399;
      font-size: 12px;
    }
  }

  .error-overlay {
    button {
      margin-top: 16px;
      padding: 8px 24px;
      background: #409eff;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;

      &:hover {
        background: #66b1ff;
      }
    }
  }

}
</style>
