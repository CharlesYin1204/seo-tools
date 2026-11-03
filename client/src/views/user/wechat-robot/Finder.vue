<template>
  <div class="finder-page">
    <div class="toolbar">
      <select v-model="selectedRobotId" class="robot-select" @change="loadFinderInfo">
        <option value="">选择微信账号</option>
        <option v-for="r in robots" :key="r.id" :value="r.id">{{ r.nickname || r.wxid || '未命名' }}</option>
      </select>
    </div>

    <!-- 视频号资料卡 -->
    <div v-if="finderInfo" class="profile-card">
      <div class="profile-avatar">
        <img v-if="finderInfo.avatar" :src="finderInfo.avatar" alt="">
        <i v-else class="fas fa-video fa-2x" style="color:#FA9D3B;"></i>
      </div>
      <h4>{{ finderInfo.nickname || '视频号用户' }}</h4>
      <p class="profile-username">@{{ finderInfo.username || '-' }}</p>
      <div class="profile-stats">
        <div class="ps-item"><div class="ps-val">{{ finderInfo.following_count || 0 }}</div><div class="ps-lbl">关注</div></div>
        <div class="ps-item"><div class="ps-val">{{ finderInfo.followers_count || 0 }}</div><div class="ps-lbl">粉丝</div></div>
        <div class="ps-item"><div class="ps-val">{{ finderInfo.likes_count || 0 }}</div><div class="ps-lbl">获赞</div></div>
      </div>
    </div>

    <!-- 功能入口 -->
    <div class="feature-grid">
      <div class="feature-card" @click="activeTab = 'following'; loadData()">
        <i class="fas fa-user-plus" style="color:#07C160;"></i>
        <span>关注列表</span>
      </div>
      <div class="feature-card" @click="activeTab = 'videos'; loadData()">
        <i class="fas fa-film" style="color:#576B95;"></i>
        <span>视频</span>
      </div>
      <div class="feature-card" @click="activeTab = 'messages'; loadData()">
        <i class="fas fa-envelope" style="color:#FA9D3B;"></i>
        <span>消息</span>
      </div>
      <div class="feature-card" @click="activeTab = 'liked'; loadData()">
        <i class="fas fa-heart" style="color:#E53935;"></i>
        <span>点赞视频</span>
      </div>
    </div>

    <!-- 搜索 -->
    <div class="search-section">
      <div class="search-box">
        <i class="fas fa-search"></i>
        <input v-model="searchKeyword" placeholder="搜索视频号用户..." @keyup.enter="handleSearch">
      </div>
      <button class="btn-search" @click="handleSearch"><i class="fas fa-search"></i> 搜索</button>
    </div>

    <!-- 数据列表 -->
    <div v-if="loading" class="loading-state"><i class="fas fa-spinner fa-spin fa-2x" style="color:#07C160;"></i></div>
    <div v-else-if="!dataList.length" class="empty-state">
      <i class="fas fa-video fa-3x" style="color:#ddd;"></i>
      <p>{{ selectedRobotId ? '暂无数据' : '请选择微信账号' }}</p>
    </div>
    <div v-else class="data-list">
      <div v-for="item in dataList" :key="item.id" class="data-item">
        <div class="item-thumb" v-if="item.cover_url || item.avatar">
          <img :src="item.cover_url || item.avatar" alt="">
        </div>
        <div class="item-info">
          <div class="item-title">{{ item.title || item.nickname || item.content || '-' }}</div>
          <div class="item-meta">{{ item.create_time || item.username || '' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { wechatRobotApi } from '@/api/modules/wechatRobot'

const selectedRobotId = ref('')
const robots = ref([])
const finderInfo = ref(null)
const activeTab = ref('')
const searchKeyword = ref('')
const dataList = ref([])
const loading = ref(false)

async function loadRobots() {
  try {
    const res = await wechatRobotApi.getAccounts()
    robots.value = res?.data?.data || res?.data || []
    if (robots.value.length && !selectedRobotId.value) selectedRobotId.value = robots.value[0].id
  } catch { robots.value = [] }
}

async function loadFinderInfo() {
  if (!selectedRobotId.value) { finderInfo.value = null; return }
  try {
    const res = await wechatRobotApi.getFinderChannels(selectedRobotId.value, {})
    const d = res?.data?.data || res?.data || {}
    finderInfo.value = d.profile || d || null
    dataList.value = d.list || d.data || []
  } catch { finderInfo.value = null }
}

function loadData() { ElMessage.info('功能开发中') }
function handleSearch() { ElMessage.info('搜索功能开发中') }

onMounted(() => loadRobots().then(loadFinderInfo))
</script>

<style scoped>
.finder-page { max-width: 800px; margin: 0; }
.toolbar { margin-bottom: 20px; }
.robot-select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; min-width: 200px; }

.profile-card {
  background: #fff; border-radius: 16px; padding: 30px; text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 20px;
}
.profile-avatar {
  width: 80px; height: 80px; border-radius: 50%; overflow: hidden;
  margin: 0 auto 12px; background: #f7f7f7;
  display: flex; align-items: center; justify-content: center;
}
.profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
.profile-card h4 { margin: 0 0 4px; font-size: 1.1rem; }
.profile-username { color: #888; font-size: 0.85rem; margin: 0 0 16px; }
.profile-stats { display: flex; justify-content: center; gap: 40px; }
.ps-item { text-align: center; }
.ps-val { font-size: 1.2rem; font-weight: 600; color: #191919; }
.ps-lbl { font-size: 0.75rem; color: #888; }

.feature-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.feature-card {
  background: #fff; border-radius: 12px; padding: 20px; text-align: center;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06); cursor: pointer; transition: all 0.2s;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.feature-card:hover { transform: translateY(-3px); box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
.feature-card i { font-size: 24px; }
.feature-card span { font-size: 0.85rem; color: #555; }

.search-section { display: flex; gap: 10px; margin-bottom: 20px; }
.search-box { flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid #ddd; border-radius: 8px; background: #fff; }
.search-box i { color: #999; }
.search-box input { flex: 1; border: none; outline: none; font-size: 0.9rem; }
.btn-search { background: #07C160; border: none; color: #fff; padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; }

.loading-state, .empty-state { text-align: center; padding: 60px 20px; background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); color: #888; }
.empty-state p { margin-top: 16px; }

.data-list { display: flex; flex-direction: column; gap: 12px; }
.data-item { display: flex; gap: 14px; background: #fff; border-radius: 12px; padding: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.item-thumb { width: 80px; height: 60px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: #f0f0f0; }
.item-thumb img { width: 100%; height: 100%; object-fit: cover; }
.item-info { flex: 1; min-width: 0; }
.item-title { font-weight: 500; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-meta { color: #bbb; font-size: 0.78rem; margin-top: 4px; }

@media (max-width: 767px) { .feature-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
