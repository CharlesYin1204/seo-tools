<template>
  <div class="groups-page">
    <div class="toolbar">
      <div class="toolbar-left">
        <select v-model="selectedRobotId" class="robot-select" @change="onRobotChange">
          <option value="">选择微信账号</option>
          <option v-for="r in robots" :key="r.id" :value="r.id">{{ r.nickname || r.wxid || '未命名' }}</option>
        </select>
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input v-model="searchKeyword" placeholder="搜索群聊..." @keyup.enter="page=1;loadGroups()">
        </div>
      </div>
      <div class="toolbar-right">
        <button class="btn-sync" :disabled="!selectedRobotId || syncing" @click="handleSync">
          <i :class="syncing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i> 同步群列表
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state"><i class="fas fa-spinner fa-spin fa-2x" style="color:#07C160;"></i><p>加载中...</p></div>
    <div v-else-if="!groups.length" class="empty-state">
      <i class="fas fa-users fa-3x" style="color:#ddd;"></i>
      <p>{{ selectedRobotId ? '暂无群聊数据，请先同步' : '请选择微信账号' }}</p>
    </div>

    <div v-else class="group-grid">
      <div v-for="g in groups" :key="g.id || g.chatroom_id" class="group-card">
        <div class="group-header">
          <div class="group-avatar">
            <img v-if="g.avatar" :src="g.avatar" alt="">
            <i v-else class="fas fa-users"></i>
          </div>
          <div class="group-info">
            <div class="group-name">{{ g.name || g.chatroom_id || '未命名群聊' }}</div>
            <div class="group-id">{{ g.chatroom_id }}</div>
          </div>
          <div class="group-badges">
            <span v-if="g.is_owner" class="badge owner">群主</span>
            <span v-else-if="g.is_admin" class="badge admin">管理员</span>
          </div>
        </div>
        <div class="group-body">
          <div class="group-stats">
            <div class="gs-item"><div class="gs-val">{{ g.member_count || '-' }}</div><div class="gs-lbl">成员</div></div>
            <div class="gs-item"><div class="gs-val">{{ g.today_message_count || 0 }}</div><div class="gs-lbl">今日消息</div></div>
            <div class="gs-item"><div class="gs-val">{{ g.total_message_count || 0 }}</div><div class="gs-lbl">总消息</div></div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="total > pageSize" class="pagination-bar">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total"
        :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next"
        @size-change="loadGroups" @current-change="loadGroups" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import { wechatRobotApi } from '@/api/modules/wechatRobot'
import api from '@/api'

const route = useRoute()
const isAdmin = computed(() => route.path.startsWith('/admin'))
const selectedRobotId = ref('')
const robots = ref([])
const groups = ref([])
const loading = ref(false)
const syncing = ref(false)
const searchKeyword = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

function apiPrefix() { return isAdmin.value ? '/admin' : '/user' }

async function loadRobots() {
  try {
    const url = `${apiPrefix()}/wechat-robot/accounts`
    const res = await api.get(url)
    robots.value = res?.data?.data || res?.data || []
    if (robots.value.length && !selectedRobotId.value) selectedRobotId.value = robots.value[0].id
  } catch { robots.value = [] }
}

function onRobotChange() { page.value = 1; loadGroups() }

async function loadGroups() {
  if (!selectedRobotId.value) { groups.value = []; total.value = 0; return }
  loading.value = true
  try {
    const res = await api.get(`${apiPrefix()}/wechat-robot/${selectedRobotId.value}/groups`, {
      params: { page: page.value, per_page: pageSize.value, search: searchKeyword.value }
    })
    const d = res?.data?.data || res?.data || {}
    groups.value = d.list || d.data || (Array.isArray(d) ? d : [])
    total.value = d.total || d.pagination?.total || groups.value.length
  } catch { groups.value = []; total.value = 0 }
  loading.value = false
}

async function handleSync() {
  syncing.value = true
  try {
    const res = await api.post(`${apiPrefix()}/wechat-robot/${selectedRobotId.value}/groups/sync`, {}, { timeout: 180000 })
    ElMessage.success(res?.data?.message || res?.data?.data?.message || '同步完成')
    setTimeout(loadGroups, 2000)
  } catch (err) { ElMessage.error(err?.response?.data?.message || err?.message || '同步失败，请稍后重试') }
  syncing.value = false
}

onMounted(() => loadRobots().then(loadGroups))
</script>

<style scoped>
.groups-page { max-width: 1200px; margin: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.toolbar-left { display: flex; gap: 12px; align-items: center; }
.toolbar-right { display: flex; gap: 8px; }
.robot-select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; min-width: 160px; }
.search-box { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid #ddd; border-radius: 8px; background: #fff; }
.search-box i { color: #999; }
.search-box input { border: none; outline: none; font-size: 0.9rem; width: 150px; }
.btn-sync { background: #07C160; border: none; color: #fff; border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; }
.btn-sync:hover { background: #06AD56; }
.btn-sync:disabled { opacity: 0.5; cursor: not-allowed; }
.loading-state, .empty-state { text-align: center; padding: 60px 20px; background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); color: #888; }
.loading-state p, .empty-state p { margin-top: 16px; }

.group-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.group-card { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); transition: all 0.3s; }
.group-card:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(0,0,0,0.12); }
.group-header { display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; }
.group-avatar { width: 50px; height: 50px; border-radius: 12px; background: #F7F7F7; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #FA9D3B; overflow: hidden; flex-shrink: 0; }
.group-avatar img { width: 100%; height: 100%; object-fit: cover; }
.group-info { flex: 1; margin-left: 12px; min-width: 0; }
.group-name { font-weight: 600; color: #191919; font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.group-id { font-size: 0.78rem; color: #aaa; margin-top: 2px; }
.group-badges { flex-shrink: 0; }
.badge { padding: 3px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 500; }
.badge.owner { background: rgba(250,157,59,0.15); color: #FA9D3B; }
.badge.admin { background: rgba(87,107,149,0.1); color: #576B95; }
.group-body { padding: 16px 20px; }
.group-stats { display: flex; gap: 20px; }
.gs-item { text-align: center; flex: 1; }
.gs-val { font-size: 1.1rem; font-weight: 600; color: #191919; }
.gs-lbl { font-size: 0.75rem; color: #888; }
.pagination-bar { margin-top: 16px; }
@media (max-width: 767px) { .group-grid { grid-template-columns: 1fr; } .toolbar { flex-direction: column; align-items: stretch; } }
</style>
