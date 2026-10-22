# 更新通知功能说明

## 功能概述

应用更新重启后，自动弹出更新说明弹窗，向用户展示最新的更新内容。

## 实现原理

1. **版本检测**
   - 应用启动时，从环境变量读取当前版本号（`VITE_APP_VERSION`）
   - 与 localStorage 中保存的上次版本号对比
   - 如果版本号不同，说明应用已更新

2. **更新通知获取**
   - 调用后端API：`/system/notice/list?pageNum=1&pageSize=50&noticeType=1&status=0`
   - `noticeType=1` 表示更新通知类型
   - `status=0` 表示正常状态的通知

3. **弹窗显示**
   - 使用 Element Plus Dialog 组件展示通知
   - 支持HTML内容渲染（`v-html`）
   - 支持多条通知切换浏览
   - 只在用户登录后显示

## 文件结构

```
src/
├── components/
│   └── UpdateNoticeDialog/
│       └── index.vue          # 更新通知弹窗组件
├── App.vue                    # 引入组件
├── api/system/notice.js       # API接口（已存在）
.env.development               # 开发环境配置（添加版本号）
.env.production                # 生产环境配置（添加版本号）
```

## 配置说明

### 1. 环境变量配置

在 `.env.development` 和 `.env.production` 中配置版本号：

```bash
# 应用版本号（与package.json中的version保持一致）
VITE_APP_VERSION = '1.0.11'
```

**重要：** 每次发布新版本时，需要同步更新：
- `package.json` 中的 `version` 字段
- `.env.development` 和 `.env.production` 中的 `VITE_APP_VERSION`

### 2. API数据格式

后端返回的通知数据格式：

```json
{
  "code": 200,
  "msg": "查询成功",
  "total": 2,
  "rows": [
    {
      "noticeId": 1,
      "noticeTitle": "1.0.12",
      "noticeType": "1",
      "noticeContent": "<p>1.迪大圣修改哦内容</p>",
      "status": "0",
      "createTime": 1762991093000
    }
  ]
}
```

### 3. 后台配置

在系统管理 -> 通知公告中创建更新通知：
- **公告类型**：选择 "1"（更新通知）
- **公告标题**：建议使用版本号，如 "1.0.12"
- **公告内容**：支持HTML格式，可以使用富文本编辑器编写
- **状态**：选择 "正常"（0）

## 使用流程

### 开发测试

1. 修改 `.env.development` 中的版本号
2. 重启开发服务器
3. 登录系统
4. 如果版本号与上次不同，会自动弹出更新通知

### 生产发布

1. 更新版本号：
   ```bash
   # 同步更新 package.json 和 .env.production
   npm version patch  # 小版本更新：1.0.11 -> 1.0.12
   # 或
   npm version minor  # 中版本更新：1.0.11 -> 1.1.0
   # 或
   npm version major  # 大版本更新：1.0.11 -> 2.0.0
   ```

2. 在后台创建对应版本的更新通知

3. 构建并发布应用
   ```bash
   npm run build:prod
   npm run electron:build
   ```

4. 用户下载安装新版本后，首次登录时会自动弹出更新说明

## 功能特性

### 1. 智能检测
- ✅ 只在版本更新后弹出一次
- ✅ 使用 localStorage 记录已查看的版本
- ✅ 防止重复弹窗

### 2. 用户友好
- ✅ 支持HTML格式的更新内容（支持图片、链接、格式化文本）
- ✅ 支持多条更新说明切换浏览
- ✅ 显示更新时间和当前查看进度
- ✅ 最后一条通知才显示关闭按钮

### 3. 安全性
- ✅ 只在用户登录后检查和显示
- ✅ 需要有效的 token 才能调用API
- ✅ 防止未授权访问

## 常见问题

### Q1: 为什么没有弹出更新通知？

**检查项：**
1. 确认用户已登录
2. 确认版本号已更新（`.env` 文件）
3. 确认后台有对应的更新通知记录
4. 打开浏览器控制台，查看 `[更新通知]` 开头的日志

### Q2: 如何测试更新通知功能？

**方法1：修改版本号**
```bash
# 修改 .env.development 中的 VITE_APP_VERSION
VITE_APP_VERSION = '1.0.12'

# 清除 localStorage 中的版本记录
localStorage.removeItem('app_last_version')

# 刷新页面
```

**方法2：手动调用**
```javascript
// 在浏览器控制台执行
localStorage.setItem('app_last_version', '1.0.10')
location.reload()
```

### Q3: 如何自定义弹窗样式？

修改 `src/components/UpdateNoticeDialog/index.vue` 中的样式：

```scss
.update-notice-content {
  .notice-body {
    // 修改背景色、字体大小等
    background-color: #f5f7fa;
    font-size: 14px;
  }
}
```

### Q4: 如何过滤特定版本的通知？

修改 `fetchUpdateNotices` 方法中的过滤逻辑：

```javascript
notices.value = response.rows.filter(notice => {
  // 根据 noticeTitle 判断版本号
  const noticeVersion = notice.noticeTitle
  return compareVersion(noticeVersion, currentVersion) <= 0
})
```

## 技术栈

- Vue 3 Composition API
- Element Plus
- Pinia Store
- Vite
- Electron

## 后续优化建议

1. **版本号自动同步**
   - 从 `package.json` 自动读取版本号，避免手动维护

2. **更新内容缓存**
   - 将已查看的更新记录保存，支持用户重新查看历史更新

3. **通知分类**
   - 支持不同类型的通知（重要更新、普通更新、修复说明）

4. **图片预览**
   - 支持更新说明中的图片放大预览

5. **国际化**
   - 支持多语言更新说明

## 维护说明

每次发布新版本时的检查清单：

- [ ] 更新 `package.json` 中的 `version`
- [ ] 更新 `.env.development` 中的 `VITE_APP_VERSION`
- [ ] 更新 `.env.production` 中的 `VITE_APP_VERSION`
- [ ] 在后台创建对应版本的更新通知
- [ ] 测试更新通知是否正常显示
- [ ] 构建并发布新版本

---

**最后更新：** 2025-01-13  
**版本：** 1.0.0  
**作者：** DigiSmart Team
