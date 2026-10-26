'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { parseOptions, selectedEditions, validateConfig, collectOutput, availabilityForEdition, resolveElectronRuntime, main, buildDictConfig } = require('./build-all-platforms.cjs')

test('one-click matrix separates Windows 7 and modern runtime', () => {
  const items = selectedEditions('all')
  assert.deepEqual(items.map(x => x.id), ['mac', 'win10', 'win7'])
  assert.deepEqual(items.map(x => x.channel), ['modern', 'modern', 'legacy'])
  assert.deepEqual(items[0].args, ['--mac', 'zip', 'dmg', '--x64', '--arm64'])
  assert.deepEqual(items[1].args, ['--win', 'nsis', '--x64'])
  assert.deepEqual(items[2].args, ['--win', 'nsis', '--x64'])
  assert.match(validateConfig().version, /^\d+\.\d+\.\d+/)
})

test('CLI options limit targets and do not permit unintended publishing', () => {
  assert.equal(parseOptions(['--stage', '--only=mac']).stage, true)
  assert.deepEqual(selectedEditions('win').map(x => x.id), ['win10', 'win7'])
  assert.throws(() => parseOptions(['--only=linux']), /可选/)
  assert.throws(() => parseOptions(['--publish']), /未知参数/)
})

test('preflight returns platform blockers without creating any files', async () => {
  const plan = await main(['--check'])
  assert.equal(plan.editions.length, 3)
  assert(Array.isArray(plan.blockers))
  assert.equal(plan.editions.length, plan.available.length + plan.unavailable.length)
  if (plan.incomplete) assert.match(plan.finalRoot, /-incomplete$/)
})

test('missing Wine does not falsely block Windows NSIS builds on Mac', () => {
  const [mac, modernWin, legacyWin] = selectedEditions('all')
  const noWine = command => command === 'npm'
  assert.deepEqual(availabilityForEdition(mac, 'darwin', noWine), [])
  assert.deepEqual(availabilityForEdition(modernWin, 'darwin', noWine), [])
  assert.deepEqual(availabilityForEdition(legacyWin, 'darwin', noWine), [])
  const windowsHasNpm = command => command === 'npm'
  assert.deepEqual(availabilityForEdition(modernWin, 'win32', windowsHasNpm), [])
  assert.match(availabilityForEdition(mac, 'win32', windowsHasNpm).join(' '), /macOS/)
})

test('each release line uses its own compatible Electron runtime', () => {
  assert.equal(Number(resolveElectronRuntime('legacy').split('.')[0]), 21)
  assert.equal(Number(resolveElectronRuntime('modern').split('.')[0]), 32)
})

test('one-click build reuses installed tools and avoids re-installing all npm packages', () => {
  const script = fs.readFileSync(path.join(__dirname, 'build-all-platforms.cjs'), 'utf8')
  assert.equal(script.includes("run('npm', ['install'"), false)
  assert(script.includes("'-c.electronVersion=' + resolveElectronRuntime"))
})

test('collector creates Mac ZIP+DMG and Windows EXE installers in ONE flat folder', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'd-space-collect-'))
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }))
  const modern = path.join(tmp, 'modern')
  const legacy = path.join(tmp, 'legacy')
  const output = path.join(tmp, 'result')
  fs.mkdirSync(modern)
  fs.mkdirSync(legacy)
  for (const item of [
    'D-Space-modern-x64.dmg', 'D-Space-modern-x64.zip',
    'D-Space-modern-arm64.dmg', 'D-Space-modern-arm64.zip',
    'D-Space-modern-1.0.26-x64.exe', 'D-Space-modern-Portable-x64.exe',
    'latest.yml', 'latest-mac.yml', 'builder-effective-config.yaml',
  ]) fs.writeFileSync(path.join(modern, item), 'fixture')
  for (const item of [
    'D-Space-legacy-x64.exe', 'D-Space-legacy-Portable-x64.exe', 'latest.yml',
  ]) fs.writeFileSync(path.join(legacy, item), 'fixture')
  const [mac, win10, win7] = selectedEditions('all')
  const made = [
    ...collectOutput(modern, output, mac, '1.0.26'),
    ...collectOutput(modern, output, win10, '1.0.26'),
    ...collectOutput(legacy, output, win7, '1.0.26'),
  ]
  assert.deepEqual([...made].sort(), [
    'D-Space-1.0.26-Mac-Intel-x64.zip',
    'D-Space-1.0.26-Mac-AppleSilicon-arm64.zip',
    'D-Space-1.0.26-Mac-Intel-x64.dmg',
    'D-Space-1.0.26-Mac-AppleSilicon-arm64.dmg',
    'D-Space-1.0.26-Win10-11-x64.exe',
    'D-Space-1.0.26-Win7-x64.exe',
  ].sort())
  assert.deepEqual(fs.readdirSync(output).sort(), made.slice().sort())
  assert.equal(made.filter(item => item.endsWith('.zip')).length, 2)
  assert.equal(made.filter(item => item.endsWith('.dmg')).length, 2)
  assert.equal(made.filter(item => item.endsWith('.exe')).length, 2)
  assert(made.every(item => fs.statSync(path.join(output, item)).isFile()))
  assert(!fs.readdirSync(output).some(item => /Portable|blockmap|\.yml/.test(item)))
  assert.throws(() => collectOutput(modern, output, mac, '1.0.26'), /禁止覆盖/)

  // 方案 A：生成带版本号下载地址与 sha512 的字典配置
  const dict = buildDictConfig(output, '1.0.26', made, 'https://file.example.com/d-space')
  const byLabel = Object.fromEntries(dict.items.map(item => [item.dictLabel, JSON.parse(item.remark)]))
  assert.deepEqual(Object.keys(byLabel).sort(), ['legacy_win', 'modern_mac', 'modern_win'])
  assert.equal(byLabel.modern_win.downloadUrl,
    'https://file.example.com/d-space/digismart-desktop-modern/D-Space-1.0.26-Win10-11-x64.exe')
  assert.equal(byLabel.legacy_win.downloadUrl,
    'https://file.example.com/d-space/digismart-desktop-legacy/D-Space-1.0.26-Win7-x64.exe')
  assert.deepEqual(byLabel.modern_mac.downloadUrl, {
    arm64: 'https://file.example.com/d-space/digismart-desktop-modern/D-Space-1.0.26-Mac-AppleSilicon-arm64.zip',
    x64: 'https://file.example.com/d-space/digismart-desktop-modern/D-Space-1.0.26-Mac-Intel-x64.zip',
  })
  assert.match(byLabel.modern_win.sha512, /^[0-9a-f]{128}$/)
  assert.match(byLabel.modern_mac.sha512.arm64, /^[0-9a-f]{128}$/)
  // 网页端把 .zip 替换为 .dmg 后必须能找到同名 DMG
  assert(made.includes(path.basename(byLabel.modern_mac.downloadUrl.arm64).replace(/\.zip$/, '.dmg')))
})

test('collector cannot report success if only metadata and no installer exists', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'd-space-empty-'))
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }))
  fs.writeFileSync(path.join(tmp, 'latest.yml'), 'version: 1.0.26')
  assert.throws(() => collectOutput(tmp, path.join(tmp, 'result'), selectedEditions('mac')[0], '1.0.26'), /缺少唯一的安装包/)
})
