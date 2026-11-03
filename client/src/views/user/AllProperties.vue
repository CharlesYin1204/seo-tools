<template>
  <div class="moments-parsed-list">
    <!-- 未购买功能模块：全屏遮罩 + 居中弹窗 -->
    <teleport to="body">
      <div v-if="featureBlocked" class="fb-mask">
        <div class="fb-modal">
          <div class="fb-icon"><i class="fas fa-lock"></i></div>
          <h3 class="fb-title">功能未开通</h3>
          <p class="fb-desc">您尚未购买「内容资产库管理」功能模块，<br>开通后即可浏览所有内容资产、上传管理等功能。</p>
          <button class="fb-btn fb-btn-primary" @click="$router.push('/user/membership')">
            <i class="fas fa-crown"></i> 前往购买会员
          </button>
          <button class="fb-btn fb-btn-secondary" @click="$router.push('/user/dashboard')">返回首页</button>
        </div>
      </div>
    </teleport>

    <!-- 页面头部（与朋友圈解析列表一致：紫色渐变） -->
    <div class="plugin-header">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h2><i class="fas fa-th-list me-2"></i>所有内容资产</h2>
          <p class="mb-0 opacity-75 d-none d-md-block">内容资产库列表，支持筛选、搜索、价格编辑</p>
        </div>
        <div class="d-flex gap-2">
          <el-button @click="fetchProperties"><i class="fas fa-sync-alt me-1"></i>刷新</el-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片（与朋友圈解析列表一致：4列带图标） -->
    <div class="stats-grid mb-4">
      <div class="stats-card">
        <div class="stats-icon"><i class="fas fa-home"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }">{{ statsLoading ? '-' : formatNum(stats.total) }}</div>
        <div class="label">总内容资产数</div>
      </div>
      <div class="stats-card">
        <div class="stats-icon" style="color: #4CAF50"><i class="fas fa-paper-plane"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }" style="color: #4CAF50">{{ statsLoading ? '-' : formatNum(stats.published) }}</div>
        <div class="label">已发布</div>
      </div>
      <div class="stats-card">
        <div class="stats-icon" style="color: #FF9800"><i class="fas fa-calendar-day"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }" style="color: #FF9800">{{ statsLoading ? '-' : formatNum(stats.today) }}</div>
        <div class="label">今日新增</div>
      </div>
      <div class="stats-card">
        <div class="stats-icon" style="color: #9C27B0"><i class="fas fa-images"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }" style="color: #9C27B0">{{ statsLoading ? '-' : formatNum(properties.length) }}</div>
        <div class="label">当前显示</div>
      </div>
    </div>

    <!-- ====== 移动端筛选栏（与朋友圈解析列表一致） ====== -->
    <div class="m-filter-bar d-md-none mb-3">
      <div class="m-filter-scroll">
        <el-select v-model="filters.min_price" placeholder="最低价" size="small" clearable class="m-filter-sel" @change="fetchProperties">
          <el-option v-for="p in priceOptions" :key="'amin'+p" :label="formatPriceLabel(p)" :value="p" />
        </el-select>
        <span class="m-filter-sep">-</span>
        <el-select v-model="filters.max_price" placeholder="最高价" size="small" clearable class="m-filter-sel" @change="fetchProperties">
          <el-option v-for="p in priceOptions" :key="'amax'+p" :label="formatPriceLabel(p)" :value="p" />
        </el-select>
        <el-select v-model="filters.bedrooms" placeholder="卧室" size="small" clearable class="m-filter-sel" @change="fetchProperties">
          <el-option label="全部" value="" />
          <el-option v-for="n in 5" :key="'ab'+n" :label="`${n}室`" :value="n" />
          <el-option label="5室+" :value="6" />
        </el-select>
        <el-select v-model="filters.district" placeholder="区域(可多选)" size="small" clearable filterable multiple collapse-tags :max-collapse-tags="1" class="m-filter-sel" @change="fetchProperties">
          <el-option v-for="d in districts" :key="'ad'+d" :label="d" :value="d" />
        </el-select>
        <el-select v-model="filters.subway_line" placeholder="地铁" size="small" multiple clearable collapse-tags :max-collapse-tags="1" class="m-filter-sel" @change="fetchProperties">
          <el-option v-for="line in subwayLines" :key="'al'+line" :label="line" :value="line" />
        </el-select>
        <button class="m-filter-more-btn" :class="{ active: moreFilterOpen }" @click="moreFilterOpen = !moreFilterOpen">
          <i class="fas fa-sliders-h"></i> 更多
        </button>
      </div>
      <div v-if="moreFilterOpen" class="m-filter-expand">
        <div class="m-filter-expand-row">
          <el-input v-model="filters.keyword" placeholder="搜索小区/描述/关键词..." size="small" clearable class="m-filter-kw" @keyup.enter="fetchProperties" @clear="fetchProperties" />
        </div>
        <div class="m-filter-expand-row">
          <el-input v-model="filters.property_code" placeholder="内容资产编号，逗号分隔" size="small" clearable class="m-filter-half" @keyup.enter="fetchProperties" />
          <el-date-picker v-model="filters.date_range" type="daterange" range-separator="-" start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" size="small" class="m-filter-half" />
        </div>
        <div class="m-filter-expand-row m-filter-checks">
          <el-checkbox v-model="filters.has_elevator" size="small" @change="fetchProperties">电梯</el-checkbox>
          <el-checkbox v-model="filters.has_parking" size="small" @change="fetchProperties">车位</el-checkbox>
          <el-button type="primary" size="small" @click="fetchProperties(); moreFilterOpen = false" style="margin-left: auto"><i class="fas fa-search me-1"></i>筛选</el-button>
          <el-button size="small" @click="resetFilters"><i class="fas fa-redo"></i></el-button>
        </div>
      </div>
    </div>

    <!-- ====== PC端筛选（与朋友圈解析列表完全一致的 .filter-module 风格） ====== -->
    <div class="module-card filter-module mb-4 d-none d-md-block">
      <div class="filter-header">
        <div class="filter-title"><i class="fas fa-filter"></i> 内容资产筛选</div>
      </div>
      <div class="filter-body">
        <div class="filter-grid filter-grid-5">
          <div class="fg-item">
            <label>关键词搜索</label>
            <el-input v-model="filters.keyword" placeholder="搜索小区、街道、描述..." size="small" clearable @keyup.enter="fetchProperties" @clear="fetchProperties" />
          </div>
          <div class="fg-item">
            <label>价格范围</label>
            <div class="price-range-wrap">
              <el-input v-model.number="filters.min_price" placeholder="最低" size="small" type="number" class="price-sel" />
              <span class="range-sep">-</span>
              <el-input v-model.number="filters.max_price" placeholder="最高" size="small" type="number" class="price-sel" />
            </div>
          </div>
          <div class="fg-item">
            <label>卧室</label>
            <el-select v-model="filters.bedrooms" placeholder="不限" size="small" clearable class="w-100" @change="fetchProperties">
              <el-option v-for="n in 5" :key="n" :label="`${n}室`" :value="n" />
              <el-option label="5室+" :value="6" />
            </el-select>
          </div>
          <div class="fg-item">
            <label>区域 <small>(可多选)</small></label>
            <el-select v-model="filters.district" placeholder="全部区域" size="small" clearable filterable multiple collapse-tags :max-collapse-tags="3" class="w-100" @change="fetchProperties">
              <el-option v-for="d in districts" :key="d" :label="d" :value="d" />
            </el-select>
          </div>
          <div class="fg-item">
            <label>内容资产编号</label>
            <el-input v-model="filters.property_code" placeholder="编号，逗号分隔" size="small" clearable @keyup.enter="fetchProperties" />
          </div>
        </div>
        <div class="filter-grid filter-grid-5">
          <div class="fg-item">
            <label>地铁线路 <small>(可多选)</small></label>
            <el-select v-model="filters.subway_line" placeholder="选择线路" size="small" multiple clearable collapse-tags :max-collapse-tags="2" class="w-100" @change="fetchProperties">
              <el-option v-for="line in subwayLines" :key="line" :label="line" :value="line" />
            </el-select>
          </div>
          <div class="fg-item">
            <label>发布时间</label>
            <div class="price-range-wrap">
              <el-date-picker v-model="filters.date_from" type="date" placeholder="开始" size="small" value-format="YYYY-MM-DD" @change="fetchProperties" />
              <span class="range-sep">-</span>
              <el-date-picker v-model="filters.date_to" type="date" placeholder="结束" size="small" value-format="YYYY-MM-DD" @change="fetchProperties" />
            </div>
          </div>
          <div class="fg-item" style="grid-column: span 3">
            <!-- 空占位，保持网格对齐 -->
          </div>
        </div>
        <div class="filter-inline-row">
          <div class="filter-inline-left">
            <span class="inline-label">其他条件</span>
            <el-checkbox v-model="filters.has_elevator" size="small" @change="fetchProperties">有电梯</el-checkbox>
            <el-checkbox v-model="filters.has_parking" size="small" @change="fetchProperties">有车位</el-checkbox>
          </div>
          <div class="filter-actions">
            <el-button type="primary" size="small" @click="fetchProperties"><i class="fas fa-search me-1"></i>筛选</el-button>
            <el-button size="small" @click="resetFilters"><i class="fas fa-redo me-1"></i>重置</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 视图切换标签页（与朋友圈解析列表一致） -->
    <div class="view-tabs mb-3">
      <button class="view-tab" :class="{ active: viewMode === 'table' }" @click="viewMode = 'table'">
        <i class="fas fa-list me-1"></i>列表视图
      </button>
      <button class="view-tab" :class="{ active: viewMode === 'card' }" @click="viewMode = 'card'">
        <i class="fas fa-th-large me-1"></i>卡片视图
        <span class="badge bg-purple ms-1">{{ pagination.total }}</span>
      </button>
    </div>

    <!-- ====== 移动端卡片列表（与朋友圈解析列表一致） ====== -->
    <div v-if="isMobileView" class="m-card-list" v-loading="loading">
      <div class="m-list-header">
        <span class="m-list-count">共 <b>{{ pagination.total }}</b> 条内容资产</span>
        <el-select v-model="pagination.pageSize" size="small" class="m-list-size" @change="fetchProperties">
          <el-option :value="20" label="20条" /><el-option :value="50" label="50条" /><el-option :value="100" label="100条" />
        </el-select>
      </div>
      <div v-for="prop in properties" :key="prop.id" class="m-property-card" @click="viewProperty(prop)">
        <div class="m-card-with-thumb">
          <div class="m-card-thumb">
            <img :src="getThumb(prop) || '/uploads/placeholder.png'" @error="$event.target.src='/uploads/placeholder.png'" />
          </div>
          <div class="m-card-main">
            <div class="m-card-top">
              <div class="m-card-community">{{ prop.community || prop.title?.split(' ')[0] || '未知小区' }}</div>
              <div v-if="prop.district" class="m-card-district">{{ prop.district }}</div>
            </div>
            <div class="m-card-body">
              <div class="m-card-price-row">
                <span v-if="prop.custom_price && prop.custom_price != getOriginalPrice(prop)" class="m-card-price">
                  ¥{{ Number(prop.custom_price).toLocaleString() }}<small>/月</small>
                  <small class="m-price-original">原¥{{ Number(getOriginalPrice(prop)).toLocaleString() }}</small>
                </span>
                <span v-else-if="getOriginalPrice(prop)" class="m-card-price">¥{{ Number(getOriginalPrice(prop)).toLocaleString() }}<small>/月</small></span>
                <span v-else class="m-card-price empty">价格面议</span>
                <span class="m-card-rooms">
                  <template v-if="prop.bedrooms">{{ prop.bedrooms }}室</template>
                  <template v-if="prop.bathrooms">{{ prop.bathrooms }}卫</template>
                </span>
              </div>
              <div class="m-card-tags">
                <span v-if="hasFeature(prop, 'elevator')" class="m-tag green">电梯</span>
                <span v-if="hasFeature(prop, 'parking')" class="m-tag blue">车位</span>
              </div>
              <div v-if="prop.subway_line || prop.metro_lines || prop.metro_stations" class="m-card-metro">
                <i class="fas fa-subway"></i>
                <span>{{ prop.subway_line || prop.metro_lines || '' }}</span>
                <span v-if="prop.subway_station || prop.metro_stations" class="m-card-station">{{ prop.subway_station || prop.metro_stations }}</span>
              </div>
              <div class="m-card-footer">
                <span class="m-card-code"><i class="fas fa-hashtag"></i> {{ prop.property_code || prop.id }}</span>
                <span class="m-card-time">{{ formatMobileTime(prop.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="m-card-dp-row" @click.stop>
          <div v-if="editingDisplayPriceId === prop.id" class="m-dp-edit">
            <span class="m-dp-label">外展价</span>
            <el-input-number v-model="editingDisplayPriceValue" :min="0" size="small" controls-position="right" style="width: 120px" />
            <el-button size="small" type="success" @click="saveDisplayPrice(prop)"><i class="fas fa-check"></i></el-button>
            <el-button size="small" @click="cancelDisplayPriceEdit"><i class="fas fa-times"></i></el-button>
          </div>
          <div v-else class="m-dp-display" @click="startDisplayPriceEdit(prop)">
            <span class="m-dp-label">外展价</span>
            <span v-if="prop.display_price" class="m-dp-value">¥{{ Number(prop.display_price).toLocaleString() }}</span>
            <span v-else class="m-dp-empty">未设置</span>
            <i class="fas fa-pencil-alt m-dp-icon"></i>
          </div>
        </div>
      </div>
      <div v-if="!loading && properties.length === 0" class="m-empty-state">
        <i class="fas fa-inbox"></i>
        <p>暂无内容资产数据</p>
      </div>
      <div class="m-pagination" v-if="pagination.total > pagination.pageSize">
        <el-pagination v-model:current-page="pagination.page" :page-size="pagination.pageSize" :total="pagination.total" layout="prev, pager, next" small @current-change="fetchProperties" />
      </div>
    </div>

    <!-- ====== PC端列表视图（与朋友圈解析列表一致：el-table） ====== -->
    <div v-show="viewMode === 'table' && !isMobileView" class="module-card">
      <div class="list-header-bar">
        <div class="module-title mb-0">
          <i class="fas fa-list"></i>
          <span>内容资产列表</span>
          <span class="badge bg-success ms-2" style="font-size: 12px">共 {{ pagination.total }} 条</span>
        </div>
        <div class="list-header-actions">
          <span v-if="selectedIds.length" class="text-muted" style="font-size: 12px; white-space: nowrap">已选 {{ selectedIds.length }} 条</span>
          <el-select v-model="pagination.pageSize" size="small" style="width: 90px" @change="fetchProperties">
            <el-option :value="20" label="20条/页" /><el-option :value="50" label="50条/页" /><el-option :value="100" label="100条/页" />
          </el-select>
        </div>
      </div>
      <div class="table-scroll-wrap">
        <el-table v-loading="loading" :data="properties" stripe border size="small" :max-height="tableMaxHeight" @selection-change="onSelectionChange" style="width: 100%">
          <el-table-column type="selection" width="40" />
          <el-table-column label="操作" width="72" fixed="left" align="center">
            <template #default="{ row }">
              <el-dropdown trigger="click" placement="bottom-start" @command="(cmd) => handleOpDropdown(cmd, row)">
                <el-button size="small" type="primary" plain class="op-dropdown-btn">
                  操作<i class="fas fa-chevron-down ms-1" style="font-size:10px"></i>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="detail"><i class="fas fa-eye me-2" style="color:#909399"></i>详情</el-dropdown-item>
                    <el-dropdown-item command="copy"><i class="fas fa-copy me-2" style="color:#409EFF"></i>复制信息</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </el-table-column>
          <el-table-column label="媒体" width="90">
            <template #default="{ row }">
              <div class="media-preview-container">
                <img v-if="getThumb(row)" :src="getThumb(row)" class="property-thumb" @error="$event.target.src='/uploads/placeholder.png'">
                <div v-else class="property-thumb-placeholder"><i class="fas fa-image"></i></div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="内容资产描述" min-width="220">
            <template #default="{ row }">
              <div class="content-cell">
                <div class="content-text" :class="{ 'content-collapsed': !row._expanded }">{{ row.description || row.title || row.original_content || '-' }}</div>
                <span v-if="needTruncate(row.description || row.title || row.original_content || '')" class="content-toggle" @click="row._expanded = !row._expanded">{{ row._expanded ? '收起' : '展开' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="小区" width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.community || '-' }}</template>
          </el-table-column>
          <el-table-column label="价格" width="110">
            <template #default="{ row }">
              <div v-if="editingPriceId === row.id" class="price-edit-inline">
                <el-input v-model.number="editingPriceValue" size="small" type="number" style="width: 80px" @keyup.enter="savePrice(row)" @keyup.escape="cancelPriceEdit" />
                <el-button size="small" type="success" :icon="''" @click="savePrice(row)" style="padding:4px 6px"><i class="fas fa-check"></i></el-button>
              </div>
              <div v-else class="price-display" @click="startPriceEdit(row)" title="点击修改价格">
                <div v-if="row.custom_price && row.custom_price != getOriginalPrice(row)" class="price-modified">
                  <span class="price-original">¥{{ getOriginalPrice(row) }}</span>
                  <span class="price-custom">¥{{ row.custom_price }}<i class="fas fa-pencil-alt price-edit-icon"></i></span>
                </div>
                <span v-else class="cell-price editable-cell admin-editable">¥{{ getOriginalPrice(row) || '-' }}<i class="fas fa-pencil-alt price-edit-icon"></i></span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="外展价" width="110">
            <template #default="{ row }">
              <div v-if="editingDisplayPriceId === row.id" class="price-edit-inline">
                <el-input v-model.number="editingDisplayPriceValue" size="small" type="number" style="width: 80px" @keyup.enter="saveDisplayPrice(row)" @keyup.escape="cancelDisplayPriceEdit" />
                <el-button size="small" type="success" :icon="''" @click="saveDisplayPrice(row)" style="padding:4px 6px"><i class="fas fa-check"></i></el-button>
              </div>
              <div v-else class="price-display" @click="startDisplayPriceEdit(row)" title="点击设置外展价">
                <span v-if="row.display_price" class="cell-price editable-cell admin-editable" style="color:#FF9800">¥{{ Number(row.display_price).toLocaleString() }}<i class="fas fa-pencil-alt price-edit-icon"></i></span>
                <span v-else class="cell-empty editable-cell admin-editable">未设置<i class="fas fa-pencil-alt price-edit-icon"></i></span>
              </div>
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
          <el-table-column label="编号" width="90" show-overflow-tooltip>
            <template #default="{ row }"><small class="text-muted">{{ row.property_code || row.id }}</small></template>
          </el-table-column>
          <el-table-column label="电梯" width="50" align="center">
            <template #default="{ row }">
              <span v-if="hasFeature(row, 'elevator')" class="badge-yes">✓</span>
              <span v-else class="badge-gray">-</span>
            </template>
          </el-table-column>
          <el-table-column label="车位" width="50" align="center">
            <template #default="{ row }">
              <span v-if="hasFeature(row, 'parking')" class="badge-yes">✓</span>
              <span v-else class="badge-gray">-</span>
            </template>
          </el-table-column>
          <el-table-column label="地铁" width="90" show-overflow-tooltip>
            <template #default="{ row }">{{ row.subway_line || row.metro_lines || '-' }}</template>
          </el-table-column>
          <el-table-column label="发布时间" width="130">
            <template #default="{ row }"><small>{{ formatDate(row.created_at) }}</small></template>
          </el-table-column>
        </el-table>
      </div>
      <div class="table-pagination" v-if="pagination.total > pagination.pageSize">
        <el-pagination v-model:current-page="pagination.page" :total="pagination.total" :page-size="pagination.pageSize" layout="total, prev, pager, next" @current-change="fetchProperties" />
      </div>
    </div>

    <!-- ====== PC端卡片视图 ====== -->
    <div v-show="viewMode === 'card' && !isMobileView" class="module-card" v-loading="loading">
      <div class="list-header-bar">
        <div class="module-title mb-0">
          <i class="fas fa-th-large"></i>
          <span>卡片视图</span>
          <span class="badge bg-success ms-2" style="font-size: 12px">共 {{ pagination.total }} 条</span>
        </div>
        <div class="list-header-actions">
          <el-select v-model="pagination.pageSize" size="small" style="width: 90px" @change="fetchProperties">
            <el-option :value="12" label="12条/页" /><el-option :value="24" label="24条/页" /><el-option :value="50" label="50条/页" />
          </el-select>
        </div>
      </div>
      <div class="card-grid" v-if="properties.length">
        <div v-for="prop in properties" :key="prop.id" class="card-grid-item" @click="viewProperty(prop)">
          <div class="card-grid-cover" :style="{ backgroundImage: `url(${getThumb(prop) || '/uploads/placeholder.png'})` }">
            <span v-if="prop.district" class="card-grid-tag">{{ prop.district }}</span>
          </div>
          <div class="card-grid-body">
            <div class="card-grid-title">{{ prop.community || prop.title?.split(' ')[0] || '未知小区' }}</div>
            <div class="card-grid-meta">
              <span v-if="prop.bedrooms">{{ prop.bedrooms }}室</span>
              <span v-if="prop.bathrooms">{{ prop.bathrooms }}卫</span>
              <span v-if="prop.area_sqm">{{ prop.area_sqm }}㎡</span>
            </div>
            <div class="card-grid-footer">
              <span class="card-grid-price">
                <template v-if="prop.custom_price && prop.custom_price != getOriginalPrice(prop)">¥{{ Number(prop.custom_price).toLocaleString() }}</template>
                <template v-else-if="getOriginalPrice(prop)">¥{{ Number(getOriginalPrice(prop)).toLocaleString() }}</template>
                <template v-else>面议</template>
                <small>/月</small>
              </span>
              <span class="card-grid-code">#{{ prop.property_code || prop.id }}</span>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-if="!loading && properties.length === 0" description="暂无内容资产数据" :image-size="80" />
      <div class="table-pagination" v-if="pagination.total > pagination.pageSize">
        <el-pagination v-model:current-page="pagination.page" :total="pagination.total" :page-size="pagination.pageSize" layout="total, prev, pager, next" @current-change="fetchProperties" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/api'

const route = useRoute()
const router = useRouter()
const isAdminView = route.path.startsWith('/admin')
const featureBlocked = ref(false)

const loading = ref(false)
const statsLoading = ref(true)
const properties = ref([])
const selectedIds = ref([])
let fetchAbortController = null
const viewMode = ref('table')
const isMobileView = ref(window.innerWidth < 768)
const moreFilterOpen = ref(false)
const tableMaxHeight = ref(Math.max(500, window.innerHeight - 380))

function onResize() {
  isMobileView.value = window.innerWidth < 768
  tableMaxHeight.value = Math.max(500, window.innerHeight - 380)
}

const editingPriceId = ref(null)
const editingPriceValue = ref(null)
const editingDisplayPriceId = ref(null)
const editingDisplayPriceValue = ref(null)

const stats = reactive({ total: 0, today: 0, published: 0 })

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

const districts = ref([
  '黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区',
  '浦东新区', '闵行区', '宝山区', '嘉定区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'
])
const subwayLines = ref([
  '1号线', '2号线', '3号线', '4号线', '5号线', '6号线', '7号线', '8号线',
  '9号线', '10号线', '11号线', '12号线', '13号线', '14号线', '15号线', '16号线', '17号线', '18号线'
])

const filters = reactive({
  property_code: '', keyword: '', min_price: null, max_price: null,
  bedrooms: '', district: [], subway_line: [], date_range: null,
  date_from: '', date_to: '',
  has_elevator: false, has_parking: false,
})

const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

function needTruncate(text) { return text && text.length > 80 }

function proxyIfNeeded(url) {
  if (!url) return ''
  if (url.startsWith('/api/proxy/image')) return url
  if (url.includes('X-Amz-Signature')) return url
  if (url.includes('qpic.cn') || url.includes('wx.qlogo.cn') || url.includes('rains3.com') || url.includes('wechat') || url.includes('mmbiz') || url.includes('szangels') || url.includes('imgcache.qq.com') || url.includes('hkimg.qq.com') || url.includes('wtimg.qq.com') || url.includes('smartgaga')) {
    return '/api/proxy/image?url=' + encodeURIComponent(url)
  }
  return url
}

function getThumb(prop) {
  if (prop.cover_image) return proxyIfNeeded(prop.cover_image)
  if (prop._single_image && prop._default_cover) return prop._default_cover
  const sources = [prop.media_urls, prop.local_images, prop.images]
  let totalNonVideo = 0
  let firstNonVideoUrl = ''
  for (const raw of sources) {
    if (!raw) continue
    try {
      const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!Array.isArray(arr) || !arr.length) continue
      for (const u of arr) {
        const url = typeof u === 'string' ? u : (u?.url || u?.thumb || '')
        if (url && !/\.(mp4|mov|avi|m4v|webm|ogg)(\?|$)/i.test(url) && !/video\.qq\.com|snsvideodownload/i.test(url)) {
          totalNonVideo++
          if (!firstNonVideoUrl) firstNonVideoUrl = typeof u === 'string' ? u : (u?.url || u?.thumb || '')
        }
      }
    } catch {}
  }
  if (totalNonVideo <= 1 && prop._default_cover) return prop._default_cover
  return firstNonVideoUrl ? proxyIfNeeded(firstNonVideoUrl) : ''
}

function hasFeature(prop, feature) {
  if (feature === 'elevator' && prop.has_elevator) return true
  if (feature === 'parking' && prop.has_parking) return true
  try {
    const amenities = typeof prop.amenities === 'string' ? JSON.parse(prop.amenities || '[]') : (prop.amenities || [])
    const features = typeof prop.features === 'string' ? JSON.parse(prop.features || '[]') : (prop.features || [])
    const combined = [...amenities, ...features].map(f => String(f).toLowerCase())
    return combined.includes(feature.toLowerCase())
  } catch { return false }
}

function formatDate(d) {
  if (!d) return '-'
  try { return new Date(d).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
  catch { return d }
}

function viewProperty(row) { window.open(`/properties/${row.id}`, '_blank') }

function copyPropertyInfo(prop) {
  const displayPrice = prop.custom_price || getOriginalPrice(prop)
  const info = [
    prop.community || prop.title || prop.description || '',
    prop.district ? `区域: ${prop.district}` : '',
    displayPrice ? `价格: ¥${displayPrice}` : '',
    prop.bedrooms ? `${prop.bedrooms}室` : '',
  ].filter(Boolean).join('\n')
  navigator.clipboard?.writeText(info)
  ElMessage.success('内容资产信息已复制')
}

function onSelectionChange(rows) {
  selectedIds.value = rows.map(r => r.id)
}

function handleOpDropdown(cmd, row) {
  if (cmd === 'detail') viewProperty(row)
  else if (cmd === 'copy') copyPropertyInfo(row)
}

function getOriginalPrice(prop) {
  return prop.price_value || parseFloat(String(prop.price).replace(/[¥,]/g, '')) || 0
}

function startPriceEdit(prop) { editingPriceId.value = prop.id; editingPriceValue.value = prop.custom_price || getOriginalPrice(prop) || 0 }
function cancelPriceEdit() { editingPriceId.value = null; editingPriceValue.value = null }

async function savePrice(prop) {
  const newPrice = parseFloat(editingPriceValue.value)
  if (isNaN(newPrice) || newPrice < 0) { ElMessage.warning('请输入有效的价格'); return }
  try {
    await api.put(`/user/expat/parsed-properties/${prop.id}`, { custom_price: newPrice })
    prop.custom_price = newPrice; ElMessage.success('改后价已保存'); cancelPriceEdit()
  } catch { ElMessage.error('价格更新失败') }
}

function startDisplayPriceEdit(prop) { editingDisplayPriceId.value = prop.id; editingDisplayPriceValue.value = prop.display_price || getOriginalPrice(prop) || 0 }
function cancelDisplayPriceEdit() { editingDisplayPriceId.value = null; editingDisplayPriceValue.value = null }

async function saveDisplayPrice(prop) {
  const newPrice = parseFloat(editingDisplayPriceValue.value)
  if (isNaN(newPrice) || newPrice < 0) { ElMessage.warning('请输入有效的外展价'); return }
  try {
    await api.put(`/user/expat/parsed-properties/${prop.id}`, { display_price: newPrice })
    prop.display_price = newPrice; ElMessage.success('外展价已保存'); cancelDisplayPriceEdit()
  } catch { ElMessage.error('外展价更新失败') }
}

function syncStatsWithTotal(total) {
  const safeTotal = Number(total) || 0
  stats.total = safeTotal
  stats.published = safeTotal
  stats.today = 0
}

async function loadStats() {
  statsLoading.value = true
  try {
    const params = { page: 1, page_size: 1 }
    const res = await api.get('/user/expat/parsed-properties', { params, timeout: 120000 })
    const raw = res.data
    const pag = raw?.pagination || raw?.data?.pagination || {}
    syncStatsWithTotal(pag?.total ?? raw?.total ?? 0)
  } catch (err) {
    if (!axios.isCancel(err) && err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
      syncStatsWithTotal(0)
    }
  }
  statsLoading.value = false
}

async function fetchProperties() {
  if (fetchAbortController) fetchAbortController.abort()
  fetchAbortController = new AbortController()
  loading.value = true
  try {
    const params = { page: pagination.page, page_size: pagination.pageSize }
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.property_code) params.property_code = filters.property_code
    const distParam = Array.isArray(filters.district) ? filters.district.filter(Boolean).join(',') : (filters.district || '')
    if (distParam) params.district = distParam
    if (filters.bedrooms) params.bedrooms = filters.bedrooms
    if (filters.min_price) params.price_min = filters.min_price
    if (filters.max_price) params.price_max = filters.max_price
    if (filters.subway_line?.length) params.metro_lines = filters.subway_line.join(',')
    if (filters.has_elevator) params.has_elevator = 1
    if (filters.has_parking) params.has_parking = 1
    if (filters.date_from) params.publish_time_start = filters.date_from
    if (filters.date_to) params.publish_time_end = filters.date_to
    if (filters.date_range?.length === 2) {
      params.publish_time_start = filters.date_range[0]
      params.publish_time_end = filters.date_range[1]
    }
    const res = await api.get('/user/expat/parsed-properties', { params, signal: fetchAbortController.signal, timeout: 120000 })
    const raw = res.data
    const pag = raw?.pagination || raw?.data?.pagination
    const list = raw?.data || raw?.list || raw?.items || raw?.properties || (Array.isArray(raw) ? raw : [])
    const actualList = Array.isArray(list) ? list : (list?.data || list?.list || [])
    properties.value = (Array.isArray(actualList) ? actualList : []).map(r => ({ ...r, _expanded: false }))
    pagination.total = Number(pag?.total ?? raw?.total ?? 0) || 0
    selectedIds.value = []
    syncStatsWithTotal(pagination.total)
  } catch (err) {
    if (!axios.isCancel(err) && err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
      ElMessage.error(err?.response?.data?.message || '获取内容资产列表失败')
      properties.value = []
      pagination.total = 0
      syncStatsWithTotal(0)
    }
  } finally {
    loading.value = false
    fetchAbortController = null
  }
}

function resetFilters() {
  Object.assign(filters, {
    property_code: '', keyword: '', min_price: null, max_price: null,
    bedrooms: '', district: [], subway_line: [], date_range: null,
    date_from: '', date_to: '',
    has_elevator: false, has_parking: false,
  })
  pagination.page = 1
  fetchProperties()
}

onMounted(async () => {
  window.addEventListener('resize', onResize)
  if (!isAdminView) {
    try {
      const checkRes = await api.get('/user/feature-modules/check/property-library')
      const access = checkRes.data
      if (access && access.allowed === false) { featureBlocked.value = true; return }
    } catch (e) {
      if (e.response?.status === 403) { featureBlocked.value = true; return }
    }
  }
  loadStats()
  fetchProperties()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (fetchAbortController) fetchAbortController.abort()
})
</script>

<style scoped>
/* ========== 页面头部（与朋友圈解析列表完全一致） ========== */
.plugin-header {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white; padding: 20px 24px; border-radius: 12px; margin-bottom: 20px;
}
.plugin-header h2 { font-size: 1.3rem; font-weight: 700; margin: 0 0 4px 0; color: white; }
.plugin-header p { font-size: 13px; color: rgba(255,255,255,0.8); }

/* ========== 统计卡片（与朋友圈解析列表完全一致） ========== */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.stats-card {
  background: white; border-radius: 12px; padding: 16px 20px; text-align: center;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06); transition: all 0.3s ease; min-width: 0;
}
.stats-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
.stats-card .stats-icon { font-size: 20px; color: #3498db; margin-bottom: 6px; }
.stats-card .value { font-size: 1.5rem; font-weight: 700; color: #333; line-height: 1.2; }
.stats-card .label { font-size: 12px; color: #999; margin-top: 4px; }

/* ========== 模块卡片（与朋友圈解析列表完全一致） ========== */
.module-card {
  background: white; border-radius: 12px; padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
.module-title {
  font-size: 15px; font-weight: 600; color: #333;
  display: flex; align-items: center; gap: 8px;
}
.module-title i { color: #667eea; }

/* ========== 筛选模块（与朋友圈解析列表完全一致） ========== */
.filter-module { padding: 0 !important; overflow: hidden; }
.filter-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 20px; border-bottom: 1px solid #f0f0f0; background: #FAFBFC;
}
.filter-title { font-size: 14px; font-weight: 600; color: #333; display: flex; align-items: center; gap: 6px; }
.filter-title i { color: #667eea; }
.filter-body { padding: 14px 20px 10px; }
.filter-grid { display: grid; gap: 10px 12px; margin-bottom: 10px; }
.filter-grid-5 { grid-template-columns: repeat(5, 1fr); }
.fg-item { min-width: 0; }
.fg-item label { display: block; font-size: 11px; color: #888; margin-bottom: 3px; font-weight: 500; line-height: 1.2; }
.fg-item label small { color: #bbb; }
.price-range-wrap { display: flex; align-items: center; gap: 4px; }
.price-range-wrap .el-input, .price-range-wrap .el-date-editor, .price-range-wrap .price-sel { flex: 1; min-width: 0; }
.range-sep { color: #ccc; font-size: 12px; flex-shrink: 0; }
.filter-inline-row { display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid #f0f0f0; }
.filter-inline-left { display: flex; align-items: center; gap: 8px; }
.inline-label { font-size: 12px; color: #888; font-weight: 500; }
.filter-actions { display: flex; gap: 6px; }

/* ========== 视图切换标签页（与朋友圈解析列表完全一致） ========== */
.view-tabs { display: flex; gap: 0; background: #F5F5F5; border-radius: 12px; padding: 4px; }
.view-tab {
  flex: 0 0 auto; padding: 10px 20px; font-weight: 500; color: #666;
  cursor: pointer; border-radius: 10px; border: none; background: transparent;
  font-size: 14px; transition: all 0.3s;
}
.view-tab.active { background: white; color: #9C27B0; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.view-tab:hover:not(.active) { color: #9C27B0; }
.view-tab .badge { font-size: 10px; padding: 2px 6px; }
.bg-purple { background: #9C27B0 !important; color: white; }

/* ========== 列表头（与朋友圈解析列表完全一致） ========== */
.list-header-bar {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 12px; flex-wrap: wrap; gap: 8px;
}
.list-header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* ========== 表格（与朋友圈解析列表完全一致） ========== */
.table-scroll-wrap { overflow-x: auto; }
.table-pagination { display: flex; justify-content: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid #f0f0f0; }

/* 操作下拉按钮 */
.op-dropdown-btn { padding: 4px 8px !important; font-size: 12px !important; }

/* 媒体预览 */
.media-preview-container { width: 70px; height: 52px; overflow: hidden; border-radius: 6px; background: #f5f5f5; }
.property-thumb { width: 70px; height: 52px; object-fit: cover; border-radius: 6px; }
.property-thumb-placeholder { width: 70px; height: 52px; display: flex; align-items: center; justify-content: center; color: #ddd; background: #f0f0f0; border-radius: 6px; }

/* 内容单元格（与朋友圈解析列表一致） */
.content-cell { position: relative; }
.content-text { font-size: 12px; line-height: 1.5; color: #555; word-break: break-word; }
.content-collapsed { max-height: 60px; overflow: hidden; }
.content-toggle { font-size: 11px; color: #667eea; cursor: pointer; font-weight: 500; }
.content-toggle:hover { text-decoration: underline; }

/* 单元格样式（与朋友圈解析列表一致） */
.cell-price { color: #E74C3C; font-weight: 600; font-size: 13px; }
.cell-price-unit { font-size: 10px; color: #999; font-weight: 400; }
.cell-num { font-weight: 600; color: #333; }
.cell-empty { color: #ccc; font-size: 12px; }
.editable-cell { cursor: pointer; transition: all 0.2s; }
.admin-editable:hover { background: #FFF8E1; border-radius: 3px; padding: 1px 3px; margin: -1px -3px; }

/* 价格编辑 */
.price-display { cursor: pointer; }
.price-edit-inline { display: flex; align-items: center; gap: 4px; }
.price-edit-icon { font-size: 9px; color: #ccc; margin-left: 3px; opacity: 0; transition: opacity 0.2s; }
.editable-cell:hover .price-edit-icon, .price-display:hover .price-edit-icon { opacity: 1; }
.price-modified { display: flex; flex-direction: column; gap: 1px; line-height: 1.2; }
.price-original { font-size: 10px; color: #bbb; text-decoration: line-through; font-weight: 400; }
.price-custom { color: #E74C3C; font-weight: 600; font-size: 12px; }

/* 标记样式（与朋友圈解析列表一致） */
.badge-yes { background: #E8F5E9; color: #4CAF50; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 500; }
.badge-gray { color: #ddd; font-size: 12px; }

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
  background: rgba(102,126,234,0.9); color: #fff;
  padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;
}
.card-grid-body { padding: 12px; }
.card-grid-title { font-size: 14px; font-weight: 600; color: #222; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-grid-meta { font-size: 12px; color: #888; margin-bottom: 8px; display: flex; gap: 6px; }
.card-grid-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid #f5f5f5; }
.card-grid-price { font-size: 16px; font-weight: 700; color: #E74C3C; }
.card-grid-price small { font-size: 11px; font-weight: 400; color: #999; }
.card-grid-code { font-size: 11px; color: #bbb; }

/* ========== 移动端筛选栏（与朋友圈解析列表完全一致） ========== */
.m-filter-bar { background: #fff; border-radius: 10px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); overflow: hidden; }
.m-filter-scroll { display: flex; gap: 6px; padding: 8px 10px; overflow-x: auto; -webkit-overflow-scrolling: touch; align-items: center; }
.m-filter-scroll::-webkit-scrollbar { display: none; }
.m-filter-sep { color: #ccc; font-size: 12px; flex-shrink: 0; line-height: 1; }
.m-filter-sel { flex-shrink: 0; width: 80px !important; }
.m-filter-sel :deep(.el-input__wrapper) { padding: 0 6px; }
.m-filter-sel :deep(.el-input__inner) { font-size: 12px; }
.m-filter-more-btn {
  flex-shrink: 0; display: flex; align-items: center; gap: 4px;
  padding: 0 10px; height: 28px; border-radius: 6px;
  border: 1px solid #e0e0e0; background: #fafafa;
  font-size: 12px; color: #666; cursor: pointer; transition: all 0.2s; white-space: nowrap;
}
.m-filter-more-btn.active { background: #667eea; color: #fff; border-color: #667eea; }
.m-filter-expand { padding: 8px 10px; border-top: 1px solid #f0f0f0; background: #fafafa; }
.m-filter-expand-row { display: flex; gap: 6px; margin-bottom: 6px; }
.m-filter-kw { flex: 1; }
.m-filter-half { flex: 1; min-width: 0; }
.m-filter-checks { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* ========== 移动端卡片列表（与朋友圈解析列表完全一致） ========== */
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
  overflow: hidden; background: #f5f5f5;
}
.m-card-thumb img { width: 100%; height: 100%; object-fit: cover; }
.m-card-main { flex: 1; min-width: 0; }
.m-card-dp-row { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #eee; }
.m-dp-edit { display: flex; align-items: center; gap: 6px; }
.m-dp-display { display: flex; align-items: center; gap: 6px; cursor: pointer; transition: background 0.2s; padding: 2px 4px; border-radius: 4px; }
.m-dp-display:hover { background: #FFF8E1; }
.m-dp-label { font-size: 11px; color: #999; flex-shrink: 0; }
.m-dp-value { font-size: 14px; font-weight: 600; color: #FF9800; }
.m-dp-empty { font-size: 12px; color: #ccc; }
.m-dp-icon { font-size: 10px; color: #ccc; margin-left: 2px; }
.m-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.m-card-community { font-size: 14px; font-weight: 600; color: #222; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-card-district { font-size: 11px; background: #EDE7F6; color: #7E57C2; padding: 1px 6px; border-radius: 3px; flex-shrink: 0; margin-left: 6px; }
.m-card-price-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.m-card-price { font-size: 18px; font-weight: 700; color: #e74c3c; }
.m-card-price small { font-size: 11px; font-weight: 400; color: #999; }
.m-card-price.empty { font-size: 14px; color: #999; font-weight: 400; }
.m-price-original { text-decoration: line-through; color: #bbb; font-size: 10px; margin-left: 4px; }
.m-card-rooms { font-size: 13px; color: #555; }
.m-card-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; }
.m-tag { font-size: 10px; padding: 1px 5px; border-radius: 3px; font-weight: 500; }
.m-tag.green { background: #e8f5e9; color: #2e7d32; }
.m-tag.blue { background: #e3f2fd; color: #1565c0; }
.m-card-metro { font-size: 12px; color: #666; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-card-metro i { color: #667eea; font-size: 11px; flex-shrink: 0; }
.m-card-station { color: #999; }
.m-card-footer { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #aaa; }
.m-card-code i { margin-right: 2px; font-size: 9px; }
.m-empty-state { text-align: center; padding: 40px 0; color: #ccc; }
.m-empty-state i { font-size: 36px; margin-bottom: 8px; }
.m-empty-state p { font-size: 13px; color: #999; }
.m-pagination { display: flex; justify-content: center; padding: 12px 0; }

/* ========== 响应式（与朋友圈解析列表完全一致） ========== */
@media (max-width: 1200px) {
  .filter-grid-5 { grid-template-columns: repeat(3, 1fr); }
  .card-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 900px) {
  .filter-grid-5 { grid-template-columns: repeat(2, 1fr); }
  .stats-card { padding: 12px 14px; }
  .stats-card .value { font-size: 1.3rem; }
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
.d-md-block { display: block; }
.gap-2 { gap: 8px; }
.text-muted { color: #999; }
.bg-success { background: #4CAF50 !important; color: white; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; }
@media (max-width: 767px) {
  .d-md-none { display: block; }
  .d-md-block { display: none; }
  .d-none.d-md-block { display: none; }
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
