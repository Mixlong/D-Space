const path = require('path')
const { execFileSync } = require('child_process')

const projectRoot = path.join(__dirname, '..')
const parentDir = path.dirname(projectRoot)
const build21Dir = path.join(parentDir, 'DigiSmart-build-21')
const build32Dir = path.join(parentDir, 'DigiSmart-build-32')

const action = String(process.argv[2] || 'build').trim().toLowerCase()

if (!['build', 'publish'].includes(action)) {
  console.error('用法: node scripts/build-release-pair.cjs <build|publish>')
  process.exit(1)
}

function run(cmd, args, cwd) {
  execFileSync(cmd, args, {
    cwd,
    stdio: 'inherit',
  })
}

function ensureWorkspace(dir, name) {
  try {
    run('test', ['-d', dir], projectRoot)
  } catch (_error) {
    console.error(`${name} 不存在: ${dir}`)
    console.error('请先执行: npm run setup:builds')
    process.exit(1)
  }
}

ensureWorkspace(build21Dir, 'build-21 目录')
ensureWorkspace(build32Dir, 'build-32 目录')

run('npm', ['run', 'sync:builds'], projectRoot)

run('npm', ['run', 'use:legacy'], build21Dir)
run('node', ['-e', "console.log('build-21 electron=' + require('./node_modules/electron/package.json').version)"], build21Dir)
run('npm', ['run', 'build:legacy'], build21Dir)
if (action === 'publish') {
  run('npm', ['run', 'upload:oss:legacy'], build21Dir)
}

run('npm', ['run', 'use:modern'], build32Dir)
run('node', ['-e', "console.log('build-32 electron=' + require('./node_modules/electron/package.json').version)"], build32Dir)
run('npm', ['run', 'build:mac-win'], build32Dir)
if (action === 'publish') {
  run('npm', ['run', 'upload:oss:modern'], build32Dir)
}
