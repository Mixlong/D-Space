# 自定义通知卡片使用指南

## 功能特性

✅ **Windows 风格通知** - 从屏幕右下角滑入/滑出
✅ **多种通知类型** - 支持成功、警告、错误、信息四种类型
✅ **自定义按钮** - 可添加任意数量的操作按钮
✅ **通知队列** - 自动管理多个通知的显示顺序
✅ **自动关闭** - 可配置自动关闭时间
✅ **平滑动画** - 滑入/滑出动画效果

## 使用方法

### 1. 基础通知（信息类型）

```javascript
// 在渲染进程中发送通知
window.electronAPI.send('tray-notification', {
  title: '系统消息',
  content: '您有一条新的系统消息',
  type: 'info', // 可选：info, success, warning, error
  duration: 5000, // 自动关闭时间（毫秒），默认 5000
  autoClose: true // 是否自动关闭，默认 true
});
```

### 2. 成功通知

```javascript
window.electronAPI.send('tray-notification', {
  title: '操作成功',
  content: '您的数据已成功保存！',
  type: 'success',
  duration: 3000
});
```

### 3. 警告通知

```javascript
window.electronAPI.send('tray-notification', {
  title: '警告提示',
  content: '您的会话即将过期，请及时保存数据',
  type: 'warning',
  duration: 8000
});
```

### 4. 错误通知

```javascript
window.electronAPI.send('tray-notification', {
  title: '操作失败',
  content: '网络连接失败，请检查您的网络设置',
  type: 'error',
  duration: 10000
});
```

### 5. 带自定义按钮的通知

```javascript
window.electronAPI.send('tray-notification', {
  title: '新任务分配',
  content: '您有一个新的待办任务需要处理',
  type: 'info',
  autoClose: false, // 不自动关闭，等待用户操作
  buttons: [
    {
      text: '稍后处理',
      type: 'secondary',
      action: 'later'
    },
    {
      text: '立即查看',
      type: 'primary',
      action: 'view'
    }
  ]
});
```

### 6. 监听通知按钮点击事件

```javascript
// 在渲染进程中监听通知按钮点击
window.electronAPI.on('notification-action', (payload) => {
  const { action, data } = payload;
  
  console.log('用户点击了按钮:', action);
  console.log('通知数据:', data);
  
  // 根据不同的 action 执行不同的操作
  switch (action) {
    case 'view':
      // 跳转到详情页
      router.push('/task/detail');
      break;
    case 'later':
      // 稍后提醒
      console.log('用户选择稍后处理');
      break;
    default:
      console.log('未知操作:', action);
  }
});
```

## 通知类型说明

| 类型 | 图标 | 颜色 | 适用场景 |
|------|------|------|----------|
| `success` | ✓ | 绿色 | 操作成功、保存成功、提交成功 |
| `warning` | ! | 橙色 | 警告提示、即将过期、需要注意 |
| `error` | ✕ | 红色 | 操作失败、错误提示、异常情况 |
| `info` | i | 蓝色 | 一般信息、系统消息、提醒通知 |

## 按钮配置说明

### 按钮对象属性

```javascript
{
  text: '按钮文字',      // 必填：按钮显示的文字
  type: 'primary',      // 可选：按钮类型，primary（主按钮）或 secondary（次按钮）
  action: 'action-id'   // 可选：按钮的动作标识，用于区分不同按钮的点击
}
```

### 按钮样式

- **primary（主按钮）**: 渐变色背景，用于主要操作
- **secondary（次按钮）**: 白色背景带边框，用于次要操作

## 高级用法示例

### 示例 1: 待办任务提醒

```javascript
window.electronAPI.send('tray-notification', {
  title: '待办提醒',
  content: '您有 3 个待办任务即将到期，请及时处理',
  type: 'warning',
  duration: 10000,
  buttons: [
    { text: '忽略', type: 'secondary', action: 'ignore' },
    { text: '查看任务', type: 'primary', action: 'view-tasks' }
  ]
});
```

### 示例 2: 审批通知

```javascript
window.electronAPI.send('tray-notification', {
  title: '审批请求',
  content: '张三提交了一份采购申请，等待您的审批',
  type: 'info',
  autoClose: false,
  buttons: [
    { text: '拒绝', type: 'secondary', action: 'reject' },
    { text: '通过', type: 'primary', action: 'approve' }
  ]
});
```

### 示例 3: 系统更新通知

```javascript
window.electronAPI.send('tray-notification', {
  title: '系统更新',
  content: '发现新版本 v2.0.0，建议立即更新以获得更好的体验',
  type: 'success',
  autoClose: false,
  buttons: [
    { text: '稍后提醒', type: 'secondary', action: 'remind-later' },
    { text: '立即更新', type: 'primary', action: 'update-now' }
  ]
});
```

## 通知队列

当多个通知同时触发时，系统会自动将它们加入队列，依次显示：

```javascript
// 连续发送多个通知
window.electronAPI.send('tray-notification', {
  title: '消息1',
  content: '第一条消息',
  type: 'info'
});

window.electronAPI.send('tray-notification', {
  title: '消息2',
  content: '第二条消息',
  type: 'success'
});

window.electronAPI.send('tray-notification', {
  title: '消息3',
  content: '第三条消息',
  type: 'warning'
});

// 这三个通知会依次显示，每个显示完成后自动显示下一个
```

## 注意事项

1. **自动关闭时间**: 默认 5 秒，可通过 `duration` 参数自定义
2. **按钮数量**: 建议不超过 3 个按钮，以保持界面简洁
3. **内容长度**: 内容过长会自动出现滚动条，建议控制在 100 字以内
4. **通知队列**: 系统会自动管理队列，无需手动控制
5. **关闭按钮**: 所有通知都有右上角的关闭按钮（×）

## 与系统通知的对比

| 特性 | 自定义通知 | 系统通知 |
|------|-----------|----------|
| 样式自定义 | ✅ 完全自定义 | ❌ 受系统限制 |
| 交互按钮 | ✅ 支持多个自定义按钮 | ⚠️ 有限支持 |
| 动画效果 | ✅ 平滑滑入/滑出 | ⚠️ 系统默认 |
| 位置控制 | ✅ 精确控制 | ❌ 系统决定 |
| 显示时长 | ✅ 完全控制 | ⚠️ 受系统限制 |
| 队列管理 | ✅ 自动管理 | ⚠️ 系统管理 |
| 实现复杂度 | ⚠️ 较复杂 | ✅ 简单 |

## 最佳实践

1. **选择合适的类型**: 根据消息的重要性和性质选择合适的通知类型
2. **控制通知频率**: 避免频繁弹出通知，影响用户体验
3. **提供明确的操作**: 按钮文字要清晰明确，让用户知道点击后会发生什么
4. **合理设置时长**: 重要消息可以设置较长的显示时间或禁用自动关闭
5. **处理用户操作**: 确保监听并正确处理用户的按钮点击事件
