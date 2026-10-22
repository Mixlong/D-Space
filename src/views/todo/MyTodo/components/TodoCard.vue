<template>
  <div class="todo-card">
    <!-- 卡片头部 -->
    <div class="card-header">
      <h3 class="card-title">{{ item.title }}</h3>
      <div class="card-countdown">
        <span class="countdown-label">倒计时:</span>
        <div :class="['countdown-box', getCountdownClass(item.countdown)]">
          <span class="countdown-value">{{ item.countdown.days }}</span>
          <span class="countdown-unit">天</span>
          <span class="countdown-value">{{ item.countdown.hours }}</span>
          <span class="countdown-separator">:</span>
          <span class="countdown-value">{{ item.countdown.minutes }}</span>
        </div>
      </div>
    </div>

    <!-- 卡片内容 -->
    <div class="card-content">
      <p class="card-description">{{ item.description }}</p>
      <div class="card-thumbnail">
        <img :src="item.thumbnail" alt="缩略图" />
      </div>
    </div>

    <!-- 卡片底部 -->
    <div class="card-footer">
      <div class="card-time">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 0C3.13401 0 0 3.13401 0 7C0 10.866 3.13401 14 7 14C10.866 14 14 10.866 14 7C14 3.13401 10.866 0 7 0ZM7 12.7273C3.83766 12.7273 1.27273 10.1623 1.27273 7C1.27273 3.83766 3.83766 1.27273 7 1.27273C10.1623 1.27273 12.7273 3.83766 12.7273 7C12.7273 10.1623 10.1623 12.7273 7 12.7273Z" fill="#8C8C8C"/>
          <path d="M7.31818 3.18182H6.36364V7.63636L10.1818 9.87727L10.6591 9.07955L7.31818 7.15909V3.18182Z" fill="#8C8C8C"/>
        </svg>
        <span>{{ item.createTime }}</span>
      </div>
      <div class="card-actions">
        <el-button 
          v-for="action in item.actions" 
          :key="action.type"
          :type="action.buttonType"
          :class="['action-btn', action.type, { disabled: action.disabled }]"
          :disabled="action.disabled"
          size="small"
          @click="$emit('action', action.type, item)"
        >
          {{ action.label }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  item: {
    type: Object,
    required: true
  }
})

defineEmits(['action'])

// 获取倒计时的样式类
const getCountdownClass = (countdown) => {
  if (countdown.status === 'normal') return 'normal'
  if (countdown.status === 'warning') return 'warning'
  if (countdown.status === 'danger') return 'danger'
  if (countdown.status === 'completed') return 'completed'
  return ''
}
</script>

<style lang="scss" scoped>
.todo-card {
  background: linear-gradient(90deg, #ffffff 0%, #ffffff 100%), 
              linear-gradient(#f1f6fe 0%, #fcfdfd 100%);
  border-radius: 8px;
  padding: 13px 18px;
  height: 194px;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s, box-shadow 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  
  .card-title {
    font-weight: 500;
    font-size: 15px;
    color: #394047;
    margin: 0;
  }
  
  .card-countdown {
    display: flex;
    align-items: center;
    gap: 2px;
    
    .countdown-label {
      font-size: 12px;
      color: #394047;
      margin-right: 4px;
    }
    
    .countdown-box {
      display: flex;
      align-items: center;
      gap: 2px;
      
      .countdown-value {
        background: #e5f8e7;
        color: #00bc16;
        font-size: 14px;
        width: 19px;
        height: 19px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 1px;
      }
      
      .countdown-unit,
      .countdown-separator {
        font-size: 12px;
        color: #00bc16;
      }
      
      &.warning {
        .countdown-value {
          background: rgba(241, 185, 0, 0.15);
          color: #f1b900;
        }
        
        .countdown-unit,
        .countdown-separator {
          color: #f1b900;
        }
      }
      
      &.danger {
        .countdown-value {
          background: rgba(255, 89, 89, 0.15);
          color: #ff5959;
        }
        
        .countdown-unit,
        .countdown-separator {
          color: #ff5959;
        }
      }
      
      &.completed {
        .countdown-value {
          background: #e5f8e7;
          color: #00bc16;
        }
        
        .countdown-unit,
        .countdown-separator {
          color: #00bc16;
        }
      }
    }
  }
}

.card-content {
  display: flex;
  gap: 13px;
  margin-bottom: 14px;
  flex: 1;
  
  .card-description {
    flex: 1;
    font-size: 12px;
    color: #394047;
    line-height: 1.5;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }
  
  .card-thumbnail {
    width: 82px;
    height: 64px;
    border-radius: 4px;
    border: 1px solid #ebebeb;
    overflow: hidden;
    flex-shrink: 0;
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .card-time {
    display: flex;
    align-items: center;
    gap: 2px;
    
    span {
      font-size: 15px;
      color: #8c8c8c;
    }
  }
  
  .card-actions {
    display: flex;
    gap: 6px;
    
    .action-btn {
      padding: 4px 10px;
      border-radius: 28px;
      font-size: 13px;
      min-width: 60px;
      height: auto;
      border-width: 1px;
      
      &.complete {
        color: #00bc16;
        border-color: #00bc16;
        background: transparent;
        
        &:hover {
          background: rgba(0, 188, 22, 0.1);
        }
      }
      
      &.delay {
        color: #f2b900;
        border-color: #f2b900;
        background: transparent;
        
        &:hover {
          background: rgba(242, 185, 0, 0.1);
        }
      }
      
      &.delayedLabel {
        color: #f2b900;
        border-color: #f2b900;
        background: transparent;
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      &.assign {
        color: #2e74ff;
        border-color: #2e74ff;
        background: transparent;
        
        &:hover {
          background: rgba(46, 116, 255, 0.1);
        }
      }
      
      &.assignedLabel {
        color: #2e74ff;
        border-color: #2e74ff;
        background: transparent;
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      &.handle,
      &.accept {
        color: #ffffff;
        border-color: #2e74ff;
        background: #2e74ff;
        
        &:hover {
          background: #5a8fff;
          border-color: #5a8fff;
        }
      }
      
      &.reject {
        color: #ff5959;
        border-color: #ff5959;
        background: transparent;
        
        &:hover {
          background: rgba(255, 89, 89, 0.1);
        }
      }
      
      &.completed {
        color: #9f9f9f;
        border: none;
        background: #f2f3f5;
        cursor: not-allowed;
        
        &:hover {
          background: #f2f3f5;
        }
      }
      
      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
}

// Element Plus 按钮样式覆盖
:deep(.el-button) {
  &.is-disabled {
    opacity: 0.5;
  }
}
</style>

