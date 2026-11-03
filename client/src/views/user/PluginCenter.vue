<template>
  <div class="plugin-center-page">
    <!-- 页头：移动端紧凑 -->
    <header class="pc-page-header">
      <div class="pc-page-header__icon" aria-hidden="true">
        <i class="fas fa-puzzle-piece"></i>
      </div>
      <div class="pc-page-header__text">
        <h1 class="pc-page-title">插件中心</h1>
        <p class="pc-page-sub">连接数据源并扩展 SEO、内容增长与 GEO 工作流</p>
      </div>
    </header>

    <!-- 分类：横向滚动胶囊，禁止竖排文字 -->
    <section class="pc-cat-section" aria-label="插件分类">
      <div class="pc-cat-scroll">
        <button
          type="button"
          class="pc-cat-chip"
          :class="{ 'is-active': activeCategory === '' }"
          @click="setCategory('')"
        >
          <i class="fas fa-th-large"></i>
          <span class="pc-cat-chip__label">全部</span>
        </button>
        <button
          v-for="cat in categories"
          :key="cat.slug"
          type="button"
          class="pc-cat-chip"
          :class="{ 'is-active': activeCategory === cat.slug }"
          @click="setCategory(cat.slug)"
        >
          <i :class="catIcon(cat.slug)"></i>
          <span class="pc-cat-chip__label">{{ cat.name }}</span>
          <span v-if="cat.count != null" class="pc-cat-chip__badge">{{ cat.count }}</span>
        </button>
      </div>
    </section>

    <!-- 搜索 + 筛选入口 -->
    <div class="pc-toolbar">
      <el-input
        v-model="keyword"
        class="pc-search-input"
        placeholder="搜索插件名称或描述…"
        clearable
        @keyup.enter="loadPlugins"
        @clear="loadPlugins"
      >
        <template #prefix><i class="fas fa-search text-muted"></i></template>
      </el-input>
      <el-button class="pc-filter-trigger" @click="filterDrawerOpen = true">
        <i class="fas fa-sliders-h me-1"></i>筛选
        <el-badge v-if="activeFilterCount > 0" :value="activeFilterCount" class="pc-filter-badge" />
      </el-button>
    </div>

    <!-- 结果摘要 -->
    <div class="pc-result-bar">
      <span class="pc-result-count">共 <strong>{{ displayedPlugins.length }}</strong> 个</span>
      <span v-if="sortLabel" class="pc-result-sort">{{ sortLabel }}</span>
    </div>

    <!-- 插件列表 -->
    <div class="plugin-grid" v-loading="loading">
      <div v-if="displayedPlugins.length === 0 && !loading" class="empty-state">
        <i class="fas fa-puzzle-piece"></i>
        <p>{{ emptyHint }}</p>
      </div>
      <div v-for="p in displayedPlugins" :key="p.id" class="plugin-card" :class="{ installed: p.is_installed }">
        <div class="plugin-header">
          <div class="plugin-icon" :style="{ background: getIconBg(p.category) }">
            <i :class="p.icon || 'fas fa-puzzle-piece'"></i>
          </div>
          <div class="plugin-info">
            <h4>{{ p.name }}
              <span v-if="p.is_featured" class="featured-tag"><i class="fas fa-star"></i> 推荐</span>
              <span v-if="p.is_beta" class="beta-tag">Beta</span>
            </h4>
            <div class="plugin-meta-row">
              <span class="plugin-author"><i class="fas fa-user me-1"></i>{{ p.author }}</span>
              <span class="plugin-version">v{{ p.version }}</span>
              <span class="plugin-installs"><i class="fas fa-download me-1"></i>{{ p.install_count }}</span>
            </div>
          </div>
          <div class="plugin-price">
            <span v-if="p.is_installed" class="installed-tag">已安装</span>
            <span v-if="p.monthly_price === 0" class="price-free">免费</span>
            <span v-else class="price-paid">¥{{ p.monthly_price }}/月</span>
          </div>
        </div>
        <p class="plugin-desc">{{ p.description }}</p>
        <div class="plugin-capabilities">
          <span v-for="permission in p.permissions" :key="permission">{{ permission }}</span>
        </div>
        <div class="plugin-data" v-if="p.data_destination">
          <i class="fas fa-shield-alt"></i> 数据去向：{{ p.data_destination }}
        </div>
        <div class="plugin-footer">
          <div class="plugin-rating">
            <i v-for="s in 5" :key="s" class="fas fa-star" :style="{ color: s <= Math.round(p.rating) ? '#f7ba2a' : '#e0e0e0' }"></i>
            <span>{{ p.rating }}</span>
          </div>
          <div class="plugin-actions">
            <el-button v-if="p.is_installed" type="success" size="small" @click="usePlugin(p)">
              <i class="fas fa-cog me-1"></i>配置
            </el-button>
            <el-button v-if="!p.is_installed" type="primary" size="small" :loading="p._loading" @click="installPlugin(p)">
              <i class="fas fa-download me-1"></i>安装
            </el-button>
            <el-button v-if="p.is_installed" size="small" type="danger" plain :loading="p._loading" @click="uninstallPlugin(p)">
              <i class="fas fa-power-off me-1"></i>停用
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 筛选抽屉（移动端底部滑出，PC 右侧也可） -->
    <el-drawer
      v-model="filterDrawerOpen"
      :title="null"
      :direction="isMobile ? 'btt' : 'rtl'"
      :size="isMobile ? '72%' : '360px'"
      class="pc-filter-drawer"
      destroy-on-close
    >
      <template #header>
        <div class="pc-drawer-head">
          <span class="pc-drawer-title">筛选与排序</span>
          <el-button text type="primary" @click="resetFilters">重置</el-button>
        </div>
      </template>
      <div class="pc-filter-body">
        <div class="pc-filter-block">
          <div class="pc-filter-label">排序方式</div>
          <el-radio-group v-model="sortBy" class="pc-radio-col">
            <el-radio label="default">默认（推荐优先）</el-radio>
            <el-radio label="installs">安装量从高到低</el-radio>
            <el-radio label="rating">评分从高到低</el-radio>
            <el-radio label="name">名称 A-Z</el-radio>
          </el-radio-group>
        </div>
        <el-divider />
        <div class="pc-filter-block">
          <div class="pc-filter-label">安装状态</div>
          <el-radio-group v-model="filterInstall" class="pc-radio-col">
            <el-radio label="all">全部</el-radio>
            <el-radio label="installed">已安装</el-radio>
            <el-radio label="not_installed">未安装</el-radio>
          </el-radio-group>
        </div>
        <el-divider />
        <div class="pc-filter-block">
          <div class="pc-filter-label">价格</div>
          <el-radio-group v-model="filterPrice" class="pc-radio-col">
            <el-radio label="all">全部</el-radio>
            <el-radio label="free">仅免费</el-radio>
            <el-radio label="paid">付费</el-radio>
          </el-radio-group>
        </div>
      </div>
      <div class="pc-drawer-footer">
        <el-button type="primary" class="w-100" @click="filterDrawerOpen = false">完成</el-button>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()

const plugins = ref([])
const categories = ref([])
const loading = ref(false)
const activeCategory = ref('')
const keyword = ref('')

const sortBy = ref('default')
const filterInstall = ref('all')
const filterPrice = ref('all')
const filterDrawerOpen = ref(false)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)

const isMobile = computed(() => windowWidth.value < 768)

function onResize() {
  windowWidth.value = window.innerWidth
}

const catIconMap = {
  integration: 'fas fa-plug', indexing: 'fas fa-paper-plane', content: 'fas fa-file-alt',
  optimization: 'fas fa-link', technical: 'fas fa-code', geo: 'fas fa-satellite-dish', reporting: 'fas fa-file-pdf',
}
function catIcon(slug) { return catIconMap[slug] || 'fas fa-cube' }

const bgColors = {
  integration: '#176B87', indexing: '#2F80ED', content: '#287A55',
  optimization: '#7A5A18', technical: '#34495E', geo: '#8A3D62', reporting: '#5B5F97',
  general: '#52606D',
}
function getIconBg(cat) { return bgColors[cat] || bgColors.general }

const sortLabelMap = {
  default: '',
  installs: '按安装量',
  rating: '按评分',
  name: '按名称',
}
const sortLabel = computed(() => sortLabelMap[sortBy.value] || '')

const activeFilterCount = computed(() => {
  let n = 0
  if (sortBy.value !== 'default') n++
  if (filterInstall.value !== 'all') n++
  if (filterPrice.value !== 'all') n++
  return n
})

const displayedPlugins = computed(() => {
  let list = [...plugins.value]
  if (filterInstall.value === 'installed') list = list.filter(p => p.is_installed)
  if (filterInstall.value === 'not_installed') list = list.filter(p => !p.is_installed)
  if (filterPrice.value === 'free') list = list.filter(p => Number(p.monthly_price) === 0)
  if (filterPrice.value === 'paid') list = list.filter(p => Number(p.monthly_price) > 0)

  if (sortBy.value === 'installs') {
    list.sort((a, b) => (b.install_count || 0) - (a.install_count || 0))
  } else if (sortBy.value === 'rating') {
    list.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0))
  } else if (sortBy.value === 'name') {
    list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'))
  } else {
    list.sort((a, b) => {
      const fa = a.is_featured ? 1 : 0
      const fb = b.is_featured ? 1 : 0
      if (fb !== fa) return fb - fa
      return (Number(b.rating) || 0) - (Number(a.rating) || 0)
    })
  }
  return list
})

const emptyHint = computed(() => {
  if (plugins.value.length === 0) return '暂无可用插件'
  return '当前筛选条件下没有插件，请调整筛选或搜索'
})

function setCategory(slug) {
  activeCategory.value = slug
  loadPlugins()
}

function resetFilters() {
  sortBy.value = 'default'
  filterInstall.value = 'all'
  filterPrice.value = 'all'
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  loadCategories()
  loadPlugins()
})
onUnmounted(() => window.removeEventListener('resize', onResize))

async function loadCategories() {
  try {
    const res = await api.get('/user/plugin-center/categories')
    categories.value = res.data?.data || res.data || []
  } catch { categories.value = [
    { slug: 'integration', name: '站点连接', count: 2 },
    { slug: 'content', name: '内容与 AI', count: 3 },
    { slug: 'optimization', name: '技术优化', count: 2 },
    { slug: 'geo', name: 'GEO / AEO', count: 1 },
    { slug: 'reporting', name: '报告协作', count: 1 },
  ] }
}

async function loadPlugins() {
  loading.value = true
  try {
    const params = {}
    if (activeCategory.value) params.category = activeCategory.value
    if (keyword.value) params.keyword = keyword.value
    const res = await api.get('/user/plugin-center', { params })
    plugins.value = (res.data?.data || res.data || []).map(p => ({ ...p, _loading: false }))
  } catch {
    // API 暂不可用时仍展示官方首发目录，保证插件中心可用
    plugins.value = [
      { id: 'wordpress-connector', slug: 'wordpress-connector', name: 'WordPress Connector', author: 'KanSEO 官方', version: '1.0.0', category: 'integration', description: '连接 WordPress，安全读取与提交已审核的 SEO 变更。', permissions: ['站点读取', '审核后写回'], data_destination: '仅当前工作区', monthly_price: 0, rating: 4.9, install_count: 128, is_featured: true, is_installed: false },
      { id: 'gsc', slug: 'google-search-console', name: 'Google Search Console', author: 'KanSEO 官方', version: '1.0.0', category: 'integration', description: '同步搜索展现、点击、排名与索引覆盖数据。', permissions: ['搜索数据读取'], data_destination: 'Google Search Console', monthly_price: 0, rating: 4.8, install_count: 96, is_featured: true, is_installed: false },
      { id: 'brief', slug: 'ai-content-brief', name: 'AI Content Brief', author: 'KanSEO 官方', version: '1.0.0', category: 'content', description: '基于页面事实生成内容简报、主题缺口与 FAQ 候选。', permissions: ['页面读取', 'AI 算力'], data_destination: 'KanSEO AI 服务', monthly_price: 29, rating: 4.7, install_count: 74, is_featured: true, is_installed: false },
      { id: 'internal-link', slug: 'internal-link-pro', name: 'Internal Link Pro', author: 'KanSEO 官方', version: '1.0.0', category: 'optimization', description: '发现孤立页面并提供可审核的内链建议。', permissions: ['页面读取', '变更单'], data_destination: '仅当前工作区', monthly_price: 39, rating: 4.6, install_count: 61, is_featured: false, is_installed: false },
      { id: 'schema', slug: 'schema-graph-pro', name: 'Schema Graph Pro', author: 'KanSEO 官方', version: '1.0.0', category: 'optimization', description: '维护实体关系并生成可校验的 JSON-LD 候选。', permissions: ['页面读取', 'Schema 写回'], data_destination: '仅当前工作区', monthly_price: 39, rating: 4.8, install_count: 53, is_featured: false, is_installed: false },
      { id: 'geo', slug: 'geo-brand-radar', name: 'GEO Brand Radar', author: 'KanSEO 官方', version: '1.0.0', category: 'geo', description: '追踪 AI 平台中的品牌提及、引用与竞品变化。', permissions: ['提示词监测', '外部查询'], data_destination: '配置的 AI 平台', monthly_price: 299, rating: 4.5, install_count: 31, is_featured: false, is_installed: false },
      { id: 'reports', slug: 'white-label-reports', name: 'White-label Reports', author: 'KanSEO 官方', version: '1.0.0', category: 'reporting', description: '生成带品牌标识的 PDF 报告并定时发送给协作者。', permissions: ['报告读取', '邮件发送'], data_destination: '当前工作区与邮件服务', monthly_price: 99, rating: 4.6, install_count: 27, is_featured: false, is_installed: false },
    ].map(p => ({ ...p, _loading: false }))
  }
  loading.value = false
}

async function installPlugin(p) {
  p._loading = true
  try {
    await api.post('/user/plugin-center/install', { plugin_id: p.id })
    ElMessage.success(`${p.name} 安装成功`)
    p.is_installed = true
    p.install_count++
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '安装失败')
  }
  p._loading = false
}

function usePlugin(p) {
  if (!p.slug) {
    ElMessage.error('插件信息异常，缺少slug')
    return
  }
  router.push(`/user/plugin-use/${p.slug}`).catch(err => {
    console.error('[PluginCenter] 路由跳转失败:', err)
    ElMessage.error('页面跳转失败，请重试')
  })
}

async function uninstallPlugin(p) {
  await ElMessageBox.confirm(`确定停用 ${p.name} 吗？插件配置和用量历史会保留。`, '确认停用')
  p._loading = true
  try {
    await api.post('/user/plugin-center/uninstall', { plugin_id: p.id })
    ElMessage.success('插件已停用')
    p.is_installed = false
    p.install_count = Math.max(0, p.install_count - 1)
  } catch (e) {
    ElMessage.error('卸载失败')
  }
  p._loading = false
}
</script>

<style scoped>
/* PC-001 插件中心页容器 */
.plugin-center-page {
  --pc-primary: #2F80ED;
  --pc-border: #E0E0E0;
  --pc-text: #333333;
  --pc-text-secondary: #666666;
  --pc-bg: #F8F9FA;
  --pc-radius: 8px;
  --pc-space-sm: 8px;
  --pc-space-md: 16px;
}

.pc-page-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: var(--pc-space-md);
}
.pc-page-header__icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(135deg, #2F80ED, #56CCF2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.pc-page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--pc-text);
  line-height: 1.2;
}
.pc-page-sub {
  margin: 0;
  font-size: 13px;
  color: var(--pc-text-secondary);
  line-height: 1.4;
}

/* 分类横向滚动 — 胶囊样式，强制横排文字 */
.pc-cat-section {
  margin-bottom: 12px;
  margin-left: -4px;
  margin-right: -4px;
}
.pc-cat-scroll {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 4px 4px 10px;
  scrollbar-width: thin;
}
.pc-cat-scroll::-webkit-scrollbar {
  height: 4px;
}
.pc-cat-scroll::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 4px;
}

.pc-cat-chip {
  flex: 0 0 auto;
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  min-height: 40px;
  border: 1px solid var(--pc-border);
  border-radius: 999px;
  background: #fff;
  color: var(--pc-text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, color 0.2s, box-shadow 0.2s;
  white-space: nowrap;
  writing-mode: horizontal-tb;
  text-orientation: mixed;
}
.pc-cat-chip i {
  font-size: 13px;
  opacity: 0.9;
}
.pc-cat-chip__label {
  max-width: 7em;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pc-cat-chip__badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.06);
  color: var(--pc-text-secondary);
}
.pc-cat-chip.is-active {
  background: var(--pc-primary);
  border-color: var(--pc-primary);
  color: #fff;
  box-shadow: 0 2px 8px rgba(47, 128, 237, 0.35);
}
.pc-cat-chip.is-active .pc-cat-chip__badge {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}
.pc-cat-chip:active {
  transform: scale(0.98);
}

/* 工具栏：搜索 + 筛选 */
.pc-toolbar {
  display: flex;
  align-items: stretch;
  gap: 8px;
  margin-bottom: 10px;
}
.pc-search-input {
  flex: 1;
  min-width: 0;
}
.pc-search-input :deep(.el-input__wrapper) {
  border-radius: var(--pc-radius);
  min-height: 40px;
  box-shadow: 0 0 0 1px var(--pc-border) inset;
}
.pc-filter-trigger {
  flex-shrink: 0;
  position: relative;
  border-radius: var(--pc-radius);
  min-height: 40px;
  padding-left: 12px;
  padding-right: 12px;
}
.pc-filter-badge :deep(.el-badge__content) {
  top: 4px;
  right: 4px;
}

.pc-result-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--pc-text-secondary);
}
.pc-result-count strong {
  color: var(--pc-text);
  font-weight: 600;
}
.pc-result-sort {
  color: var(--pc-primary);
}

/* 抽屉 */
.pc-drawer-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding-right: 8px;
}
.pc-drawer-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--pc-text);
}
.pc-filter-body {
  padding-bottom: 16px;
}
.pc-filter-block {
  margin-bottom: 4px;
}
.pc-filter-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--pc-text);
  margin-bottom: 10px;
}
.pc-radio-col {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.pc-radio-col :deep(.el-radio) {
  margin-right: 0;
  height: auto;
  white-space: normal;
  align-items: flex-start;
}
.pc-drawer-footer {
  padding: 12px 0 8px;
  border-top: 1px solid var(--pc-border);
}
.w-100 {
  width: 100%;
}

.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}
.plugin-card {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e8e8e8;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.25s, transform 0.25s;
  position: relative;
}
.plugin-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}
.plugin-card.installed {
  border-color: #67c23a;
}
.plugin-capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0;
}
.plugin-capabilities span {
  padding: 3px 7px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #475569;
  font-size: 11px;
}
.plugin-data {
  min-height: 32px;
  margin-bottom: 12px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.45;
}

.plugin-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}
.plugin-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  flex-shrink: 0;
}
.plugin-info {
  flex: 1;
  min-width: 0;
}
.plugin-info h4 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.featured-tag {
  font-size: 10px;
  background: #fff3e0;
  color: #e65100;
  padding: 1px 6px;
  border-radius: 6px;
  font-weight: 500;
}
.beta-tag {
  font-size: 10px;
  background: #e3f2fd;
  color: #1565c0;
  padding: 1px 6px;
  border-radius: 6px;
  font-weight: 500;
}
.plugin-meta-row {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: #999;
  flex-wrap: wrap;
}
.plugin-price {
  flex-shrink: 0;
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.installed-tag {
  background: #67c23a;
  color: #fff;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 500;
  white-space: nowrap;
}
.price-free {
  color: #67c23a;
  font-weight: 600;
  font-size: 14px;
}
.price-paid {
  color: #e6a23c;
  font-weight: 600;
  font-size: 14px;
}
.plugin-desc {
  font-size: 12px;
  color: #888;
  margin: 0 0 12px;
  line-height: 1.6;
}
.plugin-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.plugin-rating {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
}
.plugin-rating span {
  margin-left: 4px;
  color: #999;
}
.plugin-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.empty-state {
  text-align: center;
  padding: 48px 20px;
  color: #ccc;
  grid-column: 1 / -1;
}
.empty-state i {
  font-size: 48px;
  margin-bottom: 12px;
}
.empty-state p {
  font-size: 14px;
  color: #999;
}

@media (max-width: 767px) {
  .plugin-center-page {
    padding-bottom: 80px;
  }
  .pc-page-header {
    margin-bottom: 10px;
  }
  .pc-page-header__icon {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }
  .pc-page-title {
    font-size: 16px;
  }
  .pc-page-sub {
    font-size: 12px;
  }
  .pc-cat-chip {
    padding: 6px 10px;
    min-height: 32px;
    font-size: 12px;
  }
  .pc-toolbar {
    gap: 6px;
  }
  .pc-search-input :deep(.el-input__wrapper) {
    min-height: 36px;
  }
  .pc-filter-trigger {
    min-height: 36px;
    font-size: 12px;
  }
  .plugin-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .plugin-card {
    padding: 12px;
    border-radius: var(--pc-radius);
  }
  .plugin-card:hover {
    transform: none;
  }
  .plugin-icon {
    width: 38px;
    height: 38px;
    font-size: 16px;
  }
  .plugin-info h4 {
    font-size: 13px;
  }
  .plugin-meta-row {
    font-size: 10px;
    gap: 6px;
  }
  .plugin-desc {
    font-size: 11px;
    margin-bottom: 10px;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .plugin-footer {
    gap: 6px;
  }
  .plugin-rating {
    font-size: 11px;
  }
  .plugin-actions {
    gap: 4px;
  }
  .plugin-actions .el-button {
    padding: 6px 12px;
    font-size: 12px;
    min-height: 32px;
  }
  .empty-state {
    padding: 32px 16px;
  }
  .empty-state i {
    font-size: 36px;
  }
}
</style>
