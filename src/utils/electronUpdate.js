/**
 * Electron 自动更新处理
 * 区分 Mac 和 Windows 的更新行为
 */

// 检测是否是 Electron 环境
const isElectron = window.electronAPI !== undefined;

// 判断平台
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const isWindows = navigator.platform.toUpperCase().indexOf('WIN') >= 0;

/**
 * 监听更新事件
 */
export function setupUpdateListeners(messageBox) {
  if (!isElectron) return;

  // 监听：发现新版本
  window.electronAPI.on?.('update-available', (info) => {
    console.log('[Update] 发现新版本:', info);
    
    messageBox.confirm(
      `发现新版本 ${info.version}，是否立即下载？`,
      '版本更新',
      {
        confirmButtonText: '立即下载',
        cancelButtonText: '稍后提醒',
        type: 'info'
      }
    ).then(() => {
      // 用户确认下载
      window.electronAPI.send('download-update');
    }).catch(() => {
      console.log('[Update] 用户取消下载');
    });
  });

  // 监听：下载进度
  window.electronAPI.on?.('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    console.log(`[Update] 下载进度: ${percent}%`);
    // 可以显示进度条
  });

  // 监听：下载完成（关键：区分平台提示）
  window.electronAPI.on?.('update-downloaded', (data) => {
    console.log('[Update] 下载完成:', data);
    
    // 根据平台显示不同的提示
    if (data.isMac) {
      // Mac: 告知用户需要手动重启
      messageBox.confirm(
        '新版本已下载完成！\n\n点击"立即更新"将关闭应用并完成安装，\n安装完成后请手动重新打开应用。',
        'Mac 版本更新',
        {
          confirmButtonText: '立即更新',
          cancelButtonText: '稍后更新',
          type: 'success',
          distinguishCancelAndClose: true,
          closeOnClickModal: false
        }
      ).then(() => {
        // Mac 用户确认更新
        window.electronAPI.send('install-update');
      }).catch(() => {
        console.log('[Update] Mac 用户选择稍后更新');
      });
    } else {
      // Windows: 自动重启
      messageBox.confirm(
        '新版本已下载完成！\n\n点击"立即重启"将自动完成安装并重新打开应用。',
        'Windows 版本更新',
        {
          confirmButtonText: '立即重启',
          cancelButtonText: '退出时更新',
          type: 'success',
          distinguishCancelAndClose: true,
          closeOnClickModal: false
        }
      ).then(() => {
        // Windows 用户确认立即重启
        window.electronAPI.send('install-update');
      }).catch(() => {
        console.log('[Update] Windows 用户选择退出时更新');
        // Windows 会在退出时自动安装
      });
    }
  });

  // 监听：更新错误
  window.electronAPI.on?.('update-error', (error) => {
    console.error('[Update] 更新失败:', error);
    
    if (isMac && error.includes('code signature')) {
      // Mac 签名错误
      messageBox.alert(
        'Mac 自动更新功能暂时不可用。\n\n请访问官网下载最新的 .dmg 文件手动更新。',
        'Mac 更新提示',
        {
          confirmButtonText: '知道了',
          type: 'warning'
        }
      );
    } else {
      messageBox.alert(
        `更新失败：${error}\n\n请稍后重试或联系技术支持。`,
        '更新失败',
        {
          confirmButtonText: '确定',
          type: 'error'
        }
      );
    }
  });
}

/**
 * 手动检查更新
 */
export function checkForUpdates() {
  if (!isElectron) {
    console.warn('[Update] 非 Electron 环境，无法检查更新');
    return;
  }
  
  console.log('[Update] 手动触发检查更新');
  window.electronAPI.send('check-for-updates');
}

/**
 * 获取平台信息
 */
export function getPlatformInfo() {
  return {
    isElectron,
    isMac,
    isWindows,
    platform: navigator.platform
  };
}
