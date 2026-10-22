# Mac 升级崩溃问题完整修复方案

## 🐛 问题描述

**症状：** 用户在 Mac 上点击"立即更新"后，应用崩溃并显示：
```
A JavaScript error occurred in the main process
TypeError: Cannot read properties of undefined (reading 'isDestroyed')
at App.<anonymous> (/Applications/DigiSmart.app/Contents/Resources/app.asar/electron/main.cjs:379:25)
```

**原因分析：**
1. **未签名应用调用 `quitAndInstall()` 导致崩溃**
   - Mac 未签名应用无法使用 autoUpdater 的自动安装功能
   - 调用 `quitAndInstall()` 时触发系统安全机制，导致进程异常终止
   
2. **`mainWindow.isDestroyed()` 检查不完整**
   - 在 `activate` 事件中，`mainWindow` 可能是 `undefined`
   - 直接调用 `isDestroyed()` 导致 TypeError

---

## ✅ 完整修复方案

### 修复点 1：禁用 Mac 的 `quitAndInstall()`

**文件：** `electron/main.cjs`

```javascript
// 第 1170-1210 行
ipcMain.on('install-update', () => {
  const isMac = process.platform === 'darwin';
  
  if (isMac) {
    // ⚠️ Mac 未签名应用：不调用 quitAndInstall，防止崩溃
    writeLog('[更新] Mac: 未签名应用，跳过自动安装，请使用手动下载');
    
    // 通知前端提示用户手动下载
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-install-failed', {
        message: 'Mac 版本需要手动下载安装',
        useManualDownload: true
      });
    }
  } else {
    // Windows: 正常自动安装
    try {
      autoUpdater.quitAndInstall();
    } catch (error) {
      // 通知前端安装失败
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-install-failed', {
          message: error.message
        });
      }
    }
  }
});
```

### 修复点 2：修复 `isDestroyed()` 检查

**文件：** `electron/main.cjs`

```javascript
// 第 376-383 行
app.on('activate', () => {
  // ✅ 使用 !mainWindow 同时检查 null 和 undefined
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
});
```

### 修复点 3：前端处理安装失败

**文件：** `src/components/UpdateIndicator/index.vue`

```javascript
// 添加安装失败处理
const handleInstallFailed = (data) => {
  installDialogVisible.value = false
  
  if (data.useManualDownload) {
    // Mac: 引导用户手动下载
    ElMessage.warning({
      message: 'Mac 版本需要手动下载安装，请点击更新图标选择手动下载',
      duration: 5000
    })
  } else {
    ElMessage.error(data.message || '安装失败，请稍后重试')
  }
}

// 在 onMounted 中监听
if (window.electronAPI.onUpdateInstallFailed) {
  window.electronAPI.onUpdateInstallFailed(handleInstallFailed)
}
```

### 修复点 4：preload 暴露安装失败事件

**文件：** `electron/preload.cjs`

```javascript
// 第 102-104 行
onUpdateInstallFailed: (callback) => {
  ipcRenderer.on('update-install-failed', (event, data) => callback(data));
},

// 第 127 行：清理事件
ipcRenderer.removeAllListeners('update-install-failed');
```

---

## 🎯 修复后的 Mac 更新流程

### 检测到新版本

```
1. autoUpdater 检测到新版本
   ↓
2. 前端显示："发现新版本 X.X.X，正在后台下载..."
   ↓
3. autoUpdater 后台下载 .zip 文件
   ↓
4. 下载完成，弹窗："Mac 更新已准备就绪"
   - 提示："需要手动下载安装"
   - 按钮：[稍后更新] [手动下载安装]
```

### 用户点击"手动下载安装"

```
1. 弹出系统保存对话框
   ↓
2. 用户选择保存位置
   ↓
3. 开始下载 .zip 文件
   ↓
4. 显示下载进度
   ↓
5. 下载完成提示
   ↓
6. 用户手动解压并安装
```

### ~~用户如果点击"立即更新"（已禁用）~~

```
1. ❌ 旧流程：调用 quitAndInstall() → 崩溃
   ↓
2. ✅ 新流程：跳过调用 → 提示手动下载
   ↓
3. 显示消息："Mac 版本需要手动下载安装"
```

---

## 📋 修改文件清单

### 主进程 `electron/main.cjs`

| 行数 | 修改内容 | 原因 |
|------|----------|------|
| 376-383 | 修复 `activate` 事件的 `isDestroyed()` 检查 | 防止 TypeError |
| 1178-1189 | 禁用 Mac 的 `quitAndInstall()` | 防止未签名应用崩溃 |
| 1197-1206 | 添加 Windows 安装失败处理 | 增强错误处理 |

### Preload `electron/preload.cjs`

| 行数 | 修改内容 | 原因 |
|------|----------|------|
| 102-104 | 暴露 `onUpdateInstallFailed` API | 前端监听安装失败事件 |
| 127 | 添加事件清理 | 防止内存泄漏 |

### 前端 `src/components/UpdateIndicator/index.vue`

| 行数 | 修改内容 | 原因 |
|------|----------|------|
| 224-238 | 添加 `handleInstallFailed` 函数 | 处理安装失败 |
| 401-404 | 监听安装失败事件 | 接收主进程通知 |

---

## 🧪 测试验证步骤

### 1. 测试 Mac 更新流程

```bash
# 1. 安装旧版本
open electron_dist/DigiSmart-1.0.11-x64.dmg

# 2. 拖到 Applications 并启动

# 3. 等待检测更新（5秒）

# 4. 观察：应该弹出"Mac 更新已准备就绪"对话框
期望：显示"需要手动下载安装"提示

# 5. 点击"手动下载安装"
期望：弹出保存对话框

# 6. 选择保存位置
期望：开始下载 .zip 文件，显示进度

# 7. 下载完成
期望：显示成功提示，可以在文件夹中显示

# ✅ 应用不应该崩溃！
```

### 2. 测试崩溃修复

```bash
# 1. 使用新版本，点击 Dock 图标（触发 activate 事件）
期望：应用正常显示，不崩溃

# 2. 关闭窗口后再次点击 Dock 图标
期望：窗口重新显示，不报错

# ✅ 不应该出现 isDestroyed TypeError
```

### 3. 测试 Windows 更新（不受影响）

```bash
# 1. 检测到新版本
期望：后台下载

# 2. 下载完成弹窗
期望：显示"更新已准备就绪"

# 3. 点击"立即重启安装"
期望：自动退出并安装，重启后版本更新

# ✅ Windows 功能保持不变
```

---

## ✅ 验证清单

### Mac 用户

- [ ] 检测到新版本不崩溃
- [ ] 后台下载 .zip 文件正常
- [ ] 下载完成后弹窗正常显示
- [ ] 点击"手动下载安装"不崩溃
- [ ] 可以选择保存位置
- [ ] 下载进度正常显示
- [ ] 下载完成后可以在文件夹中显示
- [ ] 应用 activate 不崩溃
- [ ] 不会出现 isDestroyed TypeError

### Windows 用户（保持不变）

- [ ] 检测到新版本后台下载
- [ ] 下载完成弹窗正常
- [ ] 点击"立即重启安装"自动安装
- [ ] 安装完成后自动重启
- [ ] 版本更新成功

---

## 🎯 核心修复点总结

| 问题 | 修复前 | 修复后 |
|------|--------|--------|
| **Mac quitAndInstall** | 调用 → 崩溃 ❌ | 跳过调用，提示手动下载 ✅ |
| **isDestroyed 检查** | `mainWindow === null` ❌ | `!mainWindow \|\| isDestroyed()` ✅ |
| **安装失败处理** | 无处理 ❌ | 通知前端，引导用户 ✅ |
| **Mac 用户体验** | 崩溃，无法更新 ❌ | 清晰引导，手动下载 ✅ |

---

## 📝 给用户的说明

### Mac 用户更新指南

**由于 Mac 版本未进行代码签名，自动安装功能受限。请按以下步骤更新：**

1. **应用会自动检测新版本**
   - 检测到更新后会显示"发现新版本"提示

2. **选择手动下载安装**
   - 点击"手动下载安装"按钮
   - 选择保存位置（建议桌面或下载文件夹）
   - 等待下载完成

3. **安装新版本**
   - 找到下载的 `.zip` 文件
   - 解压缩（双击自动解压）
   - 将新的 `DigiSmart.app` 拖到 `Applications` 文件夹
   - 替换旧版本

4. **启动新版本**
   - 从 Applications 启动 DigiSmart
   - 首次启动可能需要在"系统偏好设置 > 安全性"中允许

### Windows 用户更新指南

**Windows 版本支持全自动更新：**

1. 检测到新版本后自动后台下载
2. 下载完成后弹窗提示
3. 点击"立即重启安装"
4. 自动安装并重启应用
5. ✅ 完全自动化，无需手动操作

---

## 🚀 发布新版本

```bash
# 1. 重新打包
npm run build:mac

# 2. 上传到 OSS
npm run upload:oss

# 3. 更新 latest-mac.yml
# 确保指向新版本的 .zip 文件

# 4. 通知用户更新
# Mac 用户会看到新的手动下载流程
# Windows 用户保持原有自动更新流程
```

---

## 💡 长期解决方案

### 1. 申请 Apple 开发者账号并签名

```bash
# 使用 Apple 开发者证书签名
codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" /Applications/DigiSmart.app

# 公证
xcrun notarytool submit DigiSmart.dmg --apple-id "your@email.com" --password "app-specific-password"
```

**优势：**
- ✅ 完全支持自动更新
- ✅ 不会被 Gatekeeper 阻止
- ✅ 用户体验与 Windows 一致

### 2. 升级 Electron 版本

```bash
# 升级到最新稳定版
npm install electron@latest --save-dev

# 测试兼容性
npm run dev
npm run build:mac
```

**优势：**
- ✅ 更好的 macOS 兼容性
- ✅ 修复已知 bug
- ✅ 性能和安全性提升

---

## 📞 用户支持

如果用户遇到更新问题，建议：

1. **清理缓存后重试**
   ```bash
   rm -rf ~/Library/Application\ Support/DigiSmart
   ```

2. **完全卸载后重装**
   ```bash
   rm -rf /Applications/DigiSmart.app
   ```

3. **手动下载最新版本**
   - 提供直接下载链接
   - 引导用户完整安装流程

---

**修复完成后，Mac 用户将不会再遇到升级崩溃问题，并能通过清晰的手动下载流程完成更新！** 🎉
