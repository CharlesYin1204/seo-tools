<template>
  <div class="contacts-page">
    <!-- 顶部操作栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <select v-model="selectedRobotId" class="robot-select" @change="onRobotChange">
          <option value="">选择微信账号</option>
          <option v-for="r in robots" :key="r.id" :value="r.id">{{ r.nickname || r.wxid || '未命名' }}</option>
        </select>
        <!-- 分类筛选Tab -->
        <div class="filter-tabs">
          <button v-for="tab in tabs" :key="tab.value" :class="['tab-btn', { active: activeTab === tab.value }]" @click="activeTab = tab.value; page = 1; loadContacts()">
            {{ tab.label }}
          </button>
        </div>
      </div>
      <div class="toolbar-right">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input v-model="searchKeyword" placeholder="搜索联系人..." @keyup.enter="page=1;loadContacts()">
        </div>
        <button class="btn-sync" :disabled="!selectedRobotId || syncing" @click="handleSync">
          <i :class="syncing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i> 同步通讯录
        </button>
      </div>
    </div>

    <!-- 统计栏 -->
    <div v-if="selectedRobotId && !loading" class="stats-bar">
      <div class="stat-item" @click="activeTab=''; page=1; loadContacts()">
        <div class="stat-num">{{ totalAll }}</div>
        <div class="stat-label">全部联系人</div>
      </div>
      <div class="stat-item" @click="activeTab='friend'; page=1; loadContacts()">
        <div class="stat-num" style="color:#07C160">{{ totalFriends }}</div>
        <div class="stat-label">好友</div>
      </div>
      <div class="stat-item" @click="activeTab='group'; page=1; loadContacts()">
        <div class="stat-num" style="color:#2196F3">{{ totalGroups }}</div>
        <div class="stat-label">群聊</div>
      </div>
      <div class="stat-item" @click="activeTab='official'; page=1; loadContacts()">
        <div class="stat-num" style="color:#FF9800">{{ totalOfficials }}</div>
        <div class="stat-label">公众号</div>
      </div>
    </div>

    <!-- 联系人列表 -->
    <div v-if="loading" class="loading-state"><i class="fas fa-spinner fa-spin fa-2x" style="color:#07C160;"></i><p>加载中...</p></div>

    <div v-else-if="!contacts.length" class="empty-state">
      <i class="fas fa-address-book fa-3x" style="color:#ddd;"></i>
      <p>{{ selectedRobotId ? '暂无联系人，请先同步通讯录' : '请选择微信账号' }}</p>
    </div>

    <div v-else class="contact-list">
      <div v-for="c in contacts" :key="c.id || c.wxid" class="contact-item">
        <div class="contact-avatar">
          <img v-if="c.avatar" :src="c.avatar" alt="">
          <i v-else class="fas fa-user"></i>
        </div>
        <div class="contact-info">
          <div class="contact-name">{{ c.nickname || c.wxid }}</div>
          <div v-if="c.remark" class="contact-remark">备注: {{ c.remark }}</div>
          <div class="contact-wxid">{{ c.wxid }}</div>
        </div>
        <div class="contact-type-badge" v-if="c.type">{{ typeLabel(c.type) }}</div>
        <div class="contact-actions">
          <button class="action-btn" title="发消息" @click="goChat(c)"><i class="fas fa-comment"></i></button>
          <button class="action-btn" title="查看详情" @click="showDetail(c)"><i class="fas fa-info-circle"></i></button>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="pagination-bar">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @size-change="loadContacts"
        @current-change="loadContacts"
      />
    </div>

    <!-- 联系人详情弹窗 -->
    <el-dialog v-model="showDetailDialog" title="联系人详情" width="400px">
      <div v-if="detailContact" class="detail-card">
        <div class="detail-avatar">
          <img v-if="detailContact.avatar" :src="detailContact.avatar" alt="">
          <i v-else class="fas fa-user fa-3x" style="color:#07C160;"></i>
        </div>
        <h4>{{ detailContact.nickname }}</h4>
        <p class="detail-wxid">{{ detailContact.wxid }}</p>
        <div v-if="detailContact.remark" class="detail-row"><label>备注:</label> {{ detailContact.remark }}</div>
        <div v-if="detailContact.type" class="detail-row"><label>类型:</label> {{ typeLabel(detailContact.type) }}</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter, useRoute } from 'vue-router'
import { wechatRobotApi } from '@/api/modules/wechatRobot'
import api from '@/api'

const router = useRouter()
const route = useRoute()
const isAdmin = computed(() => route.path.startsWith('/admin'))
const loading = ref(false)
const syncing = ref(false)
const selectedRobotId = ref('')
const robots = ref([])
const contacts = ref([])
const searchKeyword = ref('')
const activeTab = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const showDetailDialog = ref(false)
const detailContact = ref(null)
const totalAll = ref(0)
const totalFriends = ref(0)
const totalGroups = ref(0)
const totalOfficials = ref(0)

const tabs = [
  { value: '', label: '全部' },
  { value: 'friend', label: '好友' },
  { value: 'group', label: '群聊' },
  { value: 'official', label: '公众号' },
]

function typeLabel(type) {
  return { friend: '好友', group: '群聊', official: '公众号', enterprise: '企业微信' }[type] || type
}

function apiPrefix() { return isAdmin.value ? '/admin' : '/user' }

async function loadRobots() {
  try {
    const url = isAdmin.value ? '/admin/wechat-robot/accounts' : '/user/wechat-robot/accounts'
    const res = await api.get(url)
    robots.value = res?.data?.data || res?.data || []
    if (robots.value.length && !selectedRobotId.value) {
      selectedRobotId.value = robots.value[0].id
    }
  } catch { robots.value = [] }
}

function onRobotChange() { page.value = 1; loadContacts(); loadStats() }

async function fetchContacts(rid, params) {
  return api.get(`${apiPrefix()}/wechat-robot/${rid}/contacts`, { params })
}

function extractTotal(res) {
  const d = res?.data
  if (d && typeof d === 'object') {
    if (typeof d.total === 'number') return d.total
    if (d.pagination && typeof d.pagination.total === 'number') return d.pagination.total
  }
  if (res?.data?.data && typeof res.data.data === 'object') {
    const dd = res.data.data
    if (typeof dd.total === 'number') return dd.total
    if (dd.pagination && typeof dd.pagination.total === 'number') return dd.pagination.total
  }
  return 0
}

async function loadStats() {
  if (!selectedRobotId.value) return
  try {
    const res = await fetchContacts(selectedRobotId.value, { page: 1, per_page: 1, pageSize: 1 })
    totalAll.value = extractTotal(res)
  } catch { /* ignore */ }
  try {
    const res2 = await fetchContacts(selectedRobotId.value, { page: 1, per_page: 1, pageSize: 1, contactType: 'friend' })
    totalFriends.value = extractTotal(res2)
  } catch { totalFriends.value = 0 }
  try {
    const res3 = await fetchContacts(selectedRobotId.value, { page: 1, per_page: 1, pageSize: 1, contactType: 'group_member' })
    totalGroups.value = extractTotal(res3)
  } catch { totalGroups.value = 0 }
  try {
    const res4 = await fetchContacts(selectedRobotId.value, { page: 1, per_page: 1, pageSize: 1, contactType: 'official' })
    totalOfficials.value = extractTotal(res4)
  } catch { totalOfficials.value = 0 }
}

async function loadContacts() {
  if (!selectedRobotId.value) { contacts.value = []; total.value = 0; return }
  loading.value = true
  try {
    const res = await fetchContacts(selectedRobotId.value, {
      page: page.value, per_page: pageSize.value,
      keyword: searchKeyword.value, contactType: activeTab.value,
    })
    const d = res?.data?.data || res?.data || {}
    contacts.value = d.list || d.data || (Array.isArray(d) ? d : [])
    total.value = d.total || d.pagination?.total || contacts.value.length
  } catch { contacts.value = []; total.value = 0 }
  loading.value = false
}

async function handleSync() {
  if (!selectedRobotId.value) return
  syncing.value = true
  try {
    const res = await api.post(`${apiPrefix()}/wechat-robot/${selectedRobotId.value}/contacts/sync`, {}, { timeout: 180000 })
    ElMessage.success(res?.data?.message || '同步完成')
    setTimeout(() => { loadContacts(); loadStats() }, 2000)
  } catch (err) { ElMessage.error(err?.response?.data?.message || err?.message || '同步失败，请稍后重试') }
  syncing.value = false
}

function goChat(c) {
  router.push(`/admin/wechat-robot/messages`)
}
function showDetail(c) {
  detailContact.value = c
  showDetailDialog.value = true
}

onMounted(() => loadRobots().then(() => { loadContacts(); loadStats() }))
</script>

<style scoped>
.contacts-page { max-width: 1200px; margin: 0; }

.toolbar {
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 12px; margin-bottom: 20px;
}
.toolbar-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.toolbar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.robot-select {
  padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px;
  font-size: 0.9rem; min-width: 160px; outline: none;
}
.filter-tabs { display: flex; gap: 4px; }
.tab-btn {
  padding: 6px 14px; border: 1px solid #ddd; border-radius: 6px;
  background: #fff; cursor: pointer; font-size: 0.85rem; color: #666;
  transition: all 0.2s;
}
.tab-btn.active { background: #07C160; color: #fff; border-color: #07C160; }
.tab-btn:hover:not(.active) { border-color: #07C160; color: #07C160; }

.search-box {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; border: 1px solid #ddd; border-radius: 8px; background: #fff;
}
.search-box i { color: #999; font-size: 14px; }
.search-box input { border: none; outline: none; font-size: 0.9rem; width: 150px; }

.btn-sync {
  background: #07C160; border: none; color: #fff; border-radius: 8px;
  padding: 8px 16px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s;
  display: flex; align-items: center; gap: 6px;
}
.btn-sync:hover { background: #06AD56; }
.btn-sync:disabled { opacity: 0.5; cursor: not-allowed; }

.stats-bar {
  display: flex; gap: 12px; margin-bottom: 16px;
  background: #fff; border-radius: 16px; padding: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}
.stat-item {
  flex: 1; text-align: center; cursor: pointer; padding: 8px;
  border-radius: 10px; transition: background 0.2s;
}
.stat-item:hover { background: #f5f5f5; }
.stat-num { font-size: 1.5rem; font-weight: 700; color: #333; }
.stat-label { font-size: 0.8rem; color: #888; margin-top: 2px; }

.loading-state, .empty-state {
  text-align: center; padding: 60px 20px; background: #fff;
  border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); color: #888;
}
.loading-state p, .empty-state p { margin-top: 16px; }

.contact-list {
  background: #fff; border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;
}
.contact-item {
  display: flex; align-items: center; padding: 14px 20px;
  border-bottom: 1px solid #F5F5F5; transition: background 0.2s;
}
.contact-item:hover { background: #FAFAFA; }
.contact-item:last-child { border-bottom: none; }
.contact-avatar {
  width: 48px; height: 48px; border-radius: 10px; overflow: hidden;
  background: #F7F7F7; display: flex; align-items: center; justify-content: center;
  font-size: 20px; color: #07C160; flex-shrink: 0;
}
.contact-avatar img { width: 100%; height: 100%; object-fit: cover; }
.contact-info { flex: 1; margin-left: 14px; min-width: 0; }
.contact-name { font-weight: 600; color: #191919; font-size: 0.95rem; }
.contact-remark { color: #888; font-size: 0.8rem; margin-top: 2px; }
.contact-wxid { color: #aaa; font-size: 0.78rem; margin-top: 2px; }
.contact-type-badge {
  padding: 3px 10px; border-radius: 12px; font-size: 0.75rem;
  background: rgba(7,193,96,0.1); color: #07C160; margin-right: 12px; flex-shrink: 0;
}
.contact-actions { display: flex; gap: 6px; flex-shrink: 0; }
.action-btn {
  width: 34px; height: 34px; border-radius: 8px; border: 1px solid #ddd;
  background: #fff; cursor: pointer; display: flex; align-items: center;
  justify-content: center; color: #666; transition: all 0.2s;
}
.action-btn:hover { border-color: #07C160; color: #07C160; }

.pagination-bar { margin-top: 16px; display: flex; justify-content: flex-start; }

.detail-card { text-align: center; }
.detail-avatar {
  width: 80px; height: 80px; border-radius: 16px; overflow: hidden;
  margin: 0 auto 12px; background: #F7F7F7;
  display: flex; align-items: center; justify-content: center;
}
.detail-avatar img { width: 100%; height: 100%; object-fit: cover; }
.detail-card h4 { margin: 0 0 6px; }
.detail-wxid { color: #888; font-size: 0.85rem; margin-bottom: 16px; }
.detail-row { text-align: left; padding: 8px 0; border-top: 1px solid #f0f0f0; font-size: 0.9rem; }
.detail-row label { color: #888; margin-right: 8px; }

@media (max-width: 767px) {
  .toolbar { flex-direction: column; align-items: stretch; }
  .toolbar-left, .toolbar-right { flex-direction: column; }
  .filter-tabs { flex-wrap: wrap; }
  .search-box input { width: 100%; }
  .contact-item { padding: 10px 14px; }
  .contact-avatar { width: 40px; height: 40px; }
}
</style>
