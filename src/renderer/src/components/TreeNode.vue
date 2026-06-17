<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import FileNameDialog from './FileNameDialog.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { exportNotebookFileToPdf } from '../pdfExport'
import { toNotebookRelativePath } from '../notebookPath'

export interface TreeEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  editable?: boolean
}

const props = defineProps<{
  entry: TreeEntry
  depth: number
  theme: 'light' | 'dark'
  activeFilePath: string | null
  notebookRoot: string
}>()

const emit = defineEmits<{
  openFile: [filePath: string]
  fileCreated: [filePath: string, content: string]
  itemDeleted: [itemPath: string]
}>()

const expanded = ref(false)
const loaded = ref(false)
const children = ref<TreeEntry[]>([])
const loading = ref(false)
const menuVisible = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const dialogVisible = ref(false)
const dialogType = ref<'file' | 'folder'>('file')
const deleteDialogVisible = ref(false)
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
    if (props.entry.editable === false) return
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
  event.preventDefault()
  if (props.entry.type === 'directory') {
    selected.value = true
    void expandFolder()
  }
  menuX.value = event.clientX
  menuY.value = event.clientY
  menuVisible.value = true
}

function showInExplorer(): void {
  closeMenu()
  void window.fileApi.showInExplorer(props.entry.path)
}

async function exportPdf(): Promise<void> {
  if (props.entry.type !== 'file' || props.entry.editable === false) return

  closeMenu()

  const nameOrPath =
    toNotebookRelativePath(props.notebookRoot, props.entry.path) || props.entry.name

  await exportNotebookFileToPdf(nameOrPath)
}

function openCreateFileDialog(): void {
  closeMenu()
  dialogType.value = 'file'
  dialogVisible.value = true
}

function openCreateFolderDialog(): void {
  closeMenu()
  dialogType.value = 'folder'
  dialogVisible.value = true
}

function openDeleteDialog(): void {
  closeMenu()
  deleteDialogVisible.value = true
}

const deleteConfirmMessage = computed(() => {
  if (props.entry.type === 'directory') {
    return `确定删除文件夹「${props.entry.name}」及其全部内容吗？此操作不可恢复。`
  }
  return `确定删除文件「${props.entry.name}」吗？此操作不可恢复。`
})

async function handleDeleteConfirm(): Promise<void> {
  deleteDialogVisible.value = false

  try {
    await window.fileApi.deleteNotebookEntry(props.entry.path)
    emit('itemDeleted', props.entry.path)
  } catch {
    alert('删除失败')
  }
}

function handleCreateError(error: unknown, type: 'file' | 'folder'): void {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('ALREADY_EXISTS') || message.includes('FILE_EXISTS')) {
    alert(type === 'file' ? '文件已存在' : '文件夹已存在')
    return
  }
  alert(type === 'file' ? '创建文件失败' : '创建文件夹失败')
}

async function handleCreateConfirm(name: string): Promise<void> {
  dialogVisible.value = false

  try {
    if (dialogType.value === 'file') {
      const result = await window.fileApi.createNotebookFile(props.entry.path, name)
      if (!expanded.value) {
        expanded.value = true
      }
      await loadChildren()
      emit('fileCreated', result.filePath, result.content)
      return
    }

    await window.fileApi.createNotebookFolder(props.entry.path, name)
    if (!expanded.value) {
      expanded.value = true
    }
    await loadChildren()
  } catch (error) {
    handleCreateError(error, dialogType.value)
  }
}

async function handleChildDeleted(itemPath: string): Promise<void> {
  if (expanded.value) {
    await loadChildren()
  }
  emit('itemDeleted', itemPath)
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
        active: entry.type === 'file' && entry.editable !== false && entry.path === activeFilePath,
        selected: entry.type === 'directory' && selected,
        directory: entry.type === 'directory',
        'non-editable': entry.type === 'file' && entry.editable === false
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
        v-if="menuVisible"
        class="context-menu"
        :data-theme="theme"
        :style="{ left: `${menuX}px`, top: `${menuY}px` }"
        @mousedown.stop
      >
        <template v-if="entry.type === 'directory'">
          <button type="button" @click="openCreateFileDialog">新建文件</button>
          <button type="button" @click="openCreateFolderDialog">新建文件夹</button>
          <div class="context-menu-divider" />
        </template>
        <template v-if="entry.type === 'file' && entry.editable !== false">
          <button type="button" @mousedown.stop @click.stop="exportPdf">导出 PDF</button>
          <div class="context-menu-divider" />
        </template>
        <button type="button" @click="showInExplorer">资源管理器展示</button>
        <div class="context-menu-divider" />
        <button type="button" class="menu-danger" @click="openDeleteDialog">删除</button>
      </div>
    </Teleport>

    <ConfirmDialog
      :visible="deleteDialogVisible"
      :theme="theme"
      title="确认删除"
      :message="deleteConfirmMessage"
      confirm-text="删除"
      danger
      @confirm="handleDeleteConfirm"
      @cancel="deleteDialogVisible = false"
    />

    <FileNameDialog
      :visible="dialogVisible"
      :theme="theme"
      :title="dialogType === 'file' ? '新建文件' : '新建文件夹'"
      :default-name="dialogType === 'file' ? 'untitled.md' : '新建文件夹'"
      :placeholder="dialogType === 'file' ? '文件名，如 notes.md' : '文件夹名称'"
      :name-label="dialogType === 'file' ? '文件名' : '文件夹名'"
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
        :notebook-root="notebookRoot"
        @open-file="emit('openFile', $event)"
        @file-created="(path, content) => emit('fileCreated', path, content)"
        @item-deleted="handleChildDeleted"
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

.tree-row.non-editable {
  color: #9ca3af;
  cursor: default;
}

.tree-row.non-editable:hover {
  background: rgba(0, 0, 0, 0.02);
}

.tree-row[data-theme='dark'].non-editable {
  color: #6b7280;
}

.tree-row[data-theme='dark'].non-editable:hover {
  background: rgba(255, 255, 255, 0.03);
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

.context-menu-divider {
  height: 1px;
  margin: 4px 6px;
  background: #e5e7eb;
}

.context-menu[data-theme='dark'] .context-menu-divider {
  background: #3c3c3c;
}

.context-menu button.menu-danger {
  color: #ef4444;
}

.context-menu button.menu-danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.context-menu[data-theme='dark'] button.menu-danger:hover {
  background: rgba(239, 68, 68, 0.15);
}
</style>
