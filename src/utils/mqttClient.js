/**
 * MQTT客户端服务
 * 用于连接MQTT服务器、监听消息并弹出系统通知
 */

import mqtt from 'mqtt'
import { ElNotification } from 'element-plus'
import { getMqttConfig, initDevice, getMqttCpuId, decryptAES, DEVICE_CONFIG, reportDeviceStatus } from '@/api/device/mqtt'
import useMqttStore from '@/store/modules/mqtt'
import { MQTT_MESSAGE_TYPE, handleMqttMessage, handle501Message } from './mqttMessageTypes'

class MqttClient {
  constructor() {
    this.client = null
    this.mqttConfig = null
    this.isConnected = false
    this.reconnectAttempts = 0
    this.messageHandlers = []
    this.notificationPermission = 'default' // 通知权限状态
    this.isManualDisconnect = false // 标记是否为手动断开
    this.userInfo = null // 用户信息（用于生成clientId）
    this.heartbeatTimer = null // 心跳定时器
    this._lastOfflineReportTime = null // 上次报告离线状态的时间戳（用于防抖）
    
    // 初始化时请求通知权限
    this.requestNotificationPermission()
    
    // Electron 环境：监听托盘通知确认事件
    if (window.electronAPI) {
      // 旧版通知事件（兼容）
      window.electronAPI.onNotificationConfirmed((data) => {
        console.log('[MQTT] 用户点击了托盘通知的确定按钮:', data)
        this.handleNotificationClick(data)
      })
      
      // 新版通知卡片按钮事件
      if (window.electronAPI.on) {
        window.electronAPI.on('notification-action', (payload) => {
          console.log('[MQTT] 👉 用户点击了通知卡片按钮')
          console.log('[MQTT] 👉 完整 payload:', JSON.stringify(payload, null, 2))
          const { action, data } = payload
          console.log('[MQTT] 👉 action:', action)
          console.log('[MQTT] 👉 data:', data)
          console.log('[MQTT] 👉 data 类型:', typeof data)
          
          // 只处理“立即查看”类型的按钮
          if (action === 'view-mqtt' || action === 'view' || action === '立即查看') {
            console.log('[MQTT] ✅ 准备调用 handleNotificationClick')
            this.handleNotificationClick(data)
          } else {
            console.log('[MQTT] ❌ 不处理此 action:', action)
          }
        })
      }
      
      console.log('[MQTT] Electron 托盘通知监听已注册')
    }
  }

  /**
   * 请求浏览器通知权限
   */
  async requestNotificationPermission() {
    // 检查浏览器是否支持通知
    if (!('Notification' in window)) {
      console.warn('[MQTT] 浏览器不支持桌面通知')
      return
    }

    // 检查当前权限状态
    if (Notification.permission === 'granted') {
      console.log('[MQTT] 已获得桌面通知权限')
      this.notificationPermission = 'granted'
    } else if (Notification.permission === 'denied') {
      console.warn('[MQTT] 桌面通知权限被拒绝')
      this.notificationPermission = 'denied'
    } else {
      // 请求权限
      try {
        const permission = await Notification.requestPermission()
        this.notificationPermission = permission
        if (permission === 'granted') {
          console.log('[MQTT] 用户授予桌面通知权限')
        } else {
          console.warn('[MQTT] 用户拒绝桌面通知权限')
        }
      } catch (error) {
        console.error('[MQTT] 请求通知权限失败:', error)
      }
    }
  }

  /**
   * 初始化MQTT客户端
   * @param {object} userInfo - 用户信息
   * @param {string} userInfo.userName - 用户名
   * @param {string} userInfo.userId - 用户ID
   * @param {string} userInfo.sn - 设备序列号
   */
  async init(userInfo) {
    try {
      console.log('[MQTT] 开始初始化...')
      
      // 保存用户信息
      this.userInfo = userInfo
      
      // 1. 生成CPU ID
      const cpuId = getMqttCpuId(userInfo.userName, userInfo.userId)
      const sn = cpuId  // ⚠️ 重要：sn 应该和 cpuId 相同
      
      // 2. 获取或使用已有的 mqttKey
      let mqttKey = userInfo.mqttKey || ''
      
      // 如果没有 mqttKey，必须先进行设备初始化
      if (!mqttKey) {
        console.log('[MQTT] 未提供 mqttKey，开始执行设备初始化...')
        console.log('[MQTT] 设备类型配置:', { 
          DEVICE_TYPE: DEVICE_CONFIG.DEVICE_TYPE, 
          DEVICE_TYPE_CODE: DEVICE_CONFIG.DEVICE_TYPE_CODE 
        })
        
        const initRes = await initDevice({
          cpuId: cpuId,
          equipType: DEVICE_CONFIG.DEVICE_TYPE_CODE,
          pucsType: DEVICE_CONFIG.DEVICE_TYPE,
          sn: sn,
          sysVersion: '1.0.0'
        })
        
        if (initRes.code === 200 && initRes.data?.key) {
          mqttKey = initRes.data.key
          console.log('[MQTT] 设备初始化成功，获取到 mqttKey:', mqttKey)
          
          // 保存到 Store
          const mqttStore = useMqttStore()
          mqttStore.deviceInfo = initRes.data
        } else {
          throw new Error('设备初始化失败，无法获取 mqttKey')
        }
      } else {
        console.log('[MQTT] 使用已有的 mqttKey:', mqttKey)
      }
      
      // 3. 获取MQTT配置（必须有 mqttKey）
      console.log('[MQTT] 获取MQTT配置...')
      console.log('[MQTT] 使用的参数 - cpuId:', cpuId, 'sn:', sn, 'mqttKey:', mqttKey)
      
      const res = await getMqttConfig(cpuId, sn, mqttKey)
      
      if (res.code === 200) {
        this.mqttConfig = res.data
        
        // 保存到Store
        const mqttStore = useMqttStore()
        mqttStore.mqttConfig = res.data
        
        // 4. 连接MQTT服务器
        await this.connect()
      } else {
        throw new Error(res.msg || '获取MQTT配置失败')
      }
    } catch (error) {
      console.error('[MQTT] 初始化失败:', error)
      this.showNotification('MQTT初始化失败', error.message, 'error')
      throw error
    }
  }

  /**
   * 转换 MQTT URL 为 WebSocket URL（浏览器环境）
   * @param {string} url - 原始 MQTT URL
   * @returns {string} WebSocket URL
   */
  convertToWebSocketUrl(url) {
    // 如果已经是完整的 ws:// 或 wss:// URL，直接返回
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      console.log('[MQTT] URL 已经是 WebSocket 格式:', url)
      return url
    }

    // 🔧 更准确的 Electron 环境检测
    // 只有当 window.electron API 存在时，才认为是真正的 Electron 环境
    // 不依赖 UserAgent，因为浏览器中也可能包含 "electron" 字样
    const isElectron = typeof window !== 'undefined' && 
                       window.electron !== undefined &&
                       typeof window.electron === 'object'
    
    console.log('[MQTT] 环境检测 - isElectron:', isElectron, 'window.electron:', typeof window !== 'undefined' ? window.electron : 'undefined')
    
    // 在 Electron 中可以使用 tcp:// 或 mqtt://（需要完整的端口）
    if (isElectron && (url.startsWith('tcp://') || url.startsWith('mqtt://'))) {
      // 检查是否有端口号
      if (url.match(/:\d+/)) {
        console.log('[MQTT] Electron 环境，使用原生 TCP 连接:', url)
        return url
      } else {
        // 没有端口，添加默认 MQTT TCP 端口 1883
        const urlWithPort = url + ':1883'
        console.log('[MQTT] Electron 环境，添加默认 TCP 端口:', urlWithPort)
        return urlWithPort
      }
    }

    // 浏览器环境：转换为 WebSocket
    let wsUrl = url
    
    // tcp://host:port 或 mqtt://host:port → ws://host:port/mqtt
    if (url.startsWith('tcp://') || url.startsWith('mqtt://')) {
      // 先转换协议
      wsUrl = url.replace('tcp://', 'ws://').replace('mqtt://', 'ws://')
      
      // 检查是否有端口号（在协议后面查找 :数字）
      // 匹配格式：ws://host:port 或 ws://host
      const portMatch = wsUrl.match(/:\/\/[^:\/]+:(\d+)/)
      
      if (portMatch) {
        // 有端口号，检查是否是 TCP 端口 1883，需要转换为 WebSocket 端口 8083
        const port = portMatch[1]
        if (port === '1883') {
          wsUrl = wsUrl.replace(':1883', ':8083')
          console.log('[MQTT] 将 TCP 端口 1883 转换为 WebSocket 端口 8083')
        }
      } else {
        // 没有端口，添加默认 WebSocket 端口 8083（EMQX/阿里云 IoT）
        console.log('[MQTT] URL 缺少端口，添加默认 WebSocket 端口 8083')
        wsUrl = wsUrl + ':8083'
      }
      
      // 检查是否有路径
      const urlParts = wsUrl.split('/')
      const hasPath = urlParts.length > 3 // ws://host:port/path
      
      if (!hasPath) {
        // 没有路径，添加默认路径 /mqtt
        wsUrl = wsUrl + '/mqtt'
        console.log('[MQTT] 添加默认路径 /mqtt')
      }
    }

    console.log('[MQTT] URL 转换: %s → %s', url, wsUrl)
    return wsUrl
  }

  /**
   * 连接MQTT服务器
   */
  async connect() {
    if (!this.mqttConfig) {
      throw new Error('MQTT配置为空，请先初始化')
    }

    let { url, userName, pwd, clientId, subscribe } = this.mqttConfig

    console.log('[MQTT] 原始URL:', url)

    // 🔧 URL 转换：浏览器环境需要使用 WebSocket 协议
    url = this.convertToWebSocketUrl(url)
    console.log('[MQTT] 转换后URL:', url)

    // 生成 cpuId
    const cpuId = getMqttCpuId(this.userInfo?.userName, this.userInfo?.userId)
    
    // 构建状态主题（阿里云格式：/{productKey}/{deviceName}/user/as/mqtt/statusV2）
    if (subscribe) {
      const parts = subscribe.split('/')
      if (parts.length >= 3) {
        const prefix = `/${parts[1]}/${parts[2]}`
        this.statusTopic = `${prefix}/user/as/mqtt/statusV2`
        console.log('[MQTT] 状态主题:', this.statusTopic)
      }
    }
    
    // MQTT连接选项
    const options = {
      clientId: clientId,
      username: userName,
      password: pwd,
      clean: true,
      reconnectPeriod: 5000, // 初始重连间隔 5 秒
      connectTimeout: 30 * 1000,
      keepalive: 60,
      rejectUnauthorized: false,
      
      // 设置 Last Will（遗嘱消息）- 用于异常断线时自动发送
      will: {
        topic: this.statusTopic,
        payload: JSON.stringify({
          clientId: clientId,
          cpuId: cpuId,
          userId: this.userInfo?.userId || '',
          userName: this.userInfo?.userName || '',
          status: 'offline', // 下线
          timestamp: Date.now(),
          reason: 'unexpected' // 异常断线
        }),
        qos: 1,
        retain: false
      }
    }

    try {
      // 标记为非手动断开
      this.isManualDisconnect = false
      
      // 创建MQTT客户端
      this.client = mqtt.connect(url, options)

      // 监听连接成功
      this.client.on('connect', () => {
        const isReconnect = this.reconnectAttempts > 0
        console.log(`[MQTT] ✅ ${isReconnect ? '重连' : '连接'}成功`)
        this.isConnected = true
        const previousAttempts = this.reconnectAttempts
        this.reconnectAttempts = 0
        
        // 重连成功后，重置为初始重连间隔
        if (this.client && this.client.options) {
          this.client.options.reconnectPeriod = 5000
        }
        
        // 更新Store状态
        const mqttStore = useMqttStore()
        mqttStore.updateConnectionStatus(true)
        
        // 订阅主题
        this.subscribe()
        
        // 发送上线状态
        this.publishOnlineStatus()
        
        // 获取进行中总数（首次连接或重连都需要刷新）
        // 使用异步方式调用，避免错误中断其他流程
        this.refreshInProgressCount().catch(err => {
          console.error('[MQTT] 刷新进行中总数失败:', err)
        })
        
        // 触发全局事件
        if (window.$eventBus) {
          if (previousAttempts > 0) {
            // 重连成功
            console.log('[MQTT] 触发 mqtt-reconnected 事件')
            window.$eventBus.emit('mqtt-reconnected')
          } else {
            // 首次连接成功
            console.log('[MQTT] 触发 mqtt-connected 事件')
            window.$eventBus.emit('mqtt-connected')
          }
        }
        
        // 不显示连接成功通知，避免打扰用户
        // this.showNotification('MQTT连接成功', '已成功连接到消息服务器', 'success')
      })

      // 监听消息
      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message)
      })

      // 监听错误
      this.client.on('error', (error) => {
        console.error('[MQTT] 连接错误:', error)
        // 不显示错误通知，只在控制台记录
        // this.showNotification('MQTT连接错误', error.message, 'error')
      })

      // 监听断开连接
      this.client.on('close', () => {
        console.log('[MQTT] 连接已关闭')
        this.isConnected = false
        
        // 更新Store状态
        const mqttStore = useMqttStore()
        mqttStore.updateConnectionStatus(false)
        
        // 如果不是手动断开，报告异常下线
        if (!this.isManualDisconnect) {
          this.reportOfflineStatus('unexpected').catch(err => {
            console.error('[MQTT] 报告下线状态失败:', err)
          })
        }
      })

      // 监听重连
      this.client.on('reconnect', () => {
        // 如果是手动断开，不进行重连
        if (this.isManualDisconnect) {
          console.log('[MQTT] ⛔ 手动断开，停止重连')
          if (this.client) {
            this.client.end(true)
          }
          return
        }
        
        this.reconnectAttempts++
        
        // 使用指数退避策略动态调整重连间隔
        // 5秒 -> 10秒 -> 20秒 -> 40秒 -> 60秒 -> 120秒（最大2分钟）
        let newReconnectPeriod = Math.min(
          5000 * Math.pow(2, Math.floor(this.reconnectAttempts / 3)),
          120000 // 最大 2 分钟
        )
        
        if (this.client && this.client.options) {
          this.client.options.reconnectPeriod = newReconnectPeriod
        }
        
        const nextRetrySeconds = Math.round(newReconnectPeriod / 1000)
        console.log(`[MQTT] 🔄 正在重连... (第 ${this.reconnectAttempts} 次，下次间隔 ${nextRetrySeconds} 秒)`)
      })

      // 监听离线
      this.client.on('offline', () => {
        console.log('[MQTT] 客户端离线')
        this.isConnected = false
        
        // 报告离线状态
        if (!this.isManualDisconnect) {
          this.reportOfflineStatus('unexpected').catch(err => {
            console.error('[MQTT] 报告下线状态失败:', err)
          })
        }
      })

    } catch (error) {
      console.error('[MQTT] 连接失败:', error)
      throw error
    }
  }

  /**
   * 订阅主题
   */
  subscribe() {
    if (!this.client || !this.mqttConfig) {
      console.error('[MQTT] 客户端未初始化或配置为空')
      return
    }

    const { subscribe } = this.mqttConfig
    
    // 从订阅主题中提取前缀，用于构建状态主题
    // 例如：/a1DLcjz8jcG/jExC3NUNZK70BuVx3uTP/user/get -> /a1DLcjz8jcG/jExC3NUNZK70BuVx3uTP
    const parts = subscribe.split('/')
    if (parts.length >= 3) {
      const prefix = `/${parts[1]}/${parts[2]}`
      this.statusTopic = `${prefix}/user/as/mqtt/statusV2`
      console.log('[MQTT] 状态主题已设置为:', this.statusTopic)
    }
    
    // 只订阅带通配符的主题，避免重复接收消息
    const topic = `${subscribe}/#`
    
    this.client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        console.error(`[MQTT] 订阅主题失败 ${topic}:`, err)
      } else {
        console.log(`[MQTT] 成功订阅主题: ${topic}`)
      }
    })
  }

  /**
   * 处理接收到的消息
   * @param {string} topic - 主题
   * @param {Buffer} message - 消息内容
   */
  handleMessage(topic, message) {
    try {
      console.log(`[MQTT] 🔔 收到消息 - 主题: ${topic}`)
      
      // 将Buffer转为字符串
      let messageStr = message.toString()
      console.log('[MQTT] 📝 原始消息:', messageStr)
      
      // 先尝试直接解析JSON（大多数情况下消息是明文JSON）
      let messageData = null
      try {
        messageData = JSON.parse(messageStr)
        console.log('[MQTT] 消息解析成功（明文JSON）:', messageData)
      } catch (e) {
        // 如果直接解析失败，尝试解密
        console.log('[MQTT] 消息不是明文JSON，尝试解密...')
        
        try {
          // 如果消息被双引号包裹，先去除
          if (messageStr.startsWith('"') && messageStr.endsWith('"')) {
            messageStr = messageStr.slice(1, -1)
          }
          
          // 尝试AES解密
          const decryptedMessage = decryptAES(DEVICE_CONFIG.DEVICE_KEY, messageStr)
          console.log('[MQTT] 解密后消息:', decryptedMessage)
          
          // 解析解密后的消息
          if (decryptedMessage) {
            messageData = JSON.parse(decryptedMessage)
            console.log('[MQTT] 解密消息解析成功:', messageData)
          }
        } catch (decryptError) {
          console.warn('[MQTT] 解密失败，使用原始消息:', decryptError)
          messageData = { content: messageStr }
        }
      }
      
      // 如果还是没有解析出数据，使用默认值
      if (!messageData) {
        messageData = { content: messageStr }
      }
      
      // 🔧 从主题中提取消息类型（如果消息体中没有 type 字段）
      // 主题格式：/a1DLcjz8jcG/xxx/user/get/501
      console.log('[MQTT] 🔍 检查消息类型 - type:', messageData.type, 'typeCode:', messageData.typeCode, 'msgType:', messageData.msgType)
      
      if (!messageData.type && !messageData.typeCode && !messageData.msgType) {
        const topicParts = topic.split('/')
        const lastPart = topicParts[topicParts.length - 1]
        console.log('[MQTT] 🔍 主题最后部分:', lastPart, '是否为数字:', !isNaN(lastPart))
        if (lastPart && !isNaN(lastPart)) {
          messageData.type = parseInt(lastPart)
          console.log('[MQTT] ✅ 从主题中提取消息类型:', messageData.type)
        } else {
          console.warn('[MQTT] ⚠️ 无法从主题中提取消息类型，主题结构:', topicParts)
        }
      } else {
        console.log('[MQTT] ✅ 消息体中已包含类型字段')
      }
      
      // 调用消息处理器
      this.messageHandlers.forEach(handler => {
        try {
          handler(topic, messageData)
        } catch (error) {
          console.error('[MQTT] 消息处理器执行失败:', error)
        }
      })
      
      // 显示系统通知
      this.showMessageNotification(messageData)
      
    } catch (error) {
      console.error('[MQTT] 处理消息失败:', error)
    }
  }

  /**
   * 显示消息通知
   * @param {object} messageData - 消息数据
   */
  showMessageNotification(messageData) {
    console.log('[MQTT] 📢 开始显示消息通知, 消息类型:', messageData.type)
    
    // 使用统一的消息处理器
    const processedMessage = handleMqttMessage(messageData)
    console.log('[MQTT] 📢 处理后的消息:', processedMessage)
    
    // 特殊处理501类型消息
    if (messageData.type === 501 || messageData.type === MQTT_MESSAGE_TYPE.PUSH_NOTIFICATION) {
      console.log('[MQTT] 🔔 收到501推送通知 ===>', processedMessage)
      console.log('[MQTT] 🔔 501消息详情 - 标题:', processedMessage.title, '内容:', processedMessage.content)
      
      const data = processedMessage.data || {}
      
      // ⚡ 所有501通知都刷新进行中总数
      console.log('[MQTT] ⚡ 收到通知，立即刷新进行中总数')
      this.refreshInProgressCount().catch(err => {
        console.error('[MQTT] 刷新进行中总数失败:', err)
      })
      
      // ⚡ 特殊处理：businessType === 4 时不显示通知，只刷新数据
      if (data.businessType === 4) {
        console.log('[MQTT] ⚡ 检测到 businessType === 4，不显示通知')
        return
      }
      
      // 可以在这里添加501特殊的处理逻辑
      // 例如：播放提示音、震动等
    } else {
      console.log('[MQTT] 📬 收到其他类型消息:', messageData.type)
    }
    
    // 🔔 Electron 环境：使用自定义通知卡片 + 托盘图标闪烁
    if (window.electronAPI) {
      console.log('[MQTT] 💻 Electron 环境，使用自定义通知卡片')
      // 显示自定义通知卡片
      this.showTrayNotification(processedMessage)
      // 注意：不再使用原生系统通知
    } else {
      // 浏览器环境：使用系统桌面通知
      console.log('[MQTT] 🌐 浏览器环境，使用系统桌面通知')
      this.showSystemNotification(processedMessage)
    }
  }

  /**
   * 显示 Electron 托盘通知（带闪烁和浮窗）
   * @param {object} processedMessage - 处理后的消息数据
   */
  showTrayNotification(processedMessage) {
    try {
      // 检查 electronAPI 是否仍然可用（防止窗口已被销毁）
      if (!window.electronAPI) {
        console.warn('[MQTT] ⚠️ electronAPI 不可用，跳过托盘通知')
        return
      }
      
      const messageType = processedMessage.type
      const data = processedMessage.data || {}
      const notificationContent = data.content || processedMessage.content || ''
      
      // 防重复：500ms 内相同内容的通知不重复显示
      const now = Date.now()
      if (!this._lastNotificationContent) {
        this._lastNotificationContent = ''
        this._lastNotificationTime = 0
      }
      if (notificationContent === this._lastNotificationContent && (now - this._lastNotificationTime) < 500) {
        console.log('[MQTT] 🔔 防重复：跳过相同内容的通知')
        return
      }
      this._lastNotificationContent = notificationContent
      this._lastNotificationTime = now
      
      console.log('[MQTT] 🔔 showTrayNotification - messageType:', messageType, 'typeof:', typeof messageType)
      
      // 聊天消息（551）使用简洁的 toast 通知，3秒后自动消失
      // 但是系统消息（fromUserId=1 或 fromUserName="系统"）不做任何通知处理
      if (messageType === 551 || messageType === MQTT_MESSAGE_TYPE.CHAT_MESSAGE) {
        // 检查是否是系统消息（通过聊天渠道发送的系统通知）
        const isSystemMessage = data.fromUserId === 1 || 
                                data.fromUserId === '1' || 
                                data.fromUserName === '系统' ||
                                data.fromUserName === 'admin' ||
                                data.fromUserName === 'system'
        
        if (isSystemMessage) {
          // 551 系统消息不做任何通知处理，直接忽略
          // 因为 501 消息已经会显示系统通知卡片
          console.log('[MQTT] 🔔 551 系统消息，忽略不处理（由 501 消息处理）')
          return
        }
        
        // 普通聊天消息
        const senderName = data.fromUserName || '新消息'
        const messageContent = data.content || processedMessage.content || '您有新的消息'
        
        console.log('[MQTT] 💬 聊天消息通知 -', '发送者:', senderName, '内容:', messageContent)
        console.log('[MQTT] 💬 完整 data 对象:', JSON.stringify(data))
        console.log('[MQTT] 💬 fromUserId:', data.fromUserId, 'sessionId:', data.sessionId)
        
        // 使用简洁的 toast 通知
        if (window.electronAPI.showChatToast) {
          window.electronAPI.showChatToast({
            sender: senderName,
            content: messageContent,
            avatar: data.fromUserAvatar || '',
            duration: 3000,  // 3秒后自动消失
            data: data
          })
        } else if (window.electronAPI.showNotificationCard) {
          // 降级：使用通知卡片但设置自动关闭
          window.electronAPI.showNotificationCard({
            title: senderName,
            content: messageContent,
            type: 'chat',
            autoClose: 3000,  // 3秒后自动关闭
            buttons: [],  // 不显示按钮
            data: data
          })
        }
        return
      }
      
      // 系统消息（501等）使用完整的通知卡片
      const title = processedMessage.title || 'MQTT消息推送'
      const content = processedMessage.content || '您有新的消息'
      
      console.log('[MQTT] 💬 准备发送通知卡片 -', '标题:', title, '内容:', content)
      console.log('[MQTT] 💬 完整消息数据:', processedMessage)
      
      // 使用新的自定义通知卡片 API（自动弹出，类似钉钉）
      if (window.electronAPI.showNotificationCard) {
        window.electronAPI.showNotificationCard({
          title: title,
          content: content,
          type: 'info',
          buttons: [
            { text: '稍后查看', type: 'secondary', action: 'later' },
            { text: '立即查看', type: 'primary', action: 'view-mqtt' }
          ],
          autoClose: false,
          data: processedMessage.data
        })
      } else {
        // 降级方案：使用旧的托盘通知（闪烁 + 鼠标移入显示）
        console.log('[MQTT] 降级使用托盘通知')
        if (window.electronAPI.sendNotification) {
          window.electronAPI.sendNotification({
            title: title,
            content: content,
            time: new Date().toLocaleTimeString('zh-CN', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            type: 'mqtt',
            messageType: processedMessage.type,
            data: processedMessage.data
          })
        }
      }
      
      console.log('[MQTT] 通知已发送')
      
    } catch (error) {
      console.error('[MQTT] 显示托盘通知失败:', error)
      // 如果是 "Object has been destroyed" 错误，不再降级
      if (error.message && error.message.includes('destroyed')) {
        console.warn('[MQTT] 窗口已销毁，跳过通知')
        return
      }
      // 其他错误降级到系统通知
      this.showSystemNotification(processedMessage)
    }
  }

  /**
   * 显示系统级桌面通知（像钉钉那样）
   * @param {object} processedMessage - 处理后的消息数据
   */
  showSystemNotification(processedMessage) {
    // 检查浏览器是否支持通知
    if (!('Notification' in window)) {
      console.warn('[MQTT] 浏览器不支持桌面通知')
      return
    }

    // 检查权限
    if (Notification.permission !== 'granted') {
      console.warn('[MQTT] 没有桌面通知权限')
      this.requestNotificationPermission()
      return
    }

    try {
      const title = processedMessage.title || '系统消息'
      const body = processedMessage.content || ''
      
      console.log('[MQTT] 显示通知 -', '标题:', title, '内容:', body)
      
      // 获取图标路径
      let iconPath = undefined // 不使用图标，避免路径问题
      
      // 只在 Web 环境中使用图标
      if (window.location.protocol !== 'file:') {
        iconPath = window.location.origin + '/favicon.ico'
      }
      
      // 创建系统通知
      const notification = new Notification(title, {
        body: body,
        icon: iconPath,
        requireInteraction: false, // 自动消失
        silent: false,
        data: processedMessage.data
      })

      // 点击通知时的处理
      notification.onclick = () => {
        try {
          // 检查 window 是否仍然有效
          if (window && !window.closed) {
            window.focus()
          }
          notification.close()
          
          if (processedMessage.data) {
            this.handleNotificationClick(processedMessage)
          }
        } catch (error) {
          console.error('[MQTT] 处理通知点击失败:', error)
        }
      }

    } catch (error) {
      console.error('[MQTT] 创建系统通知失败:', error)
    }
  }

  /**
   * 显示系统通知
   * @param {string} title - 标题
   * @param {string} message - 消息
   * @param {string} type - 类型
   */
  showNotification(title, message, type = 'info') {
    ElNotification({
      title: title,
      message: message,
      type: type,
      duration: 3000,
      position: 'top-right'
    })
  }

  /**
   * 处理通知点击事件
   * @param {object} messageData - 处理后的消息数据或托盘通知数据
   */
  handleNotificationClick(messageData) {
    console.log('[MQTT] 🔔 handleNotificationClick 被调用')
    console.log('[MQTT] 🔔 messageData:', messageData)
    console.log('[MQTT] 🔔 messageData 类型:', typeof messageData)
    
    // 提取数据
    const data = messageData.data || messageData
    
    // 检查是否为 501 推送通知（通过 businessType 和 massageType 判断）
    if (data && (data.businessType !== undefined || data.massageType !== undefined)) {
      console.log('[MQTT] ✅ 检测到 501 推送通知数据，businessType:', data.businessType, 'massageType:', data.massageType)
      this.handle501Navigation(messageData)
      return
    }
    
    // 兼容托盘通知数据格式（type 是 'mqtt', messageType 才是真正的消息类型）
    const msgType = messageData.messageType || messageData.type
    
    switch(msgType) {
      case MQTT_MESSAGE_TYPE.ORDER_NEW:
      case MQTT_MESSAGE_TYPE.ORDER_UPDATE:
        // 跳转到订单详情
        if (data.orderId) {
          console.log('[MQTT] 跳转到订单:', data.orderId)
          // router.push(`/order/detail/${data.orderId}`)
        }
        break
        
      case MQTT_MESSAGE_TYPE.TASK_NEW:
      case MQTT_MESSAGE_TYPE.TASK_UPDATE:
        // 跳转到任务详情
        if (data.taskId) {
          console.log('[MQTT] 跳转到任务:', data.taskId)
          // router.push(`/task/detail/${data.taskId}`)
        }
        break
        
      case 501:
      case MQTT_MESSAGE_TYPE.PUSH_NOTIFICATION:
        // 501推送通知的特殊处理
        console.log('[MQTT] 501推送通知被点击:', data)
        this.handle501Navigation(data)
        break
      
      case 'mqtt':
        // 托盘通知被点击（通用处理）
        console.log('[MQTT] MQTT 托盘通知被点击')
        // 可以在这里添加跳转到消息中心等操作
        break
        
      default:
        console.log('[MQTT] 通知被点击:', messageData)
    }
  }

  /**
   * 处理501推送通知的路由跳转
   * @param {object} data - 消息数据
   * @param {number} data.businessType - 业务类型 1=交办 2=待办
   * @param {number} data.massageType - 消息类型 1-10
   */
  handle501Navigation(data) {
    try {
      console.log('[MQTT] 📍 handle501Navigation 被调用，原始 data:', data)
      console.log('[MQTT] 📍 data 类型:', typeof data, '是否为对象:', data && typeof data === 'object')
      
      // 数据可能在 data.data 中（通知卡片格式）或直接在 data 中
      const actualData = data.data || data
      console.log('[MQTT] 📍 actualData:', actualData)
      console.log('[MQTT] 📍 actualData.businessType:', actualData?.businessType, 'actualData.massageType:', actualData?.massageType)
      
      const businessType = actualData.businessType
      const massageType = actualData.massageType
      
      console.log('[MQTT] 导航参数 - businessType:', businessType, 'massageType:', massageType)
      
      // 特殊处理：businessType === 4 时刷新进行中总数
      if (businessType === 4) {
        console.log('[MQTT] 检测到 businessType === 4，刷新进行中总数')
        this.refreshInProgressCount()
        return
      }
      
      if (!businessType || !massageType) {
        console.warn('[MQTT] 缺少必要的导航参数')
        // 如果有url，尝试打开
        if (data.action === 'view' && data.url) {
          window.open(data.url, '_blank')
        }
        return
      }
      
      // 确定路由路径和tab
      let routePath = ''
      let tabKey = 'all'
      
      /**
       * 消息类型分类：
       * 1. 待办提醒 - 通知接收人有新待办
       * 2. 拒绝待办 - 通知创建人待办被拒绝
       * 3. 接受待办 - 通知创建人待办被接受
       * 4. 完成待办 - 通知创建人待办已完成
       * 5. 待办延期 - 通知创建人接收人申请延期
       * 6. 交办转移 - 交办业务转移
       * 7. 待办逾期提醒 - 通知接收人待办逾期
       * 8. 交办逾期提醒 - 通知创建人交办逾期
       * 9. 撤销待办提醒 - 通知接收人待办被撤销
       * 10. 交办完成提醒 - 通知创建人交办完成
       * 11. 闹钟提醒 - 交办/待办的闹钟提醒
       */
      const notifyCreatorTypes = [2, 3, 4, 5, 8, 10]  // 通知创建人/交办人
      const notifyReceiverTypes = [1, 7, 9]           // 通知接收人/待办人
      const assignBusinessTypes = [6]                 // 交办业务
      const alarmReminderTypes = [11]                 // 闹钟提醒
      
      if (notifyCreatorTypes.includes(massageType)) {
        // 通知创建人/交办人 → 我的交办
        routePath = '/my-assign'
        
        switch(massageType) {
          case 2:  // 拒绝待办提醒 - 待办被拒绝，交办还在进行中
          case 3:  // 接受待办提醒 - 待办被接受，交办还在进行中
          case 5:  // 待办延期提醒 - 接收人申请延期，交办还在进行中
          case 8:  // 交办逾期提醒
            tabKey = 'inProgress'  // 进行中
            break
          case 4:  // 完成待办提醒
          case 10: // 交办完成提醒
            tabKey = 'completed'   // 已完成
            break
          default:
            tabKey = 'all'
        }
      } else if (notifyReceiverTypes.includes(massageType)) {
        // 通知接收人/待办人 → 我的待办
        routePath = '/my-todo'
        
        switch(massageType) {
          case 1:  // 待办提醒 - 新的待办，还未接受
            tabKey = 'pending'     // 待处理
            break
          case 7:  // 待办逾期提醒 - 正在处理中但逾期
            tabKey = 'inProgress'  // 进行中
            break
          case 9:  // 撤销待办提醒
            tabKey = 'all'         // 全部
            break
          default:
            tabKey = 'all'
        }
      } else if (assignBusinessTypes.includes(massageType)) {
        // 交办业务 → 我的交办
        routePath = '/my-assign'
        
        switch(massageType) {
          case 6:  // 交办转移
            tabKey = 'inProgress'  // 进行中
            break
          default:
            tabKey = 'all'
        }
      } else if (alarmReminderTypes.includes(massageType)) {
        // 闹钟提醒 → 根据 businessType 跳转到对应页面的"进行中"tab
        console.log('[MQTT] 闹钟提醒 - businessType:', businessType)
        if (businessType === 1) {
          // 交办闹钟提醒 → 我的交办
          routePath = '/my-assign'
        } else if (businessType === 2) {
          // 待办闹钟提醒 → 我的待办
          routePath = '/my-todo'
        } else {
          console.warn('[MQTT] 闹钟提醒的 businessType 无效:', businessType)
          routePath = '/my-todo' // 默认跳转到待办
        }
        tabKey = 'inProgress'
      } else {
        console.warn('[MQTT] 未知的 massageType:', massageType)
        // 默认根据 businessType 跳转
        if (businessType === 1) {
          routePath = '/my-assign'
        } else if (businessType === 2) {
          routePath = '/my-todo'
        } else {
          console.warn('[MQTT] 未知的 businessType:', businessType)
          return
        }
        tabKey = 'all'
      }
      
      console.log('[MQTT] 准备跳转 - 路径:', routePath, 'Tab:', tabKey)
      
      // 使用路由跳转并传递 tab 参数
      const router = window.$router
      if (router) {
        const currentRoute = router.currentRoute.value
        const isSamePage = currentRoute.path === routePath
        const isSameTab = currentRoute.query.tab === tabKey
        
        if (isSamePage && isSameTab) {
          // 如果已经在同一页面的同一 tab，触发刷新事件
          console.log('[MQTT] 💡 已在目标页面和 tab，触发刷新事件')
          if (window.$eventBus) {
            // 根据不同页面触发不同的刷新事件
            if (routePath === '/my-todo') {
              window.$eventBus.emit('refresh-todo-list')
            } else if (routePath === '/my-assign') {
              window.$eventBus.emit('refresh-assignment-list')
            } else if (routePath === '/my-process') {
              window.$eventBus.emit('refresh-process-list')
            }
          }
        } else if (isSamePage && !isSameTab) {
          // 如果在同一页面但不同 tab，只需要更新 query 并触发刷新
          console.log('[MQTT] 💡 在同一页面但不同 tab，更新 query')
          router.replace({
            path: routePath,
            query: { tab: tabKey }
          })
        } else {
          // 跳转到不同页面
          router.push({
            path: routePath,
            query: { tab: tabKey }
          })
          console.log('[MQTT] ✅ 路由跳转成功')
        }
      } else {
        console.error('[MQTT] ❌ router 未定义，无法跳转')
        // 降级方案：使用 window.location
        const url = `${window.location.origin}/#${routePath}?tab=${tabKey}`
        window.location.href = url
        console.log('[MQTT] 使用降级方案跳转:', url)
      }
      
      // 聚焦窗口（如果在 Electron 环境）
      if (window.electronAPI && window.electronAPI.showWindow) {
        window.electronAPI.showWindow()
      }
    } catch (error) {
      console.error('[MQTT] 处理501导航失败:', error)
    }
  }

  /**
   * 刷新进行中总数（businessType === 4）
   */
  async refreshInProgressCount() {
    try {
      console.log('[MQTT] 开始刷新进行中总数...')
      
      // 动态导入 API 方法和 store
      const { getAssignmentInProgressCount } = await import('@/api/todo.js')
      const { default: useMqttStore } = await import('@/store/modules/mqtt.js')
      
      // 调用接口获取进行中总数
      const response = await getAssignmentInProgressCount()
      
      if (response.code === 200) {
        const data = response.data || {}
        console.log('[MQTT] ✅ 进行中数据:', data)
        
        // 更新全局 store 中的所有进行中数量
        const mqttStore = useMqttStore()
        mqttStore.updateInProgressCounts(data)
        console.log('[MQTT] ✅ 已更新 store 中的所有进行中数量')
      } else {
        console.error('[MQTT] ❌ 刷新进行中总数失败:', response.msg)
      }
    } catch (error) {
      console.error('[MQTT] ❌ 刷新进行中总数异常:', error)
    }
  }

  /**
   * 发布上线状态
   */
  async publishOnlineStatus() {
    const cpuId = getMqttCpuId(this.userInfo?.userName, this.userInfo?.userId)
    
    // 从订阅主题提取 productKey 和 deviceName
    let productKey = 'a1DLcjz8jcG'
    let deviceName = ''
    if (this.mqttConfig?.subscribe) {
      const parts = this.mqttConfig.subscribe.split('/')
      if (parts.length >= 3) {
        productKey = parts[1]
        deviceName = parts[2]
      }
    }
    
    const statusData = {
      clientId: this.mqttConfig?.clientId || '',
      cpuId: cpuId,
      userId: this.userInfo?.userId || '',
      userName: this.userInfo?.userName || '',
      status: 'online', // 上线
      timestamp: Date.now(),
      reason: 'normal_login',
      productKey: productKey,
      deviceName: deviceName
    }
    
    console.log('[MQTT] 发送上线状态:', statusData)
    
    // 1. 发送 MQTT 消息
    this.publish(this.statusTopic, statusData)
    
    // 2. 调用 HTTP 接口上报状态
    try {
      await reportDeviceStatus(statusData)
      console.log('[MQTT] ✅ 上线状态已上报到后端接口')
    } catch (error) {
      console.error('[MQTT] ❌ 上线状态上报失败:', error)
    }
    
    // 3. 启动心跳定时器（每1分钟发送一次）
    this.startHeartbeat()
  }

  /**
   * 发布下线状态
   * @param {string} reason - 下线原因
   * @returns {Promise} 发布结果
   */
  async publishOfflineStatus(reason = 'normal_logout') {
    // 停止心跳定时器
    this.stopHeartbeat()
    
    if (!this.client || !this.isConnected) {
      console.warn('[MQTT] 客户端未连接，无法发送下线状态')
      return Promise.resolve()
    }

    const cpuId = getMqttCpuId(this.userInfo?.userName, this.userInfo?.userId)
    
    // 从订阅主题提取 productKey 和 deviceName
    let productKey = 'a1DLcjz8jcG'
    let deviceName = ''
    if (this.mqttConfig?.subscribe) {
      const parts = this.mqttConfig.subscribe.split('/')
      if (parts.length >= 3) {
        productKey = parts[1]
        deviceName = parts[2]
      }
    }
    
    const statusData = {
      clientId: this.mqttConfig?.clientId || '',
      cpuId: cpuId,
      userId: this.userInfo?.userId || '',
      userName: this.userInfo?.userName || '',
      status: 'offline', // 下线
      timestamp: Date.now(),
      reason: reason,
      productKey: productKey,
      deviceName: deviceName
    }
    
    console.log('[MQTT] 发送下线状态:', statusData)
    
    // 1. 调用 HTTP 接口上报状态
    try {
      await reportDeviceStatus(statusData)
      console.log('[MQTT] ✅ 下线状态已上报到后端接口')
    } catch (error) {
      console.error('[MQTT] ❌ 下线状态上报失败:', error)
    }
    
    // 2. 发送 MQTT 消息
    return new Promise((resolve) => {
      const messageStr = JSON.stringify(statusData)
      this.client.publish(this.statusTopic, messageStr, { qos: 1 }, (err) => {
        if (err) {
          console.error('[MQTT] 发布下线状态失败:', err)
        } else {
          console.log('[MQTT] 下线状态已发布')
        }
        resolve()
      })
    })
  }

  /**
   * 启动心跳定时器（每1分钟发送一次）
   * 心跳会持续运行，即使断网也不停止，网络恢复后自动继续
   */
  startHeartbeat() {
    // 先清除旧的定时器，避免重复启动
    this.stopHeartbeat()
    
    console.log('[MQTT] 💓 启动心跳定时器，间隔 1 分钟')
    
    // 每1分钟发送一次心跳
    this.heartbeatTimer = setInterval(async () => {
      // 检查是否有必要的参数
      if (!this.userInfo?.userName || !this.userInfo?.userId) {
        console.log('[MQTT] ⏸️ 心跳暂停：缺少用户信息，1分钟后重试')
        return
      }
      
      if (!this.mqttConfig?.clientId) {
        console.log('[MQTT] ⏸️ 心跳暂停：缺少MQTT配置，1分钟后重试')
        return
      }
      
      const cpuId = getMqttCpuId(this.userInfo.userName, this.userInfo.userId)
      
      // 从订阅主题提取 productKey 和 deviceName
      let productKey = 'a1DLcjz8jcG'
      let deviceName = ''
      if (this.mqttConfig?.subscribe) {
        const parts = this.mqttConfig.subscribe.split('/')
        if (parts.length >= 3) {
          productKey = parts[1]
          deviceName = parts[2]
        }
      }
      
      const heartbeatData = {
        clientId: this.mqttConfig.clientId,
        cpuId: cpuId,
        userId: this.userInfo.userId,
        userName: this.userInfo.userName,
        status: 'online', // 心跳也是在线状态
        timestamp: Date.now(),
        reason: 'heartbeat',
        productKey: productKey,
        deviceName: deviceName
      }
      
      console.log('[MQTT] 💓 发送心跳:', heartbeatData)
      
      // 调用 HTTP 接口上报心跳
      // 不管网络是否可用，都尝试发送，失败了也没关系
      try {
        await reportDeviceStatus(heartbeatData)
        console.log('[MQTT] ✅ 心跳已发送')
      } catch (error) {
        console.error('[MQTT] ❌ 心跳发送失败（网络可能断开）:', error.message)
        // 不抛出错误，继续下一次心跳
      }
    }, 1 * 60 * 1000) // 1分钟 = 60000毫秒
  }
  
  /**
   * 停止心跳定时器
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
      console.log('[MQTT] 💤 心跳定时器已停止')
    }
  }

  /**
   * 报告下线状态（仅调用 HTTP 接口，不发送 MQTT 消息）
   * 用于异常断线、网络中断等场景
   * @param {string} reason - 下线原因
   */
  async reportOfflineStatus(reason = 'unexpected') {
    // 防抖：2秒内只允许提交一次
    const now = Date.now()
    if (this._lastOfflineReportTime && now - this._lastOfflineReportTime < 2000) {
      console.log('[MQTT] ⏭️ 跳过重复的离线状态报告（距上次提交 ' + (now - this._lastOfflineReportTime) + 'ms）')
      return
    }
    this._lastOfflineReportTime = now
    
    const cpuId = getMqttCpuId(this.userInfo?.userName, this.userInfo?.userId)
    
    // 从订阅主题提取 productKey 和 deviceName
    let productKey = 'a1DLcjz8jcG'
    let deviceName = ''
    if (this.mqttConfig?.subscribe) {
      const parts = this.mqttConfig.subscribe.split('/')
      if (parts.length >= 3) {
        productKey = parts[1]
        deviceName = parts[2]
      }
    }
    
    const statusData = {
      clientId: this.mqttConfig?.clientId || '',
      cpuId: cpuId,
      userId: this.userInfo?.userId || '',
      userName: this.userInfo?.userName || '',
      status: 'offline',
      timestamp: Date.now(),
      reason: reason,
      productKey: productKey,
      deviceName: deviceName
    }
    
    console.log('[MQTT] ⚠️ 报告异常下线:', statusData)
    
    // 只调用 HTTP 接口，不发送 MQTT 消息
    try {
      await reportDeviceStatus(statusData)
      console.log('[MQTT] ✅ 异常下线已上报')
    } catch (error) {
      console.error('[MQTT] ❌ 异常下线上报失败:', error)
      throw error
    }
  }

  /**
   * 发布消息
   * @param {string} topic - 主题
   * @param {object|string} message - 消息内容
   */
  publish(topic, message) {
    if (!this.client || !this.isConnected) {
      console.error('[MQTT] 客户端未连接')
      return
    }

    const messageStr = typeof message === 'string' ? message : JSON.stringify(message)
    
    this.client.publish(topic, messageStr, { qos: 1 }, (err) => {
      if (err) {
        console.error('[MQTT] 发布消息失败:', err)
      } else {
        console.log(`[MQTT] 消息已发布到主题 ${topic}:`, messageStr)
      }
    })
  }

  /**
   * 注册消息处理器
   * @param {Function} handler - 处理函数 (topic, messageData) => {}
   */
  onMessage(handler) {
    if (typeof handler === 'function') {
      this.messageHandlers.push(handler)
    }
  }

  /**
   * 移除消息处理器
   * @param {Function} handler - 要移除的处理函数
   */
  offMessage(handler) {
    const index = this.messageHandlers.indexOf(handler)
    if (index > -1) {
      this.messageHandlers.splice(index, 1)
    }
  }

  /**
   * 断开连接
   * @param {string} reason - 断开原因
   */
  async disconnect(reason = 'normal_logout') {
    if (this.client) {
      console.log('[MQTT] 正在断开连接...')
      
      try {
        // 标记为手动断开，防止自动重连
        this.isManualDisconnect = true
        
        // 先发送下线状态（等待发送完成）
        await this.publishOfflineStatus(reason)
        
        // 等待消息发送完成
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // 移除所有事件监听器，防止回调访问已销毁的对象
        this.client.removeAllListeners()
        this.client.end(true) // 强制立即关闭
        this.client = null
        this.isConnected = false
        this.reconnectAttempts = 0
        
        // 清空消息处理器
        this.messageHandlers = []
        
        // 更新Store状态
        const mqttStore = useMqttStore()
        mqttStore.updateConnectionStatus(false)
        
        console.log('[MQTT] 断开连接完成')
      } catch (error) {
        console.error('[MQTT] 断开连接时出错:', error)
        this.client = null
        this.isConnected = false
        this.reconnectAttempts = 0
      }
    }
  }

  /**
   * 获取连接状态
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      config: this.mqttConfig,
      reconnectAttempts: this.reconnectAttempts
    }
  }
}

// 导出单例
export const mqttClient = new MqttClient()

// 导出类
export default MqttClient
