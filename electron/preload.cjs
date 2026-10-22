const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('is-maximized'),

  // 清空 HTTP 缓存（含内存 + 磁盘），用于 iframe 页面右键刷新时强制让子接口重新拉
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  
  // 监听窗口状态变化
  onWindowMaximized: (callback) => {
    ipcRenderer.on('window-maximized', (event, isMaximized) => callback(isMaximized));
  },
  
  // 移除监听器
  removeWindowMaximizedListener: () => {
    ipcRenderer.removeAllListeners('window-maximized');
  },
  
  // 托盘通知功能（原有逻辑：托盘闪烁 + 鼠标移入显示）
  sendNotification: (data) => ipcRenderer.send('tray-notification', data),
  stopTrayFlash: () => ipcRenderer.send('tray-flash-stop'),
  
  // 新增：直接显示通知卡片（类似系统通知，自动弹出）
  showNotificationCard: (data) => ipcRenderer.send('show-notification-card', data),
  
  // 新增：聊天消息 Toast 通知（简洁样式，自动消失）
  showChatToast: (data) => ipcRenderer.send('show-chat-toast', data),
  
  testNotification: (data) => ipcRenderer.send('test-notification', data), // 测试通知功能
  onNotificationConfirmed: (callback) => {
    ipcRenderer.on('notification-confirmed', (event, data) => callback(data));
  },
  
  // 通用发送方法（用于通知浮窗和其他IPC通信）
  send: (channel, data) => {
    // 白名单，只允许特定的通道
    const validChannels = [
      'notification-confirm', 
      'notification-action', 
      'notification-close',
      'tray-notification',
      'show-notification-card',
      'show-chat-toast',
      'chat-toast-click',
      'tray-flash-stop'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  // 通用监听方法
  on: (channel, callback) => {
    // 白名单，只允许特定的通道
    const validChannels = [
      'notification-confirmed',
      'notification-action',
      'navigate-to-chat',
      'update-available',
      'download-progress',
      'update-downloaded',
      'app-closing'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  
  // 移除监听器
  removeListener: (channel, callback) => {
    const validChannels = [
      'notification-confirmed',
      'notification-action',
      'navigate-to-chat',
      'update-available',
      'download-progress',
      'update-downloaded'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
  
  // 标识当前是Electron环境
  isElectron: true,
  
  // 版本信息
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  
  // 平台信息
  platform: process.platform,
  getRuntimeInfo: () => ipcRenderer.invoke('get-runtime-info'),
  
  // 自动更新相关
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, info) => callback(info));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, progressObj) => callback(progressObj));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, data) => callback(data));
  },
  onUpdateInstallFailed: (callback) => {
    ipcRenderer.on('update-install-failed', (event, data) => callback(data));
  },
  downloadUpdate: () => ipcRenderer.send('download-update'),
  // payload 可选，目前只在 Mac 静默安装时使用（提供回退下载地址）
  installUpdate: (payload) => ipcRenderer.send('install-update', payload),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),

  // Mac 静默安装进度推送
  onMacSilentInstallProgress: (callback) => {
    ipcRenderer.on('mac-silent-install-progress', (event, data) => callback(data));
  },
  
  // 手动下载更新（Mac 备用方案）
  downloadUpdateManually: (params) => ipcRenderer.invoke('download-update-manually', params),
  onDownloadStarted: (callback) => {
    ipcRenderer.on('download-started', (event, data) => callback(data));
  },
  onDownloadProgressManual: (callback) => {
    ipcRenderer.on('download-progress-manual', (event, progress) => callback(progress));
  },
  onDownloadCompleteManual: (callback) => {
    ipcRenderer.on('download-complete-manual', (event, data) => callback(data));
  },
  showItemInFolder: (filePath) => ipcRenderer.send('show-item-in-folder', filePath),
  
  // 打开外部链接
  openExternal: (url) => ipcRenderer.send('open-external', url),
  
  // 在新窗口中打开链接
  openInNewWindow: (url) => ipcRenderer.send('open-in-new-window', url),
  
  // 移除更新事件监听器
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('update-install-failed');
    ipcRenderer.removeAllListeners('download-started');
    ipcRenderer.removeAllListeners('download-progress-manual');
    ipcRenderer.removeAllListeners('download-complete-manual');
    ipcRenderer.removeAllListeners('mac-silent-install-progress');
  }
});

// 页面加载完成后通知
window.addEventListener('DOMContentLoaded', () => {
  console.log('Electron预加载脚本已加载');
  console.log('Node版本:', process.versions.node);
  console.log('Chrome版本:', process.versions.chrome);
  console.log('Electron版本:', process.versions.electron);
  ipcRenderer.invoke('get-runtime-info')
    .then((runtimeInfo) => {
      console.log('[Electron Runtime]', runtimeInfo);
    })
    .catch((error) => {
      console.error('[Electron Runtime] 获取运行时信息失败', error);
    });
});
