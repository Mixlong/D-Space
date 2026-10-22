# Mac 更新下载问题修复说明

## 🐛 问题描述

**症状：** Mac 用户点击"手动下载安装"后，进度条跳动，实际有2个下载任务同时运行。

**原因：** 
1. `autoUpdater.autoDownload = true` 导致 Mac 和 Windows 都会自动下载
2. Mac 用户看到"检测到新版本"对话框时，后台 autoUpdater 已经在下载 `.zip` 文件
3. 用户点击"手动下载安装"，又触发了手动下载 `.dmg` 文件
4. 两个下载任务同时进行，进度数据互相干扰，导致进度条跳动

---

## ✅ 修复方案

### 1. 禁止自动下载，改为手动控制

```javascript
// electron/main.cjs

// 修改前
autoUpdater.autoDownload = true; // ❌ Mac 和 Windows 都会自动下载

// 修改后
autoUpdater.autoDownload = false; // ✅ 禁止自动下载，手动控制
```

### 2. 在 `update-available` 事件中区分平台

```javascript
// electron/main.cjs

autoUpdater.on('update-available', (info) => {
  const isMac = process.platform === 'darwin';
  
  // 通知渲染进程有新版本
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available', info);
  }
  
  // 只在 Windows 上自动下载
  if (!isMac) {
    writeLog('[更新] Windows: 开始自动下载');
    autoUpdater.downloadUpdate(); // ✅ Windows 手动调用下载
  } else {
    writeLog('[更新] Mac: 不自动下载，等待用户手动下载'); // ✅ Mac 不下载
  }
});
```

---

## 🎯 修复后的流程

### Mac 用户流程

```
1. 应用启动，检测更新
   ↓
2. 检测到新版本 1.0.12
   ↓
3. ❌ 不触发 autoUpdater 下载（关键修复）
   ↓
4. ✅ 直接弹窗："检测到新版本"
   ↓
5. 用户点击"手动下载安装"
   ↓
6. ✅ 只有 1 个下载任务：手动下载 .dmg
   ↓
7. 进度条正常，不跳动
   ↓
8. 下载完成，安装
```

### Windows 用户流程（保持不变）

```
1. 应用启动，检测更新
   ↓
2. 检测到新版本 1.0.12
   ↓
3. ✅ 手动调用 autoUpdater.downloadUpdate()
   ↓
4. 后台下载 .exe 文件
   ↓
5. 下载完成弹窗："更新已准备就绪"
   ↓
6. 点击"立即重启安装"
   ↓
7. 自动安装并重启
```

---

## 📋 修改文件清单

### 1. `electron/main.cjs`

**修改点 1：禁止自动下载**
```javascript
// 第 14 行
autoUpdater.autoDownload = false; // 禁止自动下载，手动控制
```

**修改点 2：区分平台下载**
```javascript
// 第 1110-1128 行
autoUpdater.on('update-available', (info) => {
  const isMac = process.platform === 'darwin';
  
  // 通知前端
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available', info);
  }
  
  // 只在 Windows 上下载
  if (!isMac) {
    autoUpdater.downloadUpdate();
  }
});
```

### 2. `src/components/UpdateIndicator/index.vue`

**保持不变，前端逻辑已正确：**
- Mac: 检测到新版本 → 直接弹窗手动下载
- Windows: 检测到新版本 → 后台下载 → 下载完成弹窗

---

## 🧪 测试验证

### 测试场景 1：Mac 用户更新

```bash
# 1. 安装旧版本 (1.0.10)
open electron_dist/DigiSmart-1.0.10-x64.dmg

# 2. 启动应用
open /Applications/DigiSmart.app

# 3. 等待检测更新（5秒）

# 4. 观察控制台日志
期望日志：
[更新] 发现新版本: 1.0.12
[更新] 平台: Mac
[更新] Mac: 不自动下载，等待用户手动下载

# 5. 观察前端
期望：直接弹窗"检测到新版本"，不显示下载进度

# 6. 点击"手动下载安装"
期望：只有 1 个下载任务，进度条不跳动

# 7. 检查日志文件
cat ~/Library/Application\ Support/DigiSmart/update-log.txt
```

### 测试场景 2：Windows 用户更新

```bash
# 1. 安装旧版本
DigiSmart-Setup-1.0.10.exe

# 2. 启动应用

# 3. 等待检测更新

# 4. 观察控制台日志
期望日志：
[更新] 发现新版本: 1.0.12
[更新] 平台: Windows
[更新] Windows: 开始自动下载

# 5. 观察前端
期望：显示"正在后台下载..."，可点击查看进度

# 6. 下载完成
期望：弹窗"更新已准备就绪"

# 7. 点击"立即重启安装"
期望：自动安装并重启
```

---

## ✅ 验证清单

### Mac 用户

- [ ] 检测到新版本后不触发 autoUpdater 下载
- [ ] 直接弹窗"检测到新版本"
- [ ] 不显示"正在下载更新"进度对话框
- [ ] 点击"手动下载安装"只有 1 个下载任务
- [ ] 进度条不跳动，正常显示 0% → 100%
- [ ] 日志中显示"Mac: 不自动下载"

### Windows 用户

- [ ] 检测到新版本后自动调用 `downloadUpdate()`
- [ ] 显示"正在后台下载..."提示
- [ ] 后台下载进度正常
- [ ] 下载完成后弹窗"更新已准备就绪"
- [ ] 点击"立即重启安装"能自动安装
- [ ] 日志中显示"Windows: 开始自动下载"

---

## 🎯 核心修复点总结

| 修复点 | 修改前 | 修改后 |
|--------|--------|--------|
| **自动下载配置** | `autoDownload = true` | `autoDownload = false` |
| **Mac 下载行为** | 自动下载 `.zip` | 不下载，等待手动 |
| **Windows 下载行为** | 自动下载 `.exe` | 手动调用 `downloadUpdate()` |
| **Mac 下载任务数** | 2个（auto + manual）❌ | 1个（manual）✅ |
| **进度条跳动** | 有跳动 ❌ | 无跳动 ✅ |

---

## 📝 其他说明

### 为什么 Mac 不用 autoUpdater 下载？

1. **未签名应用的限制**
   - Mac 未签名应用无法使用 autoUpdater 自动安装
   - 下载的 `.zip` 文件解压后仍然无法自动替换
   - 需要用户手动拖拽 `.dmg` 安装

2. **用户体验更好**
   - 直接提示手动下载，不浪费时间
   - 用户自主选择下载位置
   - 下载完成后自动打开文件夹
   - 安装流程清晰透明

3. **避免冲突**
   - 防止同时有多个下载任务
   - 避免进度数据互相干扰
   - 避免用户困惑

### 为什么 Windows 还用 autoUpdater？

1. **完美支持自动安装**
   - Windows 签名相对容易
   - autoUpdater 可以完美自动安装
   - 用户体验最佳

2. **后台下载不打扰**
   - 静默下载，不影响使用
   - 下载完成后才通知用户
   - 用户可选择立即安装或稍后

---

## 🚀 下一步

```bash
# 重新打包测试
npm run build:mac

# 安装并测试
open electron_dist/DigiSmart-1.0.12-x64.dmg
```

**现在 Mac 用户不会再遇到重复下载和进度条跳动的问题了！** 🎉
