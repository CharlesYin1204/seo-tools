<template>
  <div class="favorites-page">
    <div class="toolbar">
      <div class="toolbar-left">
        <select v-model="selectedRobotId" class="robot-select" @change="onRobotChange">
          <option value="">选择微信账号</option>
          <option v-for="r in robots" :key="r.id" :value="r.id">{{ r.nickname || r.wxid || '未命名' }}</option>
        </select>
        <div class="filter-tabs">
          <button v-for="tab in typeTabs" :key="tab.value" :class="['tab-btn', { active: activeType === tab.value }]"
            @click="activeType = tab.value; page = 1; loadFavorites()">{{ tab.label }}</button>
        </div>
      </div>
      <button class="btn-sync" :disabled="!selectedRobotId || syncing" @click="handleSync">
        <i :class="syncing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i> 同步收藏
      </button>
    </div>

    <div v-if="loading" class="loading-state"><i class="fas fa-spinner fa-spin fa-2x" style="color:#07C160;"></i></div>
    <div v-else-if="!favorites.length" class="empty-state">
      <i class="fas fa-star fa-3x" style="color:#ddd;"></i>
      <p>{{ selectedRobotId ? '暂无收藏数据' : '请选择微信账号' }}</p>
    </div>

    <div v-else class="fav-list">
      <div v-for="f in favorites" :key="f.id" class="fav-card">
        <div class="fav-header">
          <span class="type-badge" :class="typeClass(f)">{{ typeLabel(f.type) }}</span>
          <span class="fav-time">{{ formatDate(f.created_at) }}</span>
        </div>
        <div class="fav-body">
          <div v-if="favoriteImages(f).length" class="fav-media-grid">
            <img v-for="url in favoriteImages(f)" :key="url" :src="url" alt="">
          </div>
          <div v-else-if="f.has_media" class="fav-media-hint">
            <i class="fas fa-image"></i>
            <span>该收藏包含图片，微信接口暂未返回可直接预览的图片地址</span>
          </div>
          <p class="fav-content">{{ cleanContent(f) }}</p>
        </div>
        <div class="fav-footer">
          <button class="action-btn danger" @click="handleDelete(f)"><i class="fas fa-trash"></i> 删除</button>
        </div>
      </div>
    </div>

    <div v-if="total > pageSize" class="pagination-bar">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total"
        :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next"
        @size-change="loadFavorites" @current-change="loadFavorites" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import { wechatRobotApi } from '@/api/modules/wechatRobot'
import api from '@/api'

const route = useRoute()
const isAdmin = computed(() => route.path.startsWith('/admin'))
const selectedRobotId = ref('')
const robots = ref([])
const favorites = ref([])
const loading = ref(false)
const syncing = ref(false)
const activeType = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const typeTabs = [
  { value: '', label: '全部' }, { value: 'text', label: '文本' },
  { value: 'image', label: '图片' }, { value: 'video', label: '视频' },
  { value: 'link', label: '链接' }, { value: 'file', label: '文件' },
  { value: 'note', label: '笔记' },
]
function apiPrefix() { return isAdmin.value ? '/admin' : '/user' }
function typeClass(f) {
  if (f?.type_class) return f.type_class
  const t = Number(f?.type)
  if (t === 2) return 'image'
  if (t === 4 || t === 16) return 'video'
  if (t === 5 || t === 7) return 'link'
  if (t === 6 || t === 8) return 'file'
  if (t === 18) return 'note'
  return 'text'
}
function typeLabel(t) {
  const labels = { text: '文本', image: '图片', video: '视频', link: '链接', file: '文件', note: '笔记' }
  const cls = typeClass({ type: t })
  return labels[cls] || String(t || '文本')
}
function formatDate(d) { if (!d) return ''; return new Date(d).toLocaleDateString('zh-CN') }
function favoriteImages(f) {
  const urls = Array.isArray(f?.media_urls) ? f.media_urls : []
  const fallback = [f?.url, f?.file_url].filter(Boolean)
  return [...new Set([...urls, ...fallback])].filter((url) => /^https?:\/\//i.test(url) || /^\/uploads\//i.test(url))
}
function cleanContent(f) {
  return f?.display_content || f?.title || '暂无可展示文本'
}

async function loadRobots() {
  try {
    const res = await api.get(`${apiPrefix()}/wechat-robot/accounts`)
    robots.value = res?.data?.data || res?.data || []
    if (robots.value.length && !selectedRobotId.value) selectedRobotId.value = robots.value[0].id
  } catch { robots.value = [] }
}

function onRobotChange() { page.value = 1; loadFavorites() }

async function loadFavorites() {
  if (!selectedRobotId.value) { favorites.value = []; total.value = 0; return }
  loading.value = true
  try {
    const res = await wechatRobotApi.getFavorites(selectedRobotId.value, {
      page: page.value, per_page: pageSize.value, pageSize: pageSize.value, type: activeType.value,
    }, apiPrefix())
    const d = res?.data?.data || res?.data || {}
    favorites.value = d.list || d.data || (Array.isArray(d) ? d : [])
    total.value = d.total || d.pagination?.total || favorites.value.length
  } catch { favorites.value = []; total.value = 0 }
  loading.value = false
}

async function handleSync() {
  if (!selectedRobotId.value) return
  syncing.value = true
  try {
    const res = await wechatRobotApi.syncFavorites(selectedRobotId.value, {}, apiPrefix())
    const data = res?.data || {}
    ElMessage.success(`同步完成：新增${data.inserted || 0}条，更新${data.updated || 0}条`)
    page.value = 1
    await loadFavorites()
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || err?.message || '同步收藏夹失败')
  }
  syncing.value = false
}

async function handleDelete(f) {
  try {
    await ElMessageBox.confirm('确定删除该收藏吗？', '提示', { type: 'warning' })
    await wechatRobotApi.deleteFavorite(selectedRobotId.value, f.id, apiPrefix())
    ElMessage.success('删除成功')
    loadFavorites()
  } catch {}
}

onMounted(() => loadRobots().then(loadFavorites))
</script>

<style scoped>
.favorites-page { max-width: 1000px; margin: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.toolbar-left { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.robot-select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; min-width: 160px; }
.filter-tabs { display: flex; gap: 4px; }
.tab-btn { padding: 6px 12px; border: 1px solid #ddd; border-radius: 6px; background: #fff; cursor: pointer; font-size: 0.82rem; color: #666; }
.tab-btn.active { background: #07C160; color: #fff; border-color: #07C160; }
.btn-sync { background: #07C160; border: none; color: #fff; border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; }
.btn-sync:disabled { opacity: 0.5; cursor: not-allowed; }
.loading-state, .empty-state { text-align: center; padding: 60px 20px; background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); color: #888; }
.empty-state p { margin-top: 16px; }

.fav-list { display: flex; flex-direction: column; gap: 12px; }
.fav-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.fav-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-bottom: 1px solid #f5f5f5; }
.type-badge { padding: 2px 8px; border-radius: 8px; font-size: 0.72rem; font-weight: 500; }
.type-badge.text { background: rgba(7,193,96,0.1); color: #07C160; }
.type-badge.image { background: rgba(87,107,149,0.1); color: #576B95; }
.type-badge.video { background: rgba(229,57,53,0.1); color: #E53935; }
.type-badge.link { background: rgba(250,157,59,0.1); color: #FA9D3B; }
.type-badge.file { background: rgba(155,89,182,0.1); color: #9B59B6; }
.type-badge.note { background: rgba(64,158,255,0.1); color: #409EFF; }
.fav-time { color: #bbb; font-size: 0.78rem; }
.fav-body { padding: 12px 16px; min-height: 40px; }
.fav-media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; max-width: 520px; margin-bottom: 10px; }
.fav-media-grid img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; background: #f5f7fa; }
.fav-media-hint { display: inline-flex; align-items: center; gap: 6px; color: #909399; background: #f5f7fa; border-radius: 6px; padding: 6px 10px; font-size: 0.78rem; margin-bottom: 10px; }
.fav-content { color: #555; font-size: 0.88rem; line-height: 1.5; margin: 0; white-space: pre-wrap; word-break: break-word; }
.fav-footer { padding: 8px 16px; border-top: 1px solid #f5f5f5; text-align: right; }
.action-btn { background: none; border: 1px solid #eee; padding: 4px 12px; border-radius: 6px; cursor: pointer; color: #888; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px; }
.action-btn.danger:hover { border-color: #E53935; color: #E53935; }
.pagination-bar { margin-top: 16px; }
</style>
