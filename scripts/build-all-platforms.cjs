'use strict'

/**
 * D-Space one-command desktop release packager.
 *
 * One command builds four editions without changing the developer's package.json:
 *   macOS Intel x64 + Apple Silicon arm64 (Electron 32 / modern)
 *   Windows 10/11 x64 (Electron 32 / modern)
 *   Windows 7/8/8.1 x64 (Electron 21 / legacy)
 *
 * Each release channel is built in an isolated, reusable workspace, with its
 * own dependencies and Electron runtime. No uploads, tags, or Git writes.
 */
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
const CACHE_ROOT = path.join(ROOT, 'electron_dist', '.all-platform-workspaces')
const CHANNELS = {
  modern: { electronMajor: 32, manifest: 'package.modern.json', config: 'electron-builder.modern.cjs' },
  legacy: { electronMajor: 21, manifest: 'package.legacy.json', config: 'electron-builder.legacy.cjs' },
}
const EDITIONS = [
  { id: 'mac', channel: 'modern', os: 'darwin', label: 'Mac Intel + Apple Silicon', args: ['--mac', 'zip', 'dmg', '--x64', '--arm64'] },
  { id: 'win10', channel: 'modern', os: 'win32', label: 'Windows 10/11 x64', args: ['--win', 'nsis', '--x64'] },
  { id: 'win7', channel: 'legacy', os: 'win32', label: 'Windows 7/8/8.1 x64', args: ['--win', 'nsis', '--x64'] },
]
const SOURCE_ITEMS = [
  'src', 'public', 'electron', 'build', 'vite', 'scripts', 'bin',
  'index.html', 'personal-center.html', 'notification-test.html',
  'vite.config.js', 'electron-builder.modern.cjs', 'electron-builder.legacy.cjs',
  '.env.production', '.env.staging',
]
const ROOT_MODULES = path.join(ROOT, 'node_modules')
const ELECTRON_CACHE_DIR = path.join(os.homedir(), 'Library', 'Caches', 'electron')

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')) }
function electronMajor(spec) { return Number(String(spec || '').match(/\d+/)?.[0] || 0) }
function hasCommand(command) {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { stdio: 'ignore' })
  return probe.status === 0
}
function parseOptions(args) {
  const options = { only: 'all', check: false, stage: false }
  for (const arg of args) {
    if (arg === '--check' || arg === '--dry-run') options.check = true
    else if (arg === '--stage') options.stage = true
    else if (arg.startsWith('--only=')) options.only = arg.slice(7)
    else throw new Error('未知参数: ' + arg)
  }
  if (!['all', 'mac', 'win', 'win7', 'win10'].includes(options.only)) {
    throw new Error('可选 --only=all|mac|win|win7|win10')
  }
  return options
}
function selectedEditions(only) {
  return EDITIONS.filter(item => only === 'all' || item.id === only ||
    (only === 'win' && item.os === 'win32'))
}
function validateConfig() {
  const rootPackage = readJson(path.join(ROOT, 'package.json'))
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(rootPackage.version)) {
    throw new Error('package.json 的版本号不符合 SemVer: ' + rootPackage.version)
  }
  for (const [channel, info] of Object.entries(CHANNELS)) {
    const manifest = readJson(path.join(ROOT, info.manifest))
    if (manifest.releaseChannel !== channel || electronMajor(manifest.devDependencies?.electron) !== info.electronMajor) {
      throw new Error(info.manifest + ' 的通道/Electron 版本配置不匹配')
    }
  }
  if (!fs.existsSync(path.join(ROOT_MODULES, 'electron-builder', 'package.json'))) {
    throw new Error('缺少项目原有 electron-builder 依赖，请先在项目根目录安装依赖')
  }
  // Both channels share all dependencies other than Electron. Prevent accidental
  // reuse if those manifests diverge in a future release.
  const modern = readJson(path.join(ROOT, CHANNELS.modern.manifest))
  const legacy = readJson(path.join(ROOT, CHANNELS.legacy.manifest))
  const omitElectron = manifest => {
    const dev = { ...manifest.devDependencies }
    delete dev.electron
    return { deps: manifest.dependencies, dev }
  }
  if (JSON.stringify(omitElectron(modern)) !== JSON.stringify(omitElectron(legacy))) {
    throw new Error('legacy/modern 项目依赖不同，不能复用构建工具，请先配置独立依赖环境')
  }
  return rootPackage
}
function diagnoseHost(editions) {
  const errors = []
  if (editions.some(x => x.os === 'darwin') && process.platform !== 'darwin') {
    errors.push('Mac 安装包必须使用 macOS 构建机')
  }
  if (editions.some(x => x.os === 'win32') &&
      process.platform !== 'win32' && process.platform !== 'darwin') {
    errors.push('Windows 安装包请使用 Windows，或配置 Wine 的 macOS')
  }
  if (!hasCommand('npm')) errors.push('找不到 npm，请安装 Node.js / npm')
  return errors
}
function availabilityForEdition(edition, platform = process.platform, has = hasCommand) {
  const reasons = []
  if (!has('npm')) reasons.push('找不到 npm / Node.js，无法构建')
  if (edition.os === 'darwin' && platform !== 'darwin') {
    reasons.push('Mac ZIP 只能在 macOS 构建机上生成')
  }
  if (edition.os === 'win32' && platform !== 'win32') {
    if (platform !== 'darwin') {
      reasons.push('缺少 Windows 构建机（或支持 Wine 的 macOS）')
    }
  }
  return reasons
}
function copySnapshot(workspace, channel, version) {
  fs.mkdirSync(workspace, { recursive: true })
  // Reuse the previously installed Vite/builder modules, while packaging each
  // channel with an explicit Electron runtime. No slow reinstall per release.
  for (const entry of fs.readdirSync(workspace)) {
    fs.rmSync(path.join(workspace, entry), { force: true, recursive: true })
  }
  for (const item of SOURCE_ITEMS) {
    const source = path.join(ROOT, item)
    if (fs.existsSync(source)) fs.cpSync(source, path.join(workspace, item), { recursive: true })
  }
  const manifest = readJson(path.join(ROOT, CHANNELS[channel].manifest))
  // Use current working sources/scripts but force the correct runtime and channel.
  const current = readJson(path.join(ROOT, 'package.json'))
  const prepared = {
    ...current,
    version,
    releaseChannel: channel,
    devDependencies: {
      ...current.devDependencies,
      electron: manifest.devDependencies.electron,
    },
  }
  fs.writeFileSync(path.join(workspace, 'package.json'), JSON.stringify(prepared, null, 2) + '\n')
  fs.symlinkSync(ROOT_MODULES, path.join(workspace, 'node_modules'), 'dir')
}
function run(executable, args, cwd, channel, stage) {
  console.log('\n$ ' + executable + ' ' + args.join(' '))
  const command = process.platform === 'win32' && executable === 'npm' ? 'npm.cmd' : executable
  const env = { ...process.env, RELEASE_CHANNEL: channel, CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    ...(stage ? { NODE_ENV: 'staging' } : {}) }
  // IDE debugger auto-attach flags are inherited through NODE_OPTIONS and may
  // leave npm and electron-builder stuck at "Waiting for the debugger...".
  delete env.NODE_OPTIONS
  delete env.VSCODE_INSPECTOR_OPTIONS
  const res = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
  })
  if (res.error) throw new Error('无法执行 ' + executable + ': ' + res.error.message)
  if (res.status !== 0) throw new Error(executable + ' 执行失败 (exit=' + res.status + ')')
}
function resolveElectronRuntime(channel) {
  const manifest = readJson(path.join(ROOT, CHANNELS[channel].manifest))
  const declared = manifest.devDependencies.electron
  const expected = CHANNELS[channel].electronMajor
  const minVersion = String(declared).match(/\d+\.\d+\.\d+/)?.[0]
  if (!minVersion || electronMajor(minVersion) !== expected) {
    throw new Error(channel + ' Electron 版本配置异常：' + declared)
  }
  const installed = readJson(path.join(ROOT_MODULES, 'electron', 'package.json')).version
  if (electronMajor(installed) === expected && compareVersions(installed, minVersion) >= 0) {
    return installed
  }
  // Prefer a locally cached compatible Electron, avoiding unnecessary downloads.
  if (fs.existsSync(ELECTRON_CACHE_DIR)) {
    const cached = fs.readdirSync(ELECTRON_CACHE_DIR)
      .map(file => file.match(/^electron-v(\d+\.\d+\.\d+)-/i)?.[1])
      .filter(version => version && electronMajor(version) === expected &&
        compareVersions(version, minVersion) >= 0)
      .sort(compareVersions)
    if (cached.length) return cached[cached.length - 1]
  }
  return minVersion
}
function compareVersions(left, right) {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}
function builderExecutable(workspace) {
  const name = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder'
  const file = path.join(workspace, 'node_modules', '.bin', name)
  if (!fs.existsSync(file)) throw new Error('未找到 electron-builder: ' + file)
  return file
}
function collectOutput(buildOutput, finalRoot, edition, version) {
  if (!fs.existsSync(buildOutput)) throw new Error('构建输出目录不存在: ' + buildOutput)
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version || '')) {
    throw new Error('缺少合法版本号，无法收集安装包')
  }
  const files = fs.readdirSync(buildOutput).filter(file => fs.statSync(path.join(buildOutput, file)).isFile())
  const result = []
  let wanted
  if (edition.id === 'mac') {
    // .zip 供客户端自动更新（ditto 替换），.dmg 供网页端新用户首次安装（网页把 .zip 后缀替换为 .dmg）
    wanted = [
      { name: `D-Space-${version}-Mac-Intel-x64.zip`, match: name => /-x64\.zip$/i.test(name) },
      { name: `D-Space-${version}-Mac-AppleSilicon-arm64.zip`, match: name => /-arm64\.zip$/i.test(name) },
      { name: `D-Space-${version}-Mac-Intel-x64.dmg`, match: name => /-x64\.dmg$/i.test(name) },
      { name: `D-Space-${version}-Mac-AppleSilicon-arm64.dmg`, match: name => /-arm64\.dmg$/i.test(name) },
    ]
  } else {
    const isLegacy = edition.id === 'win7'
    wanted = [{
      name: `D-Space-${version}-${isLegacy ? 'Win7' : 'Win10-11'}-x64.exe`,
      // Only NSIS installer: never accidentally include Portable, uninstaller, or old EXEs.
      match: name => isLegacy
        ? /^D-Space-legacy-(?:[\d.]+-)?x64\.exe$/i.test(name)
        : /^D-Space-modern-(?:[\d.]+-)?x64\.exe$/i.test(name),
    }]
  }
  for (const group of wanted) {
    const found = files.filter(group.match)
    if (found.length !== 1) {
      throw new Error(edition.label + ' 缺少唯一的安装包，找到 ' + found.length + ' 个：' + buildOutput)
    }
    fs.mkdirSync(finalRoot, { recursive: true })
    const destination = path.join(finalRoot, group.name)
    if (fs.existsSync(destination)) {
      throw new Error('目标安装包已存在，禁止覆盖：' + destination)
    }
    fs.copyFileSync(path.join(buildOutput, found[0]), destination)
    result.push(group.name)
  }
  return result
}
// 方案 A：安装包文件名带版本号，每次发版同步更新字典 desktop_update_config 的 downloadUrl。
// 默认 OSS 目录可通过 DSPACE_DOWNLOAD_BASE 覆盖。
const DOWNLOAD_BASE = (process.env.DSPACE_DOWNLOAD_BASE || 'https://file.riding-evolved.com/d-space').replace(/\/+$/, '')
const DICT_FILE_NAME = 'desktop_update_config.json'
function sha512Hex(file) {
  return crypto.createHash('sha512').update(fs.readFileSync(file)).digest('hex')
}
function buildDictConfig(finalRoot, version, builtNames, baseUrl = DOWNLOAD_BASE) {
  const url = (channel, name) => `${baseUrl}/digismart-desktop-${channel}/${name}`
  const sha = name => sha512Hex(path.join(finalRoot, name))
  const has = name => builtNames.includes(name)
  const items = []
  const push = (dictLabel, dictSort, downloadUrl, sha512, description) => {
    const remark = { enabled: true, version, minVersion: '1.0.0', downloadUrl, sha512, description }
    items.push({
      dictType: 'desktop_update_config',
      dictLabel,
      dictValue: version,
      dictSort,
      status: '0',
      remark: JSON.stringify(remark),
      remarkPretty: remark,
    })
  }
  const win10 = `D-Space-${version}-Win10-11-x64.exe`
  const win7 = `D-Space-${version}-Win7-x64.exe`
  const macArm = `D-Space-${version}-Mac-AppleSilicon-arm64.zip`
  const macX64 = `D-Space-${version}-Mac-Intel-x64.zip`
  if (has(win10)) push('modern_win', 1, url('modern', win10), sha(win10), '现代版 Windows 桌面端升级配置（Win 10/11）')
  if (has(win7)) push('legacy_win', 2, url('legacy', win7), sha(win7), '兼容版 Windows 桌面端升级配置（Win 7/8/8.1）')
  if (has(macArm) && has(macX64)) {
    push('modern_mac', 3,
      { arm64: url('modern', macArm), x64: url('modern', macX64) },
      { arm64: sha(macArm), x64: sha(macX64) },
      'Mac 桌面端升级配置（M系列 arm64 / Intel芯片 x64）')
  }
  if (!items.length) return null
  const file = path.join(finalRoot, DICT_FILE_NAME)
  fs.writeFileSync(file, JSON.stringify(items, null, 2) + '\n')
  return { file, items }
}
async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args)
  const rootPackage = validateConfig()
  const editions = selectedEditions(options.only)
  const version = rootPackage.version
  const releaseDir = path.join(ROOT, 'electron_dist', 'one-click')
  const releaseName = (options.stage ? 'staging-' : 'v') + version
  const available = editions.filter(edition => availabilityForEdition(edition).length === 0)
  const unavailable = editions.filter(edition => availabilityForEdition(edition).length > 0)
  // Partial outputs never overwrite a previously complete version folder.
  const incomplete = unavailable.length > 0
  const finalRoot = path.join(releaseDir, releaseName + (incomplete ? '-incomplete' : ''))
  const blockers = unavailable.flatMap(edition =>
    availabilityForEdition(edition).map(reason => edition.label + ': ' + reason))
  console.log('\nD-Space 全平台一键打包')
  console.log('系统：' + os.platform() + '/' + os.arch() + '，版本：' + version)
  console.log('输出：' + finalRoot)
  for (const edition of editions) {
    console.log('  • ' + edition.label + ' (' + edition.channel + '/Electron ' +
      CHANNELS[edition.channel].electronMajor + ')')
  }
  for (const issue of blockers) console.warn('⚠ ' + issue)
  if (process.platform === 'darwin' && editions.some(edition => edition.os === 'win32') &&
      !hasCommand('wine') && !hasCommand('wine64')) {
    console.log('提示：未检测到 Wine；本机已可使用 electron-builder/NSIS 时仍会正常尝试 Windows 打包，以实际构建结果为准。')
  }
  if (options.check) {
    console.log('\n检查完成（仅预检，未构建、未写入文件）')
    return { editions, available, unavailable, blockers, incomplete, finalRoot, checked: true }
  }
  if (!available.length) throw new Error('本机无法生成选定的安装包：' + blockers.join('；'))
  if (incomplete) console.warn('\n⚠ 当前环境无法生成全部四个安装包；先构建可用的平台，不会误报全平台构建成功。')
  // This is a generated-only, version-scoped delivery directory; discard stale
  // nested/extra files from older runs so it contains *only* ZIP and EXE.
  fs.rmSync(finalRoot, { recursive: true, force: true })
  fs.mkdirSync(finalRoot, { recursive: true })
  const built = []
  const workspaceByChannel = new Map()
  for (const edition of available) {
    let workspace = workspaceByChannel.get(edition.channel)
    if (!workspace) {
      workspace = path.join(CACHE_ROOT, edition.channel)
      copySnapshot(workspace, edition.channel, version)
      console.log('✓ 使用本机已安装的构建依赖，无需重新 npm install')
      run('npm', ['run', options.stage ? 'build:stage' : 'build:prod'], workspace, edition.channel, options.stage)
      workspaceByChannel.set(edition.channel, workspace)
    }
    const buildArgs = [
      '--config', CHANNELS[edition.channel].config,
      ...edition.args,
      '--publish', 'never',
      '-c.electronVersion=' + resolveElectronRuntime(edition.channel),
    ]
    console.log('✓ ' + edition.channel + ' Electron 运行时: ' + resolveElectronRuntime(edition.channel))
    run(builderExecutable(workspace), buildArgs, workspace, edition.channel, options.stage)
    built.push(...collectOutput(path.join(workspace, 'electron_dist', edition.channel), finalRoot, edition, version))
  }
  if (incomplete) {
    console.warn('\n⚠ 部分完成：已生成 ' + built.length + ' 个安装包，另有 ' +
      unavailable.map(item => item.label).join('、') + ' 因缺少工具链未生成。')
    console.warn('需要 Windows 构建机，或在 Mac 配置兼容的 Wine；也可使用已配置的 CI 工作流。')
  } else {
    console.log('\n✓ 全部安装包打包成功！')
  }
  console.log('产物目录：' + finalRoot)
  for (const name of built) console.log('  ' + name)
  const dict = buildDictConfig(finalRoot, version, built)
  if (dict) {
    console.log('\n字典配置已生成（上传安装包后，按 dictLabel 把 remark 粘贴到 desktop_update_config）：')
    console.log('  ' + dict.file)
    for (const item of dict.items) {
      const target = item.remarkPretty.downloadUrl
      console.log('  • ' + item.dictLabel + ' → ' + (typeof target === 'string' ? target : JSON.stringify(target)))
    }
  }
  return { editions, available, unavailable, blockers, built, incomplete, finalRoot, dict }
}

if (require.main === module) {
  main().then(result => {
    // A partial build is not a successful full build.
    if (result.incomplete && !result.checked) process.exitCode = 2
  }).catch(error => {
    console.error('\n✗ 一键打包失败：' + error.message)
    process.exitCode = 1
  })
}
module.exports = { main, parseOptions, validateConfig, selectedEditions, availabilityForEdition, resolveElectronRuntime, collectOutput, buildDictConfig }
