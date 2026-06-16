<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  visible: boolean
  title?: string
  defaultName?: string
  placeholder?: string
  nameLabel?: string
  theme: 'light' | 'dark'
}>()

const emit = defineEmits<{
  confirm: [name: string]
  cancel: []
}>()

const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const errorMessage = ref('')

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return
    inputValue.value = props.defaultName ?? 'untitled.md'
    errorMessage.value = ''
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  }
)

watch(inputValue, () => {
  if (errorMessage.value) {
    errorMessage.value = ''
  }
})

function validateName(name: string): string | null {
  const label = props.nameLabel ?? '文件名'
  if (!name) {
    return `${label}不能为空`
  }
  if (/[\\/:*?"<>|]/.test(name)) {
    return `${label}不能包含 \\ / : * ? " < > | 等字符`
  }
  return null
}

function handleConfirm(): void {
  const name = inputValue.value.trim()
  const error = validateName(name)
  if (error) {
    errorMessage.value = error
    inputRef.value?.focus()
    return
  }
  emit('confirm', name)
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
      <div class="dialog-panel" :data-theme="theme" @click.stop>
        <h3 class="dialog-title">{{ title ?? '新建文件' }}</h3>
        <input
          ref="inputRef"
          v-model="inputValue"
          class="dialog-input"
          :class="{ 'dialog-input-error': errorMessage }"
          type="text"
          :placeholder="placeholder ?? '文件名，如 notes.md'"
          @keydown="handleKeydown"
        />
        <p v-if="errorMessage" class="dialog-error">{{ errorMessage }}</p>
        <div class="dialog-actions">
          <button type="button" class="btn-cancel" @click="handleCancel">取消</button>
          <button
            type="button"
            class="btn-confirm"
            :disabled="!inputValue.trim()"
            @click="handleConfirm"
          >
            确定
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
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.dialog-panel[data-theme='dark'] .dialog-title {
  color: #e5e7eb;
}

.dialog-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
}

.dialog-input:focus {
  border-color: #3b82f6;
}

.dialog-input-error {
  border-color: #ef4444;
}

.dialog-input-error:focus {
  border-color: #ef4444;
}

.dialog-error {
  margin: 8px 0 0;
  font-size: 12px;
  color: #ef4444;
}

.dialog-panel[data-theme='dark'] .dialog-input {
  border-color: #4b5563;
  background: #1e1e1e;
  color: #e5e7eb;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
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

.btn-confirm:hover:not(:disabled) {
  background: #2563eb;
}

.btn-confirm:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}
</style>
