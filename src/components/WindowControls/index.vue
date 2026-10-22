<template>
  <div class="window-controls" style="-webkit-app-region: no-drag;">
    <button class="window-btn minimize-btn" @click="minimizeWindow" title="最小化">
      <svg width="10" height="1" viewBox="0 0 10 1">
        <rect fill="currentColor" width="10" height="1"/>
      </svg>
    </button>
    <button class="window-btn maximize-btn" @click="maximizeWindow" title="最大化/还原">
      <svg width="10" height="10" viewBox="0 0 10 10">
        <rect x="0" y="0" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1"/>
      </svg>
    </button>
    <button class="window-btn close-btn" @click="closeWindow" title="关闭">
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path fill="currentColor" d="M0,0 L10,10 M10,0 L0,10" stroke="currentColor" stroke-width="1"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
function minimizeWindow() {
  if (window.electronAPI && window.electronAPI.minimizeWindow) {
    window.electronAPI.minimizeWindow()
  }
}

function maximizeWindow() {
  if (window.electronAPI && window.electronAPI.maximizeWindow) {
    window.electronAPI.maximizeWindow()
  }
}

function closeWindow() {
  if (window.electronAPI && window.electronAPI.closeWindow) {
    window.electronAPI.closeWindow()
  }
}
</script>

<style lang="scss" scoped>
.window-controls {
  display: flex;
  align-items: center;
  height: 100%;

  .window-btn {
    width: 46px;
    height: 100%;
    border: none;
    background: transparent;
    color: currentColor;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;

    &:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    &.close-btn:hover {
      background: #e81123;
      color: white;
    }

    svg {
      display: block;
    }
  }
}
</style>

