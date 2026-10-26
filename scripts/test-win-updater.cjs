'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { EventEmitter } = require('node:events')
const { createDictUpdater } = require('../electron/dict-updater.cjs')

const URL_A = 'https://file.riding-evolved.com/d-space/D-Space-modern-x64.exe'
const URL_B = 'https://file.riding-evolved.com/d-space/D-Space-modern-x64-v2.exe'

function fakePe() {
  const bytes = Buffer.alloc(256)
  bytes.write('MZ', 0, 'ascii')
  bytes.writeUInt32LE(128, 0x3c)
  bytes.write('PE\u0000\u0000', 128, 'binary')
  return bytes
}

function setup(t, opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dspace-win-updater-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const events = []
  const launches = []
  const source = opts.bytes || fakePe()
  let downloadCount = 0
  let unrefCount = 0
  let quitCount = 0

  const app = {
    isPackaged: true,
    getVersion: () => '1.0.26',
    getPath: () => dir,
    quit: () => { quitCount++ },
  }
  const updater = createDictUpdater({
    app,
    platform: 'win32',
    logger: () => {},
    getWindow: () => ({ isDestroyed: () => false, webContents: {
      send: (name, payload) => events.push({ name, payload }),
    } }),
    downloadToFile: async (_url, target) => {
      downloadCount++
      fs.writeFileSync(target, source)
    },
    macUpdater: { setDownloadedFile: () => {} },
    spawnInstaller: (file, args, options) => {
      launches.push({ file, args, options })
      if (opts.throwSpawn) throw new Error('sync launch failure')
      const child = new EventEmitter()
      child.pid = 12006
      child.unref = () => { unrefCount++ }
      process.nextTick(() => {
        if (opts.spawnError) child.emit('error', Object.assign(new Error('access denied'), { code: 'EACCES' }))
        else child.emit('spawn')
      })
      return child
    },
  })
  const policy = (downloadUrl = URL_A) => ({
    enabled: true,
    version: '1.0.27',
    downloadUrl,
    sha512: crypto.createHash('sha512').update(source).digest('hex'),
  })
  return {
    updater, events, launches, app, policy, dir,
    get downloadCount() { return downloadCount },
    get unrefCount() { return unrefCount },
    get quitCount() { return quitCount },
  }
}

test('Windows: downloaded & validated NSIS file launches with supported silent flags', async t => {
  const h = setup(t)
  await h.updater.handlePolicy(h.policy())
  assert(h.events.some(e => e.name === 'update-downloaded'))
  const file = await h.updater.ensureDownloaded()
  assert(fs.existsSync(file))
  assert.equal(h.downloadCount, 1)
  await h.updater.installWindows()
  assert.equal(h.launches.length, 1)
  assert.equal(h.launches[0].file, file)
  assert.deepEqual(h.launches[0].args, ['--updated', '/S', '--force-run'])
  assert.equal(h.launches[0].options.detached, true)
  assert.equal(h.launches[0].options.windowsHide, true)
  assert.equal(h.unrefCount, 1)
  assert.equal(h.quitCount, 0, 'installation launcher must not quit the app itself')
})

test('Windows: asynchronous spawn error does not report success or quit application', async t => {
  const h = setup(t, { spawnError: true })
  await h.updater.handlePolicy(h.policy())
  await assert.rejects(h.updater.installWindows(), /access denied/)
  assert.equal(h.unrefCount, 0)
  assert.equal(h.quitCount, 0)
})

test('Windows: synchronous spawn error remains recoverable', async t => {
  const h = setup(t, { throwSpawn: true })
  await h.updater.handlePolicy(h.policy())
  await assert.rejects(h.updater.installWindows(), /sync launch failure/)
  assert.equal(h.quitCount, 0)
})

test('Windows: invalid executable is rejected before launching', async t => {
  const h = setup(t, { bytes: Buffer.from('<html>incorrect update file</html>') })
  await h.updater.handlePolicy(h.policy())
  await assert.rejects(h.updater.installWindows(), /安装包无效|有效的 EXE/)
  assert.equal(h.launches.length, 0)
})

test('Windows: deleted and modified cache is redownloaded & sha512-checked', async t => {
  const h = setup(t)
  await h.updater.handlePolicy(h.policy())
  const file = await h.updater.ensureDownloaded()
  fs.unlinkSync(file)
  const restored = await h.updater.ensureDownloaded()
  assert.equal(restored, file)
  assert.equal(h.downloadCount, 2)
  fs.writeFileSync(file, 'tampered')
  await h.updater.ensureDownloaded()
  assert.equal(h.downloadCount, 3)
  assert.deepEqual(fs.readFileSync(file), fakePe())
})

test('Windows: changing URL within same release version does not reuse stale cache', async t => {
  const h = setup(t)
  await h.updater.handlePolicy(h.policy(URL_A))
  const first = await h.updater.ensureDownloaded()
  await h.updater.handlePolicy(h.policy(URL_B))
  const second = await h.updater.ensureDownloaded()
  assert.notEqual(first, second)
  assert.equal(h.downloadCount, 2)
})

test('NSIS: custom post-install macro does not kill the updated application', () => {
  const nsis = fs.readFileSync(path.join(__dirname, '../build/installer.nsh'), 'utf8')
  const customInstall = nsis.split('!macro customInstall')[1].split('!macroend')[0]
  assert.doesNotMatch(customInstall, /KillProcess|Goto \+/)
  assert.match(customInstall, /\$\{ElseIf\} \$\{FileExists\}/)
})
