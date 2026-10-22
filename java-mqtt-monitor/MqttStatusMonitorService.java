package com.yourproject.service;

import com.alibaba.fastjson2.JSON;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;

@Slf4j
@Service
public class MqttStatusMonitorService {
    
    @Value("${mqtt.broker-url}")
    private String brokerUrl;
    
    @Value("${mqtt.client-id}")
    private String clientId;
    
    @Value("${mqtt.username}")
    private String username;
    
    @Value("${mqtt.password}")
    private String password;
    
    @Value("${mqtt.topics.status}")
    private String statusTopic;
    
    private MqttClient mqttClient;
    
    @PostConstruct
    public void init() {
        try {
            log.info("[MQTT] 开始连接: {}", brokerUrl);
            
            mqttClient = new MqttClient(brokerUrl, clientId, null);
            
            MqttConnectOptions options = new MqttConnectOptions();
            options.setUserName(username);
            options.setPassword(password.toCharArray());
            options.setCleanSession(true);
            options.setKeepAliveInterval(60);
            options.setAutomaticReconnect(true);
            
            mqttClient.setCallback(new MqttCallback() {
                public void connectionLost(Throwable cause) {
                    log.error("[MQTT] 连接丢失", cause);
                }
                
                public void messageArrived(String topic, MqttMessage message) {
                    handleMessage(topic, new String(message.getPayload()));
                }
                
                public void deliveryComplete(IMqttDeliveryToken token) {}
            });
            
            mqttClient.connect(options);
            mqttClient.subscribe(statusTopic, 1);
            
            log.info("[MQTT] ✅ 已订阅: {}", statusTopic);
            
        } catch (Exception e) {
            log.error("[MQTT] 初始化失败", e);
        }
    }
    
    private void handleMessage(String topic, String payload) {
        try {
            log.info("[MQTT] 收到消息: {}", payload);
            
            // 解析JSON
            // Map<String, Object> data = JSON.parseObject(payload, Map.class);
            // String userId = (String) data.get("userId");
            // Integer status = (Integer) data.get("status");
            
            // 保存到数据库
            // userStatusService.saveStatus(data);
            
        } catch (Exception e) {
            log.error("[MQTT] 处理消息失败", e);
        }
    }
    
    @PreDestroy
    public void destroy() {
        try {
            if (mqttClient != null && mqttClient.isConnected()) {
                mqttClient.disconnect();
                mqttClient.close();
                log.info("[MQTT] 连接已关闭");
            }
        } catch (Exception e) {
            log.error("[MQTT] 关闭失败", e);
        }
    }
}
