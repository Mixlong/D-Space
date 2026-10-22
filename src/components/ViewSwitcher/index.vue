<template>
  <div class="view-switcher">
    <el-radio-group v-model="currentViewMode">
      <!-- 卡片视图按钮（带下拉菜单） -->
      <el-dropdown 
        v-if="currentViewMode === 'card'"
        trigger="hover"
        placement="bottom"
        @command="handleCardsPerRowChange"
      >
        <el-radio-button value="card" class="card-view-btn">
          <el-icon><Grid /></el-icon>
          卡片
        </el-radio-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item :command="3" :class="{ 'is-active': currentCardsPerRow === 3 }">
              3个/行
            </el-dropdown-item>
            <el-dropdown-item :command="4" :class="{ 'is-active': currentCardsPerRow === 4 }">
              4个/行
            </el-dropdown-item>
            <el-dropdown-item :command="5" :class="{ 'is-active': currentCardsPerRow === 5 }">
              5个/行
            </el-dropdown-item>
            <el-dropdown-item :command="6" :class="{ 'is-active': currentCardsPerRow === 6 }">
              6个/行
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      
      <!-- 普通卡片按钮（非卡片视图时） -->
      <el-radio-button v-else value="card">
        <el-icon><Grid /></el-icon>
        卡片
      </el-radio-button>
      
      <el-radio-button value="table">
        <el-icon><List /></el-icon>
        表格
      </el-radio-button>
    </el-radio-group>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { Grid, List } from '@element-plus/icons-vue'

const props = defineProps({
  // 视图模式
  viewMode: {
    type: String,
    default: 'card'
  },
  // 每行卡片数量
  cardsPerRow: {
    type: Number,
    default: 6
  },
  // localStorage 键名前缀（用于区分不同页面）
  storagePrefix: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:viewMode', 'update:cardsPerRow', 'cardsPerRowChange'])

// 当前视图模式
const currentViewMode = computed({
  get: () => props.viewMode,
  set: (val) => emit('update:viewMode', val)
})

// 当前每行卡片数量
const currentCardsPerRow = computed({
  get: () => props.cardsPerRow,
  set: (val) => emit('update:cardsPerRow', val)
})

// 处理每行卡片数量变化
const handleCardsPerRowChange = (value) => {
  // 保存到 localStorage
  localStorage.setItem(`${props.storagePrefix}_cardsPerRow`, value)
  
  // 更新父组件的值
  currentCardsPerRow.value = value
  
  // 触发自定义事件，让父组件处理网格布局
  emit('cardsPerRowChange', value)
}

// 监听视图模式变化，保存到 localStorage
watch(currentViewMode, (newVal) => {
  localStorage.setItem(`${props.storagePrefix}_viewMode`, newVal)
})
</script>

<style lang="scss" scoped>
.view-switcher {
  :deep(.el-radio-button__inner) {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 15px;
  }
}

.card-view-btn {
  :deep(.el-radio-button__inner) {
    border-radius: var(--el-border-radius-base) 0 0 var(--el-border-radius-base) !important;
  }
}
</style>
