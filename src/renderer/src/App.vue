<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { MdEditor } from 'md-editor-v3'
import type { UploadImgCallBack } from 'md-editor-v3'
import { setMdBaseDir } from './markdown'
import 'md-editor-v3/lib/style.css'

const defaultContent = ''

const text = ref(defaultContent)
const currentPath = ref<string | null>(null)
const isDirty = ref(false)
const lastSavedContent = ref(defaultContent)
const theme = ref<'light' | 'dark'>('light')

const windowTitle = computed(() => {
  if (!currentPath.value) {
    return 'MarkdownEdit - Untitled'
  }
  return `MarkdownEdit - ${currentPath.value}`
})

watch(
  windowTitle,
  (title) => {
    void window.fileApi.setWindowTitle(title)
  },
  { immediate: true }
)

watch(
  currentPath,
  (path) => {
    setMdBaseDir(path ? path.replace(/[/\\][^/\\]+$/, '') : null)
  },
  { immediate: true }
)

watch(theme, (value) => {
  document.documentElement.dataset.theme = value
})

function markDirty(): void {
  isDirty.value = text.value !== lastSavedContent.value
}

watch(text, markDirty)

async function handleUploadImg(files: File[], callback: UploadImgCallBack): Promise<void> {
  if (!currentPath.value) {
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

async function handleNew(): Promise<void> {
  if (isDirty.value && !confirm('当前文件未保存，确定新建吗？')) {
    return
  }

  await window.fileApi.newFile()
  text.value = defaultContent
  currentPath.value = null
  lastSavedContent.value = defaultContent
  isDirty.value = false
}

async function handleOpen(): Promise<void> {
  if (isDirty.value && !confirm('当前文件未保存，确定打开其他文件吗？')) {
    return
  }

  const result = await window.fileApi.openFile()
  if (!result) return

  text.value = result.content
  currentPath.value = result.filePath
  lastSavedContent.value = result.content
  isDirty.value = false
}

async function handleSave(saveAs = false): Promise<void> {
  const result = await window.fileApi.saveFile(text.value, saveAs)
  if (!result) return

  currentPath.value = result.filePath
  lastSavedContent.value = text.value
  isDirty.value = false
}

let cleanupNew: (() => void) | undefined
let cleanupOpen: (() => void) | undefined
let cleanupSave: (() => void) | undefined
let cleanupSaveAs: (() => void) | undefined
let cleanupTheme: (() => void) | undefined

onMounted(async () => {
  const { resolved } = await window.fileApi.getTheme()
  theme.value = resolved

  currentPath.value = await window.fileApi.getCurrentPath()
  cleanupNew = window.fileApi.onMenuNew(() => void handleNew())
  cleanupOpen = window.fileApi.onMenuOpen(() => void handleOpen())
  cleanupSave = window.fileApi.onMenuSave(() => void handleSave(false))
  cleanupSaveAs = window.fileApi.onMenuSaveAs(() => void handleSave(true))
  cleanupTheme = window.fileApi.onThemeChange((nextTheme) => {
    theme.value = nextTheme
  })
})

onUnmounted(() => {
  cleanupNew?.()
  cleanupOpen?.()
  cleanupSave?.()
  cleanupSaveAs?.()
  cleanupTheme?.()
})
</script>

<template>
  <div class="app-shell" :data-theme="theme">
    <MdEditor
      v-model="text"
      :theme="theme"
      preview-theme="github"
      language="zh-CN"
      :show-code-row-number="true"
      :on-upload-img="handleUploadImg"
    />
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

.app-shell :deep(.md-editor) {
  height: 100%;
  border: none;
}
</style>
