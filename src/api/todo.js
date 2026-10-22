import request from '@/utils/request'

// ==================== 待办管理 ====================

// 分页查询待办列表
export function getTodoList(params) {
  return request({
    url: '/todo/todo/list',
    method: 'get',
    params
  })
}

// 管理后台分页查询待办列表
export function getAdminTodoList(params) {
  return request({
    url: '/todo/todo/admin/list',
    method: 'get',
    params
  })
}

// 获取待办详情
export function getTodoDetail(id) {
  return request({
    url: `/todo/todo/info/${id}`,
    method: 'get'
  })
}

// 修改待办
export function updateTodo(data) {
  return request({
    url: '/todo/todo/update',
    method: 'put',
    data
  })
}

// 统计待办各状态数量
export function getTodoStatusCount(params) {
  return request({
    url: '/todo/todo/statusCount',
    method: 'get',
    params
  })
}

// 批量删除待办
export function batchDeleteTodo(ids, nickName) {
  return request({
    url: '/todo/todo/batchDelete',
    method: 'delete',
    params: { nickName },
    data: ids
  })
}

// 删除交办（撤销交办中的某个用户待办）
export function deleteAssignmentTodo(id, nickName) {
  return request({
    url: `/todo/assignment/delete/${id}`,
    method: 'delete',
    params: { nickName }
  })
}

// ==================== 交办管理 ====================

// 分页查询交办列表
export function getAssignmentList(params) {
  return request({
    url: '/todo/assignment/list',
    method: 'get',
    params
  })
}

// 管理后台分页查询交办列表
export function getAdminAssignmentList(params) {
  return request({
    url: '/todo/assignment/admin/list',
    method: 'get',
    params
  })
}

// 获取交办详情
export function getAssignmentDetail(id) {
  return request({
    url: `/todo/assignment/info/${id}`,
    method: 'get'
  })
}

// 新增交办
export function addAssignment(data) {
  return request({
    url: '/todo/assignment/add',
    method: 'post',
    data
  })
}

// 修改交办
export function updateAssignment(data) {
  return request({
    url: '/todo/assignment/update',
    method: 'put',
    data
  })
}

// 删除交办
export function deleteAssignment(id) {
  return request({
    url: `/todo/assignment/delete/${id}`,
    method: 'delete'
  })
}

// 统计交办各状态数量
export function getAssignmentStatusCount(params) {
  return request({
    url: '/todo/assignment/statusCount',
    method: 'get',
    params
  })
}

// 获取可分配用户字典
export function getUserDict(assignmentId) {
  return request({
    url: '/todo/assignment/userDict',
    method: 'get',
    params: { assignmentId }
  })
}

// 获取交办进行中总数
export function getAssignmentInProgressCount() {
  return request({
    url: '/todo/assignment/totalInProgressCount',
    method: 'get'
  })
}

// ==================== 延期记录管理 ====================

// 分页查询延期记录列表
export function getExtensionList(params) {
  return request({
    url: '/todo/extension/list',
    method: 'get',
    params
  })
}

// 获取延期记录详情
export function getExtensionDetail(id) {
  return request({
    url: `/todo/extension/info/${id}`,
    method: 'get'
  })
}

// 新增延期申请
export function addExtension(data) {
  return request({
    url: '/todo/extension/add',
    method: 'post',
    data
  })
}

// 修改延期申请
export function updateExtension(data) {
  return request({
    url: '/todo/extension/update',
    method: 'put',
    data
  })
}

// 处理延期申请
export function processExtension(params) {
  return request({
    url: '/todo/extension/process',
    method: 'post',
    params
  })
}

// ==================== 操作记录管理 ====================

// 分页查询操作记录列表
export function getOperationLogList(params) {
  return request({
    url: '/todo/operationLog/list',
    method: 'get',
    params
  })
}

// 获取操作记录详情
export function getOperationLogDetail(id) {
  return request({
    url: `/todo/operationLog/info/${id}`,
    method: 'get'
  })
}





