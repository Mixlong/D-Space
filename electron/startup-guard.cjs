'use strict'

// Keep the first-launch window from hanging indefinitely if Vue/IAM/router boot stalls.
function createStartupGuard({
  onRetry,
  onFailure,
  logger = () => {},
  timeoutMs = 15000,
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  let timer = null
  let confirmed = false
  let retryUsed = false
  let stopped = false
  let reported = false

  function clear() {
    if (timer !== null) cancel(timer)
    timer = null
  }

  function arm() {
    clear()
    if (stopped || confirmed || reported) return
    timer = schedule(() => {
      timer = null
      if (stopped || confirmed || reported) return
      if (!retryUsed) {
        retryUsed = true
        logger('[启动] 首次加载超时，尝试重新加载页面一次')
        try {
          onRetry()
          arm()
        } catch (error) {
          logger('[启动] 自动重新加载失败: ' + error.message)
          fail('reload-failed')
        }
      } else {
        fail('renderer-not-ready')
      }
    }, timeoutMs)
  }

  function fail(reason) {
    if (stopped || confirmed || reported) return
    clear()
    reported = true
    logger('[启动] 页面未能初始化完成: ' + reason)
    onFailure(reason)
  }

  return {
    start: arm,
    ready() {
      if (stopped || confirmed) return
      confirmed = true
      clear()
      logger('[启动] Vue 页面及初始路由已经就绪')
    },
    fail,
    stop() { stopped = true; clear() },
    retry() {
      if (stopped) return
      reported = false
      confirmed = false
      retryUsed = true
      arm()
    },
    isReady: () => confirmed,
  }
}

module.exports = { createStartupGuard }
