<template>
  <div class="points-page" :class="{ 'is-mobile': isMobile }">
    <!-- 移动端返回头部 -->
    <div v-if="isMobile" class="m-page-header">
      <router-link to="/user/dashboard" class="m-back-btn"><i class="fas fa-arrow-left"></i></router-link>
      <span class="m-page-title">积分中心</span>
      <span></span>
    </div>

    <!-- 积分总览卡片 -->
    <div class="points-hero">
      <div class="hero-bg">
        <div class="hero-circle c1"></div>
        <div class="hero-circle c2"></div>
      </div>
      <div class="hero-content">
        <div class="hero-label"><i class="fas fa-coins"></i> 我的积分</div>
        <div class="hero-amount">{{ formatNum(pointsInfo.points ?? 0) }}</div>
        <div class="hero-sub">累计获得 {{ formatNum(pointsInfo.total_earned ?? 0) }} · 累计消耗 {{ formatNum(pointsInfo.total_spent ?? 0) }}</div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="action-row">
      <div class="action-item" @click="scrollToHistory">
        <div class="action-icon" style="background: linear-gradient(135deg, #667eea, #764ba2)"><i class="fas fa-history"></i></div>
        <span>积分明细</span>
      </div>
      <div class="action-item">
        <div class="action-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c)"><i class="fas fa-gift"></i></div>
        <span>积分商城</span>
      </div>
      <div class="action-item">
        <div class="action-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe)"><i class="fas fa-tasks"></i></div>
        <span>赚积分</span>
      </div>
      <div class="action-item">
        <div class="action-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7)"><i class="fas fa-question-circle"></i></div>
        <span>积分规则</span>
      </div>
    </div>

    <!-- 积分明细 -->
    <div class="history-section" ref="historyRef">
      <div class="section-header">
        <span class="section-title"><i class="fas fa-list-ul"></i> 积分明细</span>
        <span class="section-total">共 {{ total }} 条记录</span>
      </div>

      <div v-loading="loading" class="history-list">
        <!-- 有数据 -->
        <template v-if="history.length">
          <div class="history-item" v-for="item in history" :key="item.id">
            <div class="hi-left">
              <div class="hi-icon" :class="item.points > 0 ? 'income' : 'expense'">
                <i :class="item.points > 0 ? 'fas fa-plus' : 'fas fa-minus'"></i>
              </div>
              <div class="hi-info">
                <div class="hi-title">{{ item.type_label || item.type || '积分变动' }}</div>
                <div class="hi-desc">{{ item.description || '-' }}</div>
                <div class="hi-time">{{ formatTime(item.created_at) }}</div>
              </div>
            </div>
            <div class="hi-amount" :class="item.points > 0 ? 'income' : 'expense'">
              {{ item.points > 0 ? '+' : '' }}{{ item.points }}
            </div>
          </div>
        </template>

        <!-- 空状态 -->
        <div v-else-if="!loading" class="empty-state">
          <div class="empty-icon"><i class="fas fa-coins"></i></div>
          <div class="empty-text">暂无积分记录</div>
          <div class="empty-hint">完成任务或邀请好友即可获得积分</div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="total > pageSize" class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          small
          @current-change="loadHistory"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import api from '@/api'

const isMobile = ref(window.innerWidth < 768)
const historyRef = ref(null)

function handleResize() { isMobile.value = window.innerWidth < 768 }

const pointsInfo = reactive({ points: 0, total_earned: 0, total_spent: 0 })
const history = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

function formatNum(n) { return Number(n || 0).toLocaleString() }

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return t
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function scrollToHistory() {
  historyRef.value?.scrollIntoView({ behavior: 'smooth' })
}

async function loadPoints() {
  try {
    const res = await api.get('/user/points')
    const data = res.data?.data || res.data || {}
    Object.assign(pointsInfo, data)
  } catch { /* ignore */ }
}

async function loadHistory() {
  loading.value = true
  try {
    const res = await api.get('/user/points/history', {
      params: { page: page.value, pageSize: pageSize.value },
    })
    const d = res.data?.data || res.data
    history.value = Array.isArray(d) ? d : []
    total.value = res.data?.pagination?.total || res.data?.total || 0
  } catch { /* ignore */ }
  loading.value = false
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  loadPoints()
  loadHistory()
})
onBeforeUnmount(() => { window.removeEventListener('resize', handleResize) })
</script>

<style scoped>
/* 页面容器 */
.points-page { max-width: 800px; margin: 0 auto; padding: 20px; }
.points-page.is-mobile { padding: 0; margin: -24px; background: #f5f6fa; min-height: 100vh; }

/* 移动端头部 */
.m-page-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: #fff; border-bottom: 1px solid #f0f0f0;
  position: sticky; top: 0; z-index: 10;
}
.m-back-btn { color: #333; font-size: 16px; text-decoration: none; width: 32px; }
.m-page-title { font-size: 16px; font-weight: 600; color: #333; }

/* 积分总览 Hero 卡片 */
.points-hero {
  position: relative; overflow: hidden; border-radius: 16px;
  background: linear-gradient(135deg, #FF9800, #F57C00, #EF6C00);
  color: #fff; padding: 28px 24px; margin-bottom: 16px;
}
.is-mobile .points-hero { border-radius: 0; margin-bottom: 0; }
.hero-bg { position: absolute; inset: 0; pointer-events: none; }
.hero-circle {
  position: absolute; border-radius: 50%; opacity: 0.12;
  background: #fff;
}
.hero-circle.c1 { width: 160px; height: 160px; top: -40px; right: -30px; }
.hero-circle.c2 { width: 100px; height: 100px; bottom: -20px; right: 60px; }
.hero-content { position: relative; z-index: 1; }
.hero-label { font-size: 13px; opacity: 0.9; margin-bottom: 6px; }
.hero-label i { margin-right: 4px; }
.hero-amount { font-size: 42px; font-weight: 800; letter-spacing: -1px; line-height: 1.1; margin-bottom: 8px; }
.hero-sub { font-size: 12px; opacity: 0.75; }

/* 快捷操作 */
.action-row {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  background: #fff; border-radius: 12px; padding: 16px 12px; margin-bottom: 16px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.05);
}
.is-mobile .action-row { border-radius: 0; margin-bottom: 8px; box-shadow: none; border-bottom: 8px solid #f5f6fa; }
.action-item {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  cursor: pointer; transition: transform 0.2s;
}
.action-item:active { transform: scale(0.95); }
.action-icon {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 16px; box-shadow: 0 3px 10px rgba(0,0,0,0.12);
}
.action-item span { font-size: 11px; color: #666; font-weight: 500; }

/* 积分明细区域 */
.history-section {
  background: #fff; border-radius: 12px; padding: 16px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.05);
}
.is-mobile .history-section { border-radius: 0; padding: 12px 14px; box-shadow: none; }
.section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f0f0f0;
}
.section-title { font-size: 15px; font-weight: 600; color: #333; }
.section-title i { margin-right: 6px; color: #FF9800; }
.section-total { font-size: 12px; color: #999; }

/* 列表项 */
.history-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 0; border-bottom: 1px solid #f8f8f8;
  transition: background 0.15s;
}
.history-item:last-child { border-bottom: none; }
.history-item:hover { background: #fafafa; }
.hi-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.hi-icon {
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; flex-shrink: 0;
}
.hi-icon.income { background: #e8f5e9; color: #4CAF50; }
.hi-icon.expense { background: #fce4ec; color: #e91e63; }
.hi-info { flex: 1; min-width: 0; }
.hi-title { font-size: 13px; font-weight: 600; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hi-desc { font-size: 11px; color: #999; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hi-time { font-size: 10px; color: #bbb; margin-top: 2px; }
.hi-amount {
  font-size: 16px; font-weight: 700; flex-shrink: 0; margin-left: 12px;
}
.hi-amount.income { color: #4CAF50; }
.hi-amount.expense { color: #e91e63; }

/* 空状态 */
.empty-state { text-align: center; padding: 40px 20px; }
.empty-icon { font-size: 48px; color: #ddd; margin-bottom: 12px; }
.empty-text { font-size: 14px; color: #999; margin-bottom: 4px; }
.empty-hint { font-size: 12px; color: #ccc; }

/* 分页 */
.pagination-wrap { display: flex; justify-content: center; padding: 16px 0 4px; }
</style>
