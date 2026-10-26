const packageJson = require('./package.json')
const { getReleaseChannelConfig } = require('./electron/release-channels.cjs')

const channel = getReleaseChannelConfig('modern')
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
    // 版本号进入对象名，避免 CDN 复用上一版本同名 EXE。
    // electron-builder 会把实际文件名同步写入 latest.yml。
    artifactName: '${productName}-modern-${version}-${arch}.${ext}',
  },
  portable: {
    ...(baseBuild.portable || {}),
    artifactName: '${productName}-modern-Portable-${arch}.${ext}',
  },
  mac: {
    ...(baseBuild.mac || {}),
    artifactName: '${productName}-modern-${arch}.${ext}',
  },
  linux: {
    ...(baseBuild.linux || {}),
    artifactName: '${productName}-modern-${arch}.${ext}',
  },
}
