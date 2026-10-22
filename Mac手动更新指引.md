# Mac 手动更新指引

## 📌 背景说明

由于 Mac 应用未签名，自动更新功能可能存在限制。
如果自动更新失败，请按照以下步骤手动更新。

---

## 🔧 手动更新步骤

### 1. 下载最新版本

访问更新下载地址：
```
https://bikewise.oss-cn-shenzhen.aliyuncs.com/d-space/digismart-desktop/
```

或直接下载（根据你的 Mac 芯片选择）：

**Intel 芯片 (x64):**
```
https://bikewise.oss-cn-shenzhen.aliyuncs.com/d-space/digismart-desktop/DigiSmart-1.1.1-x64.dmg
```

**Apple Silicon (M1/M2/M3):**
```
https://bikewise.oss-cn-shenzhen.aliyuncs.com/d-space/digismart-desktop/DigiSmart-1.1.1-arm64.dmg
```

> 💡 **如何查看芯片类型？**
> 点击左上角  → 关于本机 → 处理器

---

### 2. 安装更新

```
1. 关闭正在运行的 DigiSmart 应用
2. 双击下载的 .dmg 文件
3. 拖拽 DigiSmart.app 到 Applications 文件夹
4. 点击"替换"确认覆盖旧版本
5. 从 Applications 或 Dock 重新打开应用
```

---

### 3. 首次打开提示

如果看到 **"无法验证开发者"** 提示：

```bash
# 方法 1: 右键打开
右键点击 DigiSmart.app → 打开 → 确认打开

# 方法 2: 终端命令
xattr -cr /Applications/DigiSmart.app
然后再打开应用
```

---

## ✅ 验证更新成功

打开应用后：
- 查看关于页面或应用标题栏
- 版本号应该显示为 **1.1.1** 或更高

---

## 🆘 常见问题

### Q: 为什么自动更新不工作？

A: Mac 需要应用签名才能完全支持自动更新和自动重启。
我们的应用目前未签名，所以自动更新功能受限。

### Q: 每次都要手动更新吗？

A: 目前是的。我们正在评估申请 Apple Developer 账号的必要性。
如果未来用户反馈较多，会考虑启用完整的自动更新功能。

### Q: 更新会丢失数据吗？

A: **不会**！用户数据存储在：
```
~/Library/Application Support/DigiSmart/
```
更新应用不会影响这个目录。

### Q: 能否收到更新通知？

A: 可以！应用仍然会检测到新版本并提示，只是安装需要手动完成。

---

## 📞 需要帮助？

如有问题，请联系技术支持。
