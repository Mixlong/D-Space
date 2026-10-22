# Electron 自动更新使用说明

## 📦 已创建的文件

1. **electron/updater.js** - 更新管理器模块
2. **src/components/AppUpdater.vue** - Vue更新组件

## 🚀 使用步骤

### 1. 安装依赖

```bash
npm install electron-updater --save
```

### 2. 修改主进程文件

在 `electron/main.js` 中添加以下代码：

```javascript
// 在文件顶部导入
const AppUpdater = require('./updater');

// 在 createWindow 函数后添加
let updater = null;

// 在 app.whenReady() 中初始化更新器
app.whenReady().then(() => {
  createWindow();
  
  // 初始化自动更新
  updater = new AppUpdater(mainWindow);
  
  // 应用启动后5秒检查更新
  setTimeout(() => {
    updater.checkForUpdates();
  }, 5000);
});

// 添加IPC监听器
ipcMain.on('check-for-updates', () => {
  if (updater) {
    updater.checkForUpdates();
  }
});

ipcMain.on('download-update', () => {
  if (updater) {
    updater.downloadUpdate();
  }
});

ipcMain.on('quit-and-install', () => {
  if (updater) {
    updater.quitAndInstall();
  }
});
```

### 3. 修改 preload.js

在 `electron/preload.cjs` 中添加IPC通信接口：

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => {
      const validChannels = ['check-for-updates', 'download-update', 'quit-and-install'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    on: (channel, func) => {
      const validChannels = [
        'checking-for-update',
        'update-available',
        'update-not-available',
        'download-progress',
        'update-downloaded',
        'update-error'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => func(event, ...args));
      }
    },
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
  }
});
```

### 4. 在Vue应用中使用

在 `src/App.vue` 或主布局组件中引入：

```vue
<template>
  <div id="app">
    <!-- 您的应用内容 -->
    
    <!-- 添加更新组件 -->
    <AppUpdater ref="updaterRef" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import AppUpdater from '@/components/AppUpdater.vue'

const updaterRef = ref(null)

// 手动检查更新（可以绑定到菜单或按钮）
const checkForUpdates = () => {
  if (updaterRef.value) {
    updaterRef.value.checkForUpdates()
  }
}
</script>
```

### 5. 配置更新服务器

在 `electron/updater.js` 中修改更新服务器地址：

```javascript
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://your-update-server.com/updates' // 替换为您的更新服务器地址
});
```

### 6. 配置 electron-builder.yml

确保您的 `electron-builder.yml` 包含以下配置：

```yaml
appId: com.yourcompany.yourapp
productName: YourApp
directories:
  output: electron_dist
  buildResources: build

publish:
  - provider: generic
    url: https://your-update-server.com/updates

win:
  target:
    - nsis
  icon: build/icon.ico

mac:
  target:
    - dmg
    - zip
  icon: build/icon.icns

linux:
  target:
    - AppImage
  icon: build/icon.png

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
```

### 7. 打包和发布

```bash
# 更新版本号
npm version patch  # 或 minor, major

# 打包应用
npm run electron:build

# 生成的文件在 electron_dist 目录
```

### 8. 部署更新文件

将以下文件上传到更新服务器：

```
/updates/
  ├── latest.yml (Windows)
  ├── latest-mac.yml (macOS)
  ├── latest-linux.yml (Linux)
  ├── YourApp-Setup-1.0.1.exe
  ├── YourApp-1.0.1.dmg
  └── YourApp-1.0.1.AppImage
```

## 🎯 功能特性

✅ 自动检查更新
✅ 下载进度显示
✅ 用户确认安装
✅ 后台静默下载
✅ 错误处理
✅ 版本信息展示
✅ 更新日志显示

## 📝 更新流程

1. **应用启动** → 5秒后自动检查更新
2. **发现新版本** → 弹窗提示用户
3. **用户确认** → 开始下载更新
4. **显示进度** → 实时显示下载进度
5. **下载完成** → 询问是否立即安装
6. **重启安装** → 退出应用并安装更新

## 🔧 自定义配置

### 修改检查更新时机

在 `electron/main.js` 中：

```javascript
// 启动时立即检查
updater.checkForUpdates();

// 或定时检查（每小时）
setInterval(() => {
  updater.checkForUpdates();
}, 3600000);
```

### 添加菜单项

```javascript
const { Menu } = require('electron');

const template = [
  {
    label: '帮助',
    submenu: [
      {
        label: '检查更新',
        click: () => {
          updater.checkForUpdates();
        }
      }
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
```

## ⚠️ 注意事项

1. **代码签名**
   - macOS需要代码签名才能自动更新
   - Windows建议使用证书签名

2. **更新服务器**
   - 必须使用HTTPS
   - 确保服务器支持CORS

3. **版本号**
   - 使用语义化版本（Semantic Versioning）
   - 格式：主版本.次版本.修订号（如 1.0.1）

4. **测试**
   - 在不同平台测试更新流程
   - 测试网络异常情况
   - 测试更新失败回滚

## 🐛 常见问题

### 1. 更新检查失败

- 检查更新服务器地址是否正确
- 确认服务器可访问
- 查看控制台错误信息

### 2. 下载失败

- 检查网络连接
- 确认文件路径正确
- 查看磁盘空间

### 3. 安装失败

- 检查应用权限
- 关闭杀毒软件
- 以管理员身份运行

## 📚 参考资料

- [electron-updater 文档](https://www.electron.build/auto-update)
- [electron-builder 文档](https://www.electron.build/)
- [Electron 官方文档](https://www.electronjs.org/)

## 💡 提示

- 开发环境下更新功能不会生效
- 需要打包后的应用才能测试更新
- 建议使用测试服务器进行测试
