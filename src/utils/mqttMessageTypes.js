/**
 * MQTT消息类型定义
 */

// MQTT消息类型枚举
export const MQTT_MESSAGE_TYPE = {
  // 系统通知类
  SYSTEM_NOTIFICATION: 100,
  SYSTEM_UPDATE: 101,
  SYSTEM_MAINTENANCE: 102,
  
  // 订单类
  ORDER_NEW: 200,
  ORDER_UPDATE: 201,
  ORDER_CANCEL: 202,
  ORDER_COMPLETE: 203,
  
  // 告警类
  ALERT_ERROR: 300,
  ALERT_WARNING: 301,
  ALERT_INFO: 302,
  
  // 设备类
  DEVICE_ONLINE: 400,
  DEVICE_OFFLINE: 401,
  DEVICE_ALARM: 402,
  
  // 推送通知类
  PUSH_NOTIFICATION: 501,  // 你提到的501
  PUSH_MESSAGE: 502,
  PUSH_ALERT: 503,
  
  // 聊天消息类
  CHAT_MESSAGE: 551,  // 聊天消息推送
  
  // 任务类
  TASK_NEW: 600,
  TASK_UPDATE: 601,
  TASK_COMPLETE: 602,
  
  // 其他
  CUSTOM: 999
}

// 消息类型映射到Element UI通知类型
export const MESSAGE_TYPE_TO_ELEMENT_TYPE = {
  [MQTT_MESSAGE_TYPE.SYSTEM_NOTIFICATION]: 'info',
  [MQTT_MESSAGE_TYPE.SYSTEM_UPDATE]: 'warning',
  [MQTT_MESSAGE_TYPE.SYSTEM_MAINTENANCE]: 'warning',
  
  [MQTT_MESSAGE_TYPE.ORDER_NEW]: 'success',
  [MQTT_MESSAGE_TYPE.ORDER_UPDATE]: 'info',
  [MQTT_MESSAGE_TYPE.ORDER_CANCEL]: 'warning',
  [MQTT_MESSAGE_TYPE.ORDER_COMPLETE]: 'success',
  
  [MQTT_MESSAGE_TYPE.ALERT_ERROR]: 'error',
  [MQTT_MESSAGE_TYPE.ALERT_WARNING]: 'warning',
  [MQTT_MESSAGE_TYPE.ALERT_INFO]: 'info',
  
  [MQTT_MESSAGE_TYPE.DEVICE_ONLINE]: 'success',
  [MQTT_MESSAGE_TYPE.DEVICE_OFFLINE]: 'error',
  [MQTT_MESSAGE_TYPE.DEVICE_ALARM]: 'error',
  
  [MQTT_MESSAGE_TYPE.PUSH_NOTIFICATION]: 'info',
  [MQTT_MESSAGE_TYPE.PUSH_MESSAGE]: 'info',
  [MQTT_MESSAGE_TYPE.PUSH_ALERT]: 'warning',
  
  [MQTT_MESSAGE_TYPE.TASK_NEW]: 'success',
  [MQTT_MESSAGE_TYPE.TASK_UPDATE]: 'info',
  [MQTT_MESSAGE_TYPE.TASK_COMPLETE]: 'success'
}

// 消息类型映射到标题
export const MESSAGE_TYPE_TO_TITLE = {
  [MQTT_MESSAGE_TYPE.SYSTEM_NOTIFICATION]: '系统通知',
  [MQTT_MESSAGE_TYPE.SYSTEM_UPDATE]: '系统更新',
  [MQTT_MESSAGE_TYPE.SYSTEM_MAINTENANCE]: '系统维护',
  
  [MQTT_MESSAGE_TYPE.ORDER_NEW]: '新订单',
  [MQTT_MESSAGE_TYPE.ORDER_UPDATE]: '订单更新',
  [MQTT_MESSAGE_TYPE.ORDER_CANCEL]: '订单取消',
  [MQTT_MESSAGE_TYPE.ORDER_COMPLETE]: '订单完成',
  
  [MQTT_MESSAGE_TYPE.ALERT_ERROR]: '错误告警',
  [MQTT_MESSAGE_TYPE.ALERT_WARNING]: '警告',
  [MQTT_MESSAGE_TYPE.ALERT_INFO]: '提示',
  
  [MQTT_MESSAGE_TYPE.DEVICE_ONLINE]: '设备上线',
  [MQTT_MESSAGE_TYPE.DEVICE_OFFLINE]: '设备离线',
  [MQTT_MESSAGE_TYPE.DEVICE_ALARM]: '设备告警',
  
  [MQTT_MESSAGE_TYPE.PUSH_NOTIFICATION]: '推送通知',
  [MQTT_MESSAGE_TYPE.PUSH_MESSAGE]: '消息推送',
  [MQTT_MESSAGE_TYPE.PUSH_ALERT]: '重要提醒',
  
  [MQTT_MESSAGE_TYPE.TASK_NEW]: '新任务',
  [MQTT_MESSAGE_TYPE.TASK_UPDATE]: '任务更新',
  [MQTT_MESSAGE_TYPE.TASK_COMPLETE]: '任务完成'
}

/**
 * 根据消息类型代码获取Element UI通知类型
 * @param {number} typeCode - 消息类型代码
 * @returns {string} Element UI通知类型
 */
export function getElementTypeByCode(typeCode) {
  return MESSAGE_TYPE_TO_ELEMENT_TYPE[typeCode] || 'info'
}

/**
 * 根据消息类型代码获取标题
 * @param {number} typeCode - 消息类型代码
 * @returns {string} 标题
 */
export function getTitleByCode(typeCode) {
  return MESSAGE_TYPE_TO_TITLE[typeCode] || '通知'
}

/**
 * 501推送通知的消息处理器
 * @param {object} messageData - 消息数据
 * @returns {object} 处理后的消息对象
 */
export function handle501Message(messageData) {
  // 提取消息内容，支持多种字段名
  let content = '您有新的推送通知'
  
  // 优先从 data 对象中提取
  if (messageData.data) {
    content = messageData.data.massage || // 后端使用的字段名（拼写错误）
              messageData.data.message || 
              messageData.data.content ||
              content
  }
  
  // 如果 data 中没有，从顶层提取
  content = messageData.content || 
            messageData.message || 
            messageData.massage ||
            content
  
  // 提取标题
  let title = getTitleByCode(501)
  if (messageData.data) {
    title = messageData.data.title || messageData.title || title
  } else {
    title = messageData.title || title
  }
  
  return {
    type: 501,  // 保持数字类型，用于后续判断
    elementType: getElementTypeByCode(501),  // Element UI 通知类型
    title: title,
    content: content,
    data: messageData.data || messageData,
    timestamp: messageData.timestamp || messageData.t || Date.now()
  }
}

/**
 * 551聊天消息的处理器
 * @param {object} messageData - 消息数据
 * @returns {object} 处理后的消息对象
 */
export function handle551Message(messageData) {
  const data = messageData.data || messageData
  
  // 聊天消息：从 data 中提取实际内容
  const content = data.content || messageData.content || '您有新的消息'
  const senderName = data.fromUserName || '新消息'
  
  return {
    type: 551,
    title: senderName,
    content: content,
    data: data,
    timestamp: messageData.timestamp || messageData.t || Date.now()
  }
}

/**
 * 通用消息处理器
 * @param {object} messageData - 原始消息数据
 * @returns {object} 处理后的消息对象
 */
export function handleMqttMessage(messageData) {
  const typeCode = messageData.type || messageData.typeCode || messageData.msgType
  
  // 如果是501类型（系统推送通知）
  if (typeCode === 501 || typeCode === MQTT_MESSAGE_TYPE.PUSH_NOTIFICATION) {
    return handle501Message(messageData)
  }
  
  // 如果是551类型（聊天消息）
  if (typeCode === 551 || typeCode === MQTT_MESSAGE_TYPE.CHAT_MESSAGE) {
    return handle551Message(messageData)
  }
  
  // 通用处理
  return {
    type: getElementTypeByCode(typeCode),
    title: messageData.title || getTitleByCode(typeCode),
    content: messageData.content || messageData.message || '您有新的消息',
    data: messageData.data || messageData,
    timestamp: messageData.timestamp || Date.now()
  }
}

/**
 * 501推送通知标准格式示例
 */
export const MESSAGE_501_EXAMPLE = {
  type: 501,                              // 消息类型代码
  title: '推送通知',                       // 标题
  content: '这是一条推送通知消息',          // 内容
  data: {                                 // 附加数据
    orderId: '123456',
    userId: '789',
    action: 'view'
  },
  timestamp: 1234567890
}
