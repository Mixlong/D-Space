import request from '@/utils/request'
import { getToken } from '@/utils/auth'

const EMPTY_MENU_CONFIG = {
  items: [],
  hasMenuList: false,
  byPath: {},
  byName: {}
}

export const DESKTOP_MENU_DICT_TYPE = 'desktop_menu_config'

const normalizePath = (path) => {
  if (!path || typeof path !== 'string') return ''
  if (path === '/') return path
  return path.endsWith('/') ? path.slice(0, -1) : path
}

const normalizeMenuItem = (value, fallbackPath) => {
  if (typeof value === 'string') {
    return {
      type: 'route',
      path: fallbackPath,
      title: value
    }
  }

  if (!value || typeof value !== 'object') return null

  const title = value.title || value.name || value.label || value.menuName
  const path = value.path || value.routePath || fallbackPath
  const routeName = value.routeName || value.nameKey || value.componentName
  const type = value.type || value.routeType || value.renderType || value.mode

  if (!title && value.hidden === undefined) return null

  return {
    ...value,
    path,
    routeName,
    title,
    type,
    icon: value.icon || value.iconUrl || value.svg || value.svgUrl,
    activeIcon: value.activeIcon || value.iconActive || value.activeIconUrl || value.activeSvgUrl,
    url: value.url || value.webviewUrl || value.targetUrl,
    urlParams: value.urlParams || value.queryParams || value.params || value.query,
    tokenParamName: value.tokenParamName || value.token?.paramName,
    stripBearer: value.stripBearer !== undefined ? value.stripBearer : value.token?.stripBearer,
    appendToken: value.appendToken !== undefined ? value.appendToken : value.token?.enabled,
    hidden: value.hidden === true
  }
}

export const normalizeMenuConfig = (rawConfig) => {
  const normalized = {
    items: [],
    hasMenuList: false,
    byPath: {},
    byName: {}
  }

  const addItem = (item) => {
    if (!item) return

    if (item.path) {
      normalized.byPath[normalizePath(item.path)] = item
    }

    if (item.routeName) {
      normalized.byName[item.routeName] = item
    }

    normalized.items.push(item)
  }

  if (Array.isArray(rawConfig)) {
    normalized.hasMenuList = true
    rawConfig.forEach(item => addItem(normalizeMenuItem(item)))
    return normalized
  }

  if (!rawConfig || typeof rawConfig !== 'object') {
    return normalized
  }

  const menuList = rawConfig.menus || rawConfig.menuList || rawConfig.routes
  if (Array.isArray(menuList)) {
    normalized.hasMenuList = true
    menuList.forEach(item => addItem(normalizeMenuItem(item)))
  }

  Object.keys(rawConfig).forEach(key => {
    if (['menus', 'menuList', 'routes', 'examples', 'schema', 'version'].includes(key)) return
    addItem(normalizeMenuItem(rawConfig[key], key))
  })

  return normalized
}

const parseMenuConfigText = (text) => {
  try {
    return JSON.parse(text)
  } catch (error) {
    const sanitizedText = text.replace(/,\s*([}\]])/g, '$1')
    if (sanitizedText === text) {
      throw error
    }
    return JSON.parse(sanitizedText)
  }
}

export const parseDictMenuItem = (record) => {
  if (!record || String(record.status ?? '0') === '1') return null

  const title = String(record.dictLabel || '').trim()
  const path = String(record.dictValue || '').trim()
  if (!title || !path) return null

  let extra = {}
  const remarkText = String(record.remark || '').trim()
  if (remarkText.startsWith('{')) {
    try {
      const parsed = JSON.parse(remarkText)
      if (parsed && typeof parsed === 'object') {
        extra = parsed
      }
    } catch (error) {
      console.warn('[MenuConfig] 解析菜单字典 remark JSON 失败:', record.dictLabel, error)
    }
  }

  return {
    ...extra,
    title,
    path,
    type: extra.type || (extra.url ? 'webview' : 'route'),
    hidden: extra.hidden === true
  }
}

const fetchMenuConfigFromDict = async () => {
  if (!getToken()) {
    return EMPTY_MENU_CONFIG
  }

  const res = await request({
    url: '/system/dict/data/type/' + DESKTOP_MENU_DICT_TYPE,
    method: 'get',
    headers: { silent: true }
  })
  const rows = Array.isArray(res?.data) ? res.data : []
  const activeRows = rows.filter(r => r && String(r.status ?? '0') !== '1')
  if (!activeRows.length) {
    return EMPTY_MENU_CONFIG
  }

  // 1. 兼容单条记录直接存放完整菜单 JSON（存放在 remark 或 dictValue 中）
  for (const row of activeRows) {
    const rawCandidate = [row.remark, row.dictValue]
      .map(v => String(v || '').trim())
      .find(v => v.startsWith('{') || v.startsWith('['))

    if (rawCandidate) {
      try {
        const parsed = parseMenuConfigText(rawCandidate)
        if (Array.isArray(parsed) || Array.isArray(parsed?.menus) || Array.isArray(parsed?.menuList) || Array.isArray(parsed?.routes)) {
          const normalized = normalizeMenuConfig(parsed)
          if (normalized.items.length) {
            return normalized
          }
        }
      } catch (e) {
        console.warn('[MenuConfig] 解析单条完整菜单 JSON 失败，尝试按多条记录解析:', e)
      }
    }
  }

  // 2. 按字典多条记录解析（dictSort 升序，dictLabel=标题，dictValue=路径，remark=扩展 JSON）
  const sortedRows = [...activeRows].sort(
    (a, b) => Number(a?.dictSort ?? 0) - Number(b?.dictSort ?? 0)
  )
  const items = sortedRows.map(parseDictMenuItem).filter(Boolean)
  if (!items.length) {
    return EMPTY_MENU_CONFIG
  }

  return normalizeMenuConfig({ menus: items })
}

export const loadRemoteMenuConfig = async () => {
  try {
    return await fetchMenuConfigFromDict()
  } catch (error) {
    console.warn('[MenuConfig] 读取字典菜单配置失败，使用本地路由默认菜单:', error?.message || error)
    return EMPTY_MENU_CONFIG
  }
}

export const findMenuOverride = (menuConfig, routeItem) => {
  const childRoute = routeItem?.children?.length === 1 ? routeItem.children[0] : routeItem
  const routePath = normalizePath(routeItem?.path)
  const childPath = normalizePath(childRoute?.path)

  return menuConfig.byPath[routePath] ||
    menuConfig.byPath[childPath] ||
    menuConfig.byName[childRoute?.name] ||
    menuConfig.byName[routeItem?.name] ||
    null
}

export const getConfiguredMenuItems = (menuConfig) => {
  return Array.isArray(menuConfig?.items) ? menuConfig.items : []
}
