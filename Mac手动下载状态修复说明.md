# Mac 手动下载状态修复说明

## 🐛 问题描述

**症状：** Mac 用户点击"手动下载安装"后选择"后台下载"，二次点击图标还是提示"检测到新版本"，而不是显示下载进度。

**原因：** 点击"手动下载安装"后，没有正确更新下载状态，导致组件判断逻辑错误。

---

## ✅ 修复方案

### 状态管理逻辑

```javascript
// 状态变量
isDownloading.value   // true = 正在下载，显示进度对话框
isDownloaded.value    // true = 已下载完成，显示安装对话框
```

### 修复点 1：点击"手动下载安装"时标记为下载中

```javascript
// src/components/UpdateIndicator/index.vue

const downloadManually = async () => {
  // 关闭安装对话框
  installDialogVisible.value = false
  
  // 🔧 关键修复：标记为下载中状态
  isDownloading.value = true
  isDownloaded.value = false
  
  // ...开始下载
}
```

### 修复点 2：下载完成后重置状态

```javascript
const completeHandler = (data) => {
  // 🔧 重置下载状态
  isDownloading.value = false
  isDownloaded.value = true
  progressDialogVisible.value = false
  
  // 显示成功提示
  ElMessageBox.confirm(...)
}
```

### 修复点 3：取消下载或失败时重置状态

```javascript
if (result.canceled) {
  // 🔧 取消下载，重置状态回到"检测到新版本"
  isDownloading.value = false
  isDownloaded.value = true
  progressDialogVisible.value = false
}

if (!result.success) {
  // 🔧 下载失败，重置状态回到"检测到新版本"
  isDownloading.value = false
  isDownloaded.value = true
  progressDialogVisible.value = false
}

catch (error) {
  // 🔧 异常情况，重置状态
  isDownloading.value = false
  isDownloaded.value = true
  progressDialogVisible.value = false
}
```

---

## 🎯 修复后的状态流转

### 正常流程

```
1. 检测到新版本
   ↓
   isDownloading = false
   isDownloaded = true
   显示："检测到新版本"对话框
   
2. 点击"手动下载安装"
   ↓
   isDownloading = true     ✅ 修复点
   isDownloaded = false     ✅ 修复点
   显示：进度对话框
   
3. 用户选择"后台下载"
   ↓
   progressDialogVisible = false
   isDownloading = true (保持)
   状态：后台下载中
   
4. 用户二次点击图标
   ↓
   判断：isDownloading = true
   显示：进度对话框 ✅ 正确！
   
5. 下载完成
   ↓
   isDownloading = false    ✅ 修复点
   isDownloaded = true      ✅ 修复点
   显示：成功提示
```

### 取消下载流程

```
1. 用户点击"手动下载安装"
   ↓
   isDownloading = true
   显示：保存对话框
   
2. 用户点击"取消"
   ↓
   result.canceled = true
   isDownloading = false    ✅ 修复点
   isDownloaded = true      ✅ 修复点
   
3. 用户二次点击图标
   ↓
   判断：isDownloaded = true, isDownloading = false
   显示："检测到新版本"对话框 ✅ 可以重新下载
```

### 下载失败流程

```
1. 下载过程中出错
   ↓
   result.success = false 或 catch error
   isDownloading = false    ✅ 修复点
   isDownloaded = true      ✅ 修复点
   
2. 用户二次点击图标
   ↓
   显示："检测到新版本"对话框 ✅ 可以重新下载
```

---

## 📊 修改对比

### 修改前（错误）

```javascript
const downloadManually = async () => {
  installDialogVisible.value = false
  
  // ❌ 没有更新状态
  // isDownloading 和 isDownloaded 保持原值
  
  // 开始下载...
}

// 结果：
// - 用户选择后台下载后，isDownloading 仍为 false
// - 二次点击图标，判断为 isDownloaded = true
// - 错误地显示"检测到新版本"对话框，而不是进度
```

### 修改后（正确）

```javascript
const downloadManually = async () => {
  installDialogVisible.value = false
  
  // ✅ 正确更新状态
  isDownloading.value = true
  isDownloaded.value = false
  
  // 开始下载...
}

// 结果：
// - 用户选择后台下载后，isDownloading = true
// - 二次点击图标，判断为 isDownloading = true
// - 正确地显示进度对话框
```

---

## 🧪 测试步骤

### 测试场景 1：正常下载流程

```bash
# 1. 启动应用（旧版本）
open /Applications/DigiSmart.app

# 2. 等待检测更新（5秒）

# 3. 观察：弹出"检测到新版本"对话框

# 4. 点击"手动下载安装"

# 5. 观察：弹出保存对话框

# 6. 选择保存位置，点击"下载"

# 7. 观察：显示进度对话框

# 8. 点击"后台下载"

# 9. 观察：进度对话框消失，图标显示下载状态

# 10. 再次点击更新图标
期望：显示进度对话框，而不是"检测到新版本"对话框 ✅

# 11. 等待下载完成
期望：显示"下载完成"提示 ✅
```

### 测试场景 2：取消下载

```bash
# 1. 点击"手动下载安装"

# 2. 在保存对话框点击"取消"

# 3. 观察：提示"已取消下载"

# 4. 再次点击更新图标
期望：显示"检测到新版本"对话框 ✅ 可以重新下载
```

### 测试场景 3：下载失败

```bash
# 1. 点击"手动下载安装"

# 2. 选择保存位置（例如只读文件夹）

# 3. 观察：下载失败提示

# 4. 再次点击更新图标
期望：显示"检测到新版本"对话框 ✅ 可以重新下载
```

---

## ✅ 验证清单

### 基本功能

- [ ] 点击"手动下载安装"后，图标显示下载状态
- [ ] 选择"后台下载"后，二次点击图标显示进度对话框
- [ ] 进度对话框显示实时下载进度
- [ ] 下载完成后显示成功提示
- [ ] 可以在文件夹中显示下载的文件

### 边界情况

- [ ] 取消下载后，可以重新点击"手动下载安装"
- [ ] 下载失败后，可以重新点击"手动下载安装"
- [ ] 多次取消下载不会导致状态错误
- [ ] 网络中断后重新下载正常

### 用户体验

- [ ] 状态图标准确反映下载状态
- [ ] 提示信息清晰明确
- [ ] 操作流程顺畅不卡顿
- [ ] 进度条显示准确

---

## 📝 状态变量说明

### `isDownloading` (Boolean)

- **含义：** 是否正在下载
- **作用：** 
  - `true`: 显示进度对话框或下载图标状态
  - `false`: 不显示进度相关内容

### `isDownloaded` (Boolean)

- **含义：** 是否已下载完成（或检测到新版本）
- **作用：**
  - `true`: 显示"检测到新版本"或"下载完成"对话框
  - `false`: 不显示安装相关对话框

### 组合状态判断

| isDownloading | isDownloaded | 显示内容 |
|---------------|--------------|----------|
| `false` | `false` | 无更新 |
| `true` | `false` | 进度对话框 |
| `false` | `true` | 安装对话框 |
| `true` | `true` | 异常状态 ❌ |

---

## 🎯 核心修复点总结

| 修复点 | 修改前 | 修改后 |
|--------|--------|--------|
| **点击手动下载** | 状态不变 ❌ | `isDownloading = true` ✅ |
| **下载完成** | 状态不变 ❌ | `isDownloading = false` ✅ |
| **取消下载** | 状态不变 ❌ | 重置为可重新下载 ✅ |
| **下载失败** | 状态不变 ❌ | 重置为可重新下载 ✅ |
| **二次点击图标** | 显示错误对话框 ❌ | 显示进度对话框 ✅ |

---

## 🚀 下一步

```bash
# 测试修复效果
npm run dev

# 打包测试
npm run build:mac
```

**现在 Mac 用户可以正确查看手动下载进度了！** 🎉
