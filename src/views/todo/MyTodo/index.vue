<template>
  <div class="todo-page">
    <!-- 标签页 -->
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
      
      <!-- 视图切换组件 -->
      <ViewSwitcher
        v-model:view-mode="viewMode"
        v-model:cards-per-row="cardsPerRow"
        storage-prefix="myTodo"
        @cards-per-row-change="handleCardsPerRowChange"
      />
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
            :description="emptyDescription"
            :image-size="200"
          />
          
          <div 
            v-for="item in filteredTodoList" 
            :key="item.id"
            class="todo-card"
          >
        <div class="card-main" @click="handleCardClick(item)">
          <div class="card-header">
            <span class="card-title">{{ item.title }}</span>
            <span v-if="item.status !== -1 && item.status !== -2" :class="['countdown', getCountdownClass(item)]">
              {{ getCountdownText(item) }}
            </span>
          </div>
          
          <div class="card-content">
            <!-- 左侧内容描述 -->
            <div class="card-desc-wrapper">
              <p class="card-desc">{{ item.description || '暂无内容描述' }}</p>
              <!-- 底部信息：创建时间和交办人 -->
              <div class="card-footer-info">
                <div class="card-time" v-if="item.dueDate && item.status !== -1 && item.status !== -2">
                  <el-icon><Clock /></el-icon>
                  <span>{{ parseTime(item.dueDate, '{y}-{m}-{d} {h}:{i}') }}</span>
                </div>
                <div class="card-assignor" v-if="item.assignor">
                  <el-icon><User /></el-icon>
                  <span>{{ item.assignor }}</span>
                </div>
              </div>
            </div>
            
            <!-- 右侧图片预览 -->
            <div class="card-image-wrapper" v-if="item.assignmentImgs">
              <img 
                :src="getFirstImage(item.assignmentImgs)" 
                class="card-image"
                alt="待办图片"
              />
              <!-- 图片数量角标 -->
              <div class="image-count" v-if="getImageCount(item.assignmentImgs) > 1">
                {{ getImageCount(item.assignmentImgs) }}
              </div>
            </div>
          </div>
        </div>
        
        <div class="card-actions">
          <template v-if="item.status === 1">
                      <div style="display: flex;justify-content: flex-start;align-items:center;flex:1;height: 35px;"> 
            <el-button class="action-btn success-btn" @click="handleAction('complete', item)">完成</el-button>
            <el-button class="action-btn warning-btn" @click="handleAction('delay', item)">延期</el-button>
            <el-button class="action-btn primary-outline-btn" @click="handleAction('assign', item)">交办</el-button>
            <el-button v-if="item.assignmentUrl && item.assignmentUrl.trim()" type="primary" class="action-btn" @click="handleAction('handle', item)">办理</el-button>
         </div>
          </template>
          
          <template v-else-if="item.status === 0">
            <div style="display: flex;justify-content: flex-start;align-items:center;flex:1;height: 35px;"> 
            <el-button class="action-btn primary-outline-btn" @click="handleAction('assign', item)">交办</el-button>
            <el-button class="action-btn danger-btn" @click="handleAction('reject', item)">拒绝</el-button>
            <el-button type="primary" class="action-btn" @click="handleAction('accept', item)">同意</el-button>
            </div>
          </template>
          
          <template v-else-if="item.status === 2">
            <div style="display: flex;justify-content: flex-start;align-items:center;flex:1;height: 35px;"> 
            <el-button class="action-btn completed-btn" disabled>已完成</el-button>
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
        <el-table-column prop="title" label="任务标题" min-width="160" align="center" show-overflow-tooltip />
        <el-table-column prop="description" label="任务描述" min-width="180" align="center" show-overflow-tooltip />
        <el-table-column 
          label="状态" 
          width="80" 
          align="center"
          :filters="[
            { text: '待处理', value: 0 },
            { text: '进行中', value: 1 },
            { text: '已完成', value: 2 },
            { text: '已交办', value: -1 },
            { text: '已拒绝', value: -2 }
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
        <el-table-column label="剩余时间" width="105" align="center" sortable :sort-method="sortByDeadline">
          <template #default="{ row }">
            <span v-if="row.status !== -1 && row.status !== -2" :class="['countdown-text', getCountdownClass(row)]">
              {{ getCountdownText(row) }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="assignor" label="交办人" width="90" align="center" show-overflow-tooltip />
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
              <template v-if="row.status === 1">
                <el-tooltip content="完成" placement="top" :show-after="300" :hide-after="0" effect="dark" popper-class="compact-tooltip">
                  <el-icon class="action-icon success" @click.stop="handleAction('complete', row)">
                    <CircleCheck />
                  </el-icon>
                </el-tooltip>
                <el-tooltip content="延期" placement="top" :show-after="300" :hide-after="0" effect="dark" popper-class="compact-tooltip">
                  <el-icon class="action-icon warning" @click.stop="handleAction('delay', row)">
                    <Timer />
                  </el-icon>
                </el-tooltip>
                <el-tooltip content="交办" placement="top" :show-after="300" :hide-after="0" effect="dark" popper-class="compact-tooltip">
                  <el-icon class="action-icon primary" @click.stop="handleAction('assign', row)">
                    <Share />
                  </el-icon>
                </el-tooltip>
                <el-tooltip content="办理" placement="top" :show-after="300" :hide-after="0" effect="dark" popper-class="compact-tooltip" v-if="row.assignmentUrl && row.assignmentUrl.trim()">
                  <el-icon class="action-icon primary" @click.stop="handleAction('handle', row)">
                    <Position />
                  </el-icon>
                </el-tooltip>
              </template>
              
              <template v-else-if="row.status === 0">
                <el-tooltip content="交办" placement="top" :show-after="300" :hide-after="0" effect="dark" popper-class="compact-tooltip">
                  <el-icon class="action-icon primary" @click.stop="handleAction('assign', row)">
                    <Share />
                  </el-icon>
                </el-tooltip>
                <el-tooltip content="拒绝" placement="top" :show-after="300" :hide-after="0" effect="dark" popper-class="compact-tooltip">
                  <el-icon class="action-icon danger" @click.stop="handleAction('reject', row)">
                    <Close />
                  </el-icon>
                </el-tooltip>
                <el-tooltip content="同意" placement="top" :show-after="300" :hide-after="0" effect="dark" popper-class="compact-tooltip">
                  <el-icon class="action-icon primary" @click.stop="handleAction('accept', row)">
                    <Check />
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
    
    <!-- 完成任务确认对话框 -->
    <CompleteDialog
      v-model="completeDialogVisible"
      :todo-item="currentCompleteItem"
      @confirm="handleCompleteConfirm"
    />
    
    <!-- 延期申请对话框 -->
    <DelayDialog
      v-model="delayDialogVisible"
      :todo-item="currentDelayItem"
      @confirm="handleDelayConfirm"
    />
    
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
      @confirm="handleDetailConfirm"
    />
  </div>
</template>

<script setup name="MyTodo">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Clock, Link, EditPen, Grid, List, Loading, Check, Timer, Share, Position, Close, CircleCheck, SuccessFilled, CircleClose as CircleCloseIcon, User } from '@element-plus/icons-vue'
import CompleteDialog from './components/CompleteDialog.vue'
import DelayDialog from './components/DelayDialog.vue'
import AssignDialog from './components/AssignDialog.vue'
import DetailDialog from './components/DetailDialog.vue'
import ViewSwitcher from '@/components/ViewSwitcher/index.vue'
import { getTodoList, getTodoStatusCount, getTodoDetail, updateTodo, addExtension } from '@/api/todo'

// 路由
const router = useRouter()
const route = useRoute()

// MQTT工具跳转
const goToMqtt = () => {
  router.push('/device/mqtt')
}

const goToMqttTest = () => {
  router.push('/device/mqtt/test')
}

// 基础URL
const baseUrl = import.meta.env.VITE_APP_BASE_API

// 当前时间（用于倒计时更新）
const currentTime = ref(new Date())

// 倒计时定时器
let countdownTimer = null

// 当前选中的标签
const currentTab = ref('all')

// 是否“交我的流程”：route.meta.isMyProcess 或 query.isMyProcess=1
const isMyProcess = computed(() => {
  const current = router.currentRoute.value || route
  const queryVal = current?.query?.isMyProcess
  if (queryVal !== undefined) {
    const num = Number(queryVal)
    return Number.isNaN(num) ? 0 : num
  }
  return current?.meta?.isMyProcess ? 1 : 0
})

// 空状态描述文案
const emptyDescription = '暂无待办事项'

// 视图模式：card 卡片视图，table 表格视图（从localStorage读取）
const viewMode = ref(localStorage.getItem('myTodo_viewMode') || 'card')

// 每行卡片数量（从localStorage读取，默认6个/行）
const cardsPerRow = ref(Number(localStorage.getItem('myTodo_cardsPerRow')) || 6)

// 监听路由 query 参数变化（MQTT 通知跳转到同页面不同 tab 时触发）
watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab && newTab !== currentTab.value) {
      console.log('[MyTodo] 检测到 URL tab 变化:', newTab)
      // 验证 tab 参数是否有效
      const validTabs = ['all', 'pending', 'inProgress', 'completed', 'assigned', 'rejected']
      if (validTabs.includes(newTab)) {
        currentTab.value = newTab
        console.log('[MyTodo] 切换到 tab:', newTab, '并刷新数据')
        // 刷新数据
        fetchStatusCount()
        if (viewMode.value === 'card') {
          pageParams.value.p = 1
          hasMore.value = true
          fetchTodoList()
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
  localStorage.setItem('myTodo_viewMode', newVal)
  // 切换视图时加载对应数据
  if (newVal === 'table') {
    fetchTableData()
  } else {
    // 如果卡片列表为空，重新加载
    if (todoList.value.length === 0) {
      fetchTodoList()
    }
    // 切换到卡片视图时，应用网格设置
    nextTick(() => {
      handleCardsPerRowChange(cardsPerRow.value)
    })
  }
})

// 处理每行卡片数量变化
const handleCardsPerRowChange = (value) => {
  localStorage.setItem('myTodo_cardsPerRow', value)
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

// 标签页配置（按业务流程顺序）
const tabs = ref([
  { key: 'all', label: '全部', count: 0 },
  { key: 'pending', label: '待处理', count: 0 },      // 0 - 新任务，待接收
  { key: 'inProgress', label: '进行中', count: 0 },   // 1 - 正在处理
  { key: 'completed', label: '已完成', count: 0 },    // 2 - 已完成
  { key: 'assigned', label: '已交办', count: 0 },     // -1 - 已转交给他人
  { key: 'rejected', label: '已拒绝', count: 0 }      // -2 - 已拒绝接收
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
  l: 30  // 每页显示的数量
})

// 表格总数
const tableTotal = ref(0)

// 加载状态
const loading = ref(false)

// 滚动条引用
const scrollbarRef = ref(null)

// 待办列表数据
const todoList = ref([])

// 过滤后的待办列表（卡片视图使用）
const filteredTodoList = computed(() => {
  if (currentTab.value === 'all') {
    return todoList.value
  }
  // 状态映射：-2已拒绝 -1已交办 0待处理 1进行中 2已完成
  const statusMap = {
    'rejected': -2,
    'assigned': -1,
    'pending': 0,
    'inProgress': 1,
    'completed': 2
  }
  return todoList.value.filter(item => item.status === statusMap[currentTab.value])
})

// 表格数据（表格视图使用）
const tableData = ref([])

// 获取待办列表
const fetchTodoList = async (isLoadMore = false) => {
  if (loading.value) return
  
  loading.value = true
  try {
    const params = {
      ...pageParams.value,
      isMyProcess: isMyProcess.value
    }
    // 如果不是全部标签，添加状态筛选
    if (currentTab.value !== 'all') {
      const statusMap = {
        'rejected': -2,
        'assigned': -1,
        'pending': 0,
        'inProgress': 1,
        'completed': 2
      }
      params.status = statusMap[currentTab.value]
    }
    
    const res = await getTodoList(params)
    if (res.code === 200) {
      // 转换数据格式
      const newList = res.data.list.map(item => ({
        ...item,  // 保留所有原始字段
        title: item.assignmentTitle,
        description: item.assignmentContent || '',
        deadline: item.dueDate ? new Date(item.dueDate) : null
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
    console.error('获取待办列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 统一刷新列表数据（根据当前视图模式）
const refreshList = async () => {
  if (viewMode.value === 'table') {
    await fetchTableData()
  } else {
    await fetchTodoList()
  }
}

// 获取状态统计
const fetchStatusCount = async () => {
  try {
    const res = await getTodoStatusCount({ isMyProcess: isMyProcess.value })
    if (res.code === 200) {
      const counts = res.data
      tabs.value = [
        { key: 'all', label: '全部', count: counts.total || 0 },
        { key: 'inProgress', label: '进行中', count: counts.inProgress || 0 },
        { key: 'pending', label: '待处理', count: counts.pending || 0 },
        { key: 'completed', label: '已完成', count: counts.completed || 0 },
        { key: 'rejected', label: '已拒绝', count: counts.rejected || 0 },
        { key: 'assigned', label: '已交办', count: counts.assigned || 0 }
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

// 获取倒计时文本（使用 currentTime 实现实时更新）
const getCountdownText = (item) => {
  // 已交办和已拒绝状态不显示预期时间
  if (item.status === -1 || item.status === -2) {
    return ''
  }
  
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
  return `${days > 0 ? `${days}天` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

// 获取倒计时天数（使用 currentTime 实现实时更新）
const getCountdownDays = (item) => {
  if (!item.deadline) return '00'
  const now = currentTime.value  // 使用响应式的当前时间
  const deadline = typeof item.deadline === 'string' ? new Date(item.deadline) : item.deadline
  const diff = deadline - now
  const days = Math.abs(Math.floor(diff / (24 * 60 * 60 * 1000)))
  return String(days).padStart(2, '0')
}

// 获取倒计时小时（使用 currentTime 实现实时更新）
const getCountdownHours = (item) => {
  if (!item.deadline) return '00'
  const now = currentTime.value  // 使用响应式的当前时间
  const deadline = typeof item.deadline === 'string' ? new Date(item.deadline) : item.deadline
  const diff = deadline - now
  const hours = Math.abs(Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)))
  return String(hours).padStart(2, '0')
}

// 获取倒计时分钟（使用 currentTime 实现实时更新）
const getCountdownMinutes = (item) => {
  if (!item.deadline) return '00'
  const now = currentTime.value  // 使用响应式的当前时间
  const deadline = typeof item.deadline === 'string' ? new Date(item.deadline) : item.deadline
  const diff = deadline - now
  const minutes = Math.abs(Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000)))
  return String(minutes).padStart(2, '0')
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
    '0': 'cyan',       // 待处理 - 青色（自定义）
    '1': 'primary',    // 进行中 - 蓝色
    '2': 'success'     // 已完成 - 绿色
  }
  return typeMap[status] || ''
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
  // 已交办和已拒绝状态不显示样式
  if (item.status === -1 || item.status === -2) {
    return ''
  }
  
  // 已完成的任务显示灰色
  if (item.status === 2) {
    return 'completed'
  }
  
  if (!item.deadline) return ''
  
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

// 处理卡片点击
const handleCardClick = (item) => {
  console.log("🚀 ~ file: index.vue:553 ~ item:", item)
  // 列表数据已包含所有需要的字段（assignmentTitle, assignmentContent, assignmentImgs等）
  // 直接使用列表数据，无需再次调用详情接口
  currentDetailItem.value = item
  detailDialogVisible.value = true
}

// 处理操作按钮点击
const handleAction = async (type, item) => {
  console.log('操作类型:', type, '任务:', item)
  
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
    // 如果有办理URL，打开链接；否则提示
    if (item.assignmentUrl && item.assignmentUrl.trim()) {
      // 打开办理URL
      window.open(item.assignmentUrl, '_blank')
    } else {
      // 提示用户没有办理URL
      ElMessage.warning('该任务暂无办理链接')
    }
    return
  }
  
  // 处理同意接收
  if (type === 'accept') {
    try {
      await updateTodo({
        id: item.id,
        status: 1  // 更新状态为进行中
      })
      ElMessage.success('已同意接收')
      // 刷新列表
      await refreshList()
      await fetchStatusCount()
    } catch (error) {
      console.error('同意接收失败:', error)
    }
    return
  }
  
  // 处理拒绝任务
  if (type === 'reject') {
    try {
      await updateTodo({
        id: item.id,
        status: -2,  // 更新状态为已拒绝
        rejectReason: '拒绝接收'  // 可以添加拒绝原因
      })
      ElMessage.success('已拒绝任务')
      // 刷新列表
      await refreshList()
      await fetchStatusCount()
    } catch (error) {
      console.error('拒绝任务失败:', error)
    }
    return
  }
}

// 确认完成任务
const handleCompleteConfirm = async ({ item, completionNote }) => {
  try {
    // 格式化完成时间为 yyyy-MM-dd HH:mm:ss
    const formatFinishTime = () => {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const seconds = String(now.getSeconds()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    }
    
    // 调用完成任务接口
    await updateTodo({
      id: item.id,
      status: 2, // 已完成
      completionNote: completionNote || '', // 完成说明（可选）
      finishTime: formatFinishTime()
    })
    
    ElMessage.success('任务已完成')
    // 刷新列表
    await refreshList()
    await fetchStatusCount()
  } catch (error) {
    console.error('完成任务失败:', error)
  }
}

// 确认延期申请
const handleDelayConfirm = async ({ item, delayedDateTime, delayType }) => {
  try {
    // 格式化原截止时间
    const formatDate = (date) => {
      if (!date) return ''
      const d = new Date(date)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      const seconds = String(d.getSeconds()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    }
    
    // 调用延期申请接口
    await addExtension({
      todoId: item.id,
      assignmentId: item.assignmentId,
      originalDueDate: formatDate(item.deadline),  // 原截止时间（使用deadline字段）
      newDueDate: delayedDateTime,                  // 新截止时间
      extensionReason: `申请延期至 ${delayedDateTime}`,  // 延期原因
      applyState: 1  // 申请状态：1-申请中
    })
    
    ElMessage.success('延期申请已提交')
    
    // 刷新列表和状态统计
    await refreshList()
    await fetchStatusCount()
  } catch (error) {
    console.error('延期申请失败:', error)
  }
}

// 确认交办任务
const handleAssignConfirm = async ({ item, userId, userName }) => {
  try {
    // 调用交办任务接口
    await updateTodo({
      id: item.id,
      status: -1, // 已交办
      nextAssignee: userName  // 传入用户名而不是用户ID
    })
    
    ElMessage.success('任务已交办')
    // 刷新列表
    await refreshList()
    await fetchStatusCount()
  } catch (error) {
    console.error('交办任务失败:', error)
  }
}

// 确认任务详情
const handleDetailConfirm = async ({ item, description, images }) => {
  try {
    // 更新任务详情
    console.log('更新任务详情:', item.id, description, images)
    ElMessage.success('任务详情已更新')
  } catch (error) {
    console.error('更新任务详情失败:', error)
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
  await fetchTodoList(true)
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
    fetchTodoList()
  } else {
    fetchTableData()
  }
}

// 处理筛选条件变化
const handleFilterChange = () => {
  tablePageParams.value.p = 1  // 重置到第一页
  fetchTableData()
}

// 监听“交我的流程”切换，重置并重新拉取数据
watch(isMyProcess, () => {
  currentTab.value = 'all'
  pageParams.value.p = 1
  tablePageParams.value.p = 1
  hasMore.value = true
  todoList.value = []
  tableData.value = []
  if (viewMode.value === 'table') {
    fetchTableData()
  } else {
    fetchTodoList()
  }
  fetchStatusCount()
})

// 获取表格数据
const fetchTableData = async () => {
  loading.value = true
  try {
    const params = {
      p: tablePageParams.value.p,
      l: tablePageParams.value.l,
      isMyProcess: isMyProcess.value
    }
    // 如果不是全部标签，添加状态筛选
    if (currentTab.value !== 'all') {
      const statusMap = {
        'rejected': -2,
        'assigned': -1,
        'pending': 0,
        'inProgress': 1,
        'completed': 2
      }
      params.status = statusMap[currentTab.value]
    }
    
    const res = await getTodoList(params)
    if (res.code === 200) {
      // 转换数据格式
      tableData.value = res.data.list.map(item => ({
        ...item,  // 保留所有原始字段
        title: item.assignmentTitle,
        description: item.assignmentContent || '',
        deadline: item.dueDate ? new Date(item.dueDate) : null
      }))
      tableTotal.value = res.data.total
    }
  } catch (error) {
    console.error('获取待办列表失败:', error)
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
    const validTabs = ['all', 'pending', 'inProgress', 'completed', 'assigned', 'rejected']
    if (validTabs.includes(tabParam)) {
      currentTab.value = tabParam
      console.log('[MyTodo] 从 URL 切换到 tab:', tabParam)
    }
  }
  
  // 根据当前视图模式加载对应数据
  if (viewMode.value === 'table') {
    fetchTableData()
  } else {
    fetchTodoList()
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
    window.$eventBus.on('refresh-todo-list', () => {
      console.log('[MyTodo] 收到 MQTT 刷新事件，重新加载数据')
      // 刷新统计数据
      fetchStatusCount()
      // 根据当前视图模式刷新列表
      if (viewMode.value === 'card') {
        // 卡片视图：重置分页并重新加载
        pageParams.value.p = 1
        hasMore.value = true
        fetchTodoList()
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
    window.$eventBus.off('refresh-todo-list')
  }
})
</script>

<style lang="scss" scoped>
.todo-page {
  /* 使用窗口滚动，避免内层容器阻断 sticky */
  min-height: calc(100vh - 54px);
  background: linear-gradient(90deg, #f2f3f5 0%, #f2f3f5 100%);
  padding:10px;
}

// 头部区域
.todo-header {
  /* 页面级吸顶（随窗口滚动），tabs 固定不随列表滚动 */
  position: sticky;
  top: 10px;
  z-index: 100;
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

// 视图切换组件容器（已移至独立组件）

// MQTT工具快速入口
.mqtt-tools {
  display: flex;
  gap: 10px;
  margin-left: auto;
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
  min-height: 400px;
  padding-bottom: 20px;
  
  // 空数据展示居中
  :deep(.el-empty) {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 0;
    height:calc(100vh - 144px);
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
  height: 225px;
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
  align-items: flex-start;
  margin-bottom: 14px;
}

.card-title {
  font-size: 15px;
  font-weight: 500;
  color: #394047;
}

.countdown {
  font-size: 14px;
  
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
  height: 90px;
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
  font-size: 14px;
  color: #6c747c;
  margin: 0 0 8px 0;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
}

.card-footer-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: auto;
  flex-wrap: wrap;
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

.card-assignor {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #409eff;
  
  .el-icon {
    font-size: 14px;
  }
  
  span {
    font-weight: 500;
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
      background: #2e74ff;
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
    
    // 待处理状态的青色标签样式（自定义 cyan 类型）
    .el-tag--cyan {
      background-color: #e0f7fa !important;
      border-color: #00bcd4 !important;
      color: #00838f !important;
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

// 响应式设计
@media (max-width: 1600px) {
  .todo-list {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 1200px) {
  .todo-list {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .todo-tabs {
    gap: 30px;
  }
  
  .todo-header {
    padding: 0 20px;
  }
}

@media (max-width: 768px) {
  .todo-list {
    grid-template-columns: 1fr;
  }
  
  .todo-tabs {
    gap: 20px;
    font-size: 14px;
  }
  
  .card-actions {
    flex-wrap: wrap;
  }
}
</style>
