# MQTT sign 异常解决方案

## 🚨 问题描述

```json
{
    "timestamp": "2025-10-24T13:48:56.569+0800",
    "status": 500,
    "error": "Internal Server Error",
    "message": "sign异常",
    "path": "/device/emqx/mqtt/config"
}
```

---

## ✅ 解决方案

### 根本原因

你直接调用了 `getMqttConfig`，但**没有先初始化设备获取 mqttKey**。

MQTT配置接口需要使用特殊的签名算法（取前8位），而这需要从设备初始化接口返回的 `mqttKey`。

### 正确的调用流程

#### 第1步：设备初始化
```javascript
import { initDevice } from '@/api/device/mqtt'

const deviceData = {
  cpuId: 'test_user_123',    // 或使用 getMqttCpuId(userName, userId)
  equipType: 1,              // 1-pucs, 2-ssts, 3-sts, 4-esop, 5-sop
  pucsType: 'PUCS-V1',
  sn: 'SN123456789',
  sysVersion: '1.0.0'
}

const initRes = await initDevice(deviceData)
// 返回: { code: 200, data: { key: "mqttKey_xxx", t: 1729751336 } }

// ⚠️ 保存这个 key
const mqttKey = initRes.data.key
```

#### 第2步：获取MQTT配置
```javascript
import { getMqttConfig } from '@/api/device/mqtt'

const mqttRes = await getMqttConfig(
  deviceData.cpuId,
  deviceData.sn,
  mqttKey  // ⭐ 传入第1步获取的 mqttKey
)

// 返回: { code: 200, data: { url, userName, pwd, clientId, ... } }
```

---

## 🎯 快速修复

### 方案1：在页面中添加检查

已修改 `src/views/device/mqtt/index.vue`：

```javascript
const handleGetMqttConfig = async () => {
  // 检查是否已经初始化设备
  const mqttKey = deviceInfo.value?.key
  if (!mqttKey) {
    ElMessage.warning('请先完成设备初始化以获取mqttKey')
    return
  }
  
  // 使用mqttKey获取配置
  const res = await getMqttConfig(
    deviceForm.value.cpuId,
    deviceForm.value.sn,
    mqttKey  // 传递mqttKey
  )
}
```

### 方案2：使用测试工具验证

已创建测试页面：`src/views/device/mqtt/signTest.vue`

在路由中添加：
```javascript
{
  path: '/device/mqtt/test',
  component: () => import('@/views/device/mqtt/signTest.vue'),
  name: 'MqttSignTest',
  meta: { title: 'MQTT签名测试' }
}
```

---

## 🔐 签名算法详解

### 两种不同的签名

#### 1️⃣ 请求头签名（URL签名）
- **位置**: HTTP Header 的 `sign` 字段
- **格式**: `url=/device/xxx||t=时间戳||key=设备密钥`
- **算法**: `MD5(MD5(msg).substring(8, 16))` - 取**中间8位**

```javascript
const headerMsg = `url=/device/emqx/mqtt/config||t=1729751336||key=21LBF00rz4GXg2XQINsETw==`
const firstMd5 = MD5(headerMsg).toUpperCase()
const substring = firstMd5.substring(8, 16)  // 中间8位
const headerSign = MD5(substring).toUpperCase()
```

#### 2️⃣ 请求体签名（业务签名）

**A. 设备注册签名**（无mqttKey时）
- **格式**: `cpuId=xxx||sn=xxx||t=时间戳`
- **算法**: `MD5(MD5(msg).substring(8, 16))` - 取**中间8位**

```javascript
const msg = `cpuId=test_user_123||sn=SN123456||t=1729751336`
const firstMd5 = MD5(msg).toUpperCase()
const substring = firstMd5.substring(8, 16)  // 中间8位
const bodySign = MD5(substring).toUpperCase()
```

**B. MQTT配置签名**（有mqttKey时）⚠️ **注意区别**
- **格式**: `cpuId=xxx||sn=xxx||t=时间戳||key=mqttKey`
- **算法**: `MD5(MD5(msg).substring(0, 8))` - 取**前8位**

```javascript
const msg = `cpuId=test_user_123||sn=SN123456||t=1729751336||key=mqttKey_xxx`
const firstMd5 = MD5(msg).toUpperCase()
const substring = firstMd5.substring(0, 8)  // ⚠️ 前8位！
const bodySign = MD5(substring).toUpperCase()
```

---

## 📝 完整示例代码

```vue
<template>
  <el-form :model="form">
    <el-form-item label="CPU ID">
      <el-input v-model="form.cpuId" />
    </el-form-item>
    <el-form-item label="设备序列号">
      <el-input v-model="form.sn" />
    </el-form-item>
    
    <el-form-item>
      <!-- 步骤1：先初始化 -->
      <el-button type="primary" @click="handleInit">
        1. 初始化设备
      </el-button>
      
      <!-- 步骤2：再获取配置 -->
      <el-button 
        type="success" 
        @click="handleGetConfig"
        :disabled="!mqttKey"
      >
        2. 获取MQTT配置
      </el-button>
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref } from 'vue'
import { initDevice, getMqttConfig } from '@/api/device/mqtt'
import { ElMessage } from 'element-plus'

const form = ref({
  cpuId: 'test_user_123',
  sn: 'SN123456789'
})

const mqttKey = ref('')

// 步骤1：初始化设备
const handleInit = async () => {
  try {
    const res = await initDevice({
      cpuId: form.value.cpuId,
      equipType: 1,
      pucsType: 'PUCS-V1',
      sn: form.value.sn,
      sysVersion: '1.0.0'
    })
    
    if (res.code === 200) {
      mqttKey.value = res.data.key  // ⭐ 保存mqttKey
      ElMessage.success('设备初始化成功，可以获取MQTT配置了')
    }
  } catch (error) {
    ElMessage.error('初始化失败')
  }
}

// 步骤2：获取MQTT配置
const handleGetConfig = async () => {
  try {
    const res = await getMqttConfig(
      form.value.cpuId,
      form.value.sn,
      mqttKey.value  // ⭐ 使用保存的mqttKey
    )
    
    if (res.code === 200) {
      console.log('MQTT配置:', res.data)
      ElMessage.success('MQTT配置获取成功')
    }
  } catch (error) {
    ElMessage.error('获取配置失败')
  }
}
</script>
```

---

## 🛠️ 调试技巧

### 1. 查看控制台日志

打开浏览器控制台，会看到详细的签名生成过程：

```
[MQTT API] 准备获取MQTT配置
[MQTT API] cpuId: test_user_123
[MQTT API] sn: SN123456789
[MQTT API] t: 1729751336
[MQTT API] mqttKey: mqttKey_xxx
[MQTT API] 请求头签名: 3A2F8B4C9D1E6A7F
[MQTT API] 请求体签名: 7B8E3F2A9C4D1B6E
```

### 2. 使用签名测试工具

访问 `/device/mqtt/test` 页面（需要添加路由），可以：
- 手动输入参数生成签名
- 查看详细的签名计算步骤
- 测试实际请求

### 3. 对比后端代码

参考 `未命名文件夹` 中的后端实现：
- `Encryptor.kt` - 签名算法
- `EncryptInterceptor.kt` - 拦截器逻辑
- `AESUtil.java` - AES加密
- `ValueConst.kt` - 常量配置

---

## ⚠️ 常见错误

### 错误1：直接调用 getMqttConfig
```javascript
// ❌ 错误：没有mqttKey
const res = await getMqttConfig(cpuId, sn)

// ✅ 正确：先初始化获取mqttKey
const initRes = await initDevice(deviceData)
const mqttKey = initRes.data.key
const res = await getMqttConfig(cpuId, sn, mqttKey)
```

### 错误2：签名算法错误
```javascript
// ❌ 错误：MQTT配置签名也用中间8位
const substring = firstMd5.substring(8, 16)

// ✅ 正确：MQTT配置签名用前8位
const substring = firstMd5.substring(0, 8)
```

### 错误3：时间戳不一致
```javascript
// ❌ 错误：签名和请求头使用不同的时间戳
const t1 = getTimestamp()
const sign = signUrl(url, t1, key)
const t2 = getTimestamp()  // 可能和t1不同
headers.t = t2

// ✅ 正确：使用同一个时间戳
const t = getTimestamp()
const sign = signUrl(url, t, key)
headers.t = t
```

---

## 📚 相关文档

- [MQTT使用说明.md](./MQTT使用说明.md)
- [MQTT签名调试工具.md](./MQTT签名调试工具.md)
- [签名测试页面](./src/views/device/mqtt/signTest.vue)

---

## 🎉 总结

1. **先初始化设备** → 获取 mqttKey
2. **再获取MQTT配置** → 传入 mqttKey
3. **注意签名算法** → MQTT配置签名取前8位（与其他接口不同）
4. **使用测试工具** → 验证签名生成是否正确

按照以上步骤操作，sign异常问题应该可以解决！















