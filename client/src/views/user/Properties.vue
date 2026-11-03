<template>
  <div class="moments-parsed-list">
    <!-- 未购买功能模块：全屏遮罩 + 居中弹窗 -->
    <teleport to="body">
      <div v-if="featureBlocked" class="fb-mask">
        <div class="fb-modal">
          <div class="fb-icon"><i class="fas fa-lock"></i></div>
          <h3 class="fb-title">功能未开通</h3>
          <p class="fb-desc">您尚未购买「内容资产库管理」功能模块，<br>开通后即可浏览所有内容资产、上传管理等功能。</p>
          <button class="fb-btn fb-btn-primary" @click="router.push('/user/membership')">
            <i class="fas fa-crown"></i> 前往购买会员
          </button>
          <button class="fb-btn fb-btn-secondary" @click="router.push('/user/dashboard')">返回首页</button>
        </div>
      </div>
    </teleport>

    <!-- 页面头部（与所有内容资产一致：紫色渐变） -->
    <div class="plugin-header">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h2><i class="fas fa-home me-2"></i>我的内容资产管理</h2>
          <p class="mb-0 opacity-75 d-none d-md-block">管理您上传的所有内容资产，支持筛选、编辑、发布</p>
        </div>
        <div class="d-flex gap-2">
          <router-link to="/user/upload-property" class="btn-header-action">
            <i class="fas fa-plus me-1"></i>上传新内容资产
          </router-link>
          <el-button @click="loadData(1)" style="color:#fff;border-color:rgba(255,255,255,0.4);background:transparent"><i class="fas fa-sync-alt me-1"></i>刷新</el-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片（与所有内容资产一致：4列带图标） -->
    <div class="stats-grid mb-4">
      <div class="stats-card" @click="applyStatFilter({})" style="cursor:pointer">
        <div class="stats-icon"><i class="fas fa-home"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }">{{ statsLoading ? '-' : formatNum(stats.total) }}</div>
        <div class="label">全部内容资产</div>
      </div>
      <div class="stats-card" @click="applyStatFilter({ status: 'published' })" style="cursor:pointer">
        <div class="stats-icon" style="color: #4CAF50"><i class="fas fa-check-circle"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }" style="color: #4CAF50">{{ statsLoading ? '-' : formatNum(stats.published) }}</div>
        <div class="label">已发布</div>
      </div>
      <div class="stats-card" @click="applyStatFilter({ status: 'draft' })" style="cursor:pointer">
        <div class="stats-icon" style="color: #FF9800"><i class="fas fa-edit"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }" style="color: #FF9800">{{ statsLoading ? '-' : formatNum(stats.draft) }}</div>
        <div class="label">草稿</div>
      </div>
      <div class="stats-card">
        <div class="stats-icon" style="color: #9C27B0"><i class="fas fa-calendar-day"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }" style="color: #9C27B0">{{ statsLoading ? '-' : formatNum(stats.today_count) }}</div>
        <div class="label">今日新增</div>
      </div>
    </div>

    <!-- ====== 移动端筛选栏（与快速内容检索一致：淘宝风格横向下拉） ====== -->
    <div class="m-filter-bar d-md-none mb-3">
      <div class="m-filter-scroll">
        <el-popover placement="bottom" :width="240" trigger="click" popper-class="m-price-popover">
          <template #reference>
            <button class="m-filter-btn" :class="{ active: filters.priceMin || filters.priceMax }">
              <i class="fas fa-yen-sign"></i>
              {{ mobilePriceLabel }}
              <i class="fas fa-caret-down" style="margin-left:2px;font-size:10px"></i>
            </button>
          </template>
          <div class="m-price-panel">
            <div class="m-price-row">
              <span class="m-price-label">最低价</span>
              <el-select v-model="filters.priceMin" placeholder="不限" size="small" clearable class="m-price-sel" @change="loadData(1)">
                <el-option v-for="p in priceOptions" :key="'mmin'+p" :label="formatPriceLabel(p)" :value="p" />
              </el-select>
            </div>
            <div class="m-price-row">
              <span class="m-price-label">最高价</span>
              <el-select v-model="filters.priceMax" placeholder="不限" size="small" clearable class="m-price-sel" @change="loadData(1)">
                <el-option v-for="p in priceOptions" :key="'mmax'+p" :label="formatPriceLabel(p)" :value="p" />
              </el-select>
            </div>
            <el-button size="small" type="primary" class="m-price-confirm" @click="loadData(1)">确定</el-button>
          </div>
        </el-popover>
        <el-select v-model="filters.bedrooms" placeholder="卧室" size="small" clearable multiple collapse-tags :max-collapse-tags="1" class="m-filter-sel" @change="loadData(1)">
          <el-option v-for="n in 5" :key="'mb'+n" :label="`${n}室`" :value="n" />
        </el-select>
        <el-select v-model="filters.district" placeholder="区域" size="small" clearable filterable class="m-filter-sel" @change="loadData(1)">
          <el-option label="全部" value="" />
          <el-option v-for="d in districts" :key="'md'+d" :label="d" :value="d" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" size="small" clearable class="m-filter-sel" @change="loadData(1)">
          <el-option label="全部" value="" />
          <el-option label="已发布" value="published" />
          <el-option label="草稿" value="draft" />
        </el-select>
        <el-select v-model="filters.outdoor_features" placeholder="户外" size="small" clearable multiple collapse-tags :max-collapse-tags="1" class="m-filter-sel" @change="loadData(1)">
          <el-option label="花园" value="花园" /><el-option label="阳台" value="阳台" /><el-option label="露台" value="露台" /><el-option label="院子" value="院子" />
        </el-select>
        <button class="m-filter-more-btn" :class="{ active: moreFilterOpen }" @click="moreFilterOpen = !moreFilterOpen">
          <i class="fas fa-sliders-h"></i> 更多
        </button>
      </div>
      <div v-if="moreFilterOpen" class="m-filter-expand">
        <div class="m-filter-expand-row">
          <el-input v-model="filters.keyword" placeholder="搜索标题/描述/关键词..." size="small" clearable class="m-filter-kw" @keyup.enter="loadData(1)" @clear="loadData(1)" />
        </div>
        <div class="m-filter-expand-row m-filter-checks">
          <el-checkbox v-model="filters.has_elevator" size="small" @change="loadData(1)">电梯</el-checkbox>
          <el-checkbox v-model="filters.has_parking" size="small" @change="loadData(1)">车位</el-checkbox>
          <el-checkbox v-model="filters.is_duplex" size="small" @change="loadData(1)">复式</el-checkbox>
          <el-button type="primary" size="small" @click="loadData(1); moreFilterOpen = false" style="margin-left: auto"><i class="fas fa-search me-1"></i>筛选</el-button>
          <el-button size="small" @click="resetFilters"><i class="fas fa-redo"></i></el-button>
        </div>
      </div>
    </div>

    <!-- ====== PC端筛选（与快速内容检索一致的 .filter-module 风格） ====== -->
    <div class="module-card filter-module mb-4 d-none d-md-block">
      <div class="filter-header">
        <div class="filter-title"><i class="fas fa-filter"></i> 内容资产筛选</div>
      </div>
      <div class="filter-body">
        <div class="filter-grid filter-grid-5">
          <div class="fg-item">
            <label>关键词搜索</label>
            <el-input v-model="filters.keyword" placeholder="搜索标题、描述..." size="small" clearable @keyup.enter="loadData(1)" @clear="loadData(1)" />
          </div>
          <div class="fg-item">
            <label>价格范围</label>
            <div class="price-range-wrap">
              <el-select v-model="filters.priceMin" placeholder="最低" size="small" clearable filterable allow-create class="price-sel" @change="loadData(1)">
                <el-option v-for="p in priceOptions" :key="'min'+p" :label="formatPriceLabel(p)" :value="p" />
              </el-select>
              <span class="range-sep">-</span>
              <el-select v-model="filters.priceMax" placeholder="最高" size="small" clearable filterable allow-create class="price-sel" @change="loadData(1)">
                <el-option v-for="p in priceOptions" :key="'max'+p" :label="formatPriceLabel(p)" :value="p" />
              </el-select>
            </div>
          </div>
          <div class="fg-item">
            <label>卧室</label>
            <el-select v-model="filters.bedrooms" placeholder="不限" size="small" clearable multiple class="w-100" @change="loadData(1)">
              <el-option v-for="n in 5" :key="n" :label="`${n}室`" :value="n" />
            </el-select>
          </div>
          <div class="fg-item">
            <label>区域</label>
            <el-select v-model="filters.district" placeholder="全部区域" size="small" clearable filterable class="w-100" @change="loadData(1)">
              <el-option label="全部区域" value="" />
              <el-option v-for="d in districts" :key="d" :label="d" :value="d" />
            </el-select>
          </div>
          <div class="fg-item">
            <label>户外 <small>(可多选)</small></label>
            <el-select v-model="filters.outdoor_features" placeholder="不限" size="small" clearable multiple class="w-100" @change="loadData(1)">
              <el-option label="花园" value="花园" />
              <el-option label="阳台" value="阳台" />
              <el-option label="露台" value="露台" />
              <el-option label="院子/庭院" value="院子" />
            </el-select>
          </div>
        </div>
        <div class="filter-grid filter-grid-5">
          <div class="fg-item">
            <label>发布状态</label>
            <el-select v-model="filters.status" placeholder="全部状态" size="small" clearable class="w-100" @change="loadData(1)">
              <el-option label="全部状态" value="" />
              <el-option label="已发布" value="published" />
              <el-option label="草稿" value="draft" />
            </el-select>
          </div>
        </div>
        <div class="filter-inline-row">
          <div class="filter-inline-left">
            <span class="inline-label">定位状态</span>
            <el-radio-group v-model="filters.location_filter" size="small" @change="loadData(1)">
              <el-radio-button label="">全部</el-radio-button>
              <el-radio-button label="located">已定位</el-radio-button>
              <el-radio-button label="pending">待定位</el-radio-button>
            </el-radio-group>
            <span class="inline-label" style="margin-left:16px">其他条件</span>
            <el-checkbox v-model="filters.has_elevator" size="small" @change="loadData(1)">有电梯</el-checkbox>
            <el-checkbox v-model="filters.has_parking" size="small" @change="loadData(1)">有车位</el-checkbox>
            <el-checkbox v-model="filters.is_duplex" size="small" @change="loadData(1)">复式</el-checkbox>
          </div>
          <div class="filter-actions">
            <el-button type="primary" size="small" @click="loadData(1)"><i class="fas fa-search me-1"></i>筛选</el-button>
            <el-button size="small" @click="resetFilters"><i class="fas fa-redo me-1"></i>重置</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 视图切换标签页（与所有内容资产一致） -->
    <div class="view-tabs mb-3 d-none d-md-flex">
      <button class="view-tab" :class="{ active: viewMode === 'table' }" @click="viewMode = 'table'">
        <i class="fas fa-list me-1"></i>列表视图
      </button>
      <button class="view-tab" :class="{ active: viewMode === 'card' }" @click="viewMode = 'card'">
        <i class="fas fa-th-large me-1"></i>卡片视图
        <span class="badge bg-purple ms-1">{{ total }}</span>
      </button>
    </div>

    <!-- ====== 移动端卡片列表（与所有内容资产一致） ====== -->
    <div v-if="isMobileView" class="m-card-list" v-loading="loading">
      <div class="m-list-header">
        <span class="m-list-count">共 <b>{{ total }}</b> 条内容资产</span>
        <el-select v-model="pageSize" size="small" class="m-list-size" @change="loadData(1)">
          <el-option :value="20" label="20条" /><el-option :value="50" label="50条" /><el-option :value="100" label="100条" />
        </el-select>
      </div>
      <div v-for="prop in properties" :key="prop.id" class="m-property-card" @click="viewProperty(prop)">
        <div class="m-card-with-thumb">
          <div class="m-card-thumb">
            <img :src="getThumb(prop)" @error="$event.target.src='/uploads/placeholder.png'" />
            <span :class="prop.status === 'draft' ? 'm-status-badge badge-draft' : 'm-status-badge badge-published'">
              {{ prop.status === 'draft' ? '草稿' : '已发布' }}
            </span>
          </div>
          <div class="m-card-main">
            <div class="m-card-top">
              <div class="m-card-community">{{ prop.title || getCommunity(prop) || '未命名内容资产' }}</div>
              <div v-if="prop.district" class="m-card-district">{{ prop.district }}</div>
            </div>
            <div class="m-card-body">
              <div class="m-card-price-row">
                <span v-if="prop.price" class="m-card-price">¥{{ Number(prop.price).toLocaleString() }}<small>/月</small></span>
                <span v-else class="m-card-price empty">价格面议</span>
                <span class="m-card-rooms">
                  <template v-if="prop.bedrooms">{{ prop.bedrooms }}室</template>
                  <template v-if="prop.bathrooms">{{ prop.bathrooms }}卫</template>
                  <template v-if="prop.area"> · {{ prop.area }}㎡</template>
                </span>
              </div>
              <div class="m-card-footer">
                <span class="m-card-time">{{ formatMobileTime(prop.created_at) }}</span>
                <div class="m-card-actions" @click.stop>
                  <el-button v-if="prop.status === 'draft'" size="small" type="success" text @click="publishProp(prop)"><i class="fas fa-upload"></i></el-button>
                  <el-button size="small" type="primary" text @click="editProp(prop)"><i class="fas fa-edit"></i></el-button>
                  <el-button size="small" type="danger" text @click="deleteProp(prop)"><i class="fas fa-trash"></i></el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="!loading && properties.length === 0" class="m-empty-state">
        <i class="fas fa-home"></i>
        <p>暂无内容资产数据</p>
        <router-link to="/user/upload-property" class="btn btn-primary btn-sm"><i class="fas fa-plus me-1"></i>上传第一个内容资产</router-link>
      </div>
      <div class="m-pagination" v-if="total > pageSize">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" small @current-change="loadData" />
      </div>
    </div>

    <!-- ====== PC端列表视图（与所有内容资产一致：el-table） ====== -->
    <div v-show="viewMode === 'table' && !isMobileView" class="module-card">
      <div class="list-header-bar">
        <div class="module-title mb-0">
          <i class="fas fa-list"></i>
          <span>我的内容资产列表</span>
          <span class="badge bg-success ms-2" style="font-size: 12px">共 {{ total }} 条</span>
        </div>
        <div class="list-header-actions">
          <el-select v-model="pageSize" size="small" style="width: 90px" @change="loadData(1)">
            <el-option :value="20" label="20条/页" /><el-option :value="50" label="50条/页" /><el-option :value="100" label="100条/页" />
          </el-select>
        </div>
      </div>
      <div class="table-scroll-wrap">
        <el-table v-loading="loading" :data="properties" stripe border size="small" :max-height="tableMaxHeight" style="width: 100%">
          <el-table-column label="操作" width="100" fixed="left" align="center">
            <template #default="{ row }">
              <el-dropdown trigger="click" placement="bottom-start" @command="(cmd) => handleOpDropdown(cmd, row)">
                <el-button size="small" type="primary" plain class="op-dropdown-btn">
                  操作<i class="fas fa-chevron-down ms-1" style="font-size:10px"></i>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="detail"><i class="fas fa-eye me-2" style="color:#909399"></i>查看详情</el-dropdown-item>
                    <el-dropdown-item command="edit"><i class="fas fa-edit me-2" style="color:#409EFF"></i>编辑</el-dropdown-item>
                    <el-dropdown-item v-if="row.status === 'draft'" command="publish"><i class="fas fa-upload me-2" style="color:#67C23A"></i>发布</el-dropdown-item>
                    <el-dropdown-item command="delete" divided><i class="fas fa-trash me-2" style="color:#F56C6C"></i>删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </el-table-column>
          <el-table-column label="媒体" width="90">
            <template #default="{ row }">
              <div class="media-preview-container">
                <img v-if="getThumb(row) !== '/uploads/placeholder.png'" :src="getThumb(row)" class="property-thumb" @error="$event.target.src='/uploads/placeholder.png'">
                <div v-else class="property-thumb-placeholder"><i class="fas fa-image"></i></div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="标题/描述" min-width="220">
            <template #default="{ row }">
              <div class="content-cell">
                <div class="content-text" :class="{ 'content-collapsed': !row._expanded }">{{ row.title || row.description || '-' }}</div>
                <span v-if="needTruncate(row.title || row.description || '')" class="content-toggle" @click="row._expanded = !row._expanded">{{ row._expanded ? '收起' : '展开' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="小区" width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ getCommunity(row) || row.address || '-' }}</template>
          </el-table-column>
          <el-table-column label="价格" width="110">
            <template #default="{ row }">
              <span v-if="row.price" class="cell-price">¥{{ Number(row.price).toLocaleString() }}<span class="cell-price-unit">/月</span></span>
              <span v-else class="cell-empty">-</span>
            </template>
          </el-table-column>
          <el-table-column label="卧" width="50" align="center">
            <template #default="{ row }"><span class="cell-num">{{ row.bedrooms || '-' }}</span></template>
          </el-table-column>
          <el-table-column label="卫" width="50" align="center">
            <template #default="{ row }"><span class="cell-num">{{ row.bathrooms || '-' }}</span></template>
          </el-table-column>
          <el-table-column label="区域" width="80" show-overflow-tooltip>
            <template #default="{ row }">{{ row.district || '-' }}</template>
          </el-table-column>
          <el-table-column label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'published'" type="success" size="small" effect="plain">已发布</el-tag>
              <el-tag v-else type="warning" size="small" effect="plain">草稿</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="面积" width="80" align="center">
            <template #default="{ row }">{{ row.area ? row.area + '㎡' : '-' }}</template>
          </el-table-column>
          <el-table-column label="发布时间" width="130">
            <template #default="{ row }"><small>{{ formatDate(row.created_at) }}</small></template>
          </el-table-column>
        </el-table>
      </div>
      <div class="table-pagination" v-if="total > pageSize">
        <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" layout="total, prev, pager, next" @current-change="loadData" />
      </div>
    </div>

    <!-- ====== PC端卡片视图 ====== -->
    <div v-show="viewMode === 'card' && !isMobileView" class="module-card" v-loading="loading">
      <div class="list-header-bar">
        <div class="module-title mb-0">
          <i class="fas fa-th-large"></i>
          <span>卡片视图</span>
          <span class="badge bg-success ms-2" style="font-size: 12px">共 {{ total }} 条</span>
        </div>
        <div class="list-header-actions">
          <el-select v-model="pageSize" size="small" style="width: 90px" @change="loadData(1)">
            <el-option :value="12" label="12条/页" /><el-option :value="24" label="24条/页" /><el-option :value="50" label="50条/页" />
          </el-select>
        </div>
      </div>
      <div class="card-grid" v-if="properties.length">
        <div v-for="prop in properties" :key="prop.id" class="card-grid-item" @click="viewProperty(prop)">
          <div class="card-grid-cover" :style="{ backgroundImage: `url(${getThumb(prop)})` }">
            <span v-if="prop.status === 'draft'" class="card-grid-tag" style="background:rgba(255,152,0,0.9)">草稿</span>
            <span v-else class="card-grid-tag" style="background:rgba(76,175,80,0.9)">已发布</span>
            <div class="card-grid-actions" @click.stop>
              <el-button v-if="prop.status === 'draft'" size="small" type="success" circle @click="publishProp(prop)"><i class="fas fa-upload"></i></el-button>
              <el-button size="small" type="primary" circle @click="editProp(prop)"><i class="fas fa-edit"></i></el-button>
              <el-button size="small" type="danger" circle @click="deleteProp(prop)"><i class="fas fa-trash"></i></el-button>
            </div>
          </div>
          <div class="card-grid-body">
            <div class="card-grid-title">{{ prop.title || getCommunity(prop) || '未命名内容资产' }}</div>
            <div class="card-grid-meta">
              <span v-if="prop.bedrooms">{{ prop.bedrooms }}室</span>
              <span v-if="prop.bathrooms">{{ prop.bathrooms }}卫</span>
              <span v-if="prop.area">{{ prop.area }}㎡</span>
              <span v-if="prop.district">{{ prop.district }}</span>
            </div>
            <div class="card-grid-footer">
              <span class="card-grid-price">
                <template v-if="prop.price">¥{{ Number(prop.price).toLocaleString() }}</template>
                <template v-else>面议</template>
                <small>/月</small>
              </span>
              <span class="card-grid-date">{{ formatMobileTime(prop.created_at) }}</span>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-if="!loading && properties.length === 0" description="暂无内容资产数据" :image-size="80" />
      <div class="table-pagination" v-if="total > pageSize">
        <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" layout="total, prev, pager, next" @current-change="loadData" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'

const router = useRouter()
const featureBlocked = ref(false)
const loading = ref(false)
const statsLoading = ref(true)
const properties = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const viewMode = ref('table')
const isMobileView = ref(window.innerWidth < 768)
const moreFilterOpen = ref(false)
const tableMaxHeight = ref(Math.max(500, window.innerHeight - 380))

function onResize() {
  isMobileView.value = window.innerWidth < 768
  tableMaxHeight.value = Math.max(500, window.innerHeight - 380)
}

const stats = reactive({ total: 0, published: 0, draft: 0, today_count: 0 })

const priceOptions = (() => {
  const arr = []
  for (let p = 5000; p <= 50000; p += 1000) arr.push(p)
  return arr
})()

function formatPriceLabel(p) {
  if (p >= 10000) return (p / 10000) + '万'
  return p.toLocaleString()
}

function formatNum(n) { return (n || 0).toLocaleString() }

const districts = ref([
  '黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区',
  '浦东新区', '闵行区', '宝山区', '嘉定区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'
])

const filters = reactive({
  status: '', district: '', keyword: '', location_filter: '',
  priceMin: null, priceMax: null, bedrooms: [],
  outdoor_features: [],
  has_elevator: false, has_parking: false, is_duplex: false,
})

const mobilePriceLabel = computed(() => {
  if (!filters.priceMin && !filters.priceMax) return '价格'
  const min = filters.priceMin ? formatPriceLabel(filters.priceMin) : '不限'
  const max = filters.priceMax ? formatPriceLabel(filters.priceMax) : '不限'
  return `${min}-${max}`
})

function needTruncate(text) { return text && text.length > 80 }

function getThumb(prop) {
  if (!prop.images) return '/uploads/placeholder.png'
  try {
    let imgs = prop.images
    if (typeof imgs === 'string') imgs = JSON.parse(imgs)
    if (Array.isArray(imgs) && imgs.length) {
      const first = imgs[0]
      if (typeof first === 'string' && first) return first
      if (first && (first.url || first.thumb)) return first.url || first.thumb
    }
  } catch {}
  if (typeof prop.images === 'string' && (prop.images.startsWith('/') || prop.images.startsWith('http'))) {
    return prop.images
  }
  return '/uploads/placeholder.png'
}

function getCommunity(prop) {
  if (!prop.features) return ''
  try {
    let f = prop.features
    if (typeof f === 'string') f = JSON.parse(f)
    return f?.community || ''
  } catch { return '' }
}

function formatDate(d) {
  if (!d) return '-'
  try { return new Date(d).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
  catch { return d }
}

function formatMobileTime(t) {
  if (!t) return ''
  const now = Date.now()
  const then = new Date(t).getTime()
  if (isNaN(then)) return ''
  const diff = Math.max(0, now - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return mins <= 0 ? '刚刚' : `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}小时前`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}天前`
  return new Date(then).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function viewProperty(prop) {
  const publicId = prop.public_property_id || prop.parsed_property_id
  const isPublicVisible = Number(prop.public_is_listed) === 1 && prop.public_status === 'published' && !prop.public_deleted_at
  if (publicId && isPublicVisible) {
    window.open(`/properties/${publicId}`, '_blank')
    return
  }
  ElMessage.warning('该内容资产暂未生成公开详情页，已打开编辑页查看')
  router.push(`/user/edit-property/${prop.id}`)
}

function editProp(prop) { router.push(`/user/edit-property/${prop.id}`) }

function handleOpDropdown(cmd, row) {
  if (cmd === 'detail') viewProperty(row)
  else if (cmd === 'edit') editProp(row)
  else if (cmd === 'publish') publishProp(row)
  else if (cmd === 'delete') deleteProp(row)
}

function applyStatFilter(f) {
  Object.assign(filters, {
    status: '', district: '', keyword: '', location_filter: '',
    priceMin: null, priceMax: null, bedrooms: [],
    outdoor_features: [], has_elevator: false, has_parking: false, is_duplex: false,
    ...f
  })
  loadData(1)
}

function resetFilters() {
  Object.assign(filters, {
    status: '', district: '', keyword: '', location_filter: '',
    priceMin: null, priceMax: null, bedrooms: [],
    outdoor_features: [], has_elevator: false, has_parking: false, is_duplex: false,
  })
  page.value = 1
  loadData(1)
}

async function loadStats() {
  statsLoading.value = true
  try {
    const res = await api.get('/user/properties/stats')
    const d = res.data?.data || res.data || {}
    Object.assign(stats, {
      total: d.total || 0, published: d.published || 0, draft: d.draft || 0,
      today_count: d.today_count || 0
    })
  } catch {}
  statsLoading.value = false
}

async function loadData(p) {
  if (p) page.value = p
  loading.value = true
  try {
    const res = await api.get('/user/properties', {
      params: {
        page: page.value, pageSize: pageSize.value,
        status: filters.status, district: filters.district,
        keyword: filters.keyword, location_filter: filters.location_filter,
        priceMin: filters.priceMin, priceMax: filters.priceMax,
        bedrooms: filters.bedrooms.length ? filters.bedrooms.join(',') : '',
        outdoor_features: filters.outdoor_features.length ? filters.outdoor_features.join(',') : '',
        has_elevator: filters.has_elevator || '',
        has_parking: filters.has_parking || '',
        is_duplex: filters.is_duplex || '',
      }
    })
    const raw = res.data || {}
    let list
    if (Array.isArray(raw)) {
      list = raw
    } else {
      list = raw.data || raw.list || []
    }
    properties.value = list.map(r => ({ ...r, _expanded: false }))
    total.value = (typeof raw === 'object' && !Array.isArray(raw))
      ? (raw.total ?? raw.pagination?.total ?? list.length)
      : list.length
  } catch { properties.value = []; total.value = 0 }
  loading.value = false
}

async function publishProp(prop) {
  try {
    await ElMessageBox.confirm('确定要发布这个内容资产吗？', '确认发布')
    await api.post(`/user/properties/${prop.id}/publish`)
    ElMessage.success('发布成功')
    loadData()
    loadStats()
  } catch {}
}

async function deleteProp(prop) {
  try {
    await ElMessageBox.confirm('确定要删除这个内容资产吗？此操作不可恢复！', '确认删除', { type: 'warning' })
    await api.delete(`/user/properties/${prop.id}`)
    ElMessage.success('删除成功')
    loadData()
    loadStats()
  } catch {}
}

onMounted(async () => {
  window.addEventListener('resize', onResize)
  try {
    const checkRes = await api.get('/user/feature-modules/check/property-library')
    const access = checkRes.data
    if (access && access.allowed === false) { featureBlocked.value = true; return }
  } catch (e) {
    if (e.response?.status === 403) { featureBlocked.value = true; return }
  }
  loadStats()
  loadData()
})

onBeforeUnmount(() => { window.removeEventListener('resize', onResize) })
</script>

<style scoped>
/* ========== 页面头部（与所有内容资产完全一致） ========== */
.plugin-header {
  background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%);
  color: white; padding: 20px 24px; border-radius: 12px; margin-bottom: 20px;
}
.plugin-header h2 { font-size: 1.3rem; font-weight: 700; margin: 0 0 4px 0; color: white; }
.plugin-header p { font-size: 13px; color: rgba(255,255,255,0.8); }
.btn-header-action {
  display: inline-flex; align-items: center; padding: 8px 16px;
  background: rgba(255,255,255,0.2); color: #fff; border-radius: 8px;
  text-decoration: none; font-size: 13px; font-weight: 500; border: 1px solid rgba(255,255,255,0.3);
  transition: all 0.2s;
}
.btn-header-action:hover { background: rgba(255,255,255,0.3); color: #fff; }

/* ========== 统计卡片（与所有内容资产完全一致） ========== */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.stats-card {
  background: white; border-radius: 12px; padding: 16px 20px; text-align: center;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06); transition: all 0.3s ease; min-width: 0;
}
.stats-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
.stats-card .stats-icon { font-size: 20px; color: #3498db; margin-bottom: 6px; }
.stats-card .value { font-size: 1.5rem; font-weight: 700; color: #333; line-height: 1.2; }
.stats-card .label { font-size: 12px; color: #999; margin-top: 4px; }

/* ========== 模块卡片（与所有内容资产完全一致） ========== */
.module-card {
  background: white; border-radius: 12px; padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
.module-title {
  font-size: 15px; font-weight: 600; color: #333;
  display: flex; align-items: center; gap: 8px;
}
.module-title i { color: #4CAF50; }

/* ========== 筛选模块（与所有内容资产完全一致） ========== */
.filter-module { padding: 0 !important; overflow: hidden; }
.filter-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 20px; border-bottom: 1px solid #f0f0f0; background: #FAFBFC;
}
.filter-title { font-size: 14px; font-weight: 600; color: #333; display: flex; align-items: center; gap: 6px; }
.filter-title i { color: #4CAF50; }
.filter-body { padding: 14px 20px 10px; }
.filter-grid { display: grid; gap: 10px 12px; margin-bottom: 10px; }
.filter-grid-5 { grid-template-columns: repeat(5, 1fr); }
.fg-item { min-width: 0; }
.fg-item label { display: block; font-size: 11px; color: #888; margin-bottom: 3px; font-weight: 500; line-height: 1.2; }
.price-range-wrap { display: flex; align-items: center; gap: 4px; }
.price-range-wrap .el-input, .price-range-wrap .price-sel { flex: 1; min-width: 0; }
.range-sep { color: #ccc; font-size: 12px; flex-shrink: 0; }
.filter-inline-row { display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid #f0f0f0; }
.filter-inline-left { display: flex; align-items: center; gap: 8px; }
.inline-label { font-size: 12px; color: #888; font-weight: 500; }
.filter-actions { display: flex; gap: 6px; }

/* ========== 视图切换标签页（与所有内容资产完全一致） ========== */
.view-tabs { display: flex; gap: 0; background: #F5F5F5; border-radius: 12px; padding: 4px; }
.view-tab {
  flex: 0 0 auto; padding: 10px 20px; font-weight: 500; color: #666;
  cursor: pointer; border-radius: 10px; border: none; background: transparent;
  font-size: 14px; transition: all 0.3s;
}
.view-tab.active { background: white; color: #4CAF50; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.view-tab:hover:not(.active) { color: #4CAF50; }
.view-tab .badge { font-size: 10px; padding: 2px 6px; }
.bg-purple { background: #4CAF50 !important; color: white; }

/* ========== 列表头（与所有内容资产完全一致） ========== */
.list-header-bar {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 12px; flex-wrap: wrap; gap: 8px;
}
.list-header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* ========== 表格（与所有内容资产完全一致） ========== */
.table-scroll-wrap { overflow-x: auto; }
.table-pagination { display: flex; justify-content: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid #f0f0f0; }
.op-dropdown-btn { padding: 4px 8px !important; font-size: 12px !important; }

/* 媒体预览 */
.media-preview-container { width: 70px; height: 52px; overflow: hidden; border-radius: 6px; background: #f5f5f5; }
.property-thumb { width: 70px; height: 52px; object-fit: cover; border-radius: 6px; }
.property-thumb-placeholder { width: 70px; height: 52px; display: flex; align-items: center; justify-content: center; color: #ddd; background: #f0f0f0; border-radius: 6px; }

/* 内容单元格 */
.content-cell { position: relative; }
.content-text { font-size: 12px; line-height: 1.5; color: #555; word-break: break-word; }
.content-collapsed { max-height: 60px; overflow: hidden; }
.content-toggle { font-size: 11px; color: #4CAF50; cursor: pointer; font-weight: 500; }
.content-toggle:hover { text-decoration: underline; }

/* 单元格样式 */
.cell-price { color: #E74C3C; font-weight: 600; font-size: 13px; }
.cell-price-unit { font-size: 10px; color: #999; font-weight: 400; }
.cell-num { font-weight: 600; color: #333; }
.cell-empty { color: #ccc; font-size: 12px; }

/* ========== 卡片网格视图 ========== */
.card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.card-grid-item {
  background: #fff; border-radius: 10px; overflow: hidden;
  border: 1px solid #f0f0f0; cursor: pointer; transition: all 0.3s ease;
}
.card-grid-item:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
.card-grid-cover {
  height: 160px; background-size: cover; background-position: center;
  background-color: #f5f5f5; position: relative;
}
.card-grid-tag {
  position: absolute; top: 8px; left: 8px;
  background: rgba(76,175,80,0.9); color: #fff;
  padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;
}
.card-grid-actions {
  position: absolute; bottom: 0; left: 0; right: 0;
  display: flex; justify-content: center; gap: 6px;
  padding: 8px; background: linear-gradient(transparent, rgba(0,0,0,0.6));
  opacity: 0; transition: opacity 0.3s;
}
.card-grid-item:hover .card-grid-actions { opacity: 1; }
.card-grid-body { padding: 12px; }
.card-grid-title { font-size: 14px; font-weight: 600; color: #222; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-grid-meta { font-size: 12px; color: #888; margin-bottom: 8px; display: flex; gap: 6px; flex-wrap: wrap; }
.card-grid-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid #f5f5f5; }
.card-grid-price { font-size: 16px; font-weight: 700; color: #E74C3C; }
.card-grid-price small { font-size: 11px; font-weight: 400; color: #999; }
.card-grid-date { font-size: 11px; color: #bbb; }

/* ========== 移动端筛选栏（与所有内容资产完全一致） ========== */
.m-filter-bar { background: #fff; border-radius: 10px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); overflow: hidden; }
.m-filter-scroll { display: flex; gap: 6px; padding: 8px 10px; overflow-x: auto; -webkit-overflow-scrolling: touch; align-items: center; }
.m-filter-scroll::-webkit-scrollbar { display: none; }
.m-filter-sep { color: #ccc; font-size: 12px; flex-shrink: 0; line-height: 1; }
.m-filter-sel { flex-shrink: 0; width: 80px !important; }
.m-filter-sel :deep(.el-input__wrapper) { padding: 0 6px; }
.m-filter-sel :deep(.el-input__inner) { font-size: 12px; }
.m-filter-btn {
  flex-shrink: 0; display: flex; align-items: center; gap: 3px;
  padding: 0 10px; height: 28px; border-radius: 6px;
  border: 1px solid #e0e0e0; background: #fafafa;
  font-size: 12px; color: #666; cursor: pointer; transition: all 0.2s; white-space: nowrap;
}
.m-filter-btn.active { background: #E8F5E9; color: #4CAF50; border-color: #4CAF50; }
.m-filter-more-btn {
  flex-shrink: 0; display: flex; align-items: center; gap: 4px;
  padding: 0 10px; height: 28px; border-radius: 6px;
  border: 1px solid #e0e0e0; background: #fafafa;
  font-size: 12px; color: #666; cursor: pointer; transition: all 0.2s; white-space: nowrap;
}
.m-filter-more-btn.active { background: #4CAF50; color: #fff; border-color: #4CAF50; }
.m-filter-expand { padding: 8px 10px; border-top: 1px solid #f0f0f0; background: #fafafa; }
.m-filter-expand-row { display: flex; gap: 6px; margin-bottom: 6px; }
.m-filter-kw { flex: 1; }
.m-filter-checks { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* 移动端价格弹出面板样式 */
.m-price-panel { padding: 4px 0; }
.m-price-row { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.m-price-label { font-size: 12px; color: #666; flex-shrink: 0; width: 42px; }
.m-price-sel { flex: 1; }
.m-price-confirm { width: 100%; margin-top: 4px; }

/* ========== 移动端卡片列表（与所有内容资产完全一致） ========== */
.m-card-list { padding: 0; }
.m-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 0 2px; }
.m-list-count { font-size: 12px; color: #888; }
.m-list-count b { color: #333; }
.m-list-size { width: 80px !important; }
.m-property-card {
  background: #fff; border-radius: 10px; padding: 12px; margin-bottom: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06); transition: box-shadow 0.2s; cursor: pointer;
}
.m-property-card:active { box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
.m-card-with-thumb { display: flex; gap: 10px; }
.m-card-thumb {
  width: 88px; height: 88px; flex-shrink: 0; border-radius: 8px;
  overflow: hidden; background: #f5f5f5; position: relative;
}
.m-card-thumb img { width: 100%; height: 100%; object-fit: cover; }
.m-status-badge {
  position: absolute; top: 4px; left: 4px;
  padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 500;
}
.badge-draft { background: #FF9800; color: white; }
.badge-published { background: #4CAF50; color: white; }
.m-card-main { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; }
.m-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.m-card-community { font-size: 14px; font-weight: 600; color: #222; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-card-district { font-size: 11px; background: #EDE7F6; color: #7E57C2; padding: 1px 6px; border-radius: 3px; flex-shrink: 0; margin-left: 6px; }
.m-card-price-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
.m-card-price { font-size: 16px; font-weight: 700; color: #e74c3c; }
.m-card-price small { font-size: 11px; font-weight: 400; color: #999; }
.m-card-price.empty { font-size: 13px; color: #999; font-weight: 400; }
.m-card-rooms { font-size: 12px; color: #555; }
.m-card-footer { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #aaa; }
.m-card-actions { display: flex; gap: 0; }
.m-card-actions .el-button { padding: 2px 6px !important; font-size: 12px !important; }
.m-empty-state { text-align: center; padding: 40px 0; color: #ccc; }
.m-empty-state i { font-size: 36px; margin-bottom: 8px; display: block; }
.m-empty-state p { font-size: 13px; color: #999; }
.m-pagination { display: flex; justify-content: center; padding: 12px 0; }

/* ========== 响应式 ========== */
@media (max-width: 1200px) {
  .filter-grid-5 { grid-template-columns: repeat(3, 1fr); }
  .card-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 900px) {
  .filter-grid-5 { grid-template-columns: repeat(2, 1fr); }
  .card-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 767px) {
  .plugin-header { padding: 10px 12px; border-radius: 8px; margin-bottom: 8px !important; }
  .plugin-header h2 { font-size: 1rem; margin-bottom: 0; }
  .stats-grid { grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px !important; }
  .stats-card { padding: 8px 4px; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
  .stats-card .stats-icon { font-size: 14px; margin-bottom: 2px; }
  .stats-card .value { font-size: 1rem; }
  .stats-card .label { font-size: 9px; }
  .view-tabs { margin-bottom: 8px !important; }
  .view-tab { padding: 6px 14px; font-size: 12px; }
}
.loading-pulse { animation: pulse-anim 1.2s ease-in-out infinite; color: #ddd !important; }
@keyframes pulse-anim { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

/* 辅助类 */
.w-100 { width: 100%; }
.mb-0 { margin-bottom: 0; }
.mb-4 { margin-bottom: 24px; }
.mb-3 { margin-bottom: 16px; }
.me-1 { margin-right: 4px; }
.me-2 { margin-right: 8px; }
.ms-1 { margin-left: 4px; }
.ms-2 { margin-left: 8px; }
.d-flex { display: flex; }
.d-none { display: none; }
.d-md-none { display: none; }
.d-md-flex { display: flex; }
.d-md-block { display: block; }
.gap-2 { gap: 8px; }
.text-muted { color: #999; }
.bg-success { background: #4CAF50 !important; color: white; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; }
@media (max-width: 767px) {
  .d-md-none { display: block; }
  .d-md-flex { display: none; }
  .d-md-block { display: none; }
  .d-none.d-md-block { display: none; }
  .d-none.d-md-flex { display: none; }
}
</style>

<style>
/* 功能未开通弹窗（teleport 到 body，不能用 scoped） */
.fb-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 99999;
  background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
}
.fb-modal {
  background: #fff; border-radius: 16px; padding: 40px 36px 32px;
  max-width: 400px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.fb-icon {
  width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 32px;
}
.fb-title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin: 0 0 12px; }
.fb-desc { font-size: 14px; color: #666; line-height: 1.8; margin: 0 0 28px; }
.fb-btn {
  display: block; width: 240px; margin: 0 auto; padding: 12px 0;
  border-radius: 8px; font-size: 15px; cursor: pointer; transition: all 0.2s;
}
.fb-btn + .fb-btn { margin-top: 12px; }
.fb-btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border: none; font-weight: 600;
}
.fb-btn-primary:hover { transform: translateY(-2px); }
.fb-btn-primary i { margin-right: 6px; }
.fb-btn-secondary { background: transparent; color: #999; font-weight: 500; border: 1px solid #ddd; }
.fb-btn-secondary:hover { color: #666; }
</style>
