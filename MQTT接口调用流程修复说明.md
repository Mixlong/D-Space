# MQTT 接口调用流程修复说明

## 问题描述

之前的代码存在以下问题：
1. `/device/mqtt/init` 接口的请求头签名配置不正确
2. `/device/emqx/mqtt/config` 接口允许在没有 `mqttKey` 的情况下调用（错误的后备逻辑）
3. 自动初始化流程中，直接调用 `getMqttConfig` 但没有先获取 `mqttKey`

## 正确的调用流程

### 第一步：设备初始化 `POST /device/mqtt/init`

**作用：** 向服务器注册设备，获取加密密钥（mqttKey）

**请求参数：**
```javascript
{
  cpuId: "用户名_用户ID",
  equipType: 1,           // 设备类型：1-PUCS, 2-SSTS, 3-STS, 4-ESOP, 5-SOP
  pucsType: "PUCS-V1",   // 设备类型名称
  sn: "用户名_用户ID",    // ⚠️ 必须与 cpuId 相同
  sysVersion: "1.0.0"    // 系统版本
}
```

**返回数据：**
```javascript
{
  code: 200,
  data: {
    key: "1269571569321021",  // ← 这个 key 就是后续需要的 mqttKey
    t: 1729742123
  }
}
```

**签名策略：**
- **请求头签名**：`signUrl(url, t, DEVICE_KEY)` - 用于拦截器验证
- **请求体签名**：`signRegisterDevice(cpuId, t, sn)` - 用于业务逻辑

### 第二步：获取 MQTT 配置 `POST /device/emqx/mqtt/config`

**作用：** 获取 MQTT 连接配置（URL、用户名、密码等）

**前置条件：** ⚠️ **必须先执行第一步，获取 mqttKey**

**请求参数：**
```javascript
{
  cpuId: "用户名_用户ID",
  sign: "签名",           // 使用 mqttKey 生成的签名
  t: 1729742123
}
```

**返回数据：**
```javascript
{
  code: 200,
  data: {
    url: "ws://mqtt.example.com:8083/mqtt",
    userName: "mqtt_user",
    pwd: "mqtt_password",
    clientId: "client_12345",
    pucsSN: "SN12345",
    interval: 5,           // 重连间隔（秒）
    rcNum: 10,            // 最大重连次数
    publish: "topic/pub/", // 发送主题头
    subscribe: "topic/sub/" // 订阅主题头
  }
}
```

**签名策略：**
- **请求头签名**：`signUrl(url, t, DEVICE_KEY)` - 用于拦截器验证
- **请求体签名**：`signMqttConfig(cpuId, t, sn, mqttKey)` - **必须使用第一步返回的 mqttKey**

## 修复内容

### 1. 修复 `initDevice` 函数签名配置

**文件：** `src/api/device/mqtt.js`

**修改前：**
```javascript
export function initDevice(deviceInitVO) {
  const t = getTimestamp()
  const sign = signRegisterDevice(cpuId, t, sn)
  
  return request({
    headers: {
      'sign': sign,  // ❌ 错误：直接使用业务签名
      ...
    }
  })
}
```

**修改后：**
```javascript
export function initDevice(deviceInitVO) {
  const t = getTimestamp()
  const url = '/device/mqtt/init'
  
  // 生成两种签名
  const headerSign = signUrl(url, t, DEVICE_CONFIG.DEVICE_KEY)  // 请求头签名
  const bodySign = signRegisterDevice(cpuId, t, sn)             // 请求体签名
  
  return request({
    headers: {
      'sign': headerSign,  // ✅ 正确：使用 URL 签名
      ...
    },
    data: {
      sign: bodySign,      // ✅ 请求体使用业务签名
      ...
    }
  })
}
```

### 2. 强制 `getMqttConfig` 必须传入 `mqttKey`

**文件：** `src/api/device/mqtt.js`

**修改前：**
```javascript
export function getMqttConfig(cpuId, sn, mqttKey = '') {
  // 错误的后备逻辑
  const bodySign = mqttKey 
    ? signMqttConfig(cpuId, t, sn, mqttKey)
    : signRegisterDevice(cpuId, t, sn)  // ❌ 不应该允许这种情况
}
```

**修改后：**
```javascript
export function getMqttConfig(cpuId, sn, mqttKey) {
  // 验证必需参数
  if (!mqttKey) {
    throw new Error('mqttKey是必需参数，请先调用 initDevice 接口获取')
  }
  
  // 必须使用 mqttKey 签名
  const bodySign = signMqttConfig(cpuId, t, sn, mqttKey)  // ✅ 强制使用 mqttKey
}
```

### 3. 修复自动初始化流程

**文件：** `src/utils/mqttClient.js`

**修改前：**
```javascript
async init(userInfo) {
  const cpuId = getMqttCpuId(userInfo.userName, userInfo.userId)
  
  // 只有 needInit=true 时才初始化
  if (userInfo.needInit) {
    await initDevice({ ... })  // ❌ 没有保存返回的 key
  }
  
  const mqttKey = userInfo.mqttKey || ''  // ❌ mqttKey 为空
  const res = await getMqttConfig(cpuId, sn, mqttKey)  // ❌ 会抛错
}
```

**修改后：**
```javascript
async init(userInfo) {
  const cpuId = getMqttCpuId(userInfo.userName, userInfo.userId)
  const sn = cpuId
  
  let mqttKey = userInfo.mqttKey || ''
  
  // 如果没有 mqttKey，必须先初始化设备
  if (!mqttKey) {
    const initRes = await initDevice({ ... })
    
    if (initRes.code === 200 && initRes.data?.key) {
      mqttKey = initRes.data.key  // ✅ 保存返回的 key
    } else {
      throw new Error('设备初始化失败，无法获取 mqttKey')
    }
  }
  
  // 现在有 mqttKey 了，可以获取配置
  const res = await getMqttConfig(cpuId, sn, mqttKey)  // ✅ 正确
}
```

### 4. 更新插件调用方式

**文件：** `src/plugins/mqtt.js`

**修改后：**
```javascript
export async function initMqtt() {
  const userInfo = {
    userName: userStore.name,
    userId: userStore.id
    // 不传 mqttKey，让 mqttClient.init 自动调用 initDevice 获取
  }
  
  // 会自动先调用 initDevice，再调用 getMqttConfig
  await mqttClient.init(userInfo)
}
```

## 关键点总结

### ✅ 必须遵守的规则

1. **调用顺序**：必须先调用 `initDevice`，再调用 `getMqttConfig`
2. **mqttKey 必须**：`getMqttConfig` 必须使用 `initDevice` 返回的 `key` 来签名
3. **sn = cpuId**：设备序列号必须和 CPU ID 相同
4. **双签名机制**：
   - 请求头使用 `signUrl(url, t, DEVICE_KEY)`
   - 请求体使用具体的业务签名函数

### ❌ 常见错误

1. 直接调用 `getMqttConfig` 而没有先获取 `mqttKey`
2. 使用错误的签名放在请求头
3. 请求体中的 `sn` 与 `cpuId` 不一致
4. `initDevice` 没有保存返回的 `key`

## 额外修复：WebSocket URL 转换

### 问题
后端返回的 MQTT URL 格式为 `tcp://host:port`，但浏览器环境只支持 WebSocket 协议。

### 解决方案
添加了 `convertToWebSocketUrl()` 方法，自动转换 URL：

```javascript
// 转换规则
tcp://8.130.48.231      → ws://8.130.48.231:8083/mqtt
mqtt://8.130.48.231     → ws://8.130.48.231:8083/mqtt
ws://8.130.48.231:8083  → ws://8.130.48.231:8083 (不变)
```

**注意：**
- 默认 WebSocket 端口：`8083`
- 默认路径：`/mqtt`
- 在 Electron 环境中可以使用原生 TCP 连接
- 如果服务器配置不同，需要后端返回完整的 WebSocket URL

## 测试建议

1. 打开浏览器控制台，查看完整的调用日志
2. 确认先看到 `[设备初始化]` 的日志
3. 确认获取到 `mqttKey`
4. 再看到 `[MQTT API]` 获取配置的日志
5. 检查两个接口的签名是否正确
6. 检查 URL 转换日志：`[MQTT] URL 转换: tcp://... → ws://...`
7. 确认 WebSocket 连接成功：`[MQTT] 连接成功`

## 常见问题

### Q1: WebSocket 连接失败，提示 "Unexpected response code: 200"

**原因：** 服务器的 WebSocket 端口或路径配置不正确

**解决方案：**
1. 检查后端 MQTT 配置，确保返回正确的 WebSocket URL
2. 推荐后端直接返回 `ws://host:port/path` 格式的 URL
3. 常见的 MQTT WebSocket 端口：
   - EMQX: `8083` (ws) / `8084` (wss)
   - Mosquitto: `9001` (ws)
   - HiveMQ: `8000` (ws)

### Q2: 在 Electron 中连接失败

**解决方案：** Electron 支持原生 TCP 连接，可以使用 `tcp://` 或 `mqtt://` 协议

## 相关文件

- `src/api/device/mqtt.js` - API 接口定义
- `src/utils/mqttClient.js` - MQTT 客户端
- `src/plugins/mqtt.js` - MQTT 插件
- `src/views/device/mqtt/index.vue` - 测试页面

