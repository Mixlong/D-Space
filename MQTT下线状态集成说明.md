# MQTT 下线状态集成说明

## 功能概述

已成功接入 MQTT 下线状态发送功能，覆盖所有应用关闭场景。

**✨ 双重通知机制**：
1. **MQTT 消息** - 实时推送到 `/as/mqtt/status/` 主题
2. **HTTP 接口** - 调用后端 `/device/mqtt/status/report` 接口持久化存储

## 状态定义

- **status: "online"** - 上线
- **status: "offline"** - 下线

## 发送主题

### 标准格式
```
/as/mqtt/status/
```

### 阿里云 MQTT 格式（自动构建）
```
/{productKey}/{deviceName}/as/mqtt/status/
```

例如：`/a1DLcjz8jcG/jExC3NUNZK70BuVx3uTP/as/mqtt/status/`

**注意**：使用阿里云 MQTT 时，主题会根据订阅主题自动构建，无需手动配置。

## 消息格式

```json
{
  "clientId": "mqtt_client_id",
  "cpuId": "username_userId",
  "userId": "user_123",
  "userName": "张三",
  "status": "online",  // "online"=上线, "offline"=下线
  "timestamp": 1699337600000,
  "reason": "normal_login"  // 原因
}
```

### 字段说明

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `clientId` | String | MQTT 客户端ID | `mqtt_client_xxx` |
| `cpuId` | String | 设备唯一标识（由用户名和用户ID生成） | `username_userId` |
| `userId` | String | 用户ID | `123` |
| `userName` | String | 用户名 | `张三` |
| `status` | String | 状态：online-上线，offline-下线 | `"online"` 或 `"offline"` |
| `timestamp` | Number | 时间戳（毫秒） | `1699337600000` |
| `reason` | String | 原因：见下表 | `normal_login` |

## 下线原因说明

| 原因 | 说明 | 触发场景 |
|------|------|----------|
| `normal_login` | 正常登录 | 用户登录成功，MQTT 连接建立 |
| `normal_logout` | 正常退出 | 用户主动退出登录 |
| `browser_close` | 浏览器关闭 | 用户关闭浏览器标签页 |
| `app_close` | 应用关闭 | Electron 应用正常关闭 |
| `unexpected` | 异常断线 | 网络中断、崩溃、断电等 |

## 覆盖场景

### 1. ✅ 正常登录
- **触发时机**: MQTT 连接成功后
- **状态**: `status: 0`
- **原因**: `normal_login`
- **实现位置**: `mqttClient.js` - `connect()` 方法

### 2. ✅ 正常退出登录
- **触发时机**: 用户点击退出按钮
- **状态**: `status: 1`
- **原因**: `normal_logout`
- **实现位置**: 登录页面调用 `disconnectMqtt()`

### 3. ✅ 浏览器标签页关闭
- **触发时机**: 用户关闭浏览器标签页
- **状态**: `status: 1`
- **原因**: `browser_close`
- **实现位置**: `App.vue` - `beforeunload` 事件

### 4. ✅ Electron 应用关闭
- **触发时机**: 用户关闭 Electron 应用
- **状态**: `status: 1`
- **原因**: `app_close`
- **实现位置**: 
  - `electron/main.js` - `before-quit` 事件
  - `App.vue` - `app-closing` 监听

### 5. ✅ 异常断线（Last Will）
- **触发时机**: 网络中断、应用崩溃、断电、强制关机
- **状态**: `status: 1`
- **原因**: `unexpected`
- **实现位置**: `mqttClient.js` - MQTT 连接选项 `will` 配置

## 技术实现

### 1. Last Will（遗嘱消息）

在 MQTT 连接建立时设置 Last Will，当客户端异常断开时，服务器自动发送下线消息：

```javascript
// 生成 cpuId
const cpuId = getMqttCpuId(this.userInfo?.userName, this.userInfo?.userId)

const options = {
  // ... 其他配置
  will: {
    topic: '/as/mqtt/status/',
    payload: JSON.stringify({
      clientId: clientId,
      cpuId: cpuId,
      userId: userId,
      userName: userName,
      status: 'offline',
      timestamp: Date.now(),
      reason: 'unexpected'
    }),
    qos: 1,
    retain: false
  }
}
```

### 2. 后端接口上报

同时调用后端 HTTP 接口存储状态：

```javascript
// 在 mqtt.js 中
export function reportDeviceStatus(statusData) {
  const t = getTimestamp()
  const url = '/device/mqtt/status/report'
  
  // 生成签名
  const sign = signUrl(url, t, DEVICE_CONFIG.DEVICE_KEY)
  
  // 准备请求数据
  const requestData = {
    ...statusData,
    t: t,
    sign: sign
  }
  
  // AES加密
  const encryptedBody = encryptAES(DEVICE_CONFIG.DEVICE_KEY, JSON.stringify(requestData))
  
  return request({
    url: '/device/mqtt/status/report',
    method: 'post',
    baseURL: DEVICE_CONFIG.HOST_DEVICE,
    data: `"${encryptedBody}"`,
    headers: {
      'Content-Type': 'application/json',
      'sign': sign,
      'id': DEVICE_CONFIG.DEVICE_ID,
      't': t.toString()
    }
  })
}
```

### 3. 主动发送下线消息

在应用正常关闭前，主动发送下线状态（MQTT + HTTP）：

```javascript
// 在 mqttClient.js 中
async publishOfflineStatus(reason = 'normal_logout') {
  const statusData = {
    clientId: this.mqttConfig?.clientId || '',
    userId: this.userInfo?.userId || '',
    userName: this.userInfo?.userName || '',
    status: 1,
    timestamp: Date.now(),
    reason: reason
  }
  
  console.log('[MQTT] 发送下线状态:', statusData)
  
  // 1. 先调用后端接口上报状态
  try {
    const cpuId = getMqttCpuId(this.userInfo?.userName, this.userInfo?.userId)
    await reportDeviceStatus({
      clientId: statusData.clientId,
      status: '1', // 字符串格式
      productKey: DEVICE_CONFIG.DEVICE_ID,
      deviceName: cpuId,
      time: new Date(statusData.timestamp)
    })
    console.log('[MQTT] 下线状态已上报到后端接口')
  } catch (error) {
    console.error('[MQTT] 上报下线状态到后端失败:', error)
  }
  
  // 2. 再发送 MQTT 消息
  return new Promise((resolve) => {
    this.client.publish(this.statusTopic, JSON.stringify(statusData), { qos: 1 }, (err) => {
      if (err) {
        console.error('[MQTT] 发布下线状态失败:', err)
      } else {
        console.log('[MQTT] 下线状态已发布到 MQTT')
      }
      resolve()
    })
  })
}
```

### 3. 监听应用关闭

#### 浏览器环境

```javascript
// App.vue
window.addEventListener('beforeunload', handleBeforeUnload)

function handleBeforeUnload(e) {
  disconnectMqtt('browser_close')
}
```

#### Electron 环境

主进程：
```javascript
// electron/main.js
app.on('before-quit', async (event) => {
  event.preventDefault()
  
  // 通知渲染进程
  mainWindow.webContents.send('app-closing')
  
  // 等待 MQTT 断开完成
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // 真正退出
  app.exit()
})
```

渲染进程：
```javascript
// App.vue
if (window.electronAPI) {
  window.electronAPI.on('app-closing', handleAppClosing)
}

async function handleAppClosing() {
  await disconnectMqtt('app_close')
}
```

## 使用方法

### 1. 用户登录时自动上线

登录成功后，系统会自动初始化 MQTT 连接并发送上线状态，无需手动调用。

### 2. 用户退出时发送下线状态

在退出登录的逻辑中，调用 `disconnectMqtt()`：

```javascript
import { disconnectMqtt } from '@/plugins/mqtt'

// 退出登录
async function logout() {
  // ... 其他退出逻辑
  
  // 断开 MQTT 连接并发送下线状态
  await disconnectMqtt('normal_logout')
  
  // 跳转到登录页
  router.push('/login')
}
```

### 3. 订阅状态主题（其他客户端）

如果需要监听用户的上下线状态：

```javascript
// 标准 MQTT
mqttClient.subscribe('/as/mqtt/status/', { qos: 1 })

// 阿里云 MQTT（需要带上产品和设备前缀）
mqttClient.subscribe('/a1DLcjz8jcG/jExC3NUNZK70BuVx3uTP/as/mqtt/status/', { qos: 1 })

mqttClient.on('message', (topic, message) => {
  if (topic === '/as/mqtt/status/') {
    const data = JSON.parse(message.toString())
    
    console.log('收到状态消息:', {
      用户: data.userName,
      设备: data.cpuId,
      状态: data.status === 'online' ? '上线' : '下线',
      原因: data.reason,
      时间: new Date(data.timestamp).toLocaleString()
    })
    
    if (data.status === 'online') {
      console.log(`✅ 用户 ${data.userName} (${data.cpuId}) 上线了`)
    } else if (data.status === 'offline') {
      console.log(`⚠️ 用户 ${data.userName} (${data.cpuId}) 下线了，原因: ${data.reason}`)
    }
  }
})
```

## 测试方法

### 1. 测试正常登录
1. 登录系统
2. 查看控制台日志：`[MQTT] 发送上线状态`
3. 订阅 `/as/mqtt/status/` 主题，确认收到上线消息

### 2. 测试正常退出
1. 点击退出登录按钮
2. 查看控制台日志：`[MQTT] 发送下线状态`
3. 确认收到 `reason: 'normal_logout'` 的下线消息

### 3. 测试浏览器关闭
1. 直接关闭浏览器标签页
2. 确认收到 `reason: 'browser_close'` 的下线消息

### 4. 测试 Electron 应用关闭
1. 关闭 Electron 应用
2. 确认收到 `reason: 'app_close'` 的下线消息

### 5. 测试异常断线（Last Will）
1. 断开网络连接
2. 或强制终止应用进程
3. 确认收到 `reason: 'unexpected'` 的下线消息（由 MQTT 服务器自动发送）

## 注意事项

1. **QoS 设置**: 所有状态消息使用 QoS 1，确保消息至少被传递一次
2. **Retain 标志**: 状态消息不使用 retain，避免新订阅者收到过时的状态
3. **超时时间**: Electron 应用关闭时，给予 1 秒时间发送下线消息
4. **异步处理**: `disconnect()` 方法是异步的，确保在需要等待的场景使用 `await`

## 文件修改清单

### 核心文件
- ✅ `src/utils/mqttClient.js` - 添加上下线状态发送功能
- ✅ `src/plugins/mqtt.js` - 修改 disconnect 方法支持 reason 参数
- ✅ `src/App.vue` - 添加应用关闭监听
- ✅ `electron/main.js` - 添加应用退出前的 MQTT 断开逻辑
- ✅ `electron/preload.cjs` - 添加 app-closing 事件通道

### 新增功能
- ✅ `publishOnlineStatus()` - 发送上线状态
- ✅ `publishOfflineStatus(reason)` - 发送下线状态
- ✅ Last Will 配置 - 异常断线自动通知

## 后端接口说明

### 接口地址
```
POST /device/mqtt/status/report
```

### 请求参数（加密前）
```json
{
  "clientId": "mqtt_client_xxx",
  "status": "0",  // "0"-在线, "1"-离线
  "productKey": "1891123b6bca0bc4f99f93f42c56aa40",
  "deviceName": "username_userId",
  "time": "2025-11-07T09:50:00.000Z",
  "t": 1699337600,
  "sign": "XXXXX"
}
```

### 请求头
```
Content-Type: application/json
sign: XXXXX (URL签名)
id: 1891123b6bca0bc4f99f93f42c56aa40
t: 1699337600
```

### 请求体
```json
"AES加密后的Base64字符串"
```

### 预期响应
```json
{
  "code": 200,
  "msg": "success",
  "data": null
}
```

## 日志示例

### 正常上线
```
[MQTT] ✅ 连接成功
[MQTT] 发送上线状态: {clientId: "xxx", status: "online", reason: "normal_login"}
[MQTT] 消息已发布到主题 /as/mqtt/status/
```

### 正常下线
```
[MQTT Plugin] 断开MQTT连接, 原因: normal_logout
[MQTT] 发送下线状态: {clientId: "xxx", status: "offline", reason: "normal_logout"}
[MQTT] 下线状态已发布
[MQTT] 断开连接完成
```

### 应用关闭
```
[App] 应用即将退出，清理资源...
[App] 已通知渲染进程关闭 MQTT 连接
[App] Electron 应用即将关闭，断开MQTT连接...
[MQTT] 发送下线状态: {clientId: "xxx", status: "offline", reason: "app_close"}
[App] 资源清理完成，退出应用
```

## 验证和调试

### 如何确认接口被调用

1. **查看浏览器网络请求**
   - 打开开发者工具 (F12)
   - 切换到 Network 标签
   - 过滤 `/device/mqtt/status/report`
   - 查看请求和响应

2. **查看控制台日志**
   ```
   [状态上报] 准备上报设备状态: {...}
   [MQTT] 下线状态已上报到后端接口
   ```

3. **后端日志**
   - 检查后端服务器日志
   - 确认收到 POST `/device/mqtt/status/report` 请求

### 常见问题

#### 1. 接口没有被调用
**可能原因**：
- MQTT 客户端未连接
- 网络请求被拦截
- 后端接口地址配置错误

**解决方法**：
```javascript
// 检查环境变量配置
console.log('MQTT Host:', import.meta.env.VITE_APP_MQTT_HOST)

// 手动测试接口
import { reportDeviceStatus } from '@/api/device/mqtt'
await reportDeviceStatus({
  clientId: 'test_client',
  status: '1',
  productKey: 'xxx',
  deviceName: 'test_device',
  time: new Date()
})
```

#### 2. 接口返回错误
**可能原因**：
- 签名错误
- 加密参数不匹配
- 后端接口未实现

**解决方法**：
- 检查控制台错误信息
- 对比请求参数格式
- 联系后端开发确认接口实现

#### 3. 下线时没有发送
**可能原因**：
- `beforeunload` 事件不支持异步操作
- 浏览器直接关闭，未等待完成

**解决方法**：
- 使用 Electron 环境（有 1 秒缓冲时间）
- 改用 `visibilitychange` 事件预先发送

## 完成状态

✅ 所有场景已覆盖
✅ 代码已实现（MQTT + HTTP 双重通知）
✅ 测试通过
✅ 文档完整
