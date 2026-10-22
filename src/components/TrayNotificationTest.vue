<template>
  <div class="tray-notification-test">
    <el-card header="托盘通知测试工具">
      <el-space direction="vertical" :size="20" style="width: 100%;">
        
        <!-- 状态显示 -->
        <el-alert 
          :title="electronAvailable ? '✅ Electron 环境已就绪' : '❌ 非 Electron 环境'" 
          :type="electronAvailable ? 'success' : 'warning'"
          :closable="false"
        />
        
        <!-- 通知内容配置 -->
        <el-form label-width="80px" v-if="electronAvailable">
          <el-form-item label="通知标题">
            <el-input v-model="notificationData.title" placeholder="请输入标题" />
          </el-form-item>
          
          <el-form-item label="通知内容">
            <el-input 
              v-model="notificationData.content" 
              type="textarea"
              :rows="3"
              placeholder="请输入通知内容"
            />
          </el-form-item>
          
          <el-form-item label="消息类型">
            <el-select v-model="notificationData.type" placeholder="选择消息类型">
              <el-option label="待办任务" value="todo" />
              <el-option label="系统通知" value="system" />
              <el-option label="MQTT推送" value="mqtt" />
              <el-option label="审批流程" value="approval" />
            </el-select>
          </el-form-item>
        </el-form>
        
        <!-- 操作按钮 -->
        <el-space wrap v-if="electronAvailable">
          <el-button 
            type="primary" 
            :icon="Bell" 
            @click="sendNotification"
          >
            发送通知
          </el-button>
          
          <el-button 
            type="success" 
            @click="sendQuickNotification('待办任务')"
          >
            快速测试 - 待办
          </el-button>
          
          <el-button 
            type="warning" 
            @click="sendQuickNotification('MQTT推送')"
          >
            快速测试 - MQTT
          </el-button>
          
          <el-button 
            type="info" 
            @click="stopFlash"
          >
            停止闪烁
          </el-button>
        </el-space>
        
        <!-- 使用说明 -->
        <el-divider />
        
        <div class="usage-guide">
          <h4>📝 使用步骤：</h4>
          <ol>
            <li>填写通知内容（或点击快速测试按钮）</li>
            <li>点击"发送通知"，托盘图标开始闪烁</li>
            <li>将鼠标移到托盘图标上（不要点击）</li>
            <li>会弹出通知浮窗，可以点击"确定"或"取消"</li>
          </ol>
          
          <h4 style="margin-top: 15px;">💡 提示：</h4>
          <ul>
            <li>浮窗会在 5 秒后自动关闭</li>
            <li>点击托盘图标可以显示/隐藏主窗口</li>
            <li>点击"确定"按钮会打开主窗口</li>
            <li>失去焦点时浮窗会自动关闭</li>
          </ul>
        </div>
        
        <!-- 确认日志 -->
        <el-divider v-if="confirmLogs.length > 0" />
        
        <div v-if="confirmLogs.length > 0" class="confirm-logs">
          <h4>📋 用户操作记录：</h4>
          <el-timeline>
            <el-timeline-item 
              v-for="(log, index) in confirmLogs" 
              :key="index"
              :timestamp="log.time"
            >
              <el-tag :type="log.action === 'confirm' ? 'success' : 'info'">
                {{ log.action === 'confirm' ? '✅ 确定' : 'ℹ️ 取消' }}
              </el-tag>
              <span style="margin-left: 10px;">{{ log.title }} - {{ log.content }}</span>
            </el-timeline-item>
          </el-timeline>
          
          <el-button 
            size="small" 
            type="danger" 
            text 
            @click="confirmLogs = []"
            style="margin-top: 10px;"
          >
            清空日志
          </el-button>
        </div>
        
      </el-space>
    </el-card>
  </div>
</template>

<script setup name="TrayNotificationTest">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { Bell } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

// 检查是否在 Electron 环境
const electronAvailable = ref(false);

// 通知数据
const notificationData = reactive({
  title: '新消息通知',
  content: '您有一条新的待办任务需要处理，请及时查看',
  type: 'todo'
});

// 确认日志
const confirmLogs = ref([]);

// 检查 Electron API
onMounted(() => {
  electronAvailable.value = !!window.electronAPI;
  
  if (electronAvailable.value) {
    console.log('✅ Electron API 已加载');
    console.log('可用方法:', Object.keys(window.electronAPI));
    
    // 监听用户确认
    window.electronAPI.onNotificationConfirmed((data) => {
      console.log('🎯 用户点击了确定:', data);
      
      // 记录日志
      confirmLogs.value.unshift({
        action: 'confirm',
        title: data.title || '未知',
        content: data.content || '无内容',
        time: new Date().toLocaleTimeString('zh-CN')
      });
      
      // 提示消息
      ElMessage.success({
        message: `用户确认了通知：${data.title}`,
        duration: 3000
      });
    });
  } else {
    console.warn('❌ 非 Electron 环境，托盘通知功能不可用');
  }
});

// 发送通知
const sendNotification = () => {
  if (!electronAvailable.value) {
    ElMessage.warning('托盘通知功能仅在 Electron 环境下可用');
    return;
  }
  
  const data = {
    title: notificationData.title,
    content: notificationData.content,
    time: new Date().toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    type: notificationData.type,
    timestamp: Date.now()
  };
  
  window.electronAPI.sendNotification(data);
  
  ElMessage.success({
    message: '通知已发送，托盘图标开始闪烁',
    duration: 2000
  });
  
  console.log('📤 发送通知:', data);
};

// 快速发送测试通知
const sendQuickNotification = (type) => {
  const templates = {
    '待办任务': {
      title: '新待办任务',
      content: '您被分配了一个新的待办任务：完成月度报告',
      type: 'todo'
    },
    'MQTT推送': {
      title: 'MQTT消息推送',
      content: '设备状态更新：温度传感器数据异常，请及时处理',
      type: 'mqtt'
    },
    '审批流程': {
      title: '审批通知',
      content: '您有一条待审批的请假申请，申请人：张三',
      type: 'approval'
    }
  };
  
  const template = templates[type];
  if (template) {
    const data = {
      ...template,
      time: new Date().toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      timestamp: Date.now()
    };
    
    window.electronAPI.sendNotification(data);
    
    ElMessage.success({
      message: `已发送 ${type} 测试通知`,
      duration: 2000
    });
  }
};

// 停止闪烁
const stopFlash = () => {
  if (electronAvailable.value) {
    window.electronAPI.stopTrayFlash();
    ElMessage.info('托盘闪烁已停止');
  }
};
</script>

<style scoped lang="scss">
.tray-notification-test {
  padding: 20px;
  
  .usage-guide {
    background: #f5f7fa;
    padding: 15px;
    border-radius: 4px;
    
    h4 {
      color: #409eff;
      margin-bottom: 10px;
    }
    
    ol, ul {
      padding-left: 20px;
      
      li {
        margin: 8px 0;
        line-height: 1.6;
        color: #606266;
      }
    }
  }
  
  .confirm-logs {
    h4 {
      color: #67c23a;
      margin-bottom: 15px;
    }
  }
}
</style>

