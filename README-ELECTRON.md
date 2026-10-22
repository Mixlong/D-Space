# RuoYi-Vue3 Electron桌面应用版本

基于博客文章 [RuoYi-Vue3跨平台开发探索：Electron桌面应用改造实践](https://blog.csdn.net/gitblog_00738/article/details/151893252) 实现的Electron桌面应用版本。

## 技术栈

- **Vue 3.5.16** - 核心前端框架
- **Vite 6.3.5** - 构建工具
- **Element Plus 2.10.7** - UI组件库
- **Electron 34.0.0** - 桌面应用框架
- **Electron Builder 25.1.8** - 打包工具

## 新增功能

### 1. 桌面应用特性
- ✅ 跨平台支持（Windows、macOS、Linux）
- ✅ 自定义窗口控制（最小化、最大化、关闭）
- ✅ 系统托盘功能
- ✅ 独立运行，无需浏览器
- ✅ 更好的安全性和性能

### 2. Electron集成
- ✅ 主进程与渲染进程通信
- ✅ 预加载脚本安全API暴露
- ✅ 开发环境热重载支持
- ✅ 内存使用监控

## 项目结构

```
RuoYi-Vue3/
├── electron/                    # Electron相关文件
│   ├── main.js                 # 主进程入口
│   └── preload.js              # 预加载脚本
├── build/                       # 构建资源
│   └── installer.nsh           # Windows安装器脚本
├── electron-builder.yml        # Electron Builder配置
└── package.json                # 已添加Electron配置
```

## 安装依赖

```bash
# 安装所有依赖（包括Electron）
npm install
```

新增的Electron相关依赖：
- `electron` - Electron核心
- `electron-builder` - 打包工具
- `concurrently` - 并发运行脚本
- `cross-env` - 跨平台环境变量
- `wait-on` - 等待服务启动

## 开发模式

### 1. 仅Web开发（原有方式）
```bash
npm run dev
```
访问：http://localhost:80

### 2. Electron开发模式
```bash
npm run electron:dev
```
这个命令会：
1. 启动Vite开发服务器（http://localhost:80）
2. 等待服务器就绪
3. 启动Electron窗口

**开发环境特性：**
- 支持Vite热重载
- 自动打开开发者工具
- 内存使用监控（每30秒输出一次）

## 生产构建

### 构建所有平台
```bash
npm run electron:build
```

### 构建特定平台
```bash
# Windows
npm run electron:build:win

# macOS
npm run electron:build:mac

# Linux
npm run electron:build:linux
```

## 打包输出

打包后的文件在 `release/` 目录：

| 平台 | 文件格式 | 说明 |
|------|---------|------|
| Windows | `.exe` | NSIS安装程序 |
| macOS | `.dmg` | 磁盘镜像（支持x64和arm64） |
| Linux | `.AppImage`, `.deb` | AppImage和Debian包 |

## 打包配置说明

配置位于 `package.json` 的 `build` 字段和 `electron-builder.yml`：

### Windows配置
- **安装方式**：NSIS安装程序
- **特性**：
  - 允许用户选择安装目录
  - 创建桌面快捷方式
  - 创建开始菜单快捷方式
  - 支持自定义安装脚本

### macOS配置
- **格式**：DMG磁盘镜像
- **架构**：支持Intel (x64) 和 Apple Silicon (arm64)
- **分类**：商业应用

### Linux配置
- **格式**：AppImage（便携版）和 DEB（Debian/Ubuntu）
- **架构**：x64
- **分类**：办公软件

## 主要文件说明

### electron/main.js
主进程文件，负责：
- 创建应用窗口
- 管理窗口生命周期
- 创建系统托盘
- 处理窗口控制（最小化、最大化、关闭）
- 加载应用内容（开发/生产环境）

### electron/preload.js
预加载脚本，提供安全的API：
```javascript
window.electronAPI = {
  minimizeWindow: () => {...},    // 最小化窗口
  maximizeWindow: () => {...},    // 最大化/还原窗口
  closeWindow: () => {...},       // 关闭窗口
  isMaximized: () => {...},       // 获取最大化状态
  isElectron: true,               // 标识Electron环境
  versions: {...},                // 版本信息
  platform: '...'                 // 平台信息
}
```

### vite.config.js调整
```javascript
// 修改base路径以支持Electron
base: VITE_APP_ENV === 'production' ? './' : '/'
```

## 系统要求

### 开发环境
- Node.js 16.x 或更高版本
- npm 8.x 或更高版本

### Windows
- Windows 7 或更高版本
- .NET Framework 4.5 或更高版本

### macOS
- macOS 10.11 (El Capitan) 或更高版本

### Linux
- Ubuntu 18.04 或更高版本
- 或其他支持的Linux发行版

## 常见问题

### 1. 开发模式启动慢？
**原因**：等待Vite服务器启动  
**解决**：这是正常的，首次启动需要等待服务器就绪

### 2. 打包时报错找不到图标？
**解决**：确保 `src/assets/logo/logo.png` 存在

### 3. Windows打包需要什么环境？
**答**：需要安装Windows SDK，electron-builder会自动处理

### 4. 跨域问题？
**答**：Electron环境已在主进程中配置了代理处理，无需额外配置

### 5. 如何调试主进程？
```bash
# 在electron/main.js中添加
console.log('调试信息')
```
或使用VSCode调试配置

## 性能优化

已实现的优化：
- ✅ 禁用不必要的Web功能
- ✅ 优化资源加载
- ✅ 内存泄漏监控（开发环境）
- ✅ 图片动画策略优化
- ✅ 后台节流

## 与Web版本对比

| 特性 | Web版本 | Electron版本 |
|------|---------|--------------|
| 部署方式 | 需要服务器 | 独立安装包 |
| 运行环境 | 浏览器 | 原生应用 |
| 系统集成 | 有限 | 深度集成 |
| 安全性 | 依赖浏览器 | 更高 |
| 性能 | 一般 | 更好 |
| 离线使用 | 不支持 | 支持 |

## 未来扩展

可以继续添加的功能：
- 🔄 自动更新（electron-updater）
- 💾 离线数据同步
- 📁 文件系统操作
- 🖱️ 右键菜单集成
- 📊 更多系统级功能

## 相关资源

- [原始博客文章](https://blog.csdn.net/gitblog_00738/article/details/151893252)
- [Electron官方文档](https://www.electronjs.org/docs)
- [Electron Builder文档](https://www.electron.build/)
- [Vite官方文档](https://vitejs.dev/)

## 注意事项

1. **开发模式端口**：确保80端口未被占用
2. **后端接口**：需要后端服务运行在 `http://localhost:8080`
3. **首次打包**：首次打包会下载依赖，可能需要较长时间
4. **代码签名**：生产环境建议配置代码签名证书

## 贡献

基于RuoYi-Vue3官方项目改造，遵循MIT开源协议。

---

**项目版本**: 3.9.0  
**Electron版本**: 34.0.0  
**最后更新**: 2025-10-23

