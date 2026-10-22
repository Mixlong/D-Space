# MQTT 功能使用说明

## 📁 文件结构

```
src/
├── api/
│   └── device/
│       └── mqtt.js          # MQTT API接口封装
├── store/
│   └── modules/
│       └── mqtt.js          # MQTT Vuex Store模块
└── utils/
    └── mqtt.js              # MQTT工具类和组合式API
```

## 🚀 快速开始

### 1. API 接口调用

在任何组件中直接调用API：

```javascript
import { getMqttConfig, initDevice, EQUIP_TYPE } from '@/api/device/mqtt'

export default {
  methods: {
    // 获取MQTT配置
    async fetchConfig() {
      try {
        const res = await getMqttConfig()
        if (res.code === 200) {
          console.log('MQTT配置:', res.data)
          // res.data 包含：
          // - url: MQTT节点地址
          // - userName: 连接用户名
          // - pwd: 连接密码
          // - clientId: 连接ID
          // - publish: 发送主题头
          // - subscribe: 订阅主题头
          // - interval: 重连间隔
          // - rcNum: 最大重连次数
        }
      } catch (error) {
        console.error('获取配置失败:', error)
      }
    },

    // 设备初始化
    async initializeDevice() {
      try {
        const deviceData = {
          cpuId: 'test_user_123',           // CPU ID
          equipType: EQUIP_TYPE.PUCS,       // 设备类型: 1-pucs, 2-ssts, 3-sts, 4-esop, 5-sop
          pucsType: 'PUCS-V1',              // 设备类型名称
          sn: 'SN123456789',                // 设备序列号
          sysVersion: '1.0.0'               // 系统版本
          // t 和 sign 会自动生成，无需手动填写
        }
        
        const res = await initDevice(deviceData)
        if (res.code === 200) {
          console.log('初始化结果:', res.data)
          // res.data 包含：
          // - key: 加密秘钥
          // - t: 时间戳
        }
      } catch (error) {
        console.error('初始化失败:', error)
      }
    }
  }
}
```

### 2. 使用 Vuex Store（推荐）

使用Store可以在全局管理MQTT状态：

```javascript
import useMqttStore from '@/store/modules/mqtt'

export default {
  setup() {
    const mqttStore = useMqttStore()

    // 获取MQTT配置
    const loadConfig = async () => {
      try {
        const config = await mqttStore.fetchMqttConfig()
        console.log('配置加载成功:', config)
      } catch (error) {
        this.$message.error('配置加载失败')
      }
    }

    // 设备初始化
    const initDevice = async () => {
      try {
        const params = {
          cpuId: mqttStore.generateCpuId('张三', '123'),
          equipType: 1,
          pucsType: 'PUCS-V1',
          sn: 'SN123456',
          sysVersion: '1.0.0'
        }
        
        const result = await mqttStore.initializeDevice(params)
        console.log('初始化成功:', result)
      } catch (error) {
        this.$message.error('初始化失败')
      }
    }

    // 访问状态
    const config = computed(() => mqttStore.getConfig)
    const isConnected = computed(() => mqttStore.getConnectionStatus)

    return {
      loadConfig,
      initDevice,
      config,
      isConnected
    }
  }
}
```

### 3. 使用组合式API（Vue3推荐）

```vue
<script setup>
import { useMqtt } from '@/utils/mqtt'

const {
  mqttConfig,        // MQTT配置
  deviceInfo,        // 设备信息
  isConnected,       // 连接状态
  loading,           // 加载状态
  getMqttConfig,     // 获取配置方法
  initDevice,        // 初始化设备方法
  generateCpuId,     // 生成CPU ID方法
  EQUIP_TYPE         // 设备类型枚举
} = useMqtt()

// 获取MQTT配置
const handleGetConfig = async () => {
  try {
    await getMqttConfig()
    ElMessage.success('配置获取成功')
  } catch (error) {
    ElMessage.error('配置获取失败')
  }
}

// 初始化设备
const handleInit = async () => {
  try {
    const params = {
      cpuId: generateCpuId('张三', '123'),
      equipType: EQUIP_TYPE.PUCS,
      pucsType: 'PUCS-V1',
      sn: 'SN123456',
      sysVersion: '1.0.0'
    }
    
    await initDevice(params)
    ElMessage.success('初始化成功')
  } catch (error) {
    ElMessage.error('初始化失败')
  }
}
</script>

<template>
  <div>
    <el-button @click="handleGetConfig" :loading="loading">
      获取MQTT配置
    </el-button>
    
    <el-button @click="handleInit" :loading="loading">
      初始化设备
    </el-button>
    
    <div v-if="mqttConfig">
      <p>连接地址: {{ mqttConfig.url }}</p>
      <p>用户名: {{ mqttConfig.userName }}</p>
      <p>连接状态: {{ isConnected ? '已连接' : '未连接' }}</p>
    </div>
  </div>
</template>
```

### 4. 使用工具类（简化版）

```javascript
import { mqttHelper } from '@/utils/mqtt'

// 获取配置
const config = await mqttHelper.getMqttConfig()

// 初始化设备
const result = await mqttHelper.initDevice({
  cpuId: mqttHelper.generateCpuId('张三', '123'),
  equipType: 1,
  pucsType: 'PUCS-V1',
  sn: 'SN123456',
  sysVersion: '1.0.0'
})

// 访问状态
console.log('连接状态:', mqttHelper.isConnected)
console.log('当前配置:', mqttHelper.config)
```

## 📝 完整示例页面

```vue
<template>
  <div class="app-container">
    <el-card>
      <template #header>
        <span>MQTT设备管理</span>
      </template>
      
      <el-space direction="vertical" :size="20" style="width: 100%">
        <!-- 获取配置 -->
        <el-button 
          type="primary" 
          @click="handleGetConfig"
          :loading="loading"
        >
          获取MQTT配置
        </el-button>
        
        <!-- 显示配置信息 -->
        <el-descriptions v-if="mqttConfig" :column="2" border>
          <el-descriptions-item label="连接地址">
            {{ mqttConfig.url }}
          </el-descriptions-item>
          <el-descriptions-item label="用户名">
            {{ mqttConfig.userName }}
          </el-descriptions-item>
          <el-descriptions-item label="客户端ID">
            {{ mqttConfig.clientId }}
          </el-descriptions-item>
          <el-descriptions-item label="重连间隔">
            {{ mqttConfig.interval }}秒
          </el-descriptions-item>
        </el-descriptions>
        
        <!-- 设备初始化表单 -->
        <el-divider />
        
        <el-form :model="form" label-width="120px">
          <el-form-item label="CPU ID">
            <el-input v-model="form.cpuId" />
          </el-form-item>
          
          <el-form-item label="设备类型">
            <el-select v-model="form.equipType">
              <el-option label="PUCS" :value="1" />
              <el-option label="SSTS" :value="2" />
              <el-option label="STS" :value="3" />
              <el-option label="ESOP" :value="4" />
              <el-option label="SOP" :value="5" />
            </el-select>
          </el-form-item>
          
          <el-form-item label="设备SN">
            <el-input v-model="form.sn" />
          </el-form-item>
          
          <el-form-item>
            <el-button 
              type="primary" 
              @click="handleInit"
              :loading="loading"
            >
              初始化设备
            </el-button>
          </el-form-item>
        </el-form>
      </el-space>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMqtt } from '@/utils/mqtt'
import { ElMessage } from 'element-plus'

const {
  mqttConfig,
  loading,
  getMqttConfig,
  initDevice,
  generateCpuId
} = useMqtt()

const form = ref({
  cpuId: generateCpuId('test_user', '123'),
  equipType: 1,
  pucsType: 'PUCS-V1',
  sn: 'SN123456',
  sysVersion: '1.0.0'
})

const handleGetConfig = async () => {
  try {
    await getMqttConfig()
    ElMessage.success('配置获取成功')
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

const handleInit = async () => {
  try {
    await initDevice(form.value)
    ElMessage.success('设备初始化成功')
  } catch (error) {
    // 错误已在拦截器中处理
  }
}
</script>
```

## 🔧 配置说明

### 环境变量

在 `.env.development` 或 `.env.production` 中可以配置：

```bash
# 设备API地址（可选，默认使用API中的配置）
VITE_DEVICE_API_URL=http://test-pucs.riding-evolved.com
```

### 设备类型枚举

```javascript
EQUIP_TYPE.PUCS  // 1
EQUIP_TYPE.SSTS  // 2
EQUIP_TYPE.STS   // 3
EQUIP_TYPE.ESOP  // 4
EQUIP_TYPE.SOP   // 5
```

## 🔐 签名说明

设备初始化时会自动生成签名，无需手动处理：
- 使用 MD5 加密
- 自动添加时间戳
- 自动排序参数并拼接
- 使用固定密钥: `21LBF00rz4GXg2XQINsETw==`

## ⚠️ 注意事项

1. **错误处理**: 所有错误都会在全局API拦截器中统一处理，无需重复显示错误消息
2. **环境切换**: 默认使用测试环境 `HOST_DEVICE_TEST`，生产环境需修改 `mqtt.js` 中的 `baseURL`
3. **CPU ID生成**: 建议使用 `generateCpuId(userName, userId)` 方法生成，格式为 `用户名_用户ID`
4. **依赖安装**: 确保已安装 `crypto-js` 依赖（已自动安装）

## 📞 相关文件

- API接口: `/src/api/device/mqtt.js`
- Store模块: `/src/store/modules/mqtt.js`
- 工具类: `/src/utils/mqtt.js`
