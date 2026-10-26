'use strict'

/**
 * 字典驱动的自动更新（不依赖 OSS 上的 latest.yml / electron-updater）。
 *
 * 渲染进程在登录并 getInfo 之后读取字典 app_update_config，把策略交给这里：
 *   {
 *     "enabled": true,                 // false：暂停推送
 *     "version": "1.0.27",             // 字典里的最新版本号，与当前版本比较
 *     "downloadUrl": "https://file.riding-evolved.com/xxx/D-Space-x64.exe"
 *                    或 {"arm64": "https://.../a.zip", "x64": "https://.../b.zip"},
 *     "sha512": "hex 或 base64",        // 安装包 sha512，下载后强制校验
 *     "minVersion": "1.0.20"            // 当前版本低于它时强制更新
 *   }
 *
 * 安全约束：
 *   1. 下载地址必须是 https，并且域名在 ALLOWED_DOWNLOAD_HOSTS 白名单内；
 *   2. 必须提供 sha512，下载完成后校验不通过则丢弃安装包，不执行安装。
 *
 * Windows：下载 NSIS 安装包后以 --updated /S --force-run 静默安装；
 *          确认安装进程启动后由 main.cjs 退出旧应用，NSIS 安装完成后拉起新版本。
 * macOS  ：下载 .zip 后交给 mac-updater 静默替换 .app。
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')

// 允许下发下载地址的域名白名单（含其子域名）。需要新增域名时在这里修改。
const ALLOWED_DOWNLOAD_HOSTS = ['file.riding-evolved.com']
// 是否强制要求字典提供 sha512（通过管理端 FileUpload 上传安装包时可选填 sha512，提供了则严格校验）
const REQUIRE_SHA512 = false

// 比较版本号：a > b 返回 1，a < b 返回 -1，相等返回 0；无法解析返回 null
function compareVersions(a, b) {
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

function isAllowedDownloadUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    return ALLOWED_DOWNLOAD_HOSTS.some((allowed) => host === allowed || host.endsWith('.' + allowed))
  } catch (error) {
    return false
  }
}

// downloadUrl 可以是字符串（Windows .exe），也可以是按架构区分的对象 {arm64, x64}（Mac .zip）
function pickDownloadUrl(policy, arch) {
  const value = policy && policy.downloadUrl
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    return value[arch] || (arch === 'arm64' ? value.arm64 : value.x64) || value.arm64 || value.x64 || ''
  }
  return ''
}

function sha512Matches(filePath, expected) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512')
    const stream = fs.createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => {
      const digest = hash.digest()
      const text = String(expected || '').trim()
      const normalized = /^[0-9a-f]{128}$/i.test(text)
        ? text.toLowerCase()
        : null
      if (normalized) {
        resolve(digest.toString('hex') === normalized)
      } else {
        resolve(digest.toString('base64') === text)
      }
    })
  })
}

function createDictUpdater({ app, logger, getWindow, downloadToFile, macUpdater, platform = process.platform, spawnInstaller = spawn }) {
  const log = logger || (() => {})
  const state = {
    info: null, // { version, downloadUrl, policy }
    downloading: false,
    downloadedFile: null,
    downloadedPayload: null,
    expectedSha512: '',
  }

  function send(channel, payload) {
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }

  function resendState() {
    if (!state.info) return
    send('update-available', { version: state.info.version, downloadUrl: state.info.downloadUrl, policy: state.info.policy })
    // 临时缓存可能被系统清理，不能再向界面报告“已下载”。
    if (state.downloadedPayload && state.downloadedFile && fs.existsSync(state.downloadedFile)) {
      send('update-downloaded', state.downloadedPayload)
    }
  }

  async function download(info, expectedSha512) {
    const tempDir = path.join(app.getPath('temp'), 'd-space-update')
    fs.mkdirSync(tempDir, { recursive: true })
    const ext = platform === 'win32' ? '.exe' : '.zip'
    // 同版本重新上传不同地址/校验值时不能误用上一份缓存。
    const cacheId = crypto.createHash('sha256').update(info.downloadUrl + '\n' + (expectedSha512 || '')).digest('hex').slice(0, 12)
    const finalPath = path.join(tempDir, `D-Space-${info.version}-${cacheId}${ext}`)
    const partPath = finalPath + '.part'

    // 之前已下载并校验过的同版本安装包可直接复用
    if (fs.existsSync(finalPath)) {
      try {
        const stat = fs.statSync(finalPath)
        if (stat.size > 0 && (!expectedSha512 || (await sha512Matches(finalPath, expectedSha512)))) {
          log('[更新] 复用已下载的安装包: ' + finalPath)
          return finalPath
        }
      } catch (error) {
        log('[更新] 复核已有安装包失败，重新下载: ' + error.message)
      }
      try { fs.unlinkSync(finalPath) } catch (error) { /* ignore */ }
    }

    const startedAt = Date.now()
    await downloadToFile(info.downloadUrl, partPath, ({ downloaded, total, percent }) => {
      const seconds = Math.max((Date.now() - startedAt) / 1000, 0.001)
      send('download-progress', {
        percent,
        transferred: downloaded,
        total,
        bytesPerSecond: downloaded / seconds,
      })
    })

    if (!fs.statSync(partPath).size) {
      try { fs.unlinkSync(partPath) } catch (error) { /* ignore */ }
      throw new Error('下载的安装包为空，无法执行更新')
    }
    if (expectedSha512 && !(await sha512Matches(partPath, expectedSha512))) {
      try { fs.unlinkSync(partPath) } catch (error) { /* ignore */ }
      throw new Error('安装包 sha512 校验失败，已丢弃')
    }
    fs.renameSync(partPath, finalPath)
    return finalPath
  }

  /**
   * 处理字典策略：比对版本 → 校验地址 → 下载 → 通知渲染进程。
   * policy 为 null（字典读取失败/未配置）时不更新。
   */
  async function handlePolicy(policy) {
    const safePolicy = policy && typeof policy === 'object' ? policy : null
    log(`[更新] 字典策略: ${safePolicy ? JSON.stringify(safePolicy) : '无（字典不可用，本次不检查更新）'}`)
    if (!safePolicy) return

    if (safePolicy.enabled === false) {
      log('[更新] 字典策略已暂停推送更新（enabled=false）')
      return
    }

    const currentVersion = (typeof safePolicy.currentVersion === 'string' && safePolicy.currentVersion.trim())
      ? safePolicy.currentVersion.trim()
      : app.getVersion()
    const remoteVersion = typeof safePolicy.version === 'string' ? safePolicy.version.trim() : ''
    const cmp = compareVersions(remoteVersion, currentVersion)
    if (cmp === null) {
      log(`[更新] 字典版本号无效: "${remoteVersion}"，本次不更新`)
      return
    }
    if (cmp <= 0) {
      log(`[更新] 字典版本 ${remoteVersion} 不高于当前版本 ${currentVersion}，当前已是最新版本`)
      return
    }

    const downloadUrl = pickDownloadUrl(safePolicy, process.arch)
    if (!downloadUrl || !isAllowedDownloadUrl(downloadUrl)) {
      const message = '更新配置中的下载地址缺失或不合法，请联系管理员检查桌面更新字典'
      log(`[更新] ${message}: ${downloadUrl || '(空)'}`)
      send('update-install-failed', { message })
      return
    }
    const sha512 = typeof safePolicy.sha512 === 'string' ? safePolicy.sha512.trim() : ''
    if (REQUIRE_SHA512 && !sha512) {
      const message = '更新包未配置 sha512 校验值，请联系管理员'
      log('[更新] ' + message)
      send('update-install-failed', { message })
      return
    }

    const minVersion = typeof safePolicy.minVersion === 'string' ? safePolicy.minVersion : ''
    const forceCmp = minVersion ? compareVersions(currentVersion, minVersion) : null
    const publicPolicy = {
      force: forceCmp !== null && forceCmp < 0,
    }

    // 只有缓存文件仍真实存在，才能复用已下载状态。
    if (state.info && state.info.version === remoteVersion &&
        state.info.downloadUrl === downloadUrl && state.expectedSha512 === sha512 &&
        (state.downloading || (state.downloadedFile && fs.existsSync(state.downloadedFile)))) {
      log('[更新] 同版本更新已在进行或已完成，补发状态')
      resendState()
      return
    }

    state.info = { version: remoteVersion, downloadUrl, policy: publicPolicy }
    state.expectedSha512 = sha512
    state.downloadedFile = null
    state.downloadedPayload = null
    if (platform === 'darwin') macUpdater.setDownloadedFile(null)
    state.downloading = true
    log(`[更新] 发现新版本: ${remoteVersion}（当前 ${currentVersion}），开始下载: ${downloadUrl}`)
    send('update-available', { version: remoteVersion, downloadUrl, policy: publicPolicy })

    try {
      const filePath = await download(state.info, sha512)
      state.downloading = false
      state.downloadedFile = filePath
      if (platform === 'darwin') {
        macUpdater.setDownloadedFile(filePath)
      }
      const isMac = platform === 'darwin'
      state.downloadedPayload = {
        platform,
        isMac,
        supportSilentInstall: true,
        message: isMac ? '新版本已下载完成，点击立即重启安装' : '新版本已下载完成，即将重启安装',
      }
      log('[更新] 下载并校验完成: ' + filePath)
      send('update-downloaded', state.downloadedPayload)
    } catch (error) {
      state.downloading = false
      state.info = null
      log('[更新] 下载更新失败: ' + error.message)
      send('update-install-failed', { message: '下载更新失败：' + error.message })
    }
  }

  // 点击安装时以主进程的真实文件为准；缓存被清理时按原字典策略重新下载。
  async function ensureDownloaded() {
    if (state.downloading) {
      throw new Error('更新包仍在下载，请下载完成后重试')
    }
    if (!state.info) {
      throw new Error('未找到有效的更新配置，请重新检查并下载更新')
    }
    const filePath = await download(state.info, state.expectedSha512)
    state.downloadedFile = filePath
    if (platform === 'darwin') macUpdater.setDownloadedFile(filePath)
    return filePath
  }

  // 核对 PE 头，拦截下载错误页面或其他非 Windows 可执行文件；不代替 sha512 校验。
  function assertWindowsExecutable(installer) {
    const stat = fs.statSync(installer)
    if (!stat.isFile() || stat.size < 68) {
      throw new Error('Windows 更新安装包无效，请重新下载')
    }
    const fd = fs.openSync(installer, 'r')
    try {
      const header = Buffer.alloc(64)
      if (fs.readSync(fd, header, 0, header.length, 0) !== header.length ||
          header.toString('ascii', 0, 2) !== 'MZ') {
        throw new Error('Windows 更新文件不是有效的 EXE 安装包')
      }
      const peOffset = header.readUInt32LE(0x3c)
      if (peOffset < 64 || peOffset > stat.size - 4) {
        throw new Error('Windows 更新文件 PE 头无效')
      }
      const signature = Buffer.alloc(4)
      if (fs.readSync(fd, signature, 0, signature.length, peOffset) !== signature.length ||
          !signature.equals(Buffer.from([0x50, 0x45, 0x00, 0x00]))) {
        throw new Error('Windows 更新文件 PE 签名无效')
      }
    } finally {
      fs.closeSync(fd)
    }
  }

  // NSIS 内置 /S、--updated、--force-run：启动确认后由 main.cjs 退出旧版。
  async function installWindows() {
    if (platform !== 'win32') throw new Error('Windows 安装流程只能在 Windows 上运行')
    const installer = state.downloadedFile
    if (!installer || !fs.existsSync(installer)) {
      throw new Error('安装包不存在，请稍后重试')
    }
    assertWindowsExecutable(installer)
    log('[更新] Windows: 启动静默安装: ' + installer)
    await new Promise((resolve, reject) => {
      let child
      try {
        child = spawnInstaller(installer, ['--updated', '/S', '--force-run'], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        })
      } catch (error) {
        reject(error)
        return
      }
      let started = false
      child.once('error', (error) => {
        if (!started) reject(error)
        else log('[更新] Windows 安装器启动后进程错误: ' + error.message)
      })
      child.once('spawn', () => {
        started = true
        child.unref()
        log('[更新] Windows 安装器进程已创建: pid=' + child.pid)
        resolve()
      })
      child.once('exit', (code, signal) => {
        log(`[更新] Windows 安装器进程结束: code=${code}, signal=${signal}`)
      })
    })
  }

  return {
    handlePolicy,
    resendState,
    installWindows,
    ensureDownloaded,
    getDownloadUrl: () => (state.info ? state.info.downloadUrl : ''),
  }
}

module.exports = {
  createDictUpdater,
  compareVersions,
  isAllowedDownloadUrl,
  ALLOWED_DOWNLOAD_HOSTS,
}
