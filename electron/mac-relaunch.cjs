'use strict'

const { spawn } = require('child_process')

// macOS: wait until the old Electron process has fully exited before opening the
// newly installed app. Do not relaunch from the old process during .app replacement.
const RELAUNCH_SCRIPT = [
  'old_pid="$1"',
  'new_app="$2"',
  'backup_app="$3"',
  'extract_dir="$4"',
  'attempt=0',
  'while /bin/kill -0 "$old_pid" 2>/dev/null && [ "$attempt" -lt 100 ]; do',
  '  /bin/sleep 0.2',
  '  attempt=$((attempt + 1))',
  'done',
  '/bin/sleep 1',
  '/usr/bin/open -a "$new_app" --args --updated',
  'code=$?',
  'if [ "$code" -eq 0 ]; then',
  '  /bin/rm -rf "$backup_app" "$extract_dir"',
  'fi',
  'exit "$code"',
].join('\n')

async function scheduleMacRelaunch({
  appPath,
  backupPath,
  extractDir,
  oldPid = process.pid,
  spawnCommand = spawn,
}) {
  if (typeof appPath !== 'string' || !appPath.endsWith('.app')) {
    throw new Error('Mac 重启目标必须是已安装的 .app 路径')
  }
  if (typeof backupPath !== 'string' || !backupPath.startsWith(appPath + '.old-')) {
    throw new Error('Mac 更新备份路径无效')
  }
  if (typeof extractDir !== 'string' || !extractDir.includes('dspace-update-extract-')) {
    throw new Error('Mac 更新解压路径无效')
  }
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawnCommand('/bin/sh', [
        '-c', RELAUNCH_SCRIPT, 'dspace-updater',
        String(oldPid), appPath, backupPath, extractDir,
      ], { detached: true, stdio: 'ignore' })
    } catch (error) {
      reject(error)
      return
    }
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve(child.pid)
    })
  })
}

module.exports = { scheduleMacRelaunch, RELAUNCH_SCRIPT }
