const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  Notification,
  shell,
  session,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const url = require("url");
const fs = require("fs");

// =====================================
// 低配电脑兼容性优化
// =====================================
// 禁用 GPU 沙盒（某些旧显卡可能不支持）
app.commandLine.appendSwitch("disable-gpu-sandbox");
// 禁用 GPU 硬件加速（如果有问题可以取消注释）
// app.commandLine.appendSwitch('disable-gpu');
// 使用软件渲染（备选方案，性能较低但兼容性好）
// app.commandLine.appendSwitch('disable-software-rasterizer');
// 禁用 GPU 进程崩溃限制
app.commandLine.appendSwitch("disable-gpu-process-crash-limit");
// 设置渲染进程的最大内存（避免内存溢出）
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=512");
// =====================================

// 创建自定义菜单（包含开发者工具）
const menuTemplate = [
  {
    label: "查看",
    submenu: [
      {
        label: "开发者工具",
        accelerator:
          process.platform === "darwin" ? "Cmd+Shift+I" : "Ctrl+Shift+I",
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            focusedWindow.webContents.toggleDevTools();
          }
        },
      },
      {
        label: "刷新",
        accelerator: "F5",
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            focusedWindow.reload();
          }
        },
      },
    ],
  },
];

const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);

// 配置自动更新
autoUpdater.autoDownload = true; // 自动下载更新
autoUpdater.autoInstallOnAppQuit = true; // 退出时自动安装

// 设置更新服务器地址（显式配置，确保生产环境使用正确的地址）
if (process.env.NODE_ENV !== "development") {
  autoUpdater.setFeedURL({
    provider: "generic",
    url: "https://bikewise.oss-cn-shenzhen.aliyuncs.com/d-space/digismart-desktop",
  });
}

// 日志文件路径
const logFilePath = path.join(app.getPath("userData"), "update-log.txt");

// 写入日志的函数
function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message); // 也输出到控制台
  try {
    fs.appendFileSync(logFilePath, logMessage);
  } catch (err) {
    console.error("写入日志失败:", err);
  }
}

let mainWindow;
let tray = null;
let trayIconPath = null; // 保存托盘图标路径
let trayIconImage = null; // 保存调整后的托盘图标对象
let trayFlashTimer = null; // 托盘闪烁定时器
let trayFlashing = false; // 托盘是否正在闪烁
let notificationMessage = null; // 通知消息内容（对象或字符串）
let lastNotificationTime = 0; // 上次显示通知的时间戳（用于防抖）

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: "D-Space",
    icon: path.join(__dirname, "../src/assets/logo/logo.png"),
    show: false, // 先不显示窗口，等内容加载完成后再显示
    backgroundColor: "#ffffff", // 设置背景色，避免闪烁
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default", // macOS 使用 hiddenInset 样式
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true, // 启用 web 安全
      allowRunningInsecureContent: false,
      imageAnimationPolicy: "noAnimation",
      backgroundThrottling: false, // 关闭后台节流，确保开发者工具正常工作
      devTools: true, // 明确启用开发者工具
      webviewTag: true, // 启用 webview 标签支持
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  // 加载应用
  const startUrl =
    process.env.NODE_ENV === "development"
      ? "http://localhost:8080"
      : url.format({
          pathname: path.join(__dirname, "../dist/index.html"),
          protocol: "file:",
          slashes: true,
        });

  mainWindow.loadURL(startUrl);

  // 强制打开开发者工具（多次尝试确保打开）
  mainWindow.webContents.openDevTools();

  // 监听页面加载完成
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.openDevTools();
    console.log("[DevTools] 页面加载完成，强制打开开发者工具");
  });

  // 监听DOM准备就绪
  mainWindow.webContents.on("dom-ready", () => {
    mainWindow.webContents.openDevTools();
    console.log("[DevTools] DOM准备就绪，强制打开开发者工具");
  });

  // 等待窗口内容加载完成后再显示，提升用户体验
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();

    // 窗口显示后再次尝试打开开发者工具
    mainWindow.webContents.openDevTools();
    console.log("[DevTools] 窗口显示，强制打开开发者工具");

    // 延迟再次尝试
    setTimeout(() => {
      mainWindow.webContents.openDevTools();
      console.log("[DevTools] 延迟1秒后再次打开开发者工具");
    }, 1000);

    // 延迟创建托盘，不阻塞窗口显示
    setTimeout(() => {
      createTray();
    }, 100);
  });

  // 窗口关闭事件
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // 处理窗口最大化事件
  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("window-maximized", true);
  });

  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("window-maximized", false);
  });

  // 窗口获得焦点时停止托盘闪烁
  mainWindow.on("focus", () => {
    stopTrayFlash();
  });
}

function createTray() {
  try {
    // Windows 使用 .ico 格式，macOS 使用 .png 格式
    const iconName = process.platform === "win32" ? "logo.ico" : "logo.png";

    // 判断是否为打包后的应用
    const isPackaged = app.isPackaged;

    // 开发环境和生产环境使用不同的路径
    if (!isPackaged) {
      // 开发环境
      trayIconPath = path.join(__dirname, "../src/assets/logo", iconName);
    } else {
      // 生产环境从 extraResources 读取
      trayIconPath = path.join(process.resourcesPath, "logo", iconName);
    }

    // 异步写入日志文件用于调试（不阻塞启动）
    const fs = require("fs");
    const logPath = path.join(app.getPath("userData"), "tray-debug.log");
    const logContent = `
托盘图标路径: ${trayIconPath}
是否为打包应用: ${isPackaged}
资源路径: ${process.resourcesPath}
文件是否存在: ${fs.existsSync(trayIconPath)}
平台: ${process.platform}
图标文件名: ${iconName}
时间: ${new Date().toISOString()}
    `;
    // 使用异步写入，不阻塞主线程
    fs.writeFile(logPath, logContent, (err) => {
      if (err) console.error("[Tray] 写入日志失败:", err);
    });

    // 检查文件是否存在
    if (!fs.existsSync(trayIconPath)) {
      // 如果文件不存在，尝试使用应用图标
      const appIconPath =
        process.platform === "win32"
          ? path.join(process.resourcesPath, "app.ico")
          : path.join(__dirname, "../src/assets/logo/logo.png");

      if (fs.existsSync(appIconPath)) {
        trayIconPath = appIconPath;
      }
    }

    // 创建托盘图标
    // macOS 需要调整图标尺寸，推荐 22x22（标准）或 44x44（Retina）
    trayIconImage = nativeImage.createFromPath(trayIconPath);
    if (process.platform === "darwin") {
      // macOS 托盘图标尺寸调整为 22x22
      trayIconImage = trayIconImage.resize({ width: 22, height: 22 });
      // 设置为 Template Image，这样会根据系统主题自动调整颜色
      trayIconImage.setTemplateImage(true);
    }
    tray = new Tray(trayIconImage);

    // 如果托盘创建成功，在主窗口加载完成后通过 IPC 发送消息
    if (tray) {
      setTimeout(() => {
        // 检查窗口是否仍然存在且未被销毁
        if (mainWindow && !mainWindow.isDestroyed()) {
          try {
            mainWindow.webContents.send("tray-status", {
              success: true,
              path: trayIconPath,
              exists: fs.existsSync(trayIconPath),
            });
          } catch (error) {
            console.error("[Tray] 发送托盘状态失败:", error);
          }
        }
      }, 2000);
    }
  } catch (error) {
    // 如果创建托盘失败，记录错误
    const fs = require("fs");
    const logPath = path.join(app.getPath("userData"), "tray-error.log");
    fs.writeFileSync(logPath, `托盘创建失败: ${error.message}\n${error.stack}`);

    setTimeout(() => {
      // 检查窗口是否仍然存在且未被销毁
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send("tray-status", {
            success: false,
            error: error.message,
          });
        } catch (error) {
          console.error("[Tray] 发送托盘错误状态失败:", error);
        }
      }
    }, 2000);
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示窗口",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: "隐藏窗口",
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      },
    },
    { type: "separator" },
    {
      label: "退出应用",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip("RuoYi-Vue3管理系统");
  tray.setContextMenu(contextMenu);

  // 鼠标移入托盘图标时显示通知浮窗（类似QQ/钉钉）
  tray.on("mouse-move", () => {
    if (trayFlashing && notificationMessage) {
      const now = Date.now();
      // 防抖：3秒内只显示一次通知，避免鼠标移动时频繁弹窗
      if (now - lastNotificationTime > 3000) {
        console.log("[Tray] 鼠标移入托盘，显示通知弹窗");
        showNotificationBalloon(notificationMessage);
        lastNotificationTime = now;
      }
    }
  });

  // 点击托盘图标显示/隐藏窗口
  tray.on("click", () => {
    if (mainWindow) {
      // 如果正在闪烁（有新消息）
      if (trayFlashing) {
        // 无论窗口是否可见，都显示并聚焦窗口，同时停止闪烁
        mainWindow.show();
        mainWindow.focus();
        stopTrayFlash();
        console.log("[Tray] 点击托盘图标（有新消息），打开窗口并停止闪烁");
      } else {
        // 没有新消息时，切换窗口显示/隐藏状态
        if (mainWindow.isVisible() && mainWindow.isFocused()) {
          mainWindow.hide();
          console.log("[Tray] 点击托盘图标（无新消息），隐藏窗口");
        } else {
          mainWindow.show();
          mainWindow.focus();
          console.log("[Tray] 点击托盘图标（无新消息），显示窗口");
        }
      }
    }
  });
}

// 开始托盘图标闪烁
function startTrayFlash(message = "您有新的通知") {
  if (trayFlashing || !tray) return;

  trayFlashing = true;
  notificationMessage = message;
  lastNotificationTime = 0; // 重置时间戳，确保新消息来时可以立即显示通知
  let isVisible = true;

  // 更新 Tooltip 显示通知消息
  try {
    tray.setToolTip(`RuoYi-Vue3管理系统\n新消息\n(鼠标移入查看)`);
  } catch (error) {
    console.error("[Tray] 设置 Tooltip 失败:", error);
    return;
  }

  // 每500毫秒切换一次图标显示/隐藏
  trayFlashTimer = setInterval(() => {
    // 检查托盘是否仍然存在
    if (!tray || tray.isDestroyed()) {
      stopTrayFlash();
      return;
    }

    try {
      if (isVisible) {
        // 隐藏图标（设置为空图标）
        tray.setImage(nativeImage.createEmpty());
      } else {
        // 显示图标（使用调整后的图标对象）
        tray.setImage(trayIconImage);
      }
      isVisible = !isVisible;
    } catch (error) {
      console.error("[Tray] 设置图标失败:", error);
      stopTrayFlash();
    }
  }, 500);
}

// 停止托盘图标闪烁
function stopTrayFlash() {
  if (trayFlashTimer) {
    clearInterval(trayFlashTimer);
    trayFlashTimer = null;
  }

  trayFlashing = false;
  notificationMessage = null;
  lastNotificationTime = 0; // 重置通知时间戳，下次新消息可以立即显示

  // 恢复图标显示和 Tooltip
  if (tray && !tray.isDestroyed() && trayIconImage) {
    try {
      tray.setImage(trayIconImage);
      tray.setToolTip("RuoYi-Vue3管理系统");
    } catch (error) {
      console.error("[Tray] 恢复图标状态失败:", error);
    }
  }
}

// 显示系统通知（类似钉钉的弹窗）
function showNotificationBalloon(data) {
  try {
    // 检查系统是否支持通知
    if (!Notification.isSupported()) {
      console.warn("[Notification] 系统不支持通知");
      return;
    }

    // 解析通知数据
    const title =
      typeof data === "string" ? "D-Space" : data.title || "D-Space";
    const body =
      typeof data === "string" ? data : data.content || data.body || "";

    console.log("[Notification] 显示系统通知 -", "标题:", title, "内容:", body);

    // 创建系统通知（跨平台，Windows/macOS/Linux 都支持）
    const notification = new Notification({
      title: title,
      body: body,
      icon: trayIconPath, // 通知图标
      silent: false, // 播放系统提示音
      timeoutType: "default", // 使用系统默认的显示时间
      urgency: "normal", // 通知优先级
      actions: [
        {
          type: "button",
          text: "查看详情",
        },
        {
          type: "button",
          text: "稍后查看",
        },
      ],
    });

    // 处理操作按钮点击事件
    notification.on("action", (event, index) => {
      console.log(
        "[Notification] 用户点击了操作按钮 -",
        index === 0 ? "查看详情" : "稍后查看",
      );

      if (index === 0) {
        // 点击"查看详情"按钮 - 显示并聚焦窗口
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.show();
          mainWindow.focus();
          stopTrayFlash(); // 停止托盘闪烁
        }
      } else if (index === 1) {
        // 点击"稍后查看"按钮 - 只停止闪烁，不显示窗口
        console.log("[Notification] 用户选择稍后查看");
        stopTrayFlash(); // 停止托盘闪烁
        notification.close(); // 关闭通知
      }
    });

    // 点击通知主体时，也显示窗口
    notification.on("click", () => {
      console.log("[Notification] 用户点击了通知主体");
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
        stopTrayFlash(); // 停止托盘闪烁
      }
    });

    // 通知关闭事件（用户手动关闭或自动超时）
    notification.on("close", () => {
      console.log("[Notification] 通知已关闭");
    });

    // 显示通知
    notification.show();
  } catch (error) {
    console.error("[Notification] 显示系统通知失败:", error);
  }
}

// 应用就绪后创建窗口
app.whenReady().then(() => {
  // 设置 Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self';",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval';", // Vue 开发环境需要 unsafe-eval
          "style-src 'self' 'unsafe-inline';",
          "img-src 'self' data: https: http:;",
          "font-src 'self' data:;",
          "connect-src 'self' http://localhost:* ws://localhost:* https: wss:;", // 允许开发服务器和 API 连接
          "frame-src 'self';",
        ].join(" "),
      },
    });
  });

  createWindow();

  // 检查更新（仅生产环境）
  if (process.env.NODE_ENV !== "development") {
    writeLog("[更新] 应用版本: " + app.getVersion());
    writeLog(
      "[更新] 更新服务器: https://bikewise.oss-cn-shenzhen.aliyuncs.com/d-space/digismart-desktop",
    );
    writeLog("[更新] 日志文件路径: " + logFilePath);
    // 延迟5秒后检查更新，避免影响启动速度
    setTimeout(() => {
      writeLog("[更新] 开始检查更新...");
      autoUpdater.checkForUpdates();
    }, 5000);
  } else {
    writeLog("[更新] 开发环境，跳过自动更新检查");
  }

  // 性能监控（开发环境）
  if (process.env.NODE_ENV === "development") {
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      console.log(
        `内存使用: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      );
    }, 30000);
  }
});

// 自动更新事件监听
autoUpdater.on("checking-for-update", () => {
  writeLog("[更新] 正在检查更新...");
});

autoUpdater.on("update-available", (info) => {
  writeLog("[更新] 发现新版本: " + info.version);
  writeLog("[更新] 新版本信息: " + JSON.stringify(info));
  // 通知渲染进程有新版本
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-available", info);
  }
});

autoUpdater.on("update-not-available", (info) => {
  writeLog("[更新] 当前已是最新版本");
  writeLog("[更新] 当前版本信息: " + JSON.stringify(info));
});

autoUpdater.on("download-progress", (progressObj) => {
  const percent = Math.round(progressObj.percent);
  writeLog("[更新] 下载进度: " + percent + "%");
  // 通知渲染进程下载进度
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("download-progress", progressObj);
  }
});

autoUpdater.on("update-downloaded", () => {
  writeLog("[更新] 下载完成，将在退出时安装");
  // 通知渲染进程下载完成
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-downloaded");
  }
});

autoUpdater.on("error", (err) => {
  writeLog("[更新] 更新失败: " + err.message);
  writeLog("[更新] 错误详情: " + err.stack);
});

// 处理渲染进程请求下载更新
ipcMain.on("download-update", () => {
  autoUpdater.downloadUpdate();
});

// 处理渲染进程请求立即安装更新
ipcMain.on("install-update", () => {
  autoUpdater.quitAndInstall();
});

// 所有窗口关闭时退出应用（macOS除外）
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// 激活应用时创建窗口（macOS）
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 主进程与渲染进程通信
ipcMain.on("window-minimize", () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on("window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on("window-close", () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// 获取窗口最大化状态
ipcMain.handle("is-maximized", () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// 开始托盘闪烁（支持传递通知消息）
ipcMain.on("tray-flash-start", (event, message) => {
  startTrayFlash(message);
});

// 停止托盘闪烁
ipcMain.on("tray-flash-stop", () => {
  stopTrayFlash();
});

// 打开外部链接（使用系统默认浏览器）
ipcMain.on("open-external", (event, url) => {
  try {
    console.log("[外部链接] 打开:", url);
    shell.openExternal(url);
  } catch (error) {
    console.error("[外部链接] 打开失败:", error);
  }
});

// 在新窗口中打开链接
ipcMain.on("open-in-new-window", async (event, payload) => {
  const targetUrl = typeof payload === "string" ? payload : payload?.url;

  if (!targetUrl) {
    console.warn("[新窗口] 未提供 URL，忽略请求");
    return;
  }

  console.log("[新窗口] 打开链接:", targetUrl);

  const newWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "D-Space - 外部链接",
    icon:
      process.platform === "darwin"
        ? path.join(__dirname, "../src/assets/logo/logo.icns")
        : path.join(__dirname, "../src/assets/logo/logo.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true, // 启用 web 安全
      allowRunningInsecureContent: false,
      devTools: process.env.NODE_ENV === "development",
    },
  });

  newWindow.loadURL(targetUrl);

  newWindow.on("closed", () => {
    console.log("[新窗口] 窗口已关闭");
  });

  if (process.env.NODE_ENV === "development") {
    newWindow.webContents.openDevTools();
  }
});

// 处理托盘通知请求（从 MQTT 客户端发送）
ipcMain.on("tray-notification", (event, data) => {
  try {
    console.log("[IPC] 收到托盘通知请求:", data);

    // 检查窗口是否仍然存在
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.warn("[IPC] 主窗口已销毁，忽略通知请求");
      return;
    }

    // 保存完整的通知数据（用于鼠标移入时显示）
    notificationMessage = data;

    // 构建简短的提示文本（用于托盘 Tooltip）
    const tooltipText = data.title
      ? `${data.title}: ${data.content}`
      : data.content;

    // 1. 开始托盘图标闪烁（吸引用户注意）
    startTrayFlash(tooltipText);

    // 2. 立即显示系统通知弹窗（类似钉钉）
    showNotificationBalloon(data);
  } catch (error) {
    console.error("[IPC] 处理托盘通知失败:", error);
  }
});

// 测试通知功能（用于调试）
ipcMain.on("test-notification", (event, data) => {
  console.log("[IPC] 收到测试通知请求");

  const testData = data || {
    title: "测试通知",
    content: "这是一条测试通知消息，用于验证通知功能是否正常工作。",
    time: new Date().toLocaleTimeString("zh-CN"),
    type: "test",
  };

  // 触发通知
  notificationMessage = testData;
  const tooltipText = `${testData.title}: ${testData.content}`;
  startTrayFlash(tooltipText);
  showNotificationBalloon(testData);
});

// 应用退出前清理
app.on("before-quit", async (event) => {
  console.log("[App] 应用即将退出，清理资源...");

  // 阻止默认退出行为，等待 MQTT 断开
  event.preventDefault();

  try {
    // 通知渲染进程应用即将关闭
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("app-closing");
      console.log("[App] 已通知渲染进程关闭 MQTT 连接");

      // 等待 MQTT 断开完成（给1秒时间）
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("[App] 通知渲染进程失败:", error);
  }

  // 清理托盘
  stopTrayFlash();
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }

  console.log("[App] 资源清理完成，退出应用");

  // 真正退出应用
  app.exit();
});
