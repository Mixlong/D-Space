/**
 * MQTT工具类
 * 用于在Vue组件中快速使用MQTT功能
 */

import useMqttStore from '@/store/modules/mqtt'
import { EQUIP_TYPE, DEVICE_CONFIG } from '@/api/device/mqtt'

/**
 * MQTT工具类
 */
export class MqttHelper {
  constructor() {
    this.mqttStore = useMqttStore()
  }

  /**
   * 获取MQTT配置
   */
  async getMqttConfig() {
    try {
      const config = await this.mqttStore.fetchMqttConfig()
      console.log('MQTT配置获取成功:', config)
      return config
    } catch (error) {
      console.error('MQTT配置获取失败:', error)
      throw error
    }
  }

  /**
   * 初始化设备
   * @param {object} params - 设备参数
   * @param {string} params.cpuId - CPU ID
   * @param {number} params.equipType - 设备类型
   * @param {string} params.pucsType - 设备类型名称
   * @param {string} params.sn - 设备序列号
   * @param {string} params.sysVersion - 系统版本
   */
  async initDevice(params) {
    try {
      const result = await this.mqttStore.initializeDevice(params)
      console.log('设备初始化成功:', result)
      return result
    } catch (error) {
      console.error('设备初始化失败:', error)
      throw error
    }
  }

  /**
   * 生成CPU ID
   * @param {string} userName - 用户名
   * @param {string} userId - 用户ID
   */
  generateCpuId(userName, userId) {
    return this.mqttStore.generateCpuId(userName, userId)
  }

  /**
   * 获取连接状态
   */
  get isConnected() {
    return this.mqttStore.getConnectionStatus
  }

  /**
   * 获取当前配置
   */
  get config() {
    return this.mqttStore.getConfig
  }

  /**
   * 获取设备信息
   */
  get deviceInfo() {
    return this.mqttStore.getDeviceInfo
  }
}

// 导出单例
export const mqttHelper = new MqttHelper()

// 导出设备类型枚举
export { EQUIP_TYPE, DEVICE_CONFIG }

/**
 * Vue组合式API - useMqtt
 * 在Vue3组件中使用
 */
export function useMqtt() {
  const mqttStore = useMqttStore()

  return {
    // 状态
    mqttConfig: computed(() => mqttStore.getConfig),
    deviceInfo: computed(() => mqttStore.getDeviceInfo),
    isConnected: computed(() => mqttStore.getConnectionStatus),
    loading: computed(() => mqttStore.loading),

    // 方法
    getMqttConfig: () => mqttStore.fetchMqttConfig(),
    initDevice: (params) => mqttStore.initializeDevice(params),
    generateCpuId: (userName, userId) => mqttStore.generateCpuId(userName, userId),
    updateConnectionStatus: (status) => mqttStore.updateConnectionStatus(status),
    clearMqttConfig: () => mqttStore.clearMqttConfig(),

    // 常量
    EQUIP_TYPE,
    DEVICE_CONFIG
  }
}
