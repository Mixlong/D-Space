# MQTT 推送托盘通知集成说明

## ✅ 已完成集成

现在当收到 MQTT 推送消息时，会自动触发托盘图标闪烁和浮窗通知！

---

## 🎯 工作原理

### 1. 消息流程

```
MQTT 服务器推送消息
    ↓
mqttClient 接收消息
    ↓
判断环境和窗口状态
    ↓
├─ Electron 环境 + 窗口未激活 → 托盘通知（闪烁 + 浮窗）
└─ 其他情况 → 系统桌面通知
```

### 2. 触发条件

托盘通知会在以下情况下触发：
- ✅ **运行环境**：Electron 桌面应用
- ✅ **窗口状态**：窗口未激活（最小化或失去焦点）
- ✅ **消息类型**：任何 MQTT 推送消息

如果不满足条件，会降级使用系统桌面通知（浏览器 Notification API）。

---

## 🔔 效果演示

### 收到 MQTT 消息时

1. **托盘图标开始闪烁**（每 500ms 切换显示/隐藏）
2. **Tooltip 显示消息摘要**
3. **鼠标移入托盘图标** → 显示浮窗通知
4. **浮窗内容**：
   - 标题：MQTT消息推送（或自定义标题）
   - 内容：消息内容
   - 时间：当前时间
   - 按钮：取消 | 确定

### 用户交互

| 操作 | 效果 |
|------|------|
| 鼠标移入托盘 | 停止闪烁，显示浮窗 |
| 点击"确定" | 打开主窗口，执行相应操作 |
| 点击"取消" | 关闭浮窗，继续闪烁 |
| 点击托盘图标 | 打开主窗口，停止闪烁 |
| 5秒后 | 浮窗自动关闭 |

---

## 📝 代码实现

### 核心修改文件

**src/utils/mqttClient.js**

#### 1. 构造函数中注册监听

```javascript
constructor() {
  // ... 其他初始化代码
  
  // Electron 环境：监听托盘通知确认事件
  if (window.electronAPI) {
    window.electronAPI.onNotificationConfirmed((data) => {
      console.log('[MQTT] 用户点击了托盘通知的确定按钮:', data)
      this.handleNotificationClick(data)
    })
    console.log('[MQTT] Electron 托盘通知监听已注册')
  }
}
```

#### 2. 消息通知分发

```javascript
showMessageNotification(messageData) {
  const processedMessage = handleMqttMessage(messageData)
  
  // Electron 环境：使用托盘通知（优先）
  if (window.electronAPI && !document.hasFocus()) {
    console.log('[MQTT] 使用 Electron 托盘通知')
    this.showTrayNotification(processedMessage)
  } else {
    // 浏览器环境或窗口已激活：使用系统桌面通知
    console.log('[MQTT] 使用系统桌面通知')
    this.showSystemNotification(processedMessage)
  }
}
```

#### 3. 托盘通知方法

```javascript
showTrayNotification(processedMessage) {
  try {
    const title = processedMessage.title || 'MQTT消息推送'
    const content = processedMessage.content || '您有新的消息'
    
    // 调用 Electron 托盘通知 API
    window.electronAPI.sendNotification({
      title: title,
      content: content,
      time: new Date().toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      type: 'mqtt',
      messageType: processedMessage.type,
      data: processedMessage.data
    })
    
    console.log('[MQTT] 托盘图标开始闪烁')
  } catch (error) {
    console.error('[MQTT] 显示托盘通知失败:', error)
    // 降级到系统通知
    this.showSystemNotification(processedMessage)
  }
}
```

---

## 🧪 测试方法

### 方法 1：实际 MQTT 推送

1. **确保 MQTT 已连接**
   - 登录系统
   - 检查控制台：`[MQTT] 连接成功`

2. **最小化或隐藏窗口**
   - 点击最小化按钮
   - 或切换到其他应用

3. **发送 MQTT 测试消息**
   - 使用 MQTT 客户端工具（如 MQTTX）
   - 发送消息到订阅的主题

4. **观察效果**
   - 托盘图标开始闪烁 ✅
   - 鼠标移入查看浮窗 ✅

### 方法 2：控制台模拟

在浏览器控制台输入：

```javascript
// 模拟 MQTT 消息
const testMessage = {
  type: 501,
  title: '测试MQTT推送',
  content: '这是一条测试的MQTT消息',
  data: { test: true }
};

// 直接调用通知方法
if (window.$mqtt) {
  window.$mqtt.showTrayNotification({
    title: testMessage.title,
    content: testMessage.content,
    type: testMessage.type,
    data: testMessage.data
  });
}
```

### 方法 3：使用测试组件

访问测试组件页面，点击"快速测试 - MQTT"按钮。

---

## 📊 控制台日志

成功运行时会看到以下日志：

```
[MQTT] Electron 托盘通知监听已注册
[MQTT] 连接成功
[MQTT] 成功订阅主题: /xxx/xxx/#
[MQTT] 收到消息 - 主题: /xxx/xxx/501
[MQTT] 消息解析成功（明文JSON）: {...}
[MQTT] 收到501推送通知: {...}
[MQTT] 使用 Electron 托盘通知
[MQTT] 发送托盘通知 - 标题: MQTT消息推送 内容: 测试消息
[MQTT] 托盘图标开始闪烁
[Tray] 开始闪烁，通知内容: {...}
```

---

## 🎛️ 自定义配置

### 修改消息标题

编辑 `src/utils/mqttMessageTypes.js`，在消息类型处理中返回自定义标题：

```javascript
export function handleMqttMessage(messageData) {
  const type = messageData.type || messageData.typeCode
  
  switch(type) {
    case MQTT_MESSAGE_TYPE.PUSH_NOTIFICATION:
      return {
        title: '📢 重要通知',  // 自定义标题
        content: messageData.content,
        type: type,
        data: messageData
      }
    // ... 其他类型
  }
}
```

### 修改闪烁速度

编辑 `electron/main.cjs`，修改闪烁间隔：

```javascript
// 每500毫秒切换一次图标显示/隐藏
trayFlashTimer = setInterval(() => {
  // ...
}, 500);  // 改为 300 或 1000 等
```

### 修改浮窗自动关闭时间

编辑 `electron/main.cjs` 中的 `generateNotificationHtml` 函数：

```javascript
// 5秒后自动关闭
setTimeout(() => {
  window.close();
}, 5000);  // 改为 3000、10000 等
```

---

## 🔧 故障排查

### 问题 1：托盘图标不闪烁

**可能原因**：
1. 窗口正处于激活状态
2. 不是 Electron 环境
3. MQTT 未连接

**解决方法**：
```javascript
// 检查环境
console.log('Electron API:', !!window.electronAPI);
console.log('窗口激活:', document.hasFocus());

// 检查 MQTT 连接
console.log('MQTT 状态:', window.$mqtt?.getStatus());
```

### 问题 2：浮窗不显示

**可能原因**：
1. 托盘图标未闪烁
2. 鼠标没有移到托盘图标上

**解决方法**：
- 确保托盘图标正在闪烁
- 鼠标要**移动**到托盘图标上（不是点击）

### 问题 3：点击确定没反应

**可能原因**：
1. 事件监听未注册
2. `handleNotificationClick` 方法未正确实现

**解决方法**：
```javascript
// 检查监听是否注册
console.log('mqttClient:', window.$mqtt);
// 应该看到控制台有：[MQTT] Electron 托盘通知监听已注册
```

---

## 📈 数据结构

### MQTT 消息数据

```javascript
{
  type: 501,              // 消息类型
  title: "推送通知",      // 标题（可选）
  content: "消息内容",    // 内容
  data: {                 // 附加数据（可选）
    orderId: 123,
    action: "view",
    url: "https://..."
  }
}
```

### 托盘通知数据

```javascript
{
  title: "MQTT消息推送",
  content: "您有新的消息",
  time: "14:30",
  type: "mqtt",
  messageType: 501,       // 原始消息类型
  data: { /* 原始数据 */ }
}
```

---

## 🎨 UI 定制

浮窗样式在 `electron/main.cjs` 的 `generateNotificationHtml` 函数中定义。

可以修改：
- 颜色方案（CSS 渐变）
- 字体大小
- 浮窗尺寸
- 按钮文字
- 动画效果

---

## 📚 相关文档

- **托盘通知使用说明.md** - 完整的托盘通知 API 文档
- **托盘通知快速开始.md** - 快速上手指南
- **托盘图标修复说明.md** - 图标显示问题修复

---

## ✨ 功能特性

- ✅ 自动集成，无需额外配置
- ✅ 智能环境判断（Electron vs 浏览器）
- ✅ 窗口状态感知（激活 vs 未激活）
- ✅ 优雅降级（托盘通知 → 系统通知）
- ✅ 完整的事件响应（确定/取消/自动关闭）
- ✅ 消息类型区分和路由
- ✅ 详细的日志输出，便于调试

---

**版本**: 3.9.0  
**最后更新**: 2025-10-27  
**集成完成**: ✅

