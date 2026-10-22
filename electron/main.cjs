const electron = require('electron');
const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, Notification, dialog, shell, session } = electron;
const { autoUpdater } = require('electron-updater');
const path = require('path');
const url = require('url');
const fs = require('fs');
const https = require('https');
const packageJson = require('../package.json');
// 注意：必须显式带 .cjs 扩展名。
// 因为项目 package.json 设了 "type": "module"，.js 文件会被当作 ESM，
// CommonJS 的 main.cjs 无法 require() 一个 ESM 模块。
const macUpdater = require('./mac-updater.cjs');
const { getReleaseChannelConfig, normalizeReleaseChannel } = require('./release-channels.cjs');
const {
  getExpectedReleaseChannel,
  getMacHardwareAccelerationPolicy,
  isReleaseChannelSupported,
  resolveRuntimeReleaseChannel,
} = require('./runtime-compatibility.cjs');

// 设置应用名称（保持与之前版本一致，避免数据丢失）
// 注意：这会影响 userData 路径，修改后会导致无法访问旧数据
app.setName('DigiSmart');

const configuredReleaseChannel = normalizeReleaseChannel(
  process.env.RELEASE_CHANNEL || packageJson.releaseChannel
);
const runtimeReleaseChannel = resolveRuntimeReleaseChannel(
  configuredReleaseChannel || 'modern'
);
const releaseChannel = getReleaseChannelConfig(runtimeReleaseChannel);
const expectedReleaseChannel = getExpectedReleaseChannel();
const isCurrentChannelSupported = isReleaseChannelSupported(configuredReleaseChannel || runtimeReleaseChannel);
const macHardwareAccelerationPolicy = getMacHardwareAccelerationPolicy();

function buildChromeLikeUserAgent() {
  const defaultUserAgent = app.userAgentFallback || ''
  if (defaultUserAgent) {
    return defaultUserAgent.replace(/\sElectron\/[^\s]+/i, '').trim()
  }

  const chromeVersion = process.versions.chrome || '128.0.0.0'

  if (process.platform === 'darwin') {
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
  }

  if (process.platform === 'win32') {
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
  }

  return `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
}

const chromeLikeUserAgent = buildChromeLikeUserAgent()
app.userAgentFallback = chromeLikeUserAgent

if (macHardwareAccelerationPolicy.disableHardwareAcceleration) {
  app.disableHardwareAcceleration();
}

// 调试：打印 electron 对象
console.log('Electron module:', electron);
console.log('App object:', app);
console.log('[Release] 配置发布线:', configuredReleaseChannel || 'modern');
console.log('[Release] 当前生效发布线:', releaseChannel.id);
console.log('[Release] 当前系统建议发布线:', expectedReleaseChannel);
console.log('[Release] 当前发布线是否受支持:', isCurrentChannelSupported);
console.log('[MacCompat] 硬件加速策略:', macHardwareAccelerationPolicy);
console.log('[UA] 当前 User-Agent:', chromeLikeUserAgent);

// 配置自动更新
autoUpdater.autoDownload = true; // 自动下载更新
autoUpdater.autoInstallOnAppQuit = true; // 退出时自动安装

// 设置更新服务器地址（显式配置）
if (process.env.NODE_ENV !== 'development' && isCurrentChannelSupported) {
  autoUpdater.setFeedURL({
    provider: 'generic',
    // 新的更新服务器目录（必须与 scripts/upload-to-oss.cjs 的上传路径完全一致）
    url: releaseChannel.feedUrl
  });
}

// 日志文件路径
const logFilePath = path.join(app.getPath('userData'), 'update-log.txt');

// 写入日志的函数
function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message); // 也输出到控制台
  try {
    fs.appendFileSync(logFilePath, logMessage);
  } catch (err) {
    console.error('写入日志失败:', err);
  }
}

function buildRuntimeInfoSnapshot() {
  return {
    configuredReleaseChannel: configuredReleaseChannel || 'modern',
    activeReleaseChannel: releaseChannel.id,
    expectedReleaseChannel,
    isCurrentChannelSupported,
    hardwareAccelerationEnabled: !macHardwareAccelerationPolicy.disableHardwareAcceleration,
    hardwareAccelerationReason: macHardwareAccelerationPolicy.reason,
    hardwareAccelerationDetails: macHardwareAccelerationPolicy.details,
    platform: process.platform,
    arch: process.arch,
    versions: {
      app: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    },
    userAgent: chromeLikeUserAgent,
  };
}

let mainWindow;
let tray = null;
let notificationWindow = null; // 通知浮窗
let notificationQueue = []; // 通知队列
let isShowingNotification = false; // 是否正在显示通知
let trayIconPath = null; // 托盘图标路径
let trayIconImage = null; // 保存调整后的托盘图标对象
let trayFlashTimer = null; // 托盘闪烁定时器
let trayFlashing = false; // 是否正在闪烁
let notificationData = null; // 通知数据
let lastNotificationTime = 0; // 上次显示通知的时间戳（防抖）

// 统一处理图标目录与存在性
function getLogoDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'logo')
    : path.join(__dirname, '../src/assets/logo');
}

function resolveLogoPath(fileName) {
  const candidate = path.join(getLogoDir(), fileName);
  return fs.existsSync(candidate) ? candidate : null;
}

// 浏览器窗口图标：优先使用平台专用图标，其次回退到 PNG/Favicon
function getBrowserWindowIcon() {
  const platformIcon = process.platform === 'darwin' ? 'logo.icns' : 'logo.ico';
  const preferredIcon = resolveLogoPath(platformIcon) || resolveLogoPath('logo.png');

  if (preferredIcon) {
    return preferredIcon;
  }

  const packagedFallback = path.join(process.resourcesPath, 'app.ico');
  const devFallback = path.join(__dirname, '../public/favicon.ico');
  if (fs.existsSync(packagedFallback)) return packagedFallback;
  return fs.existsSync(devFallback) ? devFallback : '';
}

// 构建托盘图标：按平台组合 1x/2x 资源，优先新托盘专用文件
function buildTrayIcon() {
  const iconRoot = getLogoDir();
  const resolve = (name) => path.join(iconRoot, name);
  const exists = (name) => fs.existsSync(resolve(name));

  // macOS：使用模板图标，适配深浅色
  if (process.platform === 'darwin') {
    const image = nativeImage.createEmpty();
    let usedPath = null;

    if (exists('tray-mac-18.png')) {
      usedPath = resolve('tray-mac-18.png');
      image.addRepresentation({
        scaleFactor: 1,
        width: 18,
        height: 18,
        buffer: fs.readFileSync(usedPath)
      });
    }

    if (exists('tray-mac-36.png')) {
      const retinaPath = resolve('tray-mac-36.png');
      if (!usedPath) usedPath = retinaPath;
      image.addRepresentation({
        scaleFactor: 2,
        width: 36,
        height: 36,
        buffer: fs.readFileSync(retinaPath)
      });

      // 如果缺少 1x，自动缩放一份，保证非 Retina 也有图标
      if (!exists('tray-mac-18.png')) {
        image.addRepresentation({
          scaleFactor: 1,
          width: 18,
          height: 18,
          buffer: nativeImage.createFromPath(retinaPath).resize({ width: 18, height: 18 }).toPNG()
        });
      }
    }

    if (!image.isEmpty()) {
      image.setTemplateImage(true);
      return { image, iconPath: usedPath };
    }
  }

  // Windows：彩色托盘，提供 1x / 2x
  if (process.platform === 'win32') {
    const image = nativeImage.createEmpty();
    let usedPath = null;

    if (exists('tray-win-16.png')) {
      usedPath = resolve('tray-win-16.png');
      image.addRepresentation({
        scaleFactor: 1,
        width: 16,
        height: 16,
        buffer: fs.readFileSync(usedPath)
      });
    }

    if (exists('tray-win-32.png')) {
      const retinaPath = resolve('tray-win-32.png');
      if (!usedPath) usedPath = retinaPath;
      image.addRepresentation({
        scaleFactor: 2,
        width: 32,
        height: 32,
        buffer: fs.readFileSync(retinaPath)
      });

      if (!exists('tray-win-16.png')) {
        image.addRepresentation({
          scaleFactor: 1,
          width: 16,
          height: 16,
          buffer: nativeImage.createFromPath(retinaPath).resize({ width: 16, height: 16 }).toPNG()
        });
      }
    }

    if (!image.isEmpty()) {
      return { image, iconPath: usedPath };
    }
  }

  // 其他平台或兜底
  const fallbackNames = [
    process.platform === 'win32' ? 'logo.ico' : 'logo.png',
    'logo.png',
    'tray-win-32.png',
    'tray-mac-36.png'
  ];

  let fallbackPath = null;
  for (const name of fallbackNames) {
    if (exists(name)) {
      fallbackPath = resolve(name);
      break;
    }
  }

  if (!fallbackPath) {
    const packagedFallback = path.join(process.resourcesPath, 'app.ico');
    const devFallback = path.join(__dirname, '../public/favicon.ico');
    if (fs.existsSync(packagedFallback)) {
      fallbackPath = packagedFallback;
    } else if (fs.existsSync(devFallback)) {
      fallbackPath = devFallback;
    } else {
      fallbackPath = ''; // 让 nativeImage 返回空图标，避免崩溃
    }
  }

  let image = fallbackPath ? nativeImage.createFromPath(fallbackPath) : nativeImage.createEmpty();

  if (!image.isEmpty()) {
    if (process.platform === 'darwin') {
      image = image.resize({ width: 22, height: 22 });
      image.setTemplateImage(true);
    } else if (process.platform === 'win32') {
      image = image.resize({ width: 16, height: 16 });
    } else {
      image = image.resize({ width: 24, height: 24 });
    }
  } else {
    image = nativeImage.createEmpty();
  }

  return { image, iconPath: fallbackPath };
}

function createWindow() {
  // 关闭默认菜单（在应用就绪后）
  // Menu.setApplicationMenu(null); // 注释以保留刷新等快捷键
  
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    frame: false, // 移除窗口标题栏
    title: 'D-Space',
    icon: getBrowserWindowIcon(),
    show: false, // 先不显示，等页面加载完成后再显示
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false,  // 临时关闭以允许开发者工具
      allowRunningInsecureContent: false,
      imageAnimationPolicy: 'noAnimation',
      backgroundThrottling: false,  // 关闭后台节流，确保开发者工具正常工作
      devTools: process.env.NODE_ENV === 'development',  // 仅开发环境允许开发者工具
      webviewTag: true,  // 启用 webview 标签支持
      sandbox: false,    // 针对 Mac 环境，某些情况下需要关闭沙箱以正常加载内容
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.webContents.setUserAgent(chromeLikeUserAgent);

  // 加载应用
  const startUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:8080'
    : url.format({
        pathname: path.join(__dirname, '../dist/index.html'),
        protocol: 'file:',
        slashes: true
      });

  mainWindow.loadURL(startUrl);

  // 监听页面加载完成
  mainWindow.webContents.on('did-finish-load', () => {
    // 页面加载完成后显示窗口
    mainWindow.show();
    mainWindow.focus();
    console.log('[Window] 页面加载完成，显示窗口');
    
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
      console.log('[DevTools] 页面加载完成，强制打开开发者工具');
    }
  });
  
  // 监听DOM准备就绪
  mainWindow.webContents.on('dom-ready', () => {
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
      console.log('[DevTools] DOM准备就绪，强制打开开发者工具');
    }
  });

  // 窗口关闭事件 - 隐藏到托盘而不是退出
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 创建系统托盘
  createTray();

  // 处理窗口最大化事件
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized', false);
  });
}

function createTray() {
  const { image, iconPath } = buildTrayIcon();

  trayIconPath = iconPath;
  trayIconImage = image;

  console.log(`[Tray] 图标路径: ${trayIconPath || '未找到'}, 打包: ${app.isPackaged}, 平台: ${process.platform}`);

  tray = new Tray(trayIconImage);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: '显示窗口', 
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { 
      label: '隐藏窗口', 
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    { type: 'separator' },
    { 
      label: '退出应用', 
      click: () => {
        app.isQuitting = true;
        // 销毁托盘图标
        if (tray) {
          tray.destroy();
          tray = null;
        }
        // 关闭所有窗口
        if (mainWindow) {
          mainWindow.destroy();
          mainWindow = null;
        }
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('D-Space');
  tray.setContextMenu(contextMenu);
  
  // 鼠标移入托盘图标时显示通知浮窗（但不停止闪烁）
  tray.on('mouse-move', () => {
    if (trayFlashing && notificationData) {
      const now = Date.now();
      // 防抖：3秒内只显示一次通知，避免频繁创建窗口
      if (now - lastNotificationTime > 3000) {
        // 如果通知窗口已存在，先关闭它
        if (notificationWindow && !notificationWindow.isDestroyed()) {
          closeNotificationWindow();
        }
        // 显示新的通知窗口
        showNotificationWindow(notificationData);
        lastNotificationTime = now;
        console.log('[Tray] 鼠标移入，显示通知窗口');
      }
    }
  });
  
  // 点击托盘图标显示/隐藏窗口
  tray.on('click', () => {
    if (mainWindow) {
      // 如果正在闪烁（有新消息）
      if (trayFlashing) {
        // 无论窗口是否可见，都显示并聚焦窗口，同时停止闪烁
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        }
        stopTrayFlash();
        console.log('[Tray] 点击托盘图标（有新消息），打开窗口并停止闪烁');
      } else {
        // 没有新消息时，切换窗口显示/隐藏状态
        if (mainWindow.isVisible() && mainWindow.isFocused()) {
          mainWindow.hide();
          console.log('[Tray] 点击托盘图标（无新消息），隐藏窗口');
        } else {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
          }
          console.log('[Tray] 点击托盘图标（无新消息），显示窗口');
        }
      }
    }
  });
}

// ============================================
// 单实例锁定
// ============================================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 如果没有获得锁，说明已有实例在运行，直接退出
  console.log('[单实例] 应用已在运行，退出当前实例');
  app.quit();
} else {
  // 监听第二个实例启动
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('[单实例] 检测到第二个实例启动，聚焦现有窗口');
    
    // 如果已有窗口，则聚焦它
    if (mainWindow) {
      // 如果窗口被最小化，恢复它
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      
      // 如果窗口不可见，显示它
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        mainWindow.show();
      }
      
      // 聚焦窗口
      mainWindow.focus();
      
      console.log('[单实例] 窗口已恢复并聚焦');
    }
  });
}

// 应用就绪后创建窗口
app.whenReady().then(() => {
  // 设置开机自启动（仅生产环境）
  if (process.env.NODE_ENV !== 'development') {
    app.setLoginItemSettings({
      openAtLogin: true,  // 开机自启动
      openAsHidden: false, // 启动时不隐藏窗口
      path: process.execPath, // 应用路径
      args: [] // 启动参数
    });
    console.log('[App] 已启用开机自启动');
  } else {
    console.log('[App] 开发环境，跳过开机自启动设置');
  }
  
  createWindow();

  // 检查更新（仅生产环境）
  if (process.env.NODE_ENV !== 'development') {
    writeLog('[运行时] ' + JSON.stringify(buildRuntimeInfoSnapshot()));
    writeLog('[更新] 应用版本: ' + app.getVersion());
    writeLog('[更新] 当前发布线: ' + releaseChannel.id);
    writeLog('[更新] 系统建议发布线: ' + expectedReleaseChannel);
    writeLog('[更新] 更新服务器: ' + releaseChannel.feedUrl);
    writeLog('[更新] 日志文件路径: ' + logFilePath);
    if (!isCurrentChannelSupported) {
      writeLog(`[更新] 当前发布线 ${releaseChannel.id} 不支持当前系统，跳过自动更新检查`);
    } else {
      // 延迟5秒后检查更新，避免影响启动速度
      setTimeout(() => {
        writeLog('[更新] 开始检查更新...');
        autoUpdater.checkForUpdates();
      }, 5000);
    }
  } else {
    writeLog('[更新] 开发环境，跳过自动更新检查');
  }

  // 性能监控（开发环境）
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      console.log(`内存使用: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
    }, 30000); // 每30秒输出一次
  }
});

// 所有窗口关闭时的处理
app.on('window-all-closed', () => {
  // 如果是用户主动退出（通过托盘菜单或 Cmd+Q），则完全退出应用
  if (app.isQuitting) {
    // 销毁托盘图标
    if (tray) {
      tray.destroy();
      tray = null;
    }
    app.quit();
  }
  // 否则保持应用在托盘运行（Windows/Linux 行为）
  // macOS 默认行为是关闭窗口后保持应用运行
});

// macOS 用户按 Cmd+Q 退出时
app.on('before-quit', () => {
  app.isQuitting = true;
});

// 激活应用时创建窗口（macOS）
app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
});

// 主进程与渲染进程通信
ipcMain.on('window-minimize', () => {
  if (mainWindow) {
    mainWindow.hide(); // 最小化时隐藏到托盘
  }
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) {
    mainWindow.hide(); // 关闭时隐藏到托盘
  }
});

// 获取窗口最大化状态
ipcMain.handle('is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('get-runtime-info', () => {
  return buildRuntimeInfoSnapshot();
});

// 清空 HTTP 缓存（含内存缓存 + 磁盘缓存）。
// 用于 iframe 类页面（运营管理 / 制度流程平台）右键刷新时强制重新拉接口数据。
// 因为这些页面的子接口（比如 space/list）由远程 SPA 自己发起，
// 默认的 cache-bust query 加在 iframe 主文档 URL 上，触达不到子接口；
// 而远程后端可能给响应配了 Cache-Control: max-age，导致 Chromium 内存缓存复用旧响应。
ipcMain.handle('clear-cache', async () => {
  try {
    await session.defaultSession.clearCache();
    console.log('[Cache] HTTP 缓存已清空');
    return { success: true };
  } catch (err) {
    console.error('[Cache] 清缓存失败:', err);
    return { success: false, error: err && err.message };
  }
});

// 应用退出前清理
app.on('before-quit', async (event) => {
  console.log('[App] 应用即将退出，清理资源...');
  
  // 阻止默认退出行为，等待 MQTT 断开
  event.preventDefault();
  
  try {
    // 通知渲染进程应用即将关闭
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app-closing');
      console.log('[App] 已通知渲染进程关闭 MQTT 连接');
      
      // 等待 MQTT 断开完成（给1秒时间）
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('[App] 通知渲染进程失败:', error);
  }
  
  // 清理托盘
  stopTrayFlash();
  if (tray) {
    tray.destroy();
  }
  if (notificationWindow) {
    notificationWindow.destroy();
  }
  
  console.log('[App] 资源清理完成，退出应用');
  
  // 真正退出应用
  app.exit();
});

// ========== 托盘通知功能 ==========

// 创建通知浮窗
function createNotificationWindow(data) {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  // 浮窗尺寸
  const windowWidth = 360;
  const windowHeight = data.buttons && data.buttons.length > 0 ? 200 : 160;
  
  // 计算浮窗位置（Windows 风格：屏幕右下角）
  const padding = 16; // 距离屏幕边缘的间距
  const targetX = screenWidth - windowWidth - padding;
  const y = screenHeight - windowHeight - padding;
  
	  notificationWindow = new BrowserWindow({
	    width: windowWidth,
	    height: windowHeight,
	    x: targetX,
	    y: y,
	    frame: false, // 无边框
	    transparent: true, // 透明背景
	    alwaysOnTop: true, // 总是在最前面
	    skipTaskbar: true, // 不显示在任务栏
	    focusable: process.platform !== 'darwin', // macOS 上避免点击激活应用
	    resizable: false,
	    movable: false,
	    minimizable: false,
	    maximizable: false,
	    show: false, // 先不显示，创建完成后再显示
    webPreferences: {
      nodeIntegration: true,  // 允许使用 Node.js
      contextIsolation: false  // 关闭上下文隔离以便直接使用 require
    }
  });
  
  // macOS: 防止通知窗口激活应用
  if (process.platform === 'darwin') {
    notificationWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  
  // 加载通知页面
  const notificationHtml = generateNotificationHtml(data);
  notificationWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(notificationHtml)}`);
  
  // 页面加载完成后显示
  notificationWindow.once('ready-to-show', () => {
    if (!notificationWindow || notificationWindow.isDestroyed()) {
      return;
    }
    
    // 记录主窗口当前状态
    const wasMainWindowVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
    
    // 直接显示窗口，不获取焦点
    notificationWindow.showInactive();
    
    // macOS: 如果主窗口之前是隐藏的，确保它保持隐藏
    if (process.platform === 'darwin' && !wasMainWindowVisible) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !wasMainWindowVisible) {
          app.hide();
        }
      }, 50);
    }
    
    // 设置自动关闭定时器（如果 autoClose 不是 false）
    const autoCloseDelay = data.autoClose !== false ? (data.duration || 5000) : 0;
    if (autoCloseDelay > 0) {
      setTimeout(() => {
        closeNotificationWindow();
      }, autoCloseDelay);
    }
  });
  
  // 监听关闭事件
  notificationWindow.on('closed', () => {
    notificationWindow = null;
    isShowingNotification = false;
    // 显示队列中的下一个通知
    processNotificationQueue();
  });
  
  return notificationWindow;
}

// 生成通知浮窗的 HTML
function generateNotificationHtml(data) {
  const title = data.title || '新消息通知';
  const content = data.content || '您有新的消息';
  const time = data.time || new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const type = data.type || 'info'; // success, warning, error, info, chat
  const buttons = data.buttons || []; // 自定义按钮数组
  // 聊天消息类型不显示默认按钮，其他类型在没有自定义按钮时显示默认按钮
  const showDefaultButtons = type !== 'chat' && buttons.length === 0;
  
  // 获取 logo 路径（兼容开发和打包环境）
  let logoDataUrl = '';
  try {
    // 在打包后的应用中，logo 文件在 resources 目录下
    const isDev = !app.isPackaged;
    let logoPath;
    
    if (isDev) {
      // 开发环境：从源代码目录读取
      logoPath = path.join(__dirname, '../src/assets/logo/logo.png');
    } else {
      // 生产环境：从打包后的 resources 目录读取
      logoPath = path.join(process.resourcesPath, 'logo/logo.png');
    }
    
    const logoBase64 = require('fs').readFileSync(logoPath).toString('base64');
    logoDataUrl = `data:image/png;base64,${logoBase64}`;
  } catch (error) {
    console.error('[通知] 读取 logo 失败:', error);
    // 降级方案：使用一个简单的 SVG logo
    logoDataUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iIzJFNzRGRiIvPgo8dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSJib2xkIiBmb250LWZhbWlseT0iQXJpYWwiPkRTPC90ZXh0Pgo8L3N2Zz4=';
  }
  
  // 根据类型设置颜色和图标（钉钉风格）
  const typeConfig = {
    success: {
      headerBg: '#ffffff',
      headerColor: '#333333',
      icon: '✓',
      iconBg: '#00c853',
      borderColor: '#00c853',
      accentColor: '#00c853'
    },
    warning: {
      headerBg: '#ffffff',
      headerColor: '#333333',
      icon: '!',
      iconBg: '#ff9800',
      borderColor: '#ff9800',
      accentColor: '#ff9800'
    },
    error: {
      headerBg: '#ffffff',
      headerColor: '#333333',
      icon: '✕',
      iconBg: '#f44336',
      borderColor: '#f44336',
      accentColor: '#f44336'
    },
    info: {
      headerBg: '#ffffff',
      headerColor: '#333333',
      icon: 'i',
      iconBg: '#2196f3',
      borderColor: '#2196f3',
      accentColor: '#2196f3'
    }
  };
  
  const config = typeConfig[type] || typeConfig.info;
  
  // 生成按钮 HTML
  let buttonsHtml = '';
  if (buttons.length > 0) {
    buttonsHtml = buttons.map((btn, index) => {
      const btnClass = btn.type === 'primary' ? 'btn-primary' : 'btn-secondary';
      return `<button class="btn ${btnClass}" onclick="handleButtonClick(${index})">${btn.text}</button>`;
    }).join('');
  } else if (showDefaultButtons) {
    buttonsHtml = `
      <button class="btn btn-primary" onclick="handleView()">查看</button>
    `;
  }
  
  const footerHtml = buttonsHtml ? `
    <div class="notification-footer">
      ${buttonsHtml}
    </div>
  ` : '';
  
  // 聊天类型：整个卡片可点击
  const isChatType = type === 'chat';
  const containerClickHandler = isChatType ? 'onclick="handleChatClick()"' : '';
  const containerCursor = isChatType ? 'cursor: pointer;' : '';
  
  // 聊天消息的额外数据
  const chatData = data.data || {};
  const fromUserId = chatData.fromUserId || '';
  const sessionId = chatData.sessionId || '';
  const senderName = title || '';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Microsoft YaHei", sans-serif;
      -webkit-app-region: no-drag;
      overflow: hidden;
      background: transparent;
    }
    .notification-container {
      width: 360px;
      background: #fff;
      border-radius: 4px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
      overflow: hidden;
      border-top: 3px solid ${config.accentColor};
    }
    .notification-header {
      background: ${config.headerBg};
      padding: 12px 16px;
      color: ${config.headerColor};
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #f0f0f0;
    }
    .notification-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }
    .notification-logo {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      flex-shrink: 0;
      object-fit: contain;
    }
    .notification-type-icon {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: ${config.iconBg};
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: white;
      font-size: 11px;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
    .notification-app-name {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      flex-shrink: 0;
    }
    .notification-title {
      font-size: 13px;
      font-weight: 500;
      color: #666;
      margin-left: 8px;
      padding-left: 8px;
      border-left: 1px solid #e0e0e0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .notification-time {
      font-size: 12px;
      color: #999;
      flex-shrink: 0;
      margin-left: 10px;
    }
    .notification-close {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: transparent;
      border: none;
      outline: none;
      color: #999;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: 8px;
      transition: all 0.2s;
      flex-shrink: 0;
      -webkit-appearance: none;
      appearance: none;
    }
    .notification-close:hover {
      background: #f5f5f5;
      color: #333;
    }
    .notification-close:focus {
      outline: none;
      border: none;
    }
    .notification-body {
      padding: 16px;
      max-height: 100px;
      overflow-y: auto;
    }
    .notification-content {
      font-size: 14px;
      color: #333;
      line-height: 1.6;
      word-wrap: break-word;
    }
    .notification-footer {
      padding: 16px 16px 18px 16px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      border-top: 1px solid #f0f0f0;
      background: #fafafa;
    }
    .btn {
      padding: 6px 16px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      outline: none;
      font-weight: 500;
    }
    .btn-secondary {
      background: #fff;
      color: #666;
      border: 1px solid #d9d9d9;
    }
    .btn-secondary:hover {
      background: #f5f5f5;
      border-color: #bfbfbf;
    }
    .btn-primary {
      background: ${config.accentColor};
      color: white;
      border: none;
    }
    .btn-primary:hover {
      opacity: 0.85;
    }
    .btn:active {
      transform: translateY(0);
    }
    /* 滚动条样式 */
    .notification-body::-webkit-scrollbar {
      width: 4px;
    }
    .notification-body::-webkit-scrollbar-thumb {
      background: #d9d9d9;
      border-radius: 2px;
    }
    .notification-body::-webkit-scrollbar-thumb:hover {
      background: #bfbfbf;
    }
  </style>
</head>
<body>
  <div class="notification-container">
    <div class="notification-header">
      <div class="notification-header-left">
        <img src="${logoDataUrl}" class="notification-logo" alt="D-Space">
        <div class="notification-app-name">D-Space</div>
        <div class="notification-title">${title}</div>
      </div>
      <div class="notification-time">${time}</div>
      <button class="notification-close" onclick="handleClose()">×</button>
    </div>
    <div class="notification-body">
      <div class="notification-content">${content}</div>
    </div>
    ${footerHtml}
  </div>
  
  <script>
    const { ipcRenderer } = require('electron');
    const notificationData = ${JSON.stringify(data)};
    const buttons = ${JSON.stringify(buttons)};
    
    function handleButtonClick(index) {
      const button = buttons[index];
      ipcRenderer.send('notification-action', {
        action: button.action || button.text,
        data: notificationData
      });
      window.close();
    }
    
    function handleView() {
      ipcRenderer.send('notification-action', {
        action: 'view',
        data: notificationData
      });
      window.close();
    }
    
    function handleClose() {
      ipcRenderer.send('notification-close', notificationData);
      window.close();
    }
  </script>
</body>
</html>
  `;
}

// 显示通知浮窗
function showNotificationWindow(data) {
  // 新通知直接替换旧通知（关闭旧的，显示新的）
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    console.log('[通知] 关闭旧通知，显示新通知');
    notificationWindow.destroy();
    notificationWindow = null;
  }
  
  // 清空队列（新通知替换所有旧通知）
  notificationQueue = [];
  
  isShowingNotification = true;
  createNotificationWindow(data);
}

// 处理通知队列
function processNotificationQueue() {
  if (notificationQueue.length > 0) {
    const nextNotification = notificationQueue.shift();
    console.log('[通知] 显示队列中的通知，剩余:', notificationQueue.length);
    setTimeout(() => {
      showNotificationWindow(nextNotification);
    }, 300); // 延迟一点时间，让上一个通知完全关闭
  }
}

// 关闭通知浮窗
function closeNotificationWindow() {
  if (!notificationWindow || notificationWindow.isDestroyed()) {
    return;
  }
  
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  
  const bounds = notificationWindow.getBounds();
  const startX = bounds.x;
  const targetX = screenWidth; // 滑出到屏幕外
  const duration = 200; // 动画持续时间（毫秒）
  const steps = 15;
  const stepDuration = duration / steps;
  const stepDistance = (targetX - startX) / steps;
  
  let currentStep = 0;
  const slideOut = setInterval(() => {
    if (!notificationWindow || notificationWindow.isDestroyed()) {
      clearInterval(slideOut);
      return;
    }
    
    currentStep++;
    const newX = Math.round(startX + stepDistance * currentStep);
    
    if (currentStep >= steps) {
      clearInterval(slideOut);
      if (notificationWindow && !notificationWindow.isDestroyed()) {
        notificationWindow.destroy();
      }
      notificationWindow = null;
      isShowingNotification = false;
      // 处理队列中的下一个通知
      processNotificationQueue();
    } else {
      notificationWindow.setPosition(newX, bounds.y);
    }
  }, stepDuration);
}

// 开始托盘图标闪烁（保留原有逻辑）
function startTrayFlash(data) {
  if (trayFlashing || !tray) return;
  
  console.log('[Tray] 开始闪烁，通知内容:', data);
  
  trayFlashing = true;
  notificationData = data;
  lastNotificationTime = 0; // 重置时间戳，确保新消息来时可以立即显示通知
  let isVisible = true;
  
  // 更新 Tooltip
  const message = data.content || '您有新的消息';
  tray.setToolTip(`D-Space - 新消息\n(鼠标移入查看详情)`);
  
  // 每500毫秒切换一次图标显示/隐藏
  trayFlashTimer = setInterval(() => {
    if (!tray) {
      stopTrayFlash();
      return;
    }
    
    if (isVisible) {
      // 隐藏图标
      tray.setImage(nativeImage.createEmpty());
    } else {
      // 显示图标（使用调整后的图标对象）
      tray.setImage(trayIconImage);
    }
    isVisible = !isVisible;
  }, 500);
}

// 停止托盘图标闪烁
function stopTrayFlash() {
  if (trayFlashTimer) {
    clearInterval(trayFlashTimer);
    trayFlashTimer = null;
  }
  
  trayFlashing = false;
  notificationData = null;
  lastNotificationTime = 0; // 重置时间戳，下次新消息可以立即显示
  
  // 关闭通知窗口
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    closeNotificationWindow();
  }
  
  // 恢复图标显示和 Tooltip
  if (tray && trayIconImage) {
    tray.setImage(trayIconImage);
    tray.setToolTip('D-Space');
  }
  
  console.log('[Tray] 停止闪烁');
}

// 监听来自渲染进程的通知请求（原有逻辑：托盘闪烁 + 鼠标移入显示）
ipcMain.on('tray-notification', (event, data) => {
  console.log('[IPC] 收到托盘通知请求:', data);
  startTrayFlash(data);
});

// 新增：直接显示通知卡片（类似系统通知，自动弹出）
// 注意：不启动托盘闪烁，避免卡片闪烁问题
ipcMain.on('show-notification-card', (event, data) => {
  console.log('[IPC] 收到卡片通知请求:', data);
  
  // 只显示通知卡片，不启动托盘闪烁
  showNotificationWindow(data);
});

// 监听停止闪烁请求
ipcMain.on('tray-flash-stop', () => {
  stopTrayFlash();
});

// 聊天消息 Toast 窗口引用
let chatToastWindow = null;
let chatToastTimer = null;

// 新增：显示聊天消息 Toast（简洁样式，自动消失，新消息替换旧消息）
ipcMain.on('show-chat-toast', (event, data) => {
  console.log('[IPC] 收到聊天 Toast 请求:', data);
  showChatToast(data);
});

// 聊天 Toast 点击事件处理
ipcMain.on('chat-toast-click', (event, data) => {
  console.log('[IPC] 聊天 Toast 被点击:', data);
  console.log('[IPC] data.fromUserId:', data.fromUserId, 'data.sessionId:', data.sessionId);
  
  // 关闭 Toast
  closeChatToast();
  
  // 显示主窗口
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    
    // 发送跳转事件给渲染进程
    const navigateData = {
      userId: data.fromUserId || '',
      sessionId: data.sessionId || '',
      userName: data.sender || ''
    };
    console.log('[IPC] 发送 navigate-to-chat 事件:', navigateData);
    mainWindow.webContents.send('navigate-to-chat', navigateData);
  }
});

// 显示聊天消息 Toast
function showChatToast(data) {
  // 如果已有 Toast 窗口，先关闭
  if (chatToastWindow && !chatToastWindow.isDestroyed()) {
    chatToastWindow.destroy();
    chatToastWindow = null;
  }
  
  // 清除之前的定时器
  if (chatToastTimer) {
    clearTimeout(chatToastTimer);
    chatToastTimer = null;
  }
  
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  // Toast 尺寸（更小更简洁）
  const windowWidth = 300;
  const windowHeight = 80;
  
  // 计算位置（屏幕右下角）
  const padding = 16;
  const targetX = screenWidth - windowWidth - padding;
  const y = screenHeight - windowHeight - padding;
  const startX = screenWidth + 10; // 起始位置在屏幕外
  
  // 保存数据用于点击处理
  const chatData = data.data || {};
  const clickData = {
    fromUserId: chatData.fromUserId || chatData.userId || '',
    sessionId: chatData.sessionId || '',
    sender: data.sender || ''
  };
  
  console.log('[Toast] 创建 Toast 窗口，点击数据:', clickData);
  
  chatToastWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: startX, // 初始位置在屏幕外
    y: y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,  // 允许使用 Node.js
      contextIsolation: false  // 关闭上下文隔离以便直接使用 require
    }
  });
  
  // macOS: 防止 Toast 窗口激活应用
  if (process.platform === 'darwin') {
    chatToastWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  
  // 生成 Toast HTML（带 IPC 通信）
  const toastHtml = generateChatToastHtmlWithIPC(data, clickData);
  chatToastWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(toastHtml)}`);
  
  chatToastWindow.once('ready-to-show', () => {
    if (!chatToastWindow || chatToastWindow.isDestroyed()) return;
    
    // 记录主窗口当前状态
    const wasMainWindowVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
    
    chatToastWindow.showInactive();  // 显示但不获取焦点
    
    // macOS: 如果主窗口之前是隐藏的，确保它保持隐藏
    if (process.platform === 'darwin' && !wasMainWindowVisible && mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !wasMainWindowVisible) {
          mainWindow.hide();
        }
      }, 10);
    }
    
    // 从右侧滑入动画
    const duration = 250; // 动画持续时间（毫秒）
    const steps = 15;
    const stepDuration = duration / steps;
    const stepDistance = (startX - targetX) / steps;
    
    let currentStep = 0;
    const slideIn = setInterval(() => {
      if (!chatToastWindow || chatToastWindow.isDestroyed()) {
        clearInterval(slideIn);
        return;
      }
      
      currentStep++;
      const newX = Math.round(startX - stepDistance * currentStep);
      
      if (currentStep >= steps) {
        chatToastWindow.setPosition(targetX, y);
        clearInterval(slideIn);
      } else {
        chatToastWindow.setPosition(newX, y);
      }
    }, stepDuration);
    
    // 设置自动关闭
    const autoCloseDuration = data.duration || 3000;
    chatToastTimer = setTimeout(() => {
      closeChatToast();
    }, autoCloseDuration);
  });
  
  chatToastWindow.on('closed', () => {
    chatToastWindow = null;
  });
}

// 生成带 IPC 通信的 Toast HTML
function generateChatToastHtmlWithIPC(data, clickData) {
  const sender = data.sender || '新消息';
  const content = data.content || '';
  
  // 将点击数据序列化
  const clickDataStr = JSON.stringify(clickData);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: transparent;
      overflow: hidden;
    }
    .toast {
      background: rgba(255, 255, 255, 0.98);
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: background 0.2s;
      position: relative;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .toast:hover {
      background: rgba(245, 247, 250, 0.98);
    }
    .toast:active {
      background: rgba(235, 238, 245, 0.98);
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: linear-gradient(135deg, #2E74FF 0%, #A9ADE4 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .content {
      flex: 1;
      min-width: 0;
      padding-right: 20px;
    }
    .sender {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .message {
      font-size: 13px;
      color: #666;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .close-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: transparent;
      border: none;
      outline: none;
      color: #999;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      line-height: 1;
      -webkit-appearance: none;
      appearance: none;
    }
    .close-btn:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #333;
    }
    .close-btn:focus {
      outline: none;
      border: none;
    }
  </style>
</head>
<body>
  <div class="toast" id="toast">
    <div class="avatar">${sender.charAt(0)}</div>
    <div class="content">
      <div class="sender">${sender}</div>
      <div class="message">${content}</div>
    </div>
    <button class="close-btn" id="closeBtn">×</button>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    const clickData = ${clickDataStr};
    
    const toast = document.getElementById('toast');
    const closeBtn = document.getElementById('closeBtn');
    
    // 鼠标移入时暂停自动关闭
    toast.addEventListener('mouseenter', function() {
      console.log('[Toast] 鼠标移入，暂停自动关闭');
      ipcRenderer.send('chat-toast-pause');
    });
    
    // 鼠标移出时恢复自动关闭
    toast.addEventListener('mouseleave', function() {
      console.log('[Toast] 鼠标移出，恢复自动关闭');
      ipcRenderer.send('chat-toast-resume');
    });
    
    // 点击关闭按钮只关闭卡片（优先处理）
    closeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('[Toast] 关闭按钮点击');
      ipcRenderer.send('chat-toast-close');
    }, true);  // 使用捕获阶段
    
    // 点击卡片跳转到聊天
    toast.addEventListener('click', function(e) {
      // 如果点击的是关闭按钮或其子元素，不触发跳转
      if (e.target === closeBtn || closeBtn.contains(e.target)) {
        return;
      }
      console.log('[Toast] 点击事件触发，发送 IPC');
      ipcRenderer.send('chat-toast-click', clickData);
    });
  </script>
</body>
</html>
  `;
}

// 处理聊天 Toast 点击
// 关闭聊天 Toast
function closeChatToast() {
  if (chatToastTimer) {
    clearTimeout(chatToastTimer);
    chatToastTimer = null;
  }
  if (chatToastWindow && !chatToastWindow.isDestroyed()) {
    chatToastWindow.destroy();
    chatToastWindow = null;
  }
}

// 监听聊天 Toast 关闭按钮点击
ipcMain.on('chat-toast-close', () => {
  console.log('[IPC] 聊天 Toast 关闭按钮被点击');
  
  // 记录关闭前主窗口是否可见
  const wasMainWindowVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
  
  // 关闭 Toast
  closeChatToast();
  
  // macOS: 点击通知窗口会激活应用，需要在关闭后将主窗口隐藏回去
  if (process.platform === 'darwin' && !wasMainWindowVisible) {
    // 使用 app.hide() 隐藏整个应用，而不是单个窗口
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !wasMainWindowVisible) {
        app.hide();
      }
    }, 50);
  }
});

// 监听聊天 Toast 暂停自动关闭（鼠标移入）
ipcMain.on('chat-toast-pause', () => {
  console.log('[IPC] 暂停 Toast 自动关闭');
  if (chatToastTimer) {
    clearTimeout(chatToastTimer);
    chatToastTimer = null;
  }
});

// 监听聊天 Toast 恢复自动关闭（鼠标移出）
ipcMain.on('chat-toast-resume', () => {
  console.log('[IPC] 恢复 Toast 自动关闭');
  // 重新设置 3 秒后关闭
  if (chatToastWindow && !chatToastWindow.isDestroyed()) {
    if (chatToastTimer) {
      clearTimeout(chatToastTimer);
    }
    chatToastTimer = setTimeout(() => {
      closeChatToast();
    }, 3000);
  }
});

// 监听关闭应用请求（从登录页面）
ipcMain.on('app-close', () => {
  console.log('[IPC] 收到关闭应用请求');
  // 关闭所有窗口并退出应用
  app.quit();
});

// 监听通知按钮点击事件
ipcMain.on('notification-action', (event, payload) => {
  console.log('[IPC] 用户点击通知按钮:', payload);
  
  const { action, data } = payload;
  
  // 记录主窗口当前状态
  const wasMainWindowVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
  
  // 停止托盘闪烁
  stopTrayFlash();
  
  // 判断是否需要显示主窗口
  // "稍后查看" 或 "later" 或 "dismiss" 等操作，只关闭通知，不显示窗口
  const shouldShowWindow = !['later', 'dismiss', '稍后查看'].includes(action);
  
  if (shouldShowWindow) {
    // 只有需要执行操作的按钮（如"立即查看"），才显示主窗口
    console.log('[IPC] 显示主窗口 - action:', action);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
    
    // 发送按钮点击事件给渲染进程
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('notification-action', { action, data });
    }
  } else {
    // "稍后查看"等操作，只记录日志，不做其他处理
    console.log('[IPC] 用户选择稍后查看，不显示窗口');
    
    // macOS: 点击通知窗口会激活应用，需要隐藏回去
    if (process.platform === 'darwin' && !wasMainWindowVisible) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !wasMainWindowVisible) {
          app.hide();
        }
      }, 50);
    }
  }
});

// 监听通知关闭事件
ipcMain.on('notification-close', (event, data) => {
  console.log('[IPC] 用户关闭通知:', data);
  
  // 记录关闭前主窗口是否可见
  const wasMainWindowVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
  
  // 停止托盘闪烁
  stopTrayFlash();
  
  // macOS: 点击通知窗口会激活应用，需要隐藏回去
  if (process.platform === 'darwin' && !wasMainWindowVisible) {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !wasMainWindowVisible) {
        app.hide();
      }
    }, 50);
  }
});

// 监听通知确定按钮点击（保留向后兼容）
ipcMain.on('notification-confirm', (event, data) => {
  console.log('[IPC] 用户点击确定:', data);
  
  // 停止托盘闪烁
  stopTrayFlash();
  
  // 显示主窗口
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
  
  // 发送确认消息给渲染进程
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('notification-confirmed', data);
  }
  
  closeNotificationWindow();
});

// ==================== 自动更新事件监听 ====================

autoUpdater.on('checking-for-update', () => {
  writeLog('[更新] 正在检查更新...');
});

autoUpdater.on('update-available', (info) => {
  writeLog('[更新] 发现新版本: ' + info.version);
  writeLog('[更新] 新版本信息: ' + JSON.stringify(info));
  // 通知渲染进程有新版本（不弹出通知，静默下载）
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  writeLog('[更新] 当前已是最新版本');
  writeLog('[更新] 当前版本信息: ' + JSON.stringify(info));
});

autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent);
  writeLog('[更新] 下载进度: ' + percent + '%');
  // 通知渲染进程下载进度
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  const platform = process.platform;
  const isMac = platform === 'darwin';

  // 保存 electron-updater 已下载的 zip 路径，
  // mac-updater 静默安装时优先复用，避免重复下载。
  // electron-updater 4.x+ 的事件 payload 里会带 downloadedFile 字段。
  if (isMac && info && info.downloadedFile) {
    macUpdater.setDownloadedFile(info.downloadedFile);
    writeLog('[更新] Mac: 缓存 electron-updater 下载文件: ' + info.downloadedFile);
  }

  if (isMac) {
    writeLog('[更新] Mac: 下载完成，等待用户确认后静默安装');
  } else {
    writeLog('[更新] Windows: 下载完成，自动退出并重启安装');
  }
  
  // 通知渲染进程下载完成（区分平台）
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-downloaded', {
      platform: platform,
      isMac: isMac,
      // 说明：Mac 不再强制走"手动下载"，走 mac-updater 静默替换 .app
      supportSilentInstall: true,
      message: isMac
        ? '新版本已下载完成，点击立即重启安装'
        : '新版本已下载完成，即将重启安装'
    });
  }

  // 注意：之前这里有"800ms 后自动 quitAndInstall"的逻辑，已移除。
  // 现在统一由前端 UpdateIndicator 控制安装时机：
  //   1) 收到 update-downloaded 事件后，进度对话框显示 100% ~ 600ms
  //   2) 前端自动调 install-update IPC，由主进程执行 quitAndInstall
  // 这样用户能完整看到下载进度 + 100% 完成 + 即将重启 的视觉反馈。
});

autoUpdater.on('error', (err) => {
  writeLog('[更新] 更新失败: ' + err.message);
  writeLog('[更新] 错误详情: ' + err.stack);
  
  // 检查是否是签名问题（Mac 常见错误）
  if (process.platform === 'darwin' && err.message.includes('code signature')) {
    writeLog('[更新] Mac 签名错误：应用可能未签名，无法使用自动更新');
    writeLog('[更新] 建议：使用手动下载 .dmg 文件更新，或配置代码签名');
  }
});

// 处理渲染进程请求下载更新
ipcMain.on('download-update', () => {
  if (!isCurrentChannelSupported) {
    writeLog(`[更新] 当前系统不支持 ${releaseChannel.id} 更新通道，忽略下载更新请求`);
    return;
  }
  writeLog('[更新] 用户确认下载更新');
  autoUpdater.downloadUpdate();
});

// 处理渲染进程请求立即安装更新
ipcMain.on('install-update', async (event, payload = {}) => {
  if (!isCurrentChannelSupported) {
    writeLog(`[更新] 当前系统不支持 ${releaseChannel.id} 更新通道，忽略安装更新请求`);
    return;
  }
  const isMac = process.platform === 'darwin';
  console.log('========================================');
  console.log('[更新] 🚀 收到 install-update 消息');
  console.log('[更新] 平台:', isMac ? 'Mac' : 'Windows');
  writeLog('[更新] 用户确认安装更新');

  if (isMac) {
    // Mac：未签名应用不能用 Squirrel.Mac 的 quitAndInstall（会闪退）。
    // 改用自管理静默安装：下载/复用 .zip → 解压 → ditto 替换正在运行的 .app → relaunch。
    writeLog('[更新] Mac: 启动自管理静默安装流程');

    const sendProgress = (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('mac-silent-install-progress', data);
      }
    };

    try {
      await macUpdater.performSilentInstall({
        logger: writeLog,
        downloadUrl: payload && payload.downloadUrl, // 缓存不可用时的回退下载地址
        onProgress: sendProgress,
      });
      // 不会执行到这里，performSilentInstall 内部会 app.relaunch + app.exit
    } catch (error) {
      writeLog('[更新] Mac 静默安装失败: ' + error.message);
      console.error('[更新] Mac 静默安装失败:', error);

      // 失败时通知前端，前端可以降级到原有的"手动下载"流程
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-install-failed', {
          message: error.message,
          // EACCES_APP 表示当前 .app 不可写（如 /Applications 没有 admin 权限）
          // 这种情况下用户必须走手动下载到桌面再拖回 Applications
          useManualDownload: error.code === 'EACCES_APP',
          errorCode: error.code || null,
        });
      }
    }
  } else {
    writeLog('[更新] Windows: 退出并自动静默安装');
    console.log('[更新] Windows: 调用 autoUpdater.quitAndInstall(true, true)');
    // Windows: 静默退出并安装（/S 参数跳过 NSIS wizard）
    try {
      autoUpdater.quitAndInstall(true, true);
      console.log('[更新] Windows: quitAndInstall 调用成功');
    } catch (error) {
      console.error('[更新] Windows: quitAndInstall 调用失败:', error);
      writeLog('[更新] 错误: ' + error.message);

      // 通知前端安装失败
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-install-failed', {
          message: error.message
        });
      }
    }
  }
  console.log('========================================');
});

// 手动触发检查更新（用于测试）
ipcMain.on('check-for-updates', () => {
  if (!isCurrentChannelSupported) {
    writeLog(`[更新] 当前系统不支持 ${releaseChannel.id} 更新通道，忽略手动检查更新请求`);
    return;
  }
  writeLog('[更新] 手动触发检查更新');
  autoUpdater.checkForUpdates();
});

// 手动下载更新文件（Mac 备用方案）
ipcMain.handle('download-update-manually', async (event, { downloadUrl, version, arch }) => {
  console.log('[下载] 手动下载请求:', { downloadUrl, version, arch });
  
  try {
    // 1. 显示保存对话框
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '选择保存位置',
      defaultPath: `D-Space-${arch}.zip`,
      filters: [
        { name: 'Zip Archive', extensions: ['zip'] }
      ],
      buttonLabel: '下载'
    });
    
    if (canceled || !filePath) {
      console.log('[下载] 用户取消下载');
      return { success: false, canceled: true };
    }
    
    console.log('[下载] 保存路径:', filePath);
    
    // 2. 发送下载开始通知
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-started', { filePath });
    }
    
    // 3. 创建文件写入流
    const file = fs.createWriteStream(filePath);
    
    // 4. 下载文件
    return new Promise((resolve, reject) => {
      https.get(downloadUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`下载失败，状态码: ${response.statusCode}`));
          return;
        }
        
        const totalBytes = parseInt(response.headers['content-length'], 10);
        let downloadedBytes = 0;
        
        console.log('[下载] 文件大小:', (totalBytes / 1024 / 1024).toFixed(2), 'MB');
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const progress = (downloadedBytes / totalBytes) * 100;
          
          // 发送下载进度
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download-progress-manual', {
              percent: progress,
              transferred: downloadedBytes,
              total: totalBytes
            });
          }
          
          // 每 10% 打印一次进度
          if (Math.floor(progress / 10) !== Math.floor((progress - (chunk.length / totalBytes * 100)) / 10)) {
            console.log(`[下载] 进度: ${progress.toFixed(2)}%`);
          }
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close(() => {
            console.log('[下载] 下载完成:', filePath);
            
            // 发送完成通知
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('download-complete-manual', { filePath });
            }
            
            resolve({
              success: true,
              filePath: filePath
            });
          });
        });
      }).on('error', (err) => {
        fs.unlink(filePath, () => {}); // 删除未完成的文件
        console.error('[下载] 下载失败:', err);
        reject(err);
      });
    });
    
  } catch (error) {
    console.error('[下载] 处理下载请求失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 打开下载完成的文件所在文件夹
ipcMain.on('show-item-in-folder', (event, filePath) => {
  console.log('[文件] 在文件夹中显示:', filePath);
  shell.showItemInFolder(filePath);
});

// 打开外部链接
ipcMain.on('open-external', (event, url) => {
  console.log('[外部链接] 打开:', url);
  shell.openExternal(url);
});

// 在新窗口中打开链接
ipcMain.on('open-in-new-window', (event, payload) => {
  const targetUrl = typeof payload === 'string' ? payload : payload?.url;

  if (!targetUrl) {
    console.warn('[新窗口] 未提供 URL，忽略请求');
    return;
  }

  console.log('[新窗口] 打开链接:', targetUrl);
  
  // 创建新的浏览器窗口
  const newWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'D-Space - 外部链接',
    icon: process.platform === 'darwin' 
      ? path.join(__dirname, '../src/assets/logo/logo.icns')
      : path.join(__dirname, '../src/assets/logo/logo.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      webviewTag: true,  // 启用 webview 标签支持
      sandbox: false,    // 针对 Mac 环境，确保外部内容正常加载
      devTools: process.env.NODE_ENV === 'development'
    }
  });
  
  // 加载外部链接
  newWindow.loadURL(targetUrl);
  
  // 窗口关闭时清理
  newWindow.on('closed', () => {
    console.log('[新窗口] 窗口已关闭');
  });
  
  // 开发环境打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    newWindow.webContents.openDevTools();
  }
});
