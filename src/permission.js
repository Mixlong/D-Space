import router from './router'
import { ElMessage } from 'element-plus'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { getToken } from '@/utils/auth'
import { isHttp, isPathMatch } from '@/utils/validate'
import { isRelogin } from '@/utils/request'
import useUserStore from '@/store/modules/user'
import useSettingsStore from '@/store/modules/settings'
import usePermissionStore from '@/store/modules/permission'
import { initMqtt } from '@/plugins/mqtt'
import { startAppUpdateChecks } from '@/utils/appUpdate'

NProgress.configure({ showSpinner: false })

const whiteList = ['/login', '/register']

const isWhiteList = (path) => {
  return whiteList.some(pattern => isPathMatch(pattern, path))
}

router.beforeEach((to, from, next) => {
  NProgress.start()
  if (getToken()) {
    to.meta.title && useSettingsStore().setTitle(to.meta.title)
    /* has token*/
    if (to.path === '/login') {
      next({ path: '/' })
      NProgress.done()
    } else if (isWhiteList(to.path)) {
      next()
    } else {
      if (useUserStore().roles.length === 0) {
        isRelogin.show = true
        // 判断当前用户是否已拉取完user_info信息
        useUserStore().getInfo().then(() => {
          isRelogin.show = false

          // 用户信息获取成功后，初始化MQTT长连接
          console.log('[Permission] 用户信息加载完成，初始化MQTT连接...')
          startAppUpdateChecks() // getInfo 成功后读取字典策略并检查自动更新（后台静默）
          initMqtt().catch(error => {
            console.error('[Permission] MQTT初始化失败:', error)
          })

          usePermissionStore().generateRoutes().then(accessRoutes => {
            // 根据roles权限生成可访问的路由表
            accessRoutes.forEach(route => {
              if (!isHttp(route.path)) {
                router.addRoute(route) // 动态添加可访问路由表
              }
            })
            next({ ...to, replace: true }) // hack方法 确保addRoutes已完成
          })
        }).catch(err => {
          isRelogin.show = false
          // 如果是自动登录失败的错误，request.js 已经处理了跳转
          // 这里只需要确保进度条正确关闭
          if (err === '自动登录失败，请重新登录') {
            console.warn('[Permission] 自动登录失败，request.js 已处理跳转')
            NProgress.done()
            return
          }

          useUserStore().logOut().then(() => {
            // 静默处理token过期，不显示错误消息（用户会看到登录页）
            console.warn('[Permission] Token已过期，重定向到登录页')
            next({ path: '/login' })
          }).catch(() => {
            // 即使logout失败也要跳转到登录页
            console.warn('[Permission] Logout失败，但仍然重定向到登录页')
            next({ path: '/login' })
          })
        })
      } else {
        next()
      }
    }
  } else {
    // 没有token
    if (isWhiteList(to.path)) {
      // 在免登录白名单，直接进入
      next()
    } else {
      next(`/login?redirect=${to.fullPath}`) // 否则全部重定向到登录页
      NProgress.done()
    }
  }
})

router.afterEach(() => {
  NProgress.done()
})
