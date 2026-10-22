# MQTT推送通知集成说明

## 📌 功能说明

MQTT用于接收服务器推送的实时消息，并在系统中弹出Element UI通知。

## 🚀 快速集成

### 1. 在 `main.js` 中注册MQTT插件

```javascript
import { createApp } from 'vue'
import App from './App.vue'
import mqttPlugin from './plugins/mqtt'

const app = createApp(App)

// 注册MQTT插件
app.use(mqttPlugin)

app.mount('#app')
```

### 2. 在用户登录成功后初始化MQTT

在你的登录逻辑中（通常在 `src/views/login.vue` 或登录action中）：

```javascript
import { initMqtt } from '@/plugins/mqtt'

// 登录成功后
async function handleLoginSuccess() {
  try {
    // ... 你的登录逻辑
    
    // 初始化MQTT连接
    await initMqtt()
    
    // 跳转到首页
    router.push('/')
  } catch (error) {
    console.error('登录失败:', error)
  }
}
```

### 3. 在用户登出时断开MQTT

在你的登出逻辑中：

```javascript
import { disconnectMqtt } from '@/plugins/mqtt'

async function handleLogout() {
  // ... 你的登出逻辑
  
  // 断开MQTT连接
  disconnectMqtt()
  
  // 跳转到登录页
  router.push('/login')
}
```

## 🔧 在任何组件中使用MQTT

### 方式一：使用全局实例

```vue
<script setup>
import { getCurrentInstance, onMounted, onUnmounted } from 'vue'

const instance = getCurrentInstance()
const mqtt = instance.appContext.config.globalProperties.$mqtt

// 发送消息
const sendMessage = () => {
  mqtt.publish('your/topic', {
    type: 'info',
    title: '测试消息',
    content: '这是一条测试消息'
  })
}

// 监听特定消息
const handleCustomMessage = (topic, messageData) => {
  if (messageData.type === 'alert') {
    // 处理告警消息
    console.log('收到告警:', messageData)
  }
}

onMounted(() => {
  // 注册消息处理器
  mqtt.onMessage(handleCustomMessage)
})

onUnmounted(() => {
  // 移除消息处理器
  mqtt.offMessage(handleCustomMessage)
})
</script>
```

### 方式二：直接导入单例

```javascript
import { mqttClient } from '@/utils/mqttClient'

// 检查连接状态
console.log('MQTT状态:', mqttClient.getStatus())

// 发送消息
mqttClient.publish('device/command', { action: 'start' })

// 监听消息
mqttClient.onMessage((topic, messageData) => {
  console.log('收到消息:', topic, messageData)
})
```

## 📝 消息格式

### 接收的消息格式

服务器推送的消息支持以下格式：

```json
{
  "type": "success",      // success | warning | info | error
  "title": "消息标题",
  "content": "消息内容",
  "data": {              // 可选的附加数据
    "orderId": "123456",
    "userId": "789"
  }
}
```

### 发送消息

```javascript
mqttClient.publish('your/topic', {
  action: 'update',
  data: { ... }
})
```

## 🎨 自定义消息处理

### 全局消息处理器

在 `src/plugins/mqtt.js` 的 `initMqtt` 函数中添加全局处理逻辑：

```javascript
export async function initMqtt() {
  // ... 初始化代码
  
  // 注册全局消息处理器
  mqttClient.onMessage((topic, messageData) => {
    // 根据消息类型做不同处理
    switch(messageData.type) {
      case 'order':
        // 处理订单消息
        handleOrderMessage(messageData)
        break
      case 'alert':
        // 处理告警消息
        handleAlertMessage(messageData)
        break
      case 'system':
        // 处理系统消息
        handleSystemMessage(messageData)
        break
      default:
        console.log('收到消息:', messageData)
    }
  })
}
```

### 页面级消息处理

在特定页面中处理特定消息：

```vue
<script setup>
import { mqttClient } from '@/utils/mqttClient'
import { onMounted, onUnmounted } from 'vue'

// 订单页面的消息处理
const handleOrderMessage = (topic, messageData) => {
  if (topic.includes('/order/')) {
    // 刷新订单列表
    refreshOrderList()
    
    // 显示通知
    ElNotification({
      title: '订单更新',
      message: messageData.content,
      type: 'info'
    })
  }
}

onMounted(() => {
  mqttClient.onMessage(handleOrderMessage)
})

onUnmounted(() => {
  mqttClient.offMessage(handleOrderMessage)
})
</script>
```

## 🔐 消息加密

MQTT客户端会自动处理消息的加密和解密：

- **发送**: 使用 AES-ECB 加密（自动）
- **接收**: 自动尝试解密，如果失败则使用原始消息

加密密钥配置在 `src/api/device/mqtt.js` 中的 `DEVICE_CONFIG.DEVICE_KEY`

## ⚙️ 配置选项

### 修改连接参数

在 `src/utils/mqttClient.js` 的 `connect()` 方法中：

```javascript
const options = {
  clientId: clientId,
  username: userName,
  password: pwd,
  clean: true,
  reconnectPeriod: 5000,      // 重连间隔（毫秒）
  connectTimeout: 30 * 1000,  // 连接超时（毫秒）
  keepalive: 60,              // 心跳间隔（秒）
  rejectUnauthorized: false
}
```

### 修改最大重连次数

```javascript
this.maxReconnectAttempts = 10  // 在构造函数中修改
```

## 🎯 通知样式自定义

### 修改默认通知样式

在 `src/utils/mqttClient.js` 的 `showMessageNotification` 方法中：

```javascript
ElNotification({
  title: title,
  message: message,
  type: type,
  duration: 5000,           // 显示时长（毫秒）
  position: 'top-right',    // 位置：top-right, top-left, bottom-right, bottom-left
  showClose: true,          // 显示关闭按钮
  dangerouslyUseHTMLString: false,  // 是否允许HTML
  onClick: () => {
    // 点击通知的处理逻辑
  }
})
```

### 自定义通知组件

你可以使用Element Plus的其他通知组件：

```javascript
import { ElMessage, ElMessageBox } from 'element-plus'

// 简单消息
ElMessage.success('操作成功')

// 确认对话框
ElMessageBox.confirm('是否确认此操作？', '提示', {
  confirmButtonText: '确定',
  cancelButtonText: '取消',
  type: 'warning'
}).then(() => {
  // 确认操作
})
```

## 📊 实时监控MQTT状态

### 在页面中显示连接状态

```vue
<template>
  <div class="mqtt-status">
    <el-tag :type="mqttStatus.isConnected ? 'success' : 'danger'">
      {{ mqttStatus.isConnected ? 'MQTT已连接' : 'MQTT未连接' }}
    </el-tag>
    <span v-if="!mqttStatus.isConnected">
      重连次数: {{ mqttStatus.reconnectAttempts }}
    </span>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { mqttClient } from '@/utils/mqttClient'

const mqttStatus = ref({
  isConnected: false,
  reconnectAttempts: 0
})

onMounted(() => {
  // 定时更新状态
  setInterval(() => {
    mqttStatus.value = mqttClient.getStatus()
  }, 1000)
})
</script>
```

## 🐛 调试技巧

### 1. 查看MQTT日志

所有MQTT操作都会在控制台输出日志，以 `[MQTT]` 开头：

```
[MQTT] 开始初始化...
[MQTT] 获取MQTT配置...
[MQTT] 正在连接到: mqtt://xxx:1883
[MQTT] 连接成功
[MQTT] 成功订阅主题: device/notification/#
[MQTT] 收到消息 - 主题: device/notification/order
```

### 2. 手动测试MQTT

在浏览器控制台中：

```javascript
// 获取mqtt客户端
const mqtt = window.$mqtt || this.$mqtt

// 检查状态
mqtt.getStatus()

// 发送测试消息
mqtt.publish('test/topic', { test: 'hello' })

// 断开连接
mqtt.disconnect()
```

### 3. 使用MQTT客户端工具

推荐使用 [MQTTX](https://mqttx.app/) 进行测试：
1. 连接到相同的MQTT服务器
2. 订阅相同的主题
3. 发送测试消息
4. 查看前端是否收到通知

## ⚠️ 注意事项

1. **登录后初始化**: MQTT必须在用户登录成功后初始化，因为需要用户信息
2. **登出时断开**: 用户登出时务必断开MQTT连接，避免资源泄漏
3. **移除处理器**: 组件卸载时记得移除消息处理器
4. **错误处理**: 网络异常时MQTT会自动重连，无需手动处理
5. **消息格式**: 确保服务器推送的消息格式与前端约定一致

## 📚 完整示例

### App.vue（应用入口）

```vue
<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { initMqtt } from '@/plugins/mqtt'
import useUserStore from '@/store/modules/user'

const userStore = useUserStore()

onMounted(async () => {
  // 如果用户已登录，初始化MQTT
  if (userStore.id) {
    await initMqtt()
  }
})
</script>
```

### Login.vue（登录页面）

```vue
<script setup>
import { initMqtt } from '@/plugins/mqtt'

const handleLogin = async (formData) => {
  try {
    // 登录
    await userStore.login(formData)
    
    // 初始化MQTT
    await initMqtt()
    
    // 跳转首页
    router.push('/')
    
    ElMessage.success('登录成功')
  } catch (error) {
    ElMessage.error('登录失败')
  }
}
</script>
```

### Layout.vue（布局组件）

```vue
<template>
  <div class="layout">
    <div class="header">
      <el-button @click="handleLogout">退出登录</el-button>
    </div>
    <div class="content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { disconnectMqtt } from '@/plugins/mqtt'
import useUserStore from '@/store/modules/user'

const userStore = useUserStore()
const router = useRouter()

const handleLogout = async () => {
  // 断开MQTT
  disconnectMqtt()
  
  // 登出
  await userStore.logout()
  
  // 跳转登录页
  router.push('/login')
}
</script>
```

## 🎉 完成

现在你的应用已经集成了MQTT推送通知功能！

- ✅ 实时接收服务器推送
- ✅ 自动弹出系统通知
- ✅ 支持自定义消息处理
- ✅ 自动重连机制
- ✅ 完整的错误处理

如有问题，请查看控制台日志或参考上述文档。
