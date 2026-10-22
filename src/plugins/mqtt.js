/**
 * MQTT全局插件
 * 在应用启动时自动初始化MQTT连接
 */

import { mqttClient } from '@/utils/mqttClient'
import useUserStore from '@/store/modules/user'

/**
 * 安装MQTT插件
 * @param {object} app - Vue应用实例
 */
export function setupMqtt(app) {
  // 在Vue实例上挂载mqtt客户端
  app.config.globalProperties.$mqtt = mqttClient

  console.log('[MQTT Plugin] MQTT插件已安装')
}

/**
 * 初始化MQTT连接
 * 在用户登录后调用
 */
export async function initMqtt() {
  try {
    const userStore = useUserStore()
    
    // 检查用户是否已登录
    if (!userStore.id || !userStore.name) {
      console.log('[MQTT Plugin] 用户未登录，跳过MQTT初始化')
      return
    }

    console.log('[MQTT Plugin] 开始初始化MQTT连接...')

    // 准备用户信息
    const userInfo = {
      userName: userStore.name,
      userId: userStore.id
      // ⚠️ 注意：不传 mqttKey，让 mqttClient.init 自动调用 initDevice 获取
      // 如果已经有保存的 mqttKey，可以从 store 中获取传入
    }

    // 初始化MQTT客户端（会自动先调用 initDevice，再调用 getMqttConfig）
    await mqttClient.init(userInfo)

    // 注册全局消息处理器
    mqttClient.onMessage((topic, messageData) => {
      console.log('[MQTT Plugin] 收到消息:', { topic, messageData })
      
      // 可以在这里添加全局消息处理逻辑
      // 例如：更新Vuex状态、触发特定事件等
    })

    console.log('[MQTT Plugin] MQTT初始化成功')
  } catch (error) {
    console.error('[MQTT Plugin] MQTT初始化失败:', error)
  }
}

/**
 * 断开MQTT连接
 * 在用户登出时调用
 * @param {string} reason - 断开原因
 */
export async function disconnectMqtt(reason = 'normal_logout') {
  console.log('[MQTT Plugin] 断开MQTT连接, 原因:', reason)
  await mqttClient.disconnect(reason)
}

export default {
  install: setupMqtt
}
