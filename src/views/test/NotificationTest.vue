<template>
  <div class="notification-test-container">
    <el-card class="test-card">
      <template #header>
        <div class="card-header">
          <span>🔔 自定义通知测试面板</span>
        </div>
      </template>

      <div class="test-section">
        <h3>基础通知类型</h3>
        <el-row :gutter="16">
          <el-col :span="6">
            <el-button type="success" @click="showSuccessNotification" style="width: 100%">
              成功通知
            </el-button>
          </el-col>
          <el-col :span="6">
            <el-button type="warning" @click="showWarningNotification" style="width: 100%">
              警告通知
            </el-button>
          </el-col>
          <el-col :span="6">
            <el-button type="danger" @click="showErrorNotification" style="width: 100%">
              错误通知
            </el-button>
          </el-col>
          <el-col :span="6">
            <el-button type="primary" @click="showInfoNotification" style="width: 100%">
              信息通知
            </el-button>
          </el-col>
        </el-row>
      </div>

      <el-divider />

      <div class="test-section">
        <h3>带按钮的通知</h3>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-button @click="showTaskNotification" style="width: 100%">
              待办任务提醒
            </el-button>
          </el-col>
          <el-col :span="8">
            <el-button @click="showApprovalNotification" style="width: 100%">
              审批请求
            </el-button>
          </el-col>
          <el-col :span="8">
            <el-button @click="showUpdateNotification" style="width: 100%">
              系统更新
            </el-button>
          </el-col>
        </el-row>
      </div>

      <el-divider />

      <div class="test-section">
        <h3>通知队列测试</h3>
        <el-button type="primary" @click="showMultipleNotifications">
          连续发送 5 个通知（测试队列）
        </el-button>
      </div>

      <el-divider />

      <div class="test-section">
        <h3>自定义通知</h3>
        <el-form :model="customForm" label-width="100px">
          <el-form-item label="通知标题">
            <el-input v-model="customForm.title" placeholder="请输入通知标题" />
          </el-form-item>
          <el-form-item label="通知内容">
            <el-input
              v-model="customForm.content"
              type="textarea"
              :rows="3"
              placeholder="请输入通知内容"
            />
          </el-form-item>
          <el-form-item label="通知类型">
            <el-radio-group v-model="customForm.type">
              <el-radio label="success">成功</el-radio>
              <el-radio label="warning">警告</el-radio>
              <el-radio label="error">错误</el-radio>
              <el-radio label="info">信息</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="显示时长">
            <el-input-number
              v-model="customForm.duration"
              :min="1000"
              :max="30000"
              :step="1000"
            />
            <span style="margin-left: 10px; color: #999">毫秒</span>
          </el-form-item>
          <el-form-item label="自动关闭">
            <el-switch v-model="customForm.autoClose" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="showCustomNotification">
              发送自定义通知
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-divider />

      <div class="test-section">
        <h3>通知事件日志</h3>
        <div class="event-log">
          <div v-if="eventLog.length === 0" class="empty-log">
            暂无事件记录
          </div>
          <div
            v-for="(event, index) in eventLog"
            :key="index"
            class="log-item"
          >
            <span class="log-time">{{ event.time }}</span>
            <span class="log-type" :class="`log-type-${event.type}`">
              {{ event.type }}
            </span>
            <span class="log-message">{{ event.message }}</span>
          </div>
        </div>
        <el-button size="small" @click="clearLog" style="margin-top: 10px">
          清空日志
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script>
export default {
  name: 'NotificationTest',
  data() {
    return {
      customForm: {
        title: '自定义通知',
        content: '这是一条自定义通知消息',
        type: 'info',
        duration: 5000,
        autoClose: true
      },
      eventLog: []
    };
  },
  mounted() {
    // 监听通知按钮点击事件
    if (window.electronAPI && window.electronAPI.on) {
      window.electronAPI.on('notification-action', this.handleNotificationAction);
    }
  },
  beforeUnmount() {
    // 移除事件监听
    if (window.electronAPI && window.electronAPI.removeListener) {
      window.electronAPI.removeListener('notification-action', this.handleNotificationAction);
    }
  },
  methods: {
    // 发送通知的通用方法（使用新的自动弹出卡片API）
    sendNotification(data) {
      if (window.electronAPI && window.electronAPI.showNotificationCard) {
        window.electronAPI.showNotificationCard(data);
        this.addLog('发送', `发送通知: ${data.title}`);
      } else {
        this.$message.warning('Electron API 不可用，请在 Electron 环境中测试');
      }
    },

    // 成功通知
    showSuccessNotification() {
      this.sendNotification({
        title: '操作成功',
        content: '您的数据已成功保存到服务器！',
        type: 'success',
        duration: 3000
      });
    },

    // 警告通知
    showWarningNotification() {
      this.sendNotification({
        title: '警告提示',
        content: '您的会话即将在 5 分钟后过期，请及时保存数据',
        type: 'warning',
        duration: 8000
      });
    },

    // 错误通知
    showErrorNotification() {
      this.sendNotification({
        title: '操作失败',
        content: '网络连接失败，请检查您的网络设置后重试',
        type: 'error',
        duration: 10000
      });
    },

    // 信息通知
    showInfoNotification() {
      this.sendNotification({
        title: '系统消息',
        content: '您有一条新的系统消息，请注意查收',
        type: 'info',
        duration: 5000
      });
    },

    // 待办任务提醒
    showTaskNotification() {
      this.sendNotification({
        title: '待办提醒',
        content: '您有 3 个待办任务即将到期，请及时处理',
        type: 'warning',
        autoClose: false,
        buttons: [
          { text: '稍后处理', type: 'secondary', action: 'task-later' },
          { text: '立即查看', type: 'primary', action: 'task-view' }
        ]
      });
    },

    // 审批请求
    showApprovalNotification() {
      this.sendNotification({
        title: '审批请求',
        content: '张三提交了一份采购申请（金额：¥5,000），等待您的审批',
        type: 'info',
        autoClose: false,
        buttons: [
          { text: '拒绝', type: 'secondary', action: 'approval-reject' },
          { text: '通过', type: 'primary', action: 'approval-approve' }
        ]
      });
    },

    // 系统更新
    showUpdateNotification() {
      this.sendNotification({
        title: '系统更新',
        content: '发现新版本 v2.0.0，建议立即更新以获得更好的体验和新功能',
        type: 'success',
        autoClose: false,
        buttons: [
          { text: '稍后提醒', type: 'secondary', action: 'update-later' },
          { text: '立即更新', type: 'primary', action: 'update-now' }
        ]
      });
    },

    // 连续发送多个通知
    showMultipleNotifications() {
      const notifications = [
        { title: '消息 1', content: '第一条测试消息', type: 'info' },
        { title: '消息 2', content: '第二条测试消息', type: 'success' },
        { title: '消息 3', content: '第三条测试消息', type: 'warning' },
        { title: '消息 4', content: '第四条测试消息', type: 'error' },
        { title: '消息 5', content: '第五条测试消息', type: 'info' }
      ];

      notifications.forEach((notification, index) => {
        setTimeout(() => {
          this.sendNotification({
            ...notification,
            duration: 3000
          });
        }, index * 100); // 每隔 100ms 发送一个
      });

      this.addLog('队列测试', '已发送 5 个通知到队列');
    },

    // 发送自定义通知
    showCustomNotification() {
      this.sendNotification({
        title: this.customForm.title,
        content: this.customForm.content,
        type: this.customForm.type,
        duration: this.customForm.duration,
        autoClose: this.customForm.autoClose
      });
    },

    // 处理通知按钮点击
    handleNotificationAction(payload) {
      const { action, data } = payload;
      this.addLog('按钮点击', `用户点击了: ${action}`);

      // 根据不同的 action 执行不同的操作
      switch (action) {
        case 'task-view':
          this.$message.success('跳转到待办任务列表');
          this.$router.push('/todo/MyTodo');
          break;
        case 'task-later':
          this.$message.info('已设置稍后提醒');
          break;
        case 'approval-approve':
          this.$message.success('审批已通过');
          break;
        case 'approval-reject':
          this.$message.warning('审批已拒绝');
          break;
        case 'update-now':
          this.$message.success('开始下载更新...');
          break;
        case 'update-later':
          this.$message.info('将在下次启动时提醒');
          break;
        default:
          this.$message.info(`执行操作: ${action}`);
      }
    },

    // 添加日志
    addLog(type, message) {
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      this.eventLog.unshift({
        time,
        type,
        message
      });

      // 只保留最近 50 条日志
      if (this.eventLog.length > 50) {
        this.eventLog = this.eventLog.slice(0, 50);
      }
    },

    // 清空日志
    clearLog() {
      this.eventLog = [];
      this.$message.success('日志已清空');
    }
  }
};
</script>

<style scoped lang="scss">
.notification-test-container {
  padding: 20px;

  .test-card {
    max-width: 1200px;
    margin: 0 auto;

    .card-header {
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }
  }

  .test-section {
    margin-bottom: 20px;

    h3 {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #f0f0f0;
    }
  }

  .event-log {
    max-height: 300px;
    overflow-y: auto;
    background: #f5f5f5;
    border-radius: 4px;
    padding: 12px;

    .empty-log {
      text-align: center;
      color: #999;
      padding: 20px;
    }

    .log-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      margin-bottom: 8px;
      background: white;
      border-radius: 4px;
      font-size: 13px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

      .log-time {
        color: #999;
        margin-right: 12px;
        font-family: monospace;
        flex-shrink: 0;
      }

      .log-type {
        padding: 2px 8px;
        border-radius: 3px;
        font-size: 12px;
        font-weight: 500;
        margin-right: 12px;
        flex-shrink: 0;

        &.log-type-发送 {
          background: #e6f7ff;
          color: #1890ff;
        }

        &.log-type-按钮点击 {
          background: #f6ffed;
          color: #52c41a;
        }

        &.log-type-队列测试 {
          background: #fff7e6;
          color: #fa8c16;
        }
      }

      .log-message {
        color: #333;
        flex: 1;
      }
    }
  }

  // 滚动条样式
  .event-log::-webkit-scrollbar {
    width: 6px;
  }

  .event-log::-webkit-scrollbar-thumb {
    background: #d9d9d9;
    border-radius: 3px;
  }

  .event-log::-webkit-scrollbar-thumb:hover {
    background: #bfbfbf;
  }
}
</style>
