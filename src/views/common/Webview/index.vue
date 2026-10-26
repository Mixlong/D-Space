<template>
  <div class="common-webview-page">
    <div v-if="loadError" class="error-overlay">
      <p>⚠️ 页面加载失败</p>
      <span v-if="retryCount >= maxRetries" class="error-hint">已自动重试 {{ maxRetries }} 次，仍然失败</span>
      <span v-else class="error-hint">网络连接异常或服务器无响应</span>
      <button @click="retryLoad">点击重试</button>
    </div>

    <iframe
      ref="iframeRef"
      class="common-webview"
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
  name: 'CommonWebview'
}
</script>

<script setup>
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { buildUrlWithToken, buildUrlWithParams } from '@/utils/linkOpener'
import { buildConfiguredWebviewUrl, getRouteWebviewConfig } from '@/utils/webviewMenu'
import usePermissionStore from '@/store/modules/permission'
import useUserStore from '@/store/modules/user'

const route = useRoute()
const userStore = useUserStore()
const permissionStore = usePermissionStore()

const iframeRef = ref(null)
const currentUrl = ref('')
const cacheBustToken = ref(Date.now().toString())
const isLoading = ref(true)
const loadError = ref(false)
const loadTimeout = ref(null)
const loadingSeconds = ref(0)
const loadingTimer = ref(null)
const retryCount = ref(0)

const maxRetries = 3
const loadTimeoutMs = 15000
const fallbackDigiCloudUrl = 'https://cloud.riding-evolved.com/digiSmart/redirect'

const webviewConfig = computed(() => getRouteWebviewConfig(route, permissionStore.menuConfig))
const getDefaultBaseUrl = () => {
  return import.meta.env.VITE_APP_DIGI_CLOUD_URL || fallbackDigiCloudUrl
}

const buildTargetUrl = () => {
  return buildConfiguredWebviewUrl({
    route,
    menuConfig: permissionStore.menuConfig,
    defaultUrl: getDefaultBaseUrl()
  }).targetUrl
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

const clearLoadTimeout = () => {
  if (loadTimeout.value) {
    clearTimeout(loadTimeout.value)
    loadTimeout.value = null
  }
}

const handleIframeLoad = () => {
  console.log('[通用WebView] iframe 加载完成，耗时:', loadingSeconds.value, '秒')
  isLoading.value = false
  loadError.value = false
  stopLoadingTimer()
  clearLoadTimeout()
}

const handleIframeError = (error) => {
  console.error('[通用WebView] iframe 加载失败:', error)
  isLoading.value = false
  loadError.value = true
  retryCount.value++
}

const startLoadTimeout = () => {
  clearLoadTimeout()

  loadTimeout.value = setTimeout(() => {
    if (isLoading.value && !loadError.value) {
      console.warn('[通用WebView] 加载超时，尝试重新加载...')

      if (retryCount.value < maxRetries) {
        retryCount.value++
        loadUrl()
      } else {
        isLoading.value = false
        loadError.value = true
      }
    }
  }, loadTimeoutMs)
}

const buildFinalUrl = (targetUrl, forceRefresh) => {
  const nextCacheBustToken = forceRefresh ? Date.now().toString() : cacheBustToken.value
  if (forceRefresh) {
    cacheBustToken.value = nextCacheBustToken
  }

  if (webviewConfig.value.appendToken === false) {
    return buildUrlWithParams(targetUrl, { _t: nextCacheBustToken })
  }

  return buildUrlWithToken(targetUrl, userStore.token, {
    paramName: webviewConfig.value.tokenParamName || 'ddsToken',
    stripBearer: webviewConfig.value.stripBearer !== false,
    extraParams: { _t: nextCacheBustToken }
  })
}

const loadUrl = (options = {}) => {
  const { forceRefresh = false } = options

  if (!userStore.token && webviewConfig.value.appendToken !== false) {
    console.warn('[通用WebView] token 为空，等待登录状态')
    isLoading.value = true
    loadError.value = false
    return
  }

  const nextUrl = buildFinalUrl(buildTargetUrl(), forceRefresh)
  const currentSrc = iframeRef.value?.src || ''
  if (!forceRefresh && currentSrc === nextUrl) {
    return
  }

  if (iframeRef.value) {
    console.log('[通用WebView] 设置 iframe.src:', nextUrl)
    isLoading.value = true
    loadError.value = false
    iframeRef.value.src = nextUrl
    currentUrl.value = nextUrl
    startLoadingTimer()
    startLoadTimeout()
  }
}

const retryLoad = () => {
  loadError.value = false
  isLoading.value = true
  retryCount.value = 0
  loadUrl({ forceRefresh: true })
}

const handleRefreshEvent = (event) => {
  const refreshPath = event.detail?.path
  if (!refreshPath || refreshPath === route.path) {
    loadUrl({ forceRefresh: true })
  }
}

onMounted(async () => {
  window.addEventListener('refresh-common-webview', handleRefreshEvent)
  await nextTick()

  if (userStore.token || webviewConfig.value.appendToken === false) {
    loadUrl()
  }
})

onActivated(() => {
  const currentSrc = iframeRef.value?.src || ''
  const isEmpty = !currentSrc || currentSrc === 'about:blank'
  if ((userStore.token || webviewConfig.value.appendToken === false) && (isEmpty || loadError.value)) {
    loadUrl()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('refresh-common-webview', handleRefreshEvent)
  clearLoadTimeout()
  stopLoadingTimer()
})

watch(() => userStore.token, (newToken) => {
  const currentSrc = iframeRef.value?.src || ''
  const isEmpty = !currentSrc || currentSrc === 'about:blank'
  if (newToken && iframeRef.value && (!currentUrl.value || loadError.value || isEmpty)) {
    loadUrl()
  }
})

watch(
  () => [route.fullPath, JSON.stringify(webviewConfig.value)],
  ([newFullPath, newConfig], [oldFullPath, oldConfig]) => {
    if (newFullPath !== oldFullPath || newConfig !== oldConfig) {
      loadUrl({ forceRefresh: true })
    }
  }
)
</script>

<style lang="scss" scoped>
.common-webview-page {
  width: 100%;
  height: calc(100vh - 54px);
  overflow: hidden;
  position: relative;
  background: #fff;

  .common-webview {
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
