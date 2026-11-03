<template>
  <div class="wechat-robot-page">
    <!-- 统计卡片 -->
    <div class="stat-cards">
      <div class="stat-card">
        <div class="icon-box" style="background: linear-gradient(135deg, #07C160, #06AD56);"><i class="fab fa-weixin"></i></div>
        <div class="stat-value">{{ accounts.length }}</div>
        <div class="stat-label">微信账号</div>
      </div>
      <div class="stat-card">
        <div class="icon-box" style="background: linear-gradient(135deg, #576B95, #4A5A7D);"><i class="fas fa-user-friends"></i></div>
        <div class="stat-value">{{ formatNum(stats.total_contacts) }}</div>
        <div class="stat-label">好友总数</div>
      </div>
      <div class="stat-card">
        <div class="icon-box" style="background: linear-gradient(135deg, #FA9D3B, #E88B28);"><i class="fas fa-users"></i></div>
        <div class="stat-value">{{ formatNum(stats.total_groups) }}</div>
        <div class="stat-label">群聊总数</div>
      </div>
      <div class="stat-card">
        <div class="icon-box" style="background: linear-gradient(135deg, #9B59B6, #8E44AD);"><i class="fas fa-comments"></i></div>
        <div class="stat-value">{{ formatNum(stats.total_messages) }}</div>
        <div class="stat-label">消息总数</div>
      </div>
    </div>

    <!-- 防封提示 -->
    <div class="anti-block-tip">
      <div class="tip-left">
        <div class="tip-icon"><i class="fas fa-shield-alt"></i></div>
        <div>
          <h6><i class="fas fa-exclamation-circle"></i> 防封必看</h6>
          <p>使用微信机器人前，请务必阅读防封指南，保护您的账号安全</p>
        </div>
      </div>
      <button class="btn-guide" @click="$router.push('/admin/wechat-robot')"><i class="fas fa-book-reader"></i> 查看指南</button>
    </div>

    <!-- 账号列表标题 -->
    <div class="section-header">
      <h5><i class="fab fa-weixin" style="color:#07C160;"></i> {{ isAdmin ? '微信账号管理' : '我的微信账号' }}</h5>
      <button v-if="isAdmin" class="btn-add" @click="handleAddAccount"><i class="fas fa-plus"></i> 添加微信</button>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && !accounts.length" class="empty-state">
      <div class="empty-icon"><i class="fab fa-weixin"></i></div>
      <h3>{{ isAdmin ? '还没有添加微信账号' : '暂无微信账号' }}</h3>
      <p>{{ isAdmin ? '添加您的个人微信，开启智能机器人功能' : '请联系管理员配置微信账号' }}</p>
      <button v-if="isAdmin" class="btn-add lg" @click="handleAddAccount"><i class="fas fa-plus"></i> 添加微信账号</button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" style="text-align:center;padding:60px 0;">
      <i class="fas fa-spinner fa-spin fa-2x" style="color:#07C160;"></i>
      <p style="color:#888;margin-top:16px;">加载中...</p>
    </div>

    <!-- 账号卡片列表 -->
    <div v-if="!loading && accounts.length" class="account-grid">
      <div v-for="acc in accounts" :key="acc.id" class="account-card" :data-robot-id="acc.id">
        <div class="account-header">
          <div class="account-avatar">
            <img v-if="acc.avatar" :src="acc.avatar" alt="头像">
            <i v-else class="fab fa-weixin"></i>
          </div>
          <div class="account-info">
            <h5 class="account-name">{{ acc.nickname || '未登录' }}</h5>
            <p class="account-wxid">{{ acc.wxid || '待扫码登录' }}</p>
          </div>
          <span class="status-badge" :class="getDisplayStatus(acc)">{{ statusText(getDisplayStatus(acc)) }}</span>
          <span v-if="acc.is_default" class="default-badge"><i class="fas fa-star"></i> 默认</span>
        </div>
        <!-- 离线错误提示 -->
        <div v-if="acc._offlineMsg" class="offline-tip">
          <i class="fas fa-exclamation-circle"></i> {{ acc._offlineMsg }}
        </div>
        <div class="account-body">
          <div class="account-stats">
            <div class="stat-item">
              <div class="stat-val">{{ accountStat(acc.id, 'contacts') }}</div>
              <div class="stat-lbl">好友</div>
            </div>
            <div class="stat-item">
              <div class="stat-val">{{ accountStat(acc.id, 'groups') }}</div>
              <div class="stat-lbl">群聊</div>
            </div>
            <div class="stat-item">
              <div class="stat-val">{{ accountStat(acc.id, 'messages') }}</div>
              <div class="stat-lbl">消息</div>
            </div>
          </div>
          <div class="account-actions">
            <template v-if="acc.status === 'online'">
              <button class="btn-primary-sm grow" @click="$router.push(isAdmin ? '/admin/wechat-robot/messages' : '/user/wechat-robot/messages')"><i class="fas fa-comment"></i> 消息</button>
              <button v-if="isAdmin" class="btn-outline-sm" @click="handleLogout(acc)"><i class="fas fa-sign-out-alt"></i></button>
            </template>
            <template v-else-if="acc.status === 'logging' && isAdmin">
              <button class="btn-warning-sm grow" @click="showQrCode(acc.id)"><i class="fas fa-qrcode"></i> 查看二维码</button>
            </template>
            <template v-else-if="isAdmin">
              <button class="btn-primary-sm grow" @click="loginAccount(acc.id)"><i class="fas fa-qrcode"></i> 扫码登录</button>
            </template>
            <template v-else>
              <span class="status-text-offline">未登录</span>
            </template>
            <button v-if="isAdmin" class="btn-default-sm" :class="{ active: acc.is_default }" @click="toggleDefault(acc)" :title="acc.is_default ? '取消默认' : '设为默认'"><i class="fas fa-star"></i></button>
            <button v-if="isAdmin" class="btn-danger-sm" @click="handleDelete(acc)"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>
    </div>

    <!-- 二维码弹窗 -->
    <el-dialog v-model="showQrDialog" title="" width="420px" :close-on-click-modal="false" @close="onQrDialogClose" class="qr-dialog">
      <div class="qr-dialog-inner">
        <h5 class="qr-title"><i class="fab fa-weixin" style="color:#07C160;"></i> 微信扫码登录</h5>
        <!-- 区域选择 -->
        <div class="region-select">
          <label><span style="color:#E53935;">*</span> 选择区域：</label>
          <select v-model="selectedRegion" @change="onRegionChange" class="region-dropdown">
            <option value="">请选择代理地区</option>
            <option v-for="r in regions" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
          <p class="region-hint"><i class="fas fa-info-circle"></i> 请选择您所在的区域，不同区域使用不同的代理服务器</p>
        </div>
        <!-- 二维码显示区 -->
        <div class="qrcode-box">
          <template v-if="qrLoading">
            <i class="fas fa-spinner fa-spin fa-2x" style="color:#07C160;"></i>
            <p>正在获取二维码...</p>
          </template>
          <template v-else-if="qrCodeUrl">
            <img :src="qrCodeUrl" alt="登录二维码">
          </template>
          <template v-else-if="qrError">
            <i class="fas fa-exclamation-circle fa-2x" style="color:#E53935;"></i>
            <p style="color:#E53935;">{{ qrError }}</p>
          </template>
          <template v-else>
            <i class="fas fa-map-marker-alt fa-2x" style="color:#ddd;"></i>
            <p>请先选择登录区域</p>
          </template>
        </div>
        <p v-if="qrCodeUrl && !qrStatusMsg" class="qr-hint">请使用微信扫描上方二维码登录</p>
        <!-- 状态提示 -->
        <div v-if="qrStatusMsg" class="qr-status" :class="qrStatusType">
          <i :class="qrStatusIcon"></i> {{ qrStatusMsg }}
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import api from '@/api'

const route = useRoute()
const isAdmin = computed(() => route.path.startsWith('/admin'))
function apiPrefix() { return isAdmin.value ? '/admin' : '/user' }

const loading = ref(true)
const accounts = ref([])
const stats = reactive({ total_contacts: 0, total_groups: 0, total_messages: 0, accounts: {} })
const showQrDialog = ref(false)
const currentRobotId = ref(null)
const selectedRegion = ref('')
const qrCodeUrl = ref('')
const qrLoading = ref(false)
const qrError = ref('')
const qrStatusMsg = ref('')
const qrStatusType = ref('')
const qrStatusIcon = ref('')

let statusCheckTimer = null
let deviceCheckTimer = null

const regions = [
  { value: '110000', label: '北京市' }, { value: '120000', label: '天津市' },
  { value: '130000', label: '河北省' }, { value: '140000', label: '山西省' },
  { value: '150000', label: '内蒙古自治区' }, { value: '210000', label: '辽宁省' },
  { value: '220000', label: '吉林省' }, { value: '230000', label: '黑龙江省' },
  { value: '310000', label: '上海市' }, { value: '320000', label: '江苏省' },
  { value: '330000', label: '浙江省' }, { value: '340000', label: '安徽省' },
  { value: '350000', label: '福建省' }, { value: '360000', label: '江西省' },
  { value: '370000', label: '山东省' }, { value: '410000', label: '河南省' },
  { value: '420000', label: '湖北省' }, { value: '430000', label: '湖南省' },
  { value: '440000', label: '广东省' }, { value: '450000', label: '广西壮族自治区' },
  { value: '460000', label: '海南省' }, { value: '500000', label: '重庆市' },
  { value: '510000', label: '四川省' }, { value: '520000', label: '贵州省' },
  { value: '530000', label: '云南省' }, { value: '540000', label: '西藏自治区' },
  { value: '610000', label: '陕西省' }, { value: '620000', label: '甘肃省' },
  { value: '630000', label: '青海省' }, { value: '640000', label: '宁夏回族自治区' },
  { value: '650000', label: '新疆维吾尔自治区' },
]

function formatNum(n) {
  if (!n && n !== 0) return '-'
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return String(n)
}
function getDisplayStatus(acc) {
  if (!acc.wxid && acc.status === 'online') return 'logging'
  return acc.status || 'offline'
}
function statusText(s) {
  return { online: '在线', offline: '离线', logging: '登录中', error: '异常' }[s] || '未知'
}
function accountStat(robotId, key) {
  return stats.accounts?.[robotId]?.[key] ?? '-'
}

async function loadData() {
  loading.value = true
  try {
    const [accRes, statRes] = await Promise.allSettled([
      api.get(`${apiPrefix()}/wechat-robot/accounts`),
      api.get(`${apiPrefix()}/wechat-robot/stats`),
    ])
    accounts.value = accRes.status === 'fulfilled' ? (accRes.value?.data?.data || accRes.value?.data || []) : []
    if (statRes.status === 'fulfilled') {
      const d = statRes.value?.data?.data || statRes.value?.data || {}
      stats.total_contacts = d.total_contacts || 0
      stats.total_groups = d.total_groups || 0
      stats.total_messages = d.total_messages || 0
      stats.accounts = d.accounts || {}
    }
  } catch { accounts.value = [] }
  loading.value = false
}

async function handleAddAccount() {
  try {
    const res = await api.post(`${apiPrefix()}/wechat-robot/accounts`, { nickname: '微信账号' })
    const robotId = res?.data?.data?.id || res?.data?.id
    if (robotId) {
      ElMessage.success('账号创建成功，请扫码登录')
      currentRobotId.value = robotId
      await loadData()
      showLoginModal(robotId)
    } else {
      ElMessage.error('创建失败')
    }
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || '创建失败')
  }
}

function loginAccount(robotId) {
  currentRobotId.value = robotId
  showLoginModal(robotId)
}
function showQrCode(robotId) {
  currentRobotId.value = robotId
  showLoginModal(robotId)
}

function showLoginModal(robotId) {
  currentRobotId.value = robotId
  selectedRegion.value = ''
  qrCodeUrl.value = ''
  qrLoading.value = false
  qrError.value = ''
  qrStatusMsg.value = ''
  showQrDialog.value = true
}

async function onRegionChange() {
  if (!selectedRegion.value || !currentRobotId.value) return
  qrLoading.value = true
  qrCodeUrl.value = ''
  qrError.value = ''
  qrStatusMsg.value = ''
  try {
    const url = isAdmin.value
      ? `/admin/wechat-robot/${currentRobotId.value}/qrcode`
      : `/user/wechat-robot/qrcode/${currentRobotId.value}`
    const res = await api.get(url, { params: { region_id: selectedRegion.value } })
    const d = res?.data?.data || res?.data || {}
    if (d.qrcode_url) {
      qrCodeUrl.value = d.qrcode_url
      startStatusCheck(currentRobotId.value)
    } else {
      qrError.value = '获取二维码失败，请稍后重试'
    }
  } catch (err) {
    qrError.value = err?.response?.data?.message || '网络错误'
  }
  qrLoading.value = false
}

function startStatusCheck(robotId) {
  clearStatusCheck()
  statusCheckTimer = setInterval(() => checkLogin(robotId), 3000)
}
function clearStatusCheck() {
  if (statusCheckTimer) { clearInterval(statusCheckTimer); statusCheckTimer = null }
}

async function checkLogin(robotId) {
  try {
    const url = isAdmin.value
      ? `/admin/wechat-robot/${robotId}/login-status`
      : `/user/wechat-robot/check-status/${robotId}`
    const res = await api.get(url)
    const d = res?.data?.data || res?.data || {}
    if (d.status === 'online' || d.loginStatus === 2) {
      clearStatusCheck()
      qrStatusMsg.value = '登录成功！正在刷新页面...'
      qrStatusType.value = 'success'
      qrStatusIcon.value = 'fas fa-check-circle'
      setTimeout(() => { showQrDialog.value = false; loadData() }, 1500)
    } else if (d.loginStatus === 1) {
      qrStatusMsg.value = d.message || '已扫码，请在手机上点击"登录"按钮完成验证'
      qrStatusType.value = 'info'
      qrStatusIcon.value = 'fas fa-mobile-alt'
    } else if (d.loginStatus === 0) {
      qrStatusMsg.value = d.message || '等待扫码...'
      qrStatusType.value = 'info'
      qrStatusIcon.value = 'fas fa-qrcode'
    } else if (d.message) {
      qrStatusMsg.value = d.message
      qrStatusType.value = 'info'
      qrStatusIcon.value = 'fas fa-info-circle'
    }
  } catch (err) {
    console.error('checkLogin polling error:', err)
  }
}

function onQrDialogClose() {
  clearStatusCheck()
}

async function handleLogout(acc) {
  try {
    await ElMessageBox.confirm('确定要退出该微信账号吗？', '提示', { type: 'warning' })
    const url = isAdmin.value
      ? `/admin/wechat-robot/${acc.id}/logout`
      : `/user/wechat-robot/logout/${acc.id}`
    await api.post(url)
    ElMessage.success('已退出登录')
    loadData()
  } catch {}
}

async function toggleDefault(acc) {
  try {
    const res = await api.post(`${apiPrefix()}/wechat-robot/accounts/${acc.id}/set-default`)
    ElMessage.success(res.data?.message || '操作成功')
    loadData()
  } catch {
    ElMessage.error('操作失败')
  }
}

async function handleDelete(acc) {
  try {
    await ElMessageBox.confirm('确定要删除该微信账号吗？此操作不可恢复。', '提示', { type: 'warning' })
    await api.delete(`${apiPrefix()}/wechat-robot/accounts/${acc.id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

function startDeviceCheck() {
  deviceCheckTimer = setInterval(checkAllDevices, 30000)
  checkAllDevices()
}
async function checkAllDevices() {
  for (let i = 0; i < accounts.value.length; i++) {
    const acc = accounts.value[i]
    try {
      const url = isAdmin.value
        ? `/admin/wechat-robot/${acc.id}/device-status`
        : `/user/wechat-robot/check-device-status/${acc.id}`
      const res = await api.get(url)
      const d = res?.data?.data || res?.data || {}
      if (d.status_changed) {
        acc.status = d.status
        if (d.status === 'offline' && d.message) acc._offlineMsg = d.message
        else acc._offlineMsg = ''
      }
    } catch {}
    if (i < accounts.value.length - 1) await new Promise(r => setTimeout(r, 500))
  }
}

onMounted(() => { loadData().then(startDeviceCheck) })
onBeforeUnmount(() => { clearStatusCheck(); if (deviceCheckTimer) clearInterval(deviceCheckTimer) })
</script>

<style scoped>
.wechat-robot-page { max-width: 1200px; margin: 0; }

/* 统计卡片 */
.stat-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card {
  background: #fff; border-radius: 16px; padding: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08); transition: all 0.3s ease;
}
.stat-card:hover { transform: translateY(-5px); box-shadow: 0 8px 30px rgba(0,0,0,0.12); }
.stat-card .icon-box {
  width: 56px; height: 56px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; color: #fff; margin-bottom: 16px;
}
.stat-card .stat-value { font-size: 2rem; font-weight: 700; color: #191919; line-height: 1.2; }
.stat-card .stat-label { font-size: 0.9rem; color: #888; margin-top: 4px; }

/* 防封提示 */
.anti-block-tip {
  background: linear-gradient(135deg, #FFF5F5, #FFE8E8); border-radius: 16px;
  padding: 16px 24px; margin-bottom: 24px;
  display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}
.tip-left { display: flex; align-items: center; gap: 16px; }
.tip-icon {
  width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0;
  background: linear-gradient(135deg, #E53935, #C62828);
  display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px;
}
.anti-block-tip h6 { color: #C62828; font-weight: 600; margin: 0 0 4px; font-size: 0.95rem; }
.anti-block-tip p { color: #888; margin: 0; font-size: 0.88rem; }
.btn-guide {
  background: transparent; border: 1px solid #E53935; color: #E53935;
  padding: 6px 14px; border-radius: 8px; cursor: pointer; white-space: nowrap;
  font-size: 0.85rem; transition: all 0.2s;
}
.btn-guide:hover { background: #E53935; color: #fff; }

/* 列表标题 */
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-header h5 { margin: 0; font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.btn-add {
  background: #07C160; border: none; color: #fff; border-radius: 10px;
  padding: 10px 20px; font-weight: 500; cursor: pointer; font-size: 0.9rem; transition: all 0.3s;
}
.btn-add:hover { background: #06AD56; transform: translateY(-2px); }
.btn-add.lg { padding: 12px 28px; font-size: 1rem; }

/* 空状态 */
.empty-state {
  text-align: center; padding: 60px 20px; background: #fff;
  border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}
.empty-icon {
  width: 100px; height: 100px; border-radius: 50%;
  background: linear-gradient(135deg, #07C160, #06AD56);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 24px; font-size: 40px; color: #fff;
}
.empty-state h3 { font-size: 1.3rem; color: #191919; margin-bottom: 12px; }
.empty-state p { color: #888; margin-bottom: 24px; }

/* 账号卡片 */
.account-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
.account-card {
  background: #fff; border-radius: 16px; overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08); transition: all 0.3s;
}
.account-card:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(0,0,0,0.12); }
.account-header {
  padding: 20px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  border-bottom: 1px solid #E5E5E5;
}
.account-avatar {
  width: 60px; height: 60px; border-radius: 12px; overflow: hidden;
  background: #F7F7F7; display: flex; align-items: center; justify-content: center;
  font-size: 24px; color: #07C160; flex-shrink: 0;
}
.account-avatar img { width: 100%; height: 100%; object-fit: cover; }
.account-info { flex: 1; margin-left: 16px; min-width: 0; }
.account-name { font-size: 1.1rem; font-weight: 600; color: #191919; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-wxid { font-size: 0.85rem; color: #888; margin: 4px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.status-badge { padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 500; flex-shrink: 0; }
.status-badge.online { background: rgba(7,193,96,0.1); color: #07C160; }
.status-badge.offline { background: rgba(136,136,136,0.1); color: #888; }
.status-badge.logging { background: rgba(250,157,59,0.1); color: #FA9D3B; }
.status-badge.error { background: rgba(250,81,81,0.1); color: #FA5151; }

.offline-tip {
  background: #FFF3CD; padding: 8px 16px; font-size: 0.85rem; color: #856404;
  border-bottom: 1px solid #FFE69C;
}

.account-body { padding: 20px; }
.account-stats { display: flex; gap: 20px; margin-bottom: 16px; }
.stat-item { text-align: center; flex: 1; }
.stat-val { font-size: 1.2rem; font-weight: 600; color: #191919; }
.stat-lbl { font-size: 0.75rem; color: #888; }

.account-actions { display: flex; gap: 8px; }
.btn-primary-sm {
  background: #07C160; border: none; color: #fff; border-radius: 10px;
  padding: 8px 16px; font-size: 0.85rem; cursor: pointer; transition: all 0.3s;
}
.btn-primary-sm:hover { background: #06AD56; }
.btn-outline-sm {
  background: transparent; border: 1px solid #07C160; color: #07C160;
  border-radius: 10px; padding: 8px 12px; cursor: pointer; transition: all 0.3s;
}
.btn-outline-sm:hover { background: #07C160; color: #fff; }
.btn-warning-sm {
  background: #FA9D3B; border: none; color: #fff; border-radius: 10px;
  padding: 8px 16px; font-size: 0.85rem; cursor: pointer;
}
.btn-danger-sm {
  background: transparent; border: 1px solid #E53935; color: #E53935;
  border-radius: 10px; padding: 8px 12px; cursor: pointer; transition: all 0.3s;
}
.btn-danger-sm:hover { background: #E53935; color: #fff; }
.btn-default-sm {
  background: transparent; border: 1px solid #ccc; color: #999;
  border-radius: 10px; padding: 8px 12px; cursor: pointer; transition: all 0.3s;
}
.btn-default-sm:hover { border-color: #FFB300; color: #FFB300; }
.btn-default-sm.active { background: #FFF8E1; border-color: #FFB300; color: #FFB300; }
.default-badge {
  display: inline-flex; align-items: center; gap: 4px;
  background: linear-gradient(135deg, #FFB300, #FF8F00); color: white;
  font-size: 11px; font-weight: 600; padding: 3px 10px;
  border-radius: 12px; margin-left: 8px;
}
.grow { flex: 1; }
.status-text-offline { color: #888; font-size: 0.85rem; flex: 1; text-align: center; }

/* 二维码弹窗 */
.qr-dialog-inner { text-align: center; }
.qr-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; gap: 8px; }
.region-select { margin-bottom: 20px; text-align: left; }
.region-select label { display: block; margin-bottom: 6px; font-size: 0.9rem; }
.region-dropdown {
  width: 100%; max-width: 300px; margin: 0 auto; display: block;
  padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem;
}
.region-hint { color: #888; font-size: 0.8rem; margin-top: 6px; }
.qrcode-box {
  width: 240px; height: 240px; margin: 0 auto 16px; padding: 16px;
  background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #888;
}
.qrcode-box img { width: 100%; height: 100%; object-fit: contain; }
.qrcode-box p { margin: 8px 0 0; font-size: 0.85rem; }
.qr-hint { color: #888; font-size: 0.88rem; }
.qr-status {
  padding: 10px 16px; border-radius: 8px; margin-top: 12px; font-size: 0.9rem;
}
.qr-status.success { background: #D4EDDA; color: #155724; }
.qr-status.info { background: #CCE5FF; color: #004085; }
.qr-status.warning { background: #FFF3CD; color: #856404; }
.qr-status.error { background: #F8D7DA; color: #721C24; }

@media (max-width: 767px) {
  .stat-cards { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .stat-card { padding: 16px; }
  .stat-card .icon-box { width: 44px; height: 44px; font-size: 18px; margin-bottom: 12px; }
  .stat-card .stat-value { font-size: 1.5rem; }
  .account-grid { grid-template-columns: 1fr; }
  .anti-block-tip { flex-direction: column; text-align: center; gap: 12px; }
  .tip-left { flex-direction: column; align-items: center; }
  .section-header { flex-wrap: wrap; gap: 10px; }
}
</style>
