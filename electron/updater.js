const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

class AppUpdater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.setupAutoUpdater();
  }

  setupAutoUpdater() {
    // 配置更新服务器
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'https://bikewise.oss-cn-shenzhen.aliyuncs.com/d-space/digismart-desktop' // 与 scripts/upload-to-oss.cjs 的上传路径保持一致
    });

    // 自动下载更新
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // 检查更新中
    autoUpdater.on('checking-for-update', () => {
      console.log('正在检查更新...');
      this.sendToRenderer('checking-for-update');
    });

    // 发现新版本
    autoUpdater.on('update-available', (info) => {
      console.log('发现新版本:', info.version);
      this.sendToRenderer('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });

      // 询问用户是否下载
      dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 ${info.version}，是否立即下载？`,
        buttons: ['立即下载', '稍后提醒'],
        defaultId: 0,
        cancelId: 1
      }).then(result => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
    });

    // 没有可用更新
    autoUpdater.on('update-not-available', (info) => {
      console.log('当前已是最新版本');
      this.sendToRenderer('update-not-available', info);
    });

    // 下载进度
    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      console.log(`下载进度: ${percent}%`);
      this.sendToRenderer('download-progress', {
        percent: percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond
      });
    });

    // 下载完成
    autoUpdater.on('update-downloaded', (info) => {
      console.log('更新下载完成');
      this.sendToRenderer('update-downloaded', info);

      // 询问用户是否立即安装
      dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: '更新下载完成',
        message: '新版本已下载完成，是否立即重启应用进行更新？',
        buttons: ['立即重启', '稍后重启'],
        defaultId: 0,
        cancelId: 1
      }).then(result => {
        if (result.response === 0) {
          // 退出并安装更新
          autoUpdater.quitAndInstall(false, true);
        }
      });
    });

    // 更新错误
    autoUpdater.on('error', (err) => {
      console.error('更新错误:', err);
      this.sendToRenderer('update-error', {
        message: err.message
      });

      dialog.showErrorBox('更新错误', `检查更新时发生错误：${err.message}`);
    });
  }

  // 发送消息到渲染进程
  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  // 检查更新
  checkForUpdates() {
    autoUpdater.checkForUpdates();
  }

  // 手动下载更新
  downloadUpdate() {
    autoUpdater.downloadUpdate();
  }

  // 退出并安装
  quitAndInstall() {
    autoUpdater.quitAndInstall(false, true);
  }
}

module.exports = AppUpdater;
