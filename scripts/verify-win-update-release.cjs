'use strict'

// Verify the published Windows NSIS file matches latest.yml before calling a release healthy.
// Read-only; does not upload, purge CDN caches, or modify the OSS.
const fs = require('node:fs')
const path = require('node:path')
const https = require('node:https')
const crypto = require('node:crypto')
const { getReleaseChannelConfig } = require('../electron/release-channels.cjs')

const channel = getReleaseChannelConfig('modern')
function required(text, regex, field) {
  const value = text.match(regex)?.[1]
  if (!value) throw new Error('latest.yml 缺失 ' + field)
  return value.trim()
}
function head(url, n = 0) {
  if (n > 5) return Promise.reject(new Error('下载地址重定向过多'))
  const target = new URL(url)
  if (target.protocol !== 'https:') return Promise.reject(new Error('必须使用 HTTPS'))
  return new Promise((resolve, reject) => {
    const req = https.request(target, { method: 'HEAD' }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume()
        head(new URL(res.headers.location, target).href, n + 1).then(resolve, reject)
      } else {
        res.resume()
        if (res.statusCode !== 200) reject(new Error('HTTP ' + res.statusCode))
        else resolve({ size: Number(res.headers['content-length']), etag: res.headers.etag || '' })
      }
    })
    req.setTimeout(12000, () => req.destroy(new Error('线上安装包响应超时')))
    req.on('error', reject)
    req.end()
  })
}
function digest(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512')
    fs.createReadStream(file)
      .on('data', chunk => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('base64')))
  })
}
async function main() {
  const manifest = fs.readFileSync(path.join(channel.absoluteOutputDir, 'latest.yml'), 'utf8')
  const version = required(manifest, /^version:\s*(.+)$/m, 'version')
  const filename = required(manifest, /^\s*-\s*url:\s*([^\s]+\.exe)\s*$/m, 'files.url')
  const size = Number(required(manifest, /^\s*size:\s*(\d+)\s*$/m, 'files.size'))
  const sha512 = required(manifest, /^\s*sha512:\s*([^\s]+)\s*$/m, 'files.sha512')
  if (!/^D-Space-[a-zA-Z0-9_.-]+\.exe$/.test(filename)) throw new Error('安装包文件名不合法')
  const local = path.join(channel.absoluteOutputDir, filename)
  if (fs.statSync(local).size !== size || (await digest(local)) !== sha512) {
    throw new Error('本地 EXE 与 latest.yml 的文件大小或 SHA-512 不一致')
  }
  const url = channel.feedUrl + '/' + filename
  const remote = await head(url)
  if (remote.size !== size) {
    throw new Error(
      `v${version} 线上 EXE 与 latest.yml 不一致：清单 ${size} 字节，线上 ${remote.size} 字节。请上传匹配版本的文件并刷新 CDN 缓存。`
    )
  }
  console.log(`PASS: Windows v${version} EXE 本地 SHA-512、清单、线上大小一致`)
}
main().catch(error => {
  console.error('[Windows 更新发布检查失败] ' + error.message)
  process.exitCode = 1
})
