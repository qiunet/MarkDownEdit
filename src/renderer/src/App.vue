<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { MdEditor } from 'md-editor-v3'
import type { UploadImgCallBack } from 'md-editor-v3'
import NotebookSidebar from './components/NotebookSidebar.vue'
import { setMdBaseDir } from './markdown'
import 'md-editor-v3/lib/style.css'

interface EditorTab {
  id: string
  filePath: string | null
  content: string
  savedContent: string
}

const defaultContent = ''
let tabCounter = 0

function createTab(content = defaultContent, filePath: string | null = null): EditorTab {
  tabCounter += 1
  return {
    id: `tab-${tabCounter}`,
    filePath,
    content,
    savedContent: content
  }
}

const tabs = ref<EditorTab[]>([createTab()])
const activeTabId = ref(tabs.value[0].id)
const theme = ref<'light' | 'dark'>('light')
const notebookRoot = ref<string | null>(null)
const sidebarCollapsed = ref(false)
const sidebarRef = ref<InstanceType<typeof NotebookSidebar> | null>(null)

const activeTab = computed(() => tabs.value.find((tab) => tab.id === activeTabId.value) ?? tabs.value[0])

const activeFilePath = computed(() => activeTab.value?.filePath ?? null)

const showSidebar = computed(() => notebookRoot.value !== null && !sidebarCollapsed.value)
const showExpandBar = computed(() => notebookRoot.value !== null && sidebarCollapsed.value)

const windowTitle = computed(() => {
  const tab = activeTab.value
  if (!tab?.filePath) {
    return 'MarkdownEdit - Untitled'
  }
  return `MarkdownEdit - ${tab.filePath}`
})

function getTabLabel(tab: EditorTab): string {
  if (!tab.filePath) {
    return 'Untitled'
  }
  return tab.filePath.split(/[/\\]/).pop() ?? 'Untitled'
}

function isTabDirty(tab: EditorTab): boolean {
  return tab.content !== tab.savedContent
}

function syncActiveTabToMain(): void {
  void window.fileApi.setCurrentPath(activeTab.value?.filePath ?? null)
  setMdBaseDir(activeTab.value?.filePath ? activeTab.value.filePath.replace(/[/\\][^/\\]+$/, '') : null)
}

function openFileInTab(filePath: string, content: string): void {
  const existing = tabs.value.find((tab) => tab.filePath === filePath)
  if (existing) {
    activeTabId.value = existing.id
    return
  }

  const tab = createTab(content, filePath)
  tabs.value.push(tab)
  activeTabId.value = tab.id
}

watch(
  windowTitle,
  (title) => {
    void window.fileApi.setWindowTitle(title)
  },
  { immediate: true }
)

watch(activeTabId, () => {
  syncActiveTabToMain()
})

watch(theme, (value) => {
  document.documentElement.dataset.theme = value
})

async function handleUploadImg(files: File[], callback: UploadImgCallBack): Promise<void> {
  const tab = activeTab.value
  if (!tab?.filePath) {
    alert('请先保存 Markdown 文件后再上传图片')
    return
  }

  try {
    const payloads = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        data: new Uint8Array(await file.arrayBuffer())
      }))
    )

    const urls = await window.fileApi.saveImages(payloads)
    callback(urls)
  } catch (error) {
    if (error instanceof Error && error.message === 'SAVE_MD_FIRST') {
      alert('请先保存 Markdown 文件后再上传图片')
      return
    }
    alert('图片保存失败，请重试')
  }
}

function switchTab(tabId: string): void {
  if (tabId === activeTabId.value) return
  activeTabId.value = tabId
}

function forceCloseTab(tabId: string): void {
  const index = tabs.value.findIndex((tab) => tab.id === tabId)
  if (index < 0) return

  tabs.value.splice(index, 1)

  if (tabs.value.length === 0) {
    const newTab = createTab()
    tabs.value.push(newTab)
    activeTabId.value = newTab.id
    return
  }

  if (activeTabId.value === tabId) {
    const nextIndex = index >= tabs.value.length ? tabs.value.length - 1 : index
    activeTabId.value = tabs.value[nextIndex].id
  }
}

function handleItemDeleted(itemPath: string): void {
  const normalized = itemPath.replace(/\\/g, '/')
  const tabsToClose = tabs.value.filter((tab) => {
    if (!tab.filePath) return false
    const filePath = tab.filePath.replace(/\\/g, '/')
    return filePath === normalized || filePath.startsWith(`${normalized}/`)
  })

  for (const tab of tabsToClose) {
    forceCloseTab(tab.id)
  }
}

async function closeTab(tabId: string): Promise<void> {
  const index = tabs.value.findIndex((tab) => tab.id === tabId)
  if (index < 0) return

  const tab = tabs.value[index]
  if (isTabDirty(tab)) {
    const label = tab.filePath ?? 'Untitled'
    if (!confirm(`"${label}" 未保存，确定关闭吗？`)) {
      return
    }
  }

  tabs.value.splice(index, 1)

  if (tabs.value.length === 0) {
    const newTab = createTab()
    tabs.value.push(newTab)
    activeTabId.value = newTab.id
    return
  }

  if (activeTabId.value === tabId) {
    const nextIndex = index >= tabs.value.length ? tabs.value.length - 1 : index
    activeTabId.value = tabs.value[nextIndex].id
  }
}

async function handleNew(): Promise<void> {
  const tab = createTab()
  tabs.value.push(tab)
  activeTabId.value = tab.id
}

async function handleOpen(): Promise<void> {
  const result = await window.fileApi.openFile()
  if (!result) return
  openFileInTab(result.filePath, result.content)
}

async function handleSave(saveAs = false): Promise<void> {
  const tab = activeTab.value
  if (!tab) return

  const result = await window.fileApi.saveFile(tab.content, saveAs, tab.filePath)
  if (!result) return

  tab.filePath = result.filePath
  tab.savedContent = tab.content
  sidebarRef.value?.refresh()
}

function handleCollapseSidebar(): void {
  void window.fileApi.setSidebarCollapsed(true)
}

function handleExpandSidebar(): void {
  void window.fileApi.setSidebarCollapsed(false)
}

function handleNotebookFileOpen(filePath: string, content: string): void {
  openFileInTab(filePath, content)
}

let cleanupNew: (() => void) | undefined
let cleanupOpen: (() => void) | undefined
let cleanupSave: (() => void) | undefined
let cleanupSaveAs: (() => void) | undefined
let cleanupTheme: (() => void) | undefined
let cleanupNotebook: (() => void) | undefined

onMounted(async () => {
  const [{ resolved }, notebookState] = await Promise.all([
    window.fileApi.getTheme(),
    window.fileApi.getNotebookState()
  ])

  theme.value = resolved
  notebookRoot.value = notebookState.root
  sidebarCollapsed.value = notebookState.sidebarCollapsed
  syncActiveTabToMain()

  cleanupNew = window.fileApi.onMenuNew(() => void handleNew())
  cleanupOpen = window.fileApi.onMenuOpen(() => void handleOpen())
  cleanupSave = window.fileApi.onMenuSave(() => void handleSave(false))
  cleanupSaveAs = window.fileApi.onMenuSaveAs(() => void handleSave(true))
  cleanupTheme = window.fileApi.onThemeChange((nextTheme) => {
    theme.value = nextTheme
  })
  cleanupNotebook = window.fileApi.onNotebookChange((state) => {
    notebookRoot.value = state.root
    sidebarCollapsed.value = state.sidebarCollapsed
  })
})

onUnmounted(() => {
  cleanupNew?.()
  cleanupOpen?.()
  cleanupSave?.()
  cleanupSaveAs?.()
  cleanupTheme?.()
  cleanupNotebook?.()
})
</script>

<template>
  <div class="app-shell" :data-theme="theme">
    <div class="main-layout">
      <NotebookSidebar
        v-if="showSidebar && notebookRoot"
        ref="sidebarRef"
        :root="notebookRoot"
        :active-file-path="activeFilePath"
        :theme="theme"
        @open-file="handleNotebookFileOpen"
        @collapse="handleCollapseSidebar"
        @item-deleted="handleItemDeleted"
      />

      <button
        v-if="showExpandBar"
        type="button"
        class="sidebar-expand"
        :data-theme="theme"
        title="展开侧边栏"
        @click="handleExpandSidebar"
      >
        ▶
      </button>

      <div class="editor-panel">
        <div class="tab-bar">
          <div
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-item"
            :class="{ active: tab.id === activeTabId }"
            :title="tab.filePath ?? 'Untitled'"
            @click="switchTab(tab.id)"
          >
            <span class="tab-label">
              {{ getTabLabel(tab) }}<span v-if="isTabDirty(tab)" class="tab-dot"> ●</span>
            </span>
            <button
              type="button"
              class="tab-close"
              aria-label="关闭标签"
              @click.stop="closeTab(tab.id)"
            >
              ×
            </button>
          </div>
        </div>

        <div class="editor-area">
          <MdEditor
            :key="activeTabId"
            v-model="activeTab.content"
            :theme="theme"
            preview-theme="github"
            language="zh-CN"
            :show-code-row-number="true"
            :on-upload-img="handleUploadImg"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  width: 100%;
  height: 100%;
  background: #fff;
}

.app-shell[data-theme='dark'] {
  background: #1e1e1e;
}

.main-layout {
  display: flex;
  width: 100%;
  height: 100%;
}

.sidebar-expand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 100%;
  border: none;
  border-right: 1px solid #e5e7eb;
  background: #f3f4f6;
  color: #6b7280;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 10px;
}

.sidebar-expand:hover {
  background: #e5e7eb;
}

.sidebar-expand[data-theme='dark'] {
  border-right-color: #3c3c3c;
  background: #252526;
  color: #9ca3af;
}

.sidebar-expand[data-theme='dark']:hover {
  background: #2d2d2d;
}

.editor-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.tab-bar {
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 6px 8px 0;
  overflow-x: auto;
  background: #f3f4f6;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.app-shell[data-theme='dark'] .tab-bar {
  background: #252526;
  border-bottom-color: #3c3c3c;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 220px;
  padding: 6px 8px 6px 12px;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  user-select: none;
}

.tab-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.tab-item.active {
  background: #fff;
  border-color: #e5e7eb;
  color: #111827;
}

.app-shell[data-theme='dark'] .tab-item {
  color: #9ca3af;
}

.app-shell[data-theme='dark'] .tab-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.app-shell[data-theme='dark'] .tab-item.active {
  background: #1e1e1e;
  border-color: #3c3c3c;
  color: #e5e7eb;
}

.tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.tab-dot {
  color: #6b7280;
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}

.tab-close:hover {
  background: rgba(0, 0, 0, 0.08);
}

.app-shell[data-theme='dark'] .tab-close:hover {
  background: rgba(255, 255, 255, 0.1);
}

.editor-area {
  flex: 1;
  min-height: 0;
}

.editor-area :deep(.md-editor) {
  height: 100%;
  border: none;
}
</style>
