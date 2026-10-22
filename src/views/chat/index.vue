<template>
  <div class="chat-container">
    <!-- 左侧会话列表 -->
    <div class="chat-sidebar">
      <div class="sidebar-header">
        <el-input v-model="searchKeyword" placeholder="搜索会话" prefix-icon="Search" clearable class="search-input" />
      </div>

      <div class="session-list" v-loading="loadingSessions" element-loading-text="加载中...">
        <el-scrollbar class="session-scrollbar">
          <div class="session-list-content">
            <div v-for="(session, index) in filteredSessions"
              :key="session.sessionId || `${session.targetUserId}-${session.sessionType}-${index}`"
              :class="['session-item', { active: isActiveSession(session) }]" @click.stop="selectSession(session)"
              @contextmenu.prevent.stop="showContextMenu($event, session)">
              <div class="session-avatar">
                <!-- 系统消息特殊图标 -->
                <div v-if="isSystemSession(session)" class="system-avatar">
                  <el-icon :size="24"><Bell /></el-icon>
                </div>
                <template v-else>
                  <el-avatar :size="44" :src="getSessionAvatarUrl(session)" :class="getAvatarClass(session)" shape="square">
                    {{ session.targetName?.charAt(0) }}
                  </el-avatar>
                  <!-- 在线状态指示器 -->
                  <span class="online-status" :class="isUserOnline(session.targetUserId) ? 'online' : 'offline'"></span>
                </template>
                <span v-if="session.unreadCount > 0" class="unread-badge">
                  {{ session.unreadCount > 99 ? '99+' : session.unreadCount }}
                </span>
              </div>

              <div class="session-info">
                <div class="session-header">
                  <span class="session-name">{{ isSystemSession(session) ? '系统消息' : session.targetName }}</span>
                  <span class="session-time">{{ formatTime(session.lastMessageTime) }}</span>
                </div>
                <div class="session-preview">
                  <el-icon v-if="session.isTop" class="pin-icon">
                    <Top />
                  </el-icon>
                  <span class="last-message">{{ session.lastMessage || '暂无消息' }}</span>
                </div>
              </div>
            </div>

            <el-empty v-if="filteredSessions.length === 0 && !loadingSessions" description="暂无会话" :image-size="80" />
          </div>
        </el-scrollbar>
      </div>
    </div>

    <!-- 右侧聊天区域 -->
    <div class="chat-main">
      <template v-if="currentSession">
        <!-- 聊天头部 -->
        <div class="chat-header">
          <div class="chat-title">
            <span>{{ isSystemSession(currentSession) ? '系统消息' : currentSession.targetName }}</span>
            <el-tag v-if="currentSession.sessionType === 2" size="small" type="info">群聊</el-tag>
          </div>
          <!-- 更多操作按钮暂时隐藏 -->
          <!-- <div class="chat-actions">
            <el-tooltip content="更多操作">
              <el-button :icon="MoreFilled" circle text />
            </el-tooltip>
          </div> -->
        </div>

        <!-- 消息区域 -->
        <div class="chat-messages" ref="messagesRef" v-loading="loadingMessages" element-loading-text="加载中...">
          <!-- 加载更多 -->
          <div v-if="hasMoreMessages" class="load-more" @click="loadMoreMessages">
            <el-button text :loading="loadingMore">
              {{ loadingMore ? '加载中...' : '加载更多' }}
            </el-button>
          </div>

          <!-- 虚拟列表 -->
          <el-scrollbar ref="scrollbarRef" @scroll="handleScroll" v-if="messages.length > 0">
            <div class="messages-wrapper" :class="{ 'messages-hidden': !messagesReady }">
              <div v-for="(msg, index) in messages" :key="msg.messageId"
                :class="['message-item', { 'message-self': msg.isSelf, 'message-system': isSystemSession(currentSession) }]">
                <!-- 时间分割线 -->
                <div v-if="showTimeLabel(index)" class="time-divider">
                  <span>{{ formatMessageTime(msg.sendTime) }}</span>
                </div>

                <!-- 系统消息卡片样式 -->
                <div v-if="isSystemSession(currentSession)" class="system-message-card" @click="handleSystemMessageClick(msg)">
                  <div class="card-icon">
                    <el-icon :size="20"><Bell /></el-icon>
                  </div>
                  <div class="card-content">
                    <div class="card-header-row">
                      <div class="card-title">{{ getSystemMessageTitle(msg) }}</div>
                      <el-tag :type="getSystemMessageTagType(msg)" size="small" class="card-status">
                        {{ getSystemMessageStatus(msg) }}
                      </el-tag>
                    </div>
                    <div class="card-desc">{{ msg.content }}</div>
                    <div class="card-time">{{ formatTime(msg.sendTime) }}</div>
                  </div>
                  <el-icon class="card-arrow"><ArrowRight /></el-icon>
                </div>

                <!-- 普通消息内容 -->
                <div v-else class="message-content">
                  <!-- 右侧头像：自己的消息 -->
                  <el-avatar v-if="msg.isSelf" :size="36" :src="userAvatar" :class="getSelfAvatarClass()" shape="square" class="message-avatar-el">
                    {{ userName?.charAt(0) }}
                  </el-avatar>

                  <!-- 左侧头像：对方消息 -->
                  <el-avatar v-if="!msg.isSelf" :size="36" :src="getMessageAvatarUrl(msg)" :class="getMessageAvatarClass(msg)" shape="square" class="message-avatar-el">
                    {{ msg.fromUserName?.charAt(0) }}
                  </el-avatar>



                  <div class="message-body">
                    <!-- 群聊时显示发送者昵称 -->
                    <div v-if="!msg.isSelf && currentSession?.sessionType === 2" class="message-sender">{{ msg.fromUserName }}</div>

                    <!-- 已撤回消息 -->
                    <div v-if="msg.status === 2" class="message-recalled">
                      {{ msg.isSelf ? '你撤回了一条消息' : `${msg.fromUserName}撤回了一条消息` }}
                    </div>

                    <!-- 正常消息 -->
                    <div v-else :class="['message-bubble', { 'bubble-self': msg.isSelf }]"
                      @contextmenu.prevent="showMessageMenu($event, msg)">
                      <!-- 文本消息 -->
                      <template v-if="msg.contentType === 1">
                        <span class="message-text" v-text="msg.content"></span>
                      </template>

                      <!-- 图片消息 -->
                      <template v-else-if="msg.contentType === 2">
                        <el-image :src="msg.content" :preview-src-list="[msg.content]" fit="cover"
                          class="message-image" />
                      </template>

                      <!-- 文件消息 -->
                      <template v-else-if="msg.contentType === 4">
                        <div class="message-file">
                          <el-icon :size="32">
                            <Document />
                          </el-icon>
                          <div class="file-info">
                            <span class="file-name">{{ getFileName(msg.content) }}</span>
                            <span class="file-action" @click="downloadFile(msg.content)">下载</span>
                          </div>
                        </div>
                      </template>

                      <!-- 其他类型消息 -->
                      <template v-else>
                        <span class="message-text">[{{ getContentTypeName(msg.contentType) }}]</span>
                      </template>
                    </div>

                    <div class="message-time">{{ formatTime(msg.sendTime) }}</div>
                  </div>
                  <!-- 发送状态图标（自己的消息，显示在气泡左边） -->
                  <span v-if="msg.isSelf && msg.sendStatus === 'sending'" class="send-status sending">
                    <el-icon class="is-loading">
                      <Loading />
                    </el-icon>
                  </span>
                  <span v-else-if="msg.isSelf && msg.sendStatus === 'failed'" class="send-status failed"
                    @click.stop="resendMessage(msg)" title="发送失败，点击重试">
                    <el-icon>
                      <WarningFilled />
                    </el-icon>
                  </span>
                  <!-- pending 和 success 状态不显示任何图标 -->
                </div>
              </div>
            </div>
          </el-scrollbar>

          <!-- 空状态 -->
          <div v-else class="empty-messages">
            <el-empty description="暂无消息，发送第一条消息吧" :image-size="100" />
          </div>
        </div>

        <!-- 输入区域（系统消息不显示） -->
        <div v-if="!isSystemSession(currentSession)" class="chat-input">
          <!-- 工具栏暂时隐藏 -->
          <!-- <div class="input-toolbar">
            <el-tooltip content="表情（开发中）">
              <el-button :icon="ChatLineSquare" circle text disabled />
            </el-tooltip>
            <el-tooltip content="图片（开发中）">
              <el-button :icon="Picture" circle text disabled />
            </el-tooltip>
            <el-tooltip content="文件（开发中）">
              <el-button :icon="Folder" circle text disabled />
            </el-tooltip>
          </div> -->

          <div class="input-area">
            <el-input v-model="inputMessage" type="textarea" :rows="5" placeholder="输入消息，按 Enter 发送，Shift+Enter 换行"
              resize="none" @keydown="handleKeydown" />
          </div>

          <div class="input-actions">
            <el-button type="primary" :disabled="!inputMessage.trim()" @click="sendMessage">
              发送
            </el-button>
          </div>
        </div>

        <!-- 隐藏的文件选择器 -->
        <input ref="imageInput" type="file" accept="image/*" style="display: none" @change="handleImageSelect" />
        <input ref="fileInput" type="file" style="display: none" @change="handleFileSelect" />
      </template>

      <!-- 未选择会话 -->
      <div v-else class="no-session">
        <el-empty description="选择一个会话开始聊天" :image-size="200" />
      </div>
    </div>

    <!-- 右键菜单 - 会话 -->
    <div v-show="contextMenuVisible" class="context-menu"
      :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }">
      <div class="menu-item" @click="handleTopSession">
        {{ contextSession?.isTop ? '取消置顶' : '置顶会话' }}
      </div>
      <div class="menu-item" @click="handleMarkRead">标记已读</div>
      <div class="menu-item danger" @click="handleDeleteSession">删除会话</div>
    </div>

    <!-- 右键菜单 - 消息 -->
    <div v-show="messageMenuVisible" class="context-menu"
      :style="{ left: messageMenuX + 'px', top: messageMenuY + 'px' }">
      <div class="menu-item" @click="handleCopyMessage">复制</div>
      <!-- 撤回按钮暂时隐藏 -->
      <!-- <div v-if="contextMessage?.isSelf && canRecall(contextMessage)" class="menu-item" @click="handleRecallMessage">撤回
      </div> -->
    </div>
  </div>
</template>

<script setup name="Chat">
import { ref, computed, onMounted, onUnmounted, onActivated, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Top, MoreFilled, Document, ChatLineSquare, Picture, Folder, Loading, WarningFilled, Bell, ArrowRight } from '@element-plus/icons-vue'
import {
  getSessionList,
  getHistoryMessages,
  sendMessage as sendMessageApi,
  markSessionRead,
  topSession,
  deleteSession,
  recallMessage
} from '@/api/chat'
import useUserStore from '@/store/modules/user'
import useMqttStore from '@/store/modules/mqtt'
import useContactsStore from '@/store/modules/contacts'
import { getAssignmentInProgressCount } from '@/api/todo'
import { mqttClient } from '@/utils/mqttClient'
import { MQTT_MESSAGE_TYPE } from '@/utils/mqttMessageTypes'
import { getAvatarUrl } from '@/utils/avatar'
import defAva from '@/assets/images/profile.jpg'

const userStore = useUserStore()
const mqttStore = useMqttStore()
const contactsStore = useContactsStore()
const route = useRoute()
const router = useRouter()
// 优先使用昵称，没有昵称则使用账号名
const userName = computed(() => userStore.nickName || userStore.name)
// 使用缓存的 base64 头像 - 过滤掉默认头像
const userAvatar = computed(() => {
  const avatar = userStore.avatar
  // 如果是默认头像路径，返回空字符串让颜色背景生效
  if (!avatar || avatar.includes('profile.jpg') || avatar === defAva) {
    return ''
  }
  return getCachedImage(avatar)
})
// 获取自己的头像样式类
const getSelfAvatarClass = () => {
  // 从通讯录获取自己的信息
  const user = contactsStore.getUserById(userStore.id)
  if (user) {
    if (user.pucsOnline === 1) {
      return 'avatar-offline'
    }
    return user.sex === '0' ? 'avatar-male' : user.sex === '1' ? 'avatar-female' : 'avatar-default'
  }
  return 'avatar-default'
}

// 图片 base64 缓存
const imageBase64Cache = new Map()
// 默认头像 base64（组件挂载时加载）
let defAvaBase64 = defAva

// 将图片 URL 转换为 base64
const loadImageAsBase64 = (url) => {
  return new Promise((resolve) => {
    // 如果已缓存，直接返回
    if (imageBase64Cache.has(url)) {
      resolve(imageBase64Cache.get(url))
      return
    }
    
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        const base64 = canvas.toDataURL('image/jpeg', 0.8)
        imageBase64Cache.set(url, base64)
        resolve(base64)
      } catch (e) {
        // 跨域失败，使用原 URL
        imageBase64Cache.set(url, url)
        resolve(url)
      }
    }
    img.onerror = () => {
      // 加载失败，使用默认头像
      resolve(defAvaBase64)
    }
    img.src = url
  })
}

// 获取缓存的 base64 图片（同步，如果没缓存返回原 URL）
const getCachedImage = (url) => {
  if (!url) return defAvaBase64
  return imageBase64Cache.get(url) || url
}

// 检查用户是否在线
const isUserOnline = (userId) => {
  return contactsStore.isUserOnline(userId)
}

// 获取会话列表头像URL（与通讯录保持一致）
const getSessionAvatarUrl = (session) => {
  // 从通讯录获取用户信息
  const user = contactsStore.getUserById(session.targetUserId)
  if (user && user.avatar) {
    const url = getAvatarUrl(user.avatar)
    // getAvatarUrl 已经过滤了默认头像，如果返回空字符串说明是默认头像
    if (url) return url
  }
  // 如果通讯录没有该用户或没有头像，使用会话中的头像
  if (session.targetAvatar) {
    const url = getAvatarUrl(session.targetAvatar)
    if (url) return url
  }
  // 没有头像或是默认头像，返回空让颜色背景生效
  return ''
}

// 计算消息头像URL并预加载 base64
const computeMessageAvatarUrl = (msg) => {
  // 从通讯录获取用户信息
  const user = contactsStore.getUserById(msg.fromUserId)
  if (user && user.avatar) {
    const avatarUrl = getAvatarUrl(user.avatar)
    // getAvatarUrl 已经过滤了默认头像，如果返回空字符串说明是默认头像
    if (avatarUrl) {
      loadImageAsBase64(avatarUrl)
      return getCachedImage(avatarUrl)
    }
  } else if (msg.fromUserAvatar) {
    const avatarUrl = getAvatarUrl(msg.fromUserAvatar)
    if (avatarUrl) {
      loadImageAsBase64(avatarUrl)
      return getCachedImage(avatarUrl)
    }
  }
  
  // 没有有效头像或是默认头像，返回空字符串让颜色背景生效
  return ''
}

// 获取消息头像URL（对方消息）- 优先使用预计算的值
const getMessageAvatarUrl = (msg) => {
  // 如果已经预计算过，直接返回
  if (msg._avatarUrl !== undefined) {
    return msg._avatarUrl || ''
  }
  // 否则计算一次
  return computeMessageAvatarUrl(msg)
}

// 获取消息头像的样式类（对方消息）
const getMessageAvatarClass = (msg) => {
  // 从通讯录获取用户信息
  const user = contactsStore.getUserById(msg.fromUserId)
  if (user) {
    if (user.pucsOnline === 1) {
      return 'avatar-offline'
    }
    return user.sex === '0' ? 'avatar-male' : user.sex === '1' ? 'avatar-female' : 'avatar-default'
  }
  return 'avatar-default'
}

// 获取会话列表头像样式类（与通讯录一致）
const getAvatarClass = (session) => {
  if (isSystemSession(session)) return ''
  
  const userId = session.targetUserId
  const user = contactsStore.getUserById(userId)
  
  // 如果找到用户信息，根据在线状态和性别返回样式
  if (user) {
    if (user.pucsOnline === 1) {
      return 'avatar-offline'
    }
    // 0-男 1-女
    return user.sex === '0' ? 'avatar-male' : user.sex === '1' ? 'avatar-female' : 'avatar-default'
  }
  
  // 如果没有用户信息，根据在线状态返回默认样式
  if (!isUserOnline(userId)) {
    return 'avatar-offline'
  }
  return 'avatar-default'
}

// 会话相关
const sessions = ref([])
const currentSession = ref(null)
const searchKeyword = ref('')
const loadingSessions = ref(false)
// 消息区域是否准备好显示（用于防止滚动闪烁）
const messagesReady = ref(true)
// 当前加载消息的请求控制器（用于取消之前的请求）
let currentLoadAbortController = null
// 当前加载的会话ID（用于判断响应是否过期）
let currentLoadingSessionId = null

// 临时会话本地存储 key
const TEMP_SESSIONS_KEY = 'chat_temp_sessions'

// 从 localStorage 加载临时会话
const loadTempSessions = () => {
  try {
    const stored = localStorage.getItem(TEMP_SESSIONS_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('[Chat] 加载临时会话失败:', e)
  }
  return []
}

// 保存临时会话到 localStorage
const saveTempSessions = (tempSessions) => {
  try {
    localStorage.setItem(TEMP_SESSIONS_KEY, JSON.stringify(tempSessions))
  } catch (e) {
    console.error('[Chat] 保存临时会话失败:', e)
  }
}

// 添加临时会话
const addTempSession = (session) => {
  const tempSessions = loadTempSessions()
  // 检查是否已存在相同用户的临时会话
  const existIndex = tempSessions.findIndex(s => Number(s.targetUserId) === Number(session.targetUserId))
  if (existIndex !== -1) {
    // 更新已存在的临时会话
    tempSessions[existIndex] = session
  } else {
    tempSessions.push(session)
  }
  saveTempSessions(tempSessions)
}

// 移除临时会话（当匹配到真实会话时）
const removeTempSession = (targetUserId) => {
  const tempSessions = loadTempSessions()
  const filtered = tempSessions.filter(s => Number(s.targetUserId) !== Number(targetUserId))
  saveTempSessions(filtered)
}

// 消息相关
const messages = ref([])
const inputMessage = ref('')
const loadingMessages = ref(false)
const loadingMore = ref(false)
const hasMoreMessages = ref(false)
const currentPage = ref(1)
const pageSize = 20

// 消息缓存 - 用于静默加载
const messagesCache = ref(new Map())

// DOM引用
const messagesRef = ref(null)
const scrollbarRef = ref(null)
const imageInput = ref(null)
const fileInput = ref(null)

// 右键菜单 - 会话
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextSession = ref(null)

// 右键菜单 - 消息
const messageMenuVisible = ref(false)
const messageMenuX = ref(0)
const messageMenuY = ref(0)
const contextMessage = ref(null)

// 过滤后的会话列表
const filteredSessions = computed(() => {
  if (!searchKeyword.value) return sessions.value
  return sessions.value.filter(s =>
    s.targetName?.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

// 刷新未读消息统计数量
const refreshUnreadCount = async () => {
  try {
    const response = await getAssignmentInProgressCount()
    if (response.code === 200) {
      mqttStore.updateInProgressCounts(response.data || {})
    }
  } catch (error) {
    console.error('[Chat] 刷新未读消息统计失败:', error)
  }
}

// 加载会话列表
const loadSessions = async () => {
  // 只在没有数据时显示 loading
  if (sessions.value.length === 0) {
    loadingSessions.value = true
  }

  console.log('[Chat] 开始加载会话列表')

  try {
    const res = await getSessionList()
    console.log('[Chat] 会话列表响应:', res)

    if (res.code === 200) {
      const rawSessions = res.data || []
      console.log('[Chat] 原始会话数据:', rawSessions)

      // 处理会话数据，映射后端字段到前端字段
      const serverSessions = rawSessions.map((session) => ({
        sessionId: session.id,
        sessionType: session.sessionType,
        targetUserId: session.targetUserId,
        groupId: session.groupId,
        targetName: session.targetName,
        targetAvatar: session.targetAvatar,
        lastMessage: session.lastMessageContent,
        lastMessageTime: session.lastMessageTime,
        unreadCount: session.myUnreadCount || 0,
        isTop: session.topStatus || 0,
        onlineStatus: session.onlineStatus,
        createTime: session.createTime
      }))

      // 加载本地存储的临时会话
      const storedTempSessions = loadTempSessions()
      
      // 过滤掉已经在服务器列表中存在的临时会话（匹配到真实会话）
      const remainingTempSessions = storedTempSessions.filter(temp => {
        const matched = serverSessions.find(
          s => Number(s.targetUserId) === Number(temp.targetUserId) && s.sessionType === temp.sessionType
        )
        if (matched) {
          // 匹配到了，从本地存储中移除
          removeTempSession(temp.targetUserId)
          return false
        }
        return true
      })

      // 检查内存中的会话，过滤掉已在服务器列表中存在的（包括临时会话和MQTT创建的会话）
      const memoryOnlySessions = sessions.value.filter(s => {
        // 检查是否在服务器列表中已有会话（用 targetUserId + sessionType 匹配）
        const matched = serverSessions.find(
          srv => Number(srv.targetUserId) === Number(s.targetUserId) && srv.sessionType === s.sessionType
        )
        if (matched) {
          // 匹配到了，如果是临时会话从本地存储中也移除
          if (s.isTemp) {
            removeTempSession(s.targetUserId)
          }
          return false
        }
        return true
      })
      
      // 合并本地存储的临时会话到内存会话（去重）
      remainingTempSessions.forEach(stored => {
        const exists = memoryOnlySessions.find(m => Number(m.targetUserId) === Number(stored.targetUserId))
        if (!exists) {
          memoryOnlySessions.push({ ...stored, isTemp: true })
        }
      })

      // 合并：内存中独有的会话 + 服务器会话
      sessions.value = [...memoryOnlySessions, ...serverSessions]

      // 按置顶和时间排序
      sessions.value.sort((a, b) => {
        if (a.isTop !== b.isTop) return b.isTop - a.isTop
        return new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0)
      })

      console.log('[Chat] 合并后的会话数据:', sessions.value)
      console.log('[Chat] 内存独有会话:', memoryOnlySessions.length, '个，服务器会话:', serverSessions.length, '个')
    }
  } catch (error) {
    console.error('[Chat] 加载会话列表失败:', error)
  } finally {
    loadingSessions.value = false
  }
}

// 选择会话
const selectSession = async (session) => {
  console.log('[Chat] 点击会话:', session)

  // 使用更可靠的会话标识进行比较
  const isSameSession = currentSession.value && (
    (session.sessionId && currentSession.value.sessionId === session.sessionId) ||
    (session.targetUserId && currentSession.value.targetUserId === session.targetUserId &&
      session.sessionType === currentSession.value.sessionType)
  )

  if (isSameSession) {
    console.log('[Chat] 已经是当前会话，跳过')
    return
  }

  // 取消之前的加载请求
  if (currentLoadAbortController) {
    currentLoadAbortController.abort()
    currentLoadAbortController = null
  }

  // 生成本次加载的唯一标识
  const thisSessionId = session.sessionId || `temp_${session.targetUserId}`
  currentLoadingSessionId = thisSessionId

  // 保存当前会话的消息到缓存
  if (currentSession.value?.sessionId && messages.value.length > 0) {
    messagesCache.value.set(currentSession.value.sessionId, {
      messages: [...messages.value],
      page: currentPage.value,
      hasMore: hasMoreMessages.value
    })
  }

  // 先清空消息，隐藏消息区域避免闪烁
  messagesReady.value = false
  messages.value = []
  currentSession.value = session
  currentPage.value = 1
  hasMoreMessages.value = false

  // 检查缓存
  const cached = session.sessionId ? messagesCache.value.get(session.sessionId) : null
  if (cached) {
    // 检查是否还是当前会话（防止快速切换时显示错误数据）
    if (currentLoadingSessionId !== thisSessionId) {
      console.log('[Chat] 会话已切换，忽略缓存数据')
      return
    }
    // 有缓存，先显示缓存数据
    messages.value = cached.messages
    currentPage.value = cached.page
    hasMoreMessages.value = cached.hasMore
    // 等待 DOM 更新，滚动到底部，然后显示
    await nextTick()
    scrollToBottom()
    await nextTick()
    messagesReady.value = true
    // 静默刷新（不显示loading）
    loadMessages(true, thisSessionId)
  } else {
    // 无缓存，正常加载
    await loadMessages(false, thisSessionId)
    // 检查是否还是当前会话
    if (currentLoadingSessionId !== thisSessionId) {
      console.log('[Chat] 会话已切换，忽略加载结果')
      return
    }
    // 加载完成后滚动到底部，然后显示
    await nextTick()
    scrollToBottom()
    await nextTick()
    messagesReady.value = true
  }

  // 标记已读（非临时会话都调用）
  if (session.sessionId && !session.sessionId.startsWith('temp_')) {
    try {
      await markSessionRead(session.sessionId)
      // 清除当前会话的未读数
      session.unreadCount = 0
      // 同步更新 sessions 数组中的未读数
      const sessionIndex = sessions.value.findIndex(
        s => s.sessionId === session.sessionId || 
             (Number(s.targetUserId) === Number(session.targetUserId) && s.sessionType === session.sessionType)
      )
      if (sessionIndex !== -1) {
        sessions.value[sessionIndex].unreadCount = 0
      }
      // 刷新未读消息统计
      refreshUnreadCount()
    } catch (e) {
      console.error('[Chat] 标记已读失败:', e)
    }
  }
}

// 加载消息
const loadMessages = async (silent = false, expectedSessionId = null) => {
  if (!currentSession.value) {
    console.log('[Chat] 没有当前会话，跳过加载消息')
    return
  }

  // 如果是临时会话（没有sessionId），不加载历史消息
  if (!currentSession.value.sessionId) {
    console.log('[Chat] 临时会话，无历史消息')
    loadingMessages.value = false
    return
  }

  // 检查是否还是期望的会话（防止快速切换时加载错误数据）
  const thisSessionId = expectedSessionId || currentSession.value.sessionId
  if (expectedSessionId && currentLoadingSessionId !== expectedSessionId) {
    console.log('[Chat] 会话已切换，取消加载')
    return
  }

  // 只在非静默模式且没有消息数据时显示 loading
  if (!silent && messages.value.length === 0) {
    loadingMessages.value = true
  }

  console.log('[Chat] 加载消息，sessionId:', currentSession.value.sessionId, '静默模式:', silent)

  // 创建 AbortController
  const abortController = new AbortController()
  currentLoadAbortController = abortController

  try {
    const res = await getHistoryMessages(currentSession.value.sessionId, {
      p: currentPage.value,
      l: pageSize
    })
    
    // 检查请求是否被取消或会话已切换
    if (abortController.signal.aborted || (expectedSessionId && currentLoadingSessionId !== expectedSessionId)) {
      console.log('[Chat] 请求已取消或会话已切换，忽略响应')
      return
    }
    
    if (res.code === 200) {
      const data = res.data
      console.log('[Chat] 原始消息数据:', data.list)

      // 历史消息倒序显示，并预先计算头像URL
      const newMessages = (data.list || []).reverse().map(msg => ({
        ...msg,
        // 预先计算头像URL，避免每次渲染都调用函数
        _avatarUrl: msg.isSelf ? null : computeMessageAvatarUrl(msg)
      }))

      // 再次检查会话是否已切换
      if (expectedSessionId && currentLoadingSessionId !== expectedSessionId) {
        console.log('[Chat] 处理数据时会话已切换，忽略')
        return
      }

      if (currentPage.value === 1) {
        messages.value = newMessages
      } else {
        messages.value = [...newMessages, ...messages.value]
      }

      hasMoreMessages.value = currentPage.value < data.pages

      // 更新缓存
      if (currentSession.value.sessionId) {
        messagesCache.value.set(currentSession.value.sessionId, {
          messages: [...messages.value],
          page: currentPage.value,
          hasMore: hasMoreMessages.value
        })
      }
    }
  } catch (error) {
    // 忽略取消的请求错误
    if (error.name === 'AbortError' || error.name === 'CanceledError') {
      console.log('[Chat] 请求已取消')
      return
    }
    console.error('[Chat] 加载消息失败:', error)
  } finally {
    loadingMessages.value = false
  }
}

// 加载更多消息
const loadMoreMessages = async () => {
  if (loadingMore.value || !hasMoreMessages.value) return

  loadingMore.value = true
  currentPage.value++

  // 记录当前滚动高度
  const scrollWrap = scrollbarRef.value?.wrapRef
  const oldScrollHeight = scrollWrap?.scrollHeight || 0

  try {
    await loadMessages(true) // 静默加载

    // 加载完成后保持滚动位置
    nextTick(() => {
      if (scrollWrap) {
        const newScrollHeight = scrollWrap.scrollHeight
        const heightDiff = newScrollHeight - oldScrollHeight
        scrollbarRef.value?.setScrollTop(heightDiff)
      }
    })
  } finally {
    loadingMore.value = false
  }
}

// 发送消息
const sendMessage = async () => {
  if (!inputMessage.value.trim() || !currentSession.value) return

  const content = inputMessage.value.trim()
  inputMessage.value = ''

  // 生成临时消息ID
  const tempMessageId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 先添加消息到列表（初始不显示loading）
  const newMessage = {
    messageId: tempMessageId,
    sessionId: currentSession.value.sessionId,
    fromUserId: userStore.userId,
    toUserId: currentSession.value.targetUserId,
    sessionType: currentSession.value.sessionType,
    contentType: 1,
    content,
    sendTime: new Date().toLocaleString(),
    status: 1,
    isSelf: true,
    fromUserName: userName.value,
    fromUserAvatar: userAvatar.value,
    // 发送状态：pending-等待中(不显示), sending-发送中(显示菊花), success-成功, failed-失败
    sendStatus: 'pending'
  }

  messages.value.push(newMessage)
  scrollToBottom()

  // 更新当前会话和会话列表中的最后消息
  const now = new Date().toLocaleString()
  currentSession.value.lastMessage = content
  currentSession.value.lastMessageTime = now
  
  // 同步更新 sessions 数组中的会话
  const sessionIndex = sessions.value.findIndex(
    s => (s.sessionId && s.sessionId === currentSession.value.sessionId) ||
         (Number(s.targetUserId) === Number(currentSession.value.targetUserId) && s.sessionType === currentSession.value.sessionType)
  )
  if (sessionIndex !== -1) {
    sessions.value[sessionIndex].lastMessage = content
    sessions.value[sessionIndex].lastMessageTime = now
    
    // 只有当会话不在第一位时才需要重新排序
    if (sessionIndex > 0 && !sessions.value[sessionIndex].isTop) {
      // 将当前会话移到非置顶会话的最前面
      const [movedSession] = sessions.value.splice(sessionIndex, 1)
      // 找到第一个非置顶会话的位置
      const firstNonTopIndex = sessions.value.findIndex(s => !s.isTop)
      if (firstNonTopIndex === -1) {
        sessions.value.push(movedSession)
      } else {
        sessions.value.splice(firstNonTopIndex, 0, movedSession)
      }
    }
  }

  // 发送请求
  await doSendMessage(newMessage)
}

// 实际发送消息请求
const doSendMessage = async (message) => {
  // 找到消息在数组中的索引，用于直接更新响应式数组
  const msgIndex = messages.value.findIndex(m => m.messageId === message.messageId)
  
  // 800ms 后如果还没成功，才显示 loading
  let showLoadingTimer = null
  let isCompleted = false
  
  showLoadingTimer = setTimeout(() => {
    if (!isCompleted && msgIndex !== -1) {
      const currentStatus = messages.value[msgIndex]?.sendStatus
      if (currentStatus === 'pending') {
        messages.value[msgIndex].sendStatus = 'sending'
      }
    }
  }, 800)
  
  try {
    const params = {
      toUserId: currentSession.value.targetUserId,
      sessionType: currentSession.value.sessionType,
      contentType: message.contentType,
      content: message.content
    }

    // 如果有sessionId且不是临时会话，添加到参数中
    if (currentSession.value.sessionId && !currentSession.value.isTemp) {
      params.sessionId = currentSession.value.sessionId
    }

    const res = await sendMessageApi(params)
    
    // 标记完成，阻止 loading 显示
    isCompleted = true
    clearTimeout(showLoadingTimer)

    if (res.code === 200) {
      // 发送成功，直接更新数组中的消息状态
      if (msgIndex !== -1) {
        messages.value[msgIndex].sendStatus = 'success'
        messages.value[msgIndex].messageId = res.data?.messageId || message.messageId
      }

      // 如果是临时会话，更新sessionId
      if (currentSession.value.isTemp || !currentSession.value.sessionId || currentSession.value.sessionId.startsWith('temp_')) {
        // 从本地存储中移除临时会话
        removeTempSession(currentSession.value.targetUserId)
        
        // 重新加载会话列表获取新的sessionId
        await loadSessions()

        // 找到刚创建的会话
        const newSession = sessions.value.find(
          s => !s.isTemp && Number(s.targetUserId) === Number(currentSession.value.targetUserId) && s.sessionType === 1
        )

        if (newSession) {
          // 保留当前消息
          const currentMessages = [...messages.value]
          currentSession.value = newSession
          messages.value = currentMessages
          console.log('[Chat] 临时会话已更新为正式会话:', newSession.sessionId)
        }
      }

      // 更新缓存
      if (currentSession.value.sessionId) {
        messagesCache.value.set(currentSession.value.sessionId, {
          messages: [...messages.value],
          page: currentPage.value,
          hasMore: hasMoreMessages.value
        })
      }
    } else {
      // 发送失败，直接更新数组中的消息状态
      if (msgIndex !== -1) {
        messages.value[msgIndex].sendStatus = 'failed'
      }
    }
  } catch (error) {
    console.error('[Chat] 发送消息失败:', error)
    // 标记完成
    isCompleted = true
    clearTimeout(showLoadingTimer)
    // 发送失败，直接更新数组中的消息状态
    if (msgIndex !== -1) {
      messages.value[msgIndex].sendStatus = 'failed'
    }
  }
}

// 重新发送失败的消息
const resendMessage = async (message) => {
  if (message.sendStatus !== 'failed') return

  // 找到消息在数组中的索引
  const msgIndex = messages.value.findIndex(m => m.messageId === message.messageId)
  if (msgIndex === -1) return
  
  // 从原位置移除消息
  const [removedMsg] = messages.value.splice(msgIndex, 1)
  
  // 更新发送时间为当前时间
  removedMsg.sendTime = new Date().toLocaleString()
  removedMsg.sendStatus = 'pending'
  
  // 添加到列表末尾（最新位置）
  messages.value.push(removedMsg)
  scrollToBottom()

  // 重新发送
  await doSendMessage(removedMsg)

  // 发送成功后，静默刷新消息列表确保与后端数据一致
  const updatedMsg = messages.value.find(m => m.messageId === removedMsg.messageId)
  if (updatedMsg && updatedMsg.sendStatus === 'success') {
    // 静默刷新当前会话消息
    currentPage.value = 1
    await loadMessages(true)
    scrollToBottom()
  }
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (scrollbarRef.value) {
      scrollbarRef.value.setScrollTop(99999)
    }
  })
}

// 处理滚动 - 滚动到顶部加载更多
const handleScroll = ({ scrollTop }) => {
  // 滚动到顶部附近（小于50px）时自动加载更多
  if (scrollTop < 50 && hasMoreMessages.value && !loadingMore.value) {
    loadMoreMessages()
  }
}

// 键盘事件
const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

// 格式化时间
const formatTime = (time) => {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const diff = now - date

  // 今天
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  // 昨天
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return '昨天'
  }

  // 本周内
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return days[date.getDay()]
  }

  // 其他
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// 格式化消息时间
const formatMessageTime = (time) => {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 是否显示时间标签
const showTimeLabel = (index) => {
  if (index === 0) return true

  const current = new Date(messages.value[index].sendTime)
  const prev = new Date(messages.value[index - 1].sendTime)

  // 间隔超过5分钟显示时间
  return current - prev > 5 * 60 * 1000
}

// 获取内容类型名称
const getContentTypeName = (type) => {
  const types = {
    1: '文本',
    2: '图片',
    3: '视频',
    4: '文件',
    5: '语音',
    6: '位置'
  }
  return types[type] || '未知消息'
}

// 获取文件名
const getFileName = (url) => {
  if (!url) return '文件'
  return url.split('/').pop() || '文件'
}

// 下载文件
const downloadFile = (url) => {
  window.open(url, '_blank')
}

// 是否可以撤回（2分钟内）
const canRecall = (msg) => {
  if (!msg || msg.status === 2) return false
  const sendTime = new Date(msg.sendTime)
  const now = new Date()
  return now - sendTime < 2 * 60 * 1000
}

// 表情选择
const toggleEmoji = () => {
  ElMessage.info('表情功能开发中')
}

// 选择图片
const selectImage = () => {
  imageInput.value?.click()
}

// 选择文件
const selectFile = () => {
  fileInput.value?.click()
}

// 处理图片选择
const handleImageSelect = (e) => {
  const file = e.target.files?.[0]
  if (file) {
    ElMessage.info('图片上传功能开发中')
  }
  e.target.value = ''
}

// 处理文件选择
const handleFileSelect = (e) => {
  const file = e.target.files?.[0]
  if (file) {
    ElMessage.info('文件上传功能开发中')
  }
  e.target.value = ''
}

// 显示会话右键菜单
const showContextMenu = (e, session) => {
  e.stopPropagation() // 阻止事件冒泡
  contextSession.value = session
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
  contextMenuVisible.value = true
  messageMenuVisible.value = false
  console.log('[Chat] 显示会话右键菜单:', session.targetName)
}

// 显示消息右键菜单
const showMessageMenu = (e, msg) => {
  contextMessage.value = msg
  messageMenuX.value = e.clientX
  messageMenuY.value = e.clientY
  messageMenuVisible.value = true
  contextMenuVisible.value = false
}

// 置顶/取消置顶会话
const handleTopSession = async () => {
  if (!contextSession.value) return

  const newStatus = contextSession.value.isTop ? 0 : 1
  try {
    const res = await topSession(contextSession.value.sessionId, newStatus)
    if (res.code === 200) {
      contextSession.value.isTop = newStatus
      // 重新排序
      sessions.value.sort((a, b) => {
        if (a.isTop !== b.isTop) return b.isTop - a.isTop
        return new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0)
      })
      ElMessage.success(newStatus ? '已置顶' : '已取消置顶')
    }
  } catch (error) {
    console.error('[Chat] 置顶会话失败:', error)
  } finally {
    contextMenuVisible.value = false
  }
}

// 标记已读
const handleMarkRead = async () => {
  if (!contextSession.value) return

  try {
    const res = await markSessionRead(contextSession.value.sessionId)
    if (res.code === 200) {
      contextSession.value.unreadCount = 0
      ElMessage.success('已标记为已读')
      // 刷新未读消息统计
      refreshUnreadCount()
    }
  } finally {
    contextMenuVisible.value = false
  }
}

// 删除会话
const handleDeleteSession = async () => {
  if (!contextSession.value) return

  try {
    await ElMessageBox.confirm('确定删除该会话吗？', '提示', {
      type: 'warning'
    })

    const session = contextSession.value
    
    // 判断是临时会话还是真实会话
    if (session.isTemp || session.sessionId?.startsWith('temp_')) {
      // 临时会话：只删除本地
      removeTempSession(session.targetUserId)
      
      const index = sessions.value.findIndex(
        s => (s.sessionId === session.sessionId) || 
             (s.isTemp && Number(s.targetUserId) === Number(session.targetUserId))
      )
      if (index > -1) {
        sessions.value.splice(index, 1)
      }

      if (currentSession.value && (
        currentSession.value.sessionId === session.sessionId ||
        (currentSession.value.isTemp && Number(currentSession.value.targetUserId) === Number(session.targetUserId))
      )) {
        currentSession.value = null
        messages.value = []
      }

      ElMessage.success('删除成功')
    } else {
      // 真实会话：调用接口删除
      const res = await deleteSession(session.sessionId)
      if (res.code === 200) {
        const index = sessions.value.findIndex(s => s.sessionId === session.sessionId)
        if (index > -1) {
          sessions.value.splice(index, 1)
        }

        if (currentSession.value?.sessionId === session.sessionId) {
          currentSession.value = null
          messages.value = []
        }

        ElMessage.success('删除成功')
      }
    }
  } catch (e) {
    if (e !== 'cancel') {
      // 错误处理
    }
  } finally {
    contextMenuVisible.value = false
  }
}

// 复制消息
const handleCopyMessage = () => {
  if (!contextMessage.value) return

  navigator.clipboard.writeText(contextMessage.value.content).then(() => {
    ElMessage.success('已复制')
  })

  messageMenuVisible.value = false
}

// 撤回消息
const handleRecallMessage = async () => {
  if (!contextMessage.value) return

  try {
    const res = await recallMessage(contextMessage.value.messageId)
    if (res.code === 200) {
      contextMessage.value.status = 2
      ElMessage.success('已撤回')
    }
  } finally {
    messageMenuVisible.value = false
  }
}

// 关闭菜单
const closeMenus = () => {
  contextMenuVisible.value = false
  messageMenuVisible.value = false
}

// 测试点击
const testClick = () => {
  console.log('[Chat] 测试点击按钮被点击')
  ElMessage.success('点击事件正常工作！')
  console.log('[Chat] 当前会话列表:', sessions.value)
  console.log('[Chat] 过滤后会话列表:', filteredSessions.value)
}

// 判断是否是当前激活的会话
const isActiveSession = (session) => {
  if (!currentSession.value) return false

  // 如果有sessionId，优先使用sessionId比较
  if (session.sessionId && currentSession.value.sessionId) {
    return session.sessionId === currentSession.value.sessionId
  }

  // 否则使用 targetUserId + sessionType 组合判断
  return session.targetUserId === currentSession.value.targetUserId &&
    session.sessionType === currentSession.value.sessionType
}

// 判断是否是系统消息会话（admin）
const isSystemSession = (session) => {
  if (!session) return false
  return session.targetName === 'admin' || session.targetUserId === 1
}

// 获取系统消息标题
const getSystemMessageTitle = (msg) => {
  // 解析 extra 字段获取业务信息
  const extra = msg.extra ? (typeof msg.extra === 'string' ? JSON.parse(msg.extra) : msg.extra) : {}
  const businessType = extra.businessType || msg.businessType
  
  // 根据 businessType 返回标题：1=系统通知, 2=我的待办, 3=我的流程
  const businessTypeMap = {
    1: '【系统通知】',
    2: '【我的待办】',
    3: '【我的流程】'
  }
  return businessTypeMap[businessType] || '【系统通知】'
}

// 获取系统消息状态文字
const getSystemMessageStatus = (msg) => {
  const extra = msg.extra ? (typeof msg.extra === 'string' ? JSON.parse(msg.extra) : msg.extra) : {}
  const massageType = extra.massageType || msg.massageType
  
  // massageType: 1=待办提醒, 2=拒绝待办, 3=接受待办, 4=完成待办, 5=待办延期, 
  // 6=交办转移, 7=待办逾期提醒, 8=交办逾期提醒, 9=撤销待办提醒, 10=交办完成提醒
  const statusMap = {
    1: '待办提醒',
    2: '已拒绝',
    3: '已接受',
    4: '已完成',
    5: '延期申请',
    6: '已转移',
    7: '逾期提醒',
    8: '逾期提醒',
    9: '已撤销',
    10: '已完成'
  }
  return statusMap[massageType] || '通知'
}

// 获取系统消息状态标签类型（颜色）
const getSystemMessageTagType = (msg) => {
  const extra = msg.extra ? (typeof msg.extra === 'string' ? JSON.parse(msg.extra) : msg.extra) : {}
  const massageType = extra.massageType || msg.massageType
  
  // 根据 massageType 返回不同颜色
  // success: 绿色（完成、接受）
  // warning: 橙色（延期、转移、提醒）
  // danger: 红色（拒绝、逾期、撤销）
  // primary: 蓝色（默认提醒）
  const typeMap = {
    1: 'primary',    // 待办提醒 - 蓝色
    2: 'danger',     // 已拒绝 - 红色
    3: 'success',    // 已接受 - 绿色
    4: 'success',    // 已完成 - 绿色
    5: 'warning',    // 延期申请 - 橙色
    6: 'warning',    // 已转移 - 橙色
    7: 'danger',     // 逾期提醒 - 红色
    8: 'danger',     // 逾期提醒 - 红色
    9: 'info',       // 已撤销 - 灰色
    10: 'success'    // 已完成 - 绿色
  }
  return typeMap[massageType] || 'primary'
}

// 处理系统消息卡片点击
const handleSystemMessageClick = (msg) => {
  // 解析 extra 字段获取业务信息
  const extra = msg.extra ? (typeof msg.extra === 'string' ? JSON.parse(msg.extra) : msg.extra) : {}
  const businessType = extra.businessType || msg.businessType
  const massageType = extra.massageType || msg.massageType
  
  console.log('[Chat] 点击系统消息:', msg, extra, 'businessType:', businessType, 'massageType:', massageType)
  
  // businessType = 1 是普通系统消息，不跳转
  if (businessType === 1) {
    console.log('[Chat] 普通系统消息，不跳转')
    return
  }
  
  // 根据业务类型跳转到对应页面
  // businessType: 2=我的待办, 3=我的流程
  // 页面通过 query.tab 参数切换标签页
  switch (businessType) {
    case 2:
      // 待办消息 -> 跳转到我的待办
      // 根据 massageType 决定跳转到哪个 tab
      let todoTab = 'all'
      if (massageType === 1 || massageType === 7) {
        // 待办提醒、待办逾期提醒 -> 进行中
        todoTab = 'inProgress'
      } else if (massageType === 4) {
        // 待办已完成 -> 已完成
        todoTab = 'completed'
      } else if (massageType === 2) {
        // 待办被拒绝 -> 已拒绝
        todoTab = 'rejected'
      }
      router.push({
        path: '/my-todo',
        query: { tab: todoTab }
      })
      break
    case 3:
      // 流程消息 -> 跳转到我的流程
      router.push({
        path: '/my-process',
        query: { tab: 'all' }
      })
      break
    default:
      // 未知类型，不跳转
      console.log('[Chat] 未知的业务类型:', businessType)
  }
}

// 处理从通讯录跳转过来的情况
const handleRouteQuery = async () => {
  const { userId, userName: targetUserName, userAvatar: targetAvatar, sessionId: querySessionId } = route.query

  if (!userId) return

  console.log('[Chat] handleRouteQuery - 目标用户:', userId, typeof userId, '用户名:', targetUserName, 'sessionId:', querySessionId)

  const targetId = Number(userId)

  // 1. 如果会话列表为空，先加载会话列表
  if (sessions.value.length === 0) {
    console.log('[Chat] 会话列表为空，先加载会话列表')
    await loadSessions()
  }

  // 2. 优先用 sessionId 匹配（如果有的话）
  if (querySessionId) {
    const sessionBySessionId = sessions.value.find(s => s.sessionId === querySessionId)
    if (sessionBySessionId) {
      console.log('[Chat] 通过 sessionId 找到会话:', sessionBySessionId.targetName)
      await selectSession(sessionBySessionId)
      return
    }
  }

  // 3. 用 userId 匹配
  let existingSession = sessions.value.find(
    s => Number(s.targetUserId) === targetId && s.sessionType === 1
  )

  console.log('[Chat] 会话列表数量:', sessions.value.length, '匹配结果:', existingSession?.targetName)

  if (existingSession) {
    console.log('[Chat] 找到已有会话，直接选中:', existingSession.targetName)
    await selectSession(existingSession)
    return
  }

  // 4. 缓存中没找到，创建临时会话并选中
  console.log('[Chat] 未找到匹配会话，创建临时会话')
  const tempSession = {
    sessionId: `temp_${targetId}_${Date.now()}`,
    sessionType: 1,
    targetUserId: targetId,
    targetName: targetUserName || '未知用户',
    targetAvatar: targetAvatar || '',
    lastMessage: '',
    lastMessageTime: new Date().toISOString(),
    unreadCount: 0,
    isTop: 0,
    isTemp: true
  }

  // 添加到会话列表头部并立即选中
  sessions.value.unshift(tempSession)
  currentSession.value = tempSession
  messages.value = []
  currentPage.value = 1
  hasMoreMessages.value = false
  loadingMessages.value = false

  // 保存临时会话到本地存储
  addTempSession(tempSession)

  console.log('[Chat] 临时会话已创建并选中:', tempSession)
}

// MQTT 消息处理器
const handleMqttMessage = (topic, messageData) => {
  // 只处理聊天消息类型 (551)
  if (messageData.type !== 551 && messageData.type !== MQTT_MESSAGE_TYPE.CHAT_MESSAGE) {
    return
  }

  console.log('[Chat] 收到聊天消息推送:', messageData)

  const chatData = messageData.data || messageData

  // 查找会话：优先用 sessionId，其次用 fromUserId
  let existingSession = sessions.value.find(s => s.sessionId === chatData.sessionId)
  
  // 如果没找到，尝试用发送者 userId 匹配（可能是临时会话或新会话）
  if (!existingSession && chatData.fromUserId) {
    existingSession = sessions.value.find(
      s => Number(s.targetUserId) === Number(chatData.fromUserId) && s.sessionType === (chatData.sessionType || 1)
    )
  }

  if (existingSession) {
    // 更新已有会话的最后消息
    existingSession.lastMessage = chatData.content
    existingSession.lastMessageTime = chatData.sendTime
    
    // 如果是临时会话，更新为真实 sessionId
    if (existingSession.isTemp && chatData.sessionId) {
      existingSession.sessionId = chatData.sessionId
      existingSession.isTemp = false
      // 从本地存储中移除临时会话
      removeTempSession(existingSession.targetUserId)
    }

    // 如果不是当前会话，增加未读数
    const isCurrentSession = currentSession.value && (
      currentSession.value.sessionId === chatData.sessionId ||
      (Number(currentSession.value.targetUserId) === Number(chatData.fromUserId) && currentSession.value.sessionType === (chatData.sessionType || 1))
    )
    
    if (!isCurrentSession) {
      existingSession.unreadCount = (existingSession.unreadCount || 0) + 1
    }

    // 重新排序会话列表
    sessions.value.sort((a, b) => {
      if (a.isTop !== b.isTop) return b.isTop - a.isTop
      return new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0)
    })
  } else {
    // 新会话，添加到列表
    const newSession = {
      sessionId: chatData.sessionId,
      sessionType: chatData.sessionType || 1,
      targetUserId: chatData.fromUserId,
      targetName: chatData.fromUserName,
      targetAvatar: chatData.fromUserAvatar || '',
      lastMessage: chatData.content,
      lastMessageTime: chatData.sendTime,
      unreadCount: 1,
      isTop: 0
    }
    sessions.value.unshift(newSession)
    
    // 重新排序
    sessions.value.sort((a, b) => {
      if (a.isTop !== b.isTop) return b.isTop - a.isTop
      return new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0)
    })
  }

  // 判断是否是当前会话
  const isCurrentSession = currentSession.value && (
    currentSession.value.sessionId === chatData.sessionId ||
    (Number(currentSession.value.targetUserId) === Number(chatData.fromUserId) && currentSession.value.sessionType === (chatData.sessionType || 1))
  )

  // 如果是当前会话，添加消息到列表
  if (isCurrentSession) {
    // 检查消息是否已存在（避免重复）
    const msgExists = messages.value.some(m => m.messageId === chatData.messageId)
    if (!msgExists) {
      const newMsg = {
        messageId: chatData.messageId,
        sessionId: chatData.sessionId,
        fromUserId: chatData.fromUserId,
        toUserId: chatData.toUserId,
        sessionType: chatData.sessionType,
        contentType: chatData.contentType || 1,
        content: chatData.content,
        sendTime: chatData.sendTime,
        status: 1,
        isSelf: false,
        fromUserName: chatData.fromUserName,
        fromUserAvatar: chatData.fromUserAvatar
      }
      // 预计算头像URL
      newMsg._avatarUrl = computeMessageAvatarUrl(newMsg)
      messages.value.push(newMsg)

      scrollToBottom()

      // 注意：不在这里调用已读接口
      // 已读应该只在用户主动切换会话时触发（selectSession 中处理）
      // 或者点击通知卡片跳转到会话时触发
      
      // 同步更新当前会话的 sessionId（如果是临时会话）
      if (currentSession.value.isTemp && chatData.sessionId) {
        currentSession.value.sessionId = chatData.sessionId
        currentSession.value.isTemp = false
      }
    }
  }
}

// 记录上次处理的 userId，避免重复处理
let lastHandledUserId = null

// 监听路由参数变化（用于从通知跳转过来时更新会话）
watch(
  () => route.query.userId,
  async (newUserId, oldUserId) => {
    // 转换为字符串比较，避免类型问题
    const newId = newUserId ? String(newUserId) : null
    const oldId = oldUserId ? String(oldUserId) : null
    const lastId = lastHandledUserId ? String(lastHandledUserId) : null
    
    if (newId && newId !== oldId && newId !== lastId) {
      console.log('[Chat] watch - 路由参数变化:', oldId, '->', newId, '上次处理:', lastId)
      lastHandledUserId = newId
      await handleRouteQuery()
    }
  }
)

// 监听点击关闭菜单
onMounted(async () => {
  document.addEventListener('click', closeMenus)

  // 预加载默认头像为 base64
  defAvaBase64 = await loadImageAsBase64(defAva)
  // 预加载自己的头像为 base64
  if (userStore.avatar) {
    await loadImageAsBase64(userStore.avatar)
  }

  // 注册 MQTT 消息处理器
  mqttClient.onMessage(handleMqttMessage)

  // 监听 Electron 的跳转聊天事件（用于已在聊天页面时切换会话）
  if (window.electronAPI && window.electronAPI.on) {
    window.electronAPI.on('navigate-to-chat', handleNavigateToChatEvent)
  }

  // 加载通讯录数据（用于显示在线状态）
  contactsStore.fetchUserList()

  // 处理路由参数
  if (route.query.userId) {
    lastHandledUserId = String(route.query.userId)
  }
  await handleRouteQuery()
  if (!route.query.userId) {
    loadSessions()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenus)

  // 移除 MQTT 消息处理器
  mqttClient.offMessage(handleMqttMessage)

  // 移除 Electron 事件监听
  if (window.electronAPI && window.electronAPI.removeListener) {
    window.electronAPI.removeListener('navigate-to-chat')
  }
})

// 处理 Electron 的跳转聊天事件
const handleNavigateToChatEvent = async (data) => {
  console.log('[Chat] 收到 navigate-to-chat 事件:', data)
  
  const targetUserId = data.userId || data.fromUserId
  const targetSessionId = data.sessionId
  const targetUserName = data.userName || data.sender
  
  if (!targetUserId && !targetSessionId) {
    console.log('[Chat] 没有 userId 或 sessionId，忽略')
    return
  }
  
  // 如果会话列表为空，先加载
  if (sessions.value.length === 0) {
    console.log('[Chat] 会话列表为空，先加载')
    await loadSessions()
  }
  
  // 优先用 sessionId 匹配
  if (targetSessionId) {
    const sessionBySessionId = sessions.value.find(s => s.sessionId === targetSessionId)
    if (sessionBySessionId) {
      console.log('[Chat] 通过 sessionId 找到会话:', sessionBySessionId.targetName)
      await selectSession(sessionBySessionId)
      return
    }
  }
  
  // 用 userId 匹配
  if (targetUserId) {
    const targetId = Number(targetUserId)
    const existingSession = sessions.value.find(
      s => Number(s.targetUserId) === targetId && s.sessionType === 1
    )
    
    if (existingSession) {
      console.log('[Chat] 通过 userId 找到会话:', existingSession.targetName)
      await selectSession(existingSession)
      return
    }
    
    // 没找到，创建临时会话
    console.log('[Chat] 未找到会话，创建临时会话')
    const tempSession = {
      sessionId: `temp_${targetId}_${Date.now()}`,
      sessionType: 1,
      targetUserId: targetId,
      targetName: targetUserName || '未知用户',
      targetAvatar: '',
      lastMessage: '',
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
      isTop: 0,
      isTemp: true
    }
    
    sessions.value.unshift(tempSession)
    currentSession.value = tempSession
    messages.value = []
    currentPage.value = 1
    hasMoreMessages.value = false
    addTempSession(tempSession)
  }
}

// 组件激活时处理
onActivated(async () => {
  const queryUserId = route.query.userId ? String(route.query.userId) : null
  const lastId = lastHandledUserId ? String(lastHandledUserId) : null
  
  // 如果有路由参数，且与上次处理的不同，处理跳转
  if (queryUserId && queryUserId !== lastId) {
    console.log('[Chat] onActivated - 检测到新的 userId:', queryUserId, '上次处理:', lastId)
    lastHandledUserId = queryUserId
    await handleRouteQuery()
  } else if (!queryUserId) {
    // 没有路由参数，静默刷新会话列表
    lastHandledUserId = null
    loadSessions()
  }
})
</script>

<style lang="scss" scoped>
.chat-container {
  display: flex;
  height: calc(100vh - 54px);
  background: #f5f7fa;
  overflow: hidden;
}

// 左侧会话列表
.chat-sidebar {
  width: 280px;
  min-width: 280px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;

  .sidebar-header {
    padding: 12px;
    border-bottom: 1px solid #f0f0f0;
    height: 60px;
    display: flex;
    align-items: center;

    .search-input {
      :deep(.el-input__wrapper) {
        border-radius: 18px;
        background: #f5f7fa;
      }
    }
  }

  .session-list {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;

    .session-scrollbar {
      flex: 1;

      :deep(.el-scrollbar__wrap) {
        overflow-x: hidden;
      }

      :deep(.el-scrollbar__view) {
        min-height: 100%;
        display: flex;
        flex-direction: column;
      }
    }

    .session-list-content {
      flex: 1;
      display: flex;
      flex-direction: column;

      .el-empty {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }
}

.session-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
  z-index: 1;
  user-select: none;

  &:hover {
    background: #f5f7fa;
  }

  &.active {
    background: #ecf5ff;
  }

  .session-avatar {
    position: relative;
    margin-right: 12px;
    flex-shrink: 0;
    display: flex;
    align-items: center;

    .system-avatar {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #FF9500 0%, #FFB84D 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }

    .el-avatar {
      font-weight: 600;
      font-size: 14px;
    }

    .avatar-male {
      background: var(--el-color-primary);
      color: #fff;
    }

    .avatar-female {
      background: #ff9500;
      color: #fff;
    }

    .avatar-offline {
      background: #909399;
      color: #fff;
      opacity: 0.6;
    }

    .avatar-default {
      background: var(--el-color-primary);
      color: #fff;
    }

    .online-status {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid #fff;

      &.online {
        background: #67c23a;
      }

      &.offline {
        background: #c0c4cc;
      }
    }

    .unread-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      font-size: 11px;
      line-height: 18px;
      text-align: center;
      color: #fff;
      background: #f56c6c;
      border-radius: 9px;
    }
  }

  .session-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;

    .session-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;

      .session-name {
        font-size: 14px;
        font-weight: 500;
        color: #303133;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .session-time {
        font-size: 12px;
        color: #909399;
        flex-shrink: 0;
        margin-left: 8px;
      }
    }

    .session-preview {
      display: flex;
      align-items: center;

      .pin-icon {
        font-size: 12px;
        color: #409eff;
        margin-right: 4px;
      }

      .last-message {
        font-size: 13px;
        color: #909399;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}

// 右侧聊天区域
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
}

.chat-header {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #e4e7ed;
  position: relative;

  .chat-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 500;
    color: #303133;
  }
  
  .chat-actions {
    position: absolute;
    right: 20px;
  }
}

.chat-messages {
  flex: 1;
  overflow: hidden;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;

  .load-more {
    text-align: center;
    padding: 8px 0;
    flex-shrink: 0;
  }

  :deep(.el-scrollbar) {
    flex: 1;

    .el-scrollbar__wrap {
      overflow-x: hidden;
    }
  }

  .messages-wrapper {
    padding: 16px;

    &.messages-hidden {
      visibility: hidden;
    }
  }

  .empty-messages {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.load-more {
  text-align: center;
  padding: 8px 0 16px;
}

.time-divider {
  text-align: center;
  margin: 16px 0;

  span {
    display: inline-block;
    padding: 4px 12px;
    font-size: 12px;
    color: #909399;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 12px;
  }
}

.message-item {
  margin-bottom: 16px;

  &.message-self {
    .message-content {
      flex-direction: row-reverse;
    }

    .message-body {
      align-items: flex-end;
    }
  }

  &.message-system {
    margin-bottom: 12px;
  }

  // 系统消息卡片样式
  .system-message-card {
    display: flex;
    align-items: flex-start;
    background: #fff;
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    width: 100%;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      transform: translateY(-1px);
    }

    .card-icon {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #FF9500 0%, #FFB84D 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      flex-shrink: 0;
      margin-right: 14px;
    }

    .card-content {
      flex: 1;
      min-width: 0;

      .card-header-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 6px;
      }

      .card-title {
        font-size: 15px;
        font-weight: 600;
        color: #FF9500;
        line-height: 1.4;
      }

      .card-status {
        flex-shrink: 0;
      }

      .card-desc {
        font-size: 13px;
        color: #606266;
        line-height: 1.5;
        margin-bottom: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .card-time {
        font-size: 12px;
        color: #909399;
      }
    }

    .card-arrow {
      color: #c0c4cc;
      margin-left: 12px;
      flex-shrink: 0;
      align-self: center;
      font-size: 16px;
    }
  }

  .message-content {
    display: flex;
    align-items: flex-start;
    gap: 8px;

    .send-status {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 36px;

      &.sending {
        color: #909399;
      }

      &.failed {
        color: #f56c6c;
        cursor: pointer;

        &:hover {
          color: #f78989;
        }
      }
    }
  }

  .message-avatar-el {
    flex-shrink: 0;
    font-weight: 600;
    font-size: 14px;

    &.avatar-male {
      background: var(--el-color-primary);
      color: #fff;
    }

    &.avatar-female {
      background: #ff9500;
      color: #fff;
    }

    &.avatar-offline {
      background: #909399;
      color: #fff;
      opacity: 0.6;
    }

    &.avatar-default {
      background: var(--el-color-primary);
      color: #fff;
    }
  }

  .message-body {
    display: flex;
    flex-direction: column;
    max-width: 60%;

    .message-sender {
      font-size: 12px;
      color: #909399;
      margin-bottom: 4px;
    }

    .message-bubble {
      padding: 8px 12px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      word-break: break-word;

      &.bubble-self {
        background: #2E74FF;
        color: #fff;
      }
    }

    .message-recalled {
      padding: 6px 10px;
      font-size: 12px;
      color: #909399;
      background: rgba(0, 0, 0, 0.03);
      border-radius: 4px;
    }

    .message-time {
      font-size: 11px;
      color: #c0c4cc;
      margin-top: 4px;
    }
  }
}

.message-text {
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: 4px;
  cursor: pointer;
}

.message-file {
  display: flex;
  align-items: center;
  gap: 8px;

  .file-info {
    display: flex;
    flex-direction: column;

    .file-name {
      font-size: 12px;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-action {
      font-size: 11px;
      color: #409eff;
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

// 输入区域
.chat-input {
  border-top: 1px solid #e4e7ed;
  background: #fff;

  .input-toolbar {
    display: flex;
    gap: 4px;
    padding: 8px 16px 0;
  }

  .input-area {
    padding: 8px 16px;

    :deep(.el-textarea__inner) {
      border: none;
      box-shadow: none;
      padding: 0;

      &:focus {
        box-shadow: none;
      }
    }
  }

  .input-actions {
    display: flex;
    justify-content: flex-end;
    padding: 0 16px 12px;
  }
}

// 未选择会话
.no-session {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

// 右键菜单
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 100px;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  padding: 4px 0;

  .menu-item {
    padding: 8px 16px;
    font-size: 13px;
    color: #606266;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: #f5f7fa;
    }

    &.danger {
      color: #f56c6c;
    }
  }
}
</style>
