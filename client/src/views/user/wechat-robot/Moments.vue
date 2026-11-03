<template>
  <div class="moments-page">
    <!-- 顶部操作栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <select v-model="selectedRobotId" class="robot-select" @change="onRobotChange">
          <option value="">选择微信账号</option>
          <option v-for="r in robots" :key="r.id" :value="r.id">{{ r.nickname || r.wxid || '未命名' }}</option>
        </select>
        <div class="filter-tabs">
          <button v-for="tab in tabs" :key="tab.value" :class="['tab-btn', { active: activeTab === tab.value }]"
            @click="activeTab = tab.value; page = 1; loadMoments()">{{ tab.label }}</button>
        </div>
      </div>
      <div class="toolbar-right">
        <button class="btn-sync" :disabled="!selectedRobotId || syncing" @click="handleRefresh">
          <i :class="syncing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i> 同步朋友圈
        </button>
      </div>
    </div>

    <!-- 发布区域 -->
    <div v-if="selectedRobotId && activeTab !== 'friend'" class="publish-area">
      <div class="publish-header"><i class="fas fa-pen"></i> 发布朋友圈</div>
      <textarea v-model="publishContent" placeholder="写点什么..." rows="3"></textarea>
      <div class="publish-actions">
        <div class="media-btns">
          <button class="media-btn"><i class="fas fa-image"></i> 图片</button>
          <button class="media-btn"><i class="fas fa-video"></i> 视频</button>
          <button class="media-btn"><i class="fas fa-link"></i> 链接</button>
        </div>
        <button class="btn-publish" :disabled="!publishContent.trim()" @click="handlePublish">
          <i class="fas fa-paper-plane"></i> 发布
        </button>
      </div>
    </div>

    <!-- 朋友圈列表 -->
    <div v-if="loading" class="loading-state"><i class="fas fa-spinner fa-spin fa-2x" style="color:#07C160;"></i><p>加载中...</p></div>
    <div v-else-if="!moments.length" class="empty-state">
      <i class="fas fa-image fa-3x" style="color:#ddd;"></i>
      <p>{{ selectedRobotId ? '暂无朋友圈数据，请先同步' : '请选择微信账号' }}</p>
    </div>

    <div v-else class="moments-list">
      <div v-for="m in moments" :key="m.id" class="moment-card">
        <div class="moment-header">
          <div class="moment-avatar">
            <img v-if="m.owner_avatar || m.avatar" :src="m.owner_avatar || m.avatar" alt="">
            <i v-else class="fas fa-user"></i>
          </div>
          <div class="moment-user">
            <div class="moment-nickname">{{ m.owner_nickname || m.nickname || '微信用户' }}</div>
            <div class="moment-time">{{ formatTime(m.create_time || m.created_at) }}</div>
          </div>
          <span v-if="m.is_own" class="own-badge">我的</span>
        </div>
        <div class="moment-content" v-if="m.content || m.fav_content">
          <span v-if="m.content_style === 26 || m.fav_content" class="fav-note-badge">收藏笔记</span>
          {{ m.content || m.fav_content }}
        </div>
        <div v-if="getMediaList(m).length" class="moment-media" :class="'grid-' + Math.min(getMediaList(m).length, 9)">
          <img v-for="(url, idx) in getMediaList(m).slice(0, 9)" :key="idx" :src="url" alt="" @click="previewImage(url)">
        </div>
        <div class="moment-footer">
          <button class="interact-btn" @click="handleLike(m)"><i class="fas fa-heart" :style="m.is_liked ? 'color:#E53935;' : ''"></i> {{ m.like_count || 0 }}</button>
          <button class="interact-btn" @click="toggleComment(m)"><i class="fas fa-comment"></i> {{ m.comment_count || 0 }}</button>
          <button v-if="m.is_own" class="interact-btn danger" @click="handleDelete(m)"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>

    <div v-if="total > pageSize" class="pagination-bar">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total"
        :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next"
        @size-change="loadMoments" @current-change="loadMoments" />
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
const moments = ref([])
const loading = ref(false)
const syncing = ref(false)
const activeTab = ref('all')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const publishContent = ref('')

const tabs = [
  { value: 'all', label: '全部动态' },
  { value: 'my', label: '我的朋友圈' },
  { value: 'friend', label: '好友动态' },
]

function formatTime(t) {
  if (!t) return ''
  if (typeof t === 'number' && t > 1000000000 && t < 10000000000) {
    const d = new Date(t * 1000)
    if (!isNaN(d)) return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  const d = new Date(t)
  if (isNaN(d)) return String(t)
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function apiPrefix() { return isAdmin.value ? '/admin' : '/user' }

async function loadRobots() {
  try {
    const url = `${apiPrefix()}/wechat-robot/accounts`
    const res = await api.get(url)
    robots.value = res?.data?.data || res?.data || []
    if (robots.value.length && !selectedRobotId.value) selectedRobotId.value = robots.value[0].id
  } catch { robots.value = [] }
}

function onRobotChange() { page.value = 1; loadMoments() }

async function loadMoments() {
  if (!selectedRobotId.value) { moments.value = []; total.value = 0; return }
  loading.value = true
  try {
    const res = await api.get(`${apiPrefix()}/wechat-robot/${selectedRobotId.value}/moments`, {
      params: { page: page.value, per_page: pageSize.value, type: activeTab.value }
    })
    const d = res?.data?.data || res?.data || {}
    moments.value = d.list || d.data || (Array.isArray(d) ? d : [])
    total.value = d.total || d.pagination?.total || moments.value.length
  } catch { moments.value = []; total.value = 0 }
  loading.value = false
}

async function handleRefresh() {
  syncing.value = true
  try {
    const res = await api.post(`${apiPrefix()}/wechat-robot/${selectedRobotId.value}/moments/refresh`)
    ElMessage.success(res?.data?.message || '同步已发起')
    setTimeout(loadMoments, 3000)
  } catch (err) { ElMessage.error(err?.response?.data?.message || '同步失败') }
  syncing.value = false
}

async function handlePublish() {
  ElMessage.info('发布功能开发中')
}
function getMediaList(m) {
  const raw = m.media_list || m.media_urls || m.local_media_urls
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : [] } catch { return [] }
  }
  return []
}
function handleLike(m) { ElMessage.info('点赞功能开发中') }
function toggleComment(m) { ElMessage.info('评论功能开发中') }
async function handleDelete(m) {
  try {
    await ElMessageBox.confirm('确定删除这条朋友圈吗？', '提示', { type: 'warning' })
    ElMessage.info('删除功能开发中')
  } catch {}
}
function previewImage(url) { window.open(url, '_blank') }

onMounted(() => loadRobots().then(loadMoments))
</script>

<style scoped>
.moments-page { max-width: 800px; margin: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.toolbar-left { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.toolbar-right { display: flex; gap: 8px; }
.robot-select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; min-width: 160px; }
.filter-tabs { display: flex; gap: 4px; }
.tab-btn { padding: 6px 14px; border: 1px solid #ddd; border-radius: 6px; background: #fff; cursor: pointer; font-size: 0.85rem; color: #666; transition: all 0.2s; }
.tab-btn.active { background: #07C160; color: #fff; border-color: #07C160; }
.tab-btn:hover:not(.active) { border-color: #07C160; color: #07C160; }
.btn-sync { background: #07C160; border: none; color: #fff; border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; }
.btn-sync:hover { background: #06AD56; }
.btn-sync:disabled { opacity: 0.5; cursor: not-allowed; }

.publish-area { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 20px; }
.publish-header { font-weight: 600; margin-bottom: 12px; color: #333; display: flex; align-items: center; gap: 8px; }
.publish-area textarea { width: 100%; border: 1px solid #eee; border-radius: 8px; padding: 10px; font-size: 0.9rem; resize: none; outline: none; box-sizing: border-box; }
.publish-area textarea:focus { border-color: #07C160; }
.publish-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
.media-btns { display: flex; gap: 8px; }
.media-btn { background: #f5f5f5; border: 1px solid #eee; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; color: #666; display: flex; align-items: center; gap: 4px; }
.media-btn:hover { border-color: #07C160; color: #07C160; }
.btn-publish { background: #07C160; border: none; color: #fff; padding: 8px 20px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; }
.btn-publish:disabled { opacity: 0.5; cursor: not-allowed; }

.loading-state, .empty-state { text-align: center; padding: 60px 20px; background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); color: #888; }
.loading-state p, .empty-state p { margin-top: 16px; }

.moments-list { display: flex; flex-direction: column; gap: 16px; }
.moment-card { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
.moment-header { display: flex; align-items: center; margin-bottom: 12px; }
.moment-avatar { width: 44px; height: 44px; border-radius: 10px; overflow: hidden; background: #f7f7f7; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #07C160; flex-shrink: 0; }
.moment-avatar img { width: 100%; height: 100%; object-fit: cover; }
.moment-user { flex: 1; margin-left: 12px; }
.moment-nickname { font-weight: 600; color: #576B95; font-size: 0.95rem; }
.moment-time { font-size: 0.78rem; color: #bbb; margin-top: 2px; }
.own-badge { background: rgba(7,193,96,0.1); color: #07C160; padding: 2px 8px; border-radius: 10px; font-size: 0.72rem; }
.moment-content { font-size: 0.92rem; line-height: 1.6; color: #333; margin-bottom: 12px; white-space: pre-wrap; word-break: break-word; }
.fav-note-badge { display: inline-block; background: #E8F5E9; color: #2E7D32; font-size: 11px; padding: 1px 6px; border-radius: 3px; margin-right: 6px; vertical-align: middle; }
.moment-media { display: grid; gap: 4px; margin-bottom: 12px; }
.moment-media.grid-1 { grid-template-columns: 1fr; max-width: 300px; }
.moment-media.grid-2 { grid-template-columns: repeat(2, 1fr); max-width: 400px; }
.moment-media.grid-3 { grid-template-columns: repeat(3, 1fr); }
.moment-media.grid-4 { grid-template-columns: repeat(2, 1fr); max-width: 400px; }
.moment-media.grid-5, .moment-media.grid-6 { grid-template-columns: repeat(3, 1fr); }
.moment-media.grid-7, .moment-media.grid-8, .moment-media.grid-9 { grid-template-columns: repeat(3, 1fr); }
.moment-media img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px; cursor: pointer; }
.moment-footer { display: flex; gap: 16px; padding-top: 10px; border-top: 1px solid #f5f5f5; }
.interact-btn { background: none; border: none; color: #888; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 4px; }
.interact-btn:hover { background: #f5f5f5; color: #07C160; }
.interact-btn.danger:hover { color: #E53935; }
.pagination-bar { margin-top: 16px; }
@media (max-width: 767px) { .toolbar { flex-direction: column; align-items: stretch; } .filter-tabs { flex-wrap: wrap; } }
</style>
