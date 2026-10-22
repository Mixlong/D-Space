# DigiSmart 双发布线使用说明

## 发布线

- `transition`: Electron `21.4.4`，发布到旧目录 `digismart-desktop`，仅用于把老客户端桥接到新分流逻辑
- `legacy`: Electron `21.4.4`，用于 Windows 7 / 8 / 8.1
- `modern`: Electron `32.x`，用于 Windows 10/11、macOS、Linux

## 本地/CI 切换依赖清单

发布前先在独立构建环境中切换 manifest：

```bash
node scripts/use-release-manifest.cjs transition
npm install
npm run build:transition
npm run upload:oss:transition
```

```bash
node scripts/use-release-manifest.cjs legacy
npm install
npm run build:legacy
npm run upload:oss:legacy
```

```bash
node scripts/use-release-manifest.cjs modern
npm install
npm run build:modern
npm run upload:oss:modern
```

## 推荐的双打包目录

为了避免在同一个目录里反复执行 `npm install`，建议保留两个固定打包目录：

- `DigiSmart-build-21`: 固定给 `transition / legacy`
- `DigiSmart-build-32`: 固定给 `modern`

项目已经提供了同步和初始化脚本：

```bash
npm run setup:build21
npm run setup:build32
```

这两条命令会在项目同级目录创建：

- `/Volumes/项目管理/project/DigiSmart-build-21`
- `/Volumes/项目管理/project/DigiSmart-build-32`

并自动完成：

1. 同步当前源码
2. 切换对应 manifest
3. 执行 `npm install`

后续日常开发完成后，只需要同步代码：

```bash
npm run sync:builds
```

如果新增了 npm 依赖、插件依赖或改了 `dependencies / devDependencies`，直接执行：

```bash
npm run refresh:build21
npm run refresh:build32
```

它等价于“同步源码 + 切对应 manifest + npm install”。

然后在对应打包目录发布：

```bash
cd /Volumes/项目管理/project/DigiSmart-build-21
node scripts/use-release-manifest.cjs transition
npm run build:transition
npm run upload:oss:transition

node scripts/use-release-manifest.cjs legacy
npm run build:legacy
npm run upload:oss:legacy
```

```bash
cd /Volumes/项目管理/project/DigiSmart-build-32
node scripts/use-release-manifest.cjs modern
npm run build:modern
npm run upload:oss:modern
```

这样只有首次初始化时才需要分别安装一次 `Electron 21` 和 `Electron 32` 依赖，后续不需要在同一目录里来回切主版本。

## 一键打正式双线

如果要一键打 `legacy + modern`，直接在主目录执行：

```bash
npm run build:pair
```

它会自动执行：

1. `sync:builds`
2. 在 `DigiSmart-build-21` 里切到 `legacy` 并打包
3. 在 `DigiSmart-build-32` 里切到 `modern`，执行 `build:mac-win`

如果要一键打包并上传：

```bash
npm run publish:pair
```

它会在打完后继续执行：

- `upload:oss:legacy`
- `upload:oss:modern`

## 统一修改版本号

如果准备发新版本，不要只改主目录的 `package.json`。

直接执行：

```bash
npm run set:version 1.0.22
```

它会同步更新：

- `package.json`
- `package.transition.json`
- `package.legacy.json`
- `package.modern.json`

然后再执行：

```bash
npm run sync:builds
```

这样两个打包目录里的版本号也会跟着同步。

## 更新目录

- `transition`: `https://bikewise.oss-cn-shenzhen.aliyuncs.com/d-space/digismart-desktop`
- `legacy`: `https://bikewise.oss-cn-shenzhen.aliyuncs.com/d-space/digismart-desktop-legacy`
- `modern`: `https://bikewise.oss-cn-shenzhen.aliyuncs.com/d-space/digismart-desktop-modern`

## mac Intel 渲染分流

- `modern` 线内：
  - Intel Monterey 或静态风险机型：关闭硬件加速
  - Apple Silicon：保持硬件加速开启

## 过渡发布顺序

1. 先发布一次 `transition` 到旧目录，让历史客户端升级到带分流逻辑的新版本
2. `transition` 安装完成后，客户端会按运行系统自动切到 `legacy` 或 `modern`
3. 后续正常分别发布 `legacy` / `modern`

## transition 产物说明

- `transition` 的 mac 包只生成 `zip`，不生成 `dmg`
- 原因：桥接版本只需要满足已安装客户端的自动更新，不需要承担新的 mac 首次安装入口
- mac 新装用户直接从 `modern` 线下载正式安装包
