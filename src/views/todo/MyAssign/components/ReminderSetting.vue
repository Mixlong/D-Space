<template>
  <div class="reminder-setting">
    <!-- 闹钟列表 -->
    <div class="reminder-list">
      <div 
        v-for="(reminder, index) in reminderList" 
        :key="index"
        class="reminder-item"
      >
        <div class="reminder-header">
          <div class="reminder-header-left">
            <span class="reminder-title">闹钟 {{ index + 1 }}</span>
            <el-switch
              v-model="reminder.enabled"
              :active-value="1"
              :inactive-value="0"
              active-text="启用"
              inactive-text="禁用"
              inline-prompt
              size="small"
              @change="emitChange"
            />
          </div>
          <el-button 
            type="danger" 
            link
            size="small"
            @click="removeReminder(index)"
          >
            删除
          </el-button>
        </div>

        <div class="reminder-form">
          <!-- 闹钟名称 -->
          <el-input
            v-model="reminder.reminderName"
            placeholder="请输入名称（如：周例会提醒）"
            class="form-item"
            maxlength="50"
            show-word-limit
            clearable
            @input="emitChange"
          />

          <!-- 提醒类型 -->
          <el-radio-group
            v-model="reminder.reminderType"
            class="reminder-type-group"
            @change="handleTypeChange(reminder)"
          >
            <el-radio :value="1" border>周期性提醒</el-radio>
            <el-radio :value="2" border>一次性提醒</el-radio>
          </el-radio-group>

          <!-- 提醒时间 -->
          <div class="time-input-wrapper">
            <label class="time-label">提醒时间</label>
            
            <!-- 快捷时间选择 -->
            <div class="quick-time-buttons">
              <el-button 
                v-for="time in quickTimes" 
                :key="time.value"
                :type="isTimeSelected(reminder, time) ? 'primary' : ''"
                size="small"
                class="quick-time-btn"
                @click="setQuickTime(reminder, time)"
              >
                {{ time.label }}
              </el-button>
            </div>
            
            <!-- 自定义时间输入 -->
            <div class="time-inputs">
              <el-input-number
                v-model="reminder.hour"
                :min="0"
                :max="23"
                controls-position="right"
                placeholder="时"
                class="time-number-input"
                @change="handleTimeChange(reminder)"
              />
              <span class="time-separator">:</span>
              <el-input-number
                v-model="reminder.minute"
                :min="0"
                :max="59"
                controls-position="right"
                placeholder="分"
                class="time-number-input"
                @change="handleTimeChange(reminder)"
              />
            </div>
          </div>

          <!-- 周期性：选择星期几 -->
          <div v-if="reminder.reminderType === 1" class="weekdays-wrapper">
            <div class="weekdays-header">
              <label class="weekdays-label">重复日期</label>
              <div class="weekday-shortcuts">
                <el-button 
                  size="small" 
                  text
                  class="weekday-shortcut-btn"
                  @click="setWeekdayShortcut(reminder, 'workday')"
                >
                  工作日
                </el-button>
                <el-button 
                  size="small" 
                  text
                  class="weekday-shortcut-btn"
                  @click="setWeekdayShortcut(reminder, 'weekend')"
                >
                  周末
                </el-button>
                <el-button 
                  size="small" 
                  text
                  class="weekday-shortcut-btn"
                  @click="setWeekdayShortcut(reminder, 'everyday')"
                >
                  每天
                </el-button>
              </div>
            </div>
            
            <!-- 星期按钮组 -->
            <div class="weekday-buttons">
              <el-button
                v-for="day in weekdays"
                :key="day.value"
                :type="reminder.reminderWeekdaysArray.includes(day.value) ? 'primary' : ''"
                size="small"
                class="weekday-btn-el"
                @click="toggleWeekday(reminder, day.value)"
              >
                {{ day.label }}
              </el-button>
            </div>
          </div>

          <!-- 一次性：选择日期 -->
          <el-date-picker
            v-if="reminder.reminderType === 2"
            v-model="reminder.reminderOnceDate"
            type="date"
            placement='top'
            placeholder="选择提醒日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            class="form-item"
            :disabled-date="disabledDate"
            @change="emitChange"
             style="width:100%"
          />
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="reminderList.length === 0" class="empty-state">
        <span class="empty-text">暂无闹钟提醒</span>
      </div>
    </div>

    <!-- 添加闹钟按钮 -->
    <el-button 
      type="primary" 
      plain 
      size="default"
      class="add-btn"
      @click="addReminder"
    >
      <el-icon><Plus /></el-icon>
      <span>添加闹钟</span>
    </el-button>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Plus } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

// 闹钟列表
const reminderList = ref([])

// 快捷时间选项
const quickTimes = [
  { label: '9:00', value: '09:00', hour: 9, minute: 0 },
  { label: '12:00', value: '12:00', hour: 12, minute: 0 },
  { label: '14:00', value: '14:00', hour: 14, minute: 0 },
  { label: '18:00', value: '18:00', hour: 18, minute: 0 },
  { label: '20:00', value: '20:00', hour: 20, minute: 0 }
]

// 星期选项
const weekdays = [
  { label: '一', value: '1' },
  { label: '二', value: '2' },
  { label: '三', value: '3' },
  { label: '四', value: '4' },
  { label: '五', value: '5' },
  { label: '六', value: '6' },
  { label: '日', value: '7' }
]

// 初始化数据
watch(() => props.modelValue, (val) => {
  console.log('[ReminderSetting] 接收到 modelValue:', val)
  if (val && val.length > 0) {
    reminderList.value = val.map(r => {
      // 将 reminderWeekdays 字符串转为数组
      const reminderWeekdaysArray = r.reminderWeekdays ? r.reminderWeekdays.split(',') : []
      
      // 将 reminderTime 拆分为 hour 和 minute
      let hour = 9
      let minute = 0
      if (r.reminderTime) {
        const [h, m] = r.reminderTime.split(':')
        hour = parseInt(h) || 9
        minute = parseInt(m) || 0
      }
      
      return {
        ...r,
        reminderWeekdaysArray,
        hour,
        minute
      }
    })
    console.log('[ReminderSetting] 转换后的 reminderList:', reminderList.value)
  } else {
    reminderList.value = []
    console.log('[ReminderSetting] reminderList 为空')
  }
}, { immediate: true })

// 添加闹钟
const addReminder = () => {
  reminderList.value.push({
    reminderName: '',
    reminderType: 1,  // 默认周期性
    hour: 9,          // 默认9点
    minute: 0,        // 默认0分
    reminderTime: '09:00',
    reminderWeekdaysArray: [],
    reminderWeekdays: '',
    reminderOnceDate: '',
    enabled: 1  // 默认启用
  })
  emitChange()
}

// 删除闹钟
const removeReminder = (index) => {
  reminderList.value.splice(index, 1)
  emitChange()
}

// 提醒类型变化
const handleTypeChange = (reminder) => {
  if (reminder.reminderType === 1) {
    // 切换到周期性，清空一次性日期
    reminder.reminderOnceDate = ''
  } else {
    // 切换到一次性，清空星期几
    reminder.reminderWeekdaysArray = []
    reminder.reminderWeekdays = ''
  }
  emitChange()
}

// 快捷时间选择
const setQuickTime = (reminder, time) => {
  reminder.hour = time.hour
  reminder.minute = time.minute
  handleTimeChange(reminder)
}

// 判断是否选中快捷时间
const isTimeSelected = (reminder, time) => {
  return reminder.hour === time.hour && reminder.minute === time.minute
}

// 时间变化处理
const handleTimeChange = (reminder) => {
  // 合并 hour 和 minute 为 reminderTime
  const h = String(reminder.hour || 0).padStart(2, '0')
  const m = String(reminder.minute || 0).padStart(2, '0')
  reminder.reminderTime = `${h}:${m}`
  emitChange()
}

// 切换星期选择
const toggleWeekday = (reminder, dayValue) => {
  const index = reminder.reminderWeekdaysArray.indexOf(dayValue)
  if (index > -1) {
    reminder.reminderWeekdaysArray.splice(index, 1)
  } else {
    reminder.reminderWeekdaysArray.push(dayValue)
  }
  emitChange()
}

// 星期快捷选择
const setWeekdayShortcut = (reminder, type) => {
  switch (type) {
    case 'workday':
      reminder.reminderWeekdaysArray = ['1', '2', '3', '4', '5']
      break
    case 'weekend':
      reminder.reminderWeekdaysArray = ['6', '7']
      break
    case 'everyday':
      reminder.reminderWeekdaysArray = ['1', '2', '3', '4', '5', '6', '7']
      break
  }
  emitChange()
}

// 禁用今天之前的日期
const disabledDate = (time) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return time.getTime() < today.getTime()
}

// 发送变更
const emitChange = () => {
  // 转换数据格式供父组件使用
  const formatted = reminderList.value.map(r => {
    // 确保 reminderTime 格式正确
    const h = String(r.hour || 0).padStart(2, '0')
    const m = String(r.minute || 0).padStart(2, '0')
    
    return {
      id: r.id, // 编辑模式下保留 id
      reminderName: r.reminderName,
      reminderType: r.reminderType,
      reminderTime: `${h}:${m}`,
      reminderWeekdays: r.reminderType === 1 ? r.reminderWeekdaysArray.join(',') : '',
      reminderOnceDate: r.reminderType === 2 ? r.reminderOnceDate : '',
      enabled: r.enabled !== undefined ? r.enabled : 1  // 默认启用
    }
  })
  emit('update:modelValue', formatted)
}

// 监听数组内部变化（使用 v-model 的输入事件触发）
// 移除 deep watch 以避免递归更新
// 改为在模板中使用 @change/@input 事件手动触发
</script>

<style lang="scss" scoped>
.reminder-setting {
  width: 100%;
}
 
.weekday-buttons :deep(.el-button + .el-button),
.quick-time-buttons :deep(.el-button + .el-button) {
  margin-left: 0;
}
.reminder-list {
  margin-bottom: 12px;
  
  // 美化滚动条
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #dcdfe6;
    border-radius: 3px;
    
    &:hover {
      background: #c0c4cc;
    }
  }
}

.reminder-item {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  transition: all 0.3s;

  &:hover {
    border-color: #c0c4cc;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.reminder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f2f5;
}

.reminder-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.reminder-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.reminder-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-item {
  width: 100%;
  
  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px #dcdfe6 inset;
  }
  
  :deep(.el-input__wrapper:hover) {
    box-shadow: 0 0 0 1px #c0c4cc inset;
  }
  
  :deep(.el-input__wrapper.is-focus) {
    box-shadow: 0 0 0 1px #409eff inset;
  }
}

.form-item-half {
  flex: 1;
  
  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px #dcdfe6 inset;
  }
  
  :deep(.el-input__wrapper:hover) {
    box-shadow: 0 0 0 1px #c0c4cc inset;
  }
  
  :deep(.el-input__wrapper.is-focus) {
    box-shadow: 0 0 0 1px #409eff inset;
  }
}

// 提醒类型单选组
.reminder-type-group {
  width: 100%;
  display: flex;
  gap: 12px;
  
  :deep(.el-radio) {
    flex: 1;
    margin-right: 0;
  }
  
  :deep(.el-radio.is-bordered) {
    padding: 10px 16px;
    border-radius: 6px;
  }
  
  :deep(.el-radio.is-bordered .el-radio__label) {
    font-size: 14px;
  }
}

// 时间输入包装器
.time-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.time-label {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

// 快捷时间按钮
.quick-time-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.quick-time-btn {
  min-width: 56px;
  padding: 4px 10px !important;
  height: 28px !important;
  line-height: 20px !important;
  font-size: 13px !important;
}

.time-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-number-input {
  flex: 1;
  
  :deep(.el-input__wrapper) {
    padding: 0 8px;
  }
  
  :deep(.el-input-number__decrease),
  :deep(.el-input-number__increase) {
    width: 28px;
    font-size: 12px;
  }
}

.time-separator {
  font-size: 20px;
  font-weight: 600;
  color: #606266;
  padding: 0 4px;
}

// 星期几包装器
.weekdays-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.weekdays-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.weekdays-label {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.weekday-shortcuts {
  display: flex;
  gap: 4px;
}

.weekday-shortcut-btn {
  font-size: 12px;
  padding: 4px 8px;
  height: 24px;
  color: var(--el-color-primary);
  
  :deep(.el-button__text) {
    font-size: 12px;
  }
  
  &:hover {
    background: var(--el-color-primary-light-9);
  }
}

// 星期按钮组
.weekday-buttons {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 15px;
}

.weekday-btn-el {
  flex: 1;
  min-width: 0;
  padding: 4px 8px !important;
  height: 28px !important;
  line-height: 20px !important;
  font-size: 13px !important;
}

.empty-state {
  text-align: center;
  padding: 32px 0;
  color: #909399;
  font-size: 14px;
  
  .empty-text {
    color: #a8abb2;
  }
}

.add-btn {
  width: 100%;
  height: 36px;
  border-radius: 6px;
  font-size: 14px;
  
  :deep(.el-icon) {
    margin-right: 4px;
  }
}
</style>
