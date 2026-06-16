<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import FileNameDialog from './FileNameDialog.vue'

export interface TreeEntry {
  name: string
  path: string
  type: 'file' | 'directory'
}

const props = defineProps<{
  entry: TreeEntry
  depth: number
  theme: 'light' | 'dark'
  activeFilePath: string | null
}>()

const emit = defineEmits<{
  openFile: [filePath: string]
  fileCreated: [filePath: string, content: string]
}>()

const expanded = ref(false)
const loaded = ref(false)
const children = ref<TreeEntry[]>([])
const loading = ref(false)
const menuVisible = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const dialogVisible = ref(false)
const selected = ref(false)

async function loadChildren(): Promise<void> {
  if (props.entry.type !== 'directory') return

  loading.value = true
  try {
    children.value = await window.fileApi.readNotebookDir(props.entry.path)
    loaded.value = true
  } finally {
    loading.value = false
  }
}

async function expandFolder(): Promise<void> {
  if (props.entry.type !== 'directory' || expanded.value) return
  await loadChildren()
  expanded.value = true
}

async function toggleExpand(): Promise<void> {
  if (props.entry.type !== 'directory') return

  if (!expanded.value) {
    await expandFolder()
    return
  }

  expanded.value = false
}

function handleClick(): void {
  if (props.entry.type === 'file') {
    emit('openFile', props.entry.path)
    return
  }

  selected.value = true
  void expandFolder()
}

function closeMenu(): void {
  menuVisible.value = false
}

function handleContextMenu(event: MouseEvent): void {
  if (props.entry.type !== 'directory') return

  event.preventDefault()
  selected.value = true
  void expandFolder()
  menuX.value = event.clientX
  menuY.value = event.clientY
  menuVisible.value = true
}

function openCreateDialog(): void {
  closeMenu()
  dialogVisible.value = true
}

async function handleCreateConfirm(name: string): Promise<void> {
  dialogVisible.value = false

  try {
    const result = await window.fileApi.createNotebookFile(props.entry.path, name)
    if (!expanded.value) {
      expanded.value = true
    }
    await loadChildren()
    emit('fileCreated', result.filePath, result.content)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('FILE_EXISTS')) {
      alert('文件已存在')
      return
    }
    alert('创建文件失败')
  }
}

function handleDocumentClick(): void {
  closeMenu()
  selected.value = false
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div class="tree-node">
    <div
      class="tree-row"
      :data-theme="theme"
      :class="{
        active: entry.type === 'file' && entry.path === activeFilePath,
        selected: entry.type === 'directory' && selected,
        directory: entry.type === 'directory'
      }"
      :style="{ paddingLeft: `${depth * 14 + 8}px` }"
      :title="entry.path"
      @click="handleClick"
      @contextmenu="handleContextMenu"
    >
      <span class="tree-arrow" @click.stop="toggleExpand">
        <template v-if="entry.type === 'directory'">{{ expanded ? '▼' : '▶' }}</template>
        <template v-else> </template>
      </span>
      <span class="tree-icon">{{ entry.type === 'directory' ? '📁' : '📄' }}</span>
      <span class="tree-name">{{ entry.name }}</span>
    </div>

    <Teleport to="body">
      <div
        v-if="menuVisible && entry.type === 'directory'"
        class="context-menu"
        :data-theme="theme"
        :style="{ left: `${menuX}px`, top: `${menuY}px` }"
        @mousedown.stop
      >
        <button type="button" @click="openCreateDialog">新建文件</button>
      </div>
    </Teleport>

    <FileNameDialog
      :visible="dialogVisible"
      :theme="theme"
      default-name="untitled.md"
      @confirm="handleCreateConfirm"
      @cancel="dialogVisible = false"
    />

    <div v-if="expanded && entry.type === 'directory'">
      <div v-if="loading" class="tree-loading" :style="{ paddingLeft: `${(depth + 1) * 14 + 8}px` }">
        加载中...
      </div>
      <TreeNode
        v-for="child in children"
        :key="child.path"
        :entry="child"
        :depth="depth + 1"
        :theme="theme"
        :active-file-path="activeFilePath"
        @open-file="emit('openFile', $event)"
        @file-created="(path, content) => emit('fileCreated', path, content)"
      />
    </div>
  </div>
</template>

<style scoped>
.tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 4px;
  padding-bottom: 4px;
  padding-right: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  user-select: none;
}

.tree-row:hover {
  background: rgba(0, 0, 0, 0.04);
}

.tree-row.active {
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
}

.tree-row.selected {
  background: rgba(59, 130, 246, 0.08);
}

.tree-row[data-theme='dark'] {
  color: #d1d5db;
}

.tree-row[data-theme='dark']:hover {
  background: rgba(255, 255, 255, 0.06);
}

.tree-row[data-theme='dark'].active {
  background: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
}

.tree-row[data-theme='dark'].selected {
  background: rgba(59, 130, 246, 0.15);
}

.tree-arrow {
  width: 12px;
  font-size: 9px;
  color: #9ca3af;
  flex-shrink: 0;
}

.tree-icon {
  flex-shrink: 0;
  font-size: 12px;
}

.tree-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-loading {
  font-size: 12px;
  color: #9ca3af;
  padding-top: 4px;
  padding-bottom: 4px;
}

.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 120px;
  padding: 4px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.context-menu[data-theme='dark'] {
  border-color: #3c3c3c;
  background: #2d2d2d;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.context-menu button {
  display: block;
  width: 100%;
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  text-align: left;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}

.context-menu button:hover {
  background: #f3f4f6;
}

.context-menu[data-theme='dark'] button {
  color: #e5e7eb;
}

.context-menu[data-theme='dark'] button:hover {
  background: #3c3c3c;
}
</style>
