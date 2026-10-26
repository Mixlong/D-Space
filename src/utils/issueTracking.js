import { buildUrlWithParams } from '@/utils/linkOpener'

const DEV_ISSUE_TRACKING_URL = 'http://192.168.2.224:3002/internal-issue'
const ISSUE_TRACKING_PATH = '/internal-issue'
const ISSUE_TRACKING_ROUTE_NAME = 'Internal-issue'
const CLOUD_FALLBACK_URL = 'https://cloud.riding-evolved.com/digiSmart/redirect'

const isDevEnv = () => import.meta.env.DEV || import.meta.env.MODE === 'development'
const getCurrentOrigin = () => (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null')
  ? window.location.origin
  : getCloudOrigin()

const getCloudOrigin = () => {
  const cloudUrl = import.meta.env.VITE_APP_DIGI_CLOUD_URL || CLOUD_FALLBACK_URL

  try {
    return new URL(cloudUrl).origin
  } catch (error) {
    console.warn('[IssueTracking] 解析运营平台域名失败，使用兜底域名', error)
    return new URL(CLOUD_FALLBACK_URL).origin
  }
}

const isIssueTrackingRouteName = (value = '') =>
  String(value || '').toLowerCase() === ISSUE_TRACKING_ROUTE_NAME.toLowerCase()

export const getIssueTrackingBaseUrl = () => {
  if (isDevEnv()) {
    return DEV_ISSUE_TRACKING_URL
  }

  return `${getCloudOrigin()}${ISSUE_TRACKING_PATH}`
}

export const isIssueTrackingUrl = (url = '') => {
  if (!url || typeof url !== 'string') return false

  try {
    const parsedUrl = new URL(url, getCurrentOrigin())
    if (parsedUrl.pathname.includes(ISSUE_TRACKING_PATH)) return true

    const routeName = parsedUrl.searchParams.get('name') || parsedUrl.searchParams.get('routeName')
    if (isIssueTrackingRouteName(routeName)) return true

    if (parsedUrl.hash.includes('?')) {
      const hashQuery = parsedUrl.hash.slice(parsedUrl.hash.indexOf('?') + 1)
      const hashParams = new URLSearchParams(hashQuery)
      return isIssueTrackingRouteName(hashParams.get('name') || hashParams.get('routeName'))
    }

    return false
  } catch (_error) {
    return url.includes(ISSUE_TRACKING_PATH) ||
      /(?:[?&#])(name|routeName)=Internal-issue(?:[&#]|$)/i.test(url)
  }
}

const getQueryValue = (url, names = []) => {
  if (!url || typeof url !== 'string') return ''

  try {
    const parsedUrl = new URL(url, getCurrentOrigin())
    for (const name of names) {
      const value = parsedUrl.searchParams.get(name)
      if (value) return value
    }

    if (parsedUrl.hash.includes('?')) {
      const hashQuery = parsedUrl.hash.slice(parsedUrl.hash.indexOf('?') + 1)
      const hashParams = new URLSearchParams(hashQuery)
      for (const name of names) {
        const value = hashParams.get(name)
        if (value) return value
      }
    }
  } catch (_error) {
    const queryIndex = url.indexOf('?')
    if (queryIndex === -1) return ''

    const query = url.slice(queryIndex + 1).split('#')[0]
    const params = new URLSearchParams(query)
    for (const name of names) {
      const value = params.get(name)
      if (value) return value
    }
  }

  return ''
}

export const getIssueTrackingIdFromUrl = (url = '') =>
  getQueryValue(url, ['id', 'issueId', 'issue_id'])

export const getIssueTrackingTabTypeFromUrl = (url = '') =>
  getQueryValue(url, ['tabType', 'issueMessageType', 'viewMode'])

export const getIssueTrackingViewModeByTabType = (tabType) => {
  const value = String(tabType ?? '').trim()
  const viewModeMap = {
    1: 'mine',
    2: 'reported',
    3: 'participated',
    mine: 'mine',
    reported: 'reported',
    participated: 'participated'
  }

  return viewModeMap[value] || ''
}

export const getIssueTrackingIdFromItem = (item = {}) => {
  const source = item || {}
  const candidates = [
    source.issueId,
    source.issue_id,
    source.assignmentId,
    source.id,
    source.businessId,
    source.business_id,
    source.relationId,
    source.processInstanceId,
    source.taskId
  ]

  return candidates.find(value => value !== undefined && value !== null && value !== '') || ''
}

export const normalizeIssueTrackingUrl = (sourceUrl = '', extraParams = {}) => {
  let targetUrl = getIssueTrackingBaseUrl()

  if (sourceUrl) {
    try {
      const envBaseUrl = new URL(getIssueTrackingBaseUrl())
      const parsedSourceUrl = new URL(sourceUrl, envBaseUrl.origin)

      if (parsedSourceUrl.pathname.includes(ISSUE_TRACKING_PATH)) {
        targetUrl = `${envBaseUrl.origin}${parsedSourceUrl.pathname}${parsedSourceUrl.search}${parsedSourceUrl.hash}`
      } else {
        const routeName = parsedSourceUrl.searchParams.get('name') || parsedSourceUrl.searchParams.get('routeName')
        if (isIssueTrackingRouteName(routeName)) {
          const sourceParams = {}
          parsedSourceUrl.searchParams.forEach((value, key) => {
            if (key !== 'name' && key !== 'routeName') {
              sourceParams[key] = value
            }
          })
          targetUrl = buildUrlWithParams(getIssueTrackingBaseUrl(), sourceParams)
        }
      }
    } catch (error) {
      console.warn('[IssueTracking] 解析来源 URL 失败，使用默认地址', error)
    }
  }

  return buildUrlWithParams(targetUrl, {
    ...extraParams,
    fullscreen: 1
  })
}

export const getIssueTrackingRouteLocation = ({ url, id, query = {} } = {}) => {
  const nextQuery = { ...query }

  if (url) {
    nextQuery.url = url
  }

  if (id !== undefined && id !== null && id !== '') {
    nextQuery.id = String(id)
  }

  return {
    path: '/issue-tracking',
    query: nextQuery
  }
}

export const buildIssueTrackingTargetUrl = ({ url, id, tabType, issueMessageType, viewMode } = {}) =>
  normalizeIssueTrackingUrl(url, {
    ...(id !== undefined && id !== null && id !== '' ? { id: String(id) } : {}),
    ...(tabType !== undefined && tabType !== null && tabType !== '' ? { tabType: String(tabType) } : {}),
    ...(issueMessageType !== undefined && issueMessageType !== null && issueMessageType !== '' ? { issueMessageType: String(issueMessageType) } : {}),
    ...(viewMode ? { viewMode } : {})
  })

export const getBusinessLinkRouteLocation = (url, extraQuery = {}) => {
  if (isIssueTrackingUrl(url)) {
    return getIssueTrackingRouteLocation({
      url,
      id: getIssueTrackingIdFromUrl(url),
      query: extraQuery
    })
  }

  return {
    path: '/ditai-cloud',
    query: {
      url
    }
  }
}
