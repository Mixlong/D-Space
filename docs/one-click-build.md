# D-Space 全平台一键打包

一键生成以下 **4 个安装包，统一放在同一目录中**：

| 系统 | Electron | 唯一输出文件 |
| --- | --- | --- | --- |
| macOS Intel（x64） | modern / 32 | `D-Space-版本号-Mac-Intel-x64.zip` |
| macOS M 系列（arm64） | modern / 32 | `D-Space-版本号-Mac-AppleSilicon-arm64.zip` |
| Windows 7/8/8.1 64 位 | legacy / 21 | `D-Space-版本号-Win7-x64.exe` |
| Windows 10/11 64 位 | modern / 32 | `D-Space-版本号-Win10-11-x64.exe` |

**注意：** Win7 的 Electron 21 已停止安全维护；只为有明确兼容需求的旧设备保留，不建议新装。Win7 32 位（ia32）、Windows ARM 和 Linux 不在此四版本范围内。

## 使用方式

在项目根目录执行：

```bash
npm run build:all:check     # 检查平台及工具链，不安装依赖，不生成安装包
npm run build:all           # 一次生成四种平台的安装包（构建机需满足条件）
npm run build:all:mac       # 只生成 Mac Intel + M
npm run build:all:win       # 只生成 Win7 + Win10/11
npm run test:build-all      # 一键构建脚本回归测试
```

还支持测试环境：`npm run build:all -- --stage`，或单独 `--only=win7`、`--only=win10`。

### 在 Mac 上一次获得所有安装包（推荐 GitHub Actions）

把本次代码推送到已启用 Actions 的 GitHub 仓库。在 **Actions → D-Space 全平台一键打包 → Run workflow** 中点击运行。工作流分别使用 macOS、Windows 构建机，自动安装对应 Electron 版本，最后在运行结果的 **Artifacts** 下载 `D-Space-all-platforms`。

这不依赖 Mac 上安装 Wine，也不会自动发布 GitHub Release 或上传 OSS。

本地 `npm run build:all` 在 Mac 上会直接尝试 macOS ZIP 和 Windows NSIS EXE 构建；**不会因为没有检测到 Wine 就阻止打包**。本项目在 Mac 上有成功生成 Windows EXE 的记录，且本机存在 electron-builder NSIS 工具缓存。是否成功以实际构建结果为准。只有目标平台确实无法运行时才标记无法生成；部分产物放在 `electron_dist/one-click/v版本号-incomplete/`，不会覆盖已成功的完整版本目录。

如只需要 Mac ZIP，可执行 `npm run build:all:mac`。如果实际跨平台打包报 Wine 或本地工具链错误，再按错误补装缺失组件，或使用可用的 Windows 构建机/CI。

如果在 VS Code 调试环境运行，日志显示 `Debugger attached` 或 `Waiting for the debugger to disconnect...`，通常是 IDE 自动附加的调试器；子进程会清除继承的调试器参数，建议在普通终端运行，或关闭 VS Code Auto Attach。

### 版本和产物

构建以当前 **package.json.version** 为统一版本；两套发布线都使用同一版本号，但分别使用自己的 Electron 运行时和更新地址，不会修改源目录中的 package.json 或 node_modules。

交付目录 **只有 2 个 ZIP + 2 个 EXE**，不生成 DMG、Portable 安装包，也不会向交付目录复制 yml、blockmap 或其他文件。构建过程中 Electron Builder 仍可能在独立的临时构建目录生成内部元数据，但不包含在最终交付目录。

本地输出：

```text
electron_dist/one-click/v版本号/
├── D-Space-版本号-Mac-Intel-x64.zip
├── D-Space-版本号-Mac-AppleSilicon-arm64.zip
├── D-Space-版本号-Win7-x64.exe
└── D-Space-版本号-Win10-11-x64.exe
```

构建缓存隔离在 `electron_dist/.all-platform-workspaces/modern` 和 `legacy`。每个构建前会同步当前源码，复用已有 Vite / Electron Builder 工具，并明确指定 legacy（21）和 modern（32）各自的 Electron 运行时（优先使用本地缓存），不再重复 `npm install`。若无法生成实际安装包文件，则报错，不会误报成功。**每次正式执行一键构建时，原有同版本的交付目录会重建，旧产物会被清理**；不要在该目录手工存放重要文件。

**本流程只构建，不上传 OSS、不修改桌面版本字典、不提交 Git。** 发布前必须核对安装包、对应 SHA-512 与更新清单及 OSS/CDN，之后进行 Mac 和 Windows 真机安装/升级回归测试。
