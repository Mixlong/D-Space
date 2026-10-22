# MQTT 签名调试工具

## 🔍 签名异常原因分析

根据你的错误信息：
```json
{
    "status": 500,
    "message": "sign异常",
    "path": "/device/emqx/mqtt/config"
}
```

### 问题根源

从 `未命名文件夹` 的后端代码分析，有**两个独立的签名**：

#### 1️⃣ 请求头签名（拦截器验证）
- **位置**: HTTP Header 中的 `sign` 字段
- **用途**: 拦截器验证请求合法性
- **格式**: `url=/device/xxx||t=时间戳||key=设备密钥`
- **算法**: `MD5(MD5(msg).substring(8, 16))`
- **对应方法**: `Encryptor.sign(url)`

#### 2️⃣ 请求体签名（业务逻辑）
- **位置**: 加密后的请求体 JSON 中的 `sign` 字段
- **用途**: 业务逻辑验证
- **格式**: `cpuId=xxx||sn=xxx||t=时间戳||key=mqttKey`
- **算法**: `MD5(MD5(msg).substring(0, 8))` ⚠️ **注意：取前8位**
- **对应方法**: `signMqttConfig(cpuId, t, sn, mqttKey)`

---

## ✅ 正确的调用流程

### 步骤 1: 设备初始化（获取 mqttKey）

```javascript
import { initDevice } from '@/api/device/mqtt'

const deviceData = {
  cpuId: 'test_user_123',
  equipType: 1,              // 1-pucs, 2-ssts, 3-sts, 4-esop, 5-sop
  pucsType: 'PUCS-V1',
  sn: 'SN123456789',
  sysVersion: '1.0.0'
}

const res = await initDevice(deviceData)
// 返回: { code: 200, data: { key: "xxx", t: 1234567890 } }
const mqttKey = res.data.key  // ⭐ 保存这个key用于后续请求
```

### 步骤 2: 获取 MQTT 配置（使用 mqttKey）

```javascript
import { getMqttConfig } from '@/api/device/mqtt'

const res = await getMqttConfig(
  deviceData.cpuId,
  deviceData.sn,
  mqttKey  // ⚠️ 必须传递从初始化接口获取的 mqttKey
)
```

---

## 🛠️ 手动验证签名（调试用）

### 测试代码

在浏览器控制台运行以下代码来验证签名生成：

```javascript
import CryptoJS from 'crypto-js'

// === 配置参数 ===
const DEVICE_KEY = '21LBF00rz4GXg2XQINsETw=='
const DEVICE_ID = '1891123b6bca0bc4f99f93f42c56aa40'
const url = '/device/emqx/mqtt/config'
const cpuId = 'test_user_123'
const sn = 'SN123456789'
const t = Math.floor(Date.now() / 1000)  // 当前时间戳（秒）

console.log('=== 签名测试开始 ===')
console.log('时间戳:', t)
console.log('URL路径:', url)
console.log('cpuId:', cpuId)
console.log('sn:', sn)
console.log('DEVICE_KEY:', DEVICE_KEY)

// === 1. 测试请求头签名（URL签名） ===
const headerMsg = `url=${url}||t=${t}||key=${DEVICE_KEY}`
console.log('\n[请求头签名]')
console.log('原始字符串:', headerMsg)

const headerMd5First = CryptoJS.MD5(headerMsg).toString().toUpperCase()
console.log('第一次MD5:', headerMd5First)

const headerSubstring = headerMd5First.substring(8, 16)
console.log('截取8-16位:', headerSubstring)

const headerSign = CryptoJS.MD5(headerSubstring).toString().toUpperCase()
console.log('最终签名:', headerSign)

// === 2. 测试请求体签名（设备注册签名）===
const bodyMsg = `cpuId=${cpuId}||sn=${sn}||t=${t}`
console.log('\n[请求体签名 - 无mqttKey]')
console.log('原始字符串:', bodyMsg)

const bodyMd5First = CryptoJS.MD5(bodyMsg).toString().toUpperCase()
console.log('第一次MD5:', bodyMd5First)

const bodySubstring = bodyMd5First.substring(8, 16)
console.log('截取8-16位:', bodySubstring)

const bodySign = CryptoJS.MD5(bodySubstring).toString().toUpperCase()
console.log('最终签名:', bodySign)

// === 3. 测试MQTT配置签名（有mqttKey）===
const mqttKey = 'YOUR_MQTT_KEY_HERE'  // 从 initDevice 接口获取
const mqttMsg = `cpuId=${cpuId}||sn=${sn}||t=${t}||key=${mqttKey}`
console.log('\n[请求体签名 - 有mqttKey]')
console.log('原始字符串:', mqttMsg)

const mqttMd5First = CryptoJS.MD5(mqttMsg).toString().toUpperCase()
console.log('第一次MD5:', mqttMd5First)

const mqttSubstring = mqttMd5First.substring(0, 8)  // ⚠️ 注意：这里是0-8位！
console.log('截取0-8位:', mqttSubstring)

const mqttSign = CryptoJS.MD5(mqttSubstring).toString().toUpperCase()
console.log('最终签名:', mqttSign)

console.log('\n=== 签名测试结束 ===')
```

---

## 🔧 常见问题排查

### 问题 1: 时间戳不同步

**症状**: sign异常
**原因**: 客户端和服务器时间差异过大
**解决**: 
```javascript
// 检查本地时间是否准确
console.log('当前时间戳:', Math.floor(Date.now() / 1000))
console.log('当前时间:', new Date().toLocaleString())
```

### 问题 2: 路径不匹配

**症状**: sign异常
**原因**: 签名使用的路径和实际请求路径不一致
**检查**:
- 前端使用: `/device/emqx/mqtt/config`
- 请求的完整URL应该是: `http://test-pucs.riding-evolved.com/device/emqx/mqtt/config`
- 签名只使用路径部分，不包含域名

### 问题 3: 缺少 mqttKey

**症状**: sign异常（服务器无法验证）
**原因**: 直接调用 `getMqttConfig` 而没有先初始化设备
**解决**: 按照正确流程，先调用 `initDevice` 获取 mqttKey

### 问题 4: AES 加密格式错误

**症状**: 服务器无法解密请求体
**检查**:
```javascript
// 正确的加密格式
const encryptedBody = encryptAES(DEVICE_KEY, JSON.stringify(requestData))
const data = `"${encryptedBody}"`  // ⚠️ 注意：要用双引号包裹
```

---

## 📋 完整请求示例

### 请求头 (Headers)
```
Content-Type: application/json
sign: 3A2F8B4C9D1E6A7F  // 使用 signUrl(url, t, DEVICE_KEY) 生成
id: 1891123b6bca0bc4f99f93f42c56aa40
t: 1729751336
```

### 请求体 (Body)
```json
"U2FsdGVkX1+abc123...encryptedData..."  // 注意：是字符串，要有双引号
```

### 解密后的请求体内容
```json
{
  "cpuId": "test_user_123",
  "sign": "7B8E3F2A9C4D1B6E",  // 使用 signRegisterDevice 或 signMqttConfig 生成
  "t": 1729751336
}
```

---

## 🎯 快速修复方案

### 方案 1: 确保使用正确的流程

修改 `src/views/device/mqtt/index.vue`:

```javascript
// ✅ 正确的流程
async function handleGetMqttConfig() {
  // 1. 检查是否有 mqttKey
  const mqttKey = deviceInfo.value?.key
  if (!mqttKey) {
    ElMessage.warning('请先完成设备初始化')
    return
  }
  
  // 2. 使用 mqttKey 获取配置
  const res = await getMqttConfig(cpuId, sn, mqttKey)
}
```

### 方案 2: 添加详细的调试日志

已在 `src/api/device/mqtt.js` 中添加，检查控制台输出：

```javascript
console.log('[MQTT API] 准备获取MQTT配置')
console.log('[MQTT API] cpuId:', cpuId)
console.log('[MQTT API] sn:', sn)
console.log('[MQTT API] t:', t)
console.log('[MQTT API] mqttKey:', mqttKey)
console.log('[MQTT API] 请求头签名:', headerSign)
console.log('[MQTT API] 请求体签名:', bodySign)
```

### 方案 3: 临时测试（跳过签名验证）

如果有后端权限，可以临时在 `EncryptInterceptor.kt` 中添加白名单：

```kotlin
private fun isWhitePath(path: String): Boolean {
    return path.contains("test/network/now") ||
           path.contains("/device/emqx/mqtt/config")  // 临时添加
}
```

---

## 📞 参考文件位置

- **前端API**: `/src/api/device/mqtt.js`
- **前端页面**: `/src/views/device/mqtt/index.vue`
- **后端签名逻辑**: `/未命名文件夹/Encryptor.kt`
- **后端拦截器**: `/未命名文件夹/EncryptInterceptor.kt`
- **后端AES工具**: `/未命名文件夹/AESUtil.java`
- **后端常量配置**: `/未命名文件夹/ValueConst.kt`

---

## ⚡ 下一步行动

1. **检查控制台日志**: 查看生成的签名值
2. **确认初始化流程**: 先调用 `initDevice` 获取 `mqttKey`
3. **验证时间戳**: 确保客户端时间准确
4. **对比签名**: 使用上面的测试代码手动计算签名，与实际发送的对比
5. **联系后端**: 如果前端签名正确，可能是后端验证逻辑问题













