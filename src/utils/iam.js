import Cookies from 'js-cookie'

// Electron: 加密文件为主存储，内存只缓存当前登录会话的 IAM。
// 浏览器：沿用 localStorage；首次 Electron 启动会迁移旧 localStorage/Cookie。
let credentials = { iamKey: '', iamValue: '' }
let persistedCredentials = null
let initialization = null
let writeQueue = Promise.resolve()

function isElectronApp() {
  return typeof window !== 'undefined' && window.electronAPI?.isElectron === true
}

function iamStorageApi() {
  if (!isElectronApp()) return null
  const api = window.electronAPI.iamStorage
  return api?.load && api?.save ? api : null
}

function legacyCredentials() {
  try {
    return {
      iamKey: localStorage.getItem('iamKeys') || Cookies.get('iamKeys') || '',
      iamValue: localStorage.getItem('iamValue') || Cookies.get('iamValue') || ''
    }
  } catch (error) {
    console.warn('[IAM] 旧浏览器存储不可读取:', error)
    return { iamKey: '', iamValue: '' }
  }
}

function clearLegacy() {
  // 只有文件确认写入成功或已成功恢复文件时才清理旧明文副本。
  try {
    localStorage.removeItem('iamKeys')
    localStorage.removeItem('iamValue')
    Cookies.remove('iamKeys')
    Cookies.remove('iamValue')
  } catch (error) {
    console.warn('[IAM] 无法移除旧存储中的 IAM:', error)
  }
}

function reportWriteFailure(error) {
  console.warn('[IAM] 加密文件保存失败，本次仅使用内存 IAM:', error)
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event('iam-storage-write-failed'))
  }
}

function queueEncryptedSave(snapshot) {
  const api = iamStorageApi()
  const operation = writeQueue.then(async () => {
    const result = await api.save({ ...snapshot })
    if (!result?.ok) throw new Error('iam-save-not-confirmed')
  })
  // 保存按收到的次序执行；一次写入失败不阻塞下一次新 IAM 写入。
  writeQueue = operation.catch(() => {})
  return operation
}

async function restoreIam() {
  const api = iamStorageApi()
  if (!api) {
    credentials = legacyCredentials()
    if (!isElectronApp()) persistedCredentials = { ...credentials }
    if (isElectronApp()) {
      return { ok: false, warning: 'Electron IAM 文件接口不可用，当前 IAM 尚未持久化到加密文件' }
    }
    return { ok: true, source: 'browser' }
  }

  let stored
  try {
    stored = await api.load()
  } catch (error) {
    console.warn('[IAM] 读取加密文件失败:', error)
    credentials = legacyCredentials()
    return { ok: false, warning: 'IAM 加密文件读取失败，请检查系统密钥和应用数据目录' }
  }

  if (stored?.status === 'ok' && stored.credentials?.iamValue) {
    credentials = {
      iamKey: stored.credentials.iamKey || '',
      iamValue: stored.credentials.iamValue
    }
    persistedCredentials = { ...credentials }
    clearLegacy()
    return { ok: true, source: 'file' }
  }

  const legacy = legacyCredentials()
  credentials = legacy
  if (stored?.status !== 'missing') {
    // 解密失败不将旧明文无条件覆盖到磁盘，保留文件以供排查。
    return { ok: false, warning: 'IAM 加密文件无法解密，当前仅尝试使用旧浏览器凭据' }
  }
  if (!legacy.iamValue) return { ok: true, source: 'empty' }

  try {
    await queueEncryptedSave(legacy)
    persistedCredentials = { ...legacy }
    clearLegacy()
    return { ok: true, source: 'migrated' }
  } catch (error) {
    console.warn('[IAM] 旧 IAM 迁移加密文件失败:', error)
    return { ok: false, warning: 'IAM 迁移加密文件失败，现有 IAM 暂时仍保存在旧存储中' }
  }
}

export function initializeIam() {
  if (!initialization) initialization = restoreIam()
  return initialization
}

// 在 Electron 中只读取已恢复的内存副本；不再依赖页面 URL 的 localStorage。
export function getIamValue() {
  return credentials.iamValue
}

// 登录、短信验证等响应返回新 IAM 时，立即替换缓存并等待落盘。
// 没有返回新 IAM 则保留原值；文件写入失败不阻止本次认证，但必须提示用户。
export async function updateIamFromResponse(response) {
  const candidates = [response?.data?.data, response?.data, response]
  const issued = candidates.find(item => (
    item && typeof item === 'object' &&
    typeof item.iamValue === 'string' && item.iamValue.length > 0
  ))
  if (!issued) return false

  await initializeIam()
  const nextKey = issued.iamKey ?? issued.iamKeys
  const next = {
    iamKey: nextKey != null && String(nextKey) ? String(nextKey) : credentials.iamKey,
    iamValue: issued.iamValue
  }
  // 如果上次写入失败，即便 IAM 未变化仍需重试持久化。
  if (next.iamValue === credentials.iamValue && next.iamKey === credentials.iamKey &&
      persistedCredentials?.iamValue === next.iamValue &&
      persistedCredentials?.iamKey === next.iamKey) {
    return true
  }
  credentials = next

  if (iamStorageApi()) {
    try {
      await queueEncryptedSave(next)
      persistedCredentials = { ...next }
      clearLegacy()
    } catch (error) {
      reportWriteFailure(error)
    }
  } else if (isElectronApp()) {
    // preload 接口失效时也不允许退回明文 localStorage。
    reportWriteFailure(new Error('iam-ipc-unavailable'))
  } else {
    try {
      // 只有真正的网页版沿用 localStorage。
      localStorage.setItem('iamKeys', next.iamKey)
      localStorage.setItem('iamValue', next.iamValue)
      persistedCredentials = { ...next }
    } catch (error) {
      reportWriteFailure(error)
    }
  }
  return true
}
