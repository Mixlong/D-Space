import { findMenuOverride } from '@/utils/menuConfig'
import { buildUrlWithParams } from '@/utils/linkOpener'

export const getFirstQueryValue = (value) => {
  if (Array.isArray(value)) return value[0] || ''
  return value || ''
}

export const getRouteWebviewConfig = (route, menuConfig) => {
  const metaConfig = route?.meta?.webviewConfig || {}
  const menuOverride = findMenuOverride(menuConfig || {}, {
    path: route?.path,
    name: route?.name,
    meta: route?.meta,
    children: [
      {
        path: route?.path,
        name: route?.name,
        meta: route?.meta
      }
    ]
  }) || {}

  return {
    ...metaConfig,
    ...menuOverride
  }
}

export const getRouteQueryParams = (route, ignoredKeys = ['url']) => {
  return Object.keys(route?.query || {}).reduce((params, key) => {
    if (ignoredKeys.includes(key)) return params

    const value = getFirstQueryValue(route.query[key])
    if (value !== undefined && value !== null && value !== '') {
      params[key] = value
    }

    return params
  }, {})
}

export const normalizeUrlToBaseOrigin = (sourceUrl, baseUrl) => {
  if (!sourceUrl) return ''

  try {
    const parsedBaseUrl = new URL(baseUrl)
    const parsedSourceUrl = new URL(sourceUrl, parsedBaseUrl.origin)
    return `${parsedBaseUrl.origin}${parsedSourceUrl.pathname}${parsedSourceUrl.search}${parsedSourceUrl.hash}`
  } catch (error) {
    console.warn('[WebviewMenu] URL 解析失败，使用原始 URL:', error)
    return sourceUrl
  }
}

export const buildConfiguredWebviewUrl = ({
  route,
  menuConfig,
  defaultUrl,
  fallbackUrl,
  normalizeQueryUrlToDefaultOrigin = false,
  includeRouteQueryParams = true,
  ignoredRouteQueryKeys = ['url']
} = {}) => {
  const config = getRouteWebviewConfig(route, menuConfig)
  const queryUrl = getFirstQueryValue(route?.query?.url)
  const baseDefaultUrl = defaultUrl || fallbackUrl || ''

  let targetUrl = queryUrl || config.url || baseDefaultUrl

  if (queryUrl && normalizeQueryUrlToDefaultOrigin && baseDefaultUrl) {
    targetUrl = normalizeUrlToBaseOrigin(queryUrl, baseDefaultUrl)
  }

  const params = {
    ...(config.urlParams || {}),
    ...(includeRouteQueryParams ? getRouteQueryParams(route, ignoredRouteQueryKeys) : {})
  }

  return {
    config,
    targetUrl: buildUrlWithParams(targetUrl, params)
  }
}
