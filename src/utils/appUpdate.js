import request from '@/utils/request'
import { getToken } from '@/utils/auth'
import packageJson from '../../package.json'

// 字典类型：desktop_update_config（桌面端版本更新配置，版本号与动态下载地址均由字典下发）
// 每个「发布线_平台」一条数据：
//   dictLabel = 'modern_win' | 'modern_mac' | 'modern_linux' | 'legacy_win'
//   dictValue = 最新版本号（如 "1.0.26"），兼容直接存放 JSON
//   remark    = 扩展策略 JSON：
//     {
//       "enabled": true,                       // false：暂停推送
//       "version": "1.0.26",                   // 最新版本号，客户端直接与当前版本比较
//       "downloadUrl": "https://file.riding-evolved.com/.../D-Space-modern-x64.exe",
//                      // Mac 按架构区分：{"arm64":"https://.../a.zip","x64":"https://.../b.zip"}
//       "sha512": "可选安装包 sha512（hex 或 base64）",
//       "minVersion": "1.0.20",                // 当前版本低于它时强制更新
//       "description": "Windows 10/11 64位现代版"
//     }
//   更新说明沿用系统通知（类型 1，标题为版本号），发现新版本时与下载弹窗合并展示。
export const DESKTOP_UPDATE_DICT_TYPE = 'desktop_update_config'

const PLATFORM_KEY_MAP = {
  darwin: 'mac',
  win32: 'win',
  linux: 'linux'
}

// 常驻托盘的客户端定时复查：每 4 小时一次，窗口重新获得焦点时复查，且两次检查至少间隔 30 分钟
const RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
const MIN_CHECK_GAP_MS = 30 * 60 * 1000

// 比较版本号：a > b 返回 1，a < b 返回 -1，相等返回 0；无法解析返回 null
export function compareVersions(a, b) {
  const parse = (v) => {
    const m = String(v || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/)
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
  }
  const pa = parse(a)
  const pb = parse(b)
  if (!pa || !pb) return null
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1
  }
  return 0
}

/**
 * 解析单条字典记录，返回标准化更新策略
 * @param {Object} record - /system/dict/data/type/desktop_update_config 返回的单条项
 */
export function parseDesktopUpdatePolicy(record) {
  if (!record || String(record.status ?? '0') === '1') return null

  const valueText = String(record.dictValue || '').trim()
  const remarkText = String(record.remark || '').trim()

  // 1. 优先解析 remark 中的扩展 JSON，并以 dictValue 作为版本号主值
  if (remarkText.startsWith('{')) {
    try {
      const parsed = JSON.parse(remarkText)
      if (parsed && typeof parsed === 'object') {
        return {
          ...parsed,
          enabled: parsed.enabled !== false,
          version: (!valueText.startsWith('{') && valueText) ? valueText : (parsed.version || ''),
          downloadUrl: parsed.downloadUrl || '',
          minVersion: parsed.minVersion || '',
          sha512: parsed.sha512 || ''
        }
      }
    } catch (error) {
      console.error('[DesktopUpdate] 解析 remark JSON 失败:', error)
    }
  }

  // 2. 兼容 dictValue 本身存 JSON 的情况
  if (valueText.startsWith('{')) {
    try {
      const parsed = JSON.parse(valueText)
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch (error) {
      console.error('[DesktopUpdate] 解析 dictValue JSON 失败:', error)
      return null
    }
  }

  // 3. 兜底纯版本号
  return valueText ? { enabled: true, version: valueText, downloadUrl: '' } : null
}

export const parseAppUpdateDictValue = (rawValue, rawRemark = '') =>
  parseDesktopUpdatePolicy({ dictValue: rawValue, remark: rawRemark, status: '0' })

export const pickDownloadUrl = (downloadUrl, arch = 'arm64') => {
  if (typeof downloadUrl === 'string') return downloadUrl
  if (downloadUrl && typeof downloadUrl === 'object') {
    return downloadUrl[arch] || (arch === 'arm64' ? downloadUrl.arm64 : downloadUrl.x64) || downloadUrl.arm64 || downloadUrl.x64 || ''
  }
  return ''
}

const detectBrowserPlatform = () => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
  if (ua.includes('mac')) return 'darwin'
  if (ua.includes('linux')) return 'linux'
  return 'win32'
}

export const buildAppUpdateDictKey = (runtimeInfo) => {
  const channel = runtimeInfo?.activeReleaseChannel || packageJson.releaseChannel || 'modern'
  const rawPlatform = runtimeInfo?.platform || detectBrowserPlatform()
  const platform = PLATFORM_KEY_MAP[rawPlatform] || rawPlatform || ''
  return platform ? `${channel}_${platform}` : ''
}

// 读取字典中当前「发布线_平台」对应的更新策略；失败或未配置返回 null
// 更新检查属于后台行为：请求带 silent，失败只写日志，不弹接口错误提示
export const fetchAppUpdatePolicy = async (runtimeInfo) => {
  const key = buildAppUpdateDictKey(runtimeInfo)
  if (!key) return null

  try {
    const res = await request({
      url: '/system/dict/data/type/' + DESKTOP_UPDATE_DICT_TYPE,
      method: 'get',
      headers: { silent: true }
    })
    const list = Array.isArray(res?.data) ? res.data : []
    const matched = list.find(item => item.dictLabel === key && String(item.status ?? '0') !== '1')
    if (!matched) {
      console.warn('[DesktopUpdate] 字典中未配置更新项:', key)
      return null
    }
    return parseDesktopUpdatePolicy(matched)
  } catch (error) {
    console.warn('[DesktopUpdate] 读取桌面端更新字典失败，本次不检查更新:', error)
    return null
  }
}

let lastCheckAt = 0
let schedulerStarted = false
let recheckTimer = null
let latestAvailableUpdate = null

export const getLatestAvailableUpdate = () => latestAvailableUpdate

const runCheck = async (force = false) => {
  // 更新检查依赖登录态（字典接口需要 token）
  if (!getToken()) return false

  const now = Date.now()
  if (!force && now - lastCheckAt < MIN_CHECK_GAP_MS) return false
  lastCheckAt = now

  try {
    const runtimeInfo = window.electronAPI?.getRuntimeInfo
      ? await window.electronAPI.getRuntimeInfo()
      : null
    // 桌面端必须以实际运行的应用版本为准，不能拿本地前端包版本代替。
    const localVersion = runtimeInfo?.versions?.app || packageJson.version || '1.0.0'
    const policy = await fetchAppUpdatePolicy(runtimeInfo)
    const channelKey = buildAppUpdateDictKey(runtimeInfo)

    console.log('[DesktopUpdate] 字典更新检查:', {
      channelKey,
      localVersion,
      remoteVersion: policy?.version,
      policy
    })

    if (!policy || policy.enabled === false) return false

    const cmp = compareVersions(policy.version, localVersion)
    if (cmp !== null && cmp > 0) {
      const minCmp = policy.minVersion ? compareVersions(localVersion, policy.minVersion) : null
      const isForce = minCmp !== null && minCmp < 0
      const currentArch = runtimeInfo?.arch || (typeof process !== 'undefined' ? process.arch : 'arm64')
      const resolvedUrl = pickDownloadUrl(policy.downloadUrl, currentArch)
      if (!resolvedUrl) {
        console.warn('[DesktopUpdate] 未配置当前架构的下载地址:', channelKey)
        return false
      }

      // 旧客户端不支持字典下载指令，不能让界面假装下载后卡在 0 B。
      const supportsDictDownload = runtimeInfo?.updateTransport === 'dict-v1' &&
        typeof window.electronAPI?.checkForUpdatesWithConfig === 'function'
      const detail = {
        version: policy.version,
        currentVersion: localVersion,
        downloadUrl: resolvedUrl,
        requiresManualUpdate: !supportsDictDownload,
        policy: { force: isForce }
      }
      latestAvailableUpdate = detail
      window.dispatchEvent(new CustomEvent('desktop-update-available', { detail }))
    } else {
      latestAvailableUpdate = null
    }

    if (window.electronAPI?.checkForUpdatesWithConfig && runtimeInfo?.updateTransport === 'dict-v1') {
      window.electronAPI.checkForUpdatesWithConfig({
        ...policy,
        currentVersion: localVersion
      })
    }
    return cmp !== null && cmp > 0
  } catch (error) {
    console.warn('[DesktopUpdate] 更新检查失败:', error)
    return false
  }
}

// 供“重新下载”按钮使用，重新读取包含 sha512 的完整配置。
export const retryAppUpdateCheck = () => runCheck(true)

const handleWindowFocus = () => runCheck(false)

// 在 getInfo 成功后显式调用：立即检查一次，并开启定时/焦点复查
export const startAppUpdateChecks = () => {
  runCheck(true)

  if (schedulerStarted) return
  schedulerStarted = true

  recheckTimer = setInterval(() => runCheck(false), RECHECK_INTERVAL_MS)
  window.addEventListener('focus', handleWindowFocus)
}

// 退出登录时停止复查，下次登录重新开启
export const stopAppUpdateChecks = () => {
  if (recheckTimer) {
    clearInterval(recheckTimer)
    recheckTimer = null
  }
  window.removeEventListener('focus', handleWindowFocus)
  schedulerStarted = false
  lastCheckAt = 0
}
