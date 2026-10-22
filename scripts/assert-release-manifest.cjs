const fs = require('fs')
const path = require('path')

const expectedChannel = String(process.argv[2] || '').trim().toLowerCase()
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
)

const expectedElectronMajor = {
  transition: 21,
  legacy: 21,
  modern: 32,
}

if (!expectedChannel || !expectedElectronMajor[expectedChannel]) {
  console.error('用法: node scripts/assert-release-manifest.cjs <transition|legacy|modern>')
  process.exit(1)
}

const currentChannel = packageJson.releaseChannel
const electronRange = packageJson.devDependencies?.electron || ''
const matchedMajor = Number((electronRange.match(/(\d+)/) || [])[1] || 0)

if (currentChannel !== expectedChannel || matchedMajor !== expectedElectronMajor[expectedChannel]) {
  console.error(
    [
      `当前 package.json 属于 ${currentChannel || 'unknown'} 通道，Electron=${electronRange || 'unknown'}`,
      `目标通道需要 ${expectedChannel} / Electron ${expectedElectronMajor[expectedChannel]}.x`,
      `请先执行: node scripts/use-release-manifest.cjs ${expectedChannel}`,
      '然后重新 npm install 再打包。',
    ].join('\n')
  )
  process.exit(1)
}
