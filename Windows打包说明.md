# Windows 打包说明

## 🎯 打包命令

```bash
# 清理旧文件并重新打包
rm -rf electron_dist dist
npm run build:win
```

## ⚠️ 已知问题和解决方案

### 问题1：图标尺寸不符合要求

**错误信息：**
```
⨯ image must be at least 256x256
```

**原因：**
- 当前图标 `src/assets/logo/logo.png` 尺寸为 **64x64**
- Windows要求图标至少 **256x256** 像素
- 推荐使用 **512x512** 像素

**解决方案（已应用）：**
✅ 已移除 `package.json` 中的图标配置，使用 Electron 默认图标

如需自定义图标，请：
1. 准备 512x512 像素的 PNG 图标
2. 放在 `src/assets/logo/icon-512.png`
3. 在 `package.json` 中配置：
```json
{
  "build": {
    "win": {
      "icon": "src/assets/logo/icon-512.png"
    }
  }
}
```

---

### 问题2：ICU 数据错误

**错误信息：**
```
[ERROR:icu_util.cc(223)] Invalid file descriptor to ICU data received.
```

**原因：**
- Electron 二进制文件损坏
- 打包缓存问题

**解决方案：**
```bash
# 清理缓存
rm -rf electron_dist dist node_modules/.cache

# 重新打包
npm run build:win
```

---

## 📦 打包产物

打包成功后，文件在 `electron_dist/` 目录：

```
electron_dist/
├── win-unpacked/              # Windows 未打包文件（可直接运行）
│   └── RuoYi-Vue3管理系统.exe
└── RuoYi-Vue3管理系统-3.9.0-x64.exe  # 安装程序（分发给用户）
```

### 文件说明

| 文件 | 说明 | 用途 |
|------|------|------|
| `win-unpacked/` | 解压后的程序文件 | 开发测试用 |
| `*.exe` (安装程序) | NSIS 安装器 | 最终分发给用户 |

---

## 🚀 使用方法

### 方法1：直接运行（测试用）
```bash
cd electron_dist/win-unpacked
./RuoYi-Vue3管理系统.exe
```

### 方法2：安装程序（分发）
双击 `RuoYi-Vue3管理系统-3.9.0-x64.exe`
- 可以选择安装目录
- 自动创建桌面快捷方式
- 自动创建开始菜单项

---

## 🔧 配置说明

当前打包配置（`package.json`）：

```json
{
  "build": {
    "appId": "com.ruoyi.desktop",
    "productName": "RuoYi-Vue3管理系统",
    "win": {
      "target": "nsis",           // 安装程序类型
      "arch": ["x64"]            // 64位
    },
    "nsis": {
      "oneClick": false,                        // 允许自定义安装
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,           // 创建桌面图标
      "createStartMenuShortcut": true,         // 创建开始菜单
      "shortcutName": "RuoYi管理系统"
    }
  }
}
```

---

## 📊 打包流程

1. **编译前端代码** → `dist/` 目录
2. **打包Electron** → 下载Windows运行时
3. **创建安装程序** → NSIS打包
4. **输出文件** → `electron_dist/` 目录

总耗时：约 **3-5分钟**（首次需下载依赖）

---

## ⚡ 优化建议

### 1. 加速打包

使用国内镜像：
```bash
npm config set electron_mirror https://npmmirror.com/mirrors/electron/
```

### 2. 减小体积

在 `package.json` 中添加：
```json
{
  "build": {
    "files": [
      "dist/**/*",
      "electron/**/*",
      "!**/*.map"           // 排除 source map
    ],
    "compression": "maximum"  // 最大压缩
  }
}
```

### 3. 代码签名（可选）

获取代码签名证书后：
```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.pfx",
      "certificatePassword": "your-password"
    }
  }
}
```

---

## 🐛 常见错误

### 错误1：打包后无法运行
**检查：**
- 确保后端API地址正确（环境变量配置）
- 检查 `electron/main.cjs` 路径配置

### 错误2：安装程序无法创建
**解决：**
```bash
# 清理并重试
rm -rf electron_dist
npm run build:win
```

### 错误3：缺少依赖
**解决：**
```bash
npm install electron-builder --save-dev
```

---

## 📝 测试清单

打包完成后，请测试：

- [ ] 双击 exe 能否正常安装
- [ ] 安装后能否正常启动
- [ ] 桌面快捷方式是否创建
- [ ] 开始菜单项是否创建
- [ ] 能否正常连接后端API
- [ ] 系统托盘功能是否正常
- [ ] 卸载程序是否正常工作

---

## 🎉 完成

打包成功后，文件位于：
```
electron_dist/RuoYi-Vue3管理系统-3.9.0-x64.exe
```

这个文件可以直接分发给Windows用户使用！

---

**正在打包中...** ⏳  
请等待约 3-5 分钟，打包完成后会在 `electron_dist/` 目录生成安装程序。

