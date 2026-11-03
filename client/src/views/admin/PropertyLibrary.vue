<template>
  <div>
    <!-- 页面头部 - 紫色渐变 -->
    <div class="plugin-header">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h2><i class="fas fa-database me-2"></i>内容资产库管理</h2>
          <p class="mb-0 opacity-75">管理所有用户搜索保存的内容资产信息</p>
        </div>
      </div>
    </div>

    <!-- Tab切换：内容资产库管理 / 发布设置 -->
    <el-tabs v-model="activeTab" type="card" class="property-lib-tabs">
      <el-tab-pane label="内容资产库管理" name="library">

    <!-- 统计卡片 -->
    <div class="stats-grid mb-4">
      <div class="stats-card">
        <div class="stats-icon"><i class="fas fa-home"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }">{{ statsLoading ? '-' : formatNumber(stats.total) }}</div>
        <div class="label">总内容资产数</div>
      </div>
      <div class="stats-card">
        <div class="stats-icon" style="color: #4CAF50"><i class="fas fa-paper-plane"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }" style="color: #4CAF50">{{ statsLoading ? '-' : formatNumber(stats.sentCount) }}</div>
        <div class="label">已发送内容资产</div>
      </div>
      <div class="stats-card">
        <div class="stats-icon" style="color: #FF9800"><i class="fas fa-users"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }" style="color: #FF9800">{{ statsLoading ? '-' : formatNumber(stats.userCount) }}</div>
        <div class="label">贡献用户数</div>
      </div>
      <div class="stats-card">
        <div class="stats-icon" style="color: #9C27B0"><i class="fas fa-calendar-day"></i></div>
        <div class="value" :class="{ 'loading-pulse': statsLoading }" style="color: #9C27B0">{{ statsLoading ? '-' : formatNumber(stats.todayCount) }}</div>
        <div class="label">今日新增</div>
      </div>
    </div>

    <!-- ====== 移动端筛选栏（淘宝风格横向下拉） ====== -->
    <div class="m-filter-bar d-md-none mb-3">
      <div class="m-filter-scroll">
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
              <el-select v-model="filters.price_min" placeholder="不限" size="small" clearable class="m-price-sel" @change="loadData">
                <el-option v-for="p in priceOptions" :key="'mmin'+p" :label="formatPriceLabel(p)" :value="p" />
              </el-select>
            </div>
            <div class="m-price-row">
              <span class="m-price-label">最高价</span>
              <el-select v-model="filters.price_max" placeholder="不限" size="small" clearable class="m-price-sel" @change="loadData">
                <el-option v-for="p in priceOptions" :key="'mmax'+p" :label="formatPriceLabel(p)" :value="p" />
              </el-select>
            </div>
            <el-button size="small" type="primary" class="m-price-confirm" @click="loadData">确定</el-button>
          </div>
        </el-popover>
        <el-select v-model="filters.bedrooms" placeholder="卧室" size="small" clearable multiple collapse-tags :max-collapse-tags="1" class="m-filter-sel" @change="loadData">
          <el-option v-for="n in 5" :key="'mb'+n" :label="`${n}室`" :value="n" />
        </el-select>
        <el-select v-model="filters.district" placeholder="区域(可多选)" size="small" clearable filterable multiple collapse-tags :max-collapse-tags="1" class="m-filter-sel" @change="loadData">
          <el-option v-for="d in districts" :key="'md'+d" :label="d" :value="d" />
        </el-select>
        <el-checkbox v-model="filterChecks.has_commission" size="small" class="m-filter-commission-check" @change="loadData">佣金</el-checkbox>
        <el-select v-model="filters.outdoor_features" placeholder="户外" size="small" clearable multiple collapse-tags :max-collapse-tags="1" class="m-filter-sel" @change="loadData">
          <el-option label="花园" value="花园" /><el-option label="阳台" value="阳台" /><el-option label="露台" value="露台" /><el-option label="院子" value="院子" />
        </el-select>
        <el-select v-model="filters.listing_status" placeholder="上架状态" size="small" class="m-filter-sel" @change="loadData">
          <el-option label="已上架" value="listed" />
          <el-option label="已下架" value="unlisted" />
          <el-option label="全部" value="all" />
        </el-select>
        <button
          type="button"
          class="m-filter-btn"
          :class="{ active: sortOrder === 'desc' }"
          title="按发布时间：新的在前"
          @click="setSortOrder('desc')"
        >
          <i class="fas fa-sort-amount-down"></i> 最新在前
        </button>
        <button
          type="button"
          class="m-filter-btn"
          :class="{ active: sortOrder === 'asc' }"
          title="按发布时间：旧的在后"
          @click="setSortOrder('asc')"
        >
          <i class="fas fa-sort-amount-up"></i> 最早在前
        </button>
        <button class="m-filter-more-btn" :class="{ active: moreFilterOpen }" @click="moreFilterOpen = !moreFilterOpen">
          <i class="fas fa-sliders-h"></i> 更多
        </button>
      </div>
      <div v-if="moreFilterOpen" class="m-filter-expand">
        <div class="m-filter-expand-row">
          <el-input v-model="filters.search" placeholder="搜索小区/描述/发布人..." size="small" clearable class="m-filter-kw" @keyup.enter="loadData" @clear="loadData" />
        </div>
        <div class="m-filter-expand-row">
          <el-select v-model="filters.publisher" placeholder="发布人" size="small" clearable filterable class="m-filter-half" @change="loadData">
            <el-option label="全部" value="" />
            <el-option v-for="p in publishers" :key="'mp'+p" :label="p" :value="p" />
          </el-select>
        </div>
        <div class="m-filter-expand-row m-filter-checks">
          <el-checkbox v-model="filterChecks.has_elevator" size="small" @change="loadData">电梯</el-checkbox>
          <el-checkbox v-model="filterChecks.has_parking" size="small" @change="loadData">车位</el-checkbox>
          <el-checkbox v-model="filterChecks.is_duplex" size="small" @change="loadData">复式</el-checkbox>
          <el-button type="primary" size="small" @click="loadData; moreFilterOpen = false" style="margin-left: auto"><i class="fas fa-search me-1"></i>筛选</el-button>
          <el-button size="small" @click="resetFilters"><i class="fas fa-redo"></i></el-button>
        </div>
      </div>
    </div>

    <!-- ====== PC端筛选模块 ====== -->
    <div class="module-card filter-module mb-4 d-none d-md-block">
      <div class="filter-header">
        <div class="filter-title"><i class="fas fa-filter"></i> 内容资产筛选</div>
      </div>
      <div class="filter-body">
        <div class="filter-grid filter-grid-5">
          <div class="fg-item">
            <label>关键词搜索</label>
            <el-input v-model="filters.search" placeholder="搜索小区、描述、发布人..." size="small" clearable @keyup.enter="loadData" @clear="loadData" />
          </div>
          <div class="fg-item">
            <label>价格范围</label>
            <div class="price-range-wrap">
              <el-select v-model="filters.price_min" placeholder="最低" size="small" clearable filterable allow-create class="price-sel" @change="loadData">
                <el-option v-for="p in priceOptions" :key="'min'+p" :label="formatPriceLabel(p)" :value="p" />
              </el-select>
              <span class="range-sep">-</span>
              <el-select v-model="filters.price_max" placeholder="最高" size="small" clearable filterable allow-create class="price-sel" @change="loadData">
                <el-option v-for="p in priceOptions" :key="'max'+p" :label="formatPriceLabel(p)" :value="p" />
              </el-select>
            </div>
          </div>
          <div class="fg-item">
            <label>卧室</label>
            <el-select v-model="filters.bedrooms" placeholder="不限" size="small" clearable multiple class="w-100" @change="loadData">
              <el-option v-for="n in 5" :key="n" :label="`${n}室`" :value="n" />
            </el-select>
          </div>
          <div class="fg-item">
            <label>区域 <small>(可多选)</small></label>
            <el-select v-model="filters.district" placeholder="全部区域" size="small" clearable filterable multiple collapse-tags :max-collapse-tags="3" class="w-100" @change="loadData">
              <el-option v-for="d in districts" :key="d" :label="d" :value="d" />
            </el-select>
          </div>
          <div class="fg-item">
            <label>户外 <small>(可多选)</small></label>
            <el-select v-model="filters.outdoor_features" placeholder="不限" size="small" clearable multiple class="w-100" @change="loadData">
              <el-option label="花园" value="花园" />
              <el-option label="阳台" value="阳台" />
              <el-option label="露台" value="露台" />
              <el-option label="院子/庭院" value="院子" />
            </el-select>
          </div>
        </div>
        <div class="filter-grid filter-grid-5">
          <div class="fg-item">
            <label>地铁线路</label>
            <el-input v-model="filters.metro_lines" placeholder="如：2号线,10号线" size="small" @keyup.enter="loadData" />
          </div>
          <div class="fg-item">
            <label>地铁站点</label>
            <el-input v-model="filters.metro_stations" placeholder="如：人民广场" size="small" @keyup.enter="loadData" />
          </div>
          <div class="fg-item">
            <label>发布人</label>
            <el-select v-model="filters.publisher" placeholder="全部发布人" size="small" clearable filterable class="w-100" @change="loadData">
              <el-option label="全部发布人" value="" />
              <el-option v-for="p in publishers" :key="p" :label="p" :value="p" />
            </el-select>
          </div>
          <div class="fg-item">
            <label>内容资产编号</label>
            <el-input v-model="filters.property_codes" placeholder="多个用逗号分隔" size="small" @keyup.enter="loadData" />
          </div>
          <div class="fg-item">
            <label>发布时间</label>
            <div class="price-range-wrap">
              <el-date-picker v-model="filters.publish_time_start" type="date" placeholder="开始" size="small" value-format="YYYY-MM-DD" @change="loadData" />
              <span class="range-sep">-</span>
              <el-date-picker v-model="filters.publish_time_end" type="date" placeholder="结束" size="small" value-format="YYYY-MM-DD" @change="loadData" />
            </div>
          </div>
        </div>
        <div class="filter-grid filter-grid-time">
          <div class="fg-item">
            <label>上架状态</label>
            <el-radio-group v-model="filters.listing_status" size="small" @change="loadData">
              <el-radio-button v-for="item in listingStatusOptions" :key="item.value" :label="item.value">{{ item.label }}</el-radio-button>
            </el-radio-group>
          </div>
          <div class="fg-item">
            <label>快速筛选时间</label>
            <div class="quick-time-btns">
              <button v-for="t in timeOptions" :key="t.days" type="button" class="quick-time-btn" :class="{ active: filters.time_quick === t.days }" @click="setQuickTime(t.days)">{{ t.label }}</button>
            </div>
          </div>
          <div class="fg-item fg-item-grow">
            <label>排除关键词 <small>(逗号分隔)</small></label>
            <div class="exclude-kw-wrap">
              <el-input v-model="filters.exclude_keywords" placeholder="合租,宿舍,收房,拿房,床位,次卧,主卧,招聘" size="small" @change="loadData" />
              <el-button size="small" class="kw-reset-btn" @click="filters.exclude_keywords = '合租,宿舍,收房,拿房,床位,次卧,主卧,招聘'; loadData()"><i class="fas fa-undo"></i></el-button>
            </div>
          </div>
        </div>
        <div class="filter-inline-row">
          <div class="filter-inline-left filter-inline-sort">
            <span class="inline-label">列表排序</span>
            <el-select v-model="sortOrder" size="small" class="sort-inline-select" placeholder="按发布时间" @change="onListSortSelectChange">
              <el-option label="发布时间 · 最新在前" value="desc" />
              <el-option label="发布时间 · 最早在前" value="asc" />
            </el-select>
          </div>
          <div class="filter-inline-left">
            <span class="inline-label">其他条件</span>
            <el-checkbox v-model="filterChecks.has_elevator" size="small" @change="loadData">有电梯</el-checkbox>
            <el-checkbox v-model="filterChecks.has_parking" size="small" @change="loadData">有车位</el-checkbox>
            <el-checkbox v-model="filterChecks.has_commission" size="small" @change="loadData">有佣金</el-checkbox>
            <el-checkbox v-model="filterChecks.is_duplex" size="small" @change="loadData">复式</el-checkbox>
          </div>
          <div class="filter-actions">
            <el-button type="primary" size="small" @click="loadData"><i class="fas fa-search me-1"></i>筛选</el-button>
            <el-button size="small" @click="resetFilters"><i class="fas fa-redo me-1"></i>重置</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 内容资产列表 -->
    <div class="module-card">
      <div class="list-header-bar">
        <div class="module-title mb-0">
          <i class="fas fa-home"></i>
          <span>内容资产列表</span>
          <span class="badge bg-success ms-2" style="font-size: 12px">共 {{ total }} 条</span>
        </div>
        <div class="list-header-actions">
          <span v-if="selectedIds.length" class="text-muted" style="font-size: 12px; white-space: nowrap">已选 {{ selectedIds.length }} 条</span>
          <div class="sort-bar">
            <span class="sort-label">发布时间：</span>
            <el-button-group size="small">
              <el-button :type="sortOrder === 'desc' ? 'primary' : 'default'" @click="setSortOrder('desc')">
                <i class="fas fa-sort-amount-down me-1"></i>最新在前
              </el-button>
              <el-button :type="sortOrder === 'asc' ? 'primary' : 'default'" @click="setSortOrder('asc')">
                <i class="fas fa-sort-amount-up me-1"></i>最早在前
              </el-button>
            </el-button-group>
          </div>
          <el-dropdown trigger="click">
            <el-button size="small" type="primary" class="btn-purple">
              <i class="fas fa-cog me-1"></i>批量操作<i class="el-icon-arrow-down el-icon--right"></i>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="batchToggleListing('list')"><i class="fas fa-check-circle me-2 text-success"></i>批量上架</el-dropdown-item>
                <el-dropdown-item @click="batchToggleListing('unlist')"><i class="fas fa-times-circle me-2 text-secondary"></i>批量下架</el-dropdown-item>
                <el-dropdown-item divided @click="batchDelete"><i class="fas fa-trash me-2 text-danger"></i>批量删除</el-dropdown-item>
                <el-dropdown-item divided @click="showRecycleBin = true"><i class="fas fa-recycle me-2 text-info"></i>回收站</el-dropdown-item>
                <el-dropdown-item @click="batchRedownloadAllMedia"><i class="fas fa-cloud-download-alt me-2 text-warning"></i>批量下载外部图片</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <div class="table-scroll-wrap" v-loading="loading">
        <el-table ref="propertyTableRef" :data="properties" stripe border size="small" @selection-change="handleSelectionChange"
                  @sort-change="onPublishTimeSortChange"
                  :header-cell-style="{background:'#F5F5F5',fontWeight:600}" :max-height="tableMaxHeight" style="width: 100%">
          <el-table-column type="selection" width="40" />
          <el-table-column label="操作" width="72" fixed="left" class-name="col-op" align="center">
            <template #default="{row}">
              <el-dropdown trigger="click" placement="bottom-start">
                <el-button size="small" type="primary" plain class="op-dropdown-btn">
                  操作<i class="fas fa-chevron-down ms-1" style="font-size:10px"></i>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu class="op-dropdown-menu">
                    <el-dropdown-item @click="viewDetail(row)"><i class="fas fa-eye me-2" style="color:#909399"></i>详情</el-dropdown-item>
                    <el-dropdown-item @click="openEdit(row)"><i class="fas fa-edit me-2" style="color:#E6A23C"></i>编辑</el-dropdown-item>
                    <el-dropdown-item @click="toggleListing(row)">
                      <i :class="row.is_listed === 0 ? 'fas fa-check-circle me-2 text-success' : 'fas fa-times-circle me-2 text-secondary'"></i>
                      {{ row.is_listed === 0 ? '上架' : '下架' }}
                    </el-dropdown-item>
                    <el-dropdown-item divided @click="deleteOne(row)"><i class="fas fa-trash me-2 text-danger"></i>删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </el-table-column>
          <el-table-column label="媒体" width="92" class-name="col-media-cell">
            <template #default="{row}">
              <div class="media-cell-stack">
                <div class="media-thumb-box">
                  <template v-if="getMediaCount(row) > 0 && getFirstMedia(row)">
                    <div v-if="isVideoUrl(getFirstMedia(row))" class="video-thumb-wrap">
                      <i class="fas fa-play-circle"></i>
                    </div>
                    <el-image
                      v-else
                      :src="getFirstMedia(row)"
                      class="media-table-thumb"
                      fit="cover"
                      :preview-src-list="getAllMediaUrls(row).filter(u => !isVideoUrl(u))"
                      :z-index="9999"
                      preview-teleported
                      hide-on-click-modal
                    >
                      <template #error>
                        <div class="no-media">
                          <img v-if="defaultPropertyImage" :src="defaultPropertyImage" class="no-media-img" alt="" />
                          <i v-else class="fas fa-image"></i>
                        </div>
                      </template>
                    </el-image>
                  </template>
                  <div v-else class="no-media">
                    <img v-if="defaultPropertyImage" :src="defaultPropertyImage" class="no-media-img" alt="" />
                    <i v-else class="fas fa-image"></i>
                  </div>
                </div>
                <span class="media-count-badge" :class="{ 'has-media': getMediaCount(row) > 0 }">{{ getMediaCount(row) }}张</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="内容资产描述" min-width="220">
            <template #default="{row}">
              <div class="content-cell">
                <div class="content-text" :class="{ 'content-collapsed': !row._expanded }">{{ row.description || '-' }}</div>
                <span v-if="(row.description || '').length > 100" class="content-toggle" @click="row._expanded = !row._expanded">{{ row._expanded ? '收起' : '展开' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="community" label="小区" width="130" show-overflow-tooltip />
          <el-table-column label="价格" width="100">
            <template #default="{row}">
              <template v-if="row.price && row.price.includes('(售)')">
                <div class="price-sale-wrap">
                  <el-tag size="small" type="danger" effect="dark" class="sale-tag">售</el-tag>
                  <span class="cell-price-sale-value">{{ row.price.replace('(售)', '') }}</span>
                </div>
              </template>
              <template v-else-if="row.price_value && row.price_value > 0">
                <span class="cell-price">¥{{ Number(row.price_value).toLocaleString() }}<span class="cell-price-unit">/月</span></span>
              </template>
              <template v-else-if="row.price">
                <span class="cell-price">{{ row.price }}</span>
              </template>
              <span v-else class="cell-empty">-</span>
            </template>
          </el-table-column>
          <el-table-column label="卧" width="50" align="center">
            <template #default="{row}">
              <span class="cell-num">{{ row.bedrooms || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="卫" width="50" align="center">
            <template #default="{row}">
              <span class="cell-num">{{ row.bathrooms || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="复式" width="50" align="center">
            <template #default="{row}">
              <span v-if="row.is_duplex" class="badge-yes">是</span>
              <span v-else class="badge-gray">否</span>
            </template>
          </el-table-column>
          <el-table-column label="户外" width="100" align="center">
            <template #default="{row}">
              <div v-if="row.outdoor_features && row.outdoor_features !== '0' && row.outdoor_features !== 'null'" class="outdoor-tags">
                <span v-for="feat in splitOutdoor(row.outdoor_features)" :key="feat" class="badge-outdoor" :class="outdoorClass(feat)">{{ feat }}</span>
              </div>
              <span v-else class="cell-empty">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="district" label="区域" width="80" show-overflow-tooltip />
          <el-table-column prop="publisher_name" label="发布人" width="100" show-overflow-tooltip />
          <el-table-column prop="contact_info" label="联系方式" width="120" show-overflow-tooltip />
          <el-table-column prop="property_code" label="编号" width="100" show-overflow-tooltip />
          <el-table-column label="电梯" width="50" align="center">
            <template #default="{row}">
              <span v-if="row.has_elevator" class="badge-green">有</span>
              <span v-else class="badge-gray">无</span>
            </template>
          </el-table-column>
          <el-table-column label="车位" width="50" align="center">
            <template #default="{row}">
              <span v-if="row.has_parking" class="badge-green">有</span>
              <span v-else class="badge-gray">无</span>
            </template>
          </el-table-column>
          <el-table-column label="佣金" width="50" align="center">
            <template #default="{row}">
              <span v-if="row.has_commission" class="badge-orange">有</span>
              <span v-else class="badge-gray">无</span>
            </template>
          </el-table-column>
          <el-table-column prop="metro_lines" label="地铁线路" width="100" show-overflow-tooltip />
          <el-table-column prop="metro_stations" label="地铁站点" width="100" show-overflow-tooltip />
          <el-table-column prop="publish_time" label="发布时间" width="168" sortable="custom" :sort-orders="['descending', 'ascending']">
            <template #default="{row}">{{ formatTime(row.moment_publish_time || row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="采集来源" width="120">
            <template #default="{row}">
              <span v-if="row.robot_nickname" class="robot-badge"><i class="fas fa-robot me-1"></i>{{ row.robot_nickname }}</span>
              <span v-else class="cell-empty">-</span>
            </template>
          </el-table-column>
          <el-table-column label="采集用户" width="120">
            <template #default="{row}">
              <span v-if="row.user_display_name" class="user-badge"><i class="fas fa-user me-1"></i>{{ row.user_display_name }}</span>
              <span v-else class="cell-empty">-</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="pagination-container">
        <div class="text-muted small">共 {{ total }} 条内容资产</div>
        <div class="d-flex align-items-center gap-3">
          <el-select v-model="pageSize" size="small" style="width:100px" @change="loadData">
            <el-option :value="10" label="10条/页" /><el-option :value="25" label="25条/页" />
            <el-option :value="50" label="50条/页" /><el-option :value="100" label="100条/页" />
          </el-select>
          <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total"
                         layout="prev, pager, next" @current-change="loadData" />
        </div>
      </div>
    </div>

      </el-tab-pane>

      <!-- 发布设置Tab -->
      <el-tab-pane label="发布设置" name="settings">
        <div class="module-card">
          <div class="publish-settings-header">
            <h3 class="publish-settings-title"><i class="fas fa-cog me-2"></i>内容资产库发布设置</h3>
            <p class="publish-settings-desc">配置内容资产库数据来源：选择好友和时间范围，内容资产将直接从朋友圈数据解析列表获取</p>
          </div>
          <div class="publish-settings-body">
            <div class="setting-section">
              <label class="setting-label"><i class="fas fa-users me-1"></i>选择好友（数据来源）</label>
              <p class="setting-hint">选择后，内容资产库将仅显示这些好友发布的内容资产数据，不再需要手动从朋友圈同步发布</p>
              <el-select v-model="publishSettingsForm.selected_friends" multiple filterable clearable
                         placeholder="请选择好友（可多选）" style="width: 100%"
                         collapse-tags :max-collapse-tags="5">
                <el-option v-for="f in publishers" :key="f" :label="f" :value="f" />
              </el-select>
            </div>
            <div class="setting-section">
              <label class="setting-label"><i class="fas fa-calendar-alt me-1"></i>发布时间筛选</label>
              <p class="setting-hint">通过快捷按钮快速选择时间范围，或手动指定日期范围，默认显示近3天数据</p>
              <div class="time-quick-btns mb-3">
                <el-radio-group v-model="publishSettingsForm.time_quick" size="small" @change="onTimeQuickChange">
                  <el-radio-button :value="0">今天</el-radio-button>
                  <el-radio-button :value="3">近3天</el-radio-button>
                  <el-radio-button :value="7">近7天</el-radio-button>
                  <el-radio-button :value="30">近30天</el-radio-button>
                </el-radio-group>
              </div>
              <div class="time-range-row">
                <el-date-picker v-model="publishSettingsForm.time_start" type="date" placeholder="开始日期"
                                value-format="YYYY-MM-DD" style="flex:1" @change="onManualDateChange" />
                <span class="range-sep">至</span>
                <el-date-picker v-model="publishSettingsForm.time_end" type="date" placeholder="结束日期"
                                value-format="YYYY-MM-DD" style="flex:1" @change="onManualDateChange" />
              </div>
              <div v-if="publishSettingsForm.time_quick" class="time-quick-hint mt-2">
                <i class="fas fa-info-circle me-1"></i>
                已选择快捷筛选：{{ timeQuickLabel }}
              </div>
            </div>
            <div class="setting-actions">
              <el-button type="primary" class="btn-purple" :loading="publishSettingsSaving" @click="savePublishSettings">
                <i class="fas fa-save me-1"></i>保存设置
              </el-button>
              <el-button @click="resetPublishSettings">
                <i class="fas fa-redo me-1"></i>重置
              </el-button>
            </div>
            <div v-if="publishSettingsForm.selected_friends.length" class="selected-friends-preview">
              <div class="preview-title">当前选中 {{ publishSettingsForm.selected_friends.length }} 位好友：</div>
              <div class="preview-tags">
                <el-tag v-for="f in publishSettingsForm.selected_friends" :key="f" closable size="small"
                        @close="removePublishFriend(f)" type="primary" effect="light" class="friend-tag">
                  <i class="fas fa-user me-1"></i>{{ f }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 内容资产详情弹窗 -->
    <el-dialog v-model="showDetail" title="内容资产详情" width="800px" top="5vh">
      <div v-if="detailData" class="detail-content">
        <div class="row mb-3" v-if="detailData.media_urls && detailData.media_urls.length">
          <div class="col-12">
            <div class="media-gallery">
              <template v-for="(url, idx) in getAllMediaUrlsFromDetail()" :key="idx">
                <video v-if="isVideoUrl(url)" :src="url" controls style="width:140px;height:100px;border-radius:6px;margin:4px;object-fit:cover;background:#000" />
                <el-image v-else :src="url" style="width:100px;height:70px;border-radius:6px;margin:4px" fit="cover"
                          :preview-src-list="getAllMediaUrlsFromDetail().filter(u => !isVideoUrl(u))"
                          :z-index="9999" />
              </template>
            </div>
          </div>
        </div>
        <table class="table table-sm table-bordered">
          <tr><td class="fw-bold" width="100">小区</td><td>{{ detailData.community || '-' }}</td><td class="fw-bold" width="100">价格</td><td class="price-tag">{{ detailData.price || '-' }}</td></tr>
          <tr><td class="fw-bold">卧室</td><td>{{ detailData.bedrooms || '-' }}</td><td class="fw-bold">卫生间</td><td>{{ detailData.bathrooms || '-' }}</td></tr>
          <tr><td class="fw-bold">区域</td><td>{{ detailData.district || '-' }}</td><td class="fw-bold">街道</td><td>{{ detailData.street || '-' }}</td></tr>
          <tr><td class="fw-bold">面积</td><td>{{ detailData.area_sqm ? detailData.area_sqm + '㎡' : '-' }}</td><td class="fw-bold">楼层</td><td>{{ detailData.floor_info || '-' }}</td></tr>
          <tr><td class="fw-bold">发布人</td><td>{{ detailData.publisher_name || '-' }}</td><td class="fw-bold">联系方式</td><td>{{ detailData.contact_info || '-' }}</td></tr>
          <tr><td class="fw-bold">编号</td><td>{{ detailData.property_code || '-' }}</td><td class="fw-bold">地铁</td><td>{{ detailData.metro_lines || '-' }}</td></tr>
          <tr><td class="fw-bold">电梯</td><td>{{ detailData.has_elevator ? '有' : '无' }}</td><td class="fw-bold">车位</td><td>{{ detailData.has_parking ? '有' : '无' }}</td></tr>
          <tr><td class="fw-bold">户外</td><td>{{ detailData.outdoor_features || '-' }}</td><td class="fw-bold">复式</td><td>{{ detailData.is_duplex ? '是' : '否' }}</td></tr>
        </table>
        <div class="mt-3">
          <label class="fw-bold">内容资产描述：</label>
          <div class="property-desc-full">{{ detailData.description || '无描述' }}</div>
        </div>
      </div>
    </el-dialog>

    <!-- 编辑内容资产弹窗 -->
    <el-dialog v-model="showEdit" title="编辑内容资产" width="900px" top="3vh" destroy-on-close>
      <div v-if="editForm" class="edit-form-content">
        <el-form :model="editForm" label-width="80px" size="small">
          <div class="edit-section-title"><i class="fas fa-info-circle me-1"></i>基本信息</div>
          <div class="edit-row">
            <el-form-item label="小区">
              <el-input v-model="editForm.community" placeholder="小区名称" />
            </el-form-item>
            <el-form-item label="区域">
              <el-select v-model="editForm.district" placeholder="选择区域" clearable filterable style="width:100%">
                <el-option v-for="d in allDistricts" :key="d" :label="d" :value="d" />
              </el-select>
            </el-form-item>
          </div>
          <div class="edit-row">
            <el-form-item label="月租金(元/月)">
              <el-input-number
                v-model="editForm.price_value"
                :min="0"
                :max="99999999"
                :controls="false"
                class="edit-price-input"
                style="width:100%"
                placeholder="请输入月租金"
              />
              <div class="form-item-hint text-muted">保存后自动写入「价格」文案为 ¥…/月；出售等特殊标价请写在描述里</div>
            </el-form-item>
            <el-form-item label="面积(㎡)">
              <el-input-number v-model="editForm.area_sqm" :min="0" :max="99999" :precision="1" controls-position="right" style="width:100%" />
            </el-form-item>
          </div>
          <div class="edit-row edit-row-3">
            <el-form-item label="卧室">
              <el-input-number v-model="editForm.bedrooms" :min="0" :max="20" controls-position="right" style="width:100%" />
            </el-form-item>
            <el-form-item label="客厅">
              <el-input-number v-model="editForm.livingrooms" :min="0" :max="10" controls-position="right" style="width:100%" />
            </el-form-item>
            <el-form-item label="卫生间">
              <el-input-number v-model="editForm.bathrooms" :min="0" :max="20" controls-position="right" style="width:100%" />
            </el-form-item>
          </div>
          <div class="edit-row">
            <el-form-item label="楼层">
              <el-input v-model="editForm.floor_info" placeholder="如：3/18" />
            </el-form-item>
          </div>

          <div class="edit-section-title"><i class="fas fa-map-marker-alt me-1"></i>位置信息</div>
          <div class="edit-row">
            <el-form-item label="街道">
              <el-input v-model="editForm.street" placeholder="街道地址" />
            </el-form-item>
          </div>
          <div class="edit-row">
            <el-form-item label="地铁线路">
              <el-select v-model="editMetroLineIds" placeholder="选择地铁线路" multiple clearable filterable collapse-tags :max-collapse-tags="3" style="width:100%" @change="onMetroLineChange">
                <el-option v-for="line in metroLineOptions" :key="line.id" :label="line.name_cn" :value="line.id">
                  <span class="metro-dot-option" :style="{ background: line.line_color || '#999' }"></span>
                  <span>{{ line.name_cn }}</span>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="地铁站点">
              <el-select v-model="editMetroStationIds" placeholder="选择地铁站点" multiple clearable filterable collapse-tags :max-collapse-tags="3" style="width:100%" @change="onMetroStationChange">
                <el-option-group v-for="line in filteredStationGroups" :key="line.id" :label="line.name_cn">
                  <el-option v-for="station in line.stations" :key="station.id" :label="station.name_cn" :value="station.id" />
                </el-option-group>
              </el-select>
            </el-form-item>
          </div>
          <div class="edit-row">
            <el-form-item label="纬度">
              <el-input v-model="editForm.latitude" placeholder="31.xxxxxx" @change="onCoordsChange" />
            </el-form-item>
            <el-form-item label="经度">
              <el-input v-model="editForm.longitude" placeholder="121.xxxxxx" @change="onCoordsChange" />
            </el-form-item>
          </div>
          <div class="locate-btn-row">
            <el-button type="primary" size="small" :loading="locating" @click="handleAutoLocate">
              <i class="fas fa-crosshairs me-1"></i> 一键定位
            </el-button>
            <span v-if="locateMsg" :class="['locate-msg', locateMsgType]">{{ locateMsg }}</span>
          </div>
          <div class="edit-map-container">
            <div class="edit-map-hint">
              <i class="fas fa-mouse-pointer me-1"></i>点击地图可更新经纬度坐标
            </div>
            <div ref="editMapRef" class="edit-map-box"></div>
          </div>

          <div class="edit-section-title"><i class="fas fa-user me-1"></i>发布人信息</div>
          <div class="edit-row">
            <el-form-item label="发布人">
              <el-input v-model="editForm.publisher_name" placeholder="发布人名称" />
            </el-form-item>
            <el-form-item label="联系方式">
              <el-input v-model="editForm.contact_info" placeholder="联系电话/微信" />
            </el-form-item>
          </div>

          <div class="edit-section-title"><i class="fas fa-tags me-1"></i>内容资产特征</div>
          <div class="edit-row edit-row-4">
            <el-form-item label="电梯">
              <el-switch v-model="editForm.has_elevator" :active-value="1" :inactive-value="0" />
            </el-form-item>
            <el-form-item label="车位">
              <el-switch v-model="editForm.has_parking" :active-value="1" :inactive-value="0" />
            </el-form-item>
            <el-form-item label="佣金">
              <el-switch v-model="editForm.has_commission" :active-value="1" :inactive-value="0" />
            </el-form-item>
            <el-form-item label="复式">
              <el-switch v-model="editForm.is_duplex" :active-value="1" :inactive-value="0" />
            </el-form-item>
          </div>
          <div class="edit-row">
            <el-form-item label="装修">
              <el-input v-model="editForm.decoration" placeholder="如：精装修" />
            </el-form-item>
            <el-form-item label="朝向">
              <el-input v-model="editForm.orientation" placeholder="如：南北通透" />
            </el-form-item>
          </div>
          <el-form-item label="户外特征">
            <el-input v-model="editForm.outdoor_features" placeholder="如：阳台/花园/露台" />
          </el-form-item>

          <div class="edit-section-title"><i class="fas fa-align-left me-1"></i>描述信息</div>
          <el-form-item label="内容资产标题">
            <el-input v-model="editForm.title" placeholder="内容资产标题" />
          </el-form-item>
          <el-form-item label="内容资产描述">
            <el-input v-model="editForm.description" type="textarea" :rows="4" placeholder="详细描述" />
          </el-form-item>

          <div class="edit-section-title"><i class="fas fa-cog me-1"></i>状态信息</div>
          <div class="edit-row">
            <el-form-item label="内容资产编号">
              <el-input v-model="editForm.property_code" placeholder="自动生成" />
            </el-form-item>
            <el-form-item label="上架状态">
              <el-switch v-model="editForm.is_listed" :active-value="1" :inactive-value="0" active-text="上架" inactive-text="下架" />
            </el-form-item>
          </div>
        </el-form>

        <div class="edit-media-section">
          <div class="edit-section-title">
            <i class="fas fa-images me-1"></i>媒体文件 ({{ editMediaUrls.length }})
            <el-button v-if="hasExternalMedia" size="small" type="warning" style="margin-left:12px" :loading="redownloading" @click="redownloadMedia">
              <i class="fas fa-cloud-download-alt me-1"></i>重新下载外部图片
            </el-button>
          </div>
          <div v-if="hasExternalMedia && !redownloading" class="text-warning" style="font-size:12px;margin-bottom:8px">
            <i class="fas fa-exclamation-triangle me-1"></i>部分图片来自微信临时链接，可能已过期。点击"重新下载外部图片"尝试下载到本地。
          </div>
          <div v-if="editMediaUrls.length" class="edit-media-tip">拖动媒体卡片即可调整顺序，第一张图片会作为内容资产封面。</div>
          <div class="edit-media-gallery">
            <div
              v-for="(url, idx) in editMediaUrls"
              :key="`${url}-${idx}`"
              class="edit-media-item"
              :class="{ 'is-cover': idx === 0, 'is-dragging': editDraggingIndex === idx }"
              draggable="true"
              @dragstart="handleEditMediaDragStart(idx)"
              @dragover.prevent
              @drop.prevent="handleEditMediaDrop(idx)"
              @dragend="handleEditMediaDragEnd"
            >
              <video v-if="isVideoUrl(url)" :src="url" style="width:80px;height:60px;border-radius:4px;object-fit:cover" muted></video>
              <el-image v-else :src="url" style="width:80px;height:60px;border-radius:4px" fit="cover" :preview-src-list="editMediaUrls.filter(u => !isVideoUrl(u))">
                <template #error>
                  <div style="width:80px;height:60px;border-radius:4px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;flex-direction:column">
                    <i class="fas fa-unlink" style="color:#ccc;font-size:16px"></i>
                    <span style="font-size:10px;color:#bbb;margin-top:2px">已过期</span>
                  </div>
                </template>
              </el-image>
              <span class="edit-media-badge">{{ idx === 0 ? '封面' : `#${idx + 1}` }}</span>
              <el-button size="small" type="danger" circle class="edit-media-remove" @click="removeEditMedia(idx)">
                <i class="fas fa-times"></i>
              </el-button>
            </div>
            <div class="edit-media-upload-btn">
              <el-upload
                action=""
                :http-request="handleMediaUpload"
                :show-file-list="false"
                accept="image/*,video/*"
                :before-upload="beforeMediaUpload"
              >
                <div class="upload-trigger">
                  <i class="fas fa-plus"></i>
                  <span>上传</span>
                </div>
              </el-upload>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showEdit = false">取消</el-button>
        <el-button type="primary" class="btn-purple" @click="saveEdit" :loading="editSaving">
          <i class="fas fa-save me-1"></i>保存修改
        </el-button>
      </template>
    </el-dialog>

    <!-- 回收站弹窗 -->
    <el-dialog v-model="showRecycleBin" title="回收站" width="800px">
      <el-table :data="recycleBinData" stripe size="small" v-loading="recycleBinLoading">
        <el-table-column type="selection" width="40" />
        <el-table-column prop="community" label="小区" width="120" />
        <el-table-column prop="price" label="价格" width="100" />
        <el-table-column prop="district" label="区域" width="80" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="deleted_at" label="删除时间" width="160" />
        <el-table-column label="操作" width="100">
          <template #default="{row}">
            <el-button size="small" type="success" @click="restoreProperty([row.id])">恢复</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="showRecycleBin = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick, watch } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const properties = ref([])
const loading = ref(false)
const statsLoading = ref(true)
const page = ref(1)
const pageSize = ref(25)
const total = ref(0)
const selectedIds = ref([])
const showDetail = ref(false)
const detailData = ref(null)
const showRecycleBin = ref(false)
const recycleBinData = ref([])
const recycleBinLoading = ref(false)
const publishers = ref([])
const stats = reactive({ total: 0, sentCount: 0, userCount: 0, todayCount: 0 })
const showEdit = ref(false)
const editForm = ref(null)
const editSaving = ref(false)
const editMediaUrls = ref([])
const editDraggingIndex = ref(-1)
const redownloading = ref(false)
const defaultPropertyImage = ref('')
const hasExternalMedia = computed(() => editMediaUrls.value.some(u => isExternalUrl(u)))
const editingId = ref(null)

const activeTab = ref('library')
const publishSettingsForm = reactive({ selected_friends: [], time_start: '', time_end: '', time_quick: 3 })
const publishSettingsSaving = ref(false)

const editMapRef = ref(null)
let editMapInstance = null
let editMapMarker = null
let editMapConfig = null
const locating = ref(false)
const locateMsg = ref('')
const locateMsgType = ref('')

const districts = [
  '静安', '黄浦', '徐汇', '长宁', '普陀', '虹口', '杨浦',
  '闵行', '浦东', '宝山', '嘉定', '松江', '青浦', '奉贤', '金山', '崇明'
]
const allDistricts = [
  '静安区', '黄浦区', '徐汇区', '长宁区', '普陀区', '虹口区', '杨浦区',
  '闵行区', '浦东新区', '宝山区', '嘉定区', '松江区', '青浦区', '奉贤区', '金山区', '崇明区',
  '静安', '黄浦', '徐汇', '长宁', '普陀', '虹口', '杨浦',
  '闵行', '浦东', '宝山', '嘉定', '松江', '青浦', '奉贤', '金山', '崇明'
]

const metroLineOptions = ref([])
const metroStationOptions = ref([])
const editMetroLineIds = ref([])
const editMetroStationIds = ref([])

const filteredStationGroups = computed(() => {
  if (!editMetroLineIds.value.length) return metroLineOptions.value.map(line => ({
    ...line,
    stations: metroStationOptions.value.filter(s => s.line_id === line.id)
  })).filter(g => g.stations.length > 0)
  return metroLineOptions.value.filter(l => editMetroLineIds.value.includes(l.id)).map(line => ({
    ...line,
    stations: metroStationOptions.value.filter(s => s.line_id === line.id)
  })).filter(g => g.stations.length > 0)
})

function onMetroLineChange() {
  const selectedLines = metroLineOptions.value.filter(l => editMetroLineIds.value.includes(l.id))
  editForm.value.metro_lines = selectedLines.map(l => l.name_cn).join(',')
  const validLineIds = editMetroLineIds.value
  editMetroStationIds.value = editMetroStationIds.value.filter(sid => {
    const station = metroStationOptions.value.find(s => s.id === sid)
    return station && validLineIds.includes(station.line_id)
  })
  onMetroStationChange()
}

function onMetroStationChange() {
  const selectedStations = metroStationOptions.value.filter(s => editMetroStationIds.value.includes(s.id))
  editForm.value.metro_stations = selectedStations.map(s => s.name_cn).join(',')
}

async function loadMetroData() {
  try {
    const [linesRes, stationsRes] = await Promise.all([
      api.get('/admin/property-settings/metro-lines'),
      api.get('/admin/property-settings/metro-stations')
    ])
    const linesRaw = linesRes.data
    metroLineOptions.value = Array.isArray(linesRaw) ? linesRaw : (linesRaw?.data || linesRaw?.lines || [])
    const stationsRaw = stationsRes.data
    metroStationOptions.value = Array.isArray(stationsRaw) ? stationsRaw : (stationsRaw?.data || stationsRaw?.stations || [])
  } catch { /* ignore */ }
}

function isVideoUrl(url) {
  if (!url) return false
  return /\.(mp4|mov|avi|m4v|webm|mkv)(\?|$)/i.test(url) || url.includes('video.qq.com')
}

function isExternalUrl(url) {
  if (!url) return false
  return /qpic\.cn|video\.qq\.com|wx\.qlogo\.cn|mmbiz\.qpic\.cn/.test(url)
}

async function redownloadMedia() {
  if (!editingId.value) return
  redownloading.value = true
  try {
    const res = await api.post(`/admin/property-library/${editingId.value}/redownload-media`)
    const data = res.data?.data || res.data || {}
    if (data.media_urls && Array.isArray(data.media_urls)) {
      editMediaUrls.value = data.media_urls.filter(Boolean)
      ElMessage.success(`媒体下载完成：${data.downloaded || 0}张成功，${data.failed || 0}张失败`)
    } else {
      ElMessage.info(data.message || '无外部媒体需要下载')
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '下载失败')
  } finally {
    redownloading.value = false
  }
}

async function loadDefaultPropertyImage() {
  try {
    const res = await api.get('/admin/property-library/default-image')
    const data = res.data?.data || res.data || {}
    defaultPropertyImage.value = data.url || ''
  } catch { /* ignore */ }
}

async function loadPublishSettings() {
  try {
    const res = await api.get('/admin/property-library/publish-settings')
    const data = res.data?.data || res.data || {}
    publishSettingsForm.selected_friends = Array.isArray(data.selected_friends) ? data.selected_friends : []
    publishSettingsForm.time_start = data.time_start || ''
    publishSettingsForm.time_end = data.time_end || ''
    publishSettingsForm.time_quick = (data.time_quick !== undefined && data.time_quick !== null) ? Number(data.time_quick) : 3
  } catch { /* ignore */ }
}

async function savePublishSettings() {
  publishSettingsSaving.value = true
  try {
    await api.post('/admin/property-library/publish-settings', {
      selected_friends: publishSettingsForm.selected_friends,
      time_start: publishSettingsForm.time_start,
      time_end: publishSettingsForm.time_end,
      time_quick: publishSettingsForm.time_quick,
    })
    ElMessage.success('发布设置保存成功，内容资产库数据将按新设置筛选')
    loadData()
    loadStats()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  }
  publishSettingsSaving.value = false
}

function resetPublishSettings() {
  publishSettingsForm.selected_friends = []
  publishSettingsForm.time_start = ''
  publishSettingsForm.time_end = ''
  publishSettingsForm.time_quick = 3
}

function removePublishFriend(name) {
  publishSettingsForm.selected_friends = publishSettingsForm.selected_friends.filter(f => f !== name)
}

const timeQuickLabel = computed(() => {
  const map = { 0: '今天', 3: '近3天', 7: '近7天', 30: '近30天' }
  return map[publishSettingsForm.time_quick] || '全部'
})

function onTimeQuickChange(val) {
  if (!val) return
  const now = new Date()
  const end = now.toISOString().slice(0, 10)
  let start
  if (val === 0) {
    start = end
  } else {
    const d = new Date(now.getTime() - val * 86400000)
    start = d.toISOString().slice(0, 10)
  }
  publishSettingsForm.time_start = start
  publishSettingsForm.time_end = end
}

function onManualDateChange() {
  publishSettingsForm.time_quick = null
}

async function batchRedownloadAllMedia() {
  try {
    await ElMessageBox.confirm(
      '将为所有包含外部链接的上架内容资产重新下载媒体文件到本地，可能需要较长时间，是否继续？',
      '批量下载外部图片',
      { confirmButtonText: '开始下载', cancelButtonText: '取消', type: 'warning' }
    )
  } catch { return }

  ElMessage.info('开始批量下载，请稍候...')
  try {
    const res = await api.post('/admin/property-library/batch-redownload-media', {}, { timeout: 300000 })
    const data = res.data?.data || res.data || {}
    ElMessage.success(`批量下载完成：处理${data.total || 0}条，成功${data.downloaded || 0}张，失败${data.failed || 0}张`)
    loadData()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '批量下载失败')
  }
}

function beforeMediaUpload(file) {
  const isValid = file.type.startsWith('image/') || file.type.startsWith('video/')
  if (!isValid) {
    ElMessage.error('只能上传图片或视频文件')
    return false
  }
  const maxSize = 200 * 1024 * 1024
  if (file.size > maxSize) {
    ElMessage.error('文件大小不能超过200MB')
    return false
  }
  return true
}

async function handleMediaUpload(options) {
  const formData = new FormData()
  formData.append('file', options.file)
  try {
    const res = await api.post('/admin/property-library/upload-media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })
    const data = res.data || res
    const url = data?.url || data?.data?.url
    if (url) {
      editMediaUrls.value.push(url)
      ElMessage.success('上传成功')
    } else {
      ElMessage.error('上传失败：未返回URL')
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '上传失败')
  }
}

const moreFilterOpen = ref(false)
const tableMaxHeight = ref('calc(100vh - 300px)')
const sortOrder = ref('desc')
const propertyTableRef = ref(null)
const sortingProgrammatically = ref(false)

/** 表头「发布时间」排序箭头与当前 sortOrder 同步（服务端排序） */
function syncPublishTimeColumnSort() {
  nextTick(() => {
    const tb = propertyTableRef.value
    if (!tb || typeof tb.sort !== 'function') return
    sortingProgrammatically.value = true
    try {
      tb.sort('publish_time', sortOrder.value === 'asc' ? 'ascending' : 'descending')
    } finally {
      nextTick(() => { sortingProgrammatically.value = false })
    }
  })
}

function onPublishTimeSortChange({ prop, order }) {
  if (prop !== 'publish_time') return
  if (sortingProgrammatically.value) return
  let next = 'desc'
  if (order === 'ascending') next = 'asc'
  else if (order === 'descending') next = 'desc'
  sortOrder.value = next
  page.value = 1
  loadData()
}

function onListSortSelectChange() {
  page.value = 1
  loadData()
}

function setSortOrder(order) {
  sortOrder.value = order
  page.value = 1
  loadData()
}

const priceOptions = [
  1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
  12000, 15000, 18000, 20000, 25000, 30000, 35000, 40000, 50000,
  60000, 80000, 100000, 150000, 200000, 300000, 500000
]

const timeOptions = [
  { label: '今天', days: 0 },
  { label: '近3天', days: 3 },
  { label: '近7天', days: 7 },
  { label: '近15天', days: 15 },
  { label: '近30天', days: 30 },
  { label: '全部', days: -1 }
]

const filters = reactive({
  search: '', district: [], bedrooms: [], price_min: '', price_max: '',
  property_codes: '', metro_lines: '', metro_stations: '',
  publisher: '', publish_time_start: '', publish_time_end: '',
  outdoor_features: [], exclude_keywords: '', time_quick: -1,
  listing_status: 'listed'
})
const filterChecks = reactive({ has_elevator: false, has_parking: false, has_commission: false, is_duplex: false })

const listingStatusOptions = [
  { label: '已上架', value: 'listed' },
  { label: '已下架', value: 'unlisted' },
  { label: '全部', value: 'all' }
]

onMounted(() => {
  loadData()
  loadStats()
  loadPublishers()
  loadMetroData()
  loadDefaultPropertyImage()
  loadPublishSettings()
})

function formatPriceLabel(val) {
  if (val >= 10000) return (val / 10000) + '万'
  return val.toLocaleString()
}

const mobilePriceLabel = computed(() => {
  if (filters.price_min && filters.price_max) return `${formatPriceLabel(filters.price_min)}-${formatPriceLabel(filters.price_max)}`
  if (filters.price_min) return `${formatPriceLabel(filters.price_min)}起`
  if (filters.price_max) return `${formatPriceLabel(filters.price_max)}以内`
  return '价格'
})

function setQuickTime(days) {
  filters.time_quick = days
  if (days < 0) {
    filters.publish_time_start = ''
    filters.publish_time_end = ''
  } else if (days === 0) {
    const today = new Date().toISOString().slice(0, 10)
    filters.publish_time_start = today
    filters.publish_time_end = today
  } else {
    const now = new Date()
    const start = new Date(now.getTime() - days * 86400000)
    filters.publish_time_start = start.toISOString().slice(0, 10)
    filters.publish_time_end = now.toISOString().slice(0, 10)
  }
  loadData()
}

function splitOutdoor(val) {
  if (!val || val === '0' || val === 'null') return []
  return String(val).split(/[,，、]/).map(s => s.trim()).filter(Boolean)
}

function outdoorClass(feat) {
  if (/花园/.test(feat)) return 'od-garden'
  if (/阳台/.test(feat)) return 'od-balcony'
  if (/露台/.test(feat)) return 'od-terrace'
  if (/院/.test(feat)) return 'od-yard'
  return ''
}

async function loadData() {
  loading.value = true
  try {
    const bedroomsVal = Array.isArray(filters.bedrooms) ? filters.bedrooms.join(',') : filters.bedrooms
    const outdoorVal = Array.isArray(filters.outdoor_features) ? filters.outdoor_features.join(',') : filters.outdoor_features
    const districtParam = Array.isArray(filters.district) ? filters.district.filter(Boolean).join(',') : filters.district
    const params = {
      page: page.value, pageSize: pageSize.value,
      search: filters.search,
      district: districtParam,
      bedrooms: bedroomsVal,
      price_min: filters.price_min,
      price_max: filters.price_max,
      property_codes: filters.property_codes,
      metro_lines: filters.metro_lines,
      metro_stations: filters.metro_stations,
      publisher: filters.publisher,
      listing_status: filters.listing_status,
      publish_time_start: filters.publish_time_start,
      publish_time_end: filters.publish_time_end,
      outdoor_features: outdoorVal,
      exclude_keywords: filters.exclude_keywords,
      has_elevator: filterChecks.has_elevator ? '1' : '',
      has_parking: filterChecks.has_parking ? '1' : '',
      has_commission: filterChecks.has_commission ? '1' : '',
      is_duplex: filterChecks.is_duplex ? '1' : '',
      sort_order: sortOrder.value
    }
    Object.keys(params).forEach(k => { if (params[k] === '' || params[k] === null || params[k] === undefined) delete params[k] })

    const res = await api.get('/admin/property-library', { params })
    if (Array.isArray(res.data)) {
      properties.value = res.data
      total.value = 0
    } else {
      properties.value = res.data?.data || res.data || []
      total.value = res.data?.total || res.data?.pagination?.total || 0
    }
  } catch (e) {
    console.error('加载内容资产列表失败:', e)
  }
  loading.value = false
  syncPublishTimeColumnSort()
}

async function loadStats() {
  statsLoading.value = true
  try {
    const res = await api.get('/admin/property-library/stats')
    const data = res.data?.data || res.data || {}
    if (data) Object.assign(stats, data)
  } catch {}
  statsLoading.value = false
}

async function loadPublishers() {
  try {
    const res = await api.get('/admin/property-library/publishers')
    const data = res.data?.data || res.data || []
    publishers.value = Array.isArray(data) ? data : []
  } catch {}
}

function resetFilters() {
  filters.search = ''
  filters.district = []
  filters.bedrooms = []
  filters.price_min = ''
  filters.price_max = ''
  filters.property_codes = ''
  filters.metro_lines = ''
  filters.metro_stations = ''
  filters.publisher = ''
  filters.listing_status = 'listed'
  filters.publish_time_start = ''
  filters.publish_time_end = ''
  filters.outdoor_features = []
  filters.exclude_keywords = ''
  filters.time_quick = -1
  filterChecks.has_elevator = false
  filterChecks.has_parking = false
  filterChecks.has_commission = false
  filterChecks.is_duplex = false
  page.value = 1
  loadData()
}

function handleSelectionChange(rows) {
  selectedIds.value = rows.map(r => r.id)
}

function selectAll() {
  selectedIds.value = properties.value.map(p => p.id)
}

function deselectAll() {
  selectedIds.value = []
}

async function viewDetail(row) {
  try {
    const res = await api.get(`/admin/property-library/${row.id}`)
    detailData.value = res.data?.data || res.data || row
    showDetail.value = true
  } catch {
    detailData.value = row
    showDetail.value = true
  }
}

async function toggleListing(row) {
  try {
    await api.put(`/admin/property-library/${row.id}/toggle-listing`)
    ElMessage.success(row.is_listed === 0 ? '已上架' : '已下架')
    loadData()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '操作失败')
  }
}

async function deleteOne(row) {
  try {
    await ElMessageBox.confirm('确定删除该内容资产？删除后可在回收站恢复', '确认', { type: 'warning' })
    await api.delete(`/admin/property-library/${row.id}`)
    ElMessage.success('删除成功')
    loadData()
    loadStats()
  } catch {}
}

async function batchDelete() {
  if (!selectedIds.value.length) return ElMessage.warning('请先选择内容资产')
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 条内容资产？`, '确认', { type: 'warning' })
    await api.post('/admin/property-library/batch-delete', { ids: selectedIds.value })
    ElMessage.success('批量删除成功')
    selectedIds.value = []
    loadData()
    loadStats()
  } catch {}
}

async function batchToggleListing(action) {
  if (!selectedIds.value.length) return ElMessage.warning('请先选择内容资产')
  try {
    await api.post('/admin/property-library/batch-toggle-listing', { ids: selectedIds.value, action })
    ElMessage.success(`批量${action === 'list' ? '上架' : '下架'}成功`)
    loadData()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '操作失败')
  }
}

async function restoreProperty(ids) {
  try {
    await api.post('/admin/property-library/restore', { ids })
    ElMessage.success('恢复成功')
    loadRecycleBin()
    loadData()
    loadStats()
  } catch (e) {
    ElMessage.error('恢复失败')
  }
}

async function loadRecycleBin() {
  recycleBinLoading.value = true
  try {
    const res = await api.get('/admin/property-library/recycle-bin')
    const data = res.data?.data || res.data || []
    recycleBinData.value = Array.isArray(data) ? data : []
  } catch {}
  recycleBinLoading.value = false
}

function loadAmapScript(key, securityKey) {
  return new Promise((resolve, reject) => {
    if (window.AMap) { resolve(window.AMap); return }
    window._AMapSecurityConfig = { securityJsCode: securityKey }
    const s = document.createElement('script')
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.Scale,AMap.ToolBar,AMap.Geocoder`
    s.onload = () => resolve(window.AMap)
    s.onerror = () => reject(new Error('高德地图加载失败'))
    document.head.appendChild(s)
  })
}

async function loadMapConfig() {
  if (editMapConfig) return editMapConfig
  try {
    const res = await api.get('/admin/expatshome/map-settings')
    const d = res.data?.data || res.data || {}
    const s = d.settings || d
    editMapConfig = {
      js_api_key: s.amap_js_api_key || s.js_api_key || '',
      security_js_key: s.amap_security_js_key || s.security_js_key || '',
    }
    return editMapConfig
  } catch { return null }
}

async function initEditMap() {
  const cfg = await loadMapConfig()
  if (!cfg?.js_api_key) return
  try {
    const AMap = await loadAmapScript(cfg.js_api_key, cfg.security_js_key)
    if (editMapInstance) { editMapInstance.destroy(); editMapInstance = null; editMapMarker = null }
    if (!editMapRef.value) return

    const lat = Number(editForm.value?.latitude)
    const lng = Number(editForm.value?.longitude)
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
    const center = hasCoords ? [lng, lat] : [121.4737, 31.2304]
    const zoom = hasCoords ? 15 : 11

    editMapInstance = new AMap.Map(editMapRef.value, {
      zoom, center, resizeEnable: true, viewMode: '2D',
    })

    if (hasCoords) {
      editMapMarker = new AMap.Marker({ position: center, draggable: true })
      editMapInstance.add(editMapMarker)
      editMapMarker.on('dragend', (e) => {
        const pos = editMapMarker.getPosition()
        editForm.value.latitude = pos.lat.toFixed(6)
        editForm.value.longitude = pos.lng.toFixed(6)
      })
    }

    editMapInstance.on('click', (e) => {
      const clickLng = e.lnglat.getLng()
      const clickLat = e.lnglat.getLat()
      editForm.value.latitude = clickLat.toFixed(6)
      editForm.value.longitude = clickLng.toFixed(6)
      if (editMapMarker) {
        editMapMarker.setPosition([clickLng, clickLat])
      } else {
        editMapMarker = new AMap.Marker({ position: [clickLng, clickLat], draggable: true })
        editMapInstance.add(editMapMarker)
        editMapMarker.on('dragend', () => {
          const pos = editMapMarker.getPosition()
          editForm.value.latitude = pos.lat.toFixed(6)
          editForm.value.longitude = pos.lng.toFixed(6)
        })
      }
    })
  } catch (e) {
    console.error('编辑地图初始化失败:', e)
  }
}

function onCoordsChange() {
  if (!editMapInstance || !window.AMap) return
  const lat = Number(editForm.value?.latitude)
  const lng = Number(editForm.value?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return
  editMapInstance.setCenter([lng, lat])
  editMapInstance.setZoom(15)
  if (editMapMarker) {
    editMapMarker.setPosition([lng, lat])
  } else {
    editMapMarker = new window.AMap.Marker({ position: [lng, lat], draggable: true })
    editMapInstance.add(editMapMarker)
    editMapMarker.on('dragend', () => {
      const pos = editMapMarker.getPosition()
      editForm.value.latitude = pos.lat.toFixed(6)
      editForm.value.longitude = pos.lng.toFixed(6)
    })
  }
}

async function handleAutoLocate() {
  if (!editForm.value) return
  locating.value = true
  locateMsg.value = ''
  locateMsgType.value = ''

  try {
    const community = editForm.value.community || ''
    const street = editForm.value.street || ''
    if (!community && !street) {
      locateMsg.value = '请先填写小区名称或街道地址'
      locateMsgType.value = 'warn'
      locating.value = false
      return
    }

    const params = {}
    if (community) params.community = community
    if (street) params.street = street
    if (editForm.value.district) params.district = editForm.value.district

    const res = await api.get('/admin/property-library/geocode-community', { params })
    const data = res.data?.data || res.data

    if (data && data.latitude && data.longitude) {
      editForm.value.latitude = String(data.latitude)
      editForm.value.longitude = String(data.longitude)
      locateMsg.value = `已定位: ${data.community || community} (${data.source === 'poi' ? 'POI精确匹配' : 'POI模糊匹配'})`
      locateMsgType.value = 'ok'
      onCoordsChange()
    } else {
      if (window.AMap && editMapInstance) {
        const geocodeAddr = `上海市${editForm.value.district || ''}${community}${street}`
        try {
          await geocodeByAmap(geocodeAddr)
          return
        } catch {}
      }
      locateMsg.value = '未找到匹配的经纬度，请手动在地图上点击定位'
      locateMsgType.value = 'warn'
    }
  } catch (err) {
    locateMsg.value = '定位失败: ' + (err?.message || '未知错误')
    locateMsgType.value = 'err'
  }
  locating.value = false
}

function geocodeByAmap(address) {
  return new Promise((resolve, reject) => {
    if (!window.AMap) return reject(new Error('地图未加载'))
    window.AMap.plugin('AMap.Geocoder', () => {
      const geocoder = new window.AMap.Geocoder({ city: '上海' })
      geocoder.getLocation(address, (status, result) => {
        if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
          const loc = result.geocodes[0].location
          editForm.value.latitude = loc.lat.toFixed(6)
          editForm.value.longitude = loc.lng.toFixed(6)
          locateMsg.value = `已通过地址定位: ${address}`
          locateMsgType.value = 'ok'
          onCoordsChange()
          locating.value = false
          resolve()
        } else {
          locateMsg.value = '地址定位失败，请手动在地图上点击定位'
          locateMsgType.value = 'warn'
          locating.value = false
          reject(new Error('geocode failed'))
        }
      })
    })
  })
}

async function autoFillCoordsFromPOI() {
  if (!editForm.value) return
  const lat = Number(editForm.value.latitude)
  const lng = Number(editForm.value.longitude)
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) return
  const community = editForm.value.community
  if (!community) return
  try {
    const res = await api.get('/admin/property-library/geocode-community', { params: { community } })
    const data = res.data?.data || res.data
    if (data && data.latitude && data.longitude) {
      editForm.value.latitude = String(data.latitude)
      editForm.value.longitude = String(data.longitude)
    }
  } catch {}
}

async function openEdit(row) {
  try {
    const res = await api.get(`/admin/property-library/${row.id}`)
    const data = res.data?.data || res.data || row
    editingId.value = row.id
    editForm.value = {
      community: data.community || '',
      title: data.title || '',
      district: data.district || '',
      price_value: data.price_value != null && data.price_value !== '' ? Number(data.price_value) : 0,
      bedrooms: data.bedrooms || 0,
      livingrooms: data.livingrooms || 0,
      bathrooms: data.bathrooms || 0,
      area_sqm: data.area_sqm || null,
      floor_info: data.floor_info || '',
      street: data.street || '',
      metro_lines: data.metro_lines || '',
      metro_stations: data.metro_stations || '',
      latitude: data.latitude || '',
      longitude: data.longitude || '',
      publisher_name: data.publisher_name || '',
      contact_info: data.contact_info || '',
      has_elevator: data.has_elevator ? 1 : 0,
      has_parking: data.has_parking ? 1 : 0,
      has_commission: data.has_commission ? 1 : 0,
      is_duplex: data.is_duplex ? 1 : 0,
      decoration: data.decoration || '',
      orientation: data.orientation || '',
      outdoor_features: data.outdoor_features || '',
      description: data.description || '',
      property_code: data.property_code || '',
      is_listed: data.is_listed ? 1 : 0,
    }
    let urls = data.media_urls || row.media_urls || []
    if (typeof urls === 'string') {
      try { urls = JSON.parse(urls) } catch { urls = [] }
    }
    editMediaUrls.value = (Array.isArray(urls) ? urls : []).map(u => typeof u === 'string' ? u : (u?.url || u?.thumb || '')).filter(Boolean)

    const lineNames = (data.metro_lines || '').split(/[,，、]/).map(s => s.trim()).filter(Boolean)
    editMetroLineIds.value = metroLineOptions.value.filter(l => lineNames.includes(l.name_cn)).map(l => l.id)
    const stationNames = (data.metro_stations || '').split(/[,，、]/).map(s => s.trim()).filter(Boolean)
    editMetroStationIds.value = metroStationOptions.value.filter(s => stationNames.includes(s.name_cn)).map(s => s.id)

    locateMsg.value = ''
    locateMsgType.value = ''
    showEdit.value = true
    nextTick(async () => {
      await autoFillCoordsFromPOI()
      setTimeout(() => initEditMap(), 300)
    })
  } catch (e) {
    ElMessage.error('加载内容资产详情失败')
  }
}

function removeEditMedia(idx) {
  editMediaUrls.value.splice(idx, 1)
}

function handleEditMediaDragStart(idx) {
  editDraggingIndex.value = idx
}

function handleEditMediaDrop(targetIdx) {
  const sourceIdx = editDraggingIndex.value
  if (sourceIdx < 0 || sourceIdx === targetIdx) return
  const next = [...editMediaUrls.value]
  const [moved] = next.splice(sourceIdx, 1)
  next.splice(targetIdx, 0, moved)
  editMediaUrls.value = next
}

function handleEditMediaDragEnd() {
  editDraggingIndex.value = -1
}

async function saveEdit() {
  if (!editForm.value || !editingId.value) return
  editSaving.value = true
  try {
    const payload = { ...editForm.value, media_urls: editMediaUrls.value }
    delete payload.price
    const pv = Number(payload.price_value)
    if (Number.isFinite(pv) && pv > 0) {
      payload.price = `¥${pv.toLocaleString()}/月`
    }
    await api.put(`/admin/property-library/${editingId.value}`, payload)
    ElMessage.success('保存成功')
    showEdit.value = false
    loadData()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  }
  editSaving.value = false
}

function getFirstMedia(row) {
  const urls = row.media_urls
  if (!urls || !urls.length) return null
  const allResolved = urls.map(u => typeof u === 'string' ? u : (u?.thumb || u?.url || '')).filter(Boolean)
  const firstImage = allResolved.find(u => !isVideoUrl(u))
  if (firstImage) return firstImage
  return allResolved[0] || null
}

function getAllMediaUrls(row) {
  const urls = row.media_urls
  if (!urls || !urls.length) return []
  return urls.map(u => typeof u === 'string' ? u : (u?.url || u?.thumb || '')).filter(Boolean)
}

function getAllMediaUrlsFromDetail() {
  if (!detailData.value?.media_urls) return []
  return detailData.value.media_urls.map(u => typeof u === 'string' ? u : (u?.url || u?.thumb || '')).filter(Boolean)
}

function getMediaCount(row) {
  const urls = row.media_urls
  if (!urls || !Array.isArray(urls) || !urls.length) return 0
  return urls.length
}

function formatNumber(n) {
  return (n || 0).toLocaleString()
}

function formatTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

watch(showRecycleBin, (val) => { if (val) loadRecycleBin() })
watch(showEdit, (val) => {
  if (!val && editMapInstance) {
    editMapInstance.destroy()
    editMapInstance = null
    editMapMarker = null
  }
})

watch(activeTab, (val) => {
  if (val === 'settings') {
    loadPublishers()
    loadPublishSettings()
  }
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

/* 统计卡片网格 */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.stats-card {
  background: white; border-radius: 12px; padding: 16px 20px; text-align: center;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06); transition: all 0.3s ease; min-width: 0;
}
.stats-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
.stats-card .stats-icon { font-size: 20px; color: #3498db; margin-bottom: 6px; }
.stats-card .value { font-size: 1.5rem; font-weight: 700; color: #333; line-height: 1.2; }
.stats-card .label { font-size: 12px; color: #999; margin-top: 4px; }

/* 模块卡片 */
.module-card {
  background: white; border-radius: 12px; padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-bottom: 20px;
}
.module-title {
  font-size: 15px; font-weight: 600; color: #333; margin-bottom: 12px;
  display: flex; align-items: center; gap: 8px;
}
.module-title i { color: #9C27B0; }

/* ========== 筛选区域 ========== */
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
.filter-grid-time { grid-template-columns: auto 1fr; }
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
.filter-inline-sort { flex: 0 1 auto; }
.sort-inline-select { width: 200px; max-width: 100%; }
.filter-inline-row .filter-actions { margin-left: auto; flex-shrink: 0; }
.inline-label { font-size: 11px; color: #888; font-weight: 500; white-space: nowrap; }
.quick-time-btns { display: flex; gap: 4px; flex-wrap: wrap; }
.quick-time-btn {
  padding: 3px 10px; font-size: 11px; border: 1px solid #ddd; background: white;
  border-radius: 12px; cursor: pointer; transition: all 0.2s; color: #666;
}
.quick-time-btn:hover { border-color: #9C27B0; color: #9C27B0; }
.quick-time-btn.active { background: #9C27B0; color: white; border-color: #9C27B0; }
.w-100 { width: 100%; }

/* 列表操作栏 */
.list-header-bar {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 12px; flex-wrap: wrap; gap: 8px;
}
.list-header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex-shrink: 0; }
.sort-bar { display: flex; align-items: center; gap: 6px; }
.sort-label { font-size: 12px; color: #888; white-space: nowrap; }

/* 表格横向滚动 */
.table-scroll-wrap { width: 100%; overflow-x: auto; overflow-y: visible; -webkit-overflow-scrolling: touch; }
.table-scroll-wrap::-webkit-scrollbar { height: 7px; }
.table-scroll-wrap::-webkit-scrollbar-track { background: #f0f0f0; border-radius: 4px; }
.table-scroll-wrap::-webkit-scrollbar-thumb { background: #bbb; border-radius: 4px; }
.table-scroll-wrap::-webkit-scrollbar-thumb:hover { background: #9C27B0; }

/* 操作列按钮 */
.op-dropdown-btn { padding: 3px 8px !important; font-size: 12px !important; min-height: 26px !important; line-height: 1.2 !important; white-space: nowrap; }
.op-dropdown-menu .el-dropdown-menu__item { font-size: 13px; padding: 8px 16px; line-height: 1.4; display: flex; align-items: center; }

/* 表格单元格样式 */
.cell-price { color: #e74c3c; font-weight: 600; font-size: 13px; }
.price-sale-wrap { display: flex; align-items: center; gap: 4px; }
.cell-price-sale-value { color: #f56c6c; font-weight: 700; font-size: 13px; text-decoration: line-through; }
.sale-tag { font-size: 10px !important; letter-spacing: 0; flex-shrink: 0; }
.cell-price-unit { color: #999; font-size: 10px; font-weight: 400; }
.cell-num { font-weight: 600; color: #333; }
.cell-empty { color: #ccc; font-size: 11px; }

/* 标签样式 */
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
.outdoor-tags { display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; }
.badge-outdoor {
  display: inline-block; padding: 0 5px; border-radius: 3px; font-size: 10px; font-weight: 500;
  line-height: 18px; white-space: nowrap; background: #F3E5F5; color: #7B1FA2; border: 1px solid #E1BEE7;
}
.badge-outdoor.od-garden { background: #E8F5E9; color: #2E7D32; border-color: #C8E6C9; }
.badge-outdoor.od-balcony { background: #E3F2FD; color: #1565C0; border-color: #BBDEFB; }
.badge-outdoor.od-terrace { background: #FFF3E0; color: #E65100; border-color: #FFE0B2; }
.badge-outdoor.od-yard { background: #FCE4EC; color: #AD1457; border-color: #F8BBD0; }
.user-badge { background: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; white-space: nowrap; }
.robot-badge { background: #e8f5e9; color: #388e3c; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; white-space: nowrap; }

/* 文案折叠 */
.content-cell { position: relative; }
.content-text { font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; color: #333; }
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
.pagination-container { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #E5E5E5; flex-wrap: wrap; gap: 12px; }

/* 按钮 */
.btn-purple { background: #667eea !important; border-color: #667eea !important; color: white !important; }
.btn-purple:hover { background: #5a6fd6 !important; border-color: #5a6fd6 !important; }

/* 媒体和编辑 */
.no-media { width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; background: #f0f0f7; border-radius: 6px; color: #667eea; font-size: 20px; }
.property-desc-full { white-space: pre-wrap; word-break: break-word; line-height: 1.6; font-size: 14px; background: #f8f9fa; padding: 12px; border-radius: 8px; max-height: 300px; overflow-y: auto; }
.media-gallery { display: flex; flex-wrap: wrap; }
.detail-content .table td { padding: 6px 10px; vertical-align: middle; }

/* 通用工具类 */
.d-flex { display: flex; }
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.mb-3 { margin-bottom: 16px; }
.mb-4 { margin-bottom: 24px; }
.mb-0 { margin-bottom: 0; }
.ms-2 { margin-left: 8px; }
.me-1 { margin-right: 4px; }
.me-2 { margin-right: 8px; }
.mt-3 { margin-top: 16px; }
.fw-bold { font-weight: 600; }
.text-muted { color: #999; }
.text-success { color: #27AE60; }
.text-danger { color: #EB5757; }
.text-secondary { color: #999; }
.text-info { color: #2F80ED; }
.small { font-size: 0.85rem; }
.opacity-75 { opacity: 0.75; }
.align-items-center { align-items: center; }
.align-items-start { align-items: flex-start; }
.justify-content-between { justify-content: space-between; }
.flex-wrap { flex-wrap: wrap; }

/* 编辑弹窗 */
.edit-form-content { max-height: calc(80vh - 120px); overflow-y: auto; padding-right: 8px; }
.edit-section-title { font-size: 0.95rem; font-weight: 600; color: #667eea; margin: 16px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #667eea20; display: flex; align-items: center; }
.edit-section-title:first-child { margin-top: 0; }
.form-item-hint { font-size: 11px; line-height: 1.4; margin-top: 6px; color: #909399; }
.edit-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.edit-row-3 { grid-template-columns: 1fr 1fr 1fr; }
.edit-row-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
.edit-media-section { margin-top: 16px; }
.edit-media-tip { margin-bottom: 10px; color: #6b7280; font-size: 12px; }
.edit-media-gallery { display: flex; flex-wrap: wrap; gap: 8px; }
.edit-media-item {
  position: relative;
  cursor: grab;
  border: 2px solid transparent;
  border-radius: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.edit-media-item:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12); }
.edit-media-item.is-cover { border-color: #22c55e; }
.edit-media-item.is-dragging { opacity: 0.55; cursor: grabbing; }
.edit-media-badge {
  position: absolute;
  left: 6px;
  bottom: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
.edit-media-remove { position: absolute; top: -6px; right: -6px; width: 20px !important; height: 20px !important; padding: 0 !important; font-size: 10px; }
.edit-media-upload-btn { display: flex; align-items: center; justify-content: center; }
.upload-trigger { width: 80px; height: 60px; border: 2px dashed #ddd; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s; color: #999; font-size: 11px; gap: 2px; }
.upload-trigger:hover { border-color: #667eea; color: #667eea; }
.upload-trigger i { font-size: 18px; }
.metro-dot-option { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; flex-shrink: 0; }
.locate-btn-row { display: flex; align-items: center; gap: 12px; padding: 0 0 8px 80px; }
.locate-msg { font-size: 12px; }
.locate-msg.ok { color: #27AE60; }
.locate-msg.warn { color: #E67E22; }
.locate-msg.err { color: #EB5757; }
.edit-map-container { margin: 0 0 12px; padding: 0 0 0 80px; }
.edit-map-hint { font-size: 12px; color: #999; margin-bottom: 6px; }
.edit-map-hint i { color: #667eea; }
.edit-map-box { width: 100%; height: 280px; border-radius: 8px; border: 1px solid #e0e0e0; overflow: hidden; }

/* 移动端筛选栏 */
.m-filter-bar { background: #fff; border-radius: 10px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); overflow: hidden; }
.m-filter-scroll { display: flex; gap: 6px; padding: 8px 10px; overflow-x: auto; -webkit-overflow-scrolling: touch; align-items: center; }
.m-filter-scroll::-webkit-scrollbar { display: none; }
.m-filter-sel { flex-shrink: 0; width: 80px !important; }
.m-filter-sel :deep(.el-input__wrapper) { padding: 0 6px; }
.m-filter-sel :deep(.el-input__inner) { font-size: 12px; }
.m-filter-more-btn {
  flex-shrink: 0; border: 1px solid #ddd; background: #fff; color: #666;
  padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer;
  display: flex; align-items: center; gap: 3px; white-space: nowrap; transition: all 0.2s;
}
.m-filter-more-btn.active { border-color: #667eea; color: #667eea; background: #f0f3ff; }
.m-filter-expand { padding: 8px 10px; border-top: 1px solid #f0f0f0; background: #fafbfc; }
.m-filter-expand-row { display: flex; gap: 8px; margin-bottom: 8px; }
.m-filter-kw { width: 100%; }
.m-filter-half { flex: 1; min-width: 0; }
.m-filter-checks { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.m-filter-checks :deep(.el-checkbox__label) { font-size: 12px; }
.m-filter-commission-check { flex-shrink: 0; white-space: nowrap; }
.m-filter-commission-check :deep(.el-checkbox__label) { font-size: 12px; padding-left: 4px; }
.m-filter-btn {
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 3px;
  padding: 5px 10px; border-radius: 16px; font-size: 12px; white-space: nowrap;
  background: #f5f5f5; border: 1px solid #e0e0e0; color: #555; cursor: pointer; transition: all 0.2s;
}
.m-filter-btn:active { background: #eee; }
.m-filter-btn.active { background: #eef0ff; border-color: #7c5cfc; color: #7c5cfc; font-weight: 600; }
.m-price-panel { display: flex; flex-direction: column; gap: 8px; }
.m-price-row { display: flex; align-items: center; gap: 8px; }
.m-price-label { font-size: 12px; color: #666; white-space: nowrap; width: 50px; }
.m-price-sel { flex: 1; }
.m-price-confirm { width: 100%; margin-top: 4px; }

/* 加载动画 */
.loading-pulse { animation: pulse-anim 1.2s ease-in-out infinite; color: #ddd !important; }
@keyframes pulse-anim { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

/* 响应式断点 */
@media (max-width: 1200px) {
  .filter-grid-5 { grid-template-columns: repeat(3, 1fr); }
  .filter-grid-time { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .filter-grid-5 { grid-template-columns: repeat(2, 1fr); }
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
  .d-md-none { display: block; }
  .d-none.d-md-block { display: none !important; }
}
@media (min-width: 768px) {
  .d-md-none { display: none !important; }
  .d-none.d-md-block { display: block; }
}

/* Tab样式 */
.property-lib-tabs { margin-bottom: 0; }
.property-lib-tabs :deep(.el-tabs__header) { margin-bottom: 16px; border-bottom: none; }
.property-lib-tabs :deep(.el-tabs__nav) { border: none; }
.property-lib-tabs :deep(.el-tabs__item) {
  border: 1px solid #ddd; border-radius: 8px 8px 0 0; padding: 0 20px;
  font-size: 14px; font-weight: 500; color: #666; background: #f8f9fa; transition: all 0.3s;
}
.property-lib-tabs :deep(.el-tabs__item.is-active) {
  background: white; color: #667eea; border-bottom-color: white; font-weight: 600;
}
.property-lib-tabs :deep(.el-tabs__item:hover) { color: #667eea; }

/* 发布设置 */
.publish-settings-header { padding-bottom: 16px; border-bottom: 1px solid #f0f0f0; margin-bottom: 20px; }
.publish-settings-title { font-size: 16px; font-weight: 600; color: #333; margin: 0 0 6px 0; }
.publish-settings-title i { color: #667eea; }
.publish-settings-desc { font-size: 13px; color: #999; margin: 0; }
.publish-settings-body { max-width: 700px; }
.setting-section { margin-bottom: 24px; }
.setting-label { display: block; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 4px; }
.setting-label i { color: #667eea; }
.setting-hint { font-size: 12px; color: #999; margin: 0 0 8px 0; }
.time-range-row { display: flex; align-items: center; gap: 8px; }
.setting-actions { display: flex; gap: 12px; margin-top: 8px; padding-top: 20px; border-top: 1px dashed #eee; }
.time-quick-btns { display: flex; align-items: center; }
.time-quick-btns :deep(.el-radio-button__inner) { border-radius: 4px !important; margin-right: 4px; }
.time-quick-btns :deep(.el-radio-button:first-child .el-radio-button__inner) { border-radius: 4px !important; }
.time-quick-btns :deep(.el-radio-button:last-child .el-radio-button__inner) { border-radius: 4px !important; }
.time-quick-hint { font-size: 12px; color: #909399; }
.time-quick-hint i { color: #667eea; }
.selected-friends-preview { margin-top: 20px; padding: 16px; background: #f8f9fa; border-radius: 8px; }
.preview-title { font-size: 13px; font-weight: 500; color: #666; margin-bottom: 8px; }
.preview-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.friend-tag { border-radius: 12px; }

/* 媒体列：缩略图与张数上下排列，避免徽章与缩略图盖住相邻列文字；预览挂到 body 避免表格层叠异常 */
.media-cell-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 72px;
  max-width: 100%;
  box-sizing: border-box;
  padding: 4px 0;
}
.media-thumb-box {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: #f0f0f7;
}
.media-table-thumb { width: 60px !important; height: 60px !important; display: block !important; }
.media-cell-stack :deep(.el-image) { width: 60px; height: 60px; display: block; }
.media-cell-stack .video-thumb-wrap {
  width: 60px; height: 60px; border-radius: 6px;
  background: #111; display: flex; align-items: center; justify-content: center;
}
.media-cell-stack .video-thumb-wrap i { color: rgba(255,255,255,0.85); font-size: 22px; }
.media-count-badge {
  position: static;
  display: inline-block;
  background: rgba(0,0,0,0.55); color: white; font-size: 10px;
  padding: 2px 6px; border-radius: 4px; line-height: 1.35;
  pointer-events: none;
  text-align: center;
  max-width: 100%;
  word-break: keep-all;
}
.media-count-badge.has-media { background: rgba(102,126,234,0.9); }
.no-media-img { width: 60px; height: 60px; border-radius: 6px; object-fit: cover; display: block; }
.edit-price-input { width: 100%; }
.edit-price-input :deep(.el-input__inner) { text-align: left; }
</style>
