# MQTT 使用指南

## 📝 目录

1. [自动连接流程](#自动连接流程)
2. [手动测试连接](#手动测试连接)
3. [发送和接收消息](#发送和接收消息)
4. [URL 转换规则](#url-转换规则)
5. [常见问题](#常见问题)

---

## 自动连接流程

### 当前实现

系统已经实现了**自动初始化和连接** MQTT 的流程：

```
用户登录
   ↓
触发 initMqtt()
   ↓
1️⃣ 调用 initDevice() - 获取 mqttKey
   ↓
2️⃣ 调用 getMqttConfig() - 获取 MQTT 配置
   ↓
3️⃣ 自动转换 URL (tcp → ws)
   ↓
4️⃣ 连接 MQTT 服务器
   ↓
5️⃣ 订阅主题
   ↓
✅ 开始接收消息
```

### 查看连接状态

打开浏览器控制台，你会看到：

```javascript
[MQTT] 开始初始化...
[MQTT] 未提供 mqttKey，开始执行设备初始化...
[设备初始化] 请求头签名...
[MQTT] 设备初始化成功，获取到 mqttKey: c2877f963c46ed35
[MQTT] 获取MQTT配置...
[MQTT API] 准备获取MQTT配置
[MQTT] 原始URL: tcp://8.130.48.231
[MQTT] URL 转换: tcp://8.130.48.231 → ws://8.130.48.231:8083/mqtt
[MQTT] 转换后URL: ws://8.130.48.231:8083/mqtt
[MQTT] 正在连接到: ws://8.130.48.231:8083/mqtt
[MQTT] 连接成功 ✅
[MQTT] 成功订阅主题: /a1DLcjz8jcG/jExC3NUNZK70BuVx3uTP/user/get/#
```

---

## 手动测试连接

### 方法 1：使用测试页面

访问：**设备管理 > MQTT设备管理**

1. **填写设备信息**
   - CPU ID: `用户名_用户ID`
   - 设备类型: PUCS
   - 设备序列号: 与 CPU ID 相同
   - 系统版本: 1.0.0

2. **点击"自动填充测试数据"** - 快速填充表单

3. **点击"初始化设备"** - 获取 mqttKey

4. **点击"获取配置"** - 获取 MQTT 连接配置

### 方法 2：使用代码

```javascript
import { mqttClient } from '@/utils/mqttClient'

// 检查连接状态
const status = mqttClient.getStatus()
console.log('MQTT 状态:', status)
// 输出: { isConnected: true, config: {...}, reconnectAttempts: 0 }

// 如果未连接，手动初始化
if (!status.isConnected) {
  await mqttClient.init({
    userName: 'your_username',
    userId: 'your_userid',
    mqttKey: 'your_mqtt_key' // 可选，不传会自动调用 initDevice
  })
}
```

---

## 发送和接收消息

### 接收消息

#### 方法 1：全局消息处理器

在 `src/plugins/mqtt.js` 中已经注册：

```javascript
mqttClient.onMessage((topic, messageData) => {
  console.log('收到消息:', { topic, messageData })
  
  // 在这里处理消息
  // 例如：更新 Vuex 状态、显示通知等
})
```

#### 方法 2：在组件中监听

```vue
<script setup>
import { onMounted, onUnmounted } from 'vue'
import { mqttClient } from '@/utils/mqttClient'

// 消息处理函数
const handleMessage = (topic, messageData) => {
  console.log('组件收到消息:', topic, messageData)
  
  // 处理不同类型的消息
  if (messageData.type === 501) {
    // 处理推送通知
    ElNotification({
      title: '推送通知',
      message: messageData.content
    })
  }
}

onMounted(() => {
  // 注册消息处理器
  mqttClient.onMessage(handleMessage)
})

onUnmounted(() => {
  // 移除消息处理器
  mqttClient.offMessage(handleMessage)
})
</script>
```

### 发送消息

```javascript
import { mqttClient } from '@/utils/mqttClient'

// 发送消息
const sendMessage = () => {
  const topic = '/a1DLcjz8jcG/jExC3NUNZK70BuVx3uTP/user/update'
  const message = {
    type: 'update',
    data: {
      status: 'active',
      timestamp: Date.now()
    }
  }
  
  mqttClient.publish(topic, message)
}
```

### 消息加密

系统自动处理消息加密/解密：

- **接收**：自动使用 AES 解密
- **发送**：如果需要加密，使用 `encryptAES` 函数

```javascript
import { encryptAES, DEVICE_CONFIG } from '@/api/device/mqtt'

const encryptedMessage = encryptAES(
  DEVICE_CONFIG.DEVICE_KEY,
  JSON.stringify(messageData)
)

mqttClient.publish(topic, encryptedMessage)
```

---

## URL 转换规则

### 你的配置

从后端获取的配置：
```json
{
  "url": "tcp://8.130.48.231"  // ⚠️ 缺少端口号
}
```

### 自动转换逻辑

系统会自动将 URL 转换为浏览器可用的 WebSocket 格式：

| 原始 URL | 转换后 URL | 说明 |
|---------|----------|------|
| `tcp://8.130.48.231` | `ws://8.130.48.231:8083/mqtt` | 添加默认端口和路径 |
| `tcp://8.130.48.231:1883` | `ws://8.130.48.231:1883/mqtt` | 保留原端口 |
| `mqtt://host:1883` | `ws://host:1883/mqtt` | 转换协议 |
| `ws://host:8083/mqtt` | `ws://host:8083/mqtt` | 保持不变 |

### 默认配置

- **默认 WebSocket 端口**: `8083` (EMQX)
- **默认路径**: `/mqtt`
- **Electron 环境 TCP 端口**: `1883`

### 自定义端口

如果你的 MQTT 服务器使用不同的端口，有两种方式：

#### 方式 1：后端返回完整 URL（推荐）

后端直接返回：
```json
{
  "url": "ws://8.130.48.231:8084/mqtt"
}
```

#### 方式 2：修改前端默认端口

修改 `src/utils/mqttClient.js`：

```javascript
if (!hasPort) {
  // 修改默认端口
  wsUrl = wsUrl + ':8084'  // 改为你的端口
}
```

---

## 常见问题

### Q1: WebSocket 连接失败

**错误信息：**
```
WebSocket connection failed: Unexpected response code: 200
```

**原因：** 端口或路径不正确

**解决方案：**

1. **检查 MQTT 服务器配置**
   ```bash
   # EMQX 默认端口
   WebSocket: 8083
   WebSocket SSL: 8084
   
   # Mosquitto 默认端口
   WebSocket: 9001
   ```

2. **测试服务器端口**
   ```bash
   # 使用 telnet 测试端口是否开放
   telnet 8.130.48.231 8083
   ```

3. **检查防火墙**
   - 确保服务器防火墙允许 WebSocket 端口访问
   - 确保云服务器安全组开放了相应端口

### Q2: 连接成功但收不到消息

**检查订阅主题：**

```javascript
// 当前订阅的主题
const { subscribe } = mqttStore.getConfig

console.log('订阅主题:', subscribe)
// 输出: /a1DLcjz8jcG/jExC3NUNZK70BuVx3uTP/user/get

// 系统会自动订阅：
// 1. subscribe/#  (所有子主题)
// 2. subscribe    (主题本身)
```

**测试发送消息：**

使用 MQTT 客户端工具（如 MQTT.fx、MQTTX）发送测试消息到你的订阅主题。

### Q3: 消息是乱码

**原因：** 消息可能是 AES 加密的

**解决：** 系统已自动处理解密，如果还是乱码：

```javascript
import { decryptAES, DEVICE_CONFIG } from '@/api/device/mqtt'

// 手动解密
const decrypted = decryptAES(DEVICE_CONFIG.DEVICE_KEY, encryptedMessage)
console.log('解密后:', decrypted)
```

### Q4: 在 Electron 中连接失败

**Electron 支持原生 TCP 连接：**

后端应该为 Electron 返回：
```json
{
  "url": "tcp://8.130.48.231:1883"  // 完整的 TCP URL
}
```

或使用 MQTT 协议：
```json
{
  "url": "mqtt://8.130.48.231:1883"
}
```

### Q5: 如何断开连接

```javascript
import { mqttClient } from '@/utils/mqttClient'

// 断开连接
mqttClient.disconnect()
```

### Q6: 重连机制

系统已实现自动重连：

- **重连间隔**：从配置中获取（`interval`，单位：秒）
- **最大重连次数**：10 次
- **超过最大次数**：停止重连，显示错误通知

---

## 配置说明

### 完整的 MQTT 配置

```javascript
{
  url: "tcp://8.130.48.231",           // MQTT 服务器地址
  userName: "user&deviceId",           // 连接用户名
  pwd: "c212ea179ee64f01...",          // 连接密码
  clientId: "1d47a354...",             // 客户端 ID
  interval: 3600,                       // 重连间隔（秒）
  rcNum: 10,                           // 最大重连次数
  publish: "/path/to/pub",             // 发送主题前缀
  subscribe: "/path/to/sub",           // 订阅主题前缀
  pucsSN: "SN12345",                   // 设备序列号
  t: 1761287385                        // 时间戳
}
```

---

## 调试技巧

### 1. 开启详细日志

所有 MQTT 相关日志都以 `[MQTT]` 开头，在控制台过滤：

```
[MQTT]
```

### 2. 检查连接状态

```javascript
import useMqttStore from '@/store/modules/mqtt'

const mqttStore = useMqttStore()

console.log('配置:', mqttStore.getConfig)
console.log('连接状态:', mqttStore.getConnectionStatus)
console.log('设备信息:', mqttStore.getDeviceInfo)
```

### 3. 监控网络请求

在浏览器开发者工具 → Network 标签：
- 过滤 `WS`（WebSocket）
- 查看 WebSocket 帧数据

### 4. 使用 MQTT 测试工具

推荐工具：
- **MQTTX**：https://mqttx.app/
- **MQTT.fx**：https://mqttfx.jensd.de/
- **在线工具**：http://www.emqx.io/online-mqtt-client

使用相同的配置连接，测试消息收发。

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/api/device/mqtt.js` | MQTT API 接口、签名函数 |
| `src/utils/mqttClient.js` | MQTT 客户端封装 |
| `src/plugins/mqtt.js` | MQTT 全局插件 |
| `src/store/modules/mqtt.js` | MQTT 状态管理 |
| `src/views/device/mqtt/index.vue` | MQTT 测试页面 |
| `src/utils/mqttMessageTypes.js` | 消息类型定义 |

---

## 下一步

1. **刷新页面**，查看自动连接日志
2. 如果连接失败，检查 URL 转换日志，确认端口是否正确
3. 使用 MQTT 测试工具发送消息，验证订阅是否正常
4. 根据业务需求，在 `src/plugins/mqtt.js` 中添加消息处理逻辑

祝你使用愉快！🎉














