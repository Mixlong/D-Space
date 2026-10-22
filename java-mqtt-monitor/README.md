# Java MQTT 状态监听服务

## 快速开始

### 1. 修改配置
编辑 `application.yml`：
- 修改数据库连接
- 修改 MQTT Broker 地址和账号

### 2. 创建数据库表
执行 `init.sql`

### 3. 启动服务
```bash
mvn spring-boot:run
```

### 4. 验证
查看日志，应该看到：
```
[MQTT] ✅ 已订阅: /as/mqtt/status/
```

## 消息格式

订阅主题：`/as/mqtt/status/`

接收消息：
```json
{
  "clientId": "mqtt_client_xxx",
  "cpuId": "username_userId",
  "userId": "123",
  "userName": "张三",
  "status": 0,
  "timestamp": 1699337600000,
  "reason": "normal_login"
}
```

## 扩展

在 `handleMessage()` 方法中添加你的业务逻辑：
- 保存到数据库
- 更新用户在线状态
- 发送通知
- 记录日志
