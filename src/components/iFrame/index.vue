<template>
  <div :style="'height:' + height">
    <iframe 
      :src="url" 
      frameborder="no" 
      style="width: 100%; height: 100%" 
      scrolling="auto" />
  </div>
</template>

<script setup>
const props = defineProps({
  src: {
    type: String,
    required: true
  }
})

const height = ref(document.documentElement.clientHeight - 94.5 + "px;")
const url = computed(() => props.src)

onMounted(() => {
  window.onresize = function temp() {
    height.value = document.documentElement.clientHeight - 94.5 + "px;"
  }
})
</script>
