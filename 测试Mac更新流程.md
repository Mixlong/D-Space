# Mac 更新功能测试流程

## 🎯 目标
验证 Mac 点击"立即重启安装"按钮是否正常工作

---

## 📋 准备工作

### 1. 准备两个版本

**旧版本（用于测试更新）:**
```bash
# 修改 package.json 版本为 1.0.9
"version": "1.0.9"

# 构建
npm run build:mac

# 安装
打开 electron_dist/DigiSmart-1.0.9-x64.dmg
拖拽到 Applications
```

**新版本（发布到 OSS）:**
```bash
# 修改 package.json 版本为 1.1.1
"version": "1.1.1"

# 构建并上传
npm run release:patch:mac-win
```

---

## 🧪 测试步骤

### Step 1: 安装旧版本

1. 确保 Applications 中没有旧的 DigiSmart.app
2. 安装 1.0.9 版本的 .dmg
3. 启动应用

### Step 2: 触发更新检查

应用启动 5 秒后会自动检查更新，或者：
- 手动触发检查更新（如果应用有这个功能）

### Step 3: 观察更新流程

**期望流程：**
```
1. 应用检测到新版本 1.1.1
   └─ 显示通知："发现新版本 1.1.1，正在后台下载..."

2. 后台下载 .zip 文件
   └─ 可以点击图标查看下载进度

3. 下载完成
   └─ 弹出对话框：
      ┌────────────────────────────────┐
      │    Mac 更新已准备就绪          │
      ├────────────────────────────────┤
      │    ✅ 新版本 1.1.1 已下载完成   │
      │                                │
      │  ⚠️ 点击"立即更新"后应用将关闭  │
      │  更新会自动安装，              │
      │  需要您手动重新打开应用        │
      │                                │
      │  [稍后更新]    [立即更新]      │
      └────────────────────────────────┘

4. 点击"立即更新"
   └─ 应用应该立即关闭
   └─ 等待 3-5 秒（后台安装）

5. 手动重新打开应用
   └─ 从 Dock 或 Applications 打开
   └─ 检查版本号应该是 1.1.1
```

---

## 🔍 调试方法

### 查看控制台日志（开发环境）

```bash
# 运行开发版本
npm run dev

# 打开 DevTools (Cmd+Option+I)
# 查看 Console 标签
```

**期望看到的日志：**
```javascript
// 前端日志
[UpdateIndicator] 用户点击安装更新按钮
[UpdateIndicator] isMac: true
[UpdateIndicator] electronAPI 可用: true
[UpdateIndicator] installUpdate 方法存在: true
[UpdateIndicator] 正在调用 electronAPI.installUpdate()
[UpdateIndicator] installUpdate() 调用成功
```

### 查看主进程日志

```bash
# 在终端应该看到
========================================
[更新] 🚀 收到 install-update 消息
[更新] 平台: Mac
[更新] Mac: 调用 autoUpdater.quitAndInstall(false, true)
[更新] Mac: quitAndInstall 调用成功
========================================
```

### 查看更新日志文件

```bash
# Mac 更新日志位置
cat ~/Library/Application\ Support/DigiSmart/update-log.txt

# 期望看到
[更新] 正在检查更新...
[更新] 发现新版本: 1.1.1
[更新] 下载进度: 100%
[更新] Mac: 下载完成，需要重启应用以完成更新
[更新] 用户确认安装更新，退出应用
[更新] Mac: 立即退出并安装（需要手动重启应用）
```

---

## ❌ 常见问题排查

### 问题 1: 点击按钮没反应

**检查项：**
1. 打开 DevTools，查看是否有 console.log 输出
2. 如果没有任何日志 → 按钮点击事件没触发
3. 如果有前端日志但没有主进程日志 → IPC 通信问题

**解决方法：**
- 确保 preload.cjs 正确加载
- 检查 `window.electronAPI` 是否存在
- 检查主进程 `ipcMain.on('install-update')` 是否注册

---

### 问题 2: 点击后应用没有关闭

**可能原因：**
1. `autoUpdater.quitAndInstall()` 调用失败
2. 没有下载文件（无法安装）

**检查方法：**
```bash
# 检查是否有下载的更新文件
ls -la ~/Library/Caches/electron-updater/pending/
# 应该看到 DigiSmart-1.1.1-x64.zip
```

---

### 问题 3: 更新后版本号没变

**可能原因：**
- 安装失败
- 打开了错误的应用

**解决方法：**
```bash
# 确认应用路径
which -a DigiSmart

# 检查应用版本
/Applications/DigiSmart.app/Contents/Info.plist
# 查找 CFBundleShortVersionString
```

---

## ✅ 成功标准

- [ ] 点击"立即更新"按钮后应用立即关闭
- [ ] 控制台有完整的调试日志
- [ ] 手动重新打开应用
- [ ] 应用版本更新为 1.1.1
- [ ] 没有错误提示

---

## 🎯 如果仍然有问题

**提供以下信息：**

1. **控制台截图**
   - 前端 DevTools Console
   - 包含所有 `[UpdateIndicator]` 日志

2. **终端输出**
   - 主进程日志
   - 包含所有 `[更新]` 日志

3. **更新日志文件**
   ```bash
   cat ~/Library/Application\ Support/DigiSmart/update-log.txt
   ```

4. **应用版本信息**
   - 更新前版本号
   - 更新后版本号

这样可以快速定位问题！
