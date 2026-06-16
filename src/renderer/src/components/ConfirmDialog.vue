<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  theme: 'light' | 'dark'
  title?: string
  message: string
  confirmText?: string
  danger?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

function handleConfirm(): void {
  emit('confirm')
}

function handleCancel(): void {
  emit('cancel')
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    handleConfirm()
  } else if (event.key === 'Escape') {
    handleCancel()
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
      <div class="dialog-panel" :data-theme="theme" @click.stop @keydown="handleKeydown">
        <h3 class="dialog-title">{{ title ?? '确认' }}</h3>
        <p class="dialog-message">{{ message }}</p>
        <div class="dialog-actions">
          <button type="button" class="btn-cancel" @click="handleCancel">取消</button>
          <button
            type="button"
            class="btn-confirm"
            :class="{ 'btn-danger': danger }"
            @click="handleConfirm"
          >
            {{ confirmText ?? '确定' }}
          </button>
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
  width: 360px;
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
  word-break: break-all;
}

.dialog-panel[data-theme='dark'] .dialog-message {
  color: #9ca3af;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.dialog-actions button {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.btn-cancel {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
}

.dialog-panel[data-theme='dark'] .btn-cancel {
  border-color: #4b5563;
  background: #1e1e1e;
  color: #e5e7eb;
}

.btn-confirm {
  border: none;
  background: #3b82f6;
  color: #fff;
}

.btn-confirm:hover {
  background: #2563eb;
}

.btn-confirm.btn-danger {
  background: #ef4444;
}

.btn-confirm.btn-danger:hover {
  background: #dc2626;
}
</style>
