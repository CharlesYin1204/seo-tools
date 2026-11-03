<template>
  <div class="analytics-plugin">
    <div class="plugin-card">
      <div class="plugin-card-header"><i class="fas fa-chart-bar me-2"></i>数据统计分析</div>
      <div class="plugin-card-body">
        <div class="stats-grid mb-4">
          <div class="stat-box stat-blue"><div class="stat-icon"><i class="fas fa-home"></i></div><div class="stat-content"><div class="stat-value">{{ data.totalProperties }}</div><div class="stat-label">内容资产总数</div></div></div>
          <div class="stat-box stat-green"><div class="stat-icon"><i class="fas fa-robot"></i></div><div class="stat-content"><div class="stat-value">{{ data.parsedProperties }}</div><div class="stat-label">自动识别</div></div></div>
          <div class="stat-box stat-purple"><div class="stat-icon"><i class="fas fa-eye"></i></div><div class="stat-content"><div class="stat-value">{{ data.totalViews }}</div><div class="stat-label">总浏览量</div></div></div>
          <div class="stat-box stat-orange"><div class="stat-icon"><i class="fas fa-share-alt"></i></div><div class="stat-content"><div class="stat-value">{{ data.totalShares }}</div><div class="stat-label">分享次数</div></div></div>
        </div>

        <div class="chart-section">
          <h6><i class="fas fa-chart-line me-1"></i>近30天内容资产趋势</h6>
          <div class="chart-container" ref="chartContainer">
            <canvas ref="chartCanvas" width="800" height="300"></canvas>
          </div>
        </div>

        <div class="row mt-4">
          <div class="col-md-6">
            <div class="data-card">
              <h6><i class="fas fa-bullseye me-1"></i>运营建议</h6>
              <ul class="tips-list">
                <li v-for="(tip, i) in tips" :key="i"><i class="fas fa-check-circle text-success me-1"></i>{{ tip }}</li>
              </ul>
            </div>
          </div>
          <div class="col-md-6">
            <div class="data-card">
              <h6><i class="fas fa-trophy me-1"></i>数据排行</h6>
              <div v-if="data.totalProperties > 0" class="rank-info">
                <div class="rank-item"><span>平均浏览量</span><strong>{{ data.totalViews > 0 ? Math.round(data.totalViews / data.totalProperties) : 0 }}</strong></div>
                <div class="rank-item"><span>自动识别率</span><strong>{{ data.totalProperties > 0 ? Math.round(data.parsedProperties / data.totalProperties * 100) : 0 }}%</strong></div>
                <div class="rank-item"><span>分享转化率</span><strong>{{ data.totalViews > 0 ? Math.round(data.totalShares / data.totalViews * 100) : 0 }}%</strong></div>
              </div>
              <div v-else class="text-center text-muted py-3">暂无数据</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import api from '@/api'

defineProps({ plugin: Object })

const data = reactive({ totalProperties: 0, parsedProperties: 0, totalViews: 0, totalShares: 0, recentTrend: [] })
const chartCanvas = ref(null)

const tips = ref([
  '定期更新内容资产信息，保持内容新鲜度',
  '为内容资产添加高质量图片和详细描述',
  '利用微信机器人自动分享内容资产到群组',
  '及时跟进客户询问，提高转化率',
  '关注高浏览量内容资产的特征，优化其他内容资产'
])

const loadData = async () => {
  try {
    const res = await api.get('/user/plugin-exec/analytics')
    Object.assign(data, res.data?.data || {})
    await nextTick()
    drawChart()
  } catch {}
}

const drawChart = () => {
  const canvas = chartCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height
  const trend = data.recentTrend || []
  ctx.clearRect(0, 0, W, H)

  if (!trend.length) {
    ctx.fillStyle = '#ccc'; ctx.font = '14px system-ui'; ctx.textAlign = 'center'
    ctx.fillText('暂无趋势数据', W / 2, H / 2)
    return
  }

  const padding = { top: 30, right: 20, bottom: 40, left: 50 }
  const chartW = W - padding.left - padding.right
  const chartH = H - padding.top - padding.bottom
  const maxVal = Math.max(...trend.map(t => t.count), 1)

  ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 0.5
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(W - padding.right, y); ctx.stroke()
    ctx.fillStyle = '#999'; ctx.font = '11px system-ui'; ctx.textAlign = 'right'
    ctx.fillText(Math.round(maxVal - (maxVal / 4) * i), padding.left - 8, y + 4)
  }

  const gradient = ctx.createLinearGradient(0, padding.top, 0, H - padding.bottom)
  gradient.addColorStop(0, 'rgba(72,121,255,0.3)'); gradient.addColorStop(1, 'rgba(72,121,255,0)')

  ctx.beginPath()
  trend.forEach((t, i) => {
    const x = padding.left + (chartW / (trend.length - 1 || 1)) * i
    const y = padding.top + chartH - (t.count / maxVal) * chartH
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  const lastX = padding.left + chartW
  ctx.lineTo(lastX, padding.top + chartH); ctx.lineTo(padding.left, padding.top + chartH); ctx.closePath()
  ctx.fillStyle = gradient; ctx.fill()

  ctx.beginPath(); ctx.strokeStyle = '#4879FF'; ctx.lineWidth = 2
  trend.forEach((t, i) => {
    const x = padding.left + (chartW / (trend.length - 1 || 1)) * i
    const y = padding.top + chartH - (t.count / maxVal) * chartH
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()

  trend.forEach((t, i) => {
    const x = padding.left + (chartW / (trend.length - 1 || 1)) * i
    const y = padding.top + chartH - (t.count / maxVal) * chartH
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = '#4879FF'; ctx.fill()
    ctx.fillStyle = '#666'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'
    if (i % Math.ceil(trend.length / 8) === 0) {
      const dateStr = t.date?.substring(5) || ''
      ctx.fillText(dateStr, x, H - padding.bottom + 16)
    }
  })
}

onMounted(loadData)
</script>

<style scoped>
.plugin-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.plugin-card-header { padding: 16px 20px; background: linear-gradient(135deg, #4879FF, #00b4d8); color: #fff; font-size: 16px; font-weight: 600; }
.plugin-card-body { padding: 20px; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
@media (max-width: 768px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
.stat-box { display: flex; align-items: center; padding: 16px; border-radius: 10px; }
.stat-blue { background: linear-gradient(135deg, #e3f2fd, #bbdefb); }
.stat-green { background: linear-gradient(135deg, #e8f5e9, #c8e6c9); }
.stat-purple { background: linear-gradient(135deg, #f3e5f5, #e1bee7); }
.stat-orange { background: linear-gradient(135deg, #fff3e0, #ffe0b2); }
.stat-icon { font-size: 28px; margin-right: 14px; opacity: 0.6; }
.stat-value { font-size: 24px; font-weight: 700; }
.stat-label { font-size: 12px; color: #666; }
.chart-section h6 { font-size: 14px; margin-bottom: 12px; }
.chart-container { background: #fafafa; border-radius: 8px; padding: 10px; }
.chart-container canvas { width: 100%; height: auto; }
.data-card { background: #f8f9fa; border-radius: 8px; padding: 16px; }
.data-card h6 { font-size: 14px; margin-bottom: 10px; }
.tips-list { list-style: none; padding: 0; margin: 0; }
.tips-list li { padding: 6px 0; font-size: 13px; border-bottom: 1px solid #eee; }
.rank-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px; }
</style>
