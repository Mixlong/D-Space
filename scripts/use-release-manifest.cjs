const fs = require('fs')
const path = require('path')

const targetChannel = String(process.argv[2] || '').trim().toLowerCase()
const projectRoot = path.join(__dirname, '..')
const sourceFile = path.join(projectRoot, `package.${targetChannel}.json`)
const targetFile = path.join(projectRoot, 'package.json')

if (!targetChannel || !fs.existsSync(sourceFile)) {
  console.error('用法: node scripts/use-release-manifest.cjs <legacy|modern>')
  process.exit(1)
}

fs.copyFileSync(sourceFile, targetFile)
console.log(`已切换 package.json -> ${path.basename(sourceFile)}`)
