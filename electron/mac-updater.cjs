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
const { execFile } = require('child_process');
const { scheduleMacRelaunch } = require('./mac-relaunch.cjs');
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
 * 下载器同时供 Mac/Windows 字典更新使用。
 * HTTPS、相对重定向、30 秒无响应超时、首字节进度以及异常清理。
 */
function downloadToFile(url, filePath, onProgress, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      return reject(new Error('重定向次数过多'));
    }
    let parsed;
    try {
      parsed = new URL(url);
      if (parsed.protocol !== 'https:') throw new Error('更新文件下载必须使用 HTTPS');
    } catch (error) {
      reject(error);
      return;
    }

    let req = null;
    let response = null;
    let file = null;
    let completed = false;
    const clearTimers = () => {
      clearTimeout(connectTimer);
      clearTimeout(totalTimer);
    };
    const removePartialFile = () => {
      // Windows 上必须等待文件句柄关闭后才能删除未完成的 .part。
      if (file && !file.closed) {
        file.once('close', () => fs.promises.unlink(filePath).catch(() => {}));
        file.destroy();
      } else {
        fs.promises.unlink(filePath).catch(() => {});
      }
    };
    const fail = (error) => {
      if (completed) return;
      completed = true;
      clearTimers();
      if (req) req.destroy();
      if (response) response.destroy();
      removePartialFile();
      reject(error);
    };
    const connectTimer = setTimeout(
      () => fail(new Error('连接更新服务器超时（30 秒），请检查网络或下载地址')),
      30000
    );
    const totalTimer = setTimeout(
      () => fail(new Error('更新包下载超时，请重新下载')),
      15 * 60 * 1000
    );

    try {
      req = https.get(parsed, (res) => {
        response = res;
        clearTimeout(connectTimer);
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          let next;
          try {
            next = new URL(res.headers.location, parsed);
            if (next.protocol !== 'https:') throw new Error('更新地址重定向到了不安全的链接');
          } catch (error) {
            fail(error);
            return;
          }
          res.resume();
          completed = true;
          clearTimers();
          downloadToFile(next.href, filePath, onProgress, redirectCount + 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          fail(new Error(`下载失败，服务器返回 HTTP ${res.statusCode}`));
          return;
        }

        const total = Number(res.headers['content-length']) || 0;
        let downloaded = 0;
        let lastReportedBytes = 0;
        let lastReportedPercent = 0;
        file = fs.createWriteStream(filePath);
        file.on('error', fail);
        res.on('error', fail);
        res.on('aborted', () => fail(new Error('更新服务器中断了下载连接')));
        res.on('data', (chunk) => {
          downloaded += chunk.length;
          const percent = total > 0 ? Math.min(100, downloaded / total * 100) : 0;
          if (onProgress && (lastReportedBytes === 0 || downloaded - lastReportedBytes >= 256 * 1024 ||
              (total > 0 && percent - lastReportedPercent >= 1))) {
            lastReportedBytes = downloaded;
            lastReportedPercent = percent;
            try { onProgress({ downloaded, total, percent }); } catch (error) {}
          }
        });
        res.pipe(file);
        file.on('finish', () => {
          file.close((error) => {
            if (error) return fail(error);
            if (!downloaded || (total > 0 && downloaded !== total)) {
              return fail(new Error('更新包未完整下载，请重新下载'));
            }
            if (completed) return;
            completed = true;
            clearTimers();
            if (onProgress) {
              try { onProgress({ downloaded, total, percent: 100 }); } catch (error) {}
            }
            resolve();
          });
        });
      });
      req.setTimeout(30000, () => req.destroy(new Error('更新服务器 30 秒没有数据响应')));
      req.on('error', fail);
    } catch (error) {
      fail(error);
    }
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

  // 不在旧 .app 仍运行时就清理备份、直接 app.relaunch()。
  // 否则首次启动可能与旧进程退出/Helper 释放资源并发，出现空白窗口。
  logger('[MacUpdater] 等待旧进程退出后从新版 .app 启动');
  onProgress({ downloaded: 0, total: 0, percent: 100, phase: 'relaunching' });
  const helperPid = await scheduleMacRelaunch({
    appPath: currentAppPath,
    backupPath,
    extractDir,
  });
  logger('[MacUpdater] 已启动独立重启助手 pid=' + helperPid + '，退出旧应用');
  app.exit(0);
}

module.exports = {
  setDownloadedFile,
  getDownloadedFile,
  downloadToFile,
  performSilentInstall,
};
