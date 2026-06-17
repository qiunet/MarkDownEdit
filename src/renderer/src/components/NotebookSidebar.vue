<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import TreeNode, { type TreeEntry } from './TreeNode.vue'
import FileNameDialog from './FileNameDialog.vue'

const props = defineProps<{
  root: string
  activeFilePath: string | null
  theme: 'light' | 'dark'
}>()

const emit = defineEmits<{
  openFile: [filePath: string, content: string]
  collapse: []
  itemDeleted: [itemPath: string]
}>()

const rootEntries = ref<TreeEntry[]>([])
const loading = ref(false)
const rootMenuVisible = ref(false)
const rootMenuX = ref(0)
const rootMenuY = ref(0)
const rootDialogVisible = ref(false)
const rootDialogType = ref<'file' | 'folder'>('file')

async function loadRoot(): Promise<void> {
  loading.value = true
  try {
    rootEntries.value = await window.fileApi.readNotebookDir(props.root)
  } finally {
    loading.value = false
  }
}

function refresh(): void {
  void loadRoot()
}

function closeRootMenu(): void {
  rootMenuVisible.value = false
}

function handleRootContextMenu(event: MouseEvent): void {
  event.preventDefault()
  rootMenuX.value = event.clientX
  rootMenuY.value = event.clientY
  rootMenuVisible.value = true
}

function handleCreateError(error: unknown, type: 'file' | 'folder'): void {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('ALREADY_EXISTS') || message.includes('FILE_EXISTS')) {
    alert(type === 'file' ? '文件已存在' : '文件夹已存在')
    return
  }
  alert(type === 'file' ? '创建文件失败' : '创建文件夹失败')
}

async function handleCreateAtRoot(name: string): Promise<void> {
  rootDialogVisible.value = false

  try {
    if (rootDialogType.value === 'file') {
      const result = await window.fileApi.createNotebookFile(props.root, name)
      refresh()
      emit('openFile', result.filePath, result.content)
      return
    }

    await window.fileApi.createNotebookFolder(props.root, name)
    refresh()
  } catch (error) {
    handleCreateError(error, rootDialogType.value)
  }
}

function openRootCreateFileDialog(): void {
  closeRootMenu()
  rootDialogType.value = 'file'
  rootDialogVisible.value = true
}

function openRootCreateFolderDialog(): void {
  closeRootMenu()
  rootDialogType.value = 'folder'
  rootDialogVisible.value = true
}

function showRootInExplorer(): void {
  closeRootMenu()
  void window.fileApi.showInExplorer(props.root)
}

async function handleOpenFile(filePath: string): Promise<void> {
  const result = await window.fileApi.readNotebookFile(filePath)
  emit('openFile', result.filePath, result.content)
}

function handleFileCreated(filePath: string, content: string): void {
  emit('openFile', filePath, content)
}

function handleItemDeleted(itemPath: string): void {
  refresh()
  emit('itemDeleted', itemPath)
}

defineExpose({ refresh })

watch(
  () => props.root,
  () => {
    void loadRoot()
  },
  { immediate: true }
)

onMounted(() => {
  document.addEventListener('click', closeRootMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeRootMenu)
})
</script>

<template>
  <aside class="notebook-sidebar" :data-theme="theme">
    <div class="sidebar-header">
      <span class="sidebar-title">笔记本</span>
      <div class="sidebar-actions">
        <button type="button" class="btn-refresh" title="刷新" @click="refresh">↻</button>
        <button type="button" title="收起侧边栏" @click="emit('collapse')">◀</button>
      </div>
    </div>

    <div class="sidebar-root" :title="root" @contextmenu="handleRootContextMenu">{{ root }}</div>

    <div class="sidebar-tree">
      <div v-if="loading" class="tree-loading">加载中...</div>
      <TreeNode
        v-for="entry in rootEntries"
        :key="entry.path"
        :entry="entry"
        :depth="0"
        :theme="theme"
        :active-file-path="activeFilePath"
        :notebook-root="root"
        @open-file="handleOpenFile"
        @file-created="handleFileCreated"
        @item-deleted="handleItemDeleted"
      />
      <div v-if="!loading && rootEntries.length === 0" class="sidebar-empty-inline">暂无文件</div>
    </div>

    <Teleport to="body">
      <div
        v-if="rootMenuVisible"
        class="context-menu"
        :data-theme="theme"
        :style="{ left: `${rootMenuX}px`, top: `${rootMenuY}px` }"
        @mousedown.stop
      >
        <button type="button" @click="openRootCreateFileDialog">新建文件</button>
        <button type="button" @click="openRootCreateFolderDialog">新建文件夹</button>
        <div class="context-menu-divider" />
        <button type="button" @click="showRootInExplorer">资源管理器展示</button>
      </div>
    </Teleport>

    <FileNameDialog
      :visible="rootDialogVisible"
      :theme="theme"
      :title="rootDialogType === 'file' ? '新建文件' : '新建文件夹'"
      :default-name="rootDialogType === 'file' ? 'untitled.md' : '新建文件夹'"
      :placeholder="rootDialogType === 'file' ? '文件名，如 notes.md' : '文件夹名称'"
      :name-label="rootDialogType === 'file' ? '文件名' : '文件夹名'"
      @confirm="handleCreateAtRoot"
      @cancel="rootDialogVisible = false"
    />
  </aside>
</template>

<style scoped>
.notebook-sidebar {
  display: flex;
  flex-direction: column;
  width: 260px;
  min-width: 200px;
  max-width: 360px;
  height: 100%;
  border-right: 1px solid #e5e7eb;
  background: #f9fafb;
  flex-shrink: 0;
}

.notebook-sidebar[data-theme='dark'] {
  border-right-color: #3c3c3c;
  background: #252526;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
}

.notebook-sidebar[data-theme='dark'] .sidebar-header {
  border-bottom-color: #3c3c3c;
}

.sidebar-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.notebook-sidebar[data-theme='dark'] .sidebar-title {
  color: #d1d5db;
}

.sidebar-actions {
  display: flex;
  gap: 4px;
}

.sidebar-actions button {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.sidebar-actions .btn-refresh {
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
}

.sidebar-actions button:hover {
  background: rgba(0, 0, 0, 0.06);
}

.notebook-sidebar[data-theme='dark'] .sidebar-actions button {
  color: #9ca3af;
}

.notebook-sidebar[data-theme='dark'] .sidebar-actions button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.sidebar-root {
  padding: 6px 12px;
  font-size: 11px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-bottom: 1px solid #e5e7eb;
  cursor: context-menu;
}

.notebook-sidebar[data-theme='dark'] .sidebar-root {
  border-bottom-color: #3c3c3c;
}

.sidebar-tree {
  flex: 1;
  overflow: auto;
  padding: 4px 0;
}

.sidebar-empty-inline {
  padding: 24px 16px;
  text-align: center;
  font-size: 13px;
  color: #6b7280;
}

.tree-loading {
  padding: 8px 12px;
  font-size: 12px;
  color: #9ca3af;
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
</style>
