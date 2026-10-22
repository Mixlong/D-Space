<template>
  <section class="app-main">
    <!-- 迪太云组件：独立渲染，使用 v-show 避免 DOM 重新挂载 -->
    <!-- :key 用于完全重置组件（销毁重建），由 reset-ditai-cloud 事件触发 -->
      <DiTaiCloud
        v-if="cloudEverMounted"
        v-show="isCloudRoute"
        :key="cloudKey"
        class="cloud-container"
      />

    <!-- 文档流程组件：独立渲染，使用 v-show 避免 iframe 重载 -->
      <DocumentProcess
        v-if="docEverMounted"
        v-show="isDocRoute"
        :key="docKey"
        class="doc-container"
      />

    <!-- 其他路由组件 -->
    <div v-show="!isCloudRoute && !isDocRoute">
      <router-view  v-slot="{ Component, route }" >
          <keep-alive :include="tagsViewStore.cachedViews">
            <component v-if="!route.meta.link" :is="Component" :key="route.name"/>
          </keep-alive>
      </router-view>
    </div>

    <iframe-toggle />
    <copyright />
  </section>
</template>

<script setup>
import copyright from "./Copyright/index"
import iframeToggle from "./IframeToggle/index"
import DiTaiCloud from '@/views/cloud/DiTaiCloud/index.vue'
import DocumentProcess from '@/views/cloud/DocumentProcess/index.vue'
import useTagsViewStore from '@/store/modules/tagsView'

const route = useRoute()
const tagsViewStore = useTagsViewStore()

// 控制迪太云组件的显示
const cloudEverMounted = ref(false)
// :key，递增即可强制销毁重建子组件（用于"完全重置"场景）
const cloudKey = ref(0)
const isCloudRoute = computed(() => {
  const isCloud = route.name === 'DiTaiCloud' || route.path.includes('/ditai-cloud')
  return isCloud
})

// 控制文档流程组件的显示
const docEverMounted = ref(false)
const docKey = ref(0)
const isDocRoute = computed(() => {
  const isDoc = route.name === 'DocumentProcess' || route.path.includes('/document-process')
  return isDoc
})

// 完全重置 iframe 组件（销毁 + 重建）
// 与 refresh-* 事件不同：refresh-* 只重新加载 iframe 内嵌站点，父组件状态保留；
// reset-* 会让组件销毁重建，连父组件的 isLoading / retryCount / cacheBustToken 等都归零。
const handleResetCloud = () => {
  console.log('[AppMain] 🔁 完全重置 DiTaiCloud 组件')
  cloudKey.value++
}
const handleResetDoc = () => {
  console.log('[AppMain] 🔁 完全重置 DocumentProcess 组件')
  docKey.value++
}

// 监听路由，首次进入迪太云时挂载组件
watch(isCloudRoute, (val) => {
  if (val) {
    cloudEverMounted.value = true
    console.log('[AppMain] ✅ DiTaiCloud 组件已挂载（永久保留）')
  }
}, { immediate: true })

// 监听路由，首次进入文档流程时挂载组件
watch(isDocRoute, (val) => {
  if (val) {
    docEverMounted.value = true
    console.log('[AppMain] ✅ DocumentProcess 组件已挂载（永久保留）')
  }
}, { immediate: true })

// 调试：监听缓存列表变化
watch(() => tagsViewStore.cachedViews, (newVal) => {
  console.log('[AppMain] 📋 当前缓存的组件列表:', newVal)
}, { immediate: true })

onMounted(() => {
  cacheCurrentView()
  addIframe()

  // 监听"完全重置"事件（由 tab.refreshPage 在 iframe 路由上派发）
  window.addEventListener('reset-ditai-cloud', handleResetCloud)
  window.addEventListener('reset-document-process', handleResetDoc)
})

onBeforeUnmount(() => {
  window.removeEventListener('reset-ditai-cloud', handleResetCloud)
  window.removeEventListener('reset-document-process', handleResetDoc)
})

watch(() => route.fullPath, () => {
  cacheCurrentView()
  addIframe()
})

function cacheCurrentView() {
  if (!route.name) return
  tagsViewStore.addView(route)
}

function addIframe() {
  if (route.meta.link) {
    useTagsViewStore().addIframeView(route)
  }
}
</script>

<style lang="scss" scoped>
.app-main {
  /* 50= navbar  50  */
  min-height: calc(100vh - 50px);
  width: 100%;
  position: relative;
  overflow: hidden;
}

.fixed-header + .app-main {
  overflow-y: auto;
  scrollbar-gutter: auto;
  height: calc(100vh - 54px);
  min-height: 0px;
}

.app-main:has(.copyright) {
  padding-bottom: 36px;
}

.cloud-container,
.doc-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

.fixed-header + .app-main {
  margin-top: 54px;
}

.hasTagsView {
  .app-main {
    /* 84 = navbar + tags-view = 50 + 34 */
    // min-height: calc(100vh - 84px);
    min-height: calc(100vh - 50px);
  }

  .fixed-header + .app-main {
    // margin-top: 84px;
    // height: calc(100vh - 84px);
    height: calc(100vh - 50px);
    min-height: 0px;
  }
}
</style>

<style lang="scss">
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background-color: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background-color: #c0c0c0;
  border-radius: 3px;
}
</style>
