<script setup lang="ts">
defineProps<{
  visible: boolean
  theme: 'light' | 'dark'
  current: number
  total: number
  fileName: string
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay">
      <div class="dialog-panel" :data-theme="theme" @click.stop>
        <h3 class="dialog-title">正在导出 PDF</h3>
        <p class="dialog-message">正在导出第 {{ current }} 个文件，共 {{ total }} 个文件</p>
        <p class="dialog-file">{{ fileName }}</p>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${total > 0 ? (current / total) * 100 : 0}%` }" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
}

.dialog-panel {
  width: 400px;
  padding: 20px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.dialog-panel[data-theme='dark'] {
  background: #2d2d2d;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.dialog-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.dialog-panel[data-theme='dark'] .dialog-title {
  color: #e5e7eb;
}

.dialog-message {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #4b5563;
}

.dialog-panel[data-theme='dark'] .dialog-message {
  color: #9ca3af;
}

.dialog-file {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: #6b7280;
  word-break: break-all;
}

.dialog-panel[data-theme='dark'] .dialog-file {
  color: #d1d5db;
}

.progress-bar {
  height: 6px;
  margin-top: 16px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
}

.dialog-panel[data-theme='dark'] .progress-bar {
  background: #3c3c3c;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: #3b82f6;
  transition: width 0.2s ease;
}
</style>
