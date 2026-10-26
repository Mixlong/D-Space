import auth from '@/plugins/auth'
import router, { constantRoutes, dynamicRoutes } from '@/router'
import { getRouters } from '@/api/menu'
import { loadRemoteMenuConfig, getConfiguredMenuItems, findMenuOverride } from '@/utils/menuConfig'
import Layout from '@/layout/index'
import ParentView from '@/components/ParentView'
import InnerLink from '@/layout/components/InnerLink'

// 匹配views里面所有的.vue文件
const modules = import.meta.glob('./../../views/**/*.vue')

const usePermissionStore = defineStore(
  'permission',
  {
    state: () => ({
      routes: [],
      addRoutes: [],
      defaultRoutes: [],
      topbarRouters: [],
      sidebarRouters: [],
      menuConfig: {
        items: [],
        hasMenuList: false,
        byPath: {},
        byName: {}
      },
      menuConfigSyncing: false
    }),
    actions: {
      setRoutes(routes) {
        this.addRoutes = routes
        this.routes = constantRoutes.concat(routes)
      },
      setDefaultRoutes(routes) {
        this.defaultRoutes = constantRoutes.concat(routes)
      },
      setTopbarRoutes(routes) {
        this.topbarRouters = routes
      },
      setSidebarRouters(routes) {
        this.sidebarRouters = routes
      },
      setMenuConfig(config) {
        this.menuConfig = config
      },
      async syncRemoteMenus() {
        if (this.menuConfigSyncing) {
          return this.sidebarRouters
        }

        this.menuConfigSyncing = true
        try {
          const menuConfig = await loadRemoteMenuConfig()
          const { sidebarRoutes, webviewRoutes } = buildConfiguredMenuRoutes(
            constantRoutes.filter(route => !route.hidden),
            menuConfig
          )

          webviewRoutes.forEach(route => {
            const routeName = route.children?.[0]?.name
            if (!routeName || !router.hasRoute(routeName)) {
              router.addRoute(route)
            }
          })

          this.setSidebarRouters(sidebarRoutes)
          this.setMenuConfig(menuConfig)
          return sidebarRoutes
        } finally {
          this.menuConfigSyncing = false
        }
      },
      generateRoutes(roles) {
        return new Promise(async resolve => {
          // 暂时不加载后端路由，只使用前端定义的静态路由
          const asyncRoutes = filterDynamicRoutes(dynamicRoutes)
          asyncRoutes.forEach(route => {
            if (!router.hasRoute(route.name || '')) {
              router.addRoute(route)
            }
          })
          
          this.setRoutes([])
          await this.syncRemoteMenus()
          this.setDefaultRoutes([])
          this.setTopbarRoutes([])
          resolve([])
          
          // 注释掉原来的后端路由加载逻辑
          // getRouters().then(res => {
          //   const sdata = JSON.parse(JSON.stringify(res.data))
          //   const rdata = JSON.parse(JSON.stringify(res.data))
          //   const defaultData = JSON.parse(JSON.stringify(res.data))
          //   const sidebarRoutes = filterAsyncRouter(sdata)
          //   const rewriteRoutes = filterAsyncRouter(rdata, false, true)
          //   const defaultRoutes = filterAsyncRouter(defaultData)
          //   const asyncRoutes = filterDynamicRoutes(dynamicRoutes)
          //   asyncRoutes.forEach(route => { router.addRoute(route) })
          //   this.setRoutes(rewriteRoutes)
          //   this.setSidebarRouters(constantRoutes.concat(sidebarRoutes))
          //   this.setDefaultRoutes(sidebarRoutes)
          //   this.setTopbarRoutes(defaultRoutes)
          //   resolve(rewriteRoutes)
          // })
        })
      }
    }
  })

const normalizeMenuPath = (path) => {
  if (!path || typeof path !== 'string') return ''
  const normalized = path.startsWith('/') ? path : `/${path}`
  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
}

const createRouteName = (path) => {
  return normalizeMenuPath(path)
    .split('/')
    .filter(Boolean)
    .map(part => part.replace(/(^|-)([a-zA-Z0-9])/g, (_match, _prefix, char) => char.toUpperCase()))
    .join('') || `Webview${Date.now()}`
}

const getRouteChild = (route) => {
  return route?.children?.length === 1 ? route.children[0] : route
}

const getRoutePath = (route) => {
  return normalizeMenuPath(route?.path)
}

const getRouteName = (route) => {
  return getRouteChild(route)?.name || route?.name
}

const findLocalRoute = (routes, menuItem) => {
  const targetPath = normalizeMenuPath(menuItem.path)
  return routes.find(route => {
    const child = getRouteChild(route)
    return getRoutePath(route) === targetPath ||
      getRoutePath(child) === targetPath ||
      child?.name === menuItem.routeName ||
      route?.name === menuItem.routeName
  })
}

const cloneRouteWithMenuMeta = (route, menuItem) => {
  const type = String(menuItem.type || '').toLowerCase()
  const webviewConfig = type === 'webview' || type === 'iframe' || type === 'external'
    ? {
        ...menuItem,
        type: 'webview'
      }
    : undefined
  const clonedRoute = {
    ...route,
    meta: {
      ...(route.meta || {}),
      ...(webviewConfig ? { webviewConfig } : {})
    }
  }

  if (route.children) {
    clonedRoute.children = route.children.map((child, index) => {
      if (index !== 0 && route.children.length === 1) return child
      return {
        ...child,
        meta: {
          ...(child.meta || {}),
          title: menuItem.title || child.meta?.title,
          icon: menuItem.icon || child.meta?.icon,
          activeIcon: menuItem.activeIcon || child.meta?.activeIcon,
          ...(webviewConfig ? { webviewConfig } : {})
        }
      }
    })
  } else {
    clonedRoute.meta.title = menuItem.title || clonedRoute.meta.title
    clonedRoute.meta.icon = menuItem.icon || clonedRoute.meta.icon
    clonedRoute.meta.activeIcon = menuItem.activeIcon || clonedRoute.meta.activeIcon
    if (webviewConfig) {
      clonedRoute.meta.webviewConfig = webviewConfig
    }
  }

  return clonedRoute
}

const isWebviewType = (menuItem) => {
  const type = String(menuItem.type || '').toLowerCase()
  if (['webview', 'iframe', 'external'].includes(type)) return true
  if (['route', 'local', 'component'].includes(type)) return false
  return false
}

const createWebviewRoute = (menuItem) => {
  const path = normalizeMenuPath(menuItem.path)
  const routeName = menuItem.routeName || createRouteName(path)

  return {
    path,
    component: Layout,
    children: [
      {
        path: '',
        component: () => import('@/views/common/Webview/index.vue'),
        name: routeName,
        meta: {
          title: menuItem.title || '外部页面',
          icon: menuItem.icon || 'dty',
          activeIcon: menuItem.activeIcon,
          noCache: false,
          webviewConfig: {
            ...menuItem,
            type: 'webview',
            path,
            routeName
          }
        }
      }
    ]
  }
}

const buildConfiguredMenuRoutes = (localVisibleRoutes, menuConfig) => {
  const menuItems = getConfiguredMenuItems(menuConfig).filter(item => !item.hidden && item.path)
  const sidebarRoutes = []
  const webviewRoutes = []
  const usedRouteNames = new Set()
  const usedRoutePaths = new Set()

  const addRoute = (route) => {
    const routeName = getRouteName(route)
    const routePath = getRoutePath(route)
    if (routeName) usedRouteNames.add(routeName)
    if (routePath) usedRoutePaths.add(routePath)
    sidebarRoutes.push(route)
  }

  menuItems.forEach(menuItem => {
    const localRoute = findLocalRoute(localVisibleRoutes, menuItem)
    if (isWebviewType(menuItem) && !localRoute) {
      const webviewRoute = createWebviewRoute(menuItem)
      addRoute(webviewRoute)
      webviewRoutes.push(webviewRoute)
      return
    }

    if (localRoute) {
      addRoute(cloneRouteWithMenuMeta(localRoute, menuItem))
    } else {
      console.warn('[Permission] 菜单配置指向的本地路由不存在，已跳过:', menuItem)
    }
  })

  if (!menuConfig?.hasMenuList) {
    localVisibleRoutes.forEach(route => {
      const routeName = getRouteName(route)
      const routePath = getRoutePath(route)
      if (usedRouteNames.has(routeName) || usedRoutePaths.has(routePath)) return

      const override = findMenuOverride(menuConfig, route)
      addRoute(override ? cloneRouteWithMenuMeta(route, override) : route)
    })
  }

  return {
    sidebarRoutes: menuConfig?.hasMenuList ? sidebarRoutes : sidebarRoutes.length ? sidebarRoutes : localVisibleRoutes,
    webviewRoutes
  }
}

// 遍历后台传来的路由字符串，转换为组件对象
function filterAsyncRouter(asyncRouterMap, lastRouter = false, type = false) {
  return asyncRouterMap.filter(route => {
    if (type && route.children) {
      route.children = filterChildren(route.children)
    }
    if (route.component) {
      // Layout ParentView 组件特殊处理
      if (route.component === 'Layout') {
        route.component = Layout
      } else if (route.component === 'ParentView') {
        route.component = ParentView
      } else if (route.component === 'InnerLink') {
        route.component = InnerLink
      } else {
        route.component = loadView(route.component)
      }
    }
    if (route.children != null && route.children && route.children.length) {
      // 检查子路由名称是否与父路由重复（必须在递归调用之前）
      if (route.name) {
        route.children.forEach((child, index) => {
          if (child.name === route.name) {
            // 如果子路由名称与父路由相同，给子路由添加后缀
            const oldName = child.name
            child.name = child.name + 'Child'
            console.warn(`[路由冲突修复] 父路由: ${route.name}, 子路由: ${oldName} -> ${child.name}`)
          }
        })
      }
      route.children = filterAsyncRouter(route.children, route, type)
    } else {
      delete route['children']
      delete route['redirect']
    }
    return true
  })
}

function filterChildren(childrenMap, lastRouter = false) {
  var children = []
  childrenMap.forEach(el => {
    el.path = lastRouter ? lastRouter.path + '/' + el.path : el.path
    if (el.children && el.children.length && el.component === 'ParentView') {
      children = children.concat(filterChildren(el.children, el))
    } else {
      children.push(el)
    }
  })
  return children
}

// 动态路由遍历，验证是否具备权限
export function filterDynamicRoutes(routes) {
  const res = []
  routes.forEach(route => {
    if (route.permissions) {
      if (auth.hasPermiOr(route.permissions)) {
        res.push(route)
      }
    } else if (route.roles) {
      if (auth.hasRoleOr(route.roles)) {
        res.push(route)
      }
    }
  })
  return res
}

export const loadView = (view) => {
  let res
  for (const path in modules) {
    const dir = path.split('views/')[1].split('.vue')[0]
    if (dir === view) {
      res = () => modules[path]()
    }
  }
  return res
}

export default usePermissionStore
