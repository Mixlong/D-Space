'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const https = require('node:https')
const Module = require('node:module')
const { EventEmitter } = require('node:events')
const { PassThrough } = require('node:stream')

// The downloader is also used by Windows, even though the module contains Mac install code.
const originalLoad = Module._load
Module._load = function(request, ...args) {
  if (request === 'electron') return { app: {} }
  return originalLoad.call(this, request, ...args)
}
const { downloadToFile } = require('../electron/mac-updater.cjs')
Module._load = originalLoad

function mockHttps(t, responses) {
  const originalGet = https.get
  const requests = []
  https.get = (url, callback) => {
    const address = String(url)
    requests.push(address)
    const req = new EventEmitter()
    req.setTimeout = (_ms, onTimeout) => { req.timeoutHandler = onTimeout }
    req.destroy = error => {
      if (error) process.nextTick(() => req.emit('error', error))
    }
    process.nextTick(() => {
      const responseData = responses[requests.length - 1]
      if (!responseData) return req.emit('error', new Error('unexpected URL'))
      const response = new PassThrough()
      response.statusCode = responseData.status || 200
      response.headers = responseData.headers || {}
      callback(response)
      if (responseData.body) response.end(responseData.body)
      else response.end()
    })
    return req
  }
  t.after(() => { https.get = originalGet })
  return requests
}

function tmp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dspace-updater-download-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return path.join(dir, 'update.part')
}

test('download reports real received bytes even without content-length', async t => {
  const body = Buffer.from('download content without content-length')
  mockHttps(t, [{ body }])
  const path = tmp(t)
  const progress = []
  await downloadToFile('https://file.riding-evolved.com/test.exe', path, data => progress.push(data))
  assert.deepEqual(fs.readFileSync(path), body)
  assert(progress.some(x => x.downloaded > 0 && x.total === 0))
  assert.equal(progress.at(-1).percent, 100)
})

test('relative HTTPS redirect is resolved safely without a file creation race', async t => {
  const requests = mockHttps(t, [
    { status: 302, headers: { location: '/next.exe' } },
    { body: Buffer.from('second response') },
  ])
  const path = tmp(t)
  await downloadToFile('https://file.riding-evolved.com/first.exe', path)
  assert.equal(requests[1], 'https://file.riding-evolved.com/next.exe')
  assert.equal(fs.readFileSync(path, 'utf8'), 'second response')
})

test('HTTP error shows useful failure instead of sitting at 0 bytes', async t => {
  mockHttps(t, [{ status: 404 }])
  const path = tmp(t)
  await assert.rejects(downloadToFile('https://file.riding-evolved.com/bad.exe', path), /HTTP 404/)
  assert.equal(fs.existsSync(path), false)
})

test('redirect from HTTPS to HTTP is blocked', async t => {
  mockHttps(t, [{ status: 302, headers: { location: 'http://example.com/unsafe.exe' } }])
  const path = tmp(t)
  await assert.rejects(downloadToFile('https://file.riding-evolved.com/file.exe', path), /不安全/)
})

test('request timeout produces a failure and no partial installation file', async t => {
  const originalGet = https.get
  https.get = (_url, _callback) => {
    const req = new EventEmitter()
    req.setTimeout = (_ms, onTimeout) => process.nextTick(onTimeout)
    req.destroy = error => {
      if (error) process.nextTick(() => req.emit('error', error))
    }
    return req
  }
  t.after(() => { https.get = originalGet })
  const path = tmp(t)
  await assert.rejects(downloadToFile('https://file.riding-evolved.com/stalled.exe', path), /30 秒/)
  assert.equal(fs.existsSync(path), false)
})
