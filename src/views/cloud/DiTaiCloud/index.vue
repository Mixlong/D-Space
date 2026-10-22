<template>
  <div class="ditai-cloud-container">
    <!-- 加载状态提示 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>{{ userStore.token ? '正在加载运营管理平台...' : '正在等待登录状态...' }}</p>
      <span class="loading-time" v-if="loadingSeconds > 0">已等待 {{ loadingSeconds }} 秒</span>
      <span class="loading-hint" v-if="loadingSeconds >= 10">网络较慢，请稍候...</span>
    </div>
    <!-- 加载失败提示 -->
    <div v-if="loadError" class="error-overlay">
      <p>⚠️ 页面加载失败</p>
      <span class="error-hint" v-if="retryCount >= maxRetries">已自动重试 {{ maxRetries }} 次，仍然失败</span>
      <span class="error-hint" v-else>网络连接异常或服务器无响应</span>
      <button @click="retryLoad">点击重试</button>
    </div>
    <iframe 
      ref="iframeRef"
      class="cloud-webview"
      :class="{ 'iframe-hidden': isLoading || loadError }"
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
  name: 'DiTaiCloud'
}
</script>

<script setup>
import { ref, onMounted, onActivated, onDeactivated, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { buildUrlWithToken } from '@/utils/linkOpener'
import useUserStore from '@/store/modules/user'

const route = useRoute()
const userStore = useUserStore()
const cloudUrl = ref('')
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
  console.log('[迪太云管理] ✅ iframe 加载完成，耗时:', loadingSeconds.value, '秒')
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
  console.error('[迪太云管理] ❌ iframe 加载失败:', e)
  isLoading.value = false
  loadError.value = true
  retryCount.value++
}

// 重试加载
const retryLoad = () => {
  console.log('[迪太云管理] 🔄 重试加载...')
  loadError.value = false
  isLoading.value = true
  retryCount.value = 0
  loadUrl()
}

// 自动重试加载（用于组件激活时）
const autoRetryLoad = () => {
  console.log('[迪太云管理] 🔄 自动重试加载...')
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
    // 如果仍在加载中，说明超时了
    if (isLoading.value && !loadError.value) {
      console.warn('[迪太云管理] ⏰ 加载超时，尝试重新加载...')
      
      if (retryCount.value < maxRetries) {
        retryCount.value++
        console.log(`[迪太云管理] 🔄 自动重试 (${retryCount.value}/${maxRetries})`)
        loadUrl()
      } else {
        console.error('[迪太云管理] ❌ 达到最大重试次数，显示错误')
        isLoading.value = false
        loadError.value = true
      }
    }
  }, loadTimeoutMs)
}

// 强制刷新 iframe（通过 cache bust 避免浏览器缓存）
const forceRefresh = () => {
  console.log('[迪太云管理] 🔄 强制刷新 iframe（cache bust）')
  loadUrl({ forceRefresh: true })
}

// 监听刷新事件
const handleRefreshEvent = () => {
  forceRefresh()
}

onMounted(() => {
  window.addEventListener('refresh-ditai-cloud', handleRefreshEvent)
})

onBeforeUnmount(() => {
  window.removeEventListener('refresh-ditai-cloud', handleRefreshEvent)
})

// 监控组件激活/失活状态
onActivated(() => {
  console.log('[迪太云管理] 🟢 组件被激活')
  console.log('[迪太云管理] 📍 当前 cloudUrl:', cloudUrl.value)
  console.log('[迪太云管理] 📍 当前 iframe.src:', iframeRef.value?.src)
  console.log('[迪太云管理] 📍 加载状态:', { isLoading: isLoading.value, loadError: loadError.value })
  
  // 检查 iframe 当前状态
  const currentSrc = iframeRef.value?.src || ''
  const isEmpty = !currentSrc || currentSrc === 'about:blank' || currentSrc === ''
  
  // 如果之前加载失败，或者 iframe 为空，自动重新加载
  if (loadError.value) {
    console.log('[迪太云管理] 🔄 检测到之前加载失败，自动重新加载')
    retryCount.value = 0  // 重置重试计数
    autoRetryLoad()
  } else if (isEmpty && userStore.token) {
    console.log('[迪太云管理] 🔄 检测到 iframe 为空，自动加载')
    loadUrl()
  } else {
    // 正常情况下检查路由参数是否变化
    loadUrl()
  }
})

onDeactivated(() => {
  console.log('[迪太云管理] 🔴 组件被失活（进入缓存）')
  // 清除加载超时计时器
  if (loadTimeout.value) {
    clearTimeout(loadTimeout.value)
    loadTimeout.value = null
  }
})

// 根据环境选择域名
const getCloudBaseUrl = () => {
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development'
  
  if (isDev) {
  return import.meta.env.VITE_APP_DIGI_CLOUD_URL  
  } else {
    return import.meta.env.VITE_APP_DIGI_CLOUD_URL || 'http://cloud.riding-evolved.com/digiSmart/redirect'
  }
}

// 加载 URL
const loadUrl = (options = {}) => {
  const { forceRefresh = false } = options
  const urlFromQuery = route.query.url
  let targetUrl = getCloudBaseUrl()
  
  // 如果有路由参数，替换域名但保留路径和参数
  if (urlFromQuery) {
    try {
      const envBaseUrl = new URL(getCloudBaseUrl())
      const queryUrl = new URL(urlFromQuery)
      
      // 使用环境配置的域名 + 传入的路径和参数
      targetUrl = envBaseUrl.origin + queryUrl.pathname + queryUrl.search + queryUrl.hash
      console.log('[迪太云管理] 🔄 替换域名:', {
        原始URL: urlFromQuery,
        环境域名: envBaseUrl.origin,
        最终URL: targetUrl
      })
    } catch (e) {
      console.warn('[迪太云管理] ⚠️ URL 解析失败，使用默认URL:', e)
      targetUrl = getCloudBaseUrl()
    }
  }
  
  console.log('[迪太云管理] 📍 开始加载 URL:', targetUrl)
  console.log('[迪太云管理] 📍 路由参数:', route.query)
  
  if (!userStore.token) {
    console.error('[迪太云管理] ⚠️ token 为空！')
    isLoading.value = true
    loadError.value = false
    return
  }
  
  const nextCacheBustToken = forceRefresh ? Date.now().toString() : cacheBustToken.value
  if (forceRefresh) {
    cacheBustToken.value = nextCacheBustToken
  }

  const nextUrl = buildUrlWithToken(targetUrl, userStore.token, {
    paramName: 'ddsToken',
    stripBearer: true,
    extraParams: { _t: nextCacheBustToken }
  })
  
  // 检查当前 iframe 的 src 是否已经是目标 URL
  const currentSrc = iframeRef.value?.src || ''
  if (!forceRefresh && currentSrc === nextUrl) {
    console.log('[迪太云管理] ⏭️ iframe src 未变化，跳过加载')
    return
  }
  
  // 手动设置 iframe.src（只在真正变化时）
  if (iframeRef.value) {
    console.log('[迪太云管理] ✅ 设置 iframe.src:', nextUrl)
    isLoading.value = true  // 设置加载状态
    loadError.value = false
    iframeRef.value.src = nextUrl
    cloudUrl.value = nextUrl
    
    // 启动计时器
    startLoadingTimer()
    // 启动加载超时检测
    startLoadTimeout()
  }
}

onMounted(async () => {
  console.log('[迪太云管理] 🚀 组件已挂载')

  // 等待 DOM 更新
  await nextTick()

  console.log('[迪太云管理] 📍 iframeRef.value:', iframeRef.value)

  // 监听 iframe 加载事件
  if (iframeRef.value) {
    iframeRef.value.addEventListener('load', () => {
      console.log('[迪太云管理] ✅ iframe 加载完成')
      console.log('[迪太云管理] 📍 iframe.src:', iframeRef.value?.src)
    })

    iframeRef.value.addEventListener('error', (e) => {
      console.error('[迪太云管理] ❌ iframe 加载失败:', e)
    })
  }

  // 如果 token 已就绪，立即加载；否则等待 token
  if (userStore.token) {
    console.log('[迪太云管理] token 已就绪，开始首次加载')
    loadUrl()
  } else {
    console.log('[迪太云管理] token 未就绪，等待 token...')
  }
})

// 监听 token 变化，token 就绪后加载
watch(() => userStore.token, (newToken) => {
  const currentSrc = iframeRef.value?.src || ''
  const isEmpty = !currentSrc || currentSrc === 'about:blank'
  if (newToken && iframeRef.value && (!cloudUrl.value || loadError.value || isEmpty)) {
    console.log('[迪太云管理] token 已就绪，开始加载')
    loadUrl()
  }
})

// 监听 cloudUrl 变化，追踪 iframe src 的变化时机
watch(cloudUrl, (newVal, oldVal) => {
  console.log('[迪太云管理] 🔄 cloudUrl 变化:', { 
    oldVal, 
    newVal, 
    相同: oldVal === newVal 
  })
})

// 监听路由参数变化（只在真正变化时才重新加载）
watch(() => route.query.url, (newUrl, oldUrl) => {
  console.log('[迪太云管理] 📍 路由参数变化:', { newUrl, oldUrl })
  
  // 只在 URL 真正变化时才重新加载
  if (newUrl !== oldUrl) {
    console.log('[迪太云管理] ✅ URL 确实变化了，重新加载')
    loadUrl()
  } else {
    console.log('[迪太云管理] ⏭️ URL 未变化，跳过')
  }
})

</script>

<style lang="scss" scoped>
.ditai-cloud-container {
  width: 100%;
  height: calc(100vh - 54px);
  overflow: hidden;
  position: relative;
  
  .cloud-webview {
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
  
  .loading-overlay,
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
    
    .loading-time {
      margin-top: 8px;
      color: #909399;
      font-size: 12px;
    }
    
    .loading-hint {
      margin-top: 4px;
      color: #e6a23c;
      font-size: 12px;
    }
    
    .error-hint {
      margin-top: 8px;
      color: #909399;
      font-size: 12px;
    }
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e4e7ed;
    border-top-color: #409eff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
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
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
}
</style>
