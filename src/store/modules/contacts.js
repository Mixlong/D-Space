/**
 * 通讯录 Store
 * 存储通讯录数据，提供全局共享的用户在线状态
 */
import { listUserPucs } from '@/api/system/user'

const useContactsStore = defineStore('contacts', {
  state: () => ({
    // 用户列表
    userList: [],
    // 加载状态
    loading: false,
    // 最后更新时间
    lastUpdateTime: null,
    // 在线用户ID集合（用于快速查询）
    onlineUserIds: new Set()
  }),

  getters: {
    // 获取所有用户
    getAllUsers: (state) => state.userList,
    
    // 获取在线用户
    getOnlineUsers: (state) => state.userList.filter(user => user.pucsOnline === 0),
    
    // 获取离线用户
    getOfflineUsers: (state) => state.userList.filter(user => user.pucsOnline === 1),
    
    // 获取在线用户数量
    getOnlineCount: (state) => state.userList.filter(user => user.pucsOnline === 0).length,
    
    // 获取离线用户数量
    getOfflineCount: (state) => state.userList.filter(user => user.pucsOnline === 1).length,
    
    // 根据用户ID获取用户信息
    getUserById: (state) => (userId) => {
      return state.userList.find(user => user.userId === userId || user.userId === String(userId))
    },
    
    // 检查用户是否在线
    isUserOnline: (state) => (userId) => {
      const user = state.userList.find(u => u.userId === userId || u.userId === String(userId))
      return user ? user.pucsOnline === 0 : false
    }
  },

  actions: {
    /**
     * 获取用户列表
     * @param {boolean} force - 是否强制刷新
     */
    async fetchUserList(force = false) {
      // 如果不是强制刷新，且数据存在且未过期（5分钟内），则不重新请求
      if (!force && this.userList.length > 0 && this.lastUpdateTime) {
        const now = Date.now()
        if (now - this.lastUpdateTime < 5 * 60 * 1000) {
          return this.userList
        }
      }
      
      // 只在初始加载且无数据时显示loading
      if (this.userList.length === 0) {
        this.loading = true
      }
      
      try {
        const response = await listUserPucs({ p: 1, l: 1000 })
        if (response.code === 200) {
          this.userList = response.rows.map(user => ({
            ...user,
            postNames: user.posts?.map(p => p.postName).join('、') || ''
          }))
          this.lastUpdateTime = Date.now()
          
          // 更新在线用户ID集合
          this.onlineUserIds = new Set(
            this.userList
              .filter(user => user.pucsOnline === 0)
              .map(user => String(user.userId))
          )
          
          return this.userList
        }
      } catch (error) {
        console.error('[ContactsStore] 获取用户列表失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * 静默刷新用户列表（不显示loading）
     */
    async refreshUserList() {
      try {
        const response = await listUserPucs({ p: 1, l: 1000 })
        if (response.code === 200) {
          this.userList = response.rows.map(user => ({
            ...user,
            postNames: user.posts?.map(p => p.postName).join('、') || ''
          }))
          this.lastUpdateTime = Date.now()
          
          // 更新在线用户ID集合
          this.onlineUserIds = new Set(
            this.userList
              .filter(user => user.pucsOnline === 0)
              .map(user => String(user.userId))
          )
        }
      } catch (error) {
        console.error('[ContactsStore] 刷新用户列表失败:', error)
      }
    },

    /**
     * 更新单个用户的在线状态
     * @param {number|string} userId - 用户ID
     * @param {number} status - 在线状态 (0=在线, 1=离线)
     */
    updateUserOnlineStatus(userId, status) {
      const userIdStr = String(userId)
      const user = this.userList.find(u => String(u.userId) === userIdStr)
      if (user) {
        user.pucsOnline = status
        
        // 更新在线用户ID集合
        if (status === 0) {
          this.onlineUserIds.add(userIdStr)
        } else {
          this.onlineUserIds.delete(userIdStr)
        }
      }
    },

    /**
     * 批量更新用户在线状态
     * @param {Array} onlineUserIds - 在线用户ID数组
     */
    updateOnlineUsers(onlineUserIds) {
      const onlineSet = new Set(onlineUserIds.map(id => String(id)))
      
      this.userList.forEach(user => {
        const userIdStr = String(user.userId)
        user.pucsOnline = onlineSet.has(userIdStr) ? 0 : 1
      })
      
      this.onlineUserIds = onlineSet
    },

    /**
     * 清除通讯录数据
     */
    clearContacts() {
      this.userList = []
      this.lastUpdateTime = null
      this.onlineUserIds = new Set()
    }
  }
})

export default useContactsStore
