# 📢 通知功能使用指南

## 🎯 功能概述

本系统已实现类似钉钉的推送通知功能，包括：

✅ **系统级通知弹窗** - 类似钉钉的桌面通知  
✅ **托盘图标闪烁** - 吸引用户注意  
✅ **鼠标悬停显示** - 移动鼠标到托盘图标时显示通知  
✅ **点击通知打开应用** - 点击通知自动聚焦应用窗口  
✅ **跨平台支持** - Windows、macOS、Linux 都支持  

---

## 🚀 如何测试通知功能

### 方法一：使用测试工具页面（推荐）

1. **启动应用**
   ```bash
   npm run dev
   # 或
   npm run electron:dev
   ```

2. **打开测试页面**
   - 在应用中打开浏览器控制台（F12 或 Ctrl+Shift+I）
   - 在地址栏输入：`file:///你的项目路径/notification-test.html`
   - 或者直接双击打开 `notification-test.html` 文件

3. **发送测试通知**
   - 填写通知标题和内容
   - 点击 **"发送测试通知"** 按钮
   - 观察托盘图标是否闪烁
   - 查看是否弹出系统通知

4. **测试鼠标悬停**
   - 将鼠标移动到托盘图标上
   - 应该会显示通知弹窗并停止闪烁

### 方法二：在浏览器控制台测试

1. 打开浏览器控制台（F12）

2. 输入以下命令测试：

```javascript
// 发送测试通知
window.electronAPI.testNotification({
  title: '测试通知',
  content: '这是一条测试消息',
  type: 'test'
})

// 模拟 MQTT 通知
window.electronAPI.sendNotification({
  title: 'MQTT消息',
  content: '您收到了一条新消息',
  time: '14:30',
  type: 'mqtt',
  messageType: 501
})

// 停止托盘闪烁
window.electronAPI.stopTrayFlash()
```

### 方法三：通过 MQTT 触发

当 MQTT 客户端收到消息时，会自动触发通知。无需手动操作。

---

## 🔧 功能详解

### 1. 系统通知弹窗

- **触发时机**：MQTT 收到消息时立即弹出
- **显示位置**：系统通知区域（Windows 右下角，macOS 右上角）
- **显示时长**：根据系统默认设置（通常 5-10 秒）
- **交互功能**：
  - 点击通知 → 打开并聚焦应用窗口
  - 通知会播放系统提示音

### 2. 托盘图标闪烁

- **触发时机**：发送通知时开始闪烁
- **闪烁频率**：每 500ms 切换一次（显示/隐藏）
- **停止方式**：
  - 鼠标移动到托盘图标上
  - 点击托盘图标
  - 应用窗口获得焦点
  - 手动调用 `stopTrayFlash()`

### 3. 鼠标悬停显示

- **触发条件**：托盘图标正在闪烁时
- **操作方式**：将鼠标移动到托盘图标上
- **效果**：
  - 停止图标闪烁
  - 显示系统通知弹窗
  - Tooltip 显示消息内容

---

## 🐛 常见问题排查

### 问题 1：通知没有显示

**可能原因**：
- 系统通知权限未开启
- 通知被系统禁用

**解决方案**：
1. **Windows**：
   - 设置 → 系统 → 通知和操作
   - 确保 "从应用和其他发送者获取通知" 已开启
   - 找到你的应用，确保通知已启用

2. **macOS**：
   - 系统偏好设置 → 通知
   - 找到 Electron 或你的应用
   - 确保通知样式设置为 "提醒" 或 "横幅"

3. **Linux**：
   - 确保系统安装了通知服务（如 `libnotify`）

### 问题 2：托盘图标不闪烁

**检查项**：
1. 打开开发者工具，查看控制台是否有错误
2. 确认 `tray-notification` IPC 消息是否发送成功
3. 检查 `main.js` 中的 `startTrayFlash` 函数是否执行

**调试命令**：
```javascript
// 检查 electronAPI 是否可用
console.log(window.electronAPI)

// 检查 sendNotification 方法
console.log(typeof window.electronAPI.sendNotification)
```

### 问题 3：鼠标悬停无反应

**可能原因**：
- 托盘图标未在闪烁状态
- `notificationMessage` 为空

**解决方案**：
- 确保通知已发送且托盘图标正在闪烁
- 查看主进程控制台日志

### 问题 4："Object has been destroyed" 错误

**已修复**：
- 所有访问 window/webContents/tray 的地方都已添加销毁检查
- MQTT 客户端在窗口关闭前会自动断开连接
- 所有定时器和事件监听器都会被正确清理

如果仍然出现此错误，请提供详细的错误堆栈信息。

---

## 📝 代码示例

### 在 Vue 组件中发送通知

```vue
<template>
  <button @click="sendNotification">发送通知</button>
</template>

<script setup>
const sendNotification = () => {
  if (window.electronAPI) {
    window.electronAPI.sendNotification({
      title: '新消息',
      content: '您有一条新的订单通知',
      time: new Date().toLocaleTimeString('zh-CN'),
      type: 'order',
      data: {
        orderId: '12345'
      }
    })
  }
}
</script>
```

### 在 MQTT 客户端中使用

通知功能已自动集成到 `mqttClient.js` 中：

```javascript
// 在 showMessageNotification 方法中
if (window.electronAPI) {
  // Electron 环境：托盘通知 + 系统通知
  this.showTrayNotification(processedMessage)
  this.showSystemNotification(processedMessage)
} else {
  // 浏览器环境：仅系统通知
  this.showSystemNotification(processedMessage)
}
```

---

## 🎨 自定义通知

### 修改通知样式

通知的样式由系统决定，但你可以自定义：
- 标题
- 内容
- 图标（在 `main.js` 中配置 `trayIconPath`）
- 提示音（`silent: false`）

### 修改闪烁频率

在 `main.js` 的 `startTrayFlash` 函数中修改：

```javascript
// 将 500 改为你想要的毫秒数
trayFlashTimer = setInterval(() => {
  // ...
}, 500); // <-- 这里修改闪烁间隔
```

---

## 📚 API 参考

### window.electronAPI.sendNotification(data)

发送 MQTT 通知（带托盘闪烁）

**参数**：
```typescript
{
  title: string,       // 通知标题
  content: string,     // 通知内容
  time?: string,       // 时间（可选）
  type?: string,       // 消息类型（可选）
  messageType?: number,// MQTT 消息类型（可选）
  data?: any          // 附加数据（可选）
}
```

### window.electronAPI.testNotification(data)

发送测试通知（用于调试）

**参数**：同 `sendNotification`

### window.electronAPI.stopTrayFlash()

停止托盘图标闪烁

**参数**：无

---

## 🔍 日志调试

所有通知相关的操作都会在控制台输出日志：

- `[MQTT]` - MQTT 客户端相关日志
- `[Tray]` - 托盘图标相关日志
- `[Notification]` - 系统通知相关日志
- `[IPC]` - 主进程与渲染进程通信日志

打开开发者工具（F12）查看这些日志可以帮助你调试问题。

---

## ✅ 修复内容总结

本次修复解决了以下问题：

1. ✅ 修复 "Object has been destroyed" 错误
2. ✅ 使用 Electron Notification API 替代废弃的 displayBalloon
3. ✅ 添加所有 window/tray 对象的销毁检查
4. ✅ 改进 MQTT 客户端的清理逻辑
5. ✅ 实现跨平台的系统通知
6. ✅ 添加鼠标悬停显示通知功能
7. ✅ 添加测试工具和调试接口

---

## 📧 联系与反馈

如有问题或建议，请：
- 查看控制台日志
- 使用测试工具验证功能
- 提供详细的错误信息和复现步骤

祝使用愉快！ 🎉


