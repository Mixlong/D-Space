import request from '@/utils/request'

// ==================== 消息管理 ====================

// 发送消息
export function sendMessage(data) {
  return request({
    url: '/chat/message/send',
    method: 'post',
    data,
    headers: { repeatSubmit: false }
  })
}

// 获取历史消息
export function getHistoryMessages(sessionId, params) {
  return request({
    url: `/chat/message/history/${sessionId}`,
    method: 'get',
    params
  })
}

// 标记消息已读
export function markMessageRead(messageId) {
  return request({
    url: '/chat/message/read',
    method: 'put',
    params: { messageId }
  })
}

// 撤回消息
export function recallMessage(messageId) {
  return request({
    url: `/chat/message/recall/${messageId}`,
    method: 'put'
  })
}

// ==================== 会话管理 ====================

// 获取会话列表
export function getSessionList(params) {
  return request({
    url: '/chat/session/list',
    method: 'get',
    params
  })
}

// 标记会话所有消息已读
export function markSessionRead(sessionId) {
  return request({
    url: '/chat/session/read',
    method: 'put',
    params: { sessionId },
    headers: { repeatSubmit: false }
  })
}

// 置顶会话
export function topSession(sessionId, topStatus) {
  return request({
    url: `/chat/session/top/${sessionId}`,
    method: 'put',
    params: { topStatus }
  })
}

// 删除会话
export function deleteSession(sessionId) {
  return request({
    url: `/chat/session/delete/${sessionId}`,
    method: 'delete'
  })
}
