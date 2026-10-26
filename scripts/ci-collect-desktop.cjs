'use strict'

/**
 * Collect four platform-specific installers from electron-builder output.
 * Usage: node scripts/ci-collect-desktop.cjs <mac|win7|win10>
 *
 * This script does not publish a release, upload to OSS, or modify source.
 * GitHub Actions runs it on the runner that built each target; the final job
 * merges the three artifacts into a single flat four-file collection.
 */
const fs = require('node:fs')
const path = require('node:path')

const TARGETS = {
  mac: {
    channel: 'modern',
    expected: [
      { pattern: /^D-Space-modern-x64\.zip$/i, suffix: 'Mac-Intel-x64.zip' },
      { pattern: /^D-Space-modern-arm64\.zip$/i, suffix: 'Mac-AppleSilicon-arm64.zip' },
    ],
  },
  win7: {
    channel: 'legacy',
    expected: [
      { pattern: /^D-Space-legacy-(?:\d+\.\d+\.\d+-)?x64\.exe$/i, suffix: 'Win7-x64.exe' },
    ],
  },
  win10: {
    channel: 'modern',
    expected: [
      { pattern: /^D-Space-modern-(?:\d+\.\d+\.\d+-)?x64\.exe$/i, suffix: 'Win10-11-x64.exe' },
    ],
  },
}

function collect(target, projectDir = path.resolve(__dirname, '..')) {
  const config = TARGETS[target]
  if (!config) throw new Error('未知构建目标：' + target)
  const version = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8')).version
  if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z\d.-]+)?$/.test(version)) {
    throw new Error('package.json 的版本号无效：' + version)
  }

  const sourceDir = path.join(projectDir, 'electron_dist', config.channel)
  const destinationDir = path.join(projectDir, 'all-packages')
  if (!fs.existsSync(sourceDir)) throw new Error('打包输出目录不存在：' + sourceDir)
  const names = fs.readdirSync(sourceDir).filter(file =>
    fs.statSync(path.join(sourceDir, file)).isFile())
  const staged = []
  fs.mkdirSync(destinationDir, { recursive: true })

  for (const wanted of config.expected) {
    const candidates = names.filter(file => wanted.pattern.test(file))
    if (candidates.length !== 1) {
      throw new Error(wanted.suffix + ' 需要且只能存在 1 份安装包，实际找到 ' + candidates.length +
        ' 份。目录：' + sourceDir)
    }
    const src = path.join(sourceDir, candidates[0])
    if (fs.statSync(src).size < 1024) throw new Error('安装包异常偏小：' + src)
    const name = 'D-Space-' + version + '-' + wanted.suffix
    const dest = path.join(destinationDir, name)
    if (fs.existsSync(dest)) throw new Error('输出文件已存在，禁止覆盖：' + dest)
    fs.copyFileSync(src, dest)
    staged.push(name)
  }
  return staged
}

if (require.main === module) {
  try {
    const staged = collect(process.argv[2])
    console.log('已收集 ' + staged.length + ' 个安装包：\n' + staged.join('\n'))
  } catch (error) {
    console.error('[一键打包] 收集安装包失败：' + error.message)
    process.exitCode = 1
  }
}
module.exports = { collect, TARGETS }