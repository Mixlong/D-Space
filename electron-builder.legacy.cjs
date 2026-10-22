const packageJson = require('./package.json')
const { getReleaseChannelConfig } = require('./electron/release-channels.cjs')

const channel = getReleaseChannelConfig('legacy')
const baseBuild = packageJson.build || {}

module.exports = {
  ...baseBuild,
  publish: {
    provider: 'generic',
    url: channel.feedUrl,
  },
  directories: {
    ...(baseBuild.directories || {}),
    output: channel.outputDir,
  },
  extraMetadata: {
    releaseChannel: channel.id,
  },
  win: {
    ...(baseBuild.win || {}),
    artifactName: '${productName}-legacy-${arch}.${ext}',
  },
  portable: {
    ...(baseBuild.portable || {}),
    artifactName: '${productName}-legacy-Portable-${arch}.${ext}',
  },
  mac: undefined,
  dmg: undefined,
  linux: undefined,
}
