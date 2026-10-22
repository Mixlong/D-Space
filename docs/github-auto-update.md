# DigiSmart 正式版自动发布链路

## 目标链路

```text
Codeup
  ↓ 云效同步到 GitHub 镜像
GitHub Actions
  ├── macOS runner 构建 modern macOS 包
  └── Windows runner 构建 modern Windows 10/11 包
        ↓
创建 GitHub Release 资产
        ↓ Webhook
云效「DigiSmart 正式版」流水线
        ↓ 使用云效 OSS 服务连接
阿里云 OSS
        ↓
Electron 自动更新
```

本项目只配置正式版发布入口，不配置开发版发布入口。`transition / legacy / modern`
是 Electron 兼容发布线，不是环境名称；正式版流水线固定使用 `modern`，因此不会另外维护一套开发代码。

正式版 OSS 地址保持为：

```text
https://bikewise.oss-cn-shenzhen.aliyuncs.com/d-space/digismart-desktop-modern
```

## GitHub Actions

正式版工作流是 `.github/workflows/release-stable.yml`，有两种启动方式：

1. 推送正式版本标签，例如 `v1.0.24`。
2. 在 GitHub Actions 页面手动运行，并填写 `1.0.24` 形式的版本号。

工作流会在 macOS 和 Windows runner 上分别打包，随后创建 GitHub Release。`publish` 作业使用
GitHub `production` Environment；如果该 Environment 配置了审批，审批通过后才会创建 Release
并通知云效。云效收到通知后，负责从 GitHub 下载资产并上传到 OSS。

GitHub 仓库只需要配置一个 Secret：

```text
YUNXIAO_DIGISMART_STABLE_WEBHOOK_URL
```

这个值是云效正式版流水线的 Webhook 地址，不是 OSS 密钥。OSS 上传权限由云效配置的 OSS 服务连接提供。

## 云效流水线

云效流水线建议命名为 `DigiSmart 正式版 OSS 发布`，只保留一个阶段：

1. 接收 GitHub Actions 发送的 `RELEASE_TAG`。
2. 下载对应 GitHub Release 的 macOS/Windows 资产。
3. 解压并校验 `latest-mac.yml`、`latest.yml`。
4. 通过云效 OSS 服务连接上传到 `digismart-desktop-modern`。

日常开发只需要把代码推送到 Codeup；Codeup 同步到 GitHub 后，由 GitHub Actions 构建并回调云效。
不需要在本机运行 OSS 上传，也不需要把 OSS 密钥写入代码库。

## 本地上传（仅排障使用）

`scripts/upload-to-oss.cjs` 不再保存 AccessKey。若必须在本地排障上传，需要临时通过环境变量提供凭据：

```bash
OSS_ACCESS_KEY_ID=*** \
OSS_ACCESS_KEY_SECRET=*** \
RELEASE_CHANNEL=modern \
npm run upload:oss:modern
```

不要把真实密钥写入脚本、`.env` 或提交到仓库。旧凭据如果曾经提交过 Git 历史，应在阿里云 RAM 中单独轮换。
