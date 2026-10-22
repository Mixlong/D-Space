# MQTT 签名失败根本原因分析

## 🔍 问题发现

### 后端代码存在的BUG

#### 问题代码位置

**`EncryptInterceptor.kt` 第 40-48 行：**
```kotlin
val t = Global.getTimeStamp()          // 获取时间戳A
val sign = Encryptor.sign(path)        // 调用签名方法

requestBuilder.addHeader("sign", sign)
requestBuilder.addHeader("id", ValueConst.DEVICE_ID)
requestBuilder.addHeader("t", "$t")    // 发送时间戳A
```

**`Encryptor.kt` 第 11-18 行：**
```kotlin
fun sign(url: String): String {
    val t = Global.getTimeStamp()  // ⚠️ 又获取了时间戳B！
    val key = ValueConst.DEVICE_KEY
    val md5 = MD5.create()
    val msg: String =
        md5.digestHex(md5.digestHex("url=$url||t=$t||key=$key")
            .uppercase(Locale.getDefault())
            .substring(8, 16))
            .uppercase(Locale.getDefault())
    return msg
}
```

### 问题分析

1. **时间戳不一致**：
   - 拦截器获取时间戳A：`val t = Global.getTimeStamp()`
   - 签名方法内部又获取时间戳B：`val t = Global.getTimeStamp()`
   - 如果这两次调用跨秒，A ≠ B

2. **签名验证失败**：
   - 请求头发送：`t = A`，`sign = 基于B计算的签名`
   - 服务器验证：使用 `t = A` 去验证 `sign`
   - 但 `sign` 实际是用 `t = B` 算的
   - **验证失败！** ❌

3. **为什么Android有时能成功**：
   - 如果两次 `getTimeStamp()` 在同一秒内执行
   - 时间戳A = 时间戳B
   - 签名验证通过 ✅

---

## ✅ 解决方案

### 方案1：修复后端代码（推荐）

修改 `Encryptor.kt`，让签名方法接收时间戳参数：

```kotlin
object Encryptor {
    // 修改后：接收时间戳作为参数
    fun sign(url: String, t: Long): String {
        val key = ValueConst.DEVICE_KEY
        val md5 = MD5.create()
        val msg: String =
            md5.digestHex(md5.digestHex("url=$url||t=$t||key=$key")
                .uppercase(Locale.getDefault())
                .substring(8, 16))
                .uppercase(Locale.getDefault())
        return msg
    }
    
    fun signRegisterDevice(cpuId: String, t: Long, sn: String): String {
        val md5 = MD5.create()
        val msg: String =
            md5.digestHex(md5.digestHex("cpuId=$cpuId||sn=$sn||t=$t")
                .uppercase(Locale.getDefault())
                .substring(8, 16))
                .uppercase(Locale.getDefault())
        return msg
    }
    
    fun signMqttConfig(cpuId: String, t: Long, sn: String, mqttKey: String): String {
        val md5 = MD5.create()
        val msg: String =
            md5.digestHex(md5.digestHex("cpuId=$cpuId||sn=$sn||t=$t||key=$mqttKey")
                .uppercase(Locale.getDefault())
                .substring(0, 8))
                .uppercase(Locale.getDefault())
        return msg
    }
}
```

修改 `EncryptInterceptor.kt`：

```kotlin
else if (isDeviceHost(host) && !isWhitePath(path)) {
    val t = Global.getTimeStamp()
    val sign = Encryptor.sign(path, t)  // ⭐ 传入时间戳
    
    val requestBuilder = request.newBuilder()
    requestBuilder.addHeader("sign", sign)
    requestBuilder.addHeader("id", ValueConst.DEVICE_ID)
    requestBuilder.addHeader("t", "$t")
    // ...
}
```

### 方案2：前端适配后端BUG（临时方案）

如果无法修改后端，前端可以尝试：

#### A. 放宽时间戳容差

服务器端验证时，允许时间戳有1-2秒的误差范围。

#### B. 重试机制

```javascript
export async function getMqttConfigWithRetry(cpuId, sn, mqttKey = '', maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await getMqttConfig(cpuId, sn, mqttKey)
      return res
    } catch (error) {
      if (error.message?.includes('sign异常') && i < maxRetries - 1) {
        console.log(`签名失败，第${i + 1}次重试...`)
        await new Promise(resolve => setTimeout(resolve, 100))
        continue
      }
      throw error
    }
  }
}
```

---

## 🧪 验证方法

### 1. 添加详细日志

在后端添加日志：

```kotlin
// EncryptInterceptor.kt
val t1 = Global.getTimeStamp()
println("[拦截器] 时间戳1: $t1")

val sign = Encryptor.sign(path)
println("[拦截器] 生成的签名: $sign")

val t2 = Global.getTimeStamp()
println("[拦截器] 时间戳2: $t2")
println("[拦截器] 时间戳是否相同: ${t1 == t2}")
```

在 `Encryptor.kt` 添加日志：

```kotlin
fun sign(url: String): String {
    val t = Global.getTimeStamp()
    println("[Encryptor.sign] 使用的时间戳: $t")
    val key = ValueConst.DEVICE_KEY
    val msg = "url=$url||t=$t||key=$key"
    println("[Encryptor.sign] 签名原文: $msg")
    // ...
}
```

### 2. 前端验证

在浏览器控制台查看：

```javascript
// 查看请求头
console.log('请求头中的 t:', headers.t)
console.log('请求头中的 sign:', headers.sign)

// 查看请求体（解密前）
console.log('请求体签名使用的 t:', requestData.t)
console.log('请求体中的 sign:', requestData.sign)

// 验证是否一致
console.log('时间戳是否相同:', headers.t === requestData.t.toString())
```

---

## 📊 总结

| 项目 | Android客户端 | 前端 |
|------|--------------|------|
| **签名成功率** | 较高（执行快，不跨秒） | 较低（可能跨秒） |
| **时间戳使用** | 两次获取，可能不一致 | 正确使用同一个时间戳 |
| **问题原因** | 后端代码设计问题 | 后端代码设计问题 |
| **解决方案** | 修复后端代码 | 修复后端代码或添加重试 |

---

## 🎯 推荐行动

### 立即执行：

1. **联系后端开发**，说明时间戳不一致的问题
2. **使用方案1修复后端代码**
3. **添加日志验证**问题是否解决

### 临时方案：

如果无法立即修改后端，前端可以：
- 实现重试机制
- 在请求失败时自动重试2-3次
- 每次重试间隔100ms

---

## 💡 额外发现

查看后端代码，还发现：

1. **请求体也被加密**：整个JSON被AES加密后发送
2. **双重签名机制**：
   - 请求头签名：基于URL路径
   - 请求体签名：基于业务参数
3. **拦截器自动处理**：Android客户端的所有设备接口请求都会被拦截器自动加密和签名

这就是为什么前端需要手动实现这些逻辑的原因。















