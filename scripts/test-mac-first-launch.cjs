'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const fs = require('node:fs')
const path = require('node:path')
const { createStartupGuard } = require('../electron/startup-guard.cjs')
const { scheduleMacRelaunch, RELAUNCH_SCRIPT } = require('../electron/mac-relaunch.cjs')

function fakeScheduler() {
  const scheduled = new Map()
  let cursor = 0
  return {
    schedule(fn, ms) { const id = ++cursor; scheduled.set(id, { fn, ms }); return id },
    cancel(id) { scheduled.delete(id) },
    next() {
      assert.equal(scheduled.size, 1)
      const [key, entry] = scheduled.entries().next().value
      scheduled.delete(key)
      entry.fn()
    },
    get pending() { return scheduled.size }
  }
}

test('first launch: initial timeout recovers once, second timeout shows a recovery prompt', () => {
  const clock = fakeScheduler()
  let reloads = 0
  const failures = []
  const g = createStartupGuard({
    onRetry: () => reloads++,
    onFailure: reason => failures.push(reason),
    schedule: clock.schedule, cancel: clock.cancel,
  })
  g.start()
  clock.next()
  assert.equal(reloads, 1)
  assert.equal(failures.length, 0)
  clock.next()
  assert.deepEqual(failures, ['renderer-not-ready'])
  assert.equal(clock.pending, 0)
  g.stop()
})

test('first launch: ready handshake cancels the recovery timer', () => {
  const clock = fakeScheduler()
  let reloads = 0
  const g = createStartupGuard({
    onRetry: () => reloads++,
    onFailure: () => assert.fail('should not fail after mounted route is ready'),
    schedule: clock.schedule, cancel: clock.cancel,
  })
  g.start()
  assert.equal(clock.pending, 1)
  g.ready()
  assert.equal(clock.pending, 0)
  assert.equal(g.isReady(), true)
  assert.equal(reloads, 0)
})

test('first launch: user can retry once after recovery prompt without an infinite reload loop', () => {
  const clock = fakeScheduler()
  let failures = 0
  const g = createStartupGuard({
    onRetry: () => {},
    onFailure: () => failures++,
    schedule: clock.schedule, cancel: clock.cancel,
  })
  g.start()
  clock.next()
  clock.next()
  assert.equal(failures, 1)
  g.retry()
  clock.next()
  assert.equal(failures, 2)
  g.ready()
  assert.equal(clock.pending, 0)
})

test('Mac updater waits for old app to exit before opening new bundle', async () => {
  const calls = []
  const pid = await scheduleMacRelaunch({
    appPath: '/Applications/D-Space.app',
    backupPath: '/Applications/D-Space.app.old-123',
    extractDir: '/tmp/dspace-update-extract-123',
    oldPid: 5555,
    spawnCommand: (exe, args, options) => {
      calls.push({ exe, args, options })
      const child = new EventEmitter()
      child.pid = 7777
      child.unref = () => { child.wasUnrefed = true }
      process.nextTick(() => child.emit('spawn'))
      return child
    },
  })
  assert.equal(pid, 7777)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].exe, '/bin/sh')
  assert.equal(calls[0].args[3], '5555')
  assert.equal(calls[0].args[4], '/Applications/D-Space.app')
  assert.equal(calls[0].args[5], '/Applications/D-Space.app.old-123')
  assert.equal(calls[0].options.detached, true)
  assert(RELAUNCH_SCRIPT.indexOf('kill -0') < RELAUNCH_SCRIPT.indexOf('/usr/bin/open -a'))
  assert(RELAUNCH_SCRIPT.indexOf('/usr/bin/open -a') < RELAUNCH_SCRIPT.indexOf('/bin/rm -rf'))
})

test('Mac updater will not exit old app when relaunch assistant cannot start', async () => {
  await assert.rejects(scheduleMacRelaunch({
    appPath: '/Applications/D-Space.app',
    backupPath: '/Applications/D-Space.app.old-123',
    extractDir: '/tmp/dspace-update-extract-123',
    spawnCommand: () => {
      const child = new EventEmitter()
      child.unref = () => {}
      process.nextTick(() => child.emit('error', new Error('helper spawn denied')))
      return child
    },
  }), /helper spawn denied/)
})

test('Mac updater rejects invalid app or backup paths', async () => {
  await assert.rejects(scheduleMacRelaunch({
    appPath: '/Applications/not-an-app',
    backupPath: '/Applications/not-an-app.old-123',
    extractDir: '/tmp/dspace-update-extract-123',
  }), /必须是已安装的/)
})

test('Mac readiness handshake is routed from Vue after router readiness', () => {
  const root = path.join(__dirname, '..')
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8')
  const electron = fs.readFileSync(path.join(root, 'electron/main.cjs'), 'utf8')
  assert(main.indexOf('await router.isReady()') < main.indexOf('notifyAppReady?.()'))
  assert.match(electron, /renderer-app-ready/)
  assert.match(electron, /event.senderFrame !== mainWindow.webContents.mainFrame/)
  assert.match(electron, /reloadIgnoringCache/)
})
