const path = require('path')

const CHANNELS = {
  transition: {
    id: 'transition',
    feedPath: 'd-space/digismart-desktop',
    outputDir: 'electron_dist/transition',
    artifactSuffix: 'transition',
    targets: {
      win: true,
      mac: true,
      linux: false,
    },
  },
  legacy: {
    id: 'legacy',
    feedPath: 'd-space/digismart-desktop-legacy',
    outputDir: 'electron_dist/legacy',
    artifactSuffix: 'legacy',
    targets: {
      win: true,
      mac: false,
      linux: false,
    },
  },
  modern: {
    id: 'modern',
    feedPath: 'd-space/digismart-desktop-modern',
    outputDir: 'electron_dist/modern',
    artifactSuffix: 'modern',
    targets: {
      win: true,
      mac: true,
      linux: true,
    },
  },
}

const DEFAULT_CHANNEL = 'modern'
const OSS_HOST = 'https://file.riding-evolved.com'

function normalizeReleaseChannel(channel) {
  if (!channel) return null
  const normalized = String(channel).trim().toLowerCase()
  return CHANNELS[normalized] ? normalized : null
}

function getReleaseChannelConfig(channel) {
  const resolved = normalizeReleaseChannel(channel) || DEFAULT_CHANNEL
  const config = CHANNELS[resolved]

  return {
    ...config,
    feedUrl: `${OSS_HOST}/${config.feedPath}`,
    absoluteOutputDir: path.join(process.cwd(), config.outputDir),
  }
}

function getAllReleaseChannels() {
  return Object.keys(CHANNELS)
}

module.exports = {
  CHANNELS,
  DEFAULT_CHANNEL,
  OSS_HOST,
  getAllReleaseChannels,
  getReleaseChannelConfig,
  normalizeReleaseChannel,
}
