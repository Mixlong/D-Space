import useTagsViewStore from '@/store/modules/tagsView'
import router from '@/router'

export default {
  // 刷新当前tab页签
  async refreshPage(obj) {
    const { path, query, matched } = router.currentRoute.value
    if (obj === undefined) {
      matched.forEach((m) => {
        if (m.components && m.components.default && m.components.default.name) {
          if (!['Layout', 'ParentView'].includes(m.components.default.name)) {
            obj = { name: m.components.default.name, path: path, query: query }
          }
        }
      })
    }

    // iframe 类型页面（迪太云 / 文档流程）不在 keep-alive 里，
    // 走 delCachedView + redirect 的标准流程对它们无效。
    // 这里的"完全重置"分两步：
    //   1) 先清掉 Electron 渲染进程的 HTTP 缓存（含内存缓存）。
    //      远程 SPA 的子接口（如 space/list）由 SPA 自己发起，
    //      给 iframe 主文档加 cache-bust query 没用；远程后端可能配了
    //      Cache-Control: max-age 让 Chromium 复用旧响应，必须主动清。
    //   2) 派发 reset-* 事件，让 AppMain 通过递增 :key 销毁 iframe 组件并重建，
    //      连同父组件 isLoading / retryCount / cacheBustToken 全部归零。
    // 区别于侧边栏点菜单时派发的 refresh-* 轻量刷新事件（仅重新加载 iframe 内嵌站点）。
    const targetPath = (obj && obj.path) || path
    const isDiTai = targetPath && targetPath.includes('/ditai-cloud')
    const isDocument = targetPath && targetPath.includes('/document-process')
    console.log('[tab.refreshPage] 入口', { targetPath, isDiTai, isDocument, obj })
    if (isDiTai || isDocument) {
      // 仅 Electron 环境下能调，web 模式下 electronAPI 不存在则跳过
      if (window.electronAPI && typeof window.electronAPI.clearCache === 'function') {
        console.log('[tab.refreshPage] 调用 clearCache...')
        try {
          const result = await window.electronAPI.clearCache()
          console.log('[tab.refreshPage] clearCache 完成:', result)
        } catch (e) {
          console.warn('[tab.refreshPage] 清缓存失败，继续重建 iframe:', e)
        }
      } else {
        console.warn('[tab.refreshPage] electronAPI.clearCache 不存在，跳过清缓存')
      }
      const eventName = isDiTai ? 'reset-ditai-cloud' : 'reset-document-process'
      console.log('[tab.refreshPage] 派发事件:', eventName)
      window.dispatchEvent(new CustomEvent(eventName))
      return
    }

    return useTagsViewStore().delCachedView(obj).then(() => {
      const { path, query } = obj
      router.replace({
        path: '/redirect' + path,
        query: query
      })
    })
  },
  // 关闭当前tab页签，打开新页签
  closeOpenPage(obj) {
    useTagsViewStore().delView(router.currentRoute.value)
    if (obj !== undefined) {
      return router.push(obj)
    }
  },
  // 关闭指定tab页签
  closePage(obj) {
    if (obj === undefined) {
      return useTagsViewStore().delView(router.currentRoute.value).then(({ visitedViews }) => {
        const latestView = visitedViews.slice(-1)[0]
        if (latestView) {
          return router.push(latestView.fullPath)
        }
        return router.push('/')
      })
    }
    return useTagsViewStore().delView(obj)
  },
  // 关闭所有tab页签
  closeAllPage() {
    return useTagsViewStore().delAllViews()
  },
  // 关闭左侧tab页签
  closeLeftPage(obj) {
    return useTagsViewStore().delLeftTags(obj || router.currentRoute.value)
  },
  // 关闭右侧tab页签
  closeRightPage(obj) {
    return useTagsViewStore().delRightTags(obj || router.currentRoute.value)
  },
  // 关闭其他tab页签
  closeOtherPage(obj) {
    return useTagsViewStore().delOthersViews(obj || router.currentRoute.value)
  },
  // 打开tab页签
  openPage(title, url, params) {
    const obj = { path: url, meta: { title: title } }
    useTagsViewStore().addView(obj)
    return router.push({ path: url, query: params })
  },
  // 修改tab页签
  updatePage(obj) {
    return useTagsViewStore().updateVisitedView(obj)
  }
}
