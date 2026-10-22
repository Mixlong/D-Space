/**
 * Mac 静默更新器（不依赖 Apple Developer ID 签名）
 *
 * 思路与 Tauri 的 macOS 更新器一致：
 *   下载 .app.zip -> 解压 -> ditto 直接替换正在运行的 .app -> relaunch + exit
 *
 * 这条路径**绕过了** Squirrel.Mac 的 codesign 验证，所以未签名应用也能静默更新。
 * 前提：用户对当前 .app 所在目录（一般是 /Applications）有写权限，否则需要走兜底
 *      的"手动下载"流程，由用户手动拖到 Applications。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const { execFile } = require('child_process');
const { app } = require('electron');

// 由 main.cjs 在 electron-updater 的 `update-downloaded` 事件里写入
let cachedDownloadedFile = null;

function setDownloadedFile(filePath) {
  cachedDownloadedFile = filePath || null;
}

function getDownloadedFile() {
  return cachedDownloadedFile;
}

function execAsync(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 1024 * 1024 * 64, ...opts }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * 跟随 30x 重定向下载到本地文件。
 */
function downloadToFile(url, filePath, onProgress, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      return reject(new Error('重定向次数过多'));
    }
    const lib = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filePath);

    let cleaned = false;
    const cleanup = (err) => {
      if (cleaned) return;
      cleaned = true;
      try { file.close(); } catch (e) {}
      try { fs.unlinkSync(filePath); } catch (e) {}
      reject(err);
    };

    const req = lib.get(url, (res) => {
      // 跟随重定向
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        try { file.close(); } catch (e) {}
        try { fs.unlinkSync(filePath); } catch (e) {}
        return downloadToFile(res.headers.location, filePath, onProgress, redirectCount + 1)
          .then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return cleanup(new Error(`下载失败，状态码 ${res.statusCode}`));
      }

      const total = parseInt(res.headers['content-length'], 10) || 0;
      let downloaded = 0;
      let lastReported = 0;

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (onProgress && total) {
          // 节流：每 1% 上报一次
          const percent = (downloaded / total) * 100;
          if (percent - lastReported >= 1 || percent >= 100) {
            lastReported = percent;
            try { onProgress({ downloaded, total, percent }); } catch (e) {}
          }
        }
      });

      res.pipe(file);
      file.on('finish', () => {
        file.close((err) => (err ? cleanup(err) : resolve()));
      });
      res.on('error', cleanup);
    });

    req.on('error', cleanup);
  });
}

/**
 * 解析当前运行应用的 .app bundle 根路径。
 *   app.getPath('exe') => /Applications/D-Space.app/Contents/MacOS/D-Space
 *   我们需要 /Applications/D-Space.app
 */
function resolveCurrentAppPath() {
  const exePath = app.getPath('exe');
  const marker = '.app/';
  const idx = exePath.indexOf(marker);
  if (idx === -1) {
    throw new Error('当前不在 .app 包内运行，无法静默更新（可能是开发环境）');
  }
  return exePath.substring(0, idx + marker.length - 1); // 截到 ".app" 末尾
}

/**
 * 检查目标路径是否可写（不可写一般是因为应用装在 /Applications 但用户没有 admin 权限）。
 */
function checkAppWritable(appPath) {
  try {
    fs.accessSync(appPath, fs.constants.W_OK);
    fs.accessSync(path.dirname(appPath), fs.constants.W_OK);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 在解压目录里找到第一个 .app
 */
function findAppInDir(dir) {
  const entries = fs.readdirSync(dir);
  const appEntry = entries.find((name) => name.endsWith('.app'));
  return appEntry ? path.join(dir, appEntry) : null;
}

/**
 * 执行静默安装。
 *
 * @param {Object} opts
 * @param {(msg: string) => void} [opts.logger] 日志回调
 * @param {string} [opts.downloadUrl] 缓存文件不可用时的回退下载地址
 * @param {(p: { downloaded: number, total: number, percent: number, phase: string }) => void} [opts.onProgress] 进度回调
 */
async function performSilentInstall(opts = {}) {
  const logger = opts.logger || (() => {});
  const onProgress = opts.onProgress || (() => {});

  if (process.platform !== 'darwin') {
    throw new Error('该静默更新流程只在 macOS 上有效');
  }

  // 1. 解析当前 .app 路径
  const currentAppPath = resolveCurrentAppPath();
  logger(`[MacUpdater] 当前应用路径: ${currentAppPath}`);

  // 2. 提前检查写权限。/Applications 下应用，如果用户不是 admin 会装在用户目录或没写权限。
  if (!checkAppWritable(currentAppPath)) {
    const err = new Error('当前应用所在目录不可写（可能需要管理员权限），请使用手动下载方式');
    err.code = 'EACCES_APP';
    throw err;
  }

  // 3. 准备 zip 源：优先用 electron-updater 已经下载好的缓存
  let zipPath = cachedDownloadedFile;
  if (zipPath && !fs.existsSync(zipPath)) {
    logger(`[MacUpdater] 缓存文件已不存在: ${zipPath}，将重新下载`);
    zipPath = null;
  }

  if (!zipPath) {
    if (!opts.downloadUrl) {
      throw new Error('没有可用的更新文件且未提供下载地址');
    }
    zipPath = path.join(os.tmpdir(), `dspace-update-${Date.now()}.zip`);
    logger(`[MacUpdater] 开始下载: ${opts.downloadUrl}`);
    onProgress({ downloaded: 0, total: 0, percent: 0, phase: 'downloading' });
    await downloadToFile(opts.downloadUrl, zipPath, (p) => {
      onProgress({ ...p, phase: 'downloading' });
    });
    logger(`[MacUpdater] 下载完成: ${zipPath}`);
  } else {
    logger(`[MacUpdater] 复用 electron-updater 缓存: ${zipPath}`);
  }

  // 4. 解压到临时目录
  const extractDir = path.join(os.tmpdir(), `dspace-update-extract-${Date.now()}`);
  fs.mkdirSync(extractDir, { recursive: true });
  logger(`[MacUpdater] 解压到 ${extractDir}`);
  onProgress({ downloaded: 0, total: 0, percent: 0, phase: 'extracting' });
  await execAsync('/usr/bin/unzip', ['-q', '-o', zipPath, '-d', extractDir]);

  const newAppPath = findAppInDir(extractDir);
  if (!newAppPath) {
    throw new Error('解压结果中没有找到 .app 包');
  }
  logger(`[MacUpdater] 新版本 .app: ${newAppPath}`);

  // 5. 清除 quarantine 标记（避免重启后弹"未验证开发者"）
  try {
    await execAsync('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', newAppPath]);
    logger('[MacUpdater] 已清除 quarantine 属性');
  } catch (e) {
    // 没有 quarantine 属性时 xattr 会返回非零，但这不算错
    logger(`[MacUpdater] 清除 quarantine 跳过: ${e.message}`);
  }

  // 6. 安全检查：保证目标路径就是当前 .app
  if (!currentAppPath.endsWith('.app')) {
    throw new Error(`安全检查失败：当前路径不是 .app: ${currentAppPath}`);
  }

  // 7. ditto 替换：先把当前 .app 重命名到旁边作为备份，再把新版 ditto 过去
  //    备份保留是为了万一 ditto 失败可以恢复，并且替换中途不会出现"应用消失"的瞬态。
  onProgress({ downloaded: 0, total: 0, percent: 0, phase: 'installing' });

  const backupPath = `${currentAppPath}.old-${Date.now()}`;
  logger(`[MacUpdater] 备份当前应用到 ${backupPath}`);
  await execAsync('/bin/mv', [currentAppPath, backupPath]);

  try {
    logger(`[MacUpdater] ditto ${newAppPath} -> ${currentAppPath}`);
    await execAsync('/usr/bin/ditto', [newAppPath, currentAppPath]);
  } catch (e) {
    // 失败时把备份恢复
    logger(`[MacUpdater] 替换失败，恢复备份: ${e.message}`);
    try {
      await execAsync('/bin/mv', [backupPath, currentAppPath]);
    } catch (restoreErr) {
      logger(`[MacUpdater] 恢复备份失败: ${restoreErr.message}`);
    }
    throw e;
  }

  // 8. 异步删除备份和临时解压目录（不影响主流程，失败也无所谓）
  setTimeout(() => {
    execFile('/bin/rm', ['-rf', backupPath], () => {});
    execFile('/bin/rm', ['-rf', extractDir], () => {});
  }, 0);

  // 9. 重启
  logger('[MacUpdater] 即将重启应用以加载新版本');
  onProgress({ downloaded: 0, total: 0, percent: 100, phase: 'relaunching' });

  // 给前端一点时间显示"重启中"的提示
  setTimeout(() => {
    app.relaunch();
    app.exit(0);
  }, 500);
}

module.exports = {
  setDownloadedFile,
  getDownloadedFile,
  performSilentInstall,
};
