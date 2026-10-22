import request from '@/utils/request'
import CryptoJS from 'crypto-js'

/**
 * ==================== MQTT 设备接口说明 ====================
 * 
 * 正确的调用流程：
 * 
 * 1. 先调用 initDevice() - 设备初始化
 *    - 传入：cpuId, equipType, pucsType, sn, sysVersion
 *    - 返回：{ key, t }  ← key 就是后续需要的 mqttKey
 * 
 * 2. 再调用 getMqttConfig() - 获取MQTT配置
 *    - 传入：cpuId, sn, mqttKey（来自第1步的 key）
 *    - 返回：MQTT连接配置信息
 * 
 * ⚠️ 重要：getMqttConfig 必须使用 initDevice 返回的 key 来签名，不能直接调用！
 * 
 * ============================================================
 */

// 设备常量配置
export const DEVICE_CONFIG = {
  // 从环境变量读取 MQTT 服务器地址
  HOST_DEVICE: import.meta.env.VITE_APP_MQTT_HOST,
  DEVICE_KEY: '21LBF00rz4GXg2XQINsETw==',
  DEVICE_ID: '1891123b6bca0bc4f99f93f42c56aa40',
  // 设备类型配置（从环境变量读取）
  DEVICE_TYPE: import.meta.env.VITE_APP_DEVICE_TYPE || 'DIGIWISE_CLOUD_DESKTOP',
  DEVICE_TYPE_CODE: Number(import.meta.env.VITE_APP_DEVICE_TYPE_CODE) || 8
}

/**
 * 获取MQTT CPU ID
 * @param {string} userName - 用户名
 * @param {string} userId - 用户ID
 * @returns {string} MQTT CPU ID
 */
export function getMqttCpuId(userName, userId) {
  return `${userName}_${userId}`
}

/**
 * 上报设备状态（上线/下线/心跳）
 * @param {Object} data - 状态数据
 * @returns {Promise}
 */
export function reportDeviceStatus(data) {
  const t = Math.floor(Date.now() / 1000)
  const sign = signUrl('/device/status/report', t, DEVICE_CONFIG.DEVICE_KEY)
  
  return request({
    url: '/device/status/report',
    method: 'post',
    baseURL: DEVICE_CONFIG.HOST_DEVICE,
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      clientId: data.clientId,
      productKey: data.productKey || 'a1DLcjz8jcG',
      deviceName: data.deviceName,
      status: data.status,
      cpuId: data.cpuId,
      userId: data.userId,
      userName: data.userName,
      reason: data.reason,
      sign: sign,
      t: t
    }
  })
}

/**
 * MD5 双重加密（普通接口签名）
 * @param {string} url - 请求URL路径
 * @param {number} t - 时间戳
 * @param {string} key - 加密密钥
 * @returns {string} 签名字符串
 */
export function signUrl(url, t, key = DEVICE_CONFIG.DEVICE_KEY) {
  const msg = `url=${url}||t=${t}||key=${key}`
  console.log('[signUrl调试] 原始字符串:', msg)
  
  const firstMd5 = CryptoJS.MD5(msg).toString().toUpperCase()
  console.log('[signUrl调试] 第一次MD5:', firstMd5)
  
  const substring = firstMd5.substring(8, 16)
  console.log('[signUrl调试] 截取8-16位:', substring)
  
  const finalSign = CryptoJS.MD5(substring).toString().toUpperCase()
  console.log('[signUrl调试] 最终签名:', finalSign)
  
  return finalSign
}

/**
 * 设备注册签名
 * @param {string} cpuId - CPU ID
 * @param {number} t - 时间戳
 * @param {string} sn - 设备序列号
 * @returns {string} 签名字符串
 */
export function signRegisterDevice(cpuId, t, sn) {
  const msg = `cpuId=${cpuId}||sn=${sn}||t=${t}`
  console.log('[签名调试] 原始字符串:', msg)
  
  const firstMd5 = CryptoJS.MD5(msg).toString().toUpperCase()
  console.log('[签名调试] 第一次MD5:', firstMd5)
  
  const substring = firstMd5.substring(8, 16)
  console.log('[签名调试] 截取8-16位:', substring)
  
  const finalSign = CryptoJS.MD5(substring).toString().toUpperCase()
  console.log('[签名调试] 最终签名:', finalSign)
  
  return finalSign
}

/**
 * MQTT配置签名
 * @param {string} cpuId - CPU ID
 * @param {number} t - 时间戳
 * @param {string} sn - 设备序列号
 * @param {string} mqttKey - MQTT密钥
 * @returns {string} 签名字符串
 */
export function signMqttConfig(cpuId, t, sn, mqttKey) {
  const msg = `cpuId=${cpuId}||sn=${sn}||t=${t}||key=${mqttKey}`
  const firstMd5 = CryptoJS.MD5(msg).toString().toUpperCase()
  const substring = firstMd5.substring(0, 8)
  const finalSign = CryptoJS.MD5(substring).toString().toUpperCase()
  return finalSign
}

/**
 * AES 加密
 * @param {string} key - 加密密钥（字符串格式，如："1269571569321021"）
 * @param {string} data - 待加密数据
 * @returns {string} 加密后的Base64字符串
 */
export function encryptAES(key, data) {
  if (!data) return ''
  
  // 密钥直接用UTF8编码（与Java的key.getBytes()对应）
  const keyWordArray = CryptoJS.enc.Utf8.parse(key)
  
  // 加密配置：ECB模式 + Pkcs7填充
  // 对应Java的: Cipher.getInstance("AES/ECB/PKCS7Padding")
  const encrypted = CryptoJS.AES.encrypt(data, keyWordArray, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  })
  
  // 返回Base64字符串（与Java的Base64.getEncoder().encodeToString()对应）
  return encrypted.toString()
}

/**
 * AES 解密
 * @param {string} key - 解密密钥（字符串格式，如："1269571569321021"）
 * @param {string} encryptedData - 加密的Base64数据
 * @returns {string} 解密后的字符串
 */
export function decryptAES(key, encryptedData) {
  if (!encryptedData) return ''
  
  // 密钥直接用UTF8编码（与Java的key.getBytes()对应）
  const keyWordArray = CryptoJS.enc.Utf8.parse(key)
  
  // 解密配置：ECB模式 + Pkcs7填充
  // 对应Java的: Cipher.getInstance("AES/ECB/PKCS7Padding")
  const decrypted = CryptoJS.AES.decrypt(encryptedData, keyWordArray, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  })
  
  // 返回UTF8字符串
  return decrypted.toString(CryptoJS.enc.Utf8)
}

/**
 * 获取当前时间戳（秒，10位）
 * @returns {number} 时间戳
 */
export function getTimestamp() {
  return Math.floor(Date.now() / 1000)
}

/**
 * 获取MQTT配置信息（带重试机制）
 * ⚠️ 注意：必须先调用 initDevice 接口获取 mqttKey，才能调用此接口
 * @param {string} cpuId - CPU ID
 * @param {string} sn - 设备序列号
 * @param {string} mqttKey - MQTT密钥（必须，来自 initDevice 接口返回的 key）
 * @param {number} maxRetries - 最大重试次数
 * @returns {Promise} MQTT配置信息
 */
export async function getMqttConfigWithRetry(cpuId, sn, mqttKey, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`[MQTT API] 第 ${i + 1} 次尝试获取配置...`)
      const res = await getMqttConfig(cpuId, sn, mqttKey)
      console.log(`[MQTT API] ✅ 获取成功！`)
      return res
    } catch (error) {
      const isSignError = error.response?.data?.message?.includes('sign异常') || 
                         error.message?.includes('sign异常')
      
      if (isSignError && i < maxRetries - 1) {
        console.warn(`[MQTT API] ⚠️ 签名失败，${100}ms后第${i + 2}次重试...`)
        await new Promise(resolve => setTimeout(resolve, 100))
        continue
      }
      
      console.error(`[MQTT API] ❌ 获取失败:`, error)
      throw error
    }
  }
}

/**
 * 获取MQTT配置信息（内部方法）
 * ⚠️ 注意：必须先调用 initDevice 接口获取 mqttKey，才能调用此接口
 * @param {string} cpuId - CPU ID
 * @param {string} sn - 设备序列号
 * @param {string} mqttKey - MQTT密钥（必须，来自 initDevice 接口返回的 key）
 * @returns {Promise} MQTT配置信息
 */
export function getMqttConfig(cpuId, sn, mqttKey) {
  // 验证必需参数
  if (!mqttKey) {
    throw new Error('mqttKey是必需参数，请先调用 initDevice 接口获取')
  }
  
  const t = getTimestamp()
  const url = '/device/emqx/mqtt/config'
  
  // 调试日志
  console.log('[MQTT API] 准备获取MQTT配置')
  console.log('[MQTT API] cpuId:', cpuId)
  console.log('[MQTT API] sn:', sn)
  console.log('[MQTT API] t:', t)
  console.log('[MQTT API] mqttKey:', mqttKey)
  
  // 生成两种签名：
  // 1. 请求头签名（用于拦截器验证）- 基于URL路径
  const headerSign = signUrl(url, t, DEVICE_CONFIG.DEVICE_KEY)
  console.log('[MQTT API] 请求头签名 (signUrl):', headerSign)
  
  // 2. 请求体签名（用于业务逻辑）- 必须使用 mqttKey
  const bodySign = signMqttConfig(cpuId, t, sn, mqttKey)
  console.log('[MQTT API] 请求体签名 (signMqttConfig):', bodySign)
  
  // 准备请求数据（根据接口文档：cpuId, sign, t）
  const requestData = {
    cpuId: cpuId,
    sign: bodySign,  // 请求体中使用业务签名
    t: t
  }
  
  console.log('[MQTT API] 请求数据:', requestData)
  
  // AES加密请求体
  const encryptedBody = encryptAES(
    DEVICE_CONFIG.DEVICE_KEY,
    JSON.stringify(requestData)
  )
  
  console.log('[MQTT API] 加密后的请求体:', encryptedBody.substring(0, 50) + '...')
  
  return request({
    url: '/device/emqx/mqtt/config',
    method: 'post',
    baseURL: DEVICE_CONFIG.HOST_DEVICE,
    data: `"${encryptedBody}"`,
    headers: {
      'Content-Type': 'application/json',
      'sign': headerSign,  // 请求头中使用URL签名
      'id': DEVICE_CONFIG.DEVICE_ID,
      't': t.toString()
    }
  })
}

/**
 * 设备初始化
 * @param {object} deviceInitVO - 设备初始化参数
 * @param {string} deviceInitVO.cpuId - CPU ID
 * @param {number} deviceInitVO.equipType - 设备类型：1-pucs, 2-ssts, 3-sts, 4-esop, 5-sop
 * @param {string} deviceInitVO.pucsType - 设备类型
 * @param {string} deviceInitVO.sn - 设备序列号
 * @param {string} deviceInitVO.sysVersion - 系统版本号
 * @returns {Promise} 初始化结果
 */
export function initDevice(deviceInitVO) {
  const t = getTimestamp()
  const url = '/device/mqtt/init'
  
  // 生成两种签名：
  // 1. 请求头签名（用于拦截器验证）- 基于URL路径
  const headerSign = signUrl(url, t, DEVICE_CONFIG.DEVICE_KEY)
  console.log('[设备初始化] 请求头签名 (signUrl):', headerSign)
  
  // 2. 请求体签名（用于业务逻辑）- 基于业务参数
  const bodySign = signRegisterDevice(
    deviceInitVO.cpuId,
    t,
    deviceInitVO.sn
  )
  console.log('[设备初始化] 请求体签名 (signRegisterDevice):', bodySign)
  
  // 准备请求数据
  const requestData = {
    ...deviceInitVO,
    t: t,
    sign: bodySign  // 请求体中使用业务签名
  }
  
  console.log('[设备初始化] 请求数据:', requestData)
  
  // AES加密请求体
  const encryptedBody = encryptAES(
    DEVICE_CONFIG.DEVICE_KEY,
    JSON.stringify(requestData)
  )
  
  console.log('[设备初始化] 加密后的请求体:', encryptedBody.substring(0, 50) + '...')
  
  return request({
    url: '/device/mqtt/init',
    method: 'post',
    baseURL: DEVICE_CONFIG.HOST_DEVICE,
    data: `"${encryptedBody}"`,
    headers: {
      'Content-Type': 'application/json',
      'sign': headerSign,  // 请求头中使用URL签名
      'id': DEVICE_CONFIG.DEVICE_ID,
      't': t.toString()
    }
  })
}

/**
 * 设备类型枚举
 */
export const EQUIP_TYPE = {
  PUCS: 1,
  SSTS: 2,
  STS: 3,
  ESOP: 4,
  SOP: 5
}

