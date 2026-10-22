const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const projectRoot = path.join(__dirname, '..')
const projectName = path.basename(projectRoot)
const parentDir = path.dirname(projectRoot)

const WORKSPACES = {
  build21: {
    id: 'build21',
    dirName: `${projectName}-build-21`,
    manifest: 'transition',
    description: 'transition / legacy (Electron 21)',
  },
  build32: {
    id: 'build32',
    dirName: `${projectName}-build-32`,
    manifest: 'modern',
    description: 'modern (Electron 32)',
  },
}

const RSYNC_EXCLUDES = [
  '.git',
  'node_modules',
  'dist',
  'electron_dist',
  '.DS_Store',
]

function getWorkspaceTargets(name) {
  if (!name || name === 'all') {
    return Object.values(WORKSPACES)
  }

  const workspace = WORKSPACES[name]
  if (!workspace) {
    throw new Error(`未知工作目录: ${name}，可选值: build21, build32, all`)
  }

  return [workspace]
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function syncWorkspace(workspace) {
  const targetDir = path.join(parentDir, workspace.dirName)
  ensureDir(targetDir)

  const args = ['-a', '--delete']
  for (const pattern of RSYNC_EXCLUDES) {
    args.push('--exclude', pattern)
  }
  args.push(`${projectRoot}/`, `${targetDir}/`)

  execFileSync('rsync', args, {
    stdio: 'inherit',
  })

  return targetDir
}

function setupWorkspace(workspace, targetDir) {
  execFileSync('node', ['scripts/use-release-manifest.cjs', workspace.manifest], {
    cwd: targetDir,
    stdio: 'inherit',
  })

  execFileSync('npm', ['install'], {
    cwd: targetDir,
    stdio: 'inherit',
  })
}

function printUsage() {
  console.log([
    '用法:',
    '  node scripts/build-workspaces.cjs sync <build21|build32|all>',
    '  node scripts/build-workspaces.cjs setup <build21|build32|all>',
    '',
    '说明:',
    '  sync  仅同步源码到独立打包目录，不安装依赖',
    '  setup 同步源码，并在目标目录执行 manifest 切换 + npm install',
  ].join('\n'))
}

function main() {
  const action = process.argv[2]
  const targetName = process.argv[3] || 'all'

  if (!action || action === '--help' || action === '-h') {
    printUsage()
    process.exit(0)
  }

  if (!['sync', 'setup'].includes(action)) {
    printUsage()
    process.exit(1)
  }

  const targets = getWorkspaceTargets(targetName)

  for (const workspace of targets) {
    const targetDir = syncWorkspace(workspace)
    console.log(`[build-workspaces] 已同步 ${workspace.description} -> ${targetDir}`)

    if (action === 'setup') {
      setupWorkspace(workspace, targetDir)
      console.log(`[build-workspaces] 已初始化 ${workspace.description}`)
    }
  }
}

main()
