'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// Electron 主进程专用：IAM 永远只以系统加密的二进制内容存入用户数据目录。
// 不允许使用 Linux basic_text（固定明文密码）作为文件加密后端。
function createIamStorage({ app, safeStorage }) {
  const filePath = path.join(app.getPath('userData'), 'auth', 'iam.dat')
  let writeQueue = Promise.resolve()

  function assertEncryption() {
    if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
      throw new Error('encryption-unavailable')
    }
    if (process.platform === 'linux' &&
        typeof safeStorage.getSelectedStorageBackend === 'function' &&
        safeStorage.getSelectedStorageBackend() === 'basic_text') {
      throw new Error('encryption-unavailable')
    }
  }

  function normalize(credentials) {
    if (!credentials || typeof credentials.iamValue !== 'string' ||
        !credentials.iamValue || credentials.iamValue.length > 8192) {
      throw new Error('invalid-iam-value')
    }
    const iamKey = credentials.iamKey == null ? '' : credentials.iamKey
    if (typeof iamKey !== 'string' || iamKey.length > 2048) {
      throw new Error('invalid-iam-key')
    }
    return { iamKey, iamValue: credentials.iamValue }
  }

  async function load() {
    try {
      // 文件不存在才允许迁移旧 localStorage；读取失败绝不能误认为文件不存在。
      const encrypted = await fs.promises.readFile(filePath)
      if (!encrypted.length || encrypted.length > 32768) {
        throw new Error('invalid-file-size')
      }
      assertEncryption()
      const parsed = JSON.parse(safeStorage.decryptString(encrypted))
      if (parsed.version !== 1) throw new Error('unsupported-file-version')
      return { status: 'ok', credentials: normalize(parsed) }
    } catch (error) {
      if (error.code === 'ENOENT') return { status: 'missing' }
      console.warn('[IAM] 无法恢复加密存储:', error.code || error.message)
      return { status: 'error', reason: 'read-failed' }
    }
  }

  function save(credentials) {
    // 拒绝无效数据，不允许空值覆盖旧的有效 IAM。
    const normalized = normalize(credentials)
    const job = writeQueue.then(async () => {
      assertEncryption()
      const encrypted = safeStorage.encryptString(JSON.stringify({
        version: 1,
        ...normalized
      }))
      const dir = path.dirname(filePath)
      await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 })
      const temporary = filePath + '.' + crypto.randomUUID() + '.tmp'
      try {
        await fs.promises.writeFile(temporary, encrypted, { flag: 'wx', mode: 0o600 })
        await fs.promises.rename(temporary, filePath)
      } catch (error) {
        await fs.promises.unlink(temporary).catch(() => {})
        throw error
      }
      return { ok: true }
    })
    // 即便上一次写入失败，后一次新 IAM 仍可继续写入。
    writeQueue = job.catch(() => {})
    return job
  }

  return { load, save }
}

module.exports = { createIamStorage }
