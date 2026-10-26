const fs = require('fs')
const path = require('path')

const projectRoot = path.join(__dirname, '..')
const nextVersion = String(process.argv[2] || '').trim()
const targetFiles = [
  'package.json',
  'package.legacy.json',
  'package.modern.json',
]

if (!nextVersion) {
  console.error('用法: node scripts/set-release-version.cjs <version>')
  process.exit(1)
}

for (const fileName of targetFiles) {
  const filePath = path.join(projectRoot, fileName)
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  json.version = nextVersion
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`)
  console.log(`已更新 ${fileName} -> ${nextVersion}`)
}
