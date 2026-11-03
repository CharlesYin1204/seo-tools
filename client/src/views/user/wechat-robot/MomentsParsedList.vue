<template>
  <div class="moments-parsed-list">
    <!-- 未购买功能模块：全屏遮罩 + 居中弹窗 -->
    <teleport to="body">
      <div v-if="featureBlocked" class="fb-mask">
        <div class="fb-modal">
          <div class="fb-icon"><i class="fas fa-lock"></i></div>
          <h3 class="fb-title">功能未开通</h3>
          <p class="fb-desc">您尚未购买「快速内容检索」功能模块，<br>开通后即可使用朋友圈数据解析、智能搜索等全部功能。</p>
          <button class="fb-btn fb-btn-primary" @click="$router.push('/user/membership')">
            <i class="fas fa-crown"></i> 前往购买会员
          </button>
          <button class="fb-btn fb-btn-secondary" @click="$router.push('/user/dashboard')">返回首页</button>
        </div>
      </div>
    </teleport>

    <!-- 页面头部 -->
    <div class="plugin-header">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h2><i class="fas fa-table me-2"></i>朋友圈数据解析列表</h2>
          <p class="mb-0 opacity-75 d-none d-md-block">解析朋友圈中的内容资产数据，提取结构化信息</p>
        </div>
        <div class="d-flex gap-2">
          <el-button @click="refreshList"><i class="fas fa-sync-alt me-1"></i>刷新</el-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid mb-4">
      <div class="stats-card">
        <div class="stats-icon"><i class="fas fa-comments"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }">{{ statsLoading ? '-' : formatNum(stats.total_moments) }}</div>
        <div class="label">朋友圈总数</div>
      </div>
      <div class="stats-card">
        <div class="stats-icon" style="color: #9C27B0"><i class="fas fa-check-circle"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }" style="color: #9C27B0">{{ statsLoading ? '-' : formatNum(stats.parsed_data) }}</div>
        <div class="label">已解析内容资产</div>
      </div>
      <div class="stats-card">
        <div class="stats-icon" style="color: #4CAF50"><i class="fas fa-paper-plane"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }" style="color: #4CAF50">{{ statsLoading ? '-' : formatNum(stats.published) }}</div>
        <div class="label">已发布</div>
      </div>
      <div class="stats-card">
        <div class="stats-icon" style="color: #FF9800"><i class="fas fa-calendar-day"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }" style="color: #FF9800">{{ statsLoading ? '-' : formatNum(stats.today_count) }}</div>
        <div class="label">今日新增</div>
      </div>
    </div>

    <!-- ====== 移动端筛选栏（淘宝风格横向下拉） ====== -->
    <div class="m-filter-bar d-md-none mb-3">
      <div class="m-filter-scroll">
        <!-- 价格：单按钮弹出面板选择起始价和最高价 -->
        <el-popover placement="bottom" :width="240" trigger="click" popper-class="m-price-popover">
          <template #reference>
            <button class="m-filter-btn" :class="{ active: filters.price_min || filters.price_max }">
              <i class="fas fa-yen-sign"></i>
              {{ mobilePriceLabel }}
              <i class="fas fa-caret-down" style="margin-left:2px;font-size:10px"></i>
            </button>
          </template>
          <div class="m-price-panel">
            <div class="m-price-row">
              <span class="m-price-label">最低价</span>
              <el-select v-model="filters.price_min" placeholder="不限" size="small" clearable class="m-price-sel" popper-class="m-ios-select-popper" :teleported="true" @change="applyFilters">
                <el-option v-for="p in priceOptions" :key="'mmin'+p" :label="formatPriceLabel(p)" :value="p" />
              </el-select>
            </div>
            <div class="m-price-row">
              <span class="m-price-label">最高价</span>
              <el-select v-model="filters.price_max" placeholder="不限" size="small" clearable class="m-price-sel" popper-class="m-ios-select-popper" :teleported="true" @change="applyFilters">
                <el-option v-for="p in priceOptions" :key="'mmax'+p" :label="formatPriceLabel(p)" :value="p" />
              </el-select>
            </div>
            <el-button size="small" type="primary" class="m-price-confirm" @click="applyFilters">确定</el-button>
          </div>
        </el-popover>
        <el-select v-model="filters.bedrooms" placeholder="卧室" size="small" clearable multiple collapse-tags :max-collapse-tags="1" class="m-filter-sel" popper-class="m-ios-select-popper" :teleported="true" @change="applyFilters">
          <el-option v-for="n in 5" :key="'mb'+n" :label="`${n}室`" :value="n" />
        </el-select>
        <el-select v-model="filters.district" placeholder="区域(可多选)" size="small" clearable filterable multiple collapse-tags :max-collapse-tags="1" class="m-filter-sel" popper-class="m-ios-select-popper" :teleported="true" @change="applyFilters">
          <el-option v-for="d in filterOpts.districts" :key="'md'+d" :label="d" :value="d" />
        </el-select>
        <!-- 地铁：线路可选，站点可直接搜索 -->
        <el-popover placement="bottom" :width="280" trigger="click" popper-class="m-metro-popover">
          <template #reference>
            <button class="m-filter-btn" :class="{ active: filters.metro_lines.length || filters.metro_stations.length }">
              <i class="fas fa-subway"></i>
              {{ mobileMetroLabel }}
              <i class="fas fa-caret-down" style="margin-left:2px;font-size:10px"></i>
            </button>
          </template>
          <div class="m-metro-panel">
            <div class="m-metro-section">
              <div class="m-metro-section-title">线路 <small>（可选，缩小站点范围）</small></div>
              <div class="m-metro-line-tags">
                <span v-for="line in filterOpts.metroLines" :key="line"
                  class="m-metro-line-tag" :class="{ selected: filters.metro_lines.includes(line) }"
                  :style="filters.metro_lines.includes(line) ? { background: getMetroColor(line), color: '#fff', borderColor: getMetroColor(line) } : {}"
                  @click="toggleMetroLine(line)">
                  {{ line }}
                </span>
              </div>
            </div>
            <div class="m-metro-section">
              <div class="m-metro-section-title">站点 <small>（可多选{{ filters.metro_lines.length ? '，已按线路筛选' : '' }}）</small></div>
              <div class="m-metro-station-tags">
                <span v-for="s in filteredMobileStations" :key="s"
                  class="m-metro-station-tag" :class="{ selected: filters.metro_stations.includes(s) }"
                  @click="toggleMetroStation(s)">
                  {{ s }}
                </span>
              </div>
            </div>
            <el-button size="small" type="primary" class="m-metro-confirm" @click="applyFilters">确定</el-button>
          </div>
        </el-popover>
        <el-checkbox v-model="filters.has_commission" size="small" class="m-filter-commission-check" @change="applyFilters">佣金</el-checkbox>
        <el-select v-model="filters.outdoor_features" placeholder="户外" size="small" clearable multiple collapse-tags :max-collapse-tags="1" class="m-filter-sel" popper-class="m-ios-select-popper" :teleported="true" @change="applyFilters">
          <el-option label="花园" value="花园" /><el-option label="阳台" value="阳台" /><el-option label="露台" value="露台" /><el-option label="院子" value="院子" />
        </el-select>
        <button class="m-filter-more-btn" :class="{ active: moreFilterOpen }" @click="moreFilterOpen = !moreFilterOpen">
          <i class="fas fa-sliders-h"></i> 更多
        </button>
      </div>
      <!-- 展开的更多筛选 -->
      <div v-if="moreFilterOpen" class="m-filter-expand">
        <div class="m-filter-expand-row">
          <el-input v-model="filters.keyword" placeholder="搜索小区/内容/发布人..." size="small" clearable class="m-filter-kw" @keyup.enter="applyFilters" @clear="applyFilters" />
        </div>
        <div class="m-filter-expand-row">
          <el-select v-model="filters.publisher" placeholder="发布人" size="small" clearable filterable class="m-filter-half" popper-class="m-ios-select-popper" :teleported="true" @change="applyFilters">
            <el-option label="全部" value="" />
            <el-option v-for="p in filterOpts.publishers" :key="'mp'+p" :label="p" :value="p" />
          </el-select>
        </div>
        <div class="m-filter-expand-row">
          <div class="quick-time-btns m-quick-time-btns">
            <button
              v-for="t in timeOptions"
              :key="'mobile-time-' + t.days"
              type="button"
              class="quick-time-btn"
              :class="{ active: filters.time_quick === t.days }"
              @click="setQuickTime(t.days)"
            >
              {{ t.label }}
            </button>
          </div>
        </div>
        <div class="m-filter-expand-row m-filter-date-row">
          <el-date-picker
            v-model="filters.publish_time_start"
            type="date"
            placeholder="开始日期"
            size="small"
            value-format="YYYY-MM-DD"
            class="m-filter-half"
            @change="applyFilters"
          />
          <el-date-picker
            v-model="filters.publish_time_end"
            type="date"
            placeholder="结束日期"
            size="small"
            value-format="YYYY-MM-DD"
            class="m-filter-half"
            @change="applyFilters"
          />
        </div>
        <div class="m-filter-expand-row m-filter-checks">
          <el-checkbox v-model="filters.has_elevator" size="small" @change="applyFilters">电梯</el-checkbox>
          <el-checkbox v-model="filters.has_parking" size="small" @change="applyFilters">车位</el-checkbox>
          <el-checkbox v-model="filters.is_duplex" size="small" @change="applyFilters">复式</el-checkbox>
          <el-button type="primary" size="small" @click="applyFilters(); moreFilterOpen = false" style="margin-left: auto"><i class="fas fa-search me-1"></i>筛选</el-button>
          <el-button size="small" @click="resetFilters"><i class="fas fa-redo"></i></el-button>
        </div>
      </div>
    </div>

    <!-- ====== PC端筛选模块（保持不变） ====== -->
    <div class="module-card filter-module mb-4 d-none d-md-block">
      <div class="filter-header">
        <div class="filter-title"><i class="fas fa-filter"></i> 数据筛选</div>
      </div>
      <div class="filter-body">
        <div class="filter-grid filter-grid-5">
          <div class="fg-item">
            <label>关键词搜索</label>
            <el-input v-model="filters.keyword" placeholder="搜索小区、内容、发布人..." size="small" clearable @keyup.enter="applyFilters" @clear="applyFilters" @input="applyFiltersDebounced" />
          </div>
          <div class="fg-item">
            <label>价格范围</label>
            <div class="price-range-wrap">
              <el-select v-model="filters.price_min" placeholder="最低" size="small" clearable filterable allow-create class="price-sel" @change="applyFilters">
                <el-option v-for="p in priceOptions" :key="'min'+p" :label="formatPriceLabel(p)" :value="p" />
              </el-select>
              <span class="range-sep">-</span>
              <el-select v-model="filters.price_max" placeholder="最高" size="small" clearable filterable allow-create class="price-sel" @change="applyFilters">
                <el-option v-for="p in priceOptions" :key="'max'+p" :label="formatPriceLabel(p)" :value="p" />
              </el-select>
            </div>
          </div>
          <div class="fg-item">
            <label>卧室</label>
            <el-select v-model="filters.bedrooms" placeholder="不限" size="small" clearable multiple class="w-100" @change="applyFilters">
              <el-option v-for="n in 5" :key="n" :label="`${n}室`" :value="n" />
            </el-select>
          </div>
          <div class="fg-item">
            <label>区域 <small>(可多选)</small></label>
            <el-select v-model="filters.district" placeholder="全部区域" size="small" clearable filterable multiple collapse-tags :max-collapse-tags="3" class="w-100" @change="applyFilters">
              <el-option v-for="d in filterOpts.districts" :key="d" :label="d" :value="d" />
            </el-select>
          </div>
          <div class="fg-item">
            <label>户外 <small>(可多选)</small></label>
            <el-select v-model="filters.outdoor_features" placeholder="不限" size="small" clearable multiple class="w-100" @change="applyFilters">
              <el-option label="花园" value="花园" />
              <el-option label="阳台" value="阳台" />
              <el-option label="露台" value="露台" />
              <el-option label="院子/庭院" value="院子" />
            </el-select>
          </div>
        </div>
        <div class="filter-grid filter-grid-5">
          <div class="fg-item">
            <label>地铁线路 <small>(可多选)</small></label>
            <el-select v-model="filters.metro_lines" placeholder="选择线路" size="small" multiple clearable filterable collapse-tags :max-collapse-tags="2" collapse-tags-tooltip class="w-100 metro-line-select" @change="onPcMetroLineChange">
              <el-option v-for="m in filterOpts.metroLines" :key="m" :label="m" :value="m">
                <span class="metro-dot" :style="{ background: getMetroColor(m) }"></span>
                <span>{{ m }}</span>
              </el-option>
            </el-select>
          </div>
          <div class="fg-item">
            <label>地铁站点 <small>(可多选{{ filters.metro_lines.length ? '，已按线路筛选' : '' }})</small></label>
            <el-select v-model="filters.metro_stations" placeholder="搜索或选择站点" size="small" multiple clearable filterable collapse-tags :max-collapse-tags="2" collapse-tags-tooltip class="w-100" @change="applyFilters">
              <el-option v-for="s in filteredPcStations" :key="s" :label="s" :value="s" />
            </el-select>
          </div>
          <div class="fg-item">
            <label>发布人</label>
            <el-select v-model="filters.publisher" placeholder="全部发布人" size="small" clearable filterable class="w-100" @change="applyFilters">
              <el-option label="全部发布人" value="" />
              <el-option v-for="p in filterOpts.publishers" :key="p" :label="p" :value="p" />
            </el-select>
          </div>
          <div class="fg-item">
            <label>解析状态</label>
            <el-select v-model="filters.parse_status" placeholder="全部" size="small" clearable class="w-100" @change="applyFilters">
              <el-option label="全部" value="" />
              <el-option label="已解析" value="parsed" />
              <el-option label="未解析" value="unparsed" />
            </el-select>
          </div>
          <div class="fg-item">
            <label>内容类型</label>
            <el-select v-model="filters.content_type" placeholder="全部类型" size="small" clearable class="w-100" @change="applyFilters">
              <el-option label="全部类型" value="" />
              <el-option label="内容资产信息" value="property" />
              <el-option label="生活分享" value="life" />
              <el-option label="广告推广" value="ad" />
              <el-option label="系统消息" value="system" />
              <el-option label="未分类" value="unknown" />
            </el-select>
          </div>
        </div>
        <div class="filter-grid filter-grid-time">
          <div class="fg-item">
            <label>发布时间</label>
            <div class="quick-time-btns">
              <button v-for="t in timeOptions" :key="t.days" type="button" class="quick-time-btn" :class="{ active: filters.time_quick === t.days }" @click="setQuickTime(t.days)">{{ t.label }}</button>
            </div>
          </div>
          <div class="fg-item">
            <label>自定义时间范围</label>
            <div class="price-range-wrap">
              <el-date-picker v-model="filters.publish_time_start" type="date" placeholder="开始" size="small" value-format="YYYY-MM-DD" @change="applyFilters" />
              <span class="range-sep">-</span>
              <el-date-picker v-model="filters.publish_time_end" type="date" placeholder="结束" size="small" value-format="YYYY-MM-DD" @change="applyFilters" />
            </div>
          </div>
          <div class="fg-item fg-item-grow">
            <label>排除关键词 <small>(逗号分隔)</small></label>
            <div class="exclude-kw-wrap">
              <el-input v-model="filters.exclude_keywords" placeholder="合租,宿舍,收房,拿房,招聘" size="small" @change="applyFilters" />
              <el-button size="small" class="kw-reset-btn" @click="filters.exclude_keywords = '合租,宿舍,收房,拿房,招聘'; applyFilters()"><i class="fas fa-undo"></i></el-button>
            </div>
          </div>
        </div>
        <div class="filter-inline-row">
          <div class="filter-inline-left">
            <span class="inline-label">其他条件</span>
            <el-checkbox v-model="filters.has_elevator" size="small" @change="applyFilters">有电梯</el-checkbox>
            <el-checkbox v-model="filters.has_parking" size="small" @change="applyFilters">有车位</el-checkbox>
            <el-checkbox v-model="filters.has_commission" size="small" @change="applyFilters">有佣金</el-checkbox>
            <el-checkbox v-model="filters.is_duplex" size="small" @change="applyFilters">复式</el-checkbox>
            <el-checkbox v-if="isAdminView" v-model="filters.not_in_poi" size="small" @change="applyFilters"><span style="color:#E6A23C">未在POI数据</span></el-checkbox>
          </div>
          <div class="filter-actions">
            <el-button type="primary" size="small" @click="applyFilters"><i class="fas fa-search me-1"></i>筛选</el-button>
            <el-button size="small" @click="resetFilters"><i class="fas fa-redo me-1"></i>重置</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 视图切换标签页 -->
    <div class="view-tabs mb-3">
      <button class="view-tab" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">
        <i class="fas fa-list me-1"></i>列表视图
      </button>
      <button class="view-tab" :class="{ active: viewMode === 'map' }" @click="viewMode = 'map'">
        <i class="fas fa-map-marked-alt me-1"></i>地图视图
        <span class="badge bg-purple ms-1">{{ total }}</span>
      </button>
    </div>

    <!-- ====== 移动端卡片列表 ====== -->
    <div v-if="isMobileView && viewMode === 'list'" class="m-card-list" v-loading="loading">
      <div class="m-list-header">
        <span class="m-list-count">共 <b>{{ total }}</b> 条结果</span>
        <el-select v-model="pageSize" size="small" class="m-list-size" @change="loadData">
          <el-option :value="20" label="20条" /><el-option :value="50" label="50条" /><el-option :value="100" label="100条" />
        </el-select>
      </div>
      <div v-for="row in list" :key="row.id" class="m-property-card" @click="openPropertyDetail(row)">
        <div class="m-card-with-thumb">
          <div v-if="getThumb(row)" class="m-card-thumb">
            <img :src="proxyThumb(getThumb(row))" @error="$event.target.src='/uploads/placeholder.png'" />
          </div>
          <div class="m-card-main">
            <div class="m-card-top">
              <div class="m-card-community">{{ row.community || '未知小区' }}</div>
              <div v-if="row.district" class="m-card-district">{{ row.district }}</div>
            </div>
            <div class="m-card-body">
              <div class="m-card-price-row">
                <span v-if="row.price && row.price.includes('(售)')" class="m-card-price sale">{{ formatSalePrice(row.price) }} <small>售</small></span>
                <span v-else-if="row.price_value && row.price_value > 0" class="m-card-price">¥{{ Number(row.price_value).toLocaleString() }}<small>/月</small></span>
                <span v-else-if="row.price" class="m-card-price">{{ row.price }}</span>
                <span v-else class="m-card-price empty">价格面议</span>
                <span class="m-card-rooms">
                  <template v-if="row.bedrooms">{{ row.bedrooms }}室</template>
                  <template v-if="row.bathrooms">{{ row.bathrooms }}卫</template>
                  <template v-if="row.area_sqm"> · {{ row.area_sqm }}㎡</template>
                </span>
              </div>
              <div class="m-card-tags">
                <span v-if="row.has_elevator" class="m-tag green">电梯</span>
                <span v-if="row.has_parking" class="m-tag blue">车位</span>
                <span v-if="row.has_commission" class="m-tag orange">佣金</span>
                <span v-if="row.is_duplex" class="m-tag purple">复式</span>
                <span v-if="row.outdoor_features && row.outdoor_features !== '0'" class="m-tag teal">{{ typeof row.outdoor_features === 'string' ? row.outdoor_features.split(/[,，、]/)[0] : '' }}</span>
              </div>
              <div v-if="row.metro_lines || row.metro_stations" class="m-card-metro">
                <i class="fas fa-subway"></i>
                <template v-if="row.metro_lines">
                  <span v-for="line in parseMetroLines(row.metro_lines)" :key="line" class="m-metro-line-tag" :style="{ background: getMetroColor(line), color: '#fff' }">{{ line }}</span>
                </template>
                <span v-if="row.metro_stations" class="m-card-station">{{ row.metro_stations }}</span>
              </div>
              <div class="m-card-footer">
                <span class="m-card-publisher"><i class="fas fa-user"></i> {{ row.publisher_name || row.owner_nickname || '-' }}</span>
                <span class="m-card-time">{{ formatMobileTime(row.moment_publish_time || row.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="!loading && list.length === 0" class="m-empty-state">
        <i class="fas fa-search"></i>
        <p>暂无符合条件的内容资产</p>
      </div>
      <div class="m-pagination">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" small @current-change="loadData" />
      </div>
    </div>

    <!-- ====== PC端列表视图 ====== -->
    <div v-show="viewMode === 'list' && !isMobileView" class="module-card">
      <div class="list-header-bar">
        <div class="module-title mb-0">
          <i class="fas fa-list"></i>
          <span>朋友圈数据列表</span>
          <span class="badge bg-success ms-2" style="font-size: 12px">筛选结果 {{ total }} 条</span>
          <small v-if="!isAdminView" class="text-muted ms-2" style="font-weight: normal">(数据由管理员解析同步)</small>
          <small v-else class="text-muted ms-2" style="font-weight: normal">(数据自动AI解析)</small>
        </div>
        <div v-if="isAdminView" class="list-header-actions">
          <span v-if="selectedRows.length" class="text-muted" style="font-size: 12px; white-space: nowrap">已选 {{ selectedRows.length }} 条</span>
          <el-button v-if="selectedRows.length" size="small" type="success" :loading="publishing" @click="batchPublishToLibrary">
            <i class="fas fa-upload me-1"></i>发布到内容资产库
          </el-button>
          <el-button v-if="selectedRows.length && selectedRows.some(r => !r.is_in_poi)" size="small" type="warning" :loading="batchPoiImporting" @click="handleBatchImportToPOI">
            <i class="fas fa-database me-1"></i>导入POI ({{ selectedRows.filter(r => !r.is_in_poi && r.community).length }})
          </el-button>
          <el-divider v-if="selectedRows.length" direction="vertical" />
          <label class="text-muted" style="font-size: 12px; white-space: nowrap">解析范围:</label>
          <el-select v-model="parseDays" size="small" style="width: 100px">
            <el-option label="近1天" :value="1" />
            <el-option label="近3天" :value="3" />
            <el-option label="近7天" :value="7" />
            <el-option label="近15天" :value="15" />
            <el-option label="近15天" :value="15" />
            <el-option label="全部数据" value="all" />
          </el-select>
          <el-button size="small" :type="isAutoParsing ? 'danger' : 'primary'" :loading="parsing" @click="toggleParse">
            <i :class="isAutoParsing ? 'fas fa-stop' : 'fas fa-play'" class="me-1"></i>
            {{ isAutoParsing ? '停止解析' : '开始解析' }}
          </el-button>
          <el-button size="small" @click="showAsyncTask = true"><i class="fas fa-tasks me-1"></i>后台任务</el-button>
          <el-divider direction="vertical" />
          <el-button size="small" type="warning" @click="openBatchCalibrate"><i class="fas fa-check-double me-1"></i>批量校对</el-button>
          <el-select v-model="reparseBatchSize" size="small" style="width: 90px" title="每批补全条数">
            <el-option label="50条/批" :value="50" />
            <el-option label="100条/批" :value="100" />
            <el-option label="200条/批" :value="200" />
          </el-select>
          <el-button
            size="small"
            :type="isAutoReparseIncomplete ? 'danger' : 'success'"
            :loading="reparseIncompleteLoading"
            @click="toggleReparseIncomplete"
          >
            <i :class="isAutoReparseIncomplete ? 'fas fa-stop' : 'fas fa-magic'" class="me-1"></i>
            {{ isAutoReparseIncomplete ? `停止补全 (剩余${incompleteCount})` : `一键补全未完整 (${incompleteCount})` }}
          </el-button>
        </div>
      </div>

      <!-- 数据表格（带横向滚动条） -->
      <div class="table-scroll-wrap">
      <el-table v-loading="loading" :data="list" stripe border size="small" :max-height="tableMaxHeight" @selection-change="onSelectionChange" style="width: 100%">
        <el-table-column type="selection" width="40" />
        <el-table-column v-if="isAdminView" label="操作" width="72" fixed="left" class-name="col-op" align="center">
          <template #default="{ row }">
            <el-dropdown trigger="click" placement="bottom-start" @command="(cmd) => handleOpDropdown(cmd, row)">
              <el-button size="small" type="primary" plain class="op-dropdown-btn">
                操作<i class="fas fa-chevron-down ms-1" style="font-size:10px"></i>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu class="op-dropdown-menu">
                  <el-dropdown-item command="detail">
                    <i class="fas fa-eye me-2" style="color:#909399"></i>详情
                  </el-dropdown-item>
                  <el-dropdown-item command="reparse" :disabled="row._reparsing">
                    <i class="fas fa-sync-alt me-2" style="color:#409EFF"></i>{{ row._reparsing ? '解析中...' : '解析' }}
                  </el-dropdown-item>
                  <el-dropdown-item v-if="row.community" command="calibrate" :disabled="row._calibrating">
                    <i class="fas fa-check-double me-2" style="color:#E6A23C"></i>{{ row._calibrating ? '校对中...' : '校对' }}
                  </el-dropdown-item>
                  <el-dropdown-item v-if="!row.is_listed" command="publish" :disabled="row._publishing">
                    <i class="fas fa-upload me-2" style="color:#67C23A"></i>{{ row._publishing ? '发布中...' : '发布' }}
                  </el-dropdown-item>
                  <el-dropdown-item v-if="row.is_listed" disabled>
                    <i class="fas fa-check me-2" style="color:#67C23A"></i>已上架
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
        <el-table-column label="媒体" width="80" align="center">
          <template #default="{ row }">
            <div class="media-preview-cell" @click="openPropertyDetail(row)">
              <div v-if="getThumb(row)" class="parsed-thumb-wrap">
                <img :src="proxyThumb(getThumb(row))" class="parsed-thumb" @error="$event.target.src='/uploads/placeholder.png'" />
                <span v-if="getMediaCount(row) > 1" class="parsed-thumb-count">{{ getMediaCount(row) }}</span>
              </div>
              <div v-else class="parsed-thumb-empty"><i class="fas fa-image"></i></div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="朋友圈文案" min-width="220">
          <template #default="{ row }">
            <div class="content-cell">
              <span v-if="row.favorites_content" class="fav-note-badge">收藏笔记</span>
              <div class="content-text" :class="{ 'content-collapsed': !row._expanded }">{{ row.original_content || row.favorites_content || row.moment_content || '-' }}</div>
              <span v-if="needTruncate(row.original_content || row.favorites_content || row.moment_content || '')" class="content-toggle" @click="row._expanded = !row._expanded">{{ row._expanded ? '收起' : '展开' }}</span>
            </div>
          </template>
        </el-table-column>
        <!-- 小区（管理员可编辑：输入+POI下拉） -->
        <el-table-column label="小区" width="150">
          <template #default="{ row }">
            <template v-if="isAdminView && editingCell.id === row.id && editingCell.field === 'community'">
              <div class="community-edit-wrap">
                <el-input
                  ref="communityInputRef"
                  v-model="editingCell.value"
                  size="small"
                  placeholder="输入小区名"
                  style="width:100%"
                  @keyup.enter="saveInlineEdit(row, 'community')"
                  @blur="saveInlineEdit(row, 'community')"
                  autofocus
                />
                <div v-if="poiSearchResults.length > 0" class="poi-suggest-list">
                  <div v-for="p in poiSearchResults" :key="p.id" class="poi-suggest-item" @mousedown.prevent="selectPOISuggestion(row, p)">
                    <span>{{ p.community_name }}</span><small style="color:#999;margin-left:4px">{{ p.district }}</small>
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="community-cell" :class="communityDisplayClass(row)">
                <span class="editable-cell" :class="{ 'admin-editable': isAdminView }" @click="isAdminView && startInlineEdit(row, 'community', row.community)">{{ row.community || '-' }}</span>
                <template v-if="isAdminView && row.community && !row.is_in_poi">
                  <el-tooltip :content="communityTypeLabel(row)" placement="top">
                    <i class="fas" :class="communityTypeIcon(row)"></i>
                  </el-tooltip>
                  <el-tooltip v-if="row.community_type === 1 || row.community_type === 0" content="导入到POI数据库" placement="top">
                    <el-button size="small" type="warning" plain class="poi-import-btn" :loading="row._poiImporting" @click.stop="handleImportSingleToPOI(row)">
                      <i class="fas fa-plus-circle"></i>
                    </el-button>
                  </el-tooltip>
                </template>
              </div>
            </template>
          </template>
        </el-table-column>
        <!-- 价格（管理员可编辑，可排序） -->
        <el-table-column width="110">
          <template #header>
            <div class="sortable-header" @click="togglePriceSort">
              <span>价格</span>
              <span class="sort-icons">
                <i class="fas fa-sort-up" :class="{ active: filters.sort_field === 'price_value' && filters.sort_order === 'asc' }"></i>
                <i class="fas fa-sort-down" :class="{ active: filters.sort_field === 'price_value' && filters.sort_order === 'desc' }"></i>
              </span>
            </div>
          </template>
          <template #default="{ row }">
            <template v-if="isAdminView && editingCell.id === row.id && editingCell.field === 'price_value'">
              <el-input v-model="editingCell.value" size="small" type="number" placeholder="月租价格" @blur="saveInlineEdit(row, 'price_value')" @keyup.enter="saveInlineEdit(row, 'price_value')" autofocus style="width:90px" />
            </template>
            <template v-else>
              <template v-if="row.price && row.price.includes('(售)')">
                <div class="price-sale-wrap" @click="isAdminView && startInlineEdit(row, 'price_value', row.price_value)">
                  <el-tag size="small" type="danger" effect="dark" class="sale-tag">售</el-tag>
                  <span class="cell-price-sale-value">{{ formatSalePrice(row.price) }}</span>
                </div>
              </template>
              <template v-else-if="row.price_value && row.price_value > 0">
                <span class="cell-price editable-cell" :class="{ 'admin-editable': isAdminView }" @click="isAdminView && startInlineEdit(row, 'price_value', row.price_value)">¥{{ Number(row.price_value).toLocaleString() }}<span class="cell-price-unit">/月</span></span>
              </template>
              <template v-else-if="row.price">
                <span class="cell-price editable-cell" :class="{ 'admin-editable': isAdminView }" @click="isAdminView && startInlineEdit(row, 'price_value', row.price_value)">{{ row.price }}</span>
              </template>
              <span v-else class="cell-empty editable-cell" :class="{ 'admin-editable': isAdminView }" @click="isAdminView && startInlineEdit(row, 'price_value', '')">-</span>
            </template>
          </template>
        </el-table-column>
        <!-- 卧室（管理员可编辑） -->
        <el-table-column label="卧" width="50" align="center">
          <template #default="{ row }">
            <template v-if="isAdminView && editingCell.id === row.id && editingCell.field === 'bedrooms'">
              <el-select v-model="editingCell.value" size="small" style="width:45px" @change="saveInlineEdit(row, 'bedrooms')">
                <el-option v-for="n in 9" :key="n" :label="String(n)" :value="n" />
              </el-select>
            </template>
            <span v-else class="cell-num editable-cell" :class="{ 'admin-editable': isAdminView }" @click="isAdminView && startInlineEdit(row, 'bedrooms', row.bedrooms || 1)">{{ row.bedrooms || '-' }}</span>
          </template>
        </el-table-column>
        <!-- 卫生间（管理员可编辑） -->
        <el-table-column label="卫" width="50" align="center">
          <template #default="{ row }">
            <template v-if="isAdminView && editingCell.id === row.id && editingCell.field === 'bathrooms'">
              <el-select v-model="editingCell.value" size="small" style="width:45px" @change="saveInlineEdit(row, 'bathrooms')">
                <el-option v-for="n in 9" :key="n" :label="String(n)" :value="n" />
              </el-select>
            </template>
            <span v-else class="cell-num editable-cell" :class="{ 'admin-editable': isAdminView }" @click="isAdminView && startInlineEdit(row, 'bathrooms', row.bathrooms || 1)">{{ row.bathrooms || '-' }}</span>
          </template>
        </el-table-column>
        <!-- 佣金（管理员可切换） -->
        <el-table-column label="佣金" width="42" align="center">
          <template #default="{ row }">
            <span v-if="isAdminView" class="editable-cell admin-editable" @click="toggleBoolField(row, 'has_commission')">
              <span v-if="row.has_commission" class="badge-orange">有</span>
              <span v-else class="badge-gray">无</span>
            </span>
            <template v-else>
              <span v-if="row.has_commission" class="badge-orange">有</span>
              <span v-else class="badge-gray">无</span>
            </template>
          </template>
        </el-table-column>
        <!-- 区域（管理员下拉选择） -->
        <el-table-column label="区域" width="80">
          <template #default="{ row }">
            <template v-if="isAdminView && editingCell.id === row.id && editingCell.field === 'district'">
              <el-select v-model="editingCell.value" size="small" filterable style="width:75px" @change="saveInlineEdit(row, 'district')">
                <el-option v-for="d in filterOpts.districts" :key="d" :label="d" :value="d" />
              </el-select>
            </template>
            <span v-else class="editable-cell" :class="{ 'admin-editable': isAdminView }" @click="isAdminView && startInlineEdit(row, 'district', row.district)" show-overflow-tooltip>{{ row.district || '-' }}</span>
          </template>
        </el-table-column>
        <!-- 户外（管理员可编辑） -->
        <el-table-column label="户外" width="100" align="center">
          <template #default="{ row }">
            <template v-if="isAdminView && editingCell.id === row.id && editingCell.field === 'outdoor_features'">
              <el-select v-model="editingCell.value" size="small" multiple style="width:95px" @visible-change="v => { if(!v) saveInlineEdit(row, 'outdoor_features') }">
                <el-option label="花园" value="花园" /><el-option label="阳台" value="阳台" /><el-option label="露台" value="露台" /><el-option label="院子" value="院子" />
              </el-select>
            </template>
            <template v-else>
              <div v-if="row.outdoor_features && row.outdoor_features !== '0' && row.outdoor_features !== 'null'" class="outdoor-tags editable-cell" :class="{ 'admin-editable': isAdminView }" @click="isAdminView && startInlineEdit(row, 'outdoor_features', splitOutdoor(row.outdoor_features))">
                <span v-for="feat in splitOutdoor(row.outdoor_features)" :key="feat" class="badge-outdoor" :class="outdoorClass(feat)">{{ feat }}</span>
              </div>
              <span v-else class="cell-empty editable-cell" :class="{ 'admin-editable': isAdminView }" @click="isAdminView && startInlineEdit(row, 'outdoor_features', [])">-</span>
            </template>
          </template>
        </el-table-column>
        <!-- 发布人（管理员可编辑） -->
        <el-table-column label="发布人" width="80" show-overflow-tooltip>
          <template #default="{ row }">
            <template v-if="isAdminView && editingCell.id === row.id && editingCell.field === 'publisher_name'">
              <el-input v-model="editingCell.value" size="small" @blur="saveInlineEdit(row, 'publisher_name')" @keyup.enter="saveInlineEdit(row, 'publisher_name')" autofocus style="width:75px" />
            </template>
            <span v-else class="editable-cell" :class="{ 'admin-editable': isAdminView }" @click="isAdminView && startInlineEdit(row, 'publisher_name', row.publisher_name || row.owner_nickname)">{{ row.publisher_name || row.owner_nickname || '-' }}</span>
          </template>
        </el-table-column>
        <!-- 联系方式（管理员可编辑） -->
        <el-table-column label="联系方式" width="110" show-overflow-tooltip>
          <template #default="{ row }">
            <template v-if="isAdminView && editingCell.id === row.id && editingCell.field === 'contact_info'">
              <el-input v-model="editingCell.value" size="small" @blur="saveInlineEdit(row, 'contact_info')" @keyup.enter="saveInlineEdit(row, 'contact_info')" autofocus style="width:100px" />
            </template>
            <span v-else class="editable-cell" :class="{ 'admin-editable': isAdminView }" @click="isAdminView && startInlineEdit(row, 'contact_info', row.contact_info)">{{ row.contact_info || '-' }}</span>
          </template>
        </el-table-column>
        <!-- 电梯（管理员可切换） -->
        <el-table-column label="电梯" width="42" align="center">
          <template #default="{ row }">
            <span v-if="isAdminView" class="editable-cell admin-editable" @click="toggleBoolField(row, 'has_elevator')">
              <span v-if="row.has_elevator" class="badge-green">有</span>
              <span v-else class="badge-gray">无</span>
            </span>
            <template v-else>
              <span v-if="row.has_elevator" class="badge-green">有</span>
              <span v-else class="badge-gray">无</span>
            </template>
          </template>
        </el-table-column>
        <!-- 地铁线路（管理员下拉选择） -->
        <el-table-column label="地铁线路" width="110">
          <template #default="{ row }">
            <template v-if="isAdminView && editingCell.id === row.id && editingCell.field === 'metro_lines'">
              <el-select v-model="editingCell.value" size="small" multiple filterable collapse-tags :max-collapse-tags="1" style="width:105px" @visible-change="v => { if(!v) saveInlineEdit(row, 'metro_lines') }">
                <el-option v-for="m in filterOpts.metroLines" :key="m" :label="m" :value="m">
                  <span class="metro-dot" :style="{ background: getMetroColor(m) }"></span><span>{{ m }}</span>
                </el-option>
              </el-select>
            </template>
            <template v-else>
              <div v-if="row.metro_lines || row.poi_metro_line" class="metro-tags editable-cell" :class="{ 'admin-editable': isAdminView }" @click="isAdminView && startInlineEdit(row, 'metro_lines', parseMetroLines(row.metro_lines || row.poi_metro_line))">
                <span v-for="line in parseMetroLines(row.metro_lines || row.poi_metro_line)" :key="line" class="metro-tag" :style="{ background: getMetroColor(line), color: '#fff' }">{{ line }}</span>
              </div>
              <span v-else class="cell-empty editable-cell" :class="{ 'admin-editable': isAdminView }" @click="isAdminView && startInlineEdit(row, 'metro_lines', [])">-</span>
            </template>
          </template>
        </el-table-column>
        <!-- 地铁站（管理员下拉选择） -->
        <el-table-column label="地铁站" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <template v-if="isAdminView && editingCell.id === row.id && editingCell.field === 'metro_stations'">
              <el-select v-model="editingCell.value" size="small" filterable allow-create default-first-option style="width:115px" @change="saveInlineEdit(row, 'metro_stations')">
                <el-option v-for="s in editMetroStationOptions" :key="s" :label="s" :value="s" />
              </el-select>
            </template>
            <template v-else>
              <div v-if="row.metro_stations || row.poi_metro_station" class="metro-station-cell editable-cell" :class="{ 'admin-editable': isAdminView }" @click="isAdminView && startInlineEdit(row, 'metro_stations', row.metro_stations || row.poi_metro_station)">
                <span class="cell-station">{{ row.metro_stations || row.poi_metro_station }}</span>
                <small v-if="getMetroDistance(row)" class="metro-distance">{{ getMetroDistance(row) }}</small>
              </div>
              <span v-else class="cell-empty editable-cell" :class="{ 'admin-editable': isAdminView }" @click="isAdminView && startInlineEdit(row, 'metro_stations', '')">-</span>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="发布时间" width="130">
          <template #default="{ row }">{{ row.moment_publish_time || row.created_at || '-' }}</template>
        </el-table-column>
        <!-- 车位（管理员可切换） -->
        <el-table-column label="车位" width="42" align="center">
          <template #default="{ row }">
            <span v-if="isAdminView" class="editable-cell admin-editable" @click="toggleBoolField(row, 'has_parking')">
              <span v-if="row.has_parking" class="badge-green">有</span>
              <span v-else class="badge-gray">无</span>
            </span>
            <template v-else>
              <span v-if="row.has_parking" class="badge-green">有</span>
              <span v-else class="badge-gray">无</span>
            </template>
          </template>
        </el-table-column>
        <!-- 复式（管理员可切换） -->
        <el-table-column label="复式" width="50" align="center">
          <template #default="{ row }">
            <span v-if="isAdminView" class="editable-cell admin-editable" @click="toggleBoolField(row, 'is_duplex')">
              <span v-if="row.is_duplex" class="badge-yes">是</span>
              <span v-else class="badge-gray">否</span>
            </span>
            <template v-else>
              <span v-if="row.is_duplex" class="badge-yes">是</span>
              <span v-else class="cell-empty">-</span>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="50" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.price && row.price.includes('(售)')" size="small" type="danger" effect="dark">售</el-tag>
            <el-tag v-else-if="row.price_value && row.price_value > 0" size="small" type="success" effect="plain">租</el-tag>
            <span v-else-if="row.poi_property_type" :class="'ptype-' + row.poi_property_type">{{ row.poi_property_type }}</span>
            <span v-else class="cell-empty">-</span>
          </template>
        </el-table-column>
      </el-table>
      </div><!-- /table-scroll-wrap -->

      <!-- 分页 -->
      <div class="pagination-bar mt-3" style="overflow-x: auto; padding-bottom: 4px">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100, 200]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadData"
          @current-change="loadData"
        />
      </div>
    </div>

    <!-- 地图视图 -->
    <div v-show="viewMode === 'map'" class="map-view-card" :class="{ 'map-view-card--mobile': isMobileView }">
      <!-- PC端：链家风格左右分栏 -->
      <div v-if="!isMobileView" class="map-split-layout">
        <!-- 左侧面板：筛选 + 内容资产列表 -->
        <div class="map-left-panel" v-show="mapPanelExpanded">
          <div class="map-left-header">
            <span class="map-left-title"><i class="fas fa-map-marked-alt"></i> 内容资产地图</span>
            <div class="map-left-actions">
              <el-button size="small" circle @click="mapPanelExpanded = false" title="收起列表"><i class="fas fa-angle-double-left"></i></el-button>
              <el-button size="small" circle @click="loadMapData" :loading="mapLoading" title="刷新"><i class="fas fa-sync-alt"></i></el-button>
            </div>
          </div>
          <div class="map-left-stats">
            <template v-if="mapSelectedCommunity">
              <span class="map-sel-back" @click="clearMapSelection"><i class="fas fa-arrow-left"></i> 返回全部</span>
              <span class="map-sel-label">📍 {{ mapSelectedCommunity.community }} · {{ mapFlatList.length }} 套内容资产</span>
            </template>
            <template v-else>
              共 <b>{{ mapStats.properties }}</b> 套（<b>{{ mapStats.communities }}</b> 个小区）
              <span v-if="mapStats.noCoords > 0" class="text-warning"> · {{ mapStats.noCoords }} 条缺位置</span>
            </template>
          </div>
          <div class="map-left-list" ref="mapLeftListRef">
            <div
              v-for="item in mapFlatList"
              :key="item._uid"
              class="map-lp-card"
              :class="{ active: mapFocusId === item._uid }"
              @click="onMapListCardClick(item)"
              @mouseenter="mapFocusId = item._uid"
              @mouseleave="mapFocusId = null"
            >
              <div class="map-lp-top">
                <span class="map-lp-publisher">{{ item.publisher || '未知' }}</span>
                <span class="map-lp-time">{{ formatShortTime(item.publish_time) }}</span>
              </div>
              <div class="map-lp-tag">
                {{ item._district }} · {{ item._community }}
                <template v-if="item.bedrooms"> · {{ item.bedrooms }}室{{ item.bathrooms ? item.bathrooms + '卫' : '' }}</template>
                <template v-if="item.price"> · {{ formatPanelPrice(item.price) }}</template>
              </div>
              <div class="map-lp-meta">
                <span v-if="item.area_sqm" class="map-lp-area">{{ item.area_sqm }}m²</span>
                <span v-if="item._metro" class="map-lp-metro"><i class="fas fa-subway"></i> {{ item._metro }}</span>
              </div>
              <div class="map-lp-content" v-if="item.content">{{ item.content }}</div>
            </div>
            <div v-if="mapFlatList.length === 0 && !mapLoading" class="map-lp-empty">
              <i class="fas fa-inbox"></i>
              <p>暂无带坐标的内容资产</p>
            </div>
          </div>
          <div class="map-left-legend">
            <span class="legend-item"><span class="legend-dot" style="background:#409EFF"></span>公寓</span>
            <span class="legend-item"><span class="legend-dot" style="background:#E6A23C"></span>别墅</span>
            <span class="legend-item"><span class="legend-dot" style="background:#67C23A"></span>住宅</span>
          </div>
        </div>
        <!-- 右侧地图 -->
        <div class="map-right-area">
          <!-- 收起时：展开按钮浮在地图左上角 -->
          <div v-if="!mapPanelExpanded" class="map-expand-btn" @click="mapPanelExpanded = true" title="展开列表">
            <i class="fas fa-angle-double-right"></i> 内容资产列表
          </div>
          <div v-loading="mapLoading" class="map-container" ref="mapContainerRef">
            <div v-if="!mapLoading && mapStats.properties === 0" class="map-placeholder">
              <i class="fas fa-map-marked-alt"></i>
              <p v-if="mapStats.noCoords > 0">当前筛选条件下有 {{ mapStats.noCoords }} 条内容资产数据，但均无经纬度坐标</p>
              <p v-else>暂无符合筛选条件的内容资产数据</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 移动端：全屏地图 + 底部弹出面板 -->
      <template v-if="isMobileView">
        <div v-loading="mapLoading" class="map-container" ref="mapContainerRef">
          <div v-if="!mapLoading && mapStats.properties === 0" class="map-placeholder">
            <i class="fas fa-map-marked-alt"></i>
            <p>暂无带坐标的内容资产数据</p>
          </div>
        </div>
        <div ref="mPanelRef" class="m-map-bottom-panel" :class="{ expanded: mobileMapPanel.expanded, collapsed: !mobileMapPanel.expanded }">
          <div class="m-panel-handle" @click="toggleMobileMapPanel" @touchstart.passive="onPanelTouchStart" @touchmove.passive="onPanelTouchMove" @touchend.passive="onPanelTouchEnd">
            <div class="m-panel-bar"></div>
            <span class="m-panel-summary">
              <template v-if="mobileMapPanel.data">
                📍 此位置共 {{ mobileMapPanel.data.listings.length }} 套内容资产
              </template>
              <template v-else>
                {{ mapStats.properties }} 套内容资产 · {{ mapStats.communities }} 个小区
              </template>
            </span>
          </div>
          <div class="m-panel-body" v-if="mobileMapPanel.expanded && mobileMapPanel.data">
            <div class="m-panel-close" @click.stop="closeMobileMapPanel"><i class="fas fa-times"></i></div>
            <div class="m-panel-listings">
              <div v-for="(listing, idx) in mobileMapPanel.data.listings" :key="idx" class="m-panel-listing-card" @click="openPropertyDetailFromMap(listing)">
                <div class="m-panel-card-top">
                  <span class="m-panel-publisher">{{ listing.publisher || '未知发布人' }}</span>
                  <span class="m-panel-time" v-if="listing.publish_time">{{ formatShortTime(listing.publish_time) }}</span>
                </div>
                <div class="m-panel-tag-bar">
                  {{ mobileMapPanel.data.district }} · {{ mobileMapPanel.data.community }}
                  <template v-if="listing.bedrooms"> · {{ listing.bedrooms }}室{{ listing.bathrooms ? listing.bathrooms + '卫' : '' }}</template>
                  <template v-if="listing.price"> · {{ formatPanelPrice(listing.price) }}</template>
                </div>
                <div class="m-panel-card-meta">
                  <span v-if="listing.area_sqm" class="m-panel-area">{{ listing.area_sqm }}m²</span>
                  <span v-if="mobileMapPanel.data.metro_station" class="m-panel-metro">
                    <i class="fas fa-subway"></i> {{ mobileMapPanel.data.metro_station }}
                    <template v-if="mobileMapPanel.data.metro_distance"> {{ mobileMapPanel.data.metro_distance }}m</template>
                  </span>
                </div>
                <div class="m-panel-content" v-if="listing.content">{{ listing.content }}</div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 批量校对弹窗 - 仅管理员可见 -->
    <el-dialog v-if="isAdminView" v-model="showBatchCalibrate" title="批量校对小区信息" width="560px">
      <div v-if="calibrateStats" class="calibrate-stats-grid">
        <div class="calibrate-stat-item">
          <div class="calibrate-stat-num" style="color: #E6A23C">{{ calibrateStats.missing_metro }}</div>
          <div class="calibrate-stat-label">缺地铁信息</div>
        </div>
        <div class="calibrate-stat-item">
          <div class="calibrate-stat-num" style="color: #F56C6C">{{ calibrateStats.missing_coords }}</div>
          <div class="calibrate-stat-label">缺经纬度</div>
        </div>
        <div class="calibrate-stat-item">
          <div class="calibrate-stat-num" style="color: #909399">{{ calibrateStats.district_mismatch }}</div>
          <div class="calibrate-stat-label">区域不一致</div>
        </div>
        <div class="calibrate-stat-item">
          <div class="calibrate-stat-num" style="color: #409EFF; font-weight: 700">{{ calibrateStats.total_calibratable }}</div>
          <div class="calibrate-stat-label">合计可校对</div>
        </div>
      </div>
      <el-form label-width="100px" class="mt-3">
        <el-form-item label="校对模式">
          <el-select v-model="calibrateMode" style="width: 100%">
            <el-option label="全部（缺少任意信息）" value="all" />
            <el-option label="仅缺地铁信息" value="missing_metro" />
            <el-option label="仅缺经纬度" value="missing_coords" />
            <el-option label="仅区域不一致" value="district_mismatch" />
          </el-select>
        </el-form-item>
        <el-form-item label="指定区域">
          <el-select v-model="calibrateDistrict" placeholder="全部区域" clearable filterable style="width: 100%">
            <el-option label="全部区域" value="" />
            <el-option v-for="d in filterOpts.districts" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="处理数量">
          <el-input-number v-model="calibrateLimit" :min="50" :max="5000" :step="100" />
          <span class="text-muted ms-2" style="font-size: 12px">每次最多处理条数</span>
        </el-form-item>
      </el-form>
      <div v-if="calibrateResult" class="calibrate-result mt-3">
        <el-alert :title="calibrateResult.message" :type="calibrateResult.updated > 0 ? 'success' : 'info'" show-icon :closable="false" />
      </div>
      <template #footer>
        <el-button @click="showBatchCalibrate = false">关闭</el-button>
        <el-button type="warning" :loading="calibrating" @click="executeBatchCalibrate">
          <i class="fas fa-check-double me-1"></i>{{ calibrating ? '校对中...' : '开始校对' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 内容资产详情弹窗（含地图） -->
    <el-dialog v-model="showPropertyDetail" :title="detailRow?.community ? detailRow.community + ' - 内容资产详情' : '内容资产详情'" :width="isMobileView ? '100%' : '800px'" :top="isMobileView ? '0' : '3vh'" :fullscreen="isMobileView" destroy-on-close class="detail-dialog-responsive">
      <div v-if="detailRow" class="property-detail-dialog">
        <!-- 移动端头部价格摘要卡片 -->
        <div class="m-detail-hero d-md-none">
          <div class="m-detail-hero-price">
            {{ detailRow.price || (detailRow.price_value ? '¥' + Number(detailRow.price_value).toLocaleString() : '价格面议') }}
            <small v-if="detailRow.price_value">/月</small>
          </div>
          <div class="m-detail-hero-info">
            <span v-if="detailRow.bedrooms">{{ detailRow.bedrooms }}室</span>
            <span v-if="detailRow.bathrooms">{{ detailRow.bathrooms }}卫</span>
            <span v-if="detailRow.area_sqm">{{ detailRow.area_sqm }}㎡</span>
            <span v-if="detailRow.district" class="m-detail-district-tag">{{ detailRow.district }}</span>
          </div>
        </div>

        <div class="detail-info-grid">
          <div class="detail-info-item"><span class="detail-label">小区</span><span class="detail-value">{{ detailRow.community || '-' }}</span></div>
          <div class="detail-info-item d-none d-md-block"><span class="detail-label">价格</span><span class="detail-value price-text">{{ detailRow.price || (detailRow.price_value ? '¥' + Number(detailRow.price_value).toLocaleString() : '-') }}</span></div>
          <div class="detail-info-item d-none d-md-block"><span class="detail-label">户型</span><span class="detail-value">{{ detailRow.bedrooms ? detailRow.bedrooms + '室' : '-' }}{{ detailRow.bathrooms ? detailRow.bathrooms + '卫' : '' }}</span></div>
          <div class="detail-info-item d-none d-md-block"><span class="detail-label">区域</span><span class="detail-value">{{ detailRow.district || '-' }}</span></div>
          <div class="detail-info-item"><span class="detail-label">地铁</span><span class="detail-value">{{ detailRow.metro_lines || '-' }} {{ detailRow.metro_stations || '' }}</span></div>
          <div class="detail-info-item"><span class="detail-label">发布人</span><span class="detail-value">{{ detailRow.publisher_name || detailRow.owner_nickname || '-' }}</span></div>
          <div class="detail-info-item"><span class="detail-label">联系方式</span><span class="detail-value">{{ detailRow.contact_info || '-' }}</span></div>
          <div class="detail-info-item d-none d-md-block"><span class="detail-label">面积</span><span class="detail-value">{{ detailRow.area_sqm ? detailRow.area_sqm + '㎡' : '-' }}</span></div>
        </div>
        <div v-if="getDetailMediaList(detailRow).length" class="detail-media-section">
          <div class="detail-section-title"><i class="fas fa-images me-1"></i>内容资产图片 ({{ getDetailMediaList(detailRow).length }})</div>
          <div class="detail-media-grid">
            <div v-for="(url, idx) in getDetailMediaList(detailRow)" :key="idx" class="detail-media-item" @click="previewDetailImage(url)">
              <img :src="proxyThumb(url)" @error="$event.target.style.display='none'" />
            </div>
          </div>
        </div>
        <div v-if="detailRow.original_content || detailRow.favorites_content || detailRow.moment_content" class="detail-content-section">
          <div class="detail-section-title"><i class="fas fa-file-alt me-1"></i>朋友圈原文 <span v-if="detailRow.favorites_content" class="fav-note-badge">收藏笔记</span></div>
          <div class="detail-original-text">{{ detailRow.original_content || detailRow.favorites_content || detailRow.moment_content }}</div>
        </div>
        <div v-if="detailRow.latitude && detailRow.longitude" class="detail-map-section">
          <div class="detail-section-title"><i class="fas fa-map-marker-alt me-1"></i>内容资产位置</div>
          <div ref="detailMapRef" class="detail-map-container"></div>
          <div class="detail-map-coords">
            <span><i class="fas fa-crosshairs me-1"></i>经度: {{ detailRow.longitude }}</span>
            <span>纬度: {{ detailRow.latitude }}</span>
          </div>
        </div>
        <div v-else class="detail-map-section">
          <div class="detail-section-title"><i class="fas fa-map-marker-alt me-1"></i>内容资产位置</div>
          <div class="detail-no-map"><i class="fas fa-map-marked-alt"></i><p>暂无经纬度坐标信息</p></div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showPropertyDetail = false">关闭</el-button>
        <el-button v-if="isAdminView && detailRow && !detailRow.is_listed" type="success" :loading="detailRow._publishing" @click="publishSingle(detailRow); showPropertyDetail = false">
          <i class="fas fa-upload me-1"></i>发布到内容资产库
        </el-button>
      </template>
    </el-dialog>

    <!-- 后台任务弹窗 - 仅管理员可见 -->
    <el-dialog v-if="isAdminView" v-model="showAsyncTask" title="后台解析任务" width="500px">
      <el-form label-width="100px">
        <el-form-item label="解析范围">
          <el-select v-model="asyncTaskDays" style="width: 100%">
            <el-option label="近1天" :value="1" />
            <el-option label="近3天" :value="3" />
            <el-option label="近7天" :value="7" />
            <el-option label="近15天" :value="15" />
            <el-option label="全部数据" value="all" />
          </el-select>
        </el-form-item>
        <el-form-item label="每批数量">
          <el-input-number v-model="asyncTaskBatch" :min="5" :max="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAsyncTask = false">取消</el-button>
        <el-button type="primary" :loading="parsing" @click="startAsyncTask">创建任务</el-button>
      </template>
    </el-dialog>

    <!-- 图片预览遮罩 -->
    <teleport to="body">
      <div v-if="showImagePreview" class="img-preview-overlay" @click="showImagePreview = false">
        <img :src="previewImageUrl" class="img-preview-full" @click.stop />
        <button class="img-preview-close" @click="showImagePreview = false"><i class="fas fa-times"></i></button>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'

const PARSE_REQUEST_CONFIG = { timeout: 180000 }
const route = useRoute()
const router = useRouter()
const isAdminView = computed(() => route.path.startsWith('/admin'))
const featureBlocked = ref(false)

const windowHeight = ref(window.innerHeight)
const tableMaxHeight = computed(() => Math.max(400, windowHeight.value - 200))
function onResize() { windowHeight.value = window.innerHeight; isMobileView.value = window.innerWidth < 768 }

const loading = ref(false)
const statsLoading = ref(true)
const parsing = ref(false)
const isAutoParsing = ref(false)
const viewMode = ref('list')
const moreFilterOpen = ref(false)
const isMobileView = ref(window.innerWidth < 768)
const robotId = ref('')
const accounts = ref([])
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const selectedRows = ref([])
const parseDays = ref(3)
const reparseIncompleteLoading = ref(false)
const isAutoReparseIncomplete = ref(false)
const incompleteCount = ref(0)
const reparseBatchSize = ref(50)
const showAsyncTask = ref(false)
const asyncTaskDays = ref(3)
const asyncTaskBatch = ref(10)

const timeOptions = [
  { days: 0, label: '今天' },
  { days: 1, label: '昨天' },
  { days: 3, label: '近3天' },
  { days: 7, label: '近7天' },
  { days: 15, label: '近15天' },
]

const priceOptions = (() => {
  const arr = []
  for (let p = 5000; p <= 50000; p += 1000) arr.push(p)
  return arr
})()

const MOMENT_RETENTION_DAYS = 15

function formatPriceLabel(val) {
  if (val >= 10000) return (val / 10000) + '万'
  return val.toLocaleString()
}

/* 上海地铁线路配色映射（官方配色） */
const METRO_COLORS = {
  '1号线': '#ED3B3B', '2号线': '#8DC63F', '3号线': '#FFD400',
  '4号线': '#462181', '5号线': '#944D9B', '6号线': '#D9027D',
  '7号线': '#FF6900', '8号线': '#009BDB', '9号线': '#87CEFA',
  '10号线': '#C1A7D2', '11号线': '#872522', '12号线': '#007A61',
  '13号线': '#E990C2', '14号线': '#616020', '15号线': '#7C8585',
  '16号线': '#2ABFBF', '17号线': '#C08C3C', '18号线': '#D1A94F',
  '浦江线': '#7C8585', '磁浮线': '#009AC0',
}

function getMetroColor(line) {
  const name = String(line || '').trim()
  return METRO_COLORS[name] || '#999'
}

function parseMetroLines(str) {
  if (!str) return []
  return String(str).split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean)
}

function getMetroDistance(row) {
  const dist = row.effective_metro_distance || row.metro_distance
  if (!dist || dist <= 0) return ''
  return dist >= 1000 ? (dist / 1000).toFixed(1) + 'km' : dist + '米'
}

/* 移动端地铁级联选择器数据与操作 */
const mobileMetroValue = ref([])

const mobileMetroCascaderOptions = computed(() => {
  return filterOpts.metroLines.map(line => ({
    value: line,
    label: line,
    children: (filterOpts.metroStationsWithLines || [])
      .filter(s => s.line === line)
      .map(s => ({ value: s.name, label: s.name }))
  }))
})

const filteredMobileStations = computed(() => {
  if (!filters.metro_lines.length) return filterOpts.metroStations
  return (filterOpts.metroStationsWithLines || [])
    .filter(s => filters.metro_lines.includes(s.line))
    .map(s => s.name)
    .filter((v, i, a) => a.indexOf(v) === i)
})

const filteredPcStations = computed(() => {
  if (!filters.metro_lines.length) return filterOpts.metroStations
  return (filterOpts.metroStationsWithLines || [])
    .filter(s => filters.metro_lines.includes(s.line))
    .map(s => s.name)
    .filter((v, i, a) => a.indexOf(v) === i)
})

function onPcMetroLineChange() {
  if (filters.metro_lines.length) {
    const validStations = new Set(filteredPcStations.value)
    filters.metro_stations = filters.metro_stations.filter(s => validStations.has(s))
  }
  applyFilters()
}

const mobilePriceLabel = computed(() => {
  if (!filters.price_min && !filters.price_max) return '价格'
  const min = filters.price_min ? formatPriceLabel(filters.price_min) : '不限'
  const max = filters.price_max ? formatPriceLabel(filters.price_max) : '不限'
  return `${min}-${max}`
})

const mobileMetroLabel = computed(() => {
  if (!filters.metro_lines.length && !filters.metro_stations.length) return '地铁'
  const parts = []
  if (filters.metro_lines.length) parts.push(filters.metro_lines.length > 1 ? `${filters.metro_lines[0]}等` : filters.metro_lines[0])
  if (filters.metro_stations.length) parts.push(filters.metro_stations.length > 1 ? `${filters.metro_stations[0]}等` : filters.metro_stations[0])
  return parts.join(' ') || '地铁'
})

function toggleMetroLine(line) {
  const idx = filters.metro_lines.indexOf(line)
  if (idx >= 0) {
    filters.metro_lines.splice(idx, 1)
  } else {
    filters.metro_lines.push(line)
  }
  const stationsWithLines = filterOpts.metroStationsWithLines || []
  const lineStations = stationsWithLines.filter(s => s.line === line).map(s => s.name)
  filters.metro_stations = filters.metro_stations.filter(s => !lineStations.includes(s))
  applyFilters()
}

function toggleMetroStation(station) {
  const idx = filters.metro_stations.indexOf(station)
  if (idx >= 0) {
    filters.metro_stations.splice(idx, 1)
  } else {
    filters.metro_stations.push(station)
  }
  applyFilters()
}

function onMobileMetroChange(val) {
  const lines = []
  const stations = []
  if (Array.isArray(val)) {
    val.forEach(item => {
      if (Array.isArray(item) && item.length >= 1) {
        if (!lines.includes(item[0])) lines.push(item[0])
        if (item.length >= 2 && item[1] && !stations.includes(item[1])) stations.push(item[1])
      }
    })
  }
  filters.metro_lines = lines
  filters.metro_stations = stations
  applyFilters()
}

function splitOutdoor(str) {
  if (!str) return []
  return [...new Set(String(str).split(/[,，、/|]+/).map(s => s.trim()).filter(s => s && s !== '0' && s !== 'null'))]
}
function outdoorClass(feat) {
  if (feat.includes('花园')) return 'od-garden'
  if (feat.includes('阳台')) return 'od-balcony'
  if (feat.includes('露台')) return 'od-terrace'
  if (feat.includes('院') || feat.includes('庭')) return 'od-yard'
  return ''
}

function needTruncate(text) {
  if (!text) return false
  const lines = text.split(/\r?\n/)
  if (lines.length > 6) return true
  return text.length > 120
}

const stats = reactive({
  total_moments: 0,
  parsed_data: 0,
  published: 0,
  today_count: 0,
  incomplete_count: 0,
})

const filters = reactive({
  keyword: '',
  price_min: 5000,
  price_max: null,
  bedrooms: [],
  district: [],
  outdoor_features: [],
  metro_lines: [],
  metro_stations: [],
  publisher: '',
  parse_status: '',
  content_type: '',
  time_quick: 3,
  publish_time_start: '',
  publish_time_end: '',
  exclude_keywords: '合租,宿舍,收房,拿房,招聘',
  deduplicate: true,
  property_only: true,
  has_elevator: false,
  has_parking: false,
  has_commission: false,
  is_duplex: false,
  not_in_poi: false,
  sort_field: '',
  sort_order: '',
})

const filterOpts = reactive({
  districts: [],
  communities: [],
  metroLines: [],
  metroStations: [],
  metroStationsWithLines: [],
  publishers: [],
})

function formatNum(n) { return (n || 0).toLocaleString() }

function formatMobileTime(t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return t
  const now = new Date()
  const diff = now - d
  if (diff < 3600000) return Math.max(1, Math.floor(diff / 60000)) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatSalePrice(priceStr) {
  if (!priceStr) return ''
  const cleaned = priceStr.replace('(售)', '').replace('¥', '').replace(/,/g, '')
  const num = parseInt(cleaned, 10)
  if (isNaN(num)) return priceStr.replace('(售)', '')
  if (num >= 100000000) return (num / 100000000).toFixed(1).replace(/\.0$/, '') + '亿'
  if (num >= 10000) return (num / 10000).toFixed(0) + '万'
  return '¥' + num.toLocaleString()
}

async function loadAccounts() {
  try {
    const res = await api.get('/user/wechat-robot/accounts')
    const raw = res.data || []
    const data = Array.isArray(raw) ? raw : (raw.data || raw.list || [])
    accounts.value = Array.isArray(data) ? data : []
    if (accounts.value.length && !robotId.value) {
      robotId.value = accounts.value[0].id
    }
  } catch { accounts.value = [] }
}

function onRobotChange() {
  page.value = 1
  loadStats()
  loadData()
  loadPublishers()
}

async function loadStats() {
  statsLoading.value = true
  try {
    const statsParams = {}
    if (robotId.value) statsParams.robot_id = robotId.value
    const res = await api.get('/user/expat/parsed-properties/stats', { params: statsParams, timeout: 120000 })
    const raw = res.data || {}
    const d = raw.stats || raw.data?.stats || raw
    stats.total_moments = d.total_moments ?? d.total ?? 0
    stats.parsed_data = d.parsed_data ?? d.parsed ?? d.located ?? 0
    stats.published = d.published ?? d.published_count ?? 0
    stats.today_count = d.today_count ?? d.today ?? 0
    stats.incomplete_count = d.incomplete_count ?? 0
    incompleteCount.value = stats.incomplete_count
  } catch (err) {
    console.error('[loadStats] 加载统计失败:', err?.message || err)
  } finally {
    statsLoading.value = false
  }
}

async function loadFilters() {
  try {
    const res = await api.get('/user/expat/parsed-properties/filters')
    const raw = res.data || {}
    const d = raw.data || raw
    filterOpts.districts = d.allDistricts || d.districts || []
    filterOpts.communities = d.communities || []
    filterOpts.metroLines = d.metro_lines || d.metroLines || []
    filterOpts.metroStations = d.metro_stations || d.metroStations || []
    filterOpts.metroStationsWithLines = d.metro_stations_with_lines || []
  } catch { /* ignore */ }
}

async function loadPublishers() {
  if (!robotId.value) {
    filterOpts.publishers = []
    return
  }
  try {
    const res = await api.get('/user/expat/parsed-properties', {
      params: { robot_id: robotId.value, get_publishers: 1 }
    })
    const raw = res.data || {}
    const d = raw.data || raw
    filterOpts.publishers = d.publishers || []
  } catch { filterOpts.publishers = [] }
}

function buildParams() {
  normalizePublishTimeRange()
  const p = { page: page.value, per_page: pageSize.value }
  if (robotId.value) p.robot_id = robotId.value
  if (filters.keyword) p.keyword = filters.keyword
  if (filters.price_min) p.price_min = filters.price_min
  if (filters.price_max) p.price_max = filters.price_max
  if (filters.bedrooms.length) p.bedrooms = filters.bedrooms.join(',')
  if (filters.district?.length) p.district = filters.district.join(',')
  if (filters.outdoor_features.length) p.outdoor_features = filters.outdoor_features.join(',')
  if (filters.metro_lines.length) p.metro_lines = filters.metro_lines.join(',')
  if (filters.metro_stations.length) p.metro_stations = filters.metro_stations.join(',')
  if (filters.publisher) p.publisher = filters.publisher
  if (filters.parse_status) p.parse_status = filters.parse_status
  if (filters.content_type) p.content_type = filters.content_type
  if (filters.publish_time_start) p.publish_time_start = filters.publish_time_start
  if (filters.publish_time_end) p.publish_time_end = filters.publish_time_end
  if (filters.exclude_keywords) p.exclude_keywords = filters.exclude_keywords
  if (filters.deduplicate) p.deduplicate = '1'
  if (filters.property_only) p.property_only = '1'
  if (filters.has_elevator) p.has_elevator = '1'
  if (filters.has_parking) p.has_parking = '1'
  if (filters.has_commission) p.has_commission = '1'
  if (filters.is_duplex) p.is_duplex = '1'
  if (filters.not_in_poi) p.not_in_poi = '1'
  if (filters.sort_field) p.sort_field = filters.sort_field
  if (filters.sort_order) p.sort_order = filters.sort_order
  return p
}

let loadDataAbortController = null
async function loadData() {
  if (loadDataAbortController) {
    loadDataAbortController.abort()
  }
  loadDataAbortController = new AbortController()
  const currentController = loadDataAbortController
  loading.value = true
  try {
    const params = buildParams()
    const res = await api.get('/user/expat/parsed-properties', {
      params,
      signal: currentController.signal,
      // 含关键词/复杂筛选时 COUNT+JOIN 可能 >30s，默认 axios 会判为网络错误
      timeout: 120000,
    })
    if (currentController !== loadDataAbortController) return
    const raw = res.data || {}
    const payload = (raw && !Array.isArray(raw.data) && raw.data) ? raw.data : raw
    const items = Array.isArray(raw)
      ? raw
      : (Array.isArray(raw.data) ? raw.data : (payload.data || payload.list || payload.items || raw.list || raw.items || []))
    const pag = raw.pagination || payload.pagination || {}
    const arr = Array.isArray(items) ? items : []
    arr.forEach(item => { item._expanded = false })
    list.value = arr
    total.value = pag.total ?? raw.total ?? payload.total ?? list.value.length
    const st = payload.stats || raw.stats || {}
    if (st.total_moments !== undefined) {
      stats.total_moments = st.total_moments ?? stats.total_moments
      stats.parsed_data = st.parsed_data ?? stats.parsed_data
      stats.published = st.published ?? stats.published
      stats.today_count = st.today_count ?? stats.today_count
      statsLoading.value = false
    }
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return
    console.error('[loadData] 加载内容资产失败:', err?.message || err)
    list.value = []
    total.value = 0
  } finally {
    if (currentController === loadDataAbortController) {
      loading.value = false
    }
  }
}

async function loadFilteredIncompleteCount() {
  try {
    const filterData = { mode: 'count_incomplete' }
    if (robotId.value) filterData.robot_id = robotId.value
    if (filters.keyword) filterData.keyword = filters.keyword
    if (filters.price_min) filterData.price_min = filters.price_min
    if (filters.price_max) filterData.price_max = filters.price_max
    if (filters.bedrooms.length) filterData.bedrooms = filters.bedrooms.join(',')
    if (filters.district?.length) filterData.district = filters.district.join(',')
    if (filters.publisher) filterData.publisher = filters.publisher
    if (filters.content_type) filterData.content_type = filters.content_type
    if (filters.publish_time_start) filterData.publish_time_start = filters.publish_time_start
    if (filters.publish_time_end) filterData.publish_time_end = filters.publish_time_end
    if (filters.exclude_keywords) filterData.exclude_keywords = filters.exclude_keywords
    if (filters.deduplicate) filterData.deduplicate = '1'
    if (filters.property_only) filterData.property_only = '1'
    if (filters.has_elevator) filterData.has_elevator = '1'
    if (filters.has_parking) filterData.has_parking = '1'
    if (filters.has_commission) filterData.has_commission = '1'
    if (filters.is_duplex) filterData.is_duplex = '1'
    if (filters.metro_lines.length) filterData.metro_lines = filters.metro_lines.join(',')
    if (filters.metro_stations.length) filterData.metro_stations = filters.metro_stations.join(',')
    const res = await api.post('/user/expat/parse-moments', filterData, PARSE_REQUEST_CONFIG)
    const data = res.data?.data || res.data || {}
    incompleteCount.value = data.count || 0
  } catch { /* ignore */ }
}

function togglePriceSort() {
  if (filters.sort_field !== 'price_value') {
    filters.sort_field = 'price_value'
    filters.sort_order = 'desc'
  } else if (filters.sort_order === 'desc') {
    filters.sort_order = 'asc'
  } else {
    filters.sort_field = ''
    filters.sort_order = ''
  }
  applyFilters()
}

function applyFilters() {
  normalizePublishTimeRange()
  page.value = 1
  loadData()
  if (viewMode.value === 'map') loadMapData()
  mapNeedsRefresh = true
}

let debounceTimer = null
function applyFiltersDebounced() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => applyFilters(), 500)
}

let mapNeedsRefresh = false

function resetFilters() {
  Object.assign(filters, {
    keyword: '', price_min: 5000, price_max: null, bedrooms: [], district: [], outdoor_features: [],
    metro_lines: [], metro_stations: [], publisher: '', parse_status: '', content_type: '',
    time_quick: 3, publish_time_start: '', publish_time_end: '',
    exclude_keywords: '合租,宿舍,收房,拿房,招聘',
    deduplicate: true, property_only: true,
    has_elevator: false, has_parking: false, has_commission: false, is_duplex: false, not_in_poi: false,
    sort_field: '', sort_order: '',
  })
  setQuickTime(3, true)
  page.value = 1
  loadData()
  if (viewMode.value === 'map') loadMapData()
  mapNeedsRefresh = true
}

function setQuickTime(days, skipAutoFilter) {
  filters.time_quick = days
  const now = new Date()
  if (days === 0) {
    filters.publish_time_start = formatDate(now)
    filters.publish_time_end = formatDate(now)
  } else if (days === 1) {
    const y = new Date(now); y.setDate(y.getDate() - 1)
    filters.publish_time_start = formatDate(y)
    filters.publish_time_end = formatDate(y)
  } else {
    const d = new Date(now); d.setDate(d.getDate() - days)
    filters.publish_time_start = formatDate(d)
    filters.publish_time_end = formatDate(now)
  }
  if (!skipAutoFilter) applyFilters()
}

function getRetentionStartDate() {
  const d = new Date()
  d.setDate(d.getDate() - MOMENT_RETENTION_DAYS)
  return formatDate(d)
}

function normalizePublishTimeRange() {
  const minStart = getRetentionStartDate()
  if (!filters.publish_time_start || filters.publish_time_start < minStart) {
    filters.publish_time_start = minStart
  }
  if (!filters.publish_time_end) {
    filters.publish_time_end = formatDate(new Date())
  }
  if (filters.publish_time_end < filters.publish_time_start) {
    filters.publish_time_end = filters.publish_time_start
  }
  if (filters.time_quick === 30) {
    filters.time_quick = MOMENT_RETENTION_DAYS
  }
}

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function refreshList() {
  loadStats()
  loadData()
}

const publishing = ref(false)

function onSelectionChange(rows) { selectedRows.value = rows }

/**
 * 单个发布到内容资产库
 */
async function publishSingle(row) {
  row._publishing = true
  try {
    const res = await api.post('/admin/property-library/publish', { ids: [row.id] })
    const msg = res.data?.message || res.data?.data?.message || '发布成功'
    ElMessage.success(msg)
    row.is_listed = 1
    loadStats()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '发布失败')
  } finally {
    row._publishing = false
  }
}

/**
 * 批量发布到内容资产库
 */
async function batchPublishToLibrary() {
  if (!selectedRows.value.length) {
    ElMessage.warning('请先选择要发布的内容资产')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定将选中的 ${selectedRows.value.length} 条内容资产发布到内容资产库？`,
      '批量发布确认',
      { type: 'info', confirmButtonText: '确定发布', cancelButtonText: '取消' }
    )
  } catch { return }

  publishing.value = true
  try {
    const ids = selectedRows.value.map(r => r.id)
    const res = await api.post('/admin/property-library/publish', { ids })
    const data = res.data?.data || res.data || {}
    const msg = res.data?.message || `成功发布 ${data.published || 0} 条内容资产`
    ElMessage.success(msg)
    selectedRows.value.forEach(r => { r.is_listed = 1 })
    loadStats()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '批量发布失败')
  } finally {
    publishing.value = false
  }
}

async function handleReparse(row) {
  row._reparsing = true
  try {
    const res = await api.post('/user/expat/parse-moments', { ids: [row.id] }, PARSE_REQUEST_CONFIG)
    const data = res.data?.data || res.data || {}
    const results = data.results || []
    const firstResult = results[0] || {}
    if (data.queued || firstResult.status === 'queued') {
      ElMessage.success(data.running ? '解析任务正在后台处理中' : '已提交后台解析，稍后自动刷新')
      setTimeout(loadData, 5000)
    } else if (firstResult.status === 'success') {
      ElMessage.success('重新解析成功')
    } else if (firstResult.status === 'failed') {
      ElMessage.warning('解析完成但可能有问题: ' + (firstResult.reason || ''))
    } else {
      ElMessage.success('解析已完成')
    }
    await loadData()
  } catch (e) {
    const msg = e.response?.data?.message || e.response?.data?.msg || e.message || '解析失败'
    ElMessage.error('解析失败: ' + msg)
  } finally { row._reparsing = false }
}

function toggleParse() {
  if (isAutoParsing.value) {
    isAutoParsing.value = false
    ElMessage.info('已停止解析')
  } else {
    isAutoParsing.value = true
    startAutoParse()
  }
}

async function startAutoParse() {
  if (!isAutoParsing.value || !robotId.value) return
  parsing.value = true
  try {
    const days = parseDays.value === 'all' ? 'all' : Math.min(Number(parseDays.value) || 3, MOMENT_RETENTION_DAYS)
    const res = await api.post('/user/expat/parse-moments', { robot_id: robotId.value, days, batch_size: 5 }, PARSE_REQUEST_CONFIG)
    const data = res.data?.data || res.data || {}
    const totalParsed = data.total || 0
    if (data.queued) {
      isAutoParsing.value = false
      ElMessage.success(data.running ? "解析任务正在后台处理中" : "已提交后台解析，共" + totalParsed + "条")
      setTimeout(() => { loadStats(); loadData() }, 5000)
    } else if (totalParsed === 0) {
      isAutoParsing.value = false
      ElMessage.info('没有需要解析的数据')
    } else {
      isAutoParsing.value = false
      ElMessage.success("本批解析: 成功" + (data.parsed || 0) + "条")
    }
    loadStats()
    loadData()
  } catch (e) {
    isAutoParsing.value = false
    const msg = e.response?.data?.message || e.response?.data?.msg || '解析失败'
    ElMessage.error(msg)
  } finally { parsing.value = false }
}

async function startAsyncTask() {
  parsing.value = true
  try {
    const days = asyncTaskDays.value === 'all' ? 'all' : Math.min(Number(asyncTaskDays.value) || 3, MOMENT_RETENTION_DAYS)
    const res = await api.post('/user/expat/parse-moments', { robot_id: robotId.value, days, batch_size: asyncTaskBatch.value }, PARSE_REQUEST_CONFIG)
    const data = res.data?.data || res.data || {}
    ElMessage.success(data.running ? '后台解析任务正在处理中' : '后台任务已创建')
    showAsyncTask.value = false
    setTimeout(() => { loadStats(); loadData() }, 5000)
    loadStats()
    loadData()
  } catch (e) {
    const msg = e.response?.data?.message || e.response?.data?.msg || '创建失败'
    ElMessage.error(msg)
  } finally { parsing.value = false }
}

/* ============ 一键补全未完整 ============ */
function toggleReparseIncomplete() {
  if (isAutoReparseIncomplete.value) {
    isAutoReparseIncomplete.value = false
    ElMessage.info('已停止补全')
  } else {
    isAutoReparseIncomplete.value = true
    doReparseIncomplete()
  }
}

async function doReparseIncomplete() {
  if (!isAutoReparseIncomplete.value) return
  reparseIncompleteLoading.value = true
  try {
    // 携带当前筛选条件，只补全筛选结果中的不完整数据
    const filterData = {
      mode: 'reparse_incomplete',
      batch_size: reparseBatchSize.value,
    }
    if (robotId.value) filterData.robot_id = robotId.value
    if (filters.keyword) filterData.keyword = filters.keyword
    if (filters.price_min) filterData.price_min = filters.price_min
    if (filters.price_max) filterData.price_max = filters.price_max
    if (filters.bedrooms.length) filterData.bedrooms = filters.bedrooms.join(',')
    if (filters.district?.length) filterData.district = filters.district.join(',')
    if (filters.publisher) filterData.publisher = filters.publisher
    if (filters.parse_status) filterData.parse_status = filters.parse_status
    if (filters.content_type) filterData.content_type = filters.content_type
    if (filters.publish_time_start) filterData.publish_time_start = filters.publish_time_start
    if (filters.publish_time_end) filterData.publish_time_end = filters.publish_time_end
    if (filters.exclude_keywords) filterData.exclude_keywords = filters.exclude_keywords
    if (filters.deduplicate) filterData.deduplicate = '1'
    if (filters.property_only) filterData.property_only = '1'
    if (filters.has_elevator) filterData.has_elevator = '1'
    if (filters.has_parking) filterData.has_parking = '1'
    if (filters.has_commission) filterData.has_commission = '1'
    if (filters.is_duplex) filterData.is_duplex = '1'
    if (filters.metro_lines.length) filterData.metro_lines = filters.metro_lines.join(',')
    if (filters.metro_stations.length) filterData.metro_stations = filters.metro_stations.join(',')

    const res = await api.post('/user/expat/parse-moments', filterData, PARSE_REQUEST_CONFIG)
    const data = res.data?.data || res.data || {}
    const parsed = data.parsed || 0
    const remaining = data.remaining || 0
    incompleteCount.value = remaining

    if (parsed === 0 && remaining === 0) {
      isAutoReparseIncomplete.value = false
      ElMessage.success('当前筛选范围内所有内容资产已解析完整')
    } else if (parsed > 0) {
      ElMessage.success(`本批补全: ${parsed}条, 剩余${remaining}条`)
    } else {
      ElMessage.info(`本批无新数据, 剩余${remaining}条`)
    }

    loadData()

    if (isAutoReparseIncomplete.value && remaining > 0) {
      setTimeout(doReparseIncomplete, 2000)
    } else {
      isAutoReparseIncomplete.value = false
    }
  } catch (e) {
    isAutoReparseIncomplete.value = false
    ElMessage.error(e?.response?.data?.message || '补全失败')
  } finally {
    reparseIncompleteLoading.value = false
  }
}

/* ============ 校对功能 ============ */
const showBatchCalibrate = ref(false)
const calibrating = ref(false)
const calibrateMode = ref('all')
const calibrateDistrict = ref('')
const calibrateLimit = ref(500)
const calibrateResult = ref(null)
const calibrateStats = ref(null)

async function handleCalibrate(row) {
  row._calibrating = true
  try {
    const res = await api.post(`/admin/parsed-properties/${row.id}/calibrate`)
    const data = res.data?.data || res.data || {}
    if (data.changed) {
      ElMessage.success('校对完成: ' + (data.changes || []).join(', '))
      await loadData()
    } else {
      ElMessage.info(data.message || '数据已一致，无需更新')
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '校对失败')
  } finally {
    row._calibrating = false
  }
}

async function openBatchCalibrate() {
  showBatchCalibrate.value = true
  calibrateResult.value = null
  try {
    const res = await api.get('/admin/parsed-properties/calibrate-stats')
    calibrateStats.value = res.data?.data || res.data || {}
  } catch {
    calibrateStats.value = null
  }
}

async function executeBatchCalibrate() {
  calibrating.value = true
  calibrateResult.value = null
  try {
    const res = await api.post('/admin/parsed-properties/batch-calibrate', {
      mode: calibrateMode.value,
      district: calibrateDistrict.value,
      limit: calibrateLimit.value
    })
    const data = res.data?.data || res.data || {}
    calibrateResult.value = data
    if (data.updated > 0) {
      ElMessage.success(data.message || '批量校对完成')
      loadData()
      loadStats()
    } else {
      ElMessage.info(data.message || '没有需要校对的数据')
    }
    const statsRes = await api.get('/admin/parsed-properties/calibrate-stats')
    calibrateStats.value = statsRes.data?.data || statsRes.data || {}
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '批量校对失败')
  } finally {
    calibrating.value = false
  }
}

/* ============ 地图视图（高德地图 JS API 2.0） ============ */
const mapContainerRef = ref(null)
const mapLoading = ref(false)
const mapStats = reactive({ communities: 0, properties: 0, noCoords: 0 })
let amapInstance = null
let amapMarkers = []
let amapCluster = null
let currentInfoWindow = null
let currentInfoWindowKey = null
let activeMarkerRef = null
let activeMarkerKey = null

/* 移动端底部弹出面板状态 */
const mobileMapPanel = reactive({ expanded: false, data: null })

/* PC端左侧内容资产列表 */
const mapAllFlatList = ref([])
const mapFlatList = ref([])
const mapFocusId = ref(null)
const mapLeftListRef = ref(null)
const mapMarkersRaw = ref([])
const mapSelectedCommunity = ref(null)
const mapPanelExpanded = ref(true)

function buildFlatListFromMarkers(markers) {
  const list = []
  for (const m of markers) {
    for (const l of m.listings) {
      list.push({
        ...l,
        _uid: `${m.community}_${m.district}_${l.id}`,
        _community: m.community,
        _district: m.district,
        _lat: m.lat,
        _lng: m.lng,
        _metro: m.metro_station || '',
        _metroLine: m.metro_line || '',
        _metroDistance: m.metro_distance || null,
        _propertyType: m.property_type || '住宅',
      })
    }
  }
  return list
}

function selectMapCommunity(d) {
  const key = `${d.community}__${d.district}`
  mapSelectedCommunity.value = { community: d.community, district: d.district, key }
  mapFlatList.value = buildFlatListFromMarkers([d])
  nextTick(() => {
    const listEl = mapLeftListRef.value
    if (listEl) listEl.scrollTop = 0
  })
}

function clearMapSelection() {
  mapSelectedCommunity.value = null
  mapFlatList.value = mapAllFlatList.value
  setActiveMarker(null, null)
  currentInfoWindowKey = null
}

function onMapListCardClick(item) {
  if (!item._lat || !item._lng || !amapInstance) return
  amapInstance.setCenter([item._lng, item._lat])
  amapInstance.setZoom(15)
  openPropertyDetailFromMap(item)
}

function toggleMobileMapPanel() {
  mobileMapPanel.expanded = !mobileMapPanel.expanded
}

function closeMobileMapPanel() {
  mobileMapPanel.expanded = false
  mobileMapPanel.data = null
}

/* 手势拖拽支持 */
const mPanelRef = ref(null)
let touchStartY = 0
let touchStartTranslate = 0
let isDragging = false

function onPanelTouchStart(e) {
  const t = e.touches[0]
  touchStartY = t.clientY
  isDragging = true
  const el = mPanelRef.value
  if (el) el.style.transition = 'none'
}

function onPanelTouchMove(e) {
  if (!isDragging) return
  const t = e.touches[0]
  const dy = t.clientY - touchStartY
  if (dy < 0 && !mobileMapPanel.expanded) return
  if (dy > 0 && mobileMapPanel.expanded) {
    const el = mPanelRef.value
    if (el) el.style.transform = `translateY(${Math.max(0, dy)}px)`
  }
}

function onPanelTouchEnd(e) {
  if (!isDragging) return
  isDragging = false
  const el = mPanelRef.value
  if (el) el.style.transition = ''
  const t = e.changedTouches[0]
  const dy = t.clientY - touchStartY
  if (dy > 60 && mobileMapPanel.expanded) {
    closeMobileMapPanel()
  } else if (dy < -40 && !mobileMapPanel.expanded) {
    mobileMapPanel.expanded = true
  }
  if (el) el.style.transform = ''
}

function formatShortTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatPanelPrice(price) {
  if (!price) return ''
  const p = String(price).trim()
  return (p.startsWith('¥') ? p : '¥' + p) + '/月'
}

function openPropertyDetailFromMap(item) {
  if (!item.id && !item._uid) return
  const d = mobileMapPanel.data || {}
  openPropertyDetail({
    id: item.id,
    community: item._community || d.community || '',
    district: item._district || d.district || '',
    price: item.price || '',
    price_value: item.price_value || null,
    bedrooms: item.bedrooms || null,
    bathrooms: item.bathrooms || null,
    area_sqm: item.area_sqm || null,
    publisher_name: item.publisher || '',
    original_content: item.content || '',
    moment_publish_time: item.publish_time || '',
    metro_lines: item._metroLine || d.metro_line || '',
    metro_stations: item._metro || d.metro_station || '',
    latitude: item._lat || d.lat || null,
    longitude: item._lng || d.lng || null,
  })
}

function loadAmapScript(key, securityKey) {
  return new Promise((resolve, reject) => {
    if (window.AMap) { resolve(window.AMap); return }
    window._AMapSecurityConfig = { securityJsCode: securityKey }
    const s = document.createElement('script')
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.MarkerCluster,AMap.InfoWindow,AMap.Scale,AMap.ToolBar`
    s.onload = () => { resolve(window.AMap) }
    s.onerror = () => reject(new Error('高德地图加载失败'))
    document.head.appendChild(s)
  })
}

async function loadMapData() {
  mapLoading.value = true
  try {
    const params = buildParams()
    delete params.page
    delete params.per_page

    const res = await api.get('/user/expat/parsed-properties/map', { params, timeout: 120000 })
    const raw = res.data || {}
    const payload = raw.data || raw
    const { markers = [], total_properties = 0, total_communities = 0, no_coords_count = 0, mapConfig } = payload
    mapStats.communities = total_communities
    mapStats.properties = total_properties
    mapStats.noCoords = no_coords_count

    mapMarkersRaw.value = markers
    mapAllFlatList.value = buildFlatListFromMarkers(markers)
    mapFlatList.value = mapAllFlatList.value
    mapSelectedCommunity.value = null

    if (!mapConfig?.js_api_key) {
      ElMessage.warning('请先在管理后台设置高德地图API Key')
      mapLoading.value = false
      return
    }

    if (markers.length > 0) {
      await nextTick()
      await renderAmapMap(markers, mapConfig)
    } else {
      clearAmapMarkers()
    }
  } catch (e) {
    console.error('加载地图数据失败:', e)
    ElMessage.error('加载地图数据失败')
  }
  mapLoading.value = false
}

function clearAmapMarkers() {
  if (amapCluster) { amapCluster.setMap(null); amapCluster = null }
  amapMarkers = []
  activeMarkerRef = null
  activeMarkerKey = null
  if (currentInfoWindow) { currentInfoWindow.close(); currentInfoWindow = null }
}

async function renderAmapMap(markers, mapConfig) {
  const AMap = await loadAmapScript(mapConfig.js_api_key, mapConfig.security_js_key || '')
  const container = mapContainerRef.value
  if (!container) return

  if (!amapInstance) {
    amapInstance = new AMap.Map(container, {
      zoom: mapConfig.zoom || 11,
      center: mapConfig.center || [121.4737, 31.2304],
      resizeEnable: true,
      viewMode: '2D',
    })
    amapInstance.addControl(new AMap.Scale())
    amapInstance.addControl(new AMap.ToolBar({ position: 'RT' }))
  }

  clearAmapMarkers()

  const typeColors = { '公寓': '#409EFF', '别墅': '#E6A23C', '住宅': '#67C23A' }

  const clusterData = markers.map(m => {
    const color = typeColors[m.property_type] || '#409EFF'
    const priceRange = m.listings.filter(l => l.price_value).map(l => l.price_value)
    const minP = priceRange.length ? Math.min(...priceRange) : null
    const maxP = priceRange.length ? Math.max(...priceRange) : null
    const priceStr = minP ? (minP === maxP ? `¥${minP}` : `¥${minP}-${maxP}`) : '价格待询'
    const bedrooms = [...new Set(m.listings.filter(l => l.bedrooms).map(l => l.bedrooms + '室'))].join('/')

    return {
      lnglat: [m.lng, m.lat],
      weight: m.listings.length,
      extData: { ...m, color, priceStr, bedrooms },
    }
  })

  amapCluster = new AMap.MarkerCluster(amapInstance, clusterData, {
    gridSize: 60,
    maxZoom: 16,
    renderMarker(ctx) {
      const d = ctx.data[0].extData
      const count = d.listings.length
      const markerKey = `${d.lng}_${d.lat}`
      ctx.marker._markerKey = markerKey
      ctx.marker._extData = d
      const isActive = (activeMarkerKey === markerKey)
      if (isActive) {
        activeMarkerRef = ctx.marker
        ctx.marker.setContent(getActiveMarkerHtml(d))
      } else {
        ctx.marker.setContent(getNormalMarkerHtml(d))
      }
      ctx.marker.setOffset(new AMap.Pixel(-14, -14))
      if (ctx.marker._popupHandler) {
        ctx.marker.off('click', ctx.marker._popupHandler)
      }
      ctx.marker._popupHandler = () => showInfoWindow(d, ctx.marker)
      ctx.marker.on('click', ctx.marker._popupHandler)
    },
    renderClusterMarker(ctx) {
      const count = ctx.count
      let size = 36, bg = 'rgba(64,158,255,0.85)'
      if (count > 50) { size = 56; bg = 'rgba(245,108,108,0.85)' }
      else if (count > 10) { size = 46; bg = 'rgba(230,162,60,0.85)' }
      ctx.marker.setContent(
        `<div class="amap-cluster-icon" style="width:${size}px;height:${size}px;background:${bg}">` +
        `<span>${count}</span></div>`
      )
      ctx.marker.setOffset(new AMap.Pixel(-size / 2, -size / 2))
    },
  })

  if (markers.length > 0) {
    amapInstance.setFitView(null, false, [30, 30, 30, 30], 14)
  }
}

function getNormalMarkerHtml(d) {
  return `<div class="amap-marker-dot" style="background:${d.color};border-color:${d.color}"><span>${d.listings.length}</span></div>`
}

function getActiveMarkerHtml(d) {
  return `<div class="amap-marker-dot amap-marker-active"><span>${d.listings.length}</span></div>`
}

function setActiveMarker(marker, d) {
  if (activeMarkerRef && activeMarkerRef._extData) {
    activeMarkerRef.setContent(getNormalMarkerHtml(activeMarkerRef._extData))
  }
  activeMarkerRef = marker
  activeMarkerKey = (marker && d) ? `${d.lng}_${d.lat}` : null
  if (marker && d) {
    marker.setContent(getActiveMarkerHtml(d))
  }
}

function showInfoWindow(d, marker) {
  const markerKey = `${d.lng}_${d.lat}`
  const isMb = window.innerWidth < 768

  if (isMb) {
    if (mobileMapPanel.data && currentInfoWindowKey === markerKey && mobileMapPanel.expanded) {
      closeMobileMapPanel()
      currentInfoWindowKey = null
      setActiveMarker(null, null)
      return
    }
    mobileMapPanel.data = d
    mobileMapPanel.expanded = true
    currentInfoWindowKey = markerKey
    if (marker) setActiveMarker(marker, d)
    if (amapInstance) {
      amapInstance.setCenter([d.lng, d.lat])
    }
    return
  }

  if (currentInfoWindow) { currentInfoWindow.close(); currentInfoWindow = null }
  currentInfoWindowKey = markerKey

  if (marker) setActiveMarker(marker, d)
  selectMapCommunity(d)
  if (amapInstance) {
    amapInstance.setCenter([d.lng, d.lat])
  }
}

/* ============ 行内编辑功能（管理员专用） ============ */
const editingCell = reactive({ id: null, field: null, value: null })
const poiSearchLoading = ref(false)
const poiSearchResults = ref([])
const communityInputRef = ref(null)
let poiSearchTimer = null

const editMetroStationOptions = computed(() => {
  const lines = editingCell.field === 'metro_stations' && editingCell.id
    ? parseMetroLines(list.value.find(r => r.id === editingCell.id)?.metro_lines || '')
    : []
  if (lines.length) {
    return filterOpts.metroStationsWithLines
      .filter(s => lines.includes(s.line))
      .map(s => s.name)
      .filter((v, i, a) => a.indexOf(v) === i)
  }
  return filterOpts.metroStations
})

function startInlineEdit(row, field, currentValue) {
  editingCell.id = row.id
  editingCell.field = field
  editingCell.value = currentValue ?? ''
}

async function saveInlineEdit(row, field) {
  if (editingCell.id !== row.id || editingCell.field !== field) return
  let newValue = editingCell.value
  const oldValue = row[field]

  if (field === 'outdoor_features' && Array.isArray(newValue)) {
    newValue = newValue.join(',')
  }
  if (field === 'metro_lines' && Array.isArray(newValue)) {
    newValue = newValue.join(',')
  }
  if (field === 'price_value') {
    newValue = parseInt(newValue, 10) || 0
  }
  if (field === 'bedrooms' || field === 'bathrooms') {
    newValue = parseInt(newValue, 10) || 1
  }

  editingCell.id = null
  editingCell.field = null
  editingCell.value = null
  poiSearchResults.value = []

  if (String(newValue) === String(oldValue)) return

  try {
    const updateData = {}
    updateData[field] = newValue
    if (field === 'price_value' && newValue > 0) {
      updateData.price = '¥' + Number(newValue).toLocaleString()
    }
    await api.put(`/user/expat/parsed-properties/${row.id}`, updateData)
    row[field] = newValue
    if (field === 'price_value' && newValue > 0) {
      row.price = '¥' + Number(newValue).toLocaleString()
    }
    ElMessage.success('已更新')
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '更新失败')
    loadData()
  }
}

async function toggleBoolField(row, field) {
  const newValue = row[field] ? 0 : 1
  try {
    const updateData = {}
    updateData[field] = newValue
    await api.put(`/user/expat/parsed-properties/${row.id}`, updateData)
    row[field] = newValue
    ElMessage.success('已更新')
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '更新失败')
  }
}

/* ============ 小区分类显示辅助 ============ */
// community_type: 0=未分类, 1=真实小区, 2=区域名, 3=商圈地标, 4=路名地址, 5=其他
function communityDisplayClass(row) {
  if (!isAdminView.value || !row.community || row.is_in_poi) return {}
  const t = row.community_type || 0
  if (t === 2 || t === 3) return { 'not-in-poi-gray': true }
  return { 'not-in-poi': true }
}

function communityTypeLabel(row) {
  const labels = { 0: '未在POI数据库中', 1: '未在POI数据库中', 2: '区域名(非小区)', 3: '商圈/地标(非小区)', 4: '路名地址(非小区)', 5: '其他(非小区)' }
  return labels[row.community_type] || labels[0]
}

function communityTypeIcon(row) {
  const t = row.community_type || 0
  if (t === 2 || t === 3) return 'fa-info-circle community-type-icon-gray'
  return 'fa-exclamation-triangle poi-warn-icon'
}

/* ============ POI导入功能 ============ */
const batchPoiImporting = ref(false)

async function handleImportSingleToPOI(row) {
  if (!row.community || row.is_in_poi) return
  row._poiImporting = true
  try {
    const res = await api.post('/user/expat/parsed-properties/import-to-poi', {
      items: [{ community: row.community, district: row.district || '' }]
    })
    if (res.data?.imported > 0) {
      ElMessage.success(`"${row.community}" 已导入POI数据库`)
      row.is_in_poi = 1
    } else if (res.data?.existed > 0) {
      ElMessage.info(`"${row.community}" 已存在于POI数据库`)
      row.is_in_poi = 1
    } else {
      ElMessage.warning('导入失败')
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '导入失败')
  }
  row._poiImporting = false
}

async function handleBatchImportToPOI() {
  const toImport = selectedRows.value.filter(r => !r.is_in_poi && r.community)
  if (!toImport.length) return ElMessage.warning('没有需要导入的小区')
  try {
    await ElMessageBox.confirm(
      `确定将选中的 ${toImport.length} 个未在POI中的小区导入到POI数据库？`,
      '批量导入POI', { type: 'warning', confirmButtonText: '确定导入', cancelButtonText: '取消' }
    )
  } catch { return }
  batchPoiImporting.value = true
  try {
    const ids = toImport.map(r => r.id)
    const res = await api.post('/user/expat/parsed-properties/import-to-poi', { prop_ids: ids })
    const d = res.data || {}
    ElMessage.success(`导入完成：新增 ${d.imported || 0}，已存在 ${d.existed || 0}，跳过 ${d.skipped || 0}`)
    toImport.forEach(r => { r.is_in_poi = 1 })
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '批量导入失败')
  }
  batchPoiImporting.value = false
}

watch(() => editingCell.value, (val) => {
  if (editingCell.field !== 'community') return
  clearTimeout(poiSearchTimer)
  if (!val || val.length < 1) {
    poiSearchResults.value = []
    return
  }
  poiSearchTimer = setTimeout(async () => {
    try {
      const res = await api.get('/user/expat/parsed-properties/search-poi', {
        params: { keyword: val, district: '' }
      })
      poiSearchResults.value = res.data || []
    } catch {
      poiSearchResults.value = []
    }
  }, 300)
})

function selectPOISuggestion(row, poi) {
  editingCell.value = poi.community_name
  poiSearchResults.value = []
  saveInlineEdit(row, 'community')
}

/* ============ 外链图片代理 ============ */
function proxyThumb(url) {
  if (!url) return ''
  if (url.startsWith('/api/proxy/image') || url.startsWith('/uploads/')) return url
  if (url.includes('X-Amz-Signature')) return url
  if (url.includes('qpic.cn') || url.includes('wx.qlogo.cn') || url.includes('rains3.com') || url.includes('wechat') || url.includes('mmbiz') || url.includes('szangels') || url.includes('imgcache.qq.com') || url.includes('hkimg.qq.com') || url.includes('wtimg.qq.com') || url.includes('smartgaga')) {
    return '/api/proxy/image?url=' + encodeURIComponent(url)
  }
  return url
}

/* ============ 获取内容资产缩略图 ============ */
function getThumb(prop) {
  if (prop.cover_image) return prop.cover_image
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
  return firstNonVideoUrl || ''
}

function getMediaCount(prop) {
  if (!prop) return 0
  let count = 0
  const sources = [prop.media_urls, prop.local_images, prop.images]
  const seen = new Set()
  for (const raw of sources) {
    if (!raw) continue
    try {
      const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!Array.isArray(arr)) continue
      for (const u of arr) {
        const url = typeof u === 'string' ? u : (u?.url || u?.thumb || '')
        if (url && !seen.has(url) && !/\.(mp4|mov|avi|m4v|webm|ogg)(\?|$)/i.test(url) && !/video\.qq\.com|snsvideodownload/i.test(url)) {
          seen.add(url)
          count++
        }
      }
    } catch {}
  }
  return count
}

/* ============ 详情图片列表 ============ */
function getDetailMediaList(prop) {
  if (!prop) return []
  const result = []
  const seen = new Set()
  const sources = [prop.media_urls, prop.local_images, prop.images]
  for (const raw of sources) {
    if (!raw) continue
    try {
      const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!Array.isArray(arr)) continue
      for (const u of arr) {
        const url = typeof u === 'string' ? u : (u?.url || u?.thumb || '')
        if (url && !seen.has(url) && !/\.(mp4|mov|avi|m4v|webm|ogg)(\?|$)/i.test(url) && !/video\.qq\.com|snsvideodownload/i.test(url)) {
          seen.add(url)
          result.push(url)
        }
      }
    } catch {}
  }
  return result
}

const previewImageUrl = ref('')
const showImagePreview = ref(false)
function previewDetailImage(url) {
  previewImageUrl.value = proxyThumb(url)
  showImagePreview.value = true
}

/* ============ 内容资产详情弹窗（含地图） ============ */
const showPropertyDetail = ref(false)
const detailRow = ref(null)
const detailMapRef = ref(null)
let detailMapInstance = null

function openPropertyDetail(row) {
  detailRow.value = row
  showPropertyDetail.value = true
  nextTick(() => {
    if (row.latitude && row.longitude) {
      setTimeout(() => initDetailMap(row), 300)
    }
  })
}

function handleOpDropdown(cmd, row) {
  if (cmd === 'detail') openPropertyDetail(row)
  else if (cmd === 'reparse') handleReparse(row)
  else if (cmd === 'calibrate') handleCalibrate(row)
  else if (cmd === 'publish') publishSingle(row)
}

async function initDetailMap(row) {
  if (!detailMapRef.value) return
  try {
    let mapConfigData = null
    try {
      const configRes = await api.get('/user/expat/parsed-properties/map', { params: { page: 1, per_page: 1 } })
      mapConfigData = configRes.data?.mapConfig
    } catch { /* ignore */ }
    if (!mapConfigData?.js_api_key) return

    const AMap = await loadAmapScript(mapConfigData.js_api_key, mapConfigData.security_js_key || '')
    if (detailMapInstance) {
      detailMapInstance.destroy()
      detailMapInstance = null
    }
    const lat = Number(row.latitude)
    const lng = Number(row.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    detailMapInstance = new AMap.Map(detailMapRef.value, {
      zoom: 15,
      center: [lng, lat],
      resizeEnable: true,
      viewMode: '2D',
    })
    const marker = new AMap.Marker({
      position: [lng, lat],
      title: row.community || '内容资产位置',
    })
    detailMapInstance.add(marker)

    const priceStr = row.price_value ? '¥' + Number(row.price_value).toLocaleString() + '/月' : (row.price || '')
    const roomStr = [row.bedrooms ? row.bedrooms + '室' : '', row.bathrooms ? row.bathrooms + '卫' : ''].filter(Boolean).join('')
    const infoContent = `<div style="padding:8px;min-width:180px"><b>${row.community || '内容资产'}</b><br/>${[row.district, roomStr, priceStr].filter(Boolean).join(' · ')}</div>`
    const infoWindow = new AMap.InfoWindow({ content: infoContent, offset: new AMap.Pixel(0, -30) })
    infoWindow.open(detailMapInstance, [lng, lat])
  } catch (e) {
    console.error('初始化详情地图失败:', e)
  }
}

watch(showPropertyDetail, (val) => {
  if (!val && detailMapInstance) {
    detailMapInstance.destroy()
    detailMapInstance = null
  }
})

watch(viewMode, (val) => {
  if (val === 'map') {
    nextTick(() => {
      if (amapInstance) amapInstance.resize()
      if (mapNeedsRefresh || mapStats.properties === 0) {
        loadMapData()
        mapNeedsRefresh = false
      }
    })
  }
})

onMounted(async () => {
  window.addEventListener('resize', onResize)

  if (!isAdminView.value) {
    try {
      const checkRes = await api.get('/user/feature-modules/check/quick-search')
      const access = checkRes.data
      if (access && access.allowed === false) {
        featureBlocked.value = true
        return
      }
    } catch (e) {
      if (e.response?.status === 403) {
        featureBlocked.value = true
        return
      }
    }
  }

  setQuickTime(3, true)
  const filtersPromise = loadFilters()
  await loadAccounts()
  await Promise.all([loadStats(), loadData(), loadPublishers(), filtersPromise])
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
/* 页面头部 */
.plugin-header {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white; padding: 20px 24px; border-radius: 12px; margin-bottom: 20px;
}
.plugin-header h2 { font-size: 1.3rem; font-weight: 700; margin: 0 0 4px 0; color: white; }
.plugin-header p { font-size: 13px; color: rgba(255,255,255,0.8); }

/* 统计卡片网格 - 使用CSS Grid避免Bootstrap负边距问题 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.stats-card {
  background: white; border-radius: 12px; padding: 16px 20px; text-align: center;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06); transition: all 0.3s ease;
  min-width: 0;
}
.stats-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
.stats-card .stats-icon { font-size: 20px; color: #3498db; margin-bottom: 6px; }
.stats-card .value { font-size: 1.5rem; font-weight: 700; color: #333; line-height: 1.2; }
.stats-card .label { font-size: 12px; color: #999; margin-top: 4px; }

/* 模块卡片 */
.module-card {
  background: white; border-radius: 12px; padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
.module-title {
  font-size: 15px; font-weight: 600; color: #333; margin-bottom: 12px;
  display: flex; align-items: center; gap: 8px;
}
.module-title i { color: #9C27B0; }

/* ========== 筛选区域 美化 ========== */
.filter-module { padding: 0 !important; overflow: hidden; }
.filter-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 20px; border-bottom: 1px solid #f0f0f0; background: #FAFBFC;
}
.filter-title { font-size: 14px; font-weight: 600; color: #333; display: flex; align-items: center; gap: 6px; }
.filter-title i { color: #9C27B0; font-size: 13px; }
.filter-actions { display: flex; gap: 8px; }
.filter-body { padding: 14px 20px 10px; }
.filter-grid { display: grid; gap: 10px 12px; margin-bottom: 10px; }
.filter-grid-5 { grid-template-columns: repeat(5, 1fr); }
.filter-grid-time { grid-template-columns: auto auto 1fr; }
.fg-item { min-width: 0; }
.fg-item label { display: block; font-size: 11px; color: #888; margin-bottom: 3px; font-weight: 500; line-height: 1.2; }
.fg-item label small { color: #bbb; }
.fg-item-grow { flex: 1; }
.price-range-wrap { display: flex; align-items: center; gap: 4px; }
.price-range-wrap .el-input, .price-range-wrap .el-date-editor, .price-range-wrap .price-sel { flex: 1; min-width: 0; }
.range-sep { color: #ccc; font-size: 12px; flex-shrink: 0; }
.exclude-kw-wrap { display: flex; gap: 4px; }
.exclude-kw-wrap .el-input { flex: 1; }
.kw-reset-btn { padding: 5px 8px !important; }
.filter-inline-row {
  display: flex; align-items: center; gap: 12px; padding-top: 4px; border-top: 1px dashed #eee;
  margin-top: 4px; padding-bottom: 4px; flex-wrap: wrap; justify-content: space-between;
}
.filter-inline-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; flex-wrap: wrap; }
.filter-inline-row .filter-actions { margin-left: auto; flex-shrink: 0; }
.filter-inline-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; flex-wrap: wrap; }
.inline-label { font-size: 11px; color: #888; font-weight: 500; white-space: nowrap; }

.quick-time-btns { display: flex; gap: 4px; flex-wrap: wrap; }
.quick-time-btn {
  padding: 3px 10px; font-size: 11px; border: 1px solid #ddd; background: white;
  border-radius: 12px; cursor: pointer; transition: all 0.2s; color: #666;
}
.quick-time-btn:hover { border-color: #9C27B0; color: #9C27B0; }
.quick-time-btn.active { background: #9C27B0; color: white; border-color: #9C27B0; }

/* 视图切换 */
.view-tabs { display: flex; gap: 0; background: #F5F5F5; border-radius: 12px; padding: 4px; }
.view-tab {
  flex: 0 0 auto; padding: 10px 20px; font-weight: 500; color: #666;
  cursor: pointer; border-radius: 10px; border: none; background: transparent;
  font-size: 14px; transition: all 0.3s;
}
.view-tab.active { background: white; color: #9C27B0; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.view-tab:hover:not(.active) { color: #9C27B0; }
.view-tab .badge { font-size: 10px; padding: 2px 6px; }
.bg-purple { background: #9C27B0 !important; }

/* 操作列 - 下拉按钮 */
.op-dropdown-btn { padding: 3px 8px !important; font-size: 12px !important; min-height: 26px !important; line-height: 1.2 !important; white-space: nowrap; }
.op-dropdown-menu .el-dropdown-menu__item { font-size: 13px; padding: 8px 16px; line-height: 1.4; display: flex; align-items: center; }
.op-dropdown-menu .el-dropdown-menu__item i { width: 16px; flex-shrink: 0; }
.listed-tag { font-size: 10px !important; }

/* 表格单元格样式 */
.sortable-header {
  display: flex; align-items: center; gap: 4px; cursor: pointer; user-select: none;
}
.sort-icons {
  display: flex; flex-direction: column; line-height: 1; font-size: 10px; color: #ccc; margin-top: -2px;
}
.sort-icons i { line-height: 0.6; }
.sort-icons i.active { color: #FF9800; }
.cell-price { color: #e74c3c; font-weight: 600; font-size: 13px; }
.price-sale-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}
.cell-price-sale-value {
  color: #f56c6c;
  font-weight: 700;
  font-size: 13px;
  text-decoration: line-through;
  display: block;
  line-height: 1.4;
}
.sale-tag {
  font-size: 10px !important;
  letter-spacing: 0;
  flex-shrink: 0;
}
.cell-price-daily { color: #909399; font-size: 10px; }
.cell-price-unit { color: #999; font-size: 10px; font-weight: 400; }
.cell-num { font-weight: 600; color: #333; }
.cell-empty { color: #ccc; font-size: 11px; }
.cell-station { font-size: 12px; color: #555; }
.metro-station-cell { display: flex; flex-direction: column; gap: 2px; }
.metro-distance { font-size: 11px; color: #2F80ED; font-weight: 500; }

/* 内容资产类型标签 */
.ptype-公寓 { font-size: 11px; color: #409EFF; font-weight: 600; }
.ptype-别墅 { font-size: 11px; color: #E6A23C; font-weight: 600; }
.ptype-住宅 { font-size: 11px; color: #67C23A; font-weight: 600; }

/* 布尔标签样式 - 有/无明确区分 */
.badge-green {
  display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; font-weight: 500;
  background: #E8F5E9; color: #2E7D32; border: 1px solid #C8E6C9;
}
.badge-gray {
  display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px;
  background: #F5F5F5; color: #BDBDBD; border: 1px solid #E0E0E0;
}
.badge-orange {
  display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; font-weight: 500;
  background: #FFF3E0; color: #E65100; border: 1px solid #FFE0B2;
}
.badge-yes {
  display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; font-weight: 500;
  background: #E3F2FD; color: #1565C0; border: 1px solid #BBDEFB;
}
/* 户外特征多标签 */
.outdoor-tags { display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; }
.badge-outdoor {
  display: inline-block; padding: 0 5px; border-radius: 3px; font-size: 10px; font-weight: 500;
  line-height: 18px; white-space: nowrap;
  background: #F3E5F5; color: #7B1FA2; border: 1px solid #E1BEE7;
}
.badge-outdoor.od-garden { background: #E8F5E9; color: #2E7D32; border-color: #C8E6C9; }
.badge-outdoor.od-balcony { background: #E3F2FD; color: #1565C0; border-color: #BBDEFB; }
.badge-outdoor.od-terrace { background: #FFF3E0; color: #E65100; border-color: #FFE0B2; }
.badge-outdoor.od-yard { background: #FCE4EC; color: #AD1457; border-color: #F8BBD0; }

/* 地铁标签 */
.metro-tags { display: flex; flex-wrap: wrap; gap: 2px; }
.metro-tag {
  display: inline-block; padding: 0 5px; border-radius: 3px; font-size: 10px;
  font-weight: 600; line-height: 18px; white-space: nowrap;
}

/* 表格文案列 - 默认6行折叠 */
.media-preview-cell { cursor: pointer; display: flex; align-items: center; justify-content: center; }
.parsed-thumb-wrap { position: relative; width: 60px; height: 45px; }
.parsed-thumb { width: 60px; height: 45px; object-fit: cover; border-radius: 4px; border: 1px solid #eee; display: block; }
.parsed-thumb-count { position: absolute; bottom: 2px; right: 2px; background: rgba(0,0,0,.6); color: #fff; font-size: 10px; line-height: 1; padding: 2px 4px; border-radius: 3px; font-weight: 600; }
.parsed-thumb-empty { width: 60px; height: 45px; display: flex; align-items: center; justify-content: center; color: #ddd; background: #f8f8f8; border-radius: 4px; border: 1px solid #eee; font-size: 18px; }
.content-cell { position: relative; }
.content-text {
  font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; color: #333;
}
.fav-note-badge { display: inline-block; background: #E8F5E9; color: #2E7D32; font-size: 11px; padding: 1px 6px; border-radius: 3px; margin-bottom: 4px; }
.content-collapsed {
  display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical;
  overflow: hidden; max-height: calc(12px * 1.5 * 6);
}
.content-toggle {
  display: inline-block; margin-top: 2px; font-size: 11px; color: #9C27B0; cursor: pointer;
  font-weight: 500; user-select: none;
}
.content-toggle:hover { text-decoration: underline; }

/* 分页 */
.pagination-bar { display: flex; justify-content: flex-start; }

/* 地图视图卡片 */
.map-view-card { background: white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); position: relative; overflow: hidden; }

/* PC端链家风格左右分栏 */
.map-split-layout {
  display: flex;
  height: calc(100vh - 180px);
  min-height: 520px;
}

/* 左侧面板 */
.map-left-panel {
  width: 380px;
  min-width: 320px;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e8e8e8;
  background: #fff;
  flex-shrink: 0;
}
.map-left-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 6px;
  flex-shrink: 0;
}
.map-left-title {
  font-size: 15px;
  font-weight: 700;
  color: #333;
}
.map-left-title i { color: #9C27B0; margin-right: 6px; }
.map-left-actions { display: flex; gap: 4px; }

/* 收起后浮在地图左上角的展开按钮 */
.map-expand-btn {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #9C27B0;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  transition: background 0.2s, box-shadow 0.2s;
}
.map-expand-btn:hover { background: #f3e5f5; box-shadow: 0 3px 12px rgba(0,0,0,0.18); }
.map-expand-btn i { margin-right: 4px; }
.map-left-stats {
  padding: 0 16px 10px;
  font-size: 12px;
  color: #888;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.map-left-stats b { color: #9C27B0; }
.map-sel-back {
  cursor: pointer;
  color: #9C27B0;
  font-weight: 600;
  transition: opacity 0.2s;
}
.map-sel-back:hover { opacity: 0.7; }
.map-sel-back i { margin-right: 3px; }
.map-sel-label {
  font-weight: 600;
  color: #333;
}

/* 左侧内容资产列表 */
.map-left-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 10px;
  scrollbar-width: thin;
  scrollbar-color: #d0d0d0 transparent;
}
.map-left-list::-webkit-scrollbar { width: 5px; }
.map-left-list::-webkit-scrollbar-thumb { background: #d0d0d0; border-radius: 4px; }
.map-left-list::-webkit-scrollbar-thumb:hover { background: #9C27B0; }

.map-lp-card {
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  background: #fafafa;
}
.map-lp-card:hover {
  background: #f3ecf8;
  border-color: rgba(156, 39, 176, 0.2);
}
.map-lp-card.active {
  background: #f3ecf8;
  border-color: #9C27B0;
  box-shadow: 0 2px 8px rgba(156, 39, 176, 0.12);
}

.map-lp-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}
.map-lp-publisher { font-size: 13px; font-weight: 700; color: #333; }
.map-lp-time { font-size: 11px; color: #bbb; }

.map-lp-tag {
  background: linear-gradient(135deg, #7B2D8E, #9B3AB1);
  color: #fff;
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 5px;
}

.map-lp-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 3px;
}
.map-lp-area {
  display: inline-block;
  background: #FFF3E0;
  color: #E65100;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
}
.map-lp-metro { font-size: 11px; color: #666; }
.map-lp-metro i { color: #409EFF; margin-right: 2px; }

.map-lp-content {
  font-size: 11px;
  color: #999;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}

.map-lp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #ccc;
}
.map-lp-empty i { font-size: 32px; margin-bottom: 8px; }
.map-lp-empty p { font-size: 13px; color: #999; }

.map-left-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 16px;
  font-size: 11px;
  color: #999;
  border-top: 1px solid #f0f0f0;
  flex-shrink: 0;
}

/* 右侧地图区域 */
.map-right-area {
  flex: 1;
  min-width: 0;
  position: relative;
}
.map-right-area .map-container {
  width: 100%;
  height: 100%;
  border-radius: 0;
  overflow: hidden;
  background: #f5f5f5;
  position: relative;
  z-index: 1;
}

/* 地图通用 */
.map-container { width: 100%; height: 600px; border-radius: 0; overflow: hidden; border: none; background: #f5f5f5; position: relative; z-index: 1; }
.map-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #999; }
.map-placeholder i { font-size: 48px; margin-bottom: 12px; }
.map-legend { display: flex; align-items: center; gap: 16px; padding: 8px 12px; font-size: 12px; color: #666; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 4px; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.legend-tip { margin-left: auto; color: #999; font-size: 11px; }

/* ========== 页面根容器：防止页面级横向溢出 ========== */
.moments-parsed-list {
  overflow-x: hidden;
  width: 100%;
  box-sizing: border-box;
}

/* (筛选样式已移至上方 filter-module 部分) */

/* ========== 表格横向滚动容器 ========== */
.table-scroll-wrap {
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
}
.table-scroll-wrap::-webkit-scrollbar { height: 7px; }
.table-scroll-wrap::-webkit-scrollbar-track { background: #f0f0f0; border-radius: 4px; }
.table-scroll-wrap::-webkit-scrollbar-thumb { background: #bbb; border-radius: 4px; }
.table-scroll-wrap::-webkit-scrollbar-thumb:hover { background: #9C27B0; }

/* ========== 校对统计卡片 ========== */
.calibrate-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.calibrate-stat-item {
  text-align: center;
  padding: 12px 8px;
  background: var(--background-light, #F8F9FA);
  border-radius: 8px;
}
.calibrate-stat-num {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.2;
}
.calibrate-stat-label {
  font-size: 12px;
  color: var(--text-secondary, #666);
  margin-top: 4px;
}
.calibrate-result {
  margin-top: 12px;
}

/* ========== 列表操作栏自适应 ========== */
.list-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}
.list-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

/* ========== 移动端筛选栏（淘宝风格） ========== */
.map-info-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px; }
.m-filter-bar { background: #fff; border-radius: 10px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); overflow: hidden; }
.m-filter-scroll { display: flex; gap: 6px; padding: 8px 10px; overflow-x: auto; -webkit-overflow-scrolling: touch; align-items: center; }
.m-filter-scroll::-webkit-scrollbar { display: none; }
.m-filter-sep { color: #ccc; font-size: 12px; flex-shrink: 0; line-height: 1; }
.m-filter-sel { flex-shrink: 0; width: 80px !important; }
.m-filter-sel :deep(.el-input__wrapper) { padding: 0 6px; }
.m-filter-sel :deep(.el-input__inner) { font-size: 12px; }
:global(.m-ios-select-popper) {
  z-index: 4000 !important;
  max-width: 92vw;
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
}
:global(.m-ios-select-popper .el-select-dropdown__wrap) {
  max-height: 260px;
  -webkit-overflow-scrolling: touch;
}
.m-filter-more-btn {
  flex-shrink: 0; border: 1px solid #ddd; background: #fff; color: #666;
  padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer;
  display: flex; align-items: center; gap: 3px; white-space: nowrap;
  transition: all 0.2s;
}
.m-filter-more-btn.active { border-color: #667eea; color: #667eea; background: #f0f3ff; }
.m-filter-expand { padding: 8px 10px; border-top: 1px solid #f0f0f0; background: #fafbfc; }
.m-filter-expand-row { display: flex; gap: 8px; margin-bottom: 8px; }
.m-filter-kw { width: 100%; }
.m-filter-half { flex: 1; min-width: 0; }
.m-quick-time-btns { width: 100%; }
.m-quick-time-btns .quick-time-btn { flex: 1 1 calc(20% - 4px); min-width: 56px; text-align: center; }
.m-filter-date-row :deep(.el-input__wrapper) { width: 100%; }
.m-filter-checks { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.m-filter-checks :deep(.el-checkbox__label) { font-size: 12px; }
.m-filter-commission-check { flex-shrink: 0; white-space: nowrap; }
.m-filter-commission-check :deep(.el-checkbox__label) { font-size: 12px; padding-left: 4px; }
.m-filter-metro-cascader { flex-shrink: 0; width: 90px !important; }
.m-filter-metro-cascader :deep(.el-input__wrapper) { padding: 0 6px; }
.m-filter-metro-cascader :deep(.el-input__inner) { font-size: 12px; }

/* 移动端价格和地铁按钮 */
.m-filter-btn {
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 3px;
  padding: 5px 10px; border-radius: 16px; font-size: 12px; white-space: nowrap;
  background: #f5f5f5; border: 1px solid #e0e0e0; color: #555; cursor: pointer;
  transition: all 0.2s;
}
.m-filter-btn:active { background: #eee; }
.m-filter-btn.active { background: #eef0ff; border-color: #7c5cfc; color: #7c5cfc; font-weight: 600; }

/* ========== 移动端卡片列表 ========== */
.m-card-list { padding: 0; }
.m-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 0 2px; }
.m-list-count { font-size: 12px; color: #888; }
.m-list-count b { color: #333; }
.m-list-size { width: 80px !important; }
.m-property-card {
  background: #fff; border-radius: 10px; margin-bottom: 8px; padding: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05); cursor: pointer;
  transition: box-shadow 0.2s; -webkit-tap-highlight-color: transparent;
}
.m-property-card:active { box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
.m-card-with-thumb { display: flex; gap: 10px; }
.m-card-thumb {
  width: 88px; height: 88px; flex-shrink: 0; border-radius: 8px;
  overflow: hidden; background: #f5f5f5;
}
.m-card-thumb img { width: 100%; height: 100%; object-fit: cover; }
.m-card-main { flex: 1; min-width: 0; }
.m-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.m-card-community { font-size: 14px; font-weight: 600; color: #222; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-card-district { font-size: 11px; background: #f0f3ff; color: #667eea; padding: 1px 6px; border-radius: 3px; flex-shrink: 0; margin-left: 6px; }
.m-card-body { }
.m-card-price-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.m-card-price { font-size: 18px; font-weight: 700; color: #e74c3c; }
.m-card-price small { font-size: 11px; font-weight: 400; color: #999; }
.m-card-price.sale { color: #ff4500; }
.m-card-price.sale small { background: #ff4500; color: #fff; padding: 0 3px; border-radius: 2px; font-size: 9px; margin-left: 2px; }
.m-card-price.empty { font-size: 14px; color: #999; font-weight: 400; }
.m-card-rooms { font-size: 13px; color: #555; }
.m-card-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; }
.m-tag { font-size: 10px; padding: 1px 5px; border-radius: 3px; font-weight: 500; }
.m-tag.green { background: #e8f5e9; color: #2e7d32; }
.m-tag.blue { background: #e3f2fd; color: #1565c0; }
.m-tag.orange { background: #fff3e0; color: #e65100; }
.m-tag.purple { background: #f3e5f5; color: #7b1fa2; }
.m-tag.teal { background: #e0f2f1; color: #00695c; }
.m-card-metro { font-size: 12px; color: #666; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-card-metro i { color: #667eea; font-size: 11px; flex-shrink: 0; }
.m-metro-line-tag { display: inline-block; padding: 0 4px; border-radius: 3px; font-size: 10px; font-weight: 600; line-height: 16px; white-space: nowrap; flex-shrink: 0; }
.m-card-station { color: #999; }
.m-card-footer { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #aaa; }
.m-card-publisher i { margin-right: 2px; }
.m-empty-state { text-align: center; padding: 40px 0; color: #ccc; }
.m-empty-state i { font-size: 36px; margin-bottom: 8px; }
.m-empty-state p { font-size: 13px; color: #999; }
.m-pagination { display: flex; justify-content: center; padding: 12px 0; }

/* ========== 响应式断点 ========== */
@media (max-width: 1200px) {
  .filter-grid-5 { grid-template-columns: repeat(3, 1fr); }
  .filter-grid-time { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 900px) {
  .filter-grid-5 { grid-template-columns: repeat(2, 1fr); }
  .filter-grid-time { grid-template-columns: 1fr; }
  .stats-card { padding: 12px 14px; }
  .stats-card .value { font-size: 1.3rem; }
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
  .map-view-card { padding: 0 !important; border-radius: 0; box-shadow: none; position: relative; }
  .map-view-card--mobile .map-container { height: calc(100vh - 200px); min-height: 300px; border-radius: 0; }
}

/* ========== 移动端地图底部面板（链家风格） ========== */
.m-map-bottom-panel {
  position: fixed;
  left: 0; right: 0;
  bottom: calc(56px + env(safe-area-inset-bottom, 0px));
  z-index: 1040;
  background: #fff;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  max-height: 55vh;
  display: flex;
  flex-direction: column;
  will-change: transform;
}
.m-map-bottom-panel.collapsed {
  transform: translateY(calc(100% - 48px));
}
.m-map-bottom-panel.expanded {
  transform: translateY(0);
}

.m-panel-handle {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 16px 10px;
  cursor: pointer;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
  user-select: none;
}
.m-panel-bar {
  width: 40px;
  height: 5px;
  background: #ccc;
  border-radius: 5px;
  margin-bottom: 8px;
}
.m-panel-summary {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.m-panel-body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.m-panel-close {
  position: absolute;
  top: 0;
  right: 12px;
  z-index: 2;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0,0,0,0.06);
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}
.m-panel-close:active {
  background: rgba(0,0,0,0.12);
}

.m-panel-listings {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  padding: 0 14px 20px;
}

.m-panel-listing-card {
  padding: 12px;
  border-radius: 10px;
  background: #f8f9fa;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background 0.2s;
  -webkit-tap-highlight-color: transparent;
}
.m-panel-listing-card:active {
  background: #eef1f5;
}
.m-panel-listing-card:last-child {
  margin-bottom: 0;
}

.m-panel-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.m-panel-publisher {
  font-size: 14px;
  font-weight: 700;
  color: #222;
}
.m-panel-time {
  font-size: 11px;
  color: #aaa;
}

.m-panel-tag-bar {
  background: linear-gradient(135deg, #7B2D8E, #9B3AB1);
  color: #fff;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 6px;
}

.m-panel-card-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.m-panel-area {
  display: inline-block;
  background: #FFF3E0;
  color: #E65100;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}
.m-panel-metro {
  font-size: 12px;
  color: #666;
}
.m-panel-metro i {
  color: #409EFF;
  margin-right: 3px;
}

.m-panel-content {
  font-size: 12px;
  color: #888;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
  margin-top: 4px;
}

/* ========== 内容资产详情弹窗 ========== */
.property-detail-dialog { max-height: calc(80vh - 100px); overflow-y: auto; }
.detail-info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
.detail-info-item { background: #f8f9fa; border-radius: 8px; padding: 10px 12px; }
.detail-label { display: block; font-size: 11px; color: #888; margin-bottom: 3px; }
.detail-value { display: block; font-size: 13px; font-weight: 600; color: #333; word-break: break-all; }
.detail-value.price-text { color: #e74c3c; }
.detail-section-title { font-size: 14px; font-weight: 600; color: #9C27B0; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; padding-bottom: 6px; border-bottom: 2px solid rgba(156, 39, 176, 0.15); }
.detail-original-text { font-size: 13px; line-height: 1.7; color: #555; white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto; background: #fafafa; padding: 12px; border-radius: 8px; }
.detail-content-section { margin-bottom: 16px; }
.detail-media-section { margin-bottom: 16px; }
.detail-media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
.detail-media-item { border-radius: 6px; overflow: hidden; cursor: pointer; aspect-ratio: 1; background: #f0f0f0; }
.detail-media-item img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
.detail-media-item:hover img { transform: scale(1.05); }
.img-preview-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,.85); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.img-preview-full { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: 4px; cursor: default; }
.img-preview-close { position: fixed; top: 16px; right: 16px; width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,.15); border: none; color: #fff; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.detail-map-section { margin-top: 16px; }
.detail-map-container { width: 100%; height: 350px; border-radius: 12px; overflow: hidden; border: 1px solid #e5e5e5; background: #f5f5f5; }
.detail-map-coords { display: flex; gap: 16px; padding: 8px 4px; font-size: 12px; color: #888; }
.detail-no-map { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #ccc; background: #fafafa; border-radius: 12px; }
.detail-no-map i { font-size: 36px; margin-bottom: 8px; }
.detail-no-map p { font-size: 13px; color: #999; }

/* 移动端头部价格摘要（仅移动端显示） */
.m-detail-hero { display: none; }

@media (max-width: 767px) {
  .property-detail-dialog { max-height: none; overflow-y: auto; padding: 0; -webkit-overflow-scrolling: touch; }
  .m-detail-hero {
    display: block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px; padding: 16px; margin-bottom: 14px; color: #fff;
  }
  .m-detail-hero-price { font-size: 26px; font-weight: 700; line-height: 1.2; }
  .m-detail-hero-price small { font-size: 13px; font-weight: 400; opacity: 0.8; }
  .m-detail-hero-info { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; font-size: 13px; opacity: 0.9; align-items: center; }
  .m-detail-hero-info span { background: rgba(255,255,255,0.18); padding: 2px 8px; border-radius: 4px; }
  .m-detail-district-tag { background: rgba(255,255,255,0.3) !important; font-weight: 600; }
  .detail-info-grid { grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
  .detail-info-item { padding: 8px 10px; border-radius: 8px; }
  .detail-label { font-size: 10px; margin-bottom: 2px; }
  .detail-value { font-size: 13px; }
  .detail-section-title { font-size: 13px; margin-bottom: 8px; padding-bottom: 4px; }
  .detail-original-text { font-size: 13px; padding: 10px; max-height: 160px; border-radius: 8px; line-height: 1.6; }
  .detail-content-section { margin-bottom: 12px; }
  .detail-media-section { margin-bottom: 12px; }
  .detail-media-grid { grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 6px; }
  .detail-map-section { margin-top: 12px; }
  .detail-map-container { height: 220px; border-radius: 10px; }
  .detail-map-coords { flex-direction: column; gap: 4px; padding: 6px 2px; font-size: 11px; }
  .detail-no-map { height: 140px; border-radius: 10px; }
  .detail-no-map i { font-size: 28px; margin-bottom: 6px; }
  .detail-no-map p { font-size: 12px; }
}
</style>

<style>
/* 高德地图标记样式（非scoped，高德地图动态创建DOM） */
.amap-marker-dot {
  width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 11px; font-weight: 700; border: 2px solid; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  cursor: pointer; transition: transform 0.2s;
}
.amap-marker-dot:hover { transform: scale(1.2); }
.amap-marker-dot.amap-marker-active {
  background: #FF4D00 !important;
  border-color: #fff !important;
  color: #fff;
  border-width: 3px;
  width: 36px; height: 36px;
  font-size: 13px;
  transform: scale(1);
  box-shadow: 0 0 0 3px #FF4D00, 0 0 0 6px rgba(255,77,0,0.3), 0 3px 10px rgba(0,0,0,0.35);
  animation: markerPulse 2s ease-in-out infinite;
  z-index: 100 !important;
  position: relative;
}
@keyframes markerPulse {
  0%, 100% { box-shadow: 0 0 0 3px #FF4D00, 0 0 0 6px rgba(255,77,0,0.3), 0 3px 10px rgba(0,0,0,0.35); }
  50% { box-shadow: 0 0 0 3px #FF4D00, 0 0 0 12px rgba(255,77,0,0.12), 0 3px 10px rgba(0,0,0,0.35); }
}
.amap-cluster-icon {
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  cursor: pointer;
}

/* PHP版本风格弹窗 */
.map-popup-php {
  width: 280px; max-height: 400px; background: #fff; border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2); overflow: visible; font-family: system-ui, -apple-system, sans-serif;
  position: relative;
}
.map-popup-php::after {
  content: '';
  position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%);
  width: 0; height: 0;
  border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid #fff;
  filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1));
  pointer-events: none;
}
.popup-header {
  background: linear-gradient(135deg, #7B2D8E, #9B3AB1);
  color: #fff; padding: 8px 12px; font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: space-between;
  border-radius: 10px 10px 0 0;
}
.popup-close {
  cursor: pointer; font-size: 16px; opacity: 0.8; width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center; border-radius: 50%;
  transition: all 0.2s;
}
.popup-close:hover { opacity: 1; background: rgba(255,255,255,0.2); }
.popup-list {
  max-height: 300px; overflow-y: auto; overflow-x: hidden; padding: 0;
  border-radius: 0 0 10px 10px; background: #fff;
}
.popup-list::-webkit-scrollbar { width: 4px; }
.popup-list::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }
/* PC端弹窗更宽的滚动条，方便鼠标操作 */
.popup-list-pc { scrollbar-width: thin; scrollbar-color: #9B3AB1 #f0f0f0; }
.popup-list-pc::-webkit-scrollbar { width: 8px; }
.popup-list-pc::-webkit-scrollbar-track { background: #f5f5f5; border-radius: 4px; }
.popup-list-pc::-webkit-scrollbar-thumb { background: #bbb; border-radius: 4px; cursor: pointer; }
.popup-list-pc::-webkit-scrollbar-thumb:hover { background: #9B3AB1; }
.popup-listing {
  padding: 8px 10px; border-bottom: 1px solid #f0f0f0;
}
.popup-listing:last-child { border-bottom: none; }
.popup-publisher {
  font-size: 12px; font-weight: 700; color: #303133; margin-bottom: 4px;
}
.popup-tag-bar {
  background: linear-gradient(135deg, #7B2D8E, #9B3AB1);
  color: #fff; padding: 5px 8px; border-radius: 5px; font-size: 11px;
  font-weight: 600; margin-bottom: 4px; line-height: 1.3;
}
.popup-area {
  display: inline-block; background: #FFF3E0; color: #E65100; padding: 2px 8px;
  border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 6px;
}
.popup-content {
  font-size: 12px; color: #666; line-height: 1.6; margin: 6px 0;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  word-break: break-all;
}
.popup-time {
  font-size: 11px; color: #999; margin-top: 4px;
}

/* 关闭弹窗时的点击区域 */
.map-popup-php .amap-info-close { display: none; }

/* 移动端地图弹窗适配 */
.map-popup-mobile {
  width: calc(100vw - 48px) !important; max-width: 260px;
  max-height: 50vh; border-radius: 8px; overflow: visible;
}
.map-popup-mobile::after {
  bottom: -10px;
  border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 10px solid #fff;
}
.map-popup-mobile .popup-header {
  padding: 10px 14px; font-size: 13px; border-radius: 10px 10px 0 0;
}
.map-popup-mobile .popup-list {
  max-height: 45vh; overflow-y: auto; -webkit-overflow-scrolling: touch;
}
.map-popup-mobile .popup-listing { padding: 10px 12px; }
.map-popup-mobile .popup-publisher { font-size: 13px; margin-bottom: 6px; }
.map-popup-mobile .popup-tag-bar {
  font-size: 12px; padding: 6px 10px; border-radius: 5px; line-height: 1.3;
  word-break: break-all;
}
.map-popup-mobile .popup-area { font-size: 11px; }
.map-popup-mobile .popup-content { font-size: 12px; -webkit-line-clamp: 2; margin: 4px 0; }
.map-popup-mobile .popup-time { font-size: 10px; }

/* 统计卡片加载脉冲动画 */
.loading-pulse { animation: pulse-anim 1.2s ease-in-out infinite; color: #ddd !important; }
@keyframes pulse-anim { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

/* 移动端地铁级联选择器弹窗样式 */
.m-metro-cascader-popper { max-width: 90vw; }
.m-metro-cascader-popper .el-cascader-menu { min-width: 100px; }

/* 移动端价格面板 */
.m-price-panel { padding: 4px 0; }
.m-price-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.m-price-label { font-size: 13px; color: #666; width: 50px; flex-shrink: 0; }
.m-price-sel { flex: 1; }
.m-price-confirm { width: 100%; margin-top: 4px; }

/* 移动端地铁面板 */
.m-metro-panel { padding: 4px 0; max-height: 60vh; overflow-y: auto; }
.m-metro-section { margin-bottom: 10px; }
.m-metro-section-title { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 6px; }
.m-metro-section-title small { font-weight: 400; color: #999; }
.m-metro-line-tags, .m-metro-station-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.m-metro-line-tag, .m-metro-station-tag {
  display: inline-block; padding: 4px 10px; font-size: 12px; border-radius: 14px;
  border: 1px solid #ddd; color: #555; cursor: pointer; transition: all 0.15s;
  user-select: none;
}
.m-metro-line-tag:active, .m-metro-station-tag:active { transform: scale(0.96); }
.m-metro-line-tag.selected { border-color: currentColor; }
.m-metro-station-tag.selected { background: #7c5cfc; color: #fff; border-color: #7c5cfc; }
.m-metro-hint { font-size: 12px; color: #bbb; text-align: center; padding: 12px 0; }
.m-metro-confirm { width: 100%; margin-top: 6px; }

/* 地铁线路下拉选项颜色圆点 */
.metro-dot {
  display: inline-block; width: 10px; height: 10px; border-radius: 50%;
  margin-right: 6px; vertical-align: middle; flex-shrink: 0;
}

/* ========== 行内编辑样式 ========== */
.editable-cell { cursor: default; }
.editable-cell.admin-editable {
  cursor: pointer; border-bottom: 1px dashed transparent; transition: all 0.2s;
}
.editable-cell.admin-editable:hover {
  border-bottom-color: var(--primary-color, #409EFF); color: var(--primary-color, #409EFF);
  background: rgba(64,158,255,0.04); border-radius: 2px;
}
/* 小区列 - 未在POI中的标黄 */
.community-edit-wrap { position: relative; width: 100%; }
.poi-suggest-list {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 2000;
  background: #fff; border: 1px solid var(--border-color, #e0e0e0); border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.12); max-height: 180px; overflow-y: auto;
}
.poi-suggest-item {
  padding: 6px 10px; cursor: pointer; font-size: 13px; line-height: 1.4;
  transition: background 0.15s;
}
.poi-suggest-item:hover { background: #f0f7ff; }
.community-cell { display: flex; align-items: center; gap: 3px; flex-wrap: nowrap; }
.community-cell.not-in-poi .editable-cell {
  color: #E6A23C; background: rgba(230,162,60,0.08); border-radius: 3px; padding: 1px 4px;
}
.community-cell.not-in-poi-gray .editable-cell {
  color: #909399; background: rgba(144,147,153,0.08); border-radius: 3px; padding: 1px 4px;
}
.poi-warn-icon { color: #E6A23C; font-size: 11px; flex-shrink: 0; }
.community-type-icon-gray { color: #909399; font-size: 11px; flex-shrink: 0; }
.poi-import-btn { padding: 2px 5px !important; min-height: unset !important; font-size: 11px !important; flex-shrink: 0; }

/* ========== 移动端内容资产详情弹窗全局样式 ========== */
@media (max-width: 767px) {
  .detail-dialog-responsive.el-dialog {
    margin: 0 !important; border-radius: 0 !important; max-height: 100vh;
  }
  .detail-dialog-responsive .el-dialog__header {
    padding: 12px 16px; border-bottom: 1px solid #f0f0f0;
    position: sticky; top: 0; z-index: 10; background: #fff;
  }
  .detail-dialog-responsive .el-dialog__header .el-dialog__title {
    font-size: 15px; font-weight: 600;
  }
  .detail-dialog-responsive .el-dialog__body {
    padding: 14px; overflow-y: auto; -webkit-overflow-scrolling: touch;
    max-height: calc(100vh - 110px);
  }
  .detail-dialog-responsive .el-dialog__footer {
    padding: 10px 14px; border-top: 1px solid #f0f0f0;
    position: sticky; bottom: 0; background: #fff;
  }
}
</style>

<style>
/* 功能未开通弹窗（teleport 到 body，不能用 scoped） */
.fb-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 99999;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(4px);
}
.fb-modal {
  background: #fff; border-radius: 16px; padding: 40px 36px 32px;
  width: 400px; max-width: 90vw; text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  animation: fbSlideIn 0.35s ease;
}
@keyframes fbSlideIn {
  from { opacity: 0; transform: translateY(30px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.fb-icon {
  width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex; align-items: center; justify-content: center;
  font-size: 36px; color: #fff;
  box-shadow: 0 8px 24px rgba(102,126,234,0.35);
}
.fb-title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin: 0 0 12px; }
.fb-desc { font-size: 14px; color: #666; line-height: 1.8; margin: 0 0 28px; }
.fb-btn {
  display: block; width: 240px; margin: 0 auto; padding: 12px 0;
  border-radius: 10px; font-size: 15px; font-weight: 600;
  cursor: pointer; border: none; transition: all 0.25s ease;
}
.fb-btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2); color: #fff;
  box-shadow: 0 4px 16px rgba(102,126,234,0.3);
  margin-bottom: 12px;
}
.fb-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 22px rgba(102,126,234,0.45);
}
.fb-btn-primary i { margin-right: 6px; }
.fb-btn-secondary {
  background: transparent; color: #999; font-weight: 500;
}
.fb-btn-secondary:hover { color: #666; }
</style>
