<template>
  <div class="contacts-container">
    <el-container>
      <!-- 左侧联系人列表 -->
      <el-aside width="280px" class="contacts-sidebar">
        <div class="search-box">
          <el-input
            v-model="searchText"
            placeholder="搜索联系人"
            prefix-icon="Search"
            clearable
                      class="search-input"
            @input="handleSearch"
          />
        </div>

        <div class="contacts-list" v-loading="loading" element-loading-text="加载中...">
          <el-scrollbar height="calc(100vh - 114px)">
            <!-- 在线用户 -->
            <div v-if="onlineUsers.length > 0" class="contact-group">
              <div class="group-title" @click="onlineGroupCollapsed = !onlineGroupCollapsed">
                <el-icon class="collapse-icon" :class="{ collapsed: onlineGroupCollapsed }">
                  <ArrowDown />
                </el-icon>
                <el-icon class="group-icon"><User /></el-icon>
                <span>在线 ({{ onlineUsers.length }})</span>
              </div>
              <el-collapse-transition>
                <div v-show="!onlineGroupCollapsed" class="group-content">
                  <div
                    v-for="user in onlineUsers"
                    :key="user.userId"
                    class="contact-item"
                    :class="{ active: selectedUser?.userId === user.userId }"
                    @click="handleSelectUser(user)"
                    @dblclick="handleDoubleClick(user)"
                    @contextmenu.prevent="handleContextMenu($event, user)"
                  >
                    <div class="avatar-wrapper">
                      <el-avatar
                        :size="36"
                        :src="getAvatarUrl(user.avatar)"
                        :class="getAvatarClass(user)"
                        shape="square"
                      >
                        <el-icon><UserFilled /></el-icon>
                      </el-avatar>
                      <span class="online-status online"></span>
                    </div>
                    <div class="contact-info">
                      <div class="contact-name">{{ user.nickName || user.userName }}</div>
                      <div class="contact-dept">{{ user.dept?.deptName || '未分配部门' }}</div>
                    </div>
                  </div>
                </div>
              </el-collapse-transition>
            </div>

            <!-- 离线用户 -->
            <div v-if="offlineUsers.length > 0" class="contact-group">
              <div class="group-title" @click="offlineGroupCollapsed = !offlineGroupCollapsed">
                <el-icon class="collapse-icon" :class="{ collapsed: offlineGroupCollapsed }">
                  <ArrowDown />
                </el-icon>
                <el-icon class="group-icon"><User /></el-icon>
                <span>离线 ({{ offlineUsers.length }})</span>
              </div>
              <el-collapse-transition>
                <div v-show="!offlineGroupCollapsed" class="group-content">
                  <div
                    v-for="user in offlineUsers"
                    :key="user.userId"
                    class="contact-item"
                    :class="{ active: selectedUser?.userId === user.userId }"
                    @click="handleSelectUser(user)"
                    @dblclick="handleDoubleClick(user)"
                    @contextmenu.prevent="handleContextMenu($event, user)"
                  >
                    <div class="avatar-wrapper">
                      <el-avatar
                        :size="36"
                        :src="getAvatarUrl(user.avatar)"
                        class="avatar-offline"
                        shape="square"
                      >
                        <el-icon><UserFilled /></el-icon>
                      </el-avatar>
                      <span class="online-status offline"></span>
                    </div>
                    <div class="contact-info">
                      <div class="contact-name">{{ user.nickName || user.userName }}</div>
                      <div class="contact-dept">{{ user.dept?.deptName || '未分配部门' }}</div>
                    </div>
                  </div>
                </div>
              </el-collapse-transition>
            </div>
          </el-scrollbar>
        </div>
      </el-aside>

      <!-- 右侧联系人详情 -->
      <el-main class="contacts-main">
        <div v-if="selectedUser" class="contact-detail">
          <!-- 头像和基本信息 -->
          <div class="detail-header-center">
            <el-avatar
              :size="90"
              :src="getAvatarUrl(selectedUser.avatar)"
              :class="getAvatarClass(selectedUser)"
              shape="square"
            >
              <el-icon><UserFilled /></el-icon>
            </el-avatar>
            <h2 class="user-name">{{ selectedUser.nickName || selectedUser.userName }}</h2>
            <div class="user-account">账号: {{ selectedUser.userName }}</div>
            <div class="status-badge" :class="selectedUser.pucsOnline === 0 ? 'online' : 'offline'">
              <span class="status-dot"></span>
              {{ selectedUser.pucsOnline === 0 ? '在线' : '离线' }}
            </div>
          </div>

          <!-- 个人信息卡片 -->
          <div class="info-cards">
            <!-- 基本信息 -->
            <div class="info-card" v-if="selectedUser.sex">
              <div class="info-row">
                <span class="info-icon">
                  <el-icon v-if="selectedUser.sex === '0'" color="var(--el-color-primary)"><Male /></el-icon>
                  <el-icon v-else-if="selectedUser.sex === '1'" color="#f56c6c"><Female /></el-icon>
                </span>
                <span class="info-text">
                  {{ selectedUser.sex === '0' ? '男' : selectedUser.sex === '1' ? '女' : '未知' }}
                </span>
              </div>
            </div>

            <!-- 部门职务 -->
            <div class="info-card" v-if="selectedUser.dept?.deptName || selectedUser.postNames">
              <div class="info-row">
                <el-icon class="info-icon"><OfficeBuilding /></el-icon>
                <div class="info-text">
                  <div>{{ selectedUser.dept?.deptName }}</div>
                  <div class="info-sub" v-if="selectedUser.postNames">{{ selectedUser.postNames }}</div>
                </div>
              </div>
            </div>

            <!-- 联系方式 -->
            <div class="info-card" v-if="selectedUser.phonenumber || selectedUser.email">
              <div class="info-row" v-if="selectedUser.phonenumber">
                <el-icon class="info-icon"><Phone /></el-icon>
                <span class="info-text">{{ selectedUser.phonenumber }}</span>
              </div>
              <div class="info-row" v-if="selectedUser.email">
                <el-icon class="info-icon"><Message /></el-icon>
                <span class="info-text">{{ selectedUser.email }}</span>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="detail-actions-center">
            <el-button 
              type="primary" 
              size="large" 
              @click="handleSendMessage"
            >
              <el-icon><ChatDotRound /></el-icon>
              <span>发送消息</span>
            </el-button>
            <el-button 
              size="large" 
              @click="handleSendTodo"
            >
              <el-icon><Document /></el-icon>
              <span>发送待办</span>
            </el-button>
            <el-button 
              size="large" 
              @click="handleEmail" 
              v-if="selectedUser.email"
            >
              <el-icon><Message /></el-icon>
              <span>发送邮件</span>
            </el-button>
          </div>
        </div>

        <div v-else class="empty-container">
          <el-empty description="请选择一个联系人查看详情" />
        </div>
      </el-main>
    </el-container>

    <!-- 右键菜单 -->
    <div
      v-show="contextMenuVisible"
      class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      @click.stop
    >
      <div class="menu-item" @click="handleSendMessageFromMenu">
        <el-icon><ChatDotRound /></el-icon>
        <span>发送消息</span>
      </div>
      <div class="menu-item" @click="handleSendTodoFromMenu">
        <el-icon><Document /></el-icon>
        <span>发送待办</span>
      </div>
      <div class="menu-item" @click="handleEmailFromMenu" v-if="contextMenuUser?.email">
        <el-icon><Message /></el-icon>
        <span>发送邮件</span>
      </div>
    </div>

    <!-- 发送待办对话框 -->
    <CreateAssignDialog
      v-model="todoDialogVisible"
      :edit-item="currentAssignItem"
      :pre-selected-users="preSelectedUsers"
      @confirm="handleTodoConfirm"
    />
  </div>
</template>

<script setup name="Contacts">
import { ref, computed, onMounted, onUnmounted, onActivated } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Phone, Message, Document, Male, Female, OfficeBuilding, UserFilled, ArrowDown, ChatDotRound } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import CreateAssignDialog from '@/views/todo/MyAssign/components/CreateAssignDialog.vue'
import { getAvatarUrl } from '@/utils/avatar'
import useContactsStore from '@/store/modules/contacts'

const contactsStore = useContactsStore()
const searchText = ref('')
const selectedUser = ref(null)
const contextMenuUser = ref(null)
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const todoDialogVisible = ref(false)
const currentAssignItem = ref(null)
const currentReceiver = ref(null)
const onlineGroupCollapsed = ref(false)
const offlineGroupCollapsed = ref(false)
const preSelectedUsers = ref([])
const router = useRouter()

// 从 store 获取 loading 状态
const loading = computed(() => contactsStore.loading)

// 从 store 获取用户列表
const userList = computed(() => contactsStore.userList)

// 过滤后的用户列表
const filteredUsers = computed(() => {
  if (!searchText.value) {
    return userList.value
  }
  const keyword = searchText.value.toLowerCase()
  return userList.value.filter(user => {
    return (
      user.userName?.toLowerCase().includes(keyword) ||
      user.nickName?.toLowerCase().includes(keyword) ||
      user.phonenumber?.includes(keyword) ||
      user.dept?.deptName?.toLowerCase().includes(keyword)
    )
  })
})

// 在线用户 - 使用后端真实的 pucsOnline 字段（0=在线, 1=离线）
const onlineUsers = computed(() => {
  return filteredUsers.value.filter(user => user.pucsOnline === 0)
})

// 离线用户 - 使用后端真实的 pucsOnline 字段（0=在线, 1=离线）
const offlineUsers = computed(() => {
  return filteredUsers.value.filter(user => user.pucsOnline === 1)
})

// 获取头像样式类
const getAvatarClass = (user) => {
  if (user.pucsOnline === 1) {
    return 'avatar-offline'
  }
  // 0-男 1-女
  return user.sex === '0' ? 'avatar-male' : user.sex === '1' ? 'avatar-female' : 'avatar-default'
}

// 获取用户列表（使用 store）
const getUserList = async () => {
  try {
    await contactsStore.fetchUserList()
  } catch (error) {
    console.error('获取用户列表失败:', error)
  }
}

// 搜索处理
const handleSearch = () => {
  // 搜索逻辑已在 computed 中处理
}

// 选择用户
const handleSelectUser = (user) => {
  selectedUser.value = user
}

// 双击用户跳转到聊天页面
const handleDoubleClick = (user) => {
  router.push({
    path: '/chat',
    query: {
      userId: user.userId,
      userName: user.nickName || user.userName,
      userAvatar: getAvatarUrl(user.avatar)
    }
  })
}

// 右键菜单
const handleContextMenu = (event, user) => {
  event.preventDefault()
  contextMenuUser.value = user
  contextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY
  }
  contextMenuVisible.value = true
  
  // 点击其他地方关闭菜单
  document.addEventListener('click', closeContextMenu, { once: true })
}

// 关闭右键菜单
const closeContextMenu = () => {
  contextMenuVisible.value = false
}

// 发送消息 - 跳转到聊天页面
const handleSendMessage = () => {
  if (!selectedUser.value) return
  
  router.push({
    path: '/chat',
    query: {
      userId: selectedUser.value.userId,
      userName: selectedUser.value.nickName || selectedUser.value.userName,
      userAvatar: getAvatarUrl(selectedUser.value.avatar)
    }
  })
}

// 从右键菜单发送消息
const handleSendMessageFromMenu = () => {
  if (!contextMenuUser.value) return
  
  router.push({
    path: '/chat',
    query: {
      userId: contextMenuUser.value.userId,
      userName: contextMenuUser.value.nickName || contextMenuUser.value.userName,
      userAvatar: getAvatarUrl(contextMenuUser.value.avatar)
    }
  })
  closeContextMenu()
}

// 发送待办
const handleSendTodo = () => {
  if (!selectedUser.value) return
  
  currentReceiver.value = selectedUser.value
  // 不传 editItem，保持创建模式
  currentAssignItem.value = null
  // 设置预选用户
  preSelectedUsers.value = [selectedUser.value.nickName || selectedUser.value.userName]
  todoDialogVisible.value = true
}

// 从右键菜单发送待办
const handleSendTodoFromMenu = () => {
  if (!contextMenuUser.value) return
  
  currentReceiver.value = contextMenuUser.value
  // 不传 editItem，保持创建模式
  currentAssignItem.value = null
  // 设置预选用户
  preSelectedUsers.value = [contextMenuUser.value.nickName || contextMenuUser.value.userName]
  closeContextMenu()
  todoDialogVisible.value = true
}

// 处理待办确认
const handleTodoConfirm = async (formData) => {
  try {
    const { addAssignment } = await import('@/api/todo')
    const params = {
      title: formData.title,
      content: formData.content,
      imgs: formData.images || '',
      url: formData.url || '',
      dueDate: formData.deadline,
      assigneeList: formData.assigneeList || []
    }
    
    console.log('发送待办参数:', params)
    
    const response = await addAssignment(params)
    if (response.code === 200) {
      ElMessage.success('待办发送成功')
      todoDialogVisible.value = false
      currentAssignItem.value = null
      currentReceiver.value = null
      preSelectedUsers.value = []
    }
  } catch (error) {
    console.error('发送待办失败:', error)
  }
}

// 发送邮件
const handleEmail = () => {
  if (selectedUser.value?.email) {
    window.location.href = `mailto:${selectedUser.value.email}`
  }
}

const handleEmailFromMenu = () => {
  if (contextMenuUser.value?.email) {
    window.location.href = `mailto:${contextMenuUser.value.email}`
  }
  closeContextMenu()
}

// 格式化时间
const parseTime = (time) => {
  if (!time) return '-'
  const date = new Date(time)
  return date.toLocaleString('zh-CN')
}

// 定时刷新用户列表
let refreshTimer = null
const startRefreshTimer = () => {
  refreshTimer = setInterval(() => {
    contactsStore.refreshUserList() // 静默刷新
  }, 30000) // 每30秒刷新一次
}

onMounted(() => {
  getUserList()
  startRefreshTimer()
})

// 页面激活时静默刷新数据
onActivated(() => {
  contactsStore.refreshUserList() // 静默刷新
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<style scoped lang="scss">
.contacts-container {
  height: calc(100vh - 54px);
  background: #f5f7fa;

  .el-container {
    height: 100%;
  }

  .contacts-sidebar {
    background: #fff;
    border-right: 1px solid #e4e7ed;
    display: flex;
    flex-direction: column;
    margin:0;
    padding:0;
    .search-box {
      padding: 12px;
      height:60px;
        display: flex;
          align-items: center;
      border-bottom: 1px solid #f0f0f0;
      .search-input {
      :deep(.el-input__wrapper) {
        border-radius: 18px;
        background: #f5f7fa;
      }
    }
    }

    .contacts-list {
      flex: 1;
      overflow: hidden;

      .contact-group {
        .group-title {
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 600;
          color: #606266;
          background: #f5f7fa;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;

          &:hover {
            background: #ecf5ff;
          }

          .collapse-icon {
            font-size: 14px;
            color: #909399;
            transition: transform 0.3s;

            &.collapsed {
              transform: rotate(-90deg);
            }
          }

          .group-icon {
            color: var(--el-color-primary);
            font-size: 18px;
            font-weight: bold;
          }

          span {
            font-weight: bold;
          }
        }

        .contact-item {
          padding: 8px 30px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.3s;
          border-bottom: 1px solid #f0f0f0;

          &:hover {
            background: #f5f7fa;
          }

          &.active {
            background: var(--el-color-primary-light-9);
          }

          .avatar-wrapper {
            position: relative;

            .el-avatar {
              font-weight: 600;
              font-size: 14px;

              .el-icon {
                font-size: 18px;
              }
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
              bottom: 1px;
              right: 1px;
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
          }

          .contact-info {
            flex: 1;
            min-width: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;

            .contact-name {
              font-size: 14px;
              font-weight: 500;
              color: #303133;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              flex: 1;
              margin-right: 8px;
            }

            .contact-dept {
              font-size: 12px;
              color: #909399;
              white-space: nowrap;
              flex-shrink: 0;
            }
          }
        }
      }
    }
  }

  .contacts-main {
    background: #fff;
    padding: 24px;

    .empty-container {
      display: flex;
      align-items: center;
      justify-content: center;
      height: calc(100vh - 104px);
      width: 100%;

      :deep(.el-empty) {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
    }

    .contact-detail {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;

      .el-avatar {
        font-weight: 600;
        font-size: 36px;

        .el-icon {
          font-size: 48px;
        }
      }

      .avatar-male {
        background: var(--el-color-primary);
        color: #fff;
        box-shadow: 0 8px 24px var(--el-color-primary-light-7);

        &:hover {
          box-shadow: 0 12px 32px var(--el-color-primary-light-6);
        }
      }

      .avatar-female {
        background: #ff9500;
        color: #fff;
        box-shadow: 0 8px 24px rgba(255, 149, 0, 0.3);

        &:hover {
          box-shadow: 0 12px 32px rgba(255, 149, 0, 0.4);
        }
      }

      .avatar-offline {
        background: #909399;
        color: #fff;
        opacity: 0.6;
        box-shadow: 0 8px 24px rgba(144, 147, 153, 0.2);

        &:hover {
          box-shadow: 0 12px 32px rgba(144, 147, 153, 0.3);
        }
      }

      .avatar-default {
        background: var(--el-color-primary);
        color: #fff;
        box-shadow: 0 8px 24px var(--el-color-primary-light-7);

        &:hover {
          box-shadow: 0 12px 32px var(--el-color-primary-light-6);
        }
      }

      // 头像和基本信息居中
      .detail-header-center {
        text-align: center;
        margin-bottom: 36px;

        .el-avatar {
          margin-bottom: 20px;
          transition: all 0.3s ease;

          &:hover {
            transform: scale(1.05);
          }
        }

        .user-name {
          margin: 0 0 10px 0;
          font-size: 24px;
          font-weight: 600;
          color: #303133;
          letter-spacing: 0.5px;
        }

        .user-account {
          font-size: 14px;
          color: #909399;
          margin-bottom: 16px;
          font-family: 'Monaco', 'Menlo', monospace;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 20px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;

          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }

          &.online {
            background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
            color: #2e7d32;

            .status-dot {
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background: #4caf50;
              box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.2);
              animation: pulse 2s infinite;
            }
          }

          &.offline {
            background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
            color: #757575;

            .status-dot {
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background: #9e9e9e;
            }
          }
        }
      }

      @keyframes pulse {
        0%, 100% {
          box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.2);
        }
        50% {
          box-shadow: 0 0 0 6px rgba(76, 175, 80, 0.1);
        }
      }

      // 信息卡片
      .info-cards {
        margin-bottom: 32px;

        .info-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
          border: 1px solid #e8eaed;
          border-radius: 12px;
          padding: 18px 22px;
          margin-bottom: 14px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: all 0.3s ease;

          &:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            transform: translateY(-2px);
          }

          &:last-child {
            margin-bottom: 0;
          }

          .info-row {
            display: flex;
            align-items: flex-start;
            gap: 14px;
            padding: 10px 0;

            &:not(:last-child) {
              border-bottom: 1px solid #f0f0f0;
            }

            &:last-child {
              padding-bottom: 0;
            }

            &:first-child {
              padding-top: 0;
            }

            .info-icon {
              font-size: 20px;
              color: var(--el-color-primary);
              flex-shrink: 0;
              margin-top: 2px;
            }

            .info-text {
              flex: 1;
              font-size: 15px;
              color: #303133;
              word-break: break-all;
              line-height: 1.6;

              .info-sub {
                font-size: 13px;
                color: #909399;
                margin-top: 6px;
              }
            }
          }
        }
      }

      // 操作按钮居中
      .detail-actions-center {
        display: flex;
        justify-content: center;
        gap: 12px;
        padding-top: 20px;

        .el-button {
          min-width: 140px;
          border-radius: 20px;

          .el-icon {
            margin-right: 6px;
          }
        }
      }
    }
  }

  // 右键菜单样式
  .context-menu {
    position: fixed;
    z-index: 9999;
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    padding: 4px 0;
    min-width: 140px;

    .menu-item {
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
      color: #606266;

      .el-icon {
        font-size: 16px;
      }

      &:hover {
        background: var(--el-color-primary-light-9);
        color: var(--el-color-primary);
      }

      &:active {
        background: var(--el-color-primary-light-8);
      }
    }
  }
}
</style>
