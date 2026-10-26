<template>
  <div class="document-process-container">
    <!-- 加载失败提示 -->
    <div v-if="loadError" class="error-overlay">
      <p>⚠️ 页面加载失败</p>
      <span class="error-hint" v-if="retryCount >= maxRetries">已自动重试 {{ maxRetries }} 次，仍然失败</span>
      <span class="error-hint" v-else>网络连接异常或服务器无响应</span>
      <button @click="retryLoad">点击重试</button>
    </div>
    <iframe
      ref="iframeRef"
      class="document-webview"
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
  name: 'DocumentProcess'
}
</script>

<script setup>
import { ref, onMounted, onActivated, onDeactivated, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getFirstQueryValue, getRouteQueryParams, getRouteWebviewConfig, normalizeUrlToBaseOrigin } from '@/utils/webviewMenu'
import usePermissionStore from '@/store/modules/permission'
import useUserStore from '@/store/modules/user'

const route = useRoute()
const userStore = useUserStore()
const permissionStore = usePermissionStore()
const documentUrl = ref('')
const iframeRef = ref(null)
const cacheBustToken = ref(Date.now().toString())
const isLoading = ref(true)
const loadError = ref(false)
const loadTimeout = ref(null)
const loadingSeconds = ref(0)  // 加载秒数计时
const loadingTimer = ref(null)  // 加载秒数计时器

// 开始计时
const startLoadingTimer = () => {
  loadingSeconds.value = 0
  if (loadingTimer.value) {
    clearInterval(loadingTimer.value)
  }
  loadingTimer.value = setInterval(() => {
    loadingSeconds.value++
  }, 1000)
}

// 停止计时
const stopLoadingTimer = () => {
  if (loadingTimer.value) {
    clearInterval(loadingTimer.value)
    loadingTimer.value = null
  }
}

// 处理 iframe 加载完成
const handleIframeLoad = () => {
  console.log('[文档流程平台] ✅ iframe 加载完成，耗时:', loadingSeconds.value, '秒')
  isLoading.value = false
  loadError.value = false
  stopLoadingTimer()
  if (loadTimeout.value) {
    clearTimeout(loadTimeout.value)
    loadTimeout.value = null
  }
}

// 处理 iframe 加载失败
const handleIframeError = (e) => {
  console.error('[文档流程平台] ❌ iframe 加载失败:', e)
  isLoading.value = false
  loadError.value = true
  retryCount.value++
}

// 重试加载
const retryLoad = () => {
  console.log('[文档流程平台] 🔄 重试加载...')
  loadError.value = false
  isLoading.value = true
  retryCount.value = 0
  loadUrl()
}

// 自动重试加载（用于组件激活时）
const autoRetryLoad = () => {
  console.log('[文档流程平台] 🔄 自动重试加载...')
  loadError.value = false
  isLoading.value = true
  loadUrl()
}

// 重试计数器
const retryCount = ref(0)
const maxRetries = 3  // 最大自动重试次数
const loadTimeoutMs = 15000  // 加载超时时间（15秒）

// 启动加载超时检测
const startLoadTimeout = () => {
  // 清除之前的超时计时器
  if (loadTimeout.value) {
    clearTimeout(loadTimeout.value)
  }
  
  // 设置新的超时计时器
  loadTimeout.value = setTimeout(() => {
    // 如果加载未完成，说明超时了
    if (isLoading.value && !loadError.value) {
      console.warn('[文档流程平台] ⏰ 加载超时，尝试重新加载...')
      
      if (retryCount.value < maxRetries) {
        retryCount.value++
        console.log(`[文档流程平台] 🔄 自动重试 (${retryCount.value}/${maxRetries})`)
        loadUrl()
      } else {
        console.error('[文档流程平台] ❌ 达到最大重试次数，显示错误')
        isLoading.value = false
        loadError.value = true
      }
    }
  }, loadTimeoutMs)
}

// 强制刷新 iframe（通过 cache bust 避免浏览器缓存）
const forceRefresh = () => {
  console.log('[文档流程平台] 🔄 强制刷新 iframe（cache bust）')
  loadUrl({ forceRefresh: true })
}

// 监听刷新事件
const handleRefreshEvent = () => {
  forceRefresh()
}

onBeforeUnmount(() => {
  window.removeEventListener('refresh-document-process', handleRefreshEvent)
})

// 监控组件激活/失活状态
onActivated(() => {
  console.log('[文档流程平台] 🟢 组件被激活')
  console.log('[文档流程平台] 📍 当前 documentUrl:', documentUrl.value)
  console.log('[文档流程平台] 📍 当前 iframe.src:', iframeRef.value?.src)
  console.log('[文档流程平台] 📍 加载状态:', { isLoading: isLoading.value, loadError: loadError.value })

  // 检查 iframe 当前状态
  const currentSrc = iframeRef.value?.src || ''
  const isEmpty = !currentSrc || currentSrc === 'about:blank' || currentSrc === ''

  // 如果之前加载失败，或者 iframe 为空，自动重新加载
  if (loadError.value) {
    console.log('[文档流程平台] 🔄 检测到之前加载失败，自动重新加载')
    retryCount.value = 0  // 重置重试计数
    autoRetryLoad()
  } else if (isEmpty && userStore.token) {
    console.log('[文档流程平台] 🔄 检测到 iframe 为空，自动加载')
    loadUrl()
  } else {
    // 正常情况下检查路由参数是否变化
    loadUrl()
  }
})

onDeactivated(() => {
  console.log('[文档流程平台] 🔴 组件被失活（进入缓存）')
  // 清除加载超时计时器
  if (loadTimeout.value) {
    clearTimeout(loadTimeout.value)
    loadTimeout.value = null
  }
})

// 获取文档平台基础 URL
const getDocumentBaseUrl = () => {
  return import.meta.env.VITE_DOCUMENT_PROCESS_URL || 'http://test-cloud.riding-evolved.com/document-v3/#/home'
}

// 构建带 token 的 hash 路由 URL
// 目标格式: http://xxx/document-v3/#/home?token=xxx
const buildHashUrlWithToken = (baseUrl, token, extraParams = {}, options = {}) => {
  const {
    paramName = 'token',
    stripBearer = true
  } = options
  // 去掉 Bearer 前缀
  let cleanToken = token
  if (stripBearer && cleanToken && cleanToken.toLowerCase().startsWith('bearer ')) {
    cleanToken = cleanToken.replace(/^bearer\s+/i, '')
  }

  // 解析 URL，处理 hash 部分
  const hashIndex = baseUrl.indexOf('#')
  const buildExtraQuery = () => {
    const entries = Object.entries(extraParams).filter(([, value]) => value !== undefined && value !== null && value !== '')
    if (!entries.length) return ''
    return entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')
  }

  const extraQuery = buildExtraQuery()

  if (hashIndex === -1) {
    // 没有 hash，直接拼接
    const queryList = []
    if (cleanToken) {
      queryList.push(`${encodeURIComponent(paramName)}=${encodeURIComponent(cleanToken)}`)
    }
    if (extraQuery) {
      queryList.push(extraQuery)
    }
    const queryString = queryList.join('&')
    return queryString ? `${baseUrl}#/?${queryString}` : `${baseUrl}#/`
  }

  const basePartWithoutHash = baseUrl.substring(0, hashIndex)
  const hashPart = baseUrl.substring(hashIndex + 1) // 去掉 #

  const queryList = []
  if (cleanToken) {
    queryList.push(`${encodeURIComponent(paramName)}=${encodeURIComponent(cleanToken)}`)
  }
  if (extraQuery) {
    queryList.push(extraQuery)
  }
  const appendQuery = queryList.join('&')
  if (!appendQuery) {
    return `${basePartWithoutHash}#${hashPart}`
  }

  // 检查 hash 部分是否已有参数
  const hasQuery = hashPart.includes('?')
  const separator = hasQuery ? '&' : '?'

  return `${basePartWithoutHash}#${hashPart}${separator}${appendQuery}`
}

// 加载 URL
const loadUrl = (options = {}) => {
  const { forceRefresh = false } = options
  const webviewConfig = getRouteWebviewConfig(route, permissionStore.menuConfig)
  const urlFromQuery = getFirstQueryValue(route.query.url)
  let targetUrl = urlFromQuery || webviewConfig.url || getDocumentBaseUrl()

  if (urlFromQuery) {
    targetUrl = normalizeUrlToBaseOrigin(urlFromQuery, getDocumentBaseUrl())
  }

  console.log('[文档流程平台] 环境变量原始值:', import.meta.env.VITE_DOCUMENT_PROCESS_URL)
  console.log('[文档流程平台] 开始加载 URL:', targetUrl)
  console.log('[文档流程平台] WebView配置:', webviewConfig)

  if (!userStore.token && webviewConfig.appendToken !== false) {
    console.error('[文档流程平台] token 为空！')
    isLoading.value = true
    loadError.value = false
    return
  }

  const nextCacheBustToken = forceRefresh ? Date.now().toString() : cacheBustToken.value
  if (forceRefresh) {
    cacheBustToken.value = nextCacheBustToken
  }

  const hashParams = {
    ...(webviewConfig.urlParams || {}),
    ...getRouteQueryParams(route, ['url']),
    _t: nextCacheBustToken
  }

  const nextUrl = buildHashUrlWithToken(
    targetUrl,
    webviewConfig.appendToken === false ? '' : userStore.token,
    hashParams,
    {
      paramName: webviewConfig.tokenParamName || 'token',
      stripBearer: webviewConfig.stripBearer !== false
    }
  )

  console.log('[文档流程平台] 最终 URL (带 token):', nextUrl)

  const currentSrc = iframeRef.value?.src || ''
  if (!forceRefresh && currentSrc === nextUrl) {
    console.log('[文档流程平台] ⏭️ iframe src 未变化，跳过加载')
    return
  }

  // 设置 iframe.src
  if (iframeRef.value) {
    console.log('[文档流程平台] ✅ 设置 iframe.src:', nextUrl)
    isLoading.value = true  // 设置加载状态
    loadError.value = false
    iframeRef.value.src = nextUrl
    documentUrl.value = nextUrl
    
    // 启动计时器
    startLoadingTimer()
    // 启动加载超时检测
    startLoadTimeout()
  }
}

onMounted(async () => {
  console.log('[文档流程平台] 组件已挂载')
  console.log('[文档流程平台] 环境变量 VITE_DOCUMENT_PROCESS_URL:', import.meta.env.VITE_DOCUMENT_PROCESS_URL)

  // 监听刷新事件
  window.addEventListener('refresh-document-process', handleRefreshEvent)

  // 等待 DOM 更新
  await nextTick()

  console.log('[文档流程平台] iframeRef.value:', iframeRef.value)

  // 监听 iframe 加载事件
  if (iframeRef.value) {
    iframeRef.value.addEventListener('load', () => {
      console.log('[文档流程平台] iframe 加载完成')
      console.log('[文档流程平台] iframe.src:', iframeRef.value?.src)
    })

    iframeRef.value.addEventListener('error', (e) => {
      console.error('[文档流程平台] iframe 加载失败:', e)
    })

    // 如果 token 已就绪，立即加载；否则等待 token
    if (userStore.token) {
      console.log('[文档流程平台] token 已就绪，开始首次加载')
      loadUrl()
    } else {
      console.log('[文档流程平台] token 未就绪，等待 token...')
    }
  } else {
    console.error('[文档流程平台] ❌ iframeRef 为空，无法加载！')
  }
})

// 监听 token 变化，token 就绪后加载
watch(() => userStore.token, (newToken) => {
  const currentSrc = iframeRef.value?.src || ''
  const isEmpty = !currentSrc || currentSrc === 'about:blank'
  if (newToken && iframeRef.value && (!documentUrl.value || loadError.value || isEmpty)) {
    console.log('[文档流程平台] token 已就绪，开始加载')
    loadUrl()
  }
})

// 监听 documentUrl 变化
watch(documentUrl, (newVal, oldVal) => {
  console.log('[文档流程平台] documentUrl 变化:', {
    oldVal,
    newVal,
    相同: oldVal === newVal
  })
})

// 监听路由参数变化（只在真正变化时才重新加载）
watch(() => route.query.url, (newUrl, oldUrl) => {
  console.log('[文档流程平台] 路由参数变化:', { newUrl, oldUrl })

  // 只在 URL 真正变化时才重新加载
  if (newUrl !== oldUrl) {
    console.log('[文档流程平台] URL 确实变化了，重新加载')
    loadUrl()
  } else {
    console.log('[文档流程平台] URL 未变化，跳过')
  }
})
</script>

<style lang="scss" scoped>
.document-process-container {
  width: 100%;
  height: calc(100vh - 50px);
  overflow: hidden;
  position: relative;
  z-index: 1;

  .document-webview {
    display: block;
    width: 100%;
    height: 100%;
    border: none;
    background: #fff;
    min-height: 500px;
    
    &.iframe-hidden {
      visibility: hidden;
    }
  }
  
  .error-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
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
