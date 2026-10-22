# Mac 自动更新配置说明

## ⚠️ 核心问题

**Mac 的 `electron-updater` 自动更新必须满足以下条件：**

1. ✅ 应用必须使用 Apple Developer 证书签名
2. ✅ 应用必须通过 Apple 公证（Notarization）
3. ✅ 使用 `.zip` 文件进行更新（不是 `.dmg`）
4. ✅ `quitAndInstall()` 在 Mac 上的行为不同

---

## 🔐 问题 1: Mac 必须签名

### 为什么需要签名？

macOS 的安全机制 **Gatekeeper** 要求：
- 从互联网下载的应用必须经过签名
- 自动更新时，系统会验证新版本的签名
- **未签名的应用无法通过自动更新**

### 当前状态检查

```bash
# 检查应用是否已签名
codesign -dv --verbose=4 /Applications/DigiSmart.app

# 如果看到 "code object is not signed at all"，说明未签名
```

### 解决方案

#### 方案 A: 完整签名（推荐，生产环境）

1. **获取 Apple Developer 账号**
   - 个人账号：$99/年
   - 企业账号：$299/年
   - 网址：https://developer.apple.com/

2. **安装开发者证书**
   ```bash
   # 从 Xcode 或 Apple Developer 下载证书
   # 双击安装到"钥匙串访问"
   ```

3. **配置 package.json**
   ```json
   {
     "build": {
       "mac": {
         "identity": "Developer ID Application: 你的公司名称 (XXXXXXXXXX)",
         "hardenedRuntime": true,
         "gatekeeperAssess": false,
         "entitlements": "build/entitlements.mac.plist",
         "entitlementsInherit": "build/entitlements.mac.plist"
       }
     }
   }
   ```

4. **创建 entitlements 文件**
   
   `build/entitlements.mac.plist`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
     <key>com.apple.security.cs.allow-jit</key>
     <true/>
     <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
     <true/>
     <key>com.apple.security.cs.allow-dyld-environment-variables</key>
     <true/>
   </dict>
   </plist>
   ```

5. **公证（Notarization）**
   ```bash
   # 打包后需要上传到 Apple 进行公证
   xcrun notarytool submit DigiSmart-1.0.10-x64.dmg \
     --apple-id "your@email.com" \
     --password "app-specific-password" \
     --team-id "TEAM_ID" \
     --wait
   ```

#### 方案 B: 开发环境临时方案（仅测试）

**⚠️ 注意：此方案仅用于开发测试，不适合生产环境**

1. **禁用 Gatekeeper（不推荐）**
   ```bash
   sudo spctl --master-disable
   ```

2. **允许未签名应用**
   ```bash
   # 安装应用后
   xattr -cr /Applications/DigiSmart.app
   ```

---

## 📦 问题 2: Mac 使用 `.zip` 进行更新

### 更新文件说明

Mac 自动更新使用的是 **`.zip` 文件**，而不是 `.dmg`：

- ✅ `.zip` - 用于自动更新（electron-updater）
- ❌ `.dmg` - 仅用于首次安装（手动安装）

### latest-mac.yml 配置

```yaml
version: 1.0.10
files:
  - url: DigiSmart-1.0.10-x64.zip    # 注意是 .zip
    sha512: ...
    size: 123456789
  - url: DigiSmart-1.0.10-arm64.zip  # 注意是 .zip
    sha512: ...
    size: 123456789
path: DigiSmart-1.0.10-x64.zip        # 默认使用 x64
sha512: ...
releaseDate: '2025-11-11T03:40:00.000Z'
```

当前 `package.json` 配置已正确（同时生成 `.zip` 和 `.dmg`）：

```json
{
  "mac": {
    "target": [
      { "target": "zip", "arch": ["x64", "arm64"] },  // ✅ 用于自动更新
      { "target": "dmg", "arch": ["x64", "arm64"] }   // ✅ 用于首次安装
    ]
  }
}
```

---

## 🔄 问题 3: quitAndInstall() 在 Mac 上的行为

### Mac 和 Windows 的区别

| 平台 | quitAndInstall() 行为 |
|------|---------------------|
| **Windows** | 退出应用 → 自动运行安装程序 → 覆盖安装 → 重启应用 |
| **Mac** | 退出应用 → 解压 .zip → 替换 .app → **需要手动重启** |

### 解决方案：优化 Mac 更新体验

修改 `electron/main.cjs`：

```javascript
autoUpdater.on('update-downloaded', () => {
  writeLog('[更新] 下载完成');
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    // 区分平台提示
    if (process.platform === 'darwin') {
      // Mac: 需要重启应用
      mainWindow.webContents.send('update-downloaded', {
        platform: 'mac',
        message: '新版本已下载完成，请重启应用以完成更新'
      });
    } else {
      // Windows: 自动安装
      mainWindow.webContents.send('update-downloaded', {
        platform: 'win',
        message: '新版本已下载完成，将在退出时自动安装'
      });
    }
  }
});

// Mac 特殊处理
ipcMain.on('install-update', () => {
  writeLog('[更新] 用户确认安装更新');
  
  if (process.platform === 'darwin') {
    // Mac: 立即退出并安装（用户需要手动重启）
    autoUpdater.quitAndInstall(false, true);
  } else {
    // Windows: 正常退出并安装
    autoUpdater.quitAndInstall();
  }
});
```

---

## 🧪 测试 Mac 自动更新

### 测试步骤

1. **准备两个版本**
   ```bash
   # 当前版本 1.0.9
   # 新版本 1.0.10
   ```

2. **构建并上传新版本**
   ```bash
   npm run release:patch:mac-win
   ```

3. **安装旧版本 1.0.9**
   - 使用 `.dmg` 手动安装

4. **启动应用，检查日志**
   ```bash
   # 查看更新日志
   cat ~/Library/Application\ Support/DigiSmart/update-log.txt
   ```

5. **触发更新检查**
   - 应用启动 5 秒后自动检查
   - 或者在应用内手动触发

### 预期行为

**如果应用已签名：**
```
[更新] 正在检查更新...
[更新] 发现新版本: 1.0.10
[更新] 下载进度: 25%
[更新] 下载进度: 50%
[更新] 下载进度: 100%
[更新] 下载完成，将在退出时安装
```

**如果应用未签名：**
```
[更新] 正在检查更新...
[更新] 更新失败: Could not get code signature for running application
```

---

## 🎯 当前推荐方案

### 临时方案（开发/内测）

**不签名，手动更新：**

1. 用户下载 `.dmg` 文件
2. 拖拽到 Applications 覆盖旧版本
3. 重启应用

**优点：**
- 简单，无需证书
- 适合内部测试

**缺点：**
- 无法使用自动更新
- 用户体验较差

### 正式方案（生产环境）

**完整签名 + 公证：**

1. 获取 Apple Developer 账号
2. 配置代码签名
3. 启用自动更新
4. 配置公证流程

**优点：**
- 用户体验好
- 符合 macOS 安全要求
- 支持自动更新

**成本：**
- Apple Developer: $99/年
- 配置时间: 1-2 天

---

## 📋 检查清单

- [ ] 获取 Apple Developer 账号
- [ ] 安装开发者证书到钥匙串
- [ ] 配置 `package.json` 的 `mac.identity`
- [ ] 创建 `entitlements.mac.plist`
- [ ] 测试签名构建
- [ ] 配置公证流程
- [ ] 测试自动更新
- [ ] 更新用户文档

---

## 🔗 参考资料

- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [Apple Developer Program](https://developer.apple.com/programs/)
- [electron-updater Mac Setup](https://www.electron.build/auto-update#macos)
- [macOS Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

---

## ❓ 常见问题

### Q: 为什么 Windows 可以自动更新，Mac 不行？

A: Windows 的安全策略较宽松，允许未签名的应用自动更新。Mac 的 Gatekeeper 强制要求签名，这是 macOS 的安全特性。

### Q: 可以绕过签名要求吗？

A: 技术上可以（禁用 Gatekeeper），但**强烈不推荐**：
- 违反 macOS 安全最佳实践
- 用户需要手动禁用安全设置
- 不适合公开发布

### Q: 签名和公证有什么区别？

A:
- **签名（Code Signing）**: 证明应用来自可信开发者
- **公证（Notarization）**: Apple 扫描应用，确认无恶意代码
- 两者都是 macOS 10.15+ 的强制要求

### Q: 可以只签名不公证吗？

A: 可以，但：
- macOS 10.15+ 会警告"无法验证开发者"
- 用户需要右键 → 打开才能运行
- 不推荐

---

## 📱 联系我们

如需帮助配置 Mac 签名和自动更新，请联系技术团队。
