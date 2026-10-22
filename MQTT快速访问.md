# MQTT 功能快速访问

## 🚀 直接访问地址

在浏览器地址栏输入以下地址：

### MQTT设备管理页面
```
http://localhost:你的端口/device/mqtt
```

### MQTT签名测试工具
```
http://localhost:你的端口/device/mqtt/test
```

---

## 🔧 添加快捷访问按钮

你可以在"我的待办"页面添加一个快速跳转按钮。

### 方法：在任意页面添加跳转按钮

在你当前打开的页面中添加：

```vue
<template>
  <div>
    <!-- 你的其他内容 -->
    
    <!-- MQTT快速入口 -->
    <el-button type="primary" @click="goToMqtt">
      🔐 MQTT设备管理
    </el-button>
    
    <el-button type="success" @click="goToMqttTest">
      🐛 MQTT签名测试
    </el-button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goToMqtt = () => {
  router.push('/device/mqtt')
}

const goToMqttTest = () => {
  router.push('/device/mqtt/test')
}
</script>
```

---

## 💡 或者在待办页面添加入口

我可以帮你在"我的待办"页面顶部添加一个MQTT工具入口。















