<template>
  <div class="todo-page">
    <!-- 标签页和创建按钮 -->
    <div class="todo-header">
      <div class="todo-tabs">
        <div 
          v-for="tab in tabs" 
          :key="tab.key"
          :class="['tab-item', { active: currentTab === tab.key }]"
          @click="handleTabChange(tab.key)"
        >
          {{ tab.label }}({{ tab.count }})
        </div>
      </div>
       <div style="display: flex;gap: 20px; justify-content: space-between; align-items: center;">
        <el-button type="primary"  @click="handleCreate">
        <el-icon><Plus /></el-icon>
        创建交办
      </el-button>
      <!-- 视图切换组件 -->
      <ViewSwitcher
        v-model:view-mode="viewMode"
        v-model:cards-per-row="cardsPerRow"
        storage-prefix="myAssign"
        @cards-per-row-change="handleCardsPerRowChange"
      />
       </div>
 
    </div>

    <!-- 任务卡片列表 -->
    <div v-if="viewMode === 'card'" class="todo-list-container">
      <!-- 初始加载时的居中 loading -->
      <div v-if="loading && todoList.length === 0" class="loading-center">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>加载中...</span>
      </div>
      
      <el-scrollbar v-else ref="scrollbarRef" @scroll="handleCardScroll">
        <div class="todo-list">
          <!-- 空数据展示 -->
          <el-empty 
            v-if="!loading && todoList.length === 0" 
            description="暂无交办事项"
            :image-size="200"
          />
          
          <div 
            v-for="item in filteredTodoList" 
            :key="item.id"
            class="todo-card"
          >
        <div class="card-main" @click="handleCardClick(item)">
          <div class="card-header">
            <div class="card-title-wrapper">
              <span class="card-title">{{ item.title }}</span>
              <el-tooltip 
                v-if="item.reminderList && item.reminderList.length > 0"
                :content="`已设置 ${item.reminderList.length} 个闹钟提醒`"
                placement="top"
              >
                <img 
                  src="@/assets/images/icons8-alarm-clock-100.png" 
                  class="reminder-icon" 
                  alt="闹钟" 
                  @click.stop="handleReminderClick(item)"
                />
              </el-tooltip>
            </div>
            <span :class="['countdown', getCountdownClass(item)]">
              {{ getCountdownText(item) }}
            </span>
          </div>
          
          <div class="card-content">
            <!-- 左侧内容描述 -->
            <div class="card-desc-wrapper">
              <p class="card-desc">{{ item.content || '暂无内容描述' }}</p>
              <!-- 底部信息区域 -->
              <div class="card-bottom-info">
                <!-- 截止时间 -->
                <div class="card-time" v-if="item.dueDate">
                  <el-icon><Clock /></el-icon>
                  <span>{{ parseTime(item.dueDate, '{y}-{m}-{d} {h}:{i}')}}</span>
                </div>
                <!-- 接办人列表（独立一行） -->
                <div class="card-assignees" v-if="item.todoList && item.todoList.length > 0">
                  <!-- <span class="assignees-label">接办人：</span> -->
                  <div class="assignees-tags">
                    <el-tag 
                      v-for="todo in item.todoList" 
                      :key="todo.id"
                      :type="getAssigneeTagType(todo.status)"
                      size="small"
                    >
                      {{ todo.assignee }}
                    </el-tag>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 右侧图片预览 -->
            <div class="card-image-wrapper" v-if="item.imgs">
              <img 
                :src="getFirstImage(item.imgs)" 
                class="card-image"
                alt="交办图片"
              />
              <!-- 图片数量角标 -->
              <div class="image-count" v-if="getImageCount(item.imgs) > 1">
                {{ getImageCount(item.imgs) }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div class="card-actions">
          
          <!-- 进行中状态： -->
          <template v-if="item.status === 1 || item.status === 0">
          <div style="display: flex;justify-content: flex-start;align-items:center;flex:1;height: 35px;">
                     <el-button class="action-btn warning-btn" @click.stop="handleRevoke(item)">
              撤销
            </el-button>
            <el-button class="action-btn info-btn" @click.stop="handleAssign(item)">
              交办
            </el-button>
            <el-button class="action-btn primary-outline-btn" @click.stop="handleEdit(item)">
              修改
            </el-button>
            <el-button class="action-btn danger-btn" @click.stop="handleDelete(item)">
              删除
            </el-button>
            </div>
          </template>
          
          <!-- 已完成状态：只显示状态 -->
          <template v-else-if="item.status === 2">
                <div style="display: flex;justify-content: space-between;align-items:center;flex:1;height: 35px;">
                    <el-button class="action-btn completed-btn" disabled>已完成</el-button>
            <el-button class="action-btn danger-btn" @click.stop="handleDelete(item)">
              删除
            </el-button>
            </div>
          </template>
        </div>
      </div>
          
          <!-- 加载更多提示 -->
          <div v-if="loading" class="load-more-tip">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>加载中...</span>
          </div>
          
          <div v-else-if="!hasMore && todoList.length > 0" class="load-more-tip">
            没有更多数据了
          </div>
        </div>
      </el-scrollbar>
    </div>
    
    <!-- 任务表格列表 -->
    <div v-else-if="viewMode === 'table'" class="todo-table-wrapper">
      <el-table
        :data="tableData"
        style="width: 100%; flex: 1;"
        height="100%"
        stripe
        border
        @row-click="handleCardClick"
        v-loading="loading"
      >
        <el-table-column label="交办标题" min-width="150" align="center">
          <template #default="{ row }">
            <div class="table-title-cell">
              <span class="table-title-text">{{ row.title }}</span>
              <el-tooltip 
                v-if="row.reminderList && row.reminderList.length > 0"
                :content="`已设置 ${row.reminderList.length} 个闹钟提醒`"
                placement="top"
              >
                <img 
                  src="@/assets/images/icons8-alarm-clock-100.png" 
                  class="reminder-icon-table" 
                  alt="闹钟" 
                  @click.stop="handleReminderClick(row)"
                />
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="交办内容" min-width="180" align="center" show-overflow-tooltip />
        <el-table-column 
          label="状态" 
          width="80" 
          align="center"
          :filters="[
            { text: '待接收', value: 0 },
            { text: '进行中', value: 1 },
            { text: '已完成', value: 2 }
          ]"
          :filter-method="filterStatus"
          filter-placement="bottom-end"
        >
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ row.statusName }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="剩余时间" width="100" align="center" sortable :sort-method="sortByDeadline">
          <template #default="{ row }">
            <span :class="['countdown-text', getCountdownClass(row)]">
              {{ getCountdownText(row) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="接办人" width="160" header-align="center" align="left">
          <template #default="{ row }">
            <div class="assignee-list">
              <el-tag 
                v-for="todo in row.todoList" 
                :key="todo.id"
                :type="getAssigneeTagType(todo.status)"
                size="small"
                style="margin: 2px;"
              >
                {{ todo.assignee }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column 
          prop="createTime" 
          label="创建时间" 
          width="140" 
          align="center"
          sortable
          :sort-method="sortByCreateTime"
        >
          <template #default="{ row }">
            {{ parseTime(row.createTime, '{y}-{m}-{d} {h}:{i}') }}
          </template>
        </el-table-column>
        <el-table-column 
          prop="finishTime" 
          label="完成时间" 
          width="140" 
          align="center"
          sortable
          :sort-method="sortByFinishTime"
        >
          <template #default="{ row }">
            <span v-if="row.finishTime">{{ parseTime(row.finishTime, '{y}-{m}-{d} {h}:{i}') }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="center" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <!-- 待接收状态：可撤销、交办、修改、删除 -->
              <template v-if="row.status === 0 ||row.status === 1">
                <el-tooltip content="撤销" placement="top" :show-after="300" :hide-after="0" effect="dark" popper-class="compact-tooltip">
                  <el-icon class="action-icon warning" @click.stop="handleRevoke(row)">
                    <RefreshLeft />
                  </el-icon>
                </el-tooltip>
                <el-tooltip content="交办" placement="top" :show-after="300" :hide-after="0" effect="dark" popper-class="compact-tooltip">
                  <el-icon class="action-icon info" @click.stop="handleAssign(row)">
                    <Share />
                  </el-icon>
                </el-tooltip>
                <el-tooltip content="修改" placement="top" :show-after="300" :hide-after="0" effect="dark" popper-class="compact-tooltip">
                  <el-icon class="action-icon primary" @click.stop="handleEdit(row)">
                    <Edit />
                  </el-icon>
                </el-tooltip>
                <el-tooltip content="删除" placement="top" :show-after="300" :hide-after="0" effect="dark" popper-class="compact-tooltip">
                  <el-icon class="action-icon danger" @click.stop="handleDelete(row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
              </template>
              
              <!-- 已完成状态：只显示删除按钮 -->
              <template v-else-if="row.status === 2">
                <el-tooltip content="删除" placement="top" :show-after="300" :hide-after="0" effect="dark" popper-class="compact-tooltip">
                  <el-icon class="action-icon danger" @click.stop="handleDelete(row)">
                    <Delete />
                  </el-icon>
                </el-tooltip>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 分页组件 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="tablePageParams.p"
          v-model:page-size="tablePageParams.l"
          :page-sizes="[10, 20, 30, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="tableTotal"
          @size-change="handleTableSizeChange"
          @current-change="handleTablePageChange"
        />
      </div>
    </div>
    
    <!-- 交办任务对话框 -->
    <AssignDialog
      v-model="assignDialogVisible"
      :todo-item="currentAssignItem"
      @confirm="handleAssignConfirm"
    />
    
    <!-- 任务详情对话框 -->
    <DetailDialog
      v-model="detailDialogVisible"
      :todo-item="currentDetailItem"
      :show-revoke="showRevokeInDetail"
      @confirm="handleDetailConfirm"
      @revoke-success="handleRevokeSuccess"
    />
    
    <!-- 创建交办对话框 -->
    <CreateAssignDialog
      v-model="createDialogVisible"
      :edit-item="currentEditItem"
      @confirm="handleCreateConfirm"
    />
    
    <!-- 延期提示对话框 -->
    <DelayReminderDialog
      v-model="delayReminderDialogVisible"
      :todo-item="currentDelayReminderItem"
      @reject="handleDelayReject"
      @approve="handleDelayApprove"
    />
    
    <!-- 闹钟编辑对话框 -->
    <el-dialog
      v-model="reminderDialogVisible"
      :title="`${currentReminderItem?.title || ''} - 闹钟设置`"
      width="550px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      append-to-body
      class="reminder-edit-dialog"
    >
      <div class="reminder-dialog-header">
        <el-icon class="reminder-dialog-icon"><Clock /></el-icon>
        <div class="reminder-dialog-info">
          <h4>{{ currentReminderItem?.title }}</h4>
          <p>{{ currentReminderItem?.content }}</p>
        </div>
      </div>
      
      <el-divider style="margin: 16px 0" />
      
      <div class="reminder-scroll-wrapper">
        <ReminderSetting 
          v-model="currentReminderList"
        />
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="reminderDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleReminderSave" :loading="reminderSaving">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="MyAssign">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { Plus, Clock, Edit, Delete, RefreshLeft, Grid, List, Loading, CircleClose, Share } from '@element-plus/icons-vue'
import AssignDialog from './components/AssignDialog.vue'
import DetailDialog from './components/DetailDialog.vue'
import CreateAssignDialog from './components/CreateAssignDialog.vue'
import DelayReminderDialog from './components/DelayReminderDialog.vue'
import ReminderSetting from './components/ReminderSetting.vue'
import ViewSwitcher from '@/components/ViewSwitcher/index.vue'
import { getAssignmentList, getAssignmentStatusCount, getAssignmentDetail, addAssignment, updateAssignment, deleteAssignment, processExtension } from '@/api/todo'

// 路由
const router = useRouter()
const route = useRoute()

// 基础URL
const baseUrl = import.meta.env.VITE_APP_BASE_API

// 当前时间（用于倒计时更新）
const currentTime = ref(new Date())

// 视图模式：card 卡片视图，table 表格视图（从localStorage读取）
const viewMode = ref(localStorage.getItem('myAssign_viewMode') || 'card')

// 每行卡片数量（从localStorage读取，默认6个/行）
const cardsPerRow = ref(Number(localStorage.getItem('myAssign_cardsPerRow')) || 6)

// 监听路由 query 参数变化（MQTT 通知跳转到同页面不同 tab 时触发）
watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab && newTab !== currentTab.value) {
      console.log('[MyAssign] 检测到 URL tab 变化:', newTab)
      // 验证 tab 参数是否有效
      const validTabs = ['all', 'inProgress', 'pending', 'completed']
      if (validTabs.includes(newTab)) {
        currentTab.value = newTab
        console.log('[MyAssign] 切换到 tab:', newTab, '并刷新数据')
        // 刷新数据
        fetchStatusCount()
        if (viewMode.value === 'card') {
          pageParams.value.p = 1
          hasMore.value = true
          fetchAssignmentList()
        } else {
          tablePageParams.value.p = 1
          fetchTableData()
        }
      }
    }
  },
  { immediate: false }
)

// 监听viewMode变化，保存到localStorage并加载数据
watch(viewMode, (newVal) => {
  localStorage.setItem('myAssign_viewMode', newVal)
  // 切换视图时加载对应数据
  if (newVal === 'table') {
    fetchTableData()
  } else {
    // 如果卡片列表为空，重新加载
    if (todoList.value.length === 0) {
      fetchAssignmentList()
    }
    // 切换到卡片视图时，应用网格设置
    nextTick(() => {
      handleCardsPerRowChange(cardsPerRow.value)
    })
  }
})

// 处理每行卡片数量变化
const handleCardsPerRowChange = (value) => {
  localStorage.setItem('myAssign_cardsPerRow', value)
  cardsPerRow.value = value  // 更新响应式变量
  
  // 更新网格布局
  nextTick(() => {
    const todoListEl = document.querySelector('.todo-list')
    if (todoListEl) {
      // 计算每个卡片的最小宽度，确保正好显示指定数量的列
      const containerWidth = todoListEl.offsetWidth
      const gap = 10 // 间距
      const minCardWidth = Math.floor((containerWidth - gap * (value - 1)) / value)
      
      // 如果计算出的宽度太小（小于250px），使用较少的列数
      if (minCardWidth < 250) {
        // 重新计算可以容纳的最大列数
        const maxCols = Math.floor((containerWidth + gap) / (250 + gap))
        const actualCols = Math.min(maxCols, value)
        const actualMinWidth = Math.floor((containerWidth - gap * (actualCols - 1)) / actualCols)
        todoListEl.style.gridTemplateColumns = `repeat(${actualCols}, minmax(${actualMinWidth}px, 1fr))`
      } else {
        // 使用固定列数，不超过用户选择的值
        todoListEl.style.gridTemplateColumns = `repeat(${value}, minmax(${minCardWidth}px, 1fr))`
      }
    }
  })
}

// 表格高度
const tableHeight = ref(window.innerHeight - 84 - 52 - 60)

// 倒计时定时器
let countdownTimer = null

// 当前选中的标签
const currentTab = ref('all')

// 标签页配置
const tabs = ref([
  { key: 'all', label: '全部', count: 0 },
  { key: 'inProgress', label: '进行中', count: 0 },
  { key: 'pending', label: '待接收', count: 0 },
  { key: 'completed', label: '已完成', count: 0 }
])

// 卡片视图分页参数
const pageParams = ref({
  p: 1,
  l: 50  // 每次加载50条（适配6列布局，确保页面高度足够触发滚动加载）
})

// 总数
const total = ref(0)

// 是否还有更多数据
const hasMore = ref(true)

// 表格视图分页参数
const tablePageParams = ref({
  p: 1,
  l: 30  // 默认每页30条
})

// 日期范围筛选
const dateRange = ref(null)

// 表格总数
const tableTotal = ref(0)

// 加载状态
const loading = ref(false)

// 滚动条引用
const scrollbarRef = ref(null)

// 交办列表数据
const todoList = ref([])

// 过滤后的待办列表（卡片视图使用）
const filteredTodoList = computed(() => {
  if (currentTab.value === 'all') {
    return todoList.value
  }
  // 状态映射：0待接收 1进行中 2已完成
  const statusMap = {
    'pending': 0,
    'inProgress': 1,
    'completed': 2
  }
  return todoList.value.filter(item => item.status === statusMap[currentTab.value])
})

// 表格数据（表格视图使用）
const tableData = ref([])

// 获取交办列表
const fetchAssignmentList = async (isLoadMore = false) => {
  if (loading.value) return
  
  loading.value = true
  try {
    const params = {
      ...pageParams.value
    }
    // 如果不是全部标签，添加状态筛选
    if (currentTab.value !== 'all') {
      const statusMap = {
        'pending': 0,
        'inProgress': 1,
        'completed': 2
      }
      params.status = statusMap[currentTab.value]
    }
    
    const res = await getAssignmentList(params)
    if (res.code === 200) {
      // 转换数据格式
      const newList = res.data.list.map(item => ({
        ...item,  // 保留所有原始字段
        deadline: item.dueDate ? new Date(item.dueDate) : null,
        todoList: item.todoList || []
      }))
      
      // 如果是加载更多，追加数据；否则替换数据
      if (isLoadMore) {
        todoList.value = [...todoList.value, ...newList]
      } else {
        todoList.value = newList
      }
      
      total.value = res.data.total
      // 判断是否还有更多数据
      hasMore.value = todoList.value.length < total.value
    }
  } catch (error) {
    console.error('获取交办列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 统一刷新列表数据（根据当前视图模式）
const refreshList = async () => {
  if (viewMode.value === 'table') {
    await fetchTableData()
  } else {
    await fetchAssignmentList()
  }
}

// 获取状态统计
const fetchStatusCount = async () => {
  try {
    const res = await getAssignmentStatusCount()
    if (res.code === 200) {
      const counts = res.data
      tabs.value = [
        { key: 'all', label: '全部', count: counts.total || 0 },
        { key: 'inProgress', label: '进行中', count: counts.inProgress || 0 },
        { key: 'pending', label: '待接收', count: counts.pending || 0 },
        { key: 'completed', label: '已完成', count: counts.completed || 0 }
      ]
    }
  } catch (error) {
    console.error('获取状态统计失败:', error)
  }
}

// 完成对话框相关
const completeDialogVisible = ref(false)
const currentCompleteItem = ref(null)

// 延期对话框相关
const delayDialogVisible = ref(false)
const currentDelayItem = ref(null)

// 交办对话框相关
const assignDialogVisible = ref(false)
const currentAssignItem = ref(null)

// 详情对话框相关
const detailDialogVisible = ref(false)
const currentDetailItem = ref(null)
const showRevokeInDetail = ref(false)  // 控制详情对话框中是否显示撤销按钮

// 创建交办对话框相关
const createDialogVisible = ref(false)
const currentEditItem = ref(null)

// 延期提示对话框相关
const delayReminderDialogVisible = ref(false)
const currentDelayReminderItem = ref(null)

// 闹钟编辑对话框相关
const reminderDialogVisible = ref(false)
const currentReminderItem = ref(null)
const currentReminderList = ref([])
const reminderSaving = ref(false)

// 获取倒计时文本（使用 currentTime 实现实时更新）
const getCountdownText = (item) => {
  if (item.status === 2) {
    return item.completedTime || '已完成'
  }
  
  if (!item.deadline) {
    return ''
  }
  
  const now = currentTime.value  // 使用响应式的当前时间
  const deadline = typeof item.deadline === 'string' ? new Date(item.deadline) : item.deadline
  const diff = deadline - now
  
  // 已超时：显示截止日期
  if (diff <= 0) {
    return "已逾期"
  }
  
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
  
  return `${days > 0 ? `${days}天` : ''} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

// 状态筛选方法
const filterStatus = (value, row) => {
  return row.status === value
}

// 按创建时间排序
const sortByCreateTime = (a, b) => {
  if (!a.createTime && !b.createTime) return 0
  if (!a.createTime) return 1
  if (!b.createTime) return -1
  return new Date(a.createTime).getTime() - new Date(b.createTime).getTime()
}

// 按完成时间排序
const sortByFinishTime = (a, b) => {
  if (!a.finishTime && !b.finishTime) return 0
  if (!a.finishTime) return 1
  if (!b.finishTime) return -1
  return new Date(a.finishTime).getTime() - new Date(b.finishTime).getTime()
}

// 排序方法：按截止时间排序
const sortByDeadline = (a, b) => {
  // 已完成的任务排到最后
  if (a.status === 2 && b.status !== 2) return 1
  if (a.status !== 2 && b.status === 2) return -1
  if (a.status === 2 && b.status === 2) return 0
  
  // 没有截止时间的排到最后
  if (!a.deadline && b.deadline) return 1
  if (a.deadline && !b.deadline) return -1
  if (!a.deadline && !b.deadline) return 0
  
  // 按截止时间升序排序（最紧急的在前）
  const timeA = typeof a.deadline === 'string' ? new Date(a.deadline).getTime() : a.deadline.getTime()
  const timeB = typeof b.deadline === 'string' ? new Date(b.deadline).getTime() : b.deadline.getTime()
  return timeA - timeB
}

// 获取倒计时样式类（根据剩余天数，使用 currentTime 实现实时更新）
const getCountdownClass = (item) => {
  if (item.status === 2) {
    return 'completed'
  }
  
  if (!item.deadline) {
    return 'active'
  }
  
  const now = currentTime.value  // 使用响应式的当前时间
  const deadline = typeof item.deadline === 'string' ? new Date(item.deadline) : item.deadline
  const diff = deadline - now
  
  // 已超时
  if (diff <= 0) {
    return 'red'
  }
  
  // 计算剩余天数
  const days = diff / (24 * 60 * 60 * 1000)
  
  // ≥2天：绿色
  if (days >= 2) {
    return 'green'
  }
  // 1-2天：橙色
  else if (days >= 1) {
    return 'orange'
  }
  // ≤1天：红色
  else {
    return 'red'
  }
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    inProgress: '进行中的按钮状态',
    pending: '待接收的按钮状态',
    rejected: '被拒绝的按钮状态',
    completed: '已完成的按钮状态'
  }
  return statusMap[status] || ''
}

// 获取第一张图片
const getFirstImage = (imgs) => {
  if (!imgs) return ''
  
  // imgs 是逗号分隔的字符串
  const imgPaths = imgs.split(',').filter(img => img.trim())
  if (imgPaths.length === 0) return ''
  
  const firstPath = imgPaths[0]
  // 处理图片URL
  if (firstPath.startsWith('http')) {
    return firstPath
  } else {
    return baseUrl + firstPath
  }
}

// 获取图片总数量
const getImageCount = (imgs) => {
  if (!imgs) return 0
  
  // imgs 是逗号分隔的字符串
  const imgPaths = imgs.split(',').filter(img => img.trim())
  return imgPaths.length
}

// 获取状态标签类型
const getStatusTagType = (status) => {
  const typeMap = {
    '-2': 'danger',    // 已拒绝 - 红色
    '-1': 'warning',   // 已交办 - 橙色
    '0': 'cyan',       // 待接收 - 青色（自定义）
    '1': 'primary',    // 进行中 - 蓝色
    '2': 'success'     // 已完成 - 绿色
  }
  return typeMap[status] || ''
}

// 获取接办人标签类型（根据接办人的任务状态）
const getAssigneeTagType = (status) => {
  const typeMap = {
    '-2': 'danger',    // 已拒绝 - 红色
    '-1': 'warning',   // 已交办 - 橙色
    '0': 'info',       // 待接收 - 灰色
    '1': 'primary',    // 进行中 - 蓝色
    '2': 'success'     // 已完成 - 绿色
  }
  return typeMap[status] || 'info'
}

// 处理创建按钮点击
const handleCreate = () => {
  currentEditItem.value = null
  createDialogVisible.value = true
}

// 处理卡片点击
const handleCardClick = async (item) => {
  try {
    // 调用详情接口获取完整数据
    const res = await getAssignmentDetail(item.id)
    if (res.code === 200) {
      currentDetailItem.value = {
        ...res.data,
        // 保留列表中的一些额外字段
        statusName: item.statusName,
        isExtension: item.isExtension,
        overdue: item.overdue,
        todoList: item.todoList,
        reminderList: item.reminderList || []  // 传递闹钟列表
      }
      showRevokeInDetail.value = false  // 点击卡片打开详情时不显示撤销按钮
      detailDialogVisible.value = true
    }
  } catch (error) {
    console.error('获取交办详情失败:', error)
    ElMessage.error('获取详情失败')
  }
}

// 处理操作按钮点击
const handleAction = (type, item) => {
  console.log('操作类型:', type, '任务:', item)
  
  if (type === 'delay') {
    // 显示延期提示对话框
    currentDelayReminderItem.value = item
    delayReminderDialogVisible.value = true
    return
  }
  
  if (type === 'complete') {
    // 显示完成确认对话框
    currentCompleteItem.value = item
    completeDialogVisible.value = true
    return
  }
  
  if (type === 'delay') {
    // 显示延期申请对话框
    currentDelayItem.value = item
    delayDialogVisible.value = true
    return
  }
  
  if (type === 'assign') {
    // 显示交办任务对话框
    currentAssignItem.value = item
    assignDialogVisible.value = true
    return
  }
  
  if (type === 'handle') {
    // 显示任务详情对话框
    currentDetailItem.value = item
    detailDialogVisible.value = true
    return
  }
  
  const actionMap = {
    accept: '同意接收',
    reject: '拒绝任务',
    reschedule: '重新排期'
  }
  
  ElMessage.success(actionMap[type] || '操作成功')
}

// 确认完成任务
const handleCompleteConfirm = ({ item, remark }) => {
  console.log('完成任务:', item, '备注:', remark)
  ElMessage.success('任务已完成')
  
  // 更新任务状态
  const index = todoList.value.findIndex(t => t.id === item.id)
  if (index !== -1) {
    todoList.value[index].status = 'completed'
    updateTabCounts()
  }
}

// 确认延期申请
const handleDelayConfirm = ({ item, delayedDateTime, delayType }) => {
  console.log('延期申请:', item, '延期至:', delayedDateTime, '类型:', delayType)
  ElMessage.success('延期申请已提交')
  
  // 更新任务截止时间
  const index = todoList.value.findIndex(t => t.id === item.id)
  if (index !== -1) {
    todoList.value[index].deadline = delayedDateTime
  }
}

// 确认交办任务
const handleAssignConfirm = async ({ item, userId, userName }) => {
  try {
    // 如果是重新交办，调用修改接口更新接办人
    if (item.isReassign) {
      // 处理图片数据，确保是字符串格式
      let imgsStr = ''
      if (item.imgs) {
        if (Array.isArray(item.imgs)) {
          imgsStr = item.imgs.join(',')
        } else if (typeof item.imgs === 'string') {
          imgsStr = item.imgs
        }
      }
      
      // 从 todoList 中提取接办人用户名列表
      const assigneeList = item.todoList && item.todoList.length > 0
        ? item.todoList.map(todo => todo.assignee)
        : []
      
      
      await updateAssignment({
        id: item.id,
        title: item.title,
        content: item.content,
        url: item.url || '',
        imgs: imgsStr,
        dueDate: item.dueDate,
        remark: item.remark || '',
        assignor: userName,  // ✅ 更新交办人为新的用户
        assigneeList: assigneeList  // ✅ 从 todoList 提取原来的接办人列表
      })
      ElMessage.success(`已交办给 ${userName}`)
      
      // 刷新列表
      await refreshList()
      await fetchStatusCount()
    } else {
      // 原有逻辑：只更新本地状态
      console.log('交办任务:', item, '接办人:', userName, 'ID:', userId)
      ElMessage.success(`已交办给 ${userName}`)
      
      // 更新任务状态
      const index = todoList.value.findIndex(t => t.id === item.id)
      if (index !== -1) {
        todoList.value[index].assignee = userName
      }
    }
  } catch (error) {
    console.error('交办任务失败:', error)
    ElMessage.error('交办失败，请稍后重试')
  }
}

// 确认任务详情
const handleDetailConfirm = ({ item, description, images }) => {
  console.log('任务详情:', item, '描述:', description, '图片:', images)
  ElMessage.success('任务详情已保存')
  
  // 更新任务状态
  const index = todoList.value.findIndex(t => t.id === item.id)
  if (index !== -1) {
    todoList.value[index].handleDescription = description
    todoList.value[index].handleImages = images
  }
}

// 处理撤销成功
const handleRevokeSuccess = async () => {
  // 刷新交办列表
  await refreshList()
  await fetchStatusCount()
}

// 处理删除交办
const handleDelete = (item) => {
  ElMessageBox.confirm(
    `确定要删除交办「${item.title}」吗？删除后无法恢复。`,
    '删除确认',
    {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(async () => {
    try {
      await deleteAssignment(item.id)
      ElMessage.success('删除成功')
      // 刷新列表
      await refreshList()
      await fetchStatusCount()
    } catch (error) {
      console.error('删除交办失败:', error)
      // 友好的错误提示
      if (error.message && error.message.includes('foreign key constraint')) {
        ElMessage.error('删除失败：该交办存在关联数据，请联系管理员处理')
      } else {
        ElMessage.error('删除失败，请稍后重试')
      }
    }
  }).catch(() => {
    // 用户取消
  })
}

// 处理修改交办
const handleEdit = async (item) => {
  console.log("🚀 ~ file: index.vue:946 ~ item:", item)
  try {
    // 获取完整详情
      // 合并列表数据和详情数据，确保 todoList 可用
      currentEditItem.value = {
        ...item,
        todoList: item.todoList || []  // 从列表数据中获取 todoList
      }
      createDialogVisible.value = true
  } catch (error) {
    console.error('获取交办详情失败:', error)
    ElMessage.error('获取详情失败')
  }
}

// 处理交办任务（打开交办对话框选择新接办人）
const handleAssign = async (item) => {
  try {
    // 获取完整详情
    const res = await getAssignmentDetail(item.id)
    if (res.code === 200) {
      currentAssignItem.value = {
        ...res.data,
        todoList: item.todoList || [],
        isReassign: true  // 标记为重新交办
      }
      assignDialogVisible.value = true
    }
  } catch (error) {
    console.error('获取交办详情失败:', error)
    ElMessage.error('获取详情失败')
  }
}

// 处理撤销交办（打开详情对话框并显示撤销按钮）
const handleRevoke = async (item) => {
  try {
    // 获取完整详情
    const res = await getAssignmentDetail(item.id)
    if (res.code === 200) {
      currentDetailItem.value = {
        ...res.data,
        // 保留列表中的一些额外字段
        statusName: item.statusName,
        isExtension: item.isExtension,
        overdue: item.overdue,
        todoList: item.todoList,
        reminderList: item.reminderList || []  // 传递闹钟列表
      }
      showRevokeInDetail.value = true  // 显示撤销按钮
      detailDialogVisible.value = true
    }
  } catch (error) {
    console.error('获取交办详情失败:', error)
    ElMessage.error('获取详情失败')
  }
}

// 确认创建或修改交办
const handleCreateConfirm = async (data) => {
  try {
    // 处理图片数据
    let imgsStr = ''
    if (data.images) {
      if (Array.isArray(data.images)) {
        imgsStr = data.images.join(',')
      } else if (typeof data.images === 'string') {
        imgsStr = data.images
      }
    }
 
    // 判断是创建还是修改
    if (data.isEdit && data.id) {
      // 修改模式
      await updateAssignment({
        id: data.id,
        title: data.title,
        content: data.content,
        url: data.url || '',
        imgs: imgsStr,
        dueDate: data.deadline,
        remark: data.remark || '',
        assigneeList: data.assigneeList,
        reminderList: data.reminderList || []  // 闹钟列表
      })
      ElMessage.success('修改成功')
    } else {
      // 创建模式
      await addAssignment({
        title: data.title,
        content: data.content,
        url: data.url || '',
        imgs: imgsStr,
        assignor: '',
        dueDate: data.deadline,
        remark: data.remark || '',
        assigneeList: data.assigneeList,
        reminderList: data.reminderList || []  // 闹钟列表
      })
      ElMessage.success('创建成功')
    }
    
    // 刷新列表
    await refreshList()
    await fetchStatusCount()
  } catch (error) {
    console.error(data.isEdit ? '修改交办失败' : '创建交办失败', error)
  }
}

// 拒绝延期申请
const handleDelayReject = async ({ item, record }) => {
  try {
    await processExtension({
      id: record.id,
      isApproved: false
    })
    ElMessage.success('已拒绝延期申请')
    await refreshList()
  } catch (error) {
    console.error('拒绝延期申请失败:', error)
  }
}

// 同意延期申请
const handleDelayApprove = async ({ item, record }) => {
  try {
    await processExtension({
      id: record.id,
      isApproved: true
    })
    ElMessage.success('已同意延期申请')
    await refreshList()
  } catch (error) {
    console.error('同意延期申请失败:', error)
  }
}

// 点击闹钟图标
const handleReminderClick = (item) => {
  console.log('[MyAssign] 点击闹钟图标:', item)
  currentReminderItem.value = item
  // 深拷贝闹钟列表，避免直接修改原数据
  currentReminderList.value = item.reminderList ? JSON.parse(JSON.stringify(item.reminderList)) : []
  reminderDialogVisible.value = true
}

// 保存闹钟设置
const handleReminderSave = async () => {
  try {
    reminderSaving.value = true
    
    // 调用更新接口
    await updateAssignment({
      id: currentReminderItem.value.id,
      title: currentReminderItem.value.title,
      content: currentReminderItem.value.content,
      url: currentReminderItem.value.url || '',
      imgs: currentReminderItem.value.imgs || '',
      dueDate: currentReminderItem.value.dueDate,
      remark: currentReminderItem.value.remark || '',
      assigneeList: currentReminderItem.value.assigneeList || [],
      reminderList: currentReminderList.value
    })
    
    ElMessage.success('闹钟设置已保存')
    reminderDialogVisible.value = false
    
    // 刷新列表
    await refreshList()
  } catch (error) {
    console.error('保存闹钟设置失败:', error)
    ElMessage.error('保存失败')
  } finally {
    reminderSaving.value = false
  }
}

// 启动倒计时定时器（每分钟更新一次）
const startCountdownTimer = () => {
  // 清除旧的定时器
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
  
  // 每秒更新一次当前时间，实现实时倒计时效果
  countdownTimer = setInterval(() => {
    currentTime.value = new Date()
  }, 1000) // 1秒更新一次
}

// 停止倒计时定时器
const stopCountdownTimer = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

// 处理卡片列表滚动
const handleCardScroll = ({ scrollTop, scrollLeft }) => {
  if (!scrollbarRef.value || loading.value || !hasMore.value) return
  
  const scrollContainer = scrollbarRef.value.wrapRef
  if (!scrollContainer) return
  
  const scrollHeight = scrollContainer.scrollHeight
  const clientHeight = scrollContainer.clientHeight
  
  // 距离底部50px时触发加载
  if (scrollHeight - scrollTop - clientHeight < 50) {
    loadMore()
  }
}

// 加载更多数据
const loadMore = async () => {
  if (loading.value || !hasMore.value) return
  
  pageParams.value.p += 1
  await fetchAssignmentList(true)
}

// 处理标签切换
const handleTabChange = (tabKey) => {
  currentTab.value = tabKey
  // 重置分页参数
  pageParams.value.p = 1
  tablePageParams.value.p = 1
  hasMore.value = true
  // 重新加载数据
  if (viewMode.value === 'card') {
    fetchAssignmentList()
  } else {
    fetchTableData()
  }
}

// 处理日期范围变化
const handleDateRangeChange = (value) => {
  tablePageParams.value.p = 1  // 重置到第一页
  fetchTableData()
}

// 获取表格数据
const fetchTableData = async () => {
  loading.value = true
  try {
    const params = {
      p: tablePageParams.value.p,
      l: tablePageParams.value.l
    }
    // 如果不是全部标签，添加状态筛选
    if (currentTab.value !== 'all') {
      const statusMap = {
        'pending': 0,
        'inProgress': 1,
        'completed': 2
      }
      params.status = statusMap[currentTab.value]
    }
    // 添加日期范围筛选
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    
    const res = await getAssignmentList(params)
    if (res.code === 200) {
      // 转换数据格式
      tableData.value = res.data.list.map(item => ({
        ...item,  // 保留所有原始字段
        deadline: item.dueDate ? new Date(item.dueDate) : null,
        todoList: item.todoList || []
      }))
      tableTotal.value = res.data.total
    }
  } catch (error) {
    console.error('获取交办列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 处理表格每页条数变化
const handleTableSizeChange = (val) => {
  tablePageParams.value.l = val
  tablePageParams.value.p = 1
  fetchTableData()
}

// 处理表格页码变化
const handleTablePageChange = (val) => {
  tablePageParams.value.p = val
  fetchTableData()
}

// 初始化
onMounted(() => {
  // 从 URL 查询参数中读取 tab
  const tabParam = router.currentRoute.value.query.tab
  if (tabParam) {
    // 验证 tab 参数是否有效
    const validTabs = ['all', 'pending', 'inProgress', 'completed']
    if (validTabs.includes(tabParam)) {
      currentTab.value = tabParam
      console.log('[MyAssign] 从 URL 切换到 tab:', tabParam)
    }
  }
  
  // 根据当前视图模式加载对应数据
  if (viewMode.value === 'table') {
    fetchTableData()
  } else {
    fetchAssignmentList()
  }
  fetchStatusCount()
  startCountdownTimer()  // 启动倒计时定时器
  
  // 应用保存的每行卡片数量设置
  nextTick(() => {
    if (viewMode.value === 'card') {
      handleCardsPerRowChange(cardsPerRow.value)
    }
  })
  
  // 监听窗口大小变化，重新应用网格设置
  window.addEventListener('resize', () => {
    if (viewMode.value === 'card') {
      handleCardsPerRowChange(cardsPerRow.value)
    }
  })
  
  // 监听 MQTT 刷新事件（当在同一页面收到通知时触发）
  if (window.$eventBus) {
    window.$eventBus.on('refresh-assignment-list', () => {
      console.log('[MyAssign] 收到 MQTT 刷新事件，重新加载数据')
      // 刷新统计数据
      fetchStatusCount()
      // 根据当前视图模式刷新列表
      if (viewMode.value === 'card') {
        // 卡片视图：重置分页并重新加载
        pageParams.value.p = 1
        hasMore.value = true
        fetchAssignmentList()
      } else {
        // 表格视图：重新加载当前页
        fetchTableData()
      }
    })
  }
})

// 组件卸载时清理定时器和事件监听
onUnmounted(() => {
  stopCountdownTimer()  // 清理定时器，防止内存泄漏
  
  // 移除事件监听
  if (window.$eventBus) {
    window.$eventBus.off('refresh-assignment-list')
  }
})
</script>

<style lang="scss" scoped>
.todo-page {
  min-height: calc(100vh - 54px);
  background: linear-gradient(90deg, #f2f3f5 0%, #f2f3f5 100%);
  padding: 10px;
}

// 头部区域
.todo-header {
  /* 页面级吸顶，tabs 固定不随列表滚动 */
  position: sticky;
  top: 10px; /* 与我的待办保持一致，如需贴紧全局头部可调整为具体高度 */
  background: #ffffff;
  border-radius: 8px;
  padding: 0 44px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
}

// 标签页样式
.todo-tabs {
  display: flex;
  align-items: center;
  gap: 40px;
  height: 100%;
  
  .tab-item {
    position: relative;
    font-size: 15px;
    color: #6c747c;
    cursor: pointer;
    padding: 18px 0;
    transition: color 0.2s;
    white-space: nowrap;
    
    &:hover {
      color: var(--el-color-primary);
    }
    
    &.active {
      color: var(--el-color-primary);
      font-weight: 600;
      
      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--el-color-primary);
        border-radius: 2px 2px 0 0;
      }
    }
  }
}

// 视图切换组件容器（已移至独立组件）

// 创建按钮
.create-btn {
  background: #e0ebff;
  border: none;
  color: #fff;
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 16px;
  
  &:hover {
    background: #d0e1ff;
  }
  
  :deep(.el-icon) {
    margin-right: 4px;
  }
}

// 卡片列表容器
.todo-list-container {
  background: transparent;
  /* 视口高度 - 顶部全局区域(54px) - 本页头部(52px) - 上下内边距和间距(40px可微调) */
  height: calc(100vh - 54px - 52px - 40px);
  
  :deep(.el-scrollbar__wrap) {
    overflow-x: hidden;
  }
  
  // 初始加载居中样式
  .loading-center {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #909399;
    font-size: 14px;
    
    .el-icon {
      font-size: 32px;
      color: var(--el-color-primary);
    }
  }
}

// 卡片列表样式
.todo-list {
  display: grid;
  grid-template-columns: repeat(6, 1fr);  // 默认6列，通过JavaScript动态控制
  gap: 10px;
  padding-bottom: 20px;
  min-height: 400px;
  
  // 空数据展示居中
  :deep(.el-empty) {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 0;
    height:calc(100vh - 144px);
    box-sizing: border-box;
    .el-empty__image {
      margin-bottom: 20px;
    }
    
    .el-empty__description {
      font-size: 14px;
      color: #909399;
      margin-top: 12px;
    }
  }
}

// 加载更多提示
.load-more-tip {
  grid-column: 1 / -1;
  text-align: center;
  padding: 20px;
  color: #909399;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  .el-icon {
    font-size: 16px;
  }
}

// 任务卡片
.todo-card {
  background: linear-gradient(90deg, #ffffff 0%, #ffffff 100%), 
              linear-gradient(#f1f6fe 0%, #fcfdfd 100%);
  border-radius: 8px;
  padding: 16px;
  min-height: 225px;
  max-height: 260px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.card-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
  padding: 2px;
  margin: -2px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  gap: 12px;  // 标题和倒计时之间的间距
}

.card-title-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.card-title {
  font-size: 15px;
  color: #394047;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.reminder-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  cursor: help;
  transition: opacity 0.3s;
  
  &:hover {
    opacity: 0.7;
  }
}

.countdown {
  font-size: 14px;
  flex-shrink: 0;  // 倒计时不缩小，保证完整显示
  white-space: nowrap;  // 倒计时不换行
  
  &.green {
    color: #00bc16;
  }
  
  &.orange {
    color: #f2b900;
  }
  
  &.red {
    color: #ff5959;
  }
  
  &.expired {
    color: #9f9f9f;  // 已超时显示灰色
  }
  
  &.completed {
    color: #9f9f9f;
  }
}

.card-content {
  background: #f2f3f5;
  border-radius: 8px;
  padding: 12px;
  overflow: hidden;
  display: flex;
  gap: 12px;
  min-height: 90px;
  max-height: 130px;
  flex: 1;
  margin-bottom: 12px;
      max-height:110px;
}

.card-desc-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}

.card-desc {
  font-size: 13px;
  color: #6c747c;
  margin: 0 0 8px 0;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  flex-shrink: 0;
}

.card-bottom-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: auto;
}

.card-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #999;
  
  .el-icon {
    font-size: 14px;
  }
}

.card-image-wrapper {
  position: relative;
  flex-shrink: 0;
  width: 90px;
  height: 90px;
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #e4e4e4;
  background: #fff;
}

.image-count {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.card-assignees {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  width: 100%;
  max-height: 50px;
  overflow: hidden;
  
  .assignees-label {
    font-size: 12px;
    color: #909399;
    white-space: nowrap;
    flex-shrink: 0;
    line-height: 22px;
  }
  
  .assignees-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    flex: 1;
    overflow: hidden;
    
    .el-tag {
      font-size: 12px;
      height: 22px;
      line-height: 20px;
      padding: 0 8px;
      
      :deep(.el-tag__content) {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}

.card-actions {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 2px;
  flex-wrap: nowrap;  // ✅ 防止按钮换行
  
  /* 隐藏滚动条但保持滚动功能 */
  &::-webkit-scrollbar {
    height: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #dcdfe6;
    border-radius: 2px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: #c0c4cc;
  }
  
  // 确保按钮不会被压缩
  .action-btn {
    flex-shrink: 0;  // ✅ 防止按钮被压缩
  }
}

.action-btn {
  height: 28px;
  padding: 4px 10px;
  border-radius: 28px;
  font-size: 13px;
  min-width: 60px;
  
  &.success-btn {
    background: transparent;
    border: 1px solid #00bc16;
    color: #00bc16;
    
    &:hover {
      background: #00bc16;
      color: #ffffff;
    }
  }
  
  &.warning-btn {
    background: transparent;
    border: 1px solid #f2b900;
    color: #f2b900;
    
    &:hover {
      background: #f2b900;
      color: #ffffff;
    }
  }
  
  &.primary-outline-btn {
    background: transparent;
    border: 1px solid var(--el-color-primary);
    color: var(--el-color-primary);
    
    &:hover {
      background: var(--el-color-primary);
      color: #ffffff;
    }
  }
  
  &.danger-btn {
    background: transparent;
    border: 1px solid #ff5959;
    color: #ff5959;
    
    &:hover {
      background: #ff5959;
      color: #ffffff;
    }
  }
  
  &.completed-btn {
    background: #f2f3f5;
    border: none;
    color: #9f9f9f;
    cursor: not-allowed;
    min-width: 68px;
  }
  
  &.info-btn {
    background: transparent;
    border: 1px solid #909399;
    color: #909399;
    
    &:hover {
      background: #909399;
      color: #ffffff;
    }
  }
}


// 表格视图样式
.todo-table-wrapper {
  background: #ffffff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  /* 占满剩余空间 */
  height: calc(100vh - 54px - 52px - 40px);
  display: flex;
  flex-direction: column;
  
  // 待接收状态的青色标签样式（自定义 cyan 类型）
  :deep(.el-tag--cyan) {
    background-color: #e0f7fa !important;
    border-color: #00bcd4 !important;
    color: #00838f !important;
  }
  
  .pagination-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #f0f0f0;
    flex-shrink: 0;
  }
  
  :deep(.el-table) {
    
    .el-table__header-wrapper {
      th {
        background: #f5f7fa;
        color: #606266;
        font-weight: 600;
      }
    }
    
    .el-table__row {
      cursor: pointer;
      transition: background-color 0.2s;
      
      &:hover {
        background-color: #f5f7fa;
      }
    }
  }
  
  .countdown-text {
    font-size: 13px;
    font-weight: 500;
    
    &.green {
      color: #00bc16;
    }
    
    &.orange {
      color: #f2b900;
    }
    
    &.red {
      color: #ff5959;
    }
    
    &.expired {
      color: #9f9f9f;  // 已超时显示灰色
    }
    
    &.completed {
      color: #9f9f9f;
    }
  }
  
  .table-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    
    .action-icon {
      font-size: 24px;
      cursor: pointer;
      transition: all 0.2s;
      padding: 4px;
      
      &.success {
        color: #67c23a;
        &:hover {
          color: #85ce61;
          transform: scale(1.1);
        }
      }
      
      &.warning {
        color: #e6a23c;
        &:hover {
          color: #ebb563;
          transform: scale(1.1);
        }
      }
      
      &.primary {
        color: #409eff;
        &:hover {
          color: #66b1ff;
          transform: scale(1.1);
        }
      }
      
      &.danger {
        color: #f56c6c;
        &:hover {
          color: #f78989;
          transform: scale(1.1);
        }
      }
      
      &.info {
        color: #909399;
        &:hover {
          color: #a6a9ad;
          transform: scale(1.1);
        }
      }
    }
  }
}

// 紧凑的 Tooltip 样式
:deep(.compact-tooltip.el-popper) {
  padding: 2px 6px !important;
  font-size: 11px !important;
  line-height: 1 !important;
  min-width: auto !important;
  max-width: 60px !important;
  
  .el-tooltip__content {
    padding: 2px 6px !important;
    font-size: 11px !important;
    line-height: 1 !important;
  }
}

// 响应式设计（已使用 auto-fill，以下作为备用）
@media (max-width: 768px) {
  .todo-list {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
  
  .todo-tabs {
    gap: 20px;
    font-size: 14px;
  }
  
  .card-actions {
    flex-wrap: wrap;
  }
  
  .todo-header {
    padding: 0 20px;
  }
}

// 表格视图样式
.todo-table-wrapper {
  background: #ffffff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  
  :deep(.el-table) {
    
    .el-table__header-wrapper {
      th {
        background: #f5f7fa;
        color: #606266;
        font-weight: 600;
      }
    }
    
    .el-table__row {
      cursor: pointer;
      transition: background-color 0.2s;
      
      &:hover {
        background-color: #f5f7fa;
      }
    }
  }
  
  .table-title-cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 8px;
  }
  
  .table-title-text {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .reminder-icon-table {
    width: 18px;
    height: 18px;
    cursor: help;
    flex-shrink: 0;
    transition: opacity 0.3s;
    
    &:hover {
      opacity: 0.7;
    }
  }
  
  .countdown-text {
    font-size: 13px;
    font-weight: 500;
    
    &.green {
      color: #00bc16;
    }
    
    &.orange {
      color: #f2b900;
    }
    
    &.red {
      color: #ff5959;
    }
    
    &.expired {
      color: #9f9f9f;  // 已超时显示灰色
    }
    
    &.completed {
      color: #9f9f9f;
    }
  }
  
  .table-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
    
    .el-button {
      margin: 0;
    }
  }
}

// 闹钟编辑弹窗样式
.reminder-edit-dialog {
  :deep(.el-dialog__body) {
    max-height: 65vh;
    overflow: hidden;
    padding: 20px 20px 10px;
    display: flex;
    flex-direction: column;
  }
}

.reminder-scroll-wrapper {
  max-height: 50vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  
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
  
  &::-webkit-scrollbar-track {
    background: #f5f7fa;
    border-radius: 3px;
  }
}

.reminder-dialog-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  
  .reminder-dialog-icon {
    font-size: 28px;
    color: var(--el-color-primary);
    flex-shrink: 0;
    animation: ring 2s infinite;
  }
  
  .reminder-dialog-info {
    flex: 1;
    min-width: 0;
    
    h4 {
      font-size: 16px;
      font-weight: 600;
      color: #303133;
      margin: 0 0 8px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    p {
      font-size: 14px;
      color: #606266;
      margin: 0;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
}

// 闹钟图标可点击样式
.reminder-icon, .reminder-icon-table {
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    transform: scale(1.15) rotate(10deg);
  }
  
  &:active {
    transform: scale(0.95);
  }
}

// 闹钟摇铃动画
@keyframes ring {
  0%, 100% {
    transform: rotate(0deg);
  }
  10%, 30% {
    transform: rotate(-10deg);
  }
  20%, 40% {
    transform: rotate(10deg);
  }
  50% {
    transform: rotate(0deg);
  }
}
</style>
