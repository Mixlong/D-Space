import { getMqttConfig, initDevice, getMqttCpuId } from '@/api/device/mqtt'

const useMqttStore = defineStore('mqtt', {
  state: () => ({
    // MQTT配置信息
    mqttConfig: null,
    // 设备初始化信息
    deviceInfo: null,
    // 连接状态
    isConnected: false,
    // 加载状态
    loading: false,
    // 进行中数量统计
    myTodoInProgress: 0,        // 我的待办进行中
    myAssignmentInProgress: 0,  // 我的交办进行中
    myProcessInProgress: 0,     // 我的流程进行中
    totalInProgress: 0,         // 总进行中
    unreadMessageCount: 0,      // 未读消息数量
    // 兼容旧字段
    assignmentInProgressCount: 0
  }),

  getters: {
    // 获取MQTT连接状态
    getConnectionStatus: (state) => state.isConnected,
    // 获取MQTT配置
    getConfig: (state) => state.mqttConfig,
    // 获取设备信息
    getDeviceInfo: (state) => state.deviceInfo,
    // 获取交办进行中总数
    getAssignmentInProgressCount: (state) => state.assignmentInProgressCount
  },

  actions: {
    /**
     * 获取MQTT配置信息
     */
    async fetchMqttConfig() {
      this.loading = true
      try {
        const res = await getMqttConfig()
        if (res.code === 200) {
          this.mqttConfig = res.data
          return res.data
        } else {
          throw new Error(res.msg || '获取MQTT配置失败')
        }
      } catch (error) {
        console.error('获取MQTT配置失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 设备初始化
     * @param {object} deviceInitVO - 设备初始化参数
     */
    async initializeDevice(deviceInitVO) {
      this.loading = true
      try {
        const res = await initDevice(deviceInitVO)
        if (res.code === 200) {
          this.deviceInfo = res.data
          return res.data
        } else {
          throw new Error(res.msg || '设备初始化失败')
        }
      } catch (error) {
        console.error('设备初始化失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 更新连接状态
     * @param {boolean} status - 连接状态
     */
    updateConnectionStatus(status) {
      this.isConnected = status
    },

    /**
     * 更新交办进行中总数
     * @param {number} count - 进行中总数
     */
    updateAssignmentInProgressCount(count) {
      console.log('[MqttStore] 更新进行中总数:', count)
      this.assignmentInProgressCount = count
    },

    /**
     * 更新所有进行中数量
     * @param {object} data - 进行中数量数据
     */
    updateInProgressCounts(data) {
      console.log('[MqttStore] 更新所有进行中数量:', data)
      this.myTodoInProgress = data.myTodoInProgress || 0
      this.myAssignmentInProgress = data.myAssignmentInProgress || 0
      this.myProcessInProgress = data.myProcessInProgress || 0
      this.totalInProgress = data.totalInProgress || 0
      this.unreadMessageCount = data.unreadMessageCount || 0
      // 兼容旧字段
      this.assignmentInProgressCount = data.myAssignmentInProgress || 0
    },

    /**
     * 清除MQTT配置
     */
    clearMqttConfig() {
      this.mqttConfig = null
      this.deviceInfo = null
      this.isConnected = false
      this.myTodoInProgress = 0
      this.myAssignmentInProgress = 0
      this.myProcessInProgress = 0
      this.totalInProgress = 0
      this.unreadMessageCount = 0
      this.assignmentInProgressCount = 0
    },

    /**
     * 生成MQTT CPU ID
     * @param {string} userName - 用户名
     * @param {string} userId - 用户ID
     */
    generateCpuId(userName, userId) {
      return getMqttCpuId(userName, userId)
    }
  }
})

export default useMqttStore
