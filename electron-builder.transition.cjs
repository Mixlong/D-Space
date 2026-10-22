const packageJson = require('./package.json')
const { getReleaseChannelConfig } = require('./electron/release-channels.cjs')

const channel = getReleaseChannelConfig('transition')
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
    artifactName: '${productName}-${arch}.${ext}',
  },
  portable: {
    ...(baseBuild.portable || {}),
    artifactName: '${productName}-Portable-${arch}.${ext}',
  },
  mac: {
    ...(baseBuild.mac || {}),
    target: [
      {
        target: 'zip',
        arch: ['x64', 'arm64'],
      },
    ],
    artifactName: '${productName}-${arch}.${ext}',
  },
  dmg: undefined,
  linux: undefined,
}
