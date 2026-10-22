const os = require('os')
const { execFileSync } = require('child_process')

const LEGACY_WINDOWS_RELEASE_PREFIXES = ['6.1', '6.2', '6.3']
const MONTEREY_DARWIN_MAJOR = 21
const RISKY_INTEL_MAC_MODELS = new Set([
  'MacBookAir7,1',
  'MacBookAir7,2',
  'MacBookPro11,1',
  'MacBookPro11,2',
  'MacBookPro12,1',
  'Macmini7,1',
  'iMac16,1',
  'iMac16,2',
])

function getWindowsReleaseLine(release = os.release()) {
  if (LEGACY_WINDOWS_RELEASE_PREFIXES.some((prefix) => release.startsWith(prefix))) {
    return 'legacy'
  }
  return 'modern'
}

function getExpectedReleaseChannel(runtime = {}) {
  const platform = runtime.platform || process.platform
  const release = runtime.osRelease || os.release()

  if (platform === 'win32') {
    return getWindowsReleaseLine(release)
  }

  if (platform === 'darwin' || platform === 'linux') {
    return 'modern'
  }

  return 'modern'
}

function resolveRuntimeReleaseChannel(configuredChannel, runtime = {}) {
  if (configuredChannel === 'transition') {
    return getExpectedReleaseChannel(runtime)
  }

  return configuredChannel
}

function isReleaseChannelSupported(channel, runtime = {}) {
  const resolvedChannel = resolveRuntimeReleaseChannel(channel, runtime)
  const platform = runtime.platform || process.platform
  const release = runtime.osRelease || os.release()

  if (resolvedChannel === 'legacy') {
    return platform === 'win32' && getWindowsReleaseLine(release) === 'legacy'
  }

  if (resolvedChannel === 'modern') {
    if (platform === 'win32') {
      return getWindowsReleaseLine(release) === 'modern'
    }

    return platform === 'darwin' || platform === 'linux'
  }

  return false
}

function readMacHardwareModel() {
  if (process.platform !== 'darwin') {
    return null
  }

  try {
    return execFileSync('/usr/sbin/sysctl', ['-n', 'hw.model'], {
      encoding: 'utf8',
    }).trim()
  } catch (error) {
    return null
  }
}

function getMacHardwareAccelerationPolicy(runtime = {}) {
  const platform = runtime.platform || process.platform
  const arch = runtime.arch || process.arch
  const osRelease = runtime.osRelease || os.release()
  const model = runtime.model || readMacHardwareModel()

  const basePolicy = {
    disableHardwareAcceleration: false,
    reason: 'not-applicable',
    details: {
      platform,
      arch,
      osRelease,
      model,
    },
  }

  if (platform !== 'darwin') {
    return basePolicy
  }

  if (arch !== 'x64') {
    return {
      ...basePolicy,
      reason: 'non-intel-mac',
    }
  }

  const darwinMajor = Number(osRelease.split('.')[0] || 0)
  if (darwinMajor === MONTEREY_DARWIN_MAJOR) {
    return {
      disableHardwareAcceleration: true,
      reason: 'intel-monterey',
      details: basePolicy.details,
    }
  }

  if (model && RISKY_INTEL_MAC_MODELS.has(model)) {
    return {
      disableHardwareAcceleration: true,
      reason: 'risky-intel-model',
      details: basePolicy.details,
    }
  }

  return {
    ...basePolicy,
    reason: 'intel-mac-safe-default',
  }
}

module.exports = {
  getExpectedReleaseChannel,
  getMacHardwareAccelerationPolicy,
  getWindowsReleaseLine,
  isReleaseChannelSupported,
  readMacHardwareModel,
  resolveRuntimeReleaseChannel,
}
