<template>
  <div>
    <div class="page-header"><h3 class="page-title"><i class="fas fa-cogs me-2"></i>内容资产信息设置</h3></div>
    <el-tabs v-model="activeTab" type="card">
      <!-- 区域管理 -->
      <el-tab-pane label="区域管理" name="districts">
        <div class="card-container">
          <div class="mb-3 d-flex justify-content-between align-items-center">
            <span class="text-muted">共 {{ districts.length }} 个区域</span>
            <el-button type="primary" @click="openDistrictDialog()"><i class="fas fa-plus me-1"></i>添加区域</el-button>
          </div>
          <el-table :data="districts" stripe v-loading="loading" border>
            <el-table-column prop="id" label="ID" width="70" align="center" />
            <el-table-column prop="name_cn" label="中文名" min-width="120" />
            <el-table-column prop="name_en" label="英文名" min-width="120" />
            <el-table-column prop="city" label="城市" width="100" />
            <el-table-column prop="sort_order" label="排序" width="80" align="center" />
            <el-table-column label="操作" width="160" align="center">
              <template #default="{row}">
                <el-button size="small" type="primary" plain @click="openDistrictDialog(row)"><i class="fas fa-edit"></i></el-button>
                <el-button size="small" type="danger" plain @click="deleteDistrict(row.id)"><i class="fas fa-trash"></i></el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 地铁站点（线路+站点合并管理） -->
      <el-tab-pane label="地铁站点" name="metroStations">
        <div class="card-container">
          <!-- 线路管理区域 -->
          <div class="metro-lines-overview">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="metro-section-title">
                <i class="fas fa-subway me-1" style="color:#2F80ED"></i>线路管理
                <el-tag size="small" type="info" effect="plain" style="margin-left:6px">{{ metroLines.length }}条</el-tag>
              </span>
              <el-button type="primary" size="small" @click="openMetroLineDialog()"><i class="fas fa-plus me-1"></i>添加线路</el-button>
            </div>
            <div class="metro-line-chips">
              <div
                v-for="line in metroLines" :key="line.id"
                class="metro-line-chip"
                :class="{ 'is-active': stationLineFilter === line.id }"
                @click="toggleLineFilter(line.id)"
              >
                <span class="chip-color" :style="{ background: line.line_color }"></span>
                <span class="chip-label">{{ line.name_cn }}</span>
                <span class="chip-en">{{ line.name_en }}</span>
                <span class="chip-count">{{ getLineStationCount(line.id) }}站</span>
                <span class="chip-actions" @click.stop>
                  <i class="fas fa-edit chip-action-btn" @click="openMetroLineDialog(line)" title="编辑线路"></i>
                  <i class="fas fa-trash chip-action-btn chip-action-delete" @click="deleteMetroLine(line.id)" title="删除线路"></i>
                </span>
              </div>
            </div>
          </div>

          <el-divider style="margin:16px 0 12px" />

          <!-- 站点列表区域 -->
          <div class="mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div class="d-flex gap-2 align-items-center">
              <el-select v-model="stationLineFilter" placeholder="按线路筛选" clearable style="width:200px" @change="loadStations">
                <el-option v-for="l in metroLines" :key="l.id" :label="l.name_cn" :value="l.id" />
              </el-select>
              <span class="text-muted">共 {{ metroStations.length }} 个站点</span>
            </div>
            <el-button type="primary" @click="openStationDialog()"><i class="fas fa-plus me-1"></i>添加站点</el-button>
          </div>
          <el-table :data="metroStations" stripe v-loading="stationLoading" border>
            <el-table-column prop="id" label="ID" width="70" align="center" />
            <el-table-column prop="name_cn" label="中文名" min-width="120" />
            <el-table-column prop="name_en" label="英文名" min-width="120" />
            <el-table-column label="所属线路" width="160">
              <template #default="{row}">
                <span v-if="getLineName(row.metro_line_id) !== '-'" class="station-line-tag" :style="{ background: getLineColor(row.metro_line_id) }">
                  {{ getLineName(row.metro_line_id) }}
                </span>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="sort_order" label="排序" width="80" align="center" />
            <el-table-column label="操作" width="160" align="center">
              <template #default="{row}">
                <el-button size="small" type="primary" plain @click="openStationDialog(row)"><i class="fas fa-edit"></i></el-button>
                <el-button size="small" type="danger" plain @click="deleteStation(row.id)"><i class="fas fa-trash"></i></el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 小区POI数据 -->
      <el-tab-pane label="小区POI数据" name="communityPOI">
        <div class="card-container poi-card-container">
          <!-- 子Tab切换 -->
          <el-tabs v-model="poiSubTab" class="poi-sub-tabs">
            <!-- ====== 子Tab1: POI数据列表 ====== -->
            <el-tab-pane name="poiList">
              <template #label><i class="fas fa-list me-1"></i>POI数据 <el-tag size="small" type="info" effect="plain" style="margin-left:4px">{{ poiStats.summary?.total || 0 }}</el-tag></template>

              <!-- 操作栏 -->
              <div class="mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div class="d-flex gap-2 align-items-center flex-wrap">
                  <el-input v-model="poiSearch" :placeholder="poiNameOnly ? '搜索小区名' : '搜索小区名/板块/别名'" clearable style="width:200px" size="small" @keyup.enter="loadCommunityPOI" />
                  <el-checkbox v-model="poiNameOnly" size="small" @change="loadCommunityPOI" style="margin-left:2px">仅小区名</el-checkbox>
                  <el-select v-model="poiDistrictFilter" placeholder="筛选区域" clearable style="width:150px" size="small" @change="loadCommunityPOI">
                    <el-option v-for="d in poiDistrictOptions" :key="d.district" :label="`${d.district} (${d.count})`" :value="d.district" />
                  </el-select>
                  <el-select v-model="poiMetroFilter" placeholder="地铁信息" clearable style="width:130px" size="small" @change="loadCommunityPOI">
                    <el-option label="有地铁" value="1" /><el-option label="无地铁" value="0" />
                  </el-select>
                  <el-date-picker
                    v-model="poiDateRange"
                    type="daterange"
                    range-separator="至"
                    start-placeholder="添加开始日期"
                    end-placeholder="添加结束日期"
                    size="small"
                    style="width:260px"
                    value-format="YYYY-MM-DD"
                    :shortcuts="poiDateShortcuts"
                    @change="loadCommunityPOI"
                    clearable
                  />
                  <el-button size="small" type="primary" @click="loadCommunityPOI"><i class="fas fa-search"></i></el-button>
                  <el-button v-if="poiSelectedIds.length > 0" type="danger" size="small" @click="batchDeletePOI">
                    <i class="fas fa-trash me-1"></i>批量删除({{ poiSelectedIds.length }})
                  </el-button>
                </div>
                <div class="d-flex gap-2">
                  <el-button size="small" @click="openPOIRecycleBin"><i class="fas fa-recycle me-1"></i>回收站</el-button>
                  <el-button type="success" size="small" @click="showBatchEnrichDialog"><i class="fas fa-map-marked-alt me-1"></i>高德批量补充</el-button>
                  <el-button type="success" size="small" @click="showImportDialog"><i class="fas fa-file-upload me-1"></i>导入CSV</el-button>
                  <el-button type="warning" size="small" @click="showExcelImportDialog"><i class="fas fa-file-excel me-1"></i>导入Excel</el-button>
                  <el-button type="primary" size="small" @click="openPOIDialog()"><i class="fas fa-plus me-1"></i>添加小区</el-button>
                </div>
              </div>

              <!-- 数据表格 -->
              <el-table :data="communityPOIList" stripe v-loading="poiLoading" border size="small" style="width:100%" @selection-change="rows => poiSelectedIds = rows.map(r => r.id)">
                <el-table-column type="selection" width="45" align="center" />
                <el-table-column prop="id" label="ID" width="60" align="center" />
                <el-table-column prop="community_name" label="小区名" min-width="150" show-overflow-tooltip />
                <el-table-column label="别名" min-width="160" show-overflow-tooltip>
                  <template #default="{row}">
                    <div v-if="row.alias_names" class="alias-tags-cell">
                      <el-tag v-for="(alias, idx) in parseAliases(row.alias_names)" :key="idx" size="small" type="info" effect="plain" class="alias-tag-item">{{ alias }}</el-tag>
                    </div>
                    <span v-else class="text-muted">-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="district" label="区域" width="90" />
                <el-table-column prop="board" label="板块" width="90" show-overflow-tooltip />
                <el-table-column label="经纬度" width="200">
                  <template #default="{row}">
                    <div v-if="row.latitude && parseFloat(row.latitude) !== 0" class="coord-cell">
                      <span class="coord-value">{{ parseFloat(row.latitude).toFixed(6) }}, {{ parseFloat(row.longitude).toFixed(6) }}</span>
                    </div>
                    <span v-else class="text-muted">-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="property_type" label="类型" width="70" />
                <el-table-column label="地铁信息" min-width="180">
                  <template #default="{row}">
                    <div v-if="row.nearest_metro_station" class="metro-info-cell">
                      <span class="metro-line-badge" v-if="row.nearest_metro_line">{{ row.nearest_metro_line }}</span>
                      <span>{{ row.nearest_metro_station }}</span>
                      <small v-if="row.nearest_metro_distance" class="text-muted"> · {{ row.nearest_metro_distance }}米</small>
                    </div>
                    <span v-else class="text-muted">-</span>
                  </template>
                </el-table-column>
                <el-table-column label="参考租金" width="140">
                  <template #default="{row}">
                    <span v-if="row.ref_price_min">¥{{ row.ref_price_min }} ~ ¥{{ row.ref_price_max }}</span>
                    <span v-else class="text-muted">-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="listing_count" label="内容资产数" width="70" align="center" />
                <el-table-column label="来源" width="90">
                  <template #default="{row}">
                    <el-tag size="small" :type="sourceTagType(row.source)" effect="plain">{{ sourceLabel(row.source) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="添加日期" width="120" align="center">
                  <template #default="{row}">
                    <span v-if="row.created_at" style="font-size:12px;color:#606266">{{ formatDate(row.created_at) }}</span>
                    <span v-else class="text-muted">-</span>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="65" align="center">
                  <template #default="{row}">
                    <el-tag :type="row.is_enabled ? 'success' : 'info'" size="small">{{ row.is_enabled ? '启用' : '禁用' }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="180" align="center" fixed="right">
                  <template #default="{row}">
                    <el-tooltip content="高德一键补充" placement="top">
                      <el-button size="small" type="success" plain @click="enrichSinglePOI(row)" :loading="row._enriching">
                        <i class="fas fa-map-marker-alt"></i>
                      </el-button>
                    </el-tooltip>
                    <el-button size="small" type="primary" plain @click="openPOIDialog(row)"><i class="fas fa-edit"></i></el-button>
                    <el-button size="small" type="danger" plain @click="deletePOI(row.id)"><i class="fas fa-trash"></i></el-button>
                  </template>
                </el-table-column>
              </el-table>

              <!-- 分页 -->
              <div class="mt-3 d-flex justify-content-end" v-if="poiTotal > 0">
                <el-pagination
                  v-model:current-page="poiPage"
                  :page-size="poiPageSize"
                  :total="poiTotal"
                  :page-sizes="[20, 50, 100]"
                  layout="total, sizes, prev, pager, next"
                  @current-change="loadCommunityPOI"
                  @size-change="(s) => { poiPageSize = s; loadCommunityPOI() }"
                />
              </div>
            </el-tab-pane>

            <!-- ====== 子Tab2: 数据统计 ====== -->
            <el-tab-pane name="poiDashboard">
              <template #label><i class="fas fa-chart-bar me-1"></i>数据统计</template>

              <!-- 数据总览 -->
              <div class="poi-stats-bar mb-3" v-if="poiStats.summary">
                <div class="stat-item"><span class="stat-num">{{ poiStats.summary.total }}</span><span class="stat-label">总小区数</span></div>
                <div class="stat-item"><span class="stat-num">{{ poiStats.summary.district_count }}</span><span class="stat-label">覆盖区域</span></div>
                <div class="stat-item"><span class="stat-num">{{ poiStats.summary.with_coords }}</span><span class="stat-label">有坐标</span></div>
                <div class="stat-item"><span class="stat-num">{{ poiStats.summary.with_metro }}</span><span class="stat-label">有地铁信息</span></div>
                <div class="stat-item"><span class="stat-num">{{ poiStats.summary.with_price }}</span><span class="stat-label">有价格参考</span></div>
              </div>

              <!-- 新增来源明细统计表 -->
              <div class="poi-time-stats mb-3" v-if="poiStats.sourceBreakdown">
                <div class="time-stats-title"><i class="fas fa-chart-line me-1"></i>新增来源明细</div>
                <el-table :data="sourceTableData" border size="small" class="source-table" show-summary :summary-method="sourceTableSummary">
                  <el-table-column prop="label" label="数据来源" min-width="160">
                    <template #default="{row}">
                      <span class="source-label-cell">
                        <span class="source-dot" :style="{ background: row.color }"></span>
                        <span>{{ row.label }}</span>
                        <el-tag v-if="row.key === 'auto'" type="danger" size="small" effect="plain" style="margin-left:6px">已禁止</el-tag>
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="today" label="今日" width="100" align="center">
                    <template #default="{row}"><span :class="row.data.today > 0 ? 'num-highlight' : 'num-zero'">{{ row.data.today }}</span></template>
                  </el-table-column>
                  <el-table-column prop="week" label="本周" width="100" align="center">
                    <template #default="{row}"><span :class="row.data.week > 0 ? 'num-highlight' : 'num-zero'">{{ row.data.week }}</span></template>
                  </el-table-column>
                  <el-table-column prop="month" label="本月" width="100" align="center">
                    <template #default="{row}"><span :class="row.data.month > 0 ? 'num-highlight' : 'num-zero'">{{ row.data.month }}</span></template>
                  </el-table-column>
                  <el-table-column prop="total" label="总计" width="100" align="center">
                    <template #default="{row}"><span class="num-total">{{ row.data.total }}</span></template>
                  </el-table-column>
                </el-table>
              </div>

              <!-- 删除统计 -->
              <div class="poi-time-stats mb-3" v-if="poiStats.timeStats">
                <div class="time-stats-title"><i class="fas fa-trash-alt me-1"></i>删除统计</div>
                <div class="time-stats-grid time-stats-grid-delete">
                  <div class="time-stat-card-mini">
                    <div class="time-stat-header-mini">今日删除</div>
                    <div class="time-stat-num-mini text-danger-val">{{ poiStats.timeStats.today_deleted || 0 }}</div>
                  </div>
                  <div class="time-stat-card-mini">
                    <div class="time-stat-header-mini">本周删除</div>
                    <div class="time-stat-num-mini text-danger-val">{{ poiStats.timeStats.week_deleted || 0 }}</div>
                  </div>
                  <div class="time-stat-card-mini">
                    <div class="time-stat-header-mini">本月删除</div>
                    <div class="time-stat-num-mini text-danger-val">{{ poiStats.timeStats.month_deleted || 0 }}</div>
                  </div>
                </div>
              </div>

              <!-- 各区域分布 -->
              <div class="poi-district-stats" v-if="poiStats.districts && poiStats.districts.length > 0">
                <div class="time-stats-title"><i class="fas fa-map me-1"></i>区域分布</div>
                <div class="district-stats-grid">
                  <div v-for="d in poiStats.districts" :key="d.district" class="district-stat-item" @click="jumpToDistrict(d.district)">
                    <span class="district-name">{{ d.district || '未知' }}</span>
                    <div class="district-bar-wrap">
                      <div class="district-bar" :style="{ width: Math.max(4, (d.count / (poiStats.summary?.total || 1)) * 100) + '%' }"></div>
                    </div>
                    <span class="district-count">{{ d.count }}</span>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <!-- ====== 子Tab3: 地理别名映射 ====== -->
            <el-tab-pane name="aliasMap">
              <template #label><i class="fas fa-map-signs me-1"></i>地理别名 <el-tag size="small" type="warning" effect="plain" style="margin-left:4px">{{ aliasStats.total || 0 }}</el-tag></template>

              <el-alert type="info" :closable="false" show-icon class="mb-3">
                <template #title>管理商圈、路名、地标、地铁站等非小区名到区域的映射关系，用于朋友圈解析时正确识别区域</template>
              </el-alert>

              <div class="mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div class="d-flex gap-2 align-items-center flex-wrap">
                  <el-input v-model="aliasSearch" placeholder="搜索别名" clearable style="width:180px" size="small" @keyup.enter="loadAliasList" />
                  <el-select v-model="aliasTypeFilter" placeholder="全部类型" clearable style="width:130px" size="small" @change="loadAliasList">
                    <el-option label="地标/商圈" value="landmark" /><el-option label="路名" value="road" />
                    <el-option label="地铁站" value="metro" /><el-option label="区域" value="area" />
                  </el-select>
                  <el-select v-model="aliasDistrictFilter" placeholder="全部区域" clearable filterable style="width:140px" size="small" @change="loadAliasList">
                    <el-option v-for="d in aliasDistrictOptions" :key="d" :label="d" :value="d" />
                  </el-select>
                  <el-button size="small" type="primary" @click="loadAliasList"><i class="fas fa-search"></i></el-button>
                  <span class="text-muted ms-1" style="font-size:12px">
                    地标{{ aliasStats.landmark || 0 }} · 路名{{ aliasStats.road || 0 }} · 地铁{{ aliasStats.metro || 0 }}
                  </span>
                </div>
                <div class="d-flex gap-2">
                  <el-button type="success" size="small" @click="aliasBatchImportVisible = true"><i class="fas fa-file-import me-1"></i>批量导入</el-button>
                  <el-button type="primary" size="small" @click="openAliasDialog()"><i class="fas fa-plus me-1"></i>添加别名</el-button>
                  <el-button type="danger" size="small" :disabled="aliasSelectedIds.length === 0" @click="batchDeleteAlias"><i class="fas fa-trash me-1"></i>批量删除({{ aliasSelectedIds.length }})</el-button>
                </div>
              </div>

              <el-table :data="aliasList" stripe v-loading="aliasLoading" border size="small" style="width:100%" @selection-change="rows => aliasSelectedIds = rows.map(r => r.id)">
                <el-table-column type="selection" width="45" align="center" />
                <el-table-column prop="id" label="ID" width="65" align="center" />
                <el-table-column prop="alias_name" label="别名" min-width="140" show-overflow-tooltip />
                <el-table-column prop="alias_type" label="类型" width="100" align="center">
                  <template #default="{row}">
                    <el-tag :type="aliasTypeTagColor(row.alias_type)" size="small">{{ aliasTypeLabel(row.alias_type) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="district" label="区域" width="100" align="center" />
                <el-table-column prop="priority" label="优先级" width="70" align="center" />
                <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
                  <template #default="{row}">{{ row.remark || '-' }}</template>
                </el-table-column>
                <el-table-column prop="is_enabled" label="状态" width="65" align="center">
                  <template #default="{row}">
                    <el-tag :type="row.is_enabled ? 'success' : 'info'" size="small">{{ row.is_enabled ? '启用' : '禁用' }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="120" align="center" fixed="right">
                  <template #default="{row}">
                    <el-button size="small" type="primary" plain @click="openAliasDialog(row)"><i class="fas fa-edit"></i></el-button>
                    <el-button size="small" type="danger" plain @click="deleteAlias(row.id)"><i class="fas fa-trash"></i></el-button>
                  </template>
                </el-table-column>
              </el-table>

              <div class="mt-3 d-flex justify-content-end" v-if="aliasTotal > 0">
                <el-pagination v-model:current-page="aliasPage" :page-size="aliasPageSize" :total="aliasTotal"
                  :page-sizes="[50, 100, 200]" layout="total, sizes, prev, pager, next"
                  @current-change="loadAliasList" @size-change="(s) => { aliasPageSize = s; loadAliasList() }" />
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-tab-pane>

      <!-- AI解析配置 -->
      <el-tab-pane label="AI解析配置" name="aiConfig">
        <div class="ai-parse-alert">
          <i class="fas fa-info-circle me-2"></i>
          <strong>说明：</strong>配置AI解析内容资产时使用的模型和提示词。AI将自动从内容资产描述中提取价格、户型、面积、地铁等结构化信息。
        </div>
        <div class="ai-parse-layout">
          <!-- 左侧：解析配置 -->
          <div class="ai-parse-left">
            <!-- AI解析总开关 -->
            <div class="ai-card ai-card-primary mb-3">
              <div class="ai-card-header bg-primary"><i class="fas fa-power-off me-2"></i>AI解析总开关</div>
              <div class="ai-card-body d-flex justify-content-between align-items-center">
                <div>
                  <el-switch v-model="aiConfig.ai_parse_enabled" active-value="1" inactive-value="0"
                    :active-text="aiConfig.ai_parse_enabled === '1' ? '已启用' : '已关闭'"
                    style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949" />
                  <div class="text-muted mt-1" style="font-size:12px">
                    <i class="fas fa-exclamation-triangle text-warning me-1"></i>关闭后所有AI解析功能将停止
                  </div>
                </div>
                <el-tag :type="aiConfig.ai_parse_enabled === '1' ? 'success' : 'info'" size="large" effect="dark">
                  <i :class="aiConfig.ai_parse_enabled === '1' ? 'fas fa-check-circle' : 'fas fa-stop-circle'" class="me-1"></i>
                  {{ aiConfig.ai_parse_enabled === '1' ? '运行中' : '已停止' }}
                </el-tag>
              </div>
            </div>

            <!-- 解析配置 -->
            <div class="ai-card mb-3">
              <div class="ai-card-header bg-primary"><i class="fas fa-cog me-2"></i>解析配置</div>
              <div class="ai-card-body">
                <div class="mb-3">
                  <label class="form-label fw-bold">选择AI模型</label>
                  <el-select v-model="aiConfig.ai_parse_model_id" placeholder="选择AI模型" style="width:100%">
                    <el-option value="" label="使用正则表达式提取（无需AI）" />
                    <el-option v-for="m in aiModels" :key="m.id" :label="`${m.model_name} (${m.model_provider || m.model_code})`" :value="String(m.id)" />
                  </el-select>
                  <div class="form-text">选择用于解析内容资产信息的AI模型。如不选择，将使用正则表达式进行基础提取。</div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-bold">轮训候补模型</label>
                  <el-select
                    v-model="aiConfig.ai_parse_model_ids"
                    multiple
                    collapse-tags
                    collapse-tags-tooltip
                    placeholder="可多选：主模型限流/超时自动切换"
                    style="width:100%">
                    <el-option
                      v-for="m in aiModels"
                      :key="`fallback-${m.id}`"
                      :disabled="String(m.id) === String(aiConfig.ai_parse_model_id)"
                      :label="`${m.model_name} (${m.model_provider || m.model_code})`"
                      :value="String(m.id)" />
                  </el-select>
                  <div class="form-text">主模型失败后，按候补模型顺序自动轮训，避免请求超时中断解析。</div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-bold">每批解析数量</label>
                  <el-input-number v-model.number="aiConfig.ai_parse_batch_size_num" :min="10" :max="200" :step="10" style="width:200px" />
                  <div class="form-text">每次批量解析的内容资产数量（10-200）</div>
                </div>

                <!-- 多线程配置 -->
                <div class="ai-card-inner mb-3">
                  <div class="ai-card-inner-header"><i class="fas fa-tachometer-alt me-2"></i>并发解析加速</div>
                  <div class="ai-card-inner-body">
                    <el-checkbox v-model="aiConfig.ai_parse_multi_thread_bool" label="启用并发解析" />
                    <div class="form-text">启用后使用并发请求大幅提升解析速度</div>
                    <div class="d-flex gap-2 align-items-center mt-2">
                      <label class="form-label mb-0">并发线程数</label>
                      <el-input-number v-model.number="aiConfig.ai_parse_thread_count_num" :min="2" :max="16" :step="1" style="width:140px" />
                      <span class="text-muted" style="font-size:12px">2-16个线程</span>
                    </div>
                    <div class="ai-perf-info mt-2">
                      <i class="fas fa-info-circle me-1"></i>
                      <strong>性能提升：</strong>单线程每批50条约需60秒 · 8线程约需8秒 · 16线程约需4秒
                    </div>
                  </div>
                </div>

                <!-- 提示词 -->
                <div class="mb-3">
                  <label class="form-label fw-bold">AI解析提示词模板</label>
                  <el-input v-model="aiConfig.ai_parse_prompt" type="textarea" :rows="16"
                    style="font-family: 'Courier New', monospace; font-size: 13px;"
                    placeholder="提示词中使用 {CONTENT} 作为内容资产描述的占位符..." />
                  <div class="form-text">提示词中使用 <code>{'{CONTENT}'}</code> 作为内容资产描述的占位符。AI将根据此提示词提取信息。</div>
                </div>

                <div class="d-flex justify-content-end gap-2">
                  <el-button @click="resetAIPrompt"><i class="fas fa-undo me-1"></i>恢复默认提示词</el-button>
                  <el-button type="primary" @click="saveAIConfig" :loading="aiSaving"><i class="fas fa-save me-1"></i>保存解析设置</el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧：统计和操作 -->
          <div class="ai-parse-right">
            <div class="ai-card mb-3">
              <div class="ai-card-header bg-success"><i class="fas fa-chart-bar me-2"></i>解析统计</div>
              <div class="ai-card-body">
                <div class="ai-stat-grid">
                  <div class="ai-stat-item"><div class="ai-stat-num">{{ parseStats.total || 0 }}</div><div class="ai-stat-label">总记录</div></div>
                  <div class="ai-stat-item"><div class="ai-stat-num text-success">{{ parseStats.parsed || 0 }}</div><div class="ai-stat-label">已解析</div></div>
                  <div class="ai-stat-item">
                    <div class="ai-stat-num text-warning">{{ parseStats.unparsed_with_content || 0 }}</div>
                    <div class="ai-stat-label">待解析(有原文)</div>
                  </div>
                  <div class="ai-stat-item">
                    <div class="ai-stat-num" style="color:#aaa">{{ parseStats.unparsed_no_content || 0 }}</div>
                    <div class="ai-stat-label">无原文</div>
                  </div>
                  <div class="ai-stat-item"><div class="ai-stat-num text-info">{{ parseStats.has_price || 0 }}</div><div class="ai-stat-label">有价格</div></div>
                  <div class="ai-stat-item"><div class="ai-stat-num text-primary">{{ parseStats.has_community || 0 }}</div><div class="ai-stat-label">有小区</div></div>
                </div>
                <div class="mt-3" v-if="parseStats.total > 0">
                  <div class="ai-progress-label">解析进度</div>
                  <el-progress :percentage="Math.round((parseStats.parsed || 0) / parseStats.total * 100)" :stroke-width="14" />
                </div>
                <!-- 待解析数据时间范围 -->
                <div class="mt-3" v-if="unparsedTimeRange.oldest_created" style="font-size:12px;color:#888;background:#f9f9f9;border-radius:6px;padding:8px 10px">
                  <div><i class="fas fa-clock me-1"></i><strong>待解析记录时间范围：</strong></div>
                  <div style="margin-top:4px">最早：{{ unparsedTimeRange.oldest_created }}</div>
                  <div>最新：{{ unparsedTimeRange.newest_created }}</div>
                </div>
                <!-- 实时运行状态 -->
                <div class="mt-3 runtime-stats" v-if="runtimeStats.lastRun">
                  <div class="runtime-stats-title">
                    <i class="fas fa-sync-alt fa-spin me-1" v-if="runtimeStats.status === 'running' || (runtimeStats.status === 'ok' && runtimeStats.remaining > 0)"></i>
                    <i class="fas fa-check-circle text-success me-1" v-else-if="runtimeStats.status === 'complete'"></i>
                    <i class="fas fa-exclamation-triangle text-warning me-1" v-else-if="runtimeStats.status === 'skipped'"></i>
                    <i class="fas fa-times-circle text-danger me-1" v-else-if="runtimeStats.status === 'error'"></i>
                    <i class="fas fa-server me-1" v-else></i>
                    解析引擎状态
                    <el-tag size="small" :type="runtimeStatusType" style="margin-left:6px">{{ runtimeStatusText }}</el-tag>
                  </div>
                  <!-- running状态额外展示开始时间 -->
                  <div class="runtime-stats-row" v-if="runtimeStats.status === 'running' && runtimeStats.runningStarted">
                    <span>本轮开始：</span><span>{{ formatRuntime(runtimeStats.runningStarted) }}</span>
                  </div>
                  <div class="runtime-stats-row" v-if="runtimeStats.message">
                    <span>说明：</span><span :class="runtimeStats.status === 'error' ? 'text-danger' : ''">{{ runtimeStats.message }}</span>
                  </div>
                  <div class="runtime-stats-row"><span>最后执行：</span><span>{{ formatRuntime(runtimeStats.lastRun) }}</span></div>
                  <div class="runtime-stats-row"><span>上轮处理：</span><span class="text-success">成功 {{ runtimeStats.success || 0 }}/{{ runtimeStats.processed || 0 }} 条</span></div>
                  <div class="runtime-stats-row"><span>并发线程：</span><span>{{ runtimeStats.threadCount || 1 }} 线程</span></div>
                  <div class="runtime-stats-row"><span>上轮耗时：</span><span>{{ runtimeStats.elapsed ? (runtimeStats.elapsed / 1000).toFixed(1) + 's' : '-' }}</span></div>
                  <div class="runtime-stats-row"><span>队列待解析：</span><span class="text-warning">{{ runtimeStats.remaining || 0 }} 条</span></div>
                  <div class="runtime-stats-row" v-if="runtimeStats.remaining > 0 && runtimeStats.processed > 0 && runtimeStats.elapsed > 0">
                    <span>预计完成：</span>
                    <span class="text-info">约 {{ Math.ceil(runtimeStats.remaining / runtimeStats.processed * runtimeStats.elapsed / 60000) }} 分钟</span>
                  </div>
                  <div class="runtime-fail-reasons" v-if="runtimeTopFailReasons.length > 0">
                    <div class="runtime-fail-title">失败原因TOP</div>
                    <div class="runtime-fail-list">
                      <span class="runtime-fail-tag" v-for="(item, idx) in runtimeTopFailReasons" :key="`rt-fail-${idx}`">
                        {{ formatFailReason(item.reason) }} × {{ item.count }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="mt-3 runtime-stats" v-else>
                  <div class="runtime-stats-title"><i class="fas fa-question-circle text-muted me-1"></i>解析引擎状态</div>
                  <div style="color:#999;font-size:12px;padding:6px 0">暂无运行记录，请确保AI解析总开关已开启。</div>
                </div>
              </div>
            </div>

            <!-- 当前模型信息 -->
            <div class="ai-card mb-3" v-if="currentAIModel">
              <div class="ai-card-header bg-info"><i class="fas fa-robot me-2"></i>当前模型</div>
              <div class="ai-card-body" style="font-size:13px">
                <div class="mb-1"><strong>名称：</strong>{{ currentAIModel.model_name }}</div>
                <div class="mb-1"><strong>代码：</strong>{{ currentAIModel.model_code }}</div>
                <div class="mb-1"><strong>提供商：</strong>{{ currentAIModel.model_provider || '-' }}</div>
                <div><strong>状态：</strong>
                  <el-tag :type="currentAIModel.is_enabled ? 'success' : 'info'" size="small">{{ currentAIModel.is_enabled ? '启用' : '禁用' }}</el-tag>
                </div>
              </div>
            </div>

            <!-- 解析日志 -->
            <div class="ai-card mb-3">
              <div class="ai-card-header" style="background:#6c757d;color:#fff">
                <i class="fas fa-list-alt me-2"></i>解析日志
                <span style="float:right;cursor:pointer;font-size:12px" @click="loadParseLogs" title="刷新"><i class="fas fa-sync-alt"></i></span>
              </div>
              <div class="ai-card-body" style="max-height:360px;overflow-y:auto;padding:8px">
                <div v-if="parseLogs.length === 0" style="color:#999;font-size:12px;text-align:center;padding:16px 0">
                  暂无日志记录
                </div>
                <div v-for="(log, idx) in parseLogs" :key="idx" class="parse-log-item" :class="'parse-log-' + (log.level || 'info')">
                  <div class="parse-log-time">{{ formatLogTime(log.t) }}</div>
                  <div class="parse-log-msg">{{ log.message }}</div>
                  <div class="parse-log-meta" v-if="log.processed > 0 || log.remaining > 0">
                    <span v-if="log.success !== undefined">成功:{{ log.success }}</span>
                    <span v-if="log.failed">失败:{{ log.failed }}</span>
                    <span v-if="log.remaining !== undefined">剩余:{{ log.remaining }}</span>
                    <span v-if="log.elapsedMs">耗时:{{ (log.elapsedMs / 1000).toFixed(1) }}s</span>
                    <span v-if="log.threadCount">线程:{{ log.threadCount }}</span>
                  </div>
                  <div class="parse-log-fail-list" v-if="normalizeFailReasons(log.failReasons).length > 0">
                    <span class="parse-log-fail-tag" v-for="(reasonItem, fIdx) in normalizeFailReasons(log.failReasons).slice(0, 3)" :key="`log-fail-${idx}-${fIdx}`">
                      {{ formatFailReason(reasonItem.reason) }} × {{ reasonItem.count }}
                    </span>
                  </div>
                </div>
                <div v-if="parseLogs.length > 0" style="text-align:center;margin-top:8px">
                  <el-button size="small" type="danger" plain @click="clearParseLogs"><i class="fas fa-trash me-1"></i>清空日志</el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 包租公司名单 -->
      <el-tab-pane label="包租公司名单" name="rentalCompanies">
        <div class="card-container">
          <div class="mb-3">
            <el-alert type="info" :closable="false" show-icon>
              <template #title>朋友圈文案解析小区时，会自动排除此名单中的公司名称，避免将包租公司名误识别为小区名</template>
            </el-alert>
          </div>
          <div class="mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div class="d-flex gap-2 align-items-center">
              <el-input v-model="rcSearch" placeholder="搜索公司名" clearable style="width:200px" size="small" @keyup.enter="loadRentalCompanies" />
              <el-button size="small" type="primary" @click="loadRentalCompanies"><i class="fas fa-search"></i></el-button>
              <span class="text-muted ms-2">共 {{ rcTotal }} 条</span>
            </div>
            <div class="d-flex gap-2">
              <el-button type="success" size="small" @click="rcBatchImportVisible = true"><i class="fas fa-file-import me-1"></i>批量导入</el-button>
              <el-button type="primary" size="small" @click="openRCDialog()"><i class="fas fa-plus me-1"></i>添加公司</el-button>
              <el-button type="danger" size="small" :disabled="rcSelectedIds.length === 0" @click="batchDeleteRC"><i class="fas fa-trash me-1"></i>批量删除({{ rcSelectedIds.length }})</el-button>
            </div>
          </div>
          <el-table :data="rentalCompanies" stripe v-loading="rcLoading" border size="small" @selection-change="rows => rcSelectedIds = rows.map(r => r.id)">
            <el-table-column type="selection" width="45" align="center" />
            <el-table-column prop="id" label="ID" width="70" align="center" />
            <el-table-column prop="name" label="公司名称" min-width="150" />
            <el-table-column prop="alias_names" label="别名" min-width="200" show-overflow-tooltip>
              <template #default="{row}">{{ row.alias_names || '-' }}</template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip>
              <template #default="{row}">{{ row.remark || '-' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="{row}">
                <el-tag :type="row.is_enabled ? 'success' : 'danger'" size="small">{{ row.is_enabled ? '启用' : '禁用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" align="center">
              <template #default="{row}">
                <el-button size="small" type="primary" plain @click="openRCDialog(row)"><i class="fas fa-edit"></i></el-button>
                <el-button size="small" type="danger" plain @click="deleteRC(row.id)"><i class="fas fa-trash"></i></el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="mt-3 d-flex justify-content-end" v-if="rcTotal > rcPageSize">
            <el-pagination v-model:current-page="rcPage" :page-size="rcPageSize" :total="rcTotal" layout="prev, pager, next" small @current-change="loadRentalCompanies" />
          </div>
        </div>
      </el-tab-pane>

      <!-- 默认封面图片 -->
      <el-tab-pane label="发布人联系人" name="publisherContacts">
        <div class="card-container">
          <div class="mb-3">
            <el-alert type="info" :closable="false" show-icon>
              <template #title>这里维护朋友圈发布人的联系方式。解析列表里如果文案本身提取到了联系方式，优先显示文案中的；文案没有时，自动显示这里录入的联系方式。</template>
            </el-alert>
          </div>
          <div class="mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div class="d-flex gap-2 align-items-center">
              <el-input v-model="pcSearch" placeholder="搜索发布人昵称/联系方式/备注" clearable style="width:260px" size="small" @keyup.enter="loadPublisherContacts" />
              <el-select v-model="pcContactStatus" placeholder="联系方式筛选" clearable size="small" style="width:160px" @change="loadPublisherContacts">
                <el-option label="全部联系人" value="all" />
                <el-option label="联系方式为空" value="empty" />
                <el-option label="联系方式不为空" value="filled" />
              </el-select>
              <el-button size="small" type="primary" @click="loadPublisherContacts"><i class="fas fa-search"></i></el-button>
              <span class="text-muted ms-2">共 {{ pcTotal }} 条</span>
            </div>
            <div class="d-flex gap-2">
              <el-button type="warning" size="small" :loading="pcSyncing" @click="syncPublisherContacts"><i class="fas fa-sync-alt me-1"></i>手动同步联系人</el-button>
              <el-button type="success" size="small" @click="pcBatchImportVisible = true"><i class="fas fa-file-import me-1"></i>批量导入</el-button>
              <el-button type="primary" size="small" @click="openPCDialog()"><i class="fas fa-plus me-1"></i>添加联系人</el-button>
              <el-button type="danger" size="small" :disabled="pcSelectedIds.length === 0" @click="batchDeletePC"><i class="fas fa-trash me-1"></i>批量删除({{ pcSelectedIds.length }})</el-button>
            </div>
          </div>
          <el-table :data="publisherContacts" stripe v-loading="pcLoading" border size="small" max-height="620" @selection-change="rows => pcSelectedIds = rows.map(r => r.id)">
            <el-table-column type="selection" width="45" align="center" />
            <el-table-column prop="id" label="ID" width="70" align="center" />
            <el-table-column label="发布者" min-width="220" show-overflow-tooltip>
              <template #default="{row}">
                <template v-if="pcEditingCell.id === row.id && pcEditingCell.field === 'publisher_name'">
                  <el-input v-model="pcEditingCell.value" size="small" @blur="savePCInlineEdit(row, 'publisher_name')" @keyup.enter="savePCInlineEdit(row, 'publisher_name')" autofocus />
                </template>
                <span v-else class="editable-cell admin-editable" @click="startPCInlineEdit(row, 'publisher_name', row.publisher_name)">{{ row.publisher_name || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="联系方式" min-width="220" show-overflow-tooltip>
              <template #default="{row}">
                <template v-if="pcEditingCell.id === row.id && pcEditingCell.field === 'contact_info'">
                  <el-input v-model="pcEditingCell.value" size="small" @blur="savePCInlineEdit(row, 'contact_info')" @keyup.enter="savePCInlineEdit(row, 'contact_info')" autofocus />
                </template>
                <span v-else class="editable-cell admin-editable" @click="startPCInlineEdit(row, 'contact_info', row.contact_info)">{{ row.contact_info || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="180" show-overflow-tooltip>
              <template #default="{row}">
                <template v-if="pcEditingCell.id === row.id && pcEditingCell.field === 'remark'">
                  <el-input v-model="pcEditingCell.value" size="small" @blur="savePCInlineEdit(row, 'remark')" @keyup.enter="savePCInlineEdit(row, 'remark')" autofocus />
                </template>
                <span v-else class="editable-cell admin-editable" @click="startPCInlineEdit(row, 'remark', row.remark)">{{ row.remark || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="{row}">
                <el-tag :type="row.is_enabled ? 'success' : 'danger'" size="small">{{ row.is_enabled ? '启用' : '禁用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" align="center">
              <template #default="{row}">
                <el-button size="small" type="primary" plain @click="openPCDialog(row)"><i class="fas fa-edit"></i></el-button>
                <el-button size="small" type="danger" plain @click="deletePC(row.id)"><i class="fas fa-trash"></i></el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="mt-3 d-flex justify-content-end" v-if="pcTotal > pcPageSize">
            <el-pagination v-model:current-page="pcPage" :page-size="pcPageSize" :total="pcTotal" layout="prev, pager, next" small @current-change="loadPublisherContacts" />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="默认封面" name="defaultCover">
        <div class="card-container">
          <el-alert type="info" :closable="false" show-icon class="mb-3">
            <template #title>当内容资产没有图片时，系统将自动使用此默认图片作为封面展示</template>
          </el-alert>
          <div class="default-cover-section">
            <div v-if="defaultCoverUrl" class="default-cover-preview">
              <img :src="defaultCoverUrl" />
            </div>
            <div v-else class="default-cover-empty">
              <i class="fas fa-image"></i>
              <p>暂未设置默认封面</p>
            </div>
            <el-upload action="" :http-request="uploadDefaultCover" :show-file-list="false" accept="image/*">
              <el-button type="primary" :loading="uploadingCover">
                <i class="fas fa-upload me-1"></i>{{ defaultCoverUrl ? '更换封面图片' : '上传封面图片' }}
              </el-button>
            </el-upload>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 包租公司编辑对话框 -->
    <el-dialog v-model="rcDialogVisible" :title="rcForm.id ? '编辑包租公司' : '添加包租公司'" width="500px" destroy-on-close>
      <el-form :model="rcForm" label-position="top">
        <el-form-item label="公司名称" required><el-input v-model="rcForm.name" placeholder="如：檀舍、自如" /></el-form-item>
        <el-form-item label="别名（多个用逗号分隔）"><el-input v-model="rcForm.alias_names" placeholder="如：檀舍公寓,檀舍管家" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="rcForm.remark" placeholder="备注信息" /></el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="rcForm.is_enabled" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rcDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRC">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入对话框 -->
    <el-dialog v-model="rcBatchImportVisible" title="批量导入包租公司" width="520px" destroy-on-close>
      <el-alert type="info" :closable="false" class="mb-3" show-icon>
        <template #title>每行一个公司名，或用逗号/分号分隔。重复名称自动跳过。</template>
      </el-alert>
      <el-input v-model="rcBatchNames" type="textarea" :rows="8" placeholder="檀舍&#10;自如&#10;蛋壳公寓&#10;青客公寓" />
      <template #footer>
        <el-button @click="rcBatchImportVisible = false">取消</el-button>
        <el-button type="primary" :loading="rcBatchImporting" @click="doBatchImportRC">导入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pcDialogVisible" :title="pcForm.id ? '编辑发布人联系人' : '添加发布人联系人'" width="520px" destroy-on-close>
      <el-form :model="pcForm" label-position="top">
        <el-form-item label="Publisher" required><el-input v-model="pcForm.publisher_name" placeholder="请输入发布人昵称" /></el-form-item>
        <el-form-item label="Contact"><el-input v-model="pcForm.contact_info" placeholder="可填微信、手机号、邮箱等" /></el-form-item>
        <el-form-item label="Remark"><el-input v-model="pcForm.remark" placeholder="备注信息" /></el-form-item>
        <el-form-item label="Status">
          <el-switch v-model="pcForm.is_enabled" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pcDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePC">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pcBatchImportVisible" title="批量导入发布人联系人" width="560px" destroy-on-close>
      <el-alert type="info" :closable="false" class="mb-3" show-icon>
        <template #title>每行一条，格式支持：发布人昵称, 联系方式, 备注。只填昵称也可以，已存在的昵称会自动更新联系方式和备注。</template>
      </el-alert>
          <el-input v-model="pcBatchNames" type="textarea" :rows="10" placeholder="品牌官网, wechat: abc123, 内容负责人&#10;内容团队, 13800138000, 可晚间联系&#10;SEO 项目组" />
      <template #footer>
        <el-button @click="pcBatchImportVisible = false">取消</el-button>
        <el-button type="primary" :loading="pcBatchImporting" @click="doBatchImportPC">导入</el-button>
      </template>
    </el-dialog>

    <!-- 区域编辑对话框 -->
    <el-dialog v-model="districtDialogVisible" :title="districtForm.id ? '编辑区域' : '添加区域'" width="440px" destroy-on-close>
      <el-form :model="districtForm" label-position="top">
        <el-form-item label="中文名" required><el-input v-model="districtForm.name_cn" placeholder="如：浦东新区" /></el-form-item>
        <el-form-item label="英文名"><el-input v-model="districtForm.name_en" placeholder="如：Pudong" /></el-form-item>
        <el-form-item label="城市"><el-input v-model="districtForm.city" placeholder="如：上海" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="districtForm.sort_order" :min="0" :max="999" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="districtDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveDistrict">保存</el-button>
      </template>
    </el-dialog>

    <!-- 地铁线路编辑对话框 -->
    <el-dialog v-model="metroLineDialogVisible" :title="metroLineForm.id ? '编辑线路' : '添加线路'" width="440px" destroy-on-close>
      <el-form :model="metroLineForm" label-position="top">
        <el-form-item label="中文名" required><el-input v-model="metroLineForm.name_cn" placeholder="如：1号线" /></el-form-item>
        <el-form-item label="英文名"><el-input v-model="metroLineForm.name_en" placeholder="如：Line 1" /></el-form-item>
        <el-form-item label="线路颜色"><el-color-picker v-model="metroLineForm.line_color" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="metroLineForm.sort_order" :min="0" :max="999" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="metroLineDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveMetroLine">保存</el-button>
      </template>
    </el-dialog>

    <!-- 地铁站点编辑对话框 -->
    <el-dialog v-model="stationDialogVisible" :title="stationForm.id ? '编辑站点' : '添加站点'" width="440px" destroy-on-close>
      <el-form :model="stationForm" label-position="top">
        <el-form-item label="所属线路" required>
          <el-select v-model="stationForm.metro_line_id" style="width:100%" placeholder="选择地铁线路">
            <el-option v-for="l in metroLines" :key="l.id" :label="l.name_cn" :value="l.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="中文名" required><el-input v-model="stationForm.name_cn" placeholder="如：人民广场" /></el-form-item>
        <el-form-item label="英文名"><el-input v-model="stationForm.name_en" placeholder="如：People's Square" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="stationForm.sort_order" :min="0" :max="999" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stationDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveStation">保存</el-button>
      </template>
    </el-dialog>

    <!-- POI回收站 -->
    <el-dialog v-model="poiRecycleVisible" title="POI回收站" width="980px" destroy-on-close>
      <div class="mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div class="d-flex gap-2 align-items-center flex-wrap">
          <el-input v-model="poiRecycleSearch" placeholder="搜索小区名/板块/别名" clearable style="width:220px" size="small" @keyup.enter="loadPOIRecycleBin" />
          <el-select v-model="poiRecycleDistrict" placeholder="筛选区域" clearable style="width:150px" size="small" @change="loadPOIRecycleBin">
            <el-option v-for="d in poiDistrictOptions" :key="'rb'+d.district" :label="`${d.district} (${d.count})`" :value="d.district" />
          </el-select>
          <el-button size="small" type="primary" @click="loadPOIRecycleBin"><i class="fas fa-search"></i></el-button>
        </div>
        <span class="text-muted">共 {{ poiRecycleTotal }} 条</span>
      </div>
      <el-table :data="poiRecycleList" stripe border size="small" v-loading="poiRecycleLoading" style="width:100%">
        <el-table-column prop="community_name" label="小区名" min-width="160" show-overflow-tooltip />
        <el-table-column prop="district" label="区域" width="90" />
        <el-table-column prop="board" label="板块" width="90" show-overflow-tooltip />
        <el-table-column prop="deleted_at" label="删除时间" width="160">
          <template #default="{row}">
            <span>{{ formatDate(row.deleted_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="delete_reason" label="删除类型" width="100" />
        <el-table-column label="操作" width="110" align="center" fixed="right">
          <template #default="{row}">
            <el-button size="small" type="success" plain @click="restorePOI(row)"><i class="fas fa-undo"></i>恢复</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="mt-3 d-flex justify-content-end" v-if="poiRecycleTotal > 0">
        <el-pagination
          v-model:current-page="poiRecyclePage"
          :page-size="poiRecyclePageSize"
          :total="poiRecycleTotal"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @current-change="loadPOIRecycleBin"
          @size-change="(s) => { poiRecyclePageSize = s; loadPOIRecycleBin() }"
        />
      </div>
    </el-dialog>

    <!-- 小区POI编辑对话框 -->
    <el-dialog v-model="poiDialogVisible" :title="poiForm.id ? '编辑小区' : '添加小区'" width="560px" destroy-on-close>
      <el-form :model="poiForm" label-position="top">
        <div class="d-flex gap-2 align-items-end">
          <el-form-item label="小区名称" required style="flex:1"><el-input v-model="poiForm.community_name" placeholder="如：汤臣豪园" /></el-form-item>
          <el-form-item label="所属区域" required style="width:150px">
            <el-select v-model="poiForm.district" placeholder="选择区域" style="width:100%">
              <el-option v-for="d in districts" :key="d.name_cn" :label="d.name_cn" :value="d.name_cn" />
            </el-select>
          </el-form-item>
          <el-form-item style="width:auto">
            <el-button type="success" :loading="dialogEnriching" @click="enrichFromDialog" :disabled="!poiForm.community_name">
              <i class="fas fa-map-marker-alt me-1"></i>高德补充
            </el-button>
          </el-form-item>
        </div>
        <div class="d-flex gap-2">
          <el-form-item label="板块" style="flex:1"><el-input v-model="poiForm.board" placeholder="如：张江、陆家嘴" /></el-form-item>
        </div>
        <el-form-item label="别名（回车添加，不限数量）">
          <div class="alias-input-wrap">
            <el-tag v-for="(alias, idx) in poiAliasArr" :key="idx" closable size="default" type="info" @close="removeAlias(idx)" class="alias-edit-tag">{{ alias }}</el-tag>
            <el-input v-model="newAliasInput" placeholder="输入别名后回车添加" size="small" style="width:180px" @keyup.enter="addAlias" />
            <el-button size="small" type="primary" plain @click="addAlias" :disabled="!newAliasInput.trim()">添加</el-button>
          </div>
        </el-form-item>
        <el-form-item label="详细地址"><el-input v-model="poiForm.address" placeholder="如：浦东南路1088弄" /></el-form-item>
        <div class="d-flex gap-2">
          <el-form-item label="纬度 (latitude)" style="flex:1"><el-input v-model="poiForm.latitude" placeholder="如：31.234567" /></el-form-item>
          <el-form-item label="经度 (longitude)" style="flex:1"><el-input v-model="poiForm.longitude" placeholder="如：121.456789" /></el-form-item>
          <el-form-item label="物业类型" style="width:120px">
            <el-select v-model="poiForm.property_type" style="width:100%">
              <el-option label="公寓" value="公寓" /><el-option label="别墅" value="别墅" /><el-option label="住宅" value="住宅" />
            </el-select>
          </el-form-item>
        </div>
        <div class="d-flex gap-2">
          <el-form-item label="最近地铁线路" style="flex:1"><el-input v-model="poiForm.nearest_metro_line" placeholder="如：2号线" /></el-form-item>
          <el-form-item label="最近地铁站" style="flex:1"><el-input v-model="poiForm.nearest_metro_station" placeholder="如：张江高科站" /></el-form-item>
          <el-form-item label="距离(米)" style="width:120px"><el-input-number v-model="poiForm.nearest_metro_distance" :min="0" :max="99999" controls-position="right" /></el-form-item>
        </div>
        <div class="d-flex gap-2">
          <el-form-item label="参考租金最低" style="flex:1"><el-input-number v-model="poiForm.ref_price_min" :min="0" :step="500" controls-position="right" style="width:100%" /></el-form-item>
          <el-form-item label="参考租金最高" style="flex:1"><el-input-number v-model="poiForm.ref_price_max" :min="0" :step="500" controls-position="right" style="width:100%" /></el-form-item>
          <el-form-item label="启用" style="width:80px"><el-switch v-model="poiForm.is_enabled" :active-value="1" :inactive-value="0" /></el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="poiDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePOI">保存</el-button>
      </template>
    </el-dialog>

    <!-- CSV导入对话框 -->
    <el-dialog v-model="importDialogVisible" title="导入CSV小区数据" width="520px" destroy-on-close>
      <div class="import-dialog-content">
        <el-alert type="info" :closable="false" class="mb-3">
          <template #title>
            <div>支持房天下等平台的租房数据CSV文件（支持GBK和UTF-8编码）</div>
            <div class="mt-1" style="font-size:12px;color:#909399">CSV需包含"房屋位置"列，格式如：浦东-张江-汤臣豪园</div>
          </template>
        </el-alert>
        <el-upload
          ref="csvUploadRef"
          drag
          :auto-upload="false"
          accept=".csv"
          :limit="1"
          :on-change="onCSVFileChange"
        >
          <i class="fas fa-cloud-upload-alt" style="font-size:40px;color:#c0c4cc;margin-bottom:10px"></i>
          <div>将CSV文件拖拽到此处，或<em>点击上传</em></div>
          <template #tip><div class="text-muted" style="font-size:12px">仅支持 .csv 文件，最大50MB</div></template>
        </el-upload>
        <el-checkbox v-model="importClearOld" class="mt-3">导入前清除所有旧数据</el-checkbox>
        <div v-if="importResult" class="mt-3">
          <el-alert :type="importResult.errors > 0 ? 'warning' : 'success'" :closable="false">
            <template #title>
              <div>导入完成: 识别 {{ importResult.communities_found }} 个小区，成功 {{ importResult.inserted }} 个，失败 {{ importResult.errors }} 个</div>
            </template>
          </el-alert>
        </div>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importLoading" :disabled="!csvFile" @click="doImportCSV">
          <i class="fas fa-upload me-1"></i>开始导入
        </el-button>
      </template>
    </el-dialog>

    <!-- Excel导入对话框 -->
    <el-dialog v-model="excelImportDialogVisible" title="导入Excel全国小区POI数据" width="560px" destroy-on-close>
      <div class="import-dialog-content">
        <el-alert type="info" :closable="false" class="mb-3">
          <template #title>
            <div>支持全国小区数据Excel文件（.xlsx），自动提取上海小区数据</div>
            <div class="mt-1" style="font-size:12px;color:#909399">
              Excel需包含列：name, province, city, area, address, latitude, longitude, type等<br>
              已有小区将补充缺失的坐标、地址、类型等字段；不存在的小区将新增
            </div>
          </template>
        </el-alert>
        <el-upload
          ref="excelUploadRef"
          drag
          :auto-upload="false"
          accept=".xlsx,.xls"
          :limit="1"
          :on-change="onExcelFileChange"
        >
          <i class="fas fa-file-excel" style="font-size:40px;color:#67C23A;margin-bottom:10px"></i>
          <div>将Excel文件拖拽到此处，或<em>点击上传</em></div>
          <template #tip><div class="text-muted" style="font-size:12px">仅支持 .xlsx / .xls 文件，最大200MB</div></template>
        </el-upload>
        <div v-if="excelImportResult" class="mt-3">
          <el-alert :type="excelImportResult.errors > 0 ? 'warning' : 'success'" :closable="false">
            <template #title>
              <div>导入完成：识别 {{ excelImportResult.shanghai_communities }} 个上海小区</div>
              <div style="font-size:12px;margin-top:4px;color:#606266">
                更新 {{ excelImportResult.updated }} 条 · 新增 {{ excelImportResult.inserted }} 条 · 
                无需变更 {{ excelImportResult.unchanged }} 条 · 失败 {{ excelImportResult.errors }} 条
              </div>
            </template>
          </el-alert>
        </div>
      </div>
      <template #footer>
        <el-button @click="excelImportDialogVisible = false">关闭</el-button>
        <el-button type="warning" :loading="excelImportLoading" :disabled="!excelFile" @click="doImportExcel">
          <i class="fas fa-upload me-1"></i>开始导入
        </el-button>
      </template>
    </el-dialog>

    <!-- 高德批量补充对话框 -->
    <el-dialog v-model="batchEnrichDialogVisible" title="高德地图批量补充" width="600px" destroy-on-close>
      <div class="batch-enrich-content">
        <el-alert type="info" :closable="false" class="mb-3">
          <template #title>
            <div>通过高德地图API自动补充/校验小区的区域、板块、经纬度、地铁站等信息</div>
            <div class="mt-1" style="font-size:12px;color:#909399">
              「智能校验」模式会检测坐标偏差、区域错误、地铁信息不准等问题并自动修正。按市中心→郊区优先级处理
            </div>
          </template>
        </el-alert>
        <el-form label-position="top">
          <div class="d-flex gap-3">
            <el-form-item label="补充模式" style="flex:1">
              <el-select v-model="batchEnrichMode" style="width:100%">
                <el-option label="缺少任意信息的记录" value="missing" />
                <el-option label="仅缺少坐标的记录" value="no_coords" />
                <el-option label="仅缺少地铁信息的记录" value="no_metro" />
                <el-option label="智能校验（检测并修正偏差数据）" value="verify" />
                <el-option label="全量校验（强制覆盖所有记录）" value="all" />
              </el-select>
            </el-form-item>
            <el-form-item label="指定区域（可选）" style="flex:1">
              <el-select v-model="batchEnrichDistrict" placeholder="全部区域" clearable style="width:100%">
                <el-option v-for="d in poiDistrictOptions" :key="d.district" :label="d.district" :value="d.district" />
              </el-select>
            </el-form-item>
            <el-form-item label="每批数量" style="width:120px">
              <el-input-number v-model="batchEnrichLimit" :min="10" :max="200" :step="10" controls-position="right" style="width:100%" />
            </el-form-item>
          </div>
        </el-form>

        <div v-if="batchEnrichResult" class="mt-3">
          <el-alert :type="batchEnrichResult.failedCount > 0 ? 'warning' : 'success'" :closable="false" class="mb-2">
            <template #title>
              <div>处理完成：共 {{ batchEnrichResult.processed }} 条 · 成功 {{ batchEnrichResult.enrichedCount }} 条 · 失败 {{ batchEnrichResult.failedCount }} 条</div>
            </template>
          </el-alert>
          <div class="batch-enrich-log" style="max-height:250px;overflow-y:auto;font-size:12px;background:#f5f5f5;padding:10px;border-radius:6px">
            <div v-for="r in batchEnrichResult.results" :key="r.id" class="mb-1">
              <el-tag :type="r.status === 'enriched' ? 'success' : (r.status === 'failed' || r.status === 'error' ? 'danger' : 'info')" size="small" class="me-1" style="min-width:48px;text-align:center">
                {{ r.status === 'enriched' ? '修正' : (r.status === 'no_change' ? '正常' : (r.status === 'no_data' ? '无数据' : '失败')) }}
              </el-tag>
              <span v-if="r.district" class="text-muted" style="font-size:11px">[{{ r.district }}] </span>
              <span>{{ r.name }}</span>
              <span v-if="r.fields" class="text-muted"> · {{ r.fields }}项变更</span>
              <span v-if="r.changes && r.changes.length" class="text-warning" style="font-size:11px"> · {{ r.changes.join('; ') }}</span>
              <span v-if="r.message" class="text-danger"> · {{ r.message }}</span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="batchEnrichDialogVisible = false">关闭</el-button>
        <el-button type="success" :loading="batchEnrichLoading" @click="doBatchEnrich">
          <i class="fas fa-map-marked-alt me-1"></i>开始批量补充
        </el-button>
      </template>
    </el-dialog>

    <!-- 地理别名编辑对话框 -->
    <el-dialog v-model="aliasDialogVisible" :title="aliasForm.id ? '编辑别名' : '添加别名'" width="480px" destroy-on-close>
      <el-form :model="aliasForm" label-position="top">
        <el-form-item label="别名（商圈/路名/地标/地铁站等）" required>
          <el-input v-model="aliasForm.alias_name" placeholder="如：静安寺、南京西路、古北" maxlength="100" />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-radio-group v-model="aliasForm.alias_type">
            <el-radio-button value="landmark">地标/商圈</el-radio-button>
            <el-radio-button value="road">路名</el-radio-button>
            <el-radio-button value="metro">地铁站</el-radio-button>
            <el-radio-button value="area">区域</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="对应区域" required>
          <el-input v-model="aliasForm.district" placeholder="如：静安区、浦东新区" maxlength="50" />
        </el-form-item>
        <div class="d-flex gap-3">
          <el-form-item label="优先级" style="flex:1">
            <el-input-number v-model="aliasForm.priority" :min="0" :max="100" style="width:100%" />
          </el-form-item>
          <el-form-item label="状态" style="flex:1">
            <el-switch v-model="aliasForm.is_enabled" active-text="启用" inactive-text="禁用" />
          </el-form-item>
        </div>
        <el-form-item label="备注">
          <el-input v-model="aliasForm.remark" placeholder="可选" maxlength="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="aliasDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="aliasSaving" @click="saveAlias"><i class="fas fa-save me-1"></i>保存</el-button>
      </template>
    </el-dialog>

    <!-- 地理别名批量导入对话框 -->
    <el-dialog v-model="aliasBatchImportVisible" title="批量导入别名" width="560px" destroy-on-close>
      <el-alert type="info" :closable="false" show-icon class="mb-3">
        <template #title>每行一条，格式：别名,类型,区域,优先级,备注（后两项可省略）</template>
      </el-alert>
      <el-input v-model="aliasBatchText" type="textarea" :rows="12" placeholder="静安寺,landmark,静安区,10,商圈&#10;南京西路,road,静安区&#10;陆家嘴,metro,浦东新区,8" style="font-family:monospace;font-size:13px" />
      <template #footer>
        <el-button @click="aliasBatchImportVisible = false">取消</el-button>
        <el-button type="primary" :loading="aliasBatchImporting" @click="doBatchImportAlias"><i class="fas fa-file-import me-1"></i>导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const activeTab = ref('districts')
const loading = ref(false)
const stationLoading = ref(false)
const districts = ref([])
const metroLines = ref([])
const metroStations = ref([])
const aiModels = ref([])
const aiConfig = reactive({
  ai_parse_enabled: '0',
  ai_parse_model_id: '',
  ai_parse_model_ids: [],
  ai_parse_prompt: '',
  ai_parse_batch_size: '50',
  ai_parse_batch_size_num: 50,
  ai_parse_multi_thread: '0',
  ai_parse_multi_thread_bool: false,
  ai_parse_thread_count: '8',
  ai_parse_thread_count_num: 8,
})
const parseStats = reactive({ total: 0, parsed: 0, unparsed: 0, unparsed_with_content: 0, unparsed_no_content: 0, has_price: 0, has_community: 0 })
const runtimeStats = reactive({ lastRun: null, processed: 0, success: 0, failed: 0, remaining: 0, elapsed: 0, threadCount: 1, batchSize: 50, status: '', message: '', topFailReasons: [] })
const unparsedTimeRange = reactive({ oldest_created: '', newest_created: '' })
const parseLogs = ref([])
let statsPollingTimer = null
const aiSaving = ref(false)

const runtimeStatusType = computed(() => {
  const s = runtimeStats.status
  if (s === 'running') return 'warning'
  if (s === 'ok' && runtimeStats.remaining > 0) return 'warning'
  if (s === 'ok' || s === 'complete') return 'success'
  if (s === 'skipped' || s === 'idle') return 'info'
  if (s === 'error') return 'danger'
  return 'info'
})
const runtimeStatusText = computed(() => {
  const s = runtimeStats.status
  if (s === 'running') return '解析中...'
  if (s === 'ok' && runtimeStats.remaining > 0) return '运行中'
  if (s === 'ok') return '正常'
  if (s === 'complete') return '已全部完成'
  if (s === 'skipped') return '配置跳过'
  if (s === 'idle') return '空闲'
  if (s === 'error') return '异常'
  return '未知'
})
const runtimeTopFailReasons = computed(() => normalizeFailReasons(runtimeStats.topFailReasons).slice(0, 3))
const stationLineFilter = ref('')

watch(() => aiConfig.ai_parse_model_id, (primaryId) => {
  const primary = String(primaryId || '')
  aiConfig.ai_parse_model_ids = (aiConfig.ai_parse_model_ids || []).filter(id => String(id) !== primary)
})

const districtDialogVisible = ref(false)
const districtForm = reactive({ id: null, name_cn: '', name_en: '', city: '', sort_order: 0 })

const metroLineDialogVisible = ref(false)
const metroLineForm = reactive({ id: null, name_cn: '', name_en: '', line_color: '#1890ff', sort_order: 0 })

const stationDialogVisible = ref(false)
const stationForm = reactive({ id: null, metro_line_id: '', name_cn: '', name_en: '', sort_order: 0 })

/* ==================== 地理别名映射 ==================== */
const aliasList = ref([])
const aliasLoading = ref(false)
const aliasSearch = ref('')
const aliasTypeFilter = ref('')
const aliasDistrictFilter = ref('')
const aliasDistrictOptions = ref([])
const aliasPage = ref(1)
const aliasPageSize = ref(50)
const aliasTotal = ref(0)
const aliasSelectedIds = ref([])
const aliasStats = reactive({ total: 0, landmark: 0, road: 0, metro: 0, area: 0 })
const aliasDialogVisible = ref(false)
const aliasSaving = ref(false)
const aliasForm = reactive({ id: null, alias_name: '', alias_type: 'landmark', district: '', priority: 0, is_enabled: true, remark: '' })
const aliasBatchImportVisible = ref(false)
const aliasBatchText = ref('')
const aliasBatchImporting = ref(false)

const ALIAS_TYPE_MAP = { landmark: '地标/商圈', road: '路名', metro: '地铁站', area: '区域' }
const ALIAS_TYPE_COLORS = { landmark: '', road: 'success', metro: 'warning', area: 'info' }
function aliasTypeLabel(t) { return ALIAS_TYPE_MAP[t] || t }
function aliasTypeTagColor(t) { return ALIAS_TYPE_COLORS[t] || '' }

async function loadAliasList() {
  aliasLoading.value = true
  try {
    const params = { page: aliasPage.value, pageSize: aliasPageSize.value }
    if (aliasSearch.value) params.search = aliasSearch.value
    if (aliasTypeFilter.value) params.type = aliasTypeFilter.value
    if (aliasDistrictFilter.value) params.district = aliasDistrictFilter.value
    const res = await api.get('/admin/property-settings/district-alias', { params })
    aliasList.value = res.data?.data || []
    aliasTotal.value = res.data?.total || 0
    if (res.data?.stats) Object.assign(aliasStats, res.data.stats)
  } catch (e) { console.error('加载别名失败:', e) }
  aliasLoading.value = false
}

async function loadAliasDistricts() {
  try {
    const res = await api.get('/admin/property-settings/district-alias-districts')
    aliasDistrictOptions.value = res.data || []
  } catch {}
}

function openAliasDialog(row) {
  if (row) {
    Object.assign(aliasForm, { id: row.id, alias_name: row.alias_name, alias_type: row.alias_type, district: row.district, priority: row.priority || 0, is_enabled: !!row.is_enabled, remark: row.remark || '' })
  } else {
    Object.assign(aliasForm, { id: null, alias_name: '', alias_type: 'landmark', district: '', priority: 0, is_enabled: true, remark: '' })
  }
  aliasDialogVisible.value = true
}

async function saveAlias() {
  if (!aliasForm.alias_name?.trim()) return ElMessage.warning('别名不能为空')
  if (!aliasForm.district?.trim()) return ElMessage.warning('区域不能为空')
  aliasSaving.value = true
  try {
    await api.post('/admin/property-settings/district-alias', { ...aliasForm })
    ElMessage.success('保存成功')
    aliasDialogVisible.value = false
    loadAliasList()
    loadAliasDistricts()
  } catch (e) { ElMessage.error(e?.response?.data?.message || '保存失败') }
  aliasSaving.value = false
}

async function deleteAlias(id) {
  try {
    await ElMessageBox.confirm('确认删除此别名？', '提示', { type: 'warning' })
    await api.delete(`/admin/property-settings/district-alias/${id}`)
    ElMessage.success('已删除')
    loadAliasList()
  } catch {}
}

async function batchDeleteAlias() {
  try {
    await ElMessageBox.confirm(`确认删除选中的 ${aliasSelectedIds.value.length} 条别名？`, '批量删除', { type: 'warning' })
    await api.post('/admin/property-settings/district-alias/batch-delete', { ids: aliasSelectedIds.value })
    ElMessage.success('批量删除成功')
    aliasSelectedIds.value = []
    loadAliasList()
  } catch {}
}

async function doBatchImportAlias() {
  const lines = aliasBatchText.value.split('\n').filter(l => l.trim())
  if (!lines.length) return ElMessage.warning('无有效数据')
  const items = lines.map(line => {
    const parts = line.split(/[,，\t]/).map(s => s.trim())
    return { alias_name: parts[0] || '', alias_type: parts[1] || 'landmark', district: parts[2] || '', priority: +(parts[3] || 0), remark: parts[4] || '' }
  }).filter(i => i.alias_name && i.district)
  if (!items.length) return ElMessage.warning('格式不正确，请检查')
  aliasBatchImporting.value = true
  try {
    const res = await api.post('/admin/property-settings/district-alias/batch-import', { items })
    ElMessage.success(res.data?.message || '导入完成')
    aliasBatchImportVisible.value = false
    aliasBatchText.value = ''
    loadAliasList()
    loadAliasDistricts()
  } catch (e) { ElMessage.error(e?.response?.data?.message || '导入失败') }
  aliasBatchImporting.value = false
}

/* POI 数据 */
const poiSubTab = ref('poiList')
const communityPOIList = ref([])
const poiLoading = ref(false)
const poiSearch = ref('')
const poiNameOnly = ref(false)
const poiDistrictFilter = ref('')
const poiMetroFilter = ref('')
const poiDateRange = ref(null)
const poiDateShortcuts = [
  { text: '今天', value: () => { const d = new Date(); return [d, d] } },
  { text: '昨天', value: () => { const d = new Date(); d.setDate(d.getDate() - 1); return [d, d] } },
  { text: '最近3天', value: () => { const e = new Date(); const s = new Date(); s.setDate(s.getDate() - 2); return [s, e] } },
  { text: '本周', value: () => { const e = new Date(); const s = new Date(); const day = s.getDay() || 7; s.setDate(s.getDate() - day + 1); return [s, e] } },
  { text: '本月', value: () => { const e = new Date(); const s = new Date(e.getFullYear(), e.getMonth(), 1); return [s, e] } },
  { text: '最近7天', value: () => { const e = new Date(); const s = new Date(); s.setDate(s.getDate() - 6); return [s, e] } },
  { text: '最近30天', value: () => { const e = new Date(); const s = new Date(); s.setDate(s.getDate() - 29); return [s, e] } },
]
const poiPage = ref(1)
const poiPageSize = ref(20)
const poiTotal = ref(0)
const poiStats = reactive({ summary: null, districts: [], timeStats: null, sourceBreakdown: null })
const poiDistrictOptions = ref([])
const poiSelectedIds = ref([])
const poiRecycleVisible = ref(false)
const poiRecycleList = ref([])
const poiRecycleLoading = ref(false)
const poiRecycleSearch = ref('')
const poiRecycleDistrict = ref('')
const poiRecyclePage = ref(1)
const poiRecyclePageSize = ref(20)
const poiRecycleTotal = ref(0)

const poiDialogVisible = ref(false)
const poiForm = reactive({
  id: null, community_name: '', district: '', board: '', alias_names: '',
  address: '', latitude: '', longitude: '', property_type: '住宅',
  nearest_metro_line: '', nearest_metro_station: '', nearest_metro_distance: null,
  ref_price_min: null, ref_price_max: null, is_enabled: 1
})
const poiAliasArr = ref([])
const newAliasInput = ref('')

function parseAliases(raw) {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter(Boolean) : []
  } catch {
    return raw.split(',').map(s => s.trim()).filter(Boolean)
  }
}
function addAlias() {
  const v = newAliasInput.value.trim()
  if (!v) return
  if (!poiAliasArr.value.includes(v)) poiAliasArr.value.push(v)
  newAliasInput.value = ''
}
function removeAlias(idx) {
  poiAliasArr.value.splice(idx, 1)
}
function syncAliasesToForm() {
  poiForm.alias_names = poiAliasArr.value.length ? JSON.stringify(poiAliasArr.value) : ''
}

const importDialogVisible = ref(false)
const importLoading = ref(false)
const importClearOld = ref(false)
const csvFile = ref(null)
const importResult = ref(null)

const excelImportDialogVisible = ref(false)
const excelImportLoading = ref(false)
const excelFile = ref(null)
const excelImportResult = ref(null)
const csvUploadRef = ref(null)

/* 包租公司名单管理 */
const rentalCompanies = ref([])
const rcLoading = ref(false)
const rcSearch = ref('')
const rcPage = ref(1)
const rcPageSize = ref(50)
const rcTotal = ref(0)
const rcSelectedIds = ref([])
const rcDialogVisible = ref(false)
const rcForm = reactive({ id: null, name: '', alias_names: '', remark: '', is_enabled: 1 })
const rcBatchImportVisible = ref(false)
const rcBatchNames = ref('')
const rcBatchImporting = ref(false)

async function loadRentalCompanies() {
  rcLoading.value = true
  try {
    const res = await api.get('/admin/property-settings/rental-companies', { params: { keyword: rcSearch.value, page: rcPage.value, per_page: rcPageSize.value } })
    rentalCompanies.value = res.data?.list || []
    rcTotal.value = res.data?.total || 0
  } catch (e) {
    console.error('加载包租公司失败:', e)
  }
  rcLoading.value = false
}

function openRCDialog(row = null) {
  if (row) {
    Object.assign(rcForm, { id: row.id, name: row.name, alias_names: row.alias_names || '', remark: row.remark || '', is_enabled: row.is_enabled ?? 1 })
  } else {
    Object.assign(rcForm, { id: null, name: '', alias_names: '', remark: '', is_enabled: 1 })
  }
  rcDialogVisible.value = true
}

async function saveRC() {
  if (!rcForm.name?.trim()) return ElMessage.warning('请输入公司名称')
  try {
    await api.post('/admin/property-settings/rental-companies', { ...rcForm })
    ElMessage.success('保存成功')
    rcDialogVisible.value = false
    await loadRentalCompanies()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || '保存失败')
  }
}

async function deleteRC(id) {
  try {
    await ElMessageBox.confirm('确定删除该公司？', '提示', { type: 'warning' })
    await api.delete(`/admin/property-settings/rental-companies/${id}`)
    ElMessage.success('删除成功')
    await loadRentalCompanies()
  } catch {}
}

async function batchDeleteRC() {
  if (rcSelectedIds.value.length === 0) return
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${rcSelectedIds.value.length} 条记录？`, '批量删除', { type: 'warning' })
    await api.post('/admin/property-settings/rental-companies/batch-delete', { ids: rcSelectedIds.value })
    ElMessage.success('批量删除成功')
    rcSelectedIds.value = []
    await loadRentalCompanies()
  } catch {}
}

async function doBatchImportRC() {
  if (!rcBatchNames.value?.trim()) return ElMessage.warning('请输入公司名称')
  rcBatchImporting.value = true
  try {
    const res = await api.post('/admin/property-settings/rental-companies/batch-import', { names: rcBatchNames.value })
    ElMessage.success(res.message || '导入成功')
    rcBatchImportVisible.value = false
    rcBatchNames.value = ''
    await loadRentalCompanies()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '导入失败')
  }
  rcBatchImporting.value = false
}

/* 发布人联系人管理 */
const publisherContacts = ref([])
const pcLoading = ref(false)
const pcSearch = ref('')
const pcPage = ref(1)
const pcPageSize = ref(50)
const pcTotal = ref(0)
const pcSelectedIds = ref([])
const pcDialogVisible = ref(false)
const pcForm = reactive({ id: null, publisher_name: '', contact_info: '', remark: '', is_enabled: 1 })
const pcBatchImportVisible = ref(false)
const pcBatchNames = ref('')
const pcBatchImporting = ref(false)
const pcSyncing = ref(false)
const pcContactStatus = ref('all')
const pcEditingCell = reactive({ id: null, field: '', value: '' })

async function loadPublisherContacts() {
  pcLoading.value = true
  try {
    const res = await api.get('/admin/property-settings/publisher-contacts', {
      params: {
        keyword: pcSearch.value,
        page: pcPage.value,
        per_page: pcPageSize.value,
        contact_status: pcContactStatus.value === 'all' ? '' : pcContactStatus.value
      }
    })
    publisherContacts.value = res.data?.list || []
    pcTotal.value = res.data?.total || 0
  } catch (e) {
    console.error('加载发布人联系人失败:', e)
  }
  pcLoading.value = false
}

function openPCDialog(row = null) {
  if (row) {
    Object.assign(pcForm, {
      id: row.id,
      publisher_name: row.publisher_name || '',
      contact_info: row.contact_info || '',
      remark: row.remark || '',
      is_enabled: row.is_enabled ?? 1
    })
  } else {
    Object.assign(pcForm, { id: null, publisher_name: '', contact_info: '', remark: '', is_enabled: 1 })
  }
  pcDialogVisible.value = true
}

async function savePC() {
  if (!pcForm.publisher_name?.trim()) return ElMessage.warning('请输入发布人昵称')
  try {
    await api.post('/admin/property-settings/publisher-contacts', { ...pcForm })
    ElMessage.success('保存成功')
    pcDialogVisible.value = false
    await loadPublisherContacts()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || '保存失败')
  }
}

function startPCInlineEdit(row, field, currentValue) {
  pcEditingCell.id = row.id
  pcEditingCell.field = field
  pcEditingCell.value = currentValue ?? ''
}

async function savePCInlineEdit(row, field) {
  if (pcEditingCell.id !== row.id || pcEditingCell.field !== field) return
  const newValue = (pcEditingCell.value ?? '').toString().trim()
  const oldValue = (row[field] ?? '').toString().trim()

  if (newValue === oldValue) {
    pcEditingCell.id = null
    pcEditingCell.field = ''
    pcEditingCell.value = ''
    return
  }

  const payload = {
    id: row.id,
    publisher_name: field === 'publisher_name' ? newValue : (row.publisher_name || ''),
    contact_info: field === 'contact_info' ? newValue : (row.contact_info || ''),
    remark: field === 'remark' ? newValue : (row.remark || ''),
    is_enabled: row.is_enabled ?? 1
  }

  if (!payload.publisher_name.trim()) {
    ElMessage.warning('发布者不能为空')
    return
  }

  try {
    await api.post('/admin/property-settings/publisher-contacts', payload)
    row[field] = newValue
    ElMessage.success('修改成功')
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || '修改失败')
  } finally {
    pcEditingCell.id = null
    pcEditingCell.field = ''
    pcEditingCell.value = ''
  }
}

async function deletePC(id) {
  try {
    await ElMessageBox.confirm('确定删除该发布人联系人吗？', '提示', { type: 'warning' })
    await api.delete(`/admin/property-settings/publisher-contacts/${id}`)
    ElMessage.success('删除成功')
    await loadPublisherContacts()
  } catch {}
}

async function batchDeletePC() {
  if (pcSelectedIds.value.length === 0) return
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${pcSelectedIds.value.length} 条联系人记录吗？`, '批量删除', { type: 'warning' })
    await api.post('/admin/property-settings/publisher-contacts/batch-delete', { ids: pcSelectedIds.value })
    ElMessage.success('批量删除成功')
    pcSelectedIds.value = []
    await loadPublisherContacts()
  } catch {}
}

async function doBatchImportPC() {
  if (!pcBatchNames.value?.trim()) return ElMessage.warning('请输入联系人数据')
  pcBatchImporting.value = true
  try {
    const res = await api.post('/admin/property-settings/publisher-contacts/batch-import', { names: pcBatchNames.value })
    ElMessage.success(res.message || '导入成功')
    pcBatchImportVisible.value = false
    pcBatchNames.value = ''
    await loadPublisherContacts()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '导入失败')
  }
  pcBatchImporting.value = false
}

async function syncPublisherContacts() {
  pcSyncing.value = true
  try {
    const res = await api.post('/admin/property-settings/publisher-contacts/sync')
    ElMessage.success(res.message || '联系人同步成功')
    await loadPublisherContacts()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '联系人同步失败')
  }
  pcSyncing.value = false
}

/* 高德批量补充 */
const batchEnrichDialogVisible = ref(false)
const batchEnrichLoading = ref(false)
const batchEnrichMode = ref('missing')
const batchEnrichDistrict = ref('')
const batchEnrichLimit = ref(50)
const batchEnrichResult = ref(null)
const dialogEnriching = ref(false)

function formatRuntime(isoStr) {
  if (!isoStr) return '-'
  const d = new Date(isoStr)
  const now = new Date()
  const diffSec = Math.floor((now - d) / 1000)
  if (diffSec < 10) return '刚刚'
  if (diffSec < 60) return `${diffSec}秒前`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

async function loadParseLogs() {
  try {
    const res = await api.get('/admin/property-settings/ai-parse-logs')
    parseLogs.value = res.data || []
  } catch {
    parseLogs.value = []
  }
}

async function clearParseLogs() {
  try {
    await ElMessageBox.confirm('确定清空所有解析日志？', '确认', { type: 'warning' })
    await api.delete('/admin/property-settings/ai-parse-logs')
    parseLogs.value = []
    ElMessage.success('日志已清空')
  } catch {}
}

function formatLogTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function normalizeFailReasons(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (Array.isArray(item) && item.length >= 2) return { reason: String(item[0] || ''), count: Number(item[1]) || 0 }
      if (item && typeof item === 'object') return { reason: String(item.reason || ''), count: Number(item.count) || 0 }
      return null
    })
    .filter((item) => item && item.reason)
    .sort((a, b) => b.count - a.count)
}

function formatFailReason(reason) {
  const msg = String(reason || '')
  if (!msg) return '-'
  if (/timeout/i.test(msg)) return 'AI请求超时'
  if (/ECONNREFUSED|ENOTFOUND|network|socket|connect/i.test(msg)) return 'AI网络连接失败'
  if (/401|403/.test(msg)) return 'API鉴权失败'
  if (/429/.test(msg)) return '请求频率过高'
  if (/5\\d\\d|server error/i.test(msg)) return 'AI服务异常'
  return msg.length > 64 ? `${msg.slice(0, 64)}...` : msg
}

function startStatsPolling() {
  stopStatsPolling()
  statsPollingTimer = setInterval(() => {
    api.get('/admin/property-settings/ai-parse-config').then(res => {
      if (res.data?.parseStats) Object.assign(parseStats, res.data.parseStats)
      if (res.data?.runtimeStats) Object.assign(runtimeStats, res.data.runtimeStats)
      if (res.data?.unparsedTimeRange) Object.assign(unparsedTimeRange, res.data.unparsedTimeRange)
    }).catch(() => {})
  }, 15000)
}

function stopStatsPolling() {
  if (statsPollingTimer) { clearInterval(statsPollingTimer); statsPollingTimer = null }
}

/* ============ 默认封面图片 ============ */
const defaultCoverUrl = ref('')
const uploadingCover = ref(false)

async function loadDefaultCover() {
  try {
    const res = await api.get('/admin/property-library/default-image')
    const data = res.data?.data || res.data || {}
    defaultCoverUrl.value = data.url || ''
  } catch { /* ignore */ }
}

async function uploadDefaultCover(options) {
  uploadingCover.value = true
  try {
    const formData = new FormData()
    formData.append('file', options.file)
    const res = await api.post('/admin/property-library/default-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    })
    const data = res.data?.data || res.data || {}
    if (data.url) {
      defaultCoverUrl.value = data.url
      ElMessage.success('默认封面图片设置成功')
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '上传失败')
  } finally {
    uploadingCover.value = false
  }
}

onBeforeUnmount(() => { stopStatsPolling() })

onMounted(async () => {
  loading.value = true
  try {
    const [d, m, cfg] = await Promise.all([
      api.get('/admin/property-settings/districts'),
      api.get('/admin/property-settings/metro-lines'),
      api.get('/admin/property-settings/ai-parse-config'),
    ])
    districts.value = d.data || []
    metroLines.value = m.data || []
    if (cfg.data) {
      aiModels.value = cfg.data.aiModels || []
      if (cfg.data.config) {
        const c = cfg.data.config
        aiConfig.ai_parse_enabled = c.ai_parse_enabled || '0'
        aiConfig.ai_parse_model_id = c.ai_parse_model_id || ''
        aiConfig.ai_parse_model_ids = Array.isArray(c.ai_parse_model_ids)
          ? c.ai_parse_model_ids.map(v => String(v))
          : []
        aiConfig.ai_parse_prompt = c.ai_parse_prompt || ''
        aiConfig.ai_parse_batch_size = c.ai_parse_batch_size || '50'
        aiConfig.ai_parse_batch_size_num = parseInt(c.ai_parse_batch_size) || 50
        aiConfig.ai_parse_multi_thread = c.ai_parse_multi_thread || '0'
        aiConfig.ai_parse_multi_thread_bool = c.ai_parse_multi_thread === '1'
        aiConfig.ai_parse_thread_count = c.ai_parse_thread_count || '8'
        aiConfig.ai_parse_thread_count_num = parseInt(c.ai_parse_thread_count) || 8
      }
      if (cfg.data.parseStats) {
        Object.assign(parseStats, cfg.data.parseStats)
      }
      if (cfg.data.unparsedTimeRange) {
        Object.assign(unparsedTimeRange, cfg.data.unparsedTimeRange)
      }
      if (cfg.data.runtimeStats) {
        Object.assign(runtimeStats, cfg.data.runtimeStats)
      }
    }
    await loadStations()
    loadDefaultCover()
  } catch (e) {
    console.error('加载内容资产设置失败:', e)
  }
  loading.value = false
})

function getLineName(lineId) {
  const line = metroLines.value.find(l => l.id === lineId)
  return line ? line.name_cn : '-'
}

function getLineColor(lineId) {
  const line = metroLines.value.find(l => l.id === lineId)
  return line ? line.line_color : '#999'
}

/* 全量站点缓存（用于统计每条线路站点数，不受筛选影响） */
const allStationsCache = ref([])

function getLineStationCount(lineId) {
  return allStationsCache.value.filter(s => s.metro_line_id === lineId || s.line_id === lineId).length
}

function toggleLineFilter(lineId) {
  stationLineFilter.value = stationLineFilter.value === lineId ? '' : lineId
  loadStations()
}

/* 区域 */
function openDistrictDialog(row = null) {
  if (row) {
    Object.assign(districtForm, { id: row.id, name_cn: row.name_cn, name_en: row.name_en, city: row.city || '', sort_order: row.sort_order || 0 })
  } else {
    Object.assign(districtForm, { id: null, name_cn: '', name_en: '', city: '', sort_order: 0 })
  }
  districtDialogVisible.value = true
}

async function saveDistrict() {
  if (!districtForm.name_cn) return ElMessage.warning('请输入中文名')
  try {
    await api.post('/admin/property-settings/districts', { ...districtForm })
    ElMessage.success('保存成功')
    districtDialogVisible.value = false
    const res = await api.get('/admin/property-settings/districts')
    districts.value = res.data || []
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  }
}

async function deleteDistrict(id) {
  try {
    await ElMessageBox.confirm('确定删除该区域？', '确认', { type: 'warning' })
    await api.delete(`/admin/property-settings/districts/${id}`)
    districts.value = districts.value.filter(d => d.id !== id)
    ElMessage.success('删除成功')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

/* 地铁线路 */
function openMetroLineDialog(row = null) {
  if (row) {
    Object.assign(metroLineForm, { id: row.id, name_cn: row.name_cn, name_en: row.name_en, line_color: row.line_color || '#1890ff', sort_order: row.sort_order || 0 })
  } else {
    Object.assign(metroLineForm, { id: null, name_cn: '', name_en: '', line_color: '#1890ff', sort_order: 0 })
  }
  metroLineDialogVisible.value = true
}

async function saveMetroLine() {
  if (!metroLineForm.name_cn) return ElMessage.warning('请输入中文名')
  try {
    await api.post('/admin/property-settings/metro-lines', { ...metroLineForm })
    ElMessage.success('保存成功')
    metroLineDialogVisible.value = false
    const res = await api.get('/admin/property-settings/metro-lines')
    metroLines.value = res.data || []
    await loadStations()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  }
}

async function deleteMetroLine(id) {
  const line = metroLines.value.find(l => l.id === id)
  const stationCount = getLineStationCount(id)
  const msg = stationCount > 0
    ? `确定删除「${line?.name_cn || '该线路'}」？该线路下 ${stationCount} 个站点也将被一并删除`
    : `确定删除「${line?.name_cn || '该线路'}」？`
  try {
    await ElMessageBox.confirm(msg, '确认删除', { type: 'warning', confirmButtonText: '确定删除', cancelButtonText: '取消' })
    await api.delete(`/admin/property-settings/metro-lines/${id}`)
    metroLines.value = metroLines.value.filter(l => l.id !== id)
    if (stationLineFilter.value === id) stationLineFilter.value = ''
    await loadStations()
    ElMessage.success('删除成功')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

/* 地铁站点 */
async function loadStations() {
  stationLoading.value = true
  try {
    const params = stationLineFilter.value ? { metro_line_id: stationLineFilter.value } : {}
    const res = await api.get('/admin/property-settings/metro-stations', { params })
    metroStations.value = res.data || []
    if (!stationLineFilter.value) {
      allStationsCache.value = res.data || []
    }
  } catch (e) {
    console.error('加载站点失败:', e)
  }
  stationLoading.value = false
}

function openStationDialog(row = null) {
  if (row) {
    Object.assign(stationForm, { id: row.id, metro_line_id: row.metro_line_id, name_cn: row.name_cn, name_en: row.name_en, sort_order: row.sort_order || 0 })
  } else {
    Object.assign(stationForm, { id: null, metro_line_id: stationLineFilter.value || '', name_cn: '', name_en: '', sort_order: 0 })
  }
  stationDialogVisible.value = true
}

async function saveStation() {
  if (!stationForm.name_cn) return ElMessage.warning('请输入中文名')
  if (!stationForm.metro_line_id) return ElMessage.warning('请选择所属线路')
  try {
    await api.post('/admin/property-settings/metro-stations', { ...stationForm })
    ElMessage.success('保存成功')
    stationDialogVisible.value = false
    await loadStations()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  }
}

async function deleteStation(id) {
  try {
    await ElMessageBox.confirm('确定删除该站点？', '确认', { type: 'warning' })
    await api.delete(`/admin/property-settings/metro-stations/${id}`)
    metroStations.value = metroStations.value.filter(s => s.id !== id)
    ElMessage.success('删除成功')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

/* AI配置 */
const currentAIModel = computed(() => {
  if (!aiConfig.ai_parse_model_id) return null
  return aiModels.value.find(m => String(m.id) === String(aiConfig.ai_parse_model_id))
})

async function saveAIConfig() {
  aiSaving.value = true
  try {
    await api.post('/admin/property-settings/ai-parse-config', {
      ai_parse_enabled: aiConfig.ai_parse_enabled,
      ai_parse_model_id: aiConfig.ai_parse_model_id,
      ai_parse_model_ids: (aiConfig.ai_parse_model_ids || []).filter(id => String(id) !== String(aiConfig.ai_parse_model_id || '')),
      ai_parse_prompt: aiConfig.ai_parse_prompt,
      ai_parse_batch_size: String(aiConfig.ai_parse_batch_size_num),
      ai_parse_multi_thread: aiConfig.ai_parse_multi_thread_bool ? '1' : '0',
      ai_parse_thread_count: String(aiConfig.ai_parse_thread_count_num),
    })
    ElMessage.success('保存成功')
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  }
  aiSaving.value = false
}

function resetAIPrompt() {
  ElMessageBox.confirm('确定恢复默认提示词？当前提示词将被覆盖', '确认', { type: 'warning' })
    .then(() => {
      aiConfig.ai_parse_prompt = DEFAULT_AI_PROMPT
      ElMessage.info('已恢复默认提示词，请点击保存生效')
    })
    .catch(() => {})
}

const DEFAULT_AI_PROMPT = `你是上海内容资产信息提取专家。请严格按规则提取信息，返回JSON格式。

【户型识别规则】
- X/Y/Z格式(如1/2/1) → bedrooms:1(第一个数), livingrooms:2(第二个数), bathrooms:1(第三个数)
- 1房1厅1卫 → bedrooms:1, livingrooms:1, bathrooms:1
- 3室1厅 → bedrooms:3, livingrooms:1, bathrooms:1
- 1房2厅(无卫信息) → bedrooms:1, livingrooms:2, bathrooms:1
- 3bedroom +2bathroom → bedrooms:3, bathrooms:2
- Xbedroom = bedrooms数字, Xbathroom = bathrooms数字
- 注意：2/3/4/13号线是地铁线路，不是户型！不要将地铁线路数字当作卧室或卫生间数！
- 楼层数字(如6/15)不是卧室数！

【价格识别规则】
- XK = X*1000 (如5.2K=5200)
- X万/月 = X*10000 (如2.8万=28000)
- 月租范围1500-200000

【JSON格式】
{
  "district": "区名",
  "community": "小区名",
  "bedrooms": 数字,
  "livingrooms": 数字,
  "bathrooms": 数字,
  "area_sqm": 数字,
  "price": "价格文本",
  "price_value": 数字,
  "metro_lines": "X号线,Y号线",
  "metro_stations": "站点名",
  "contact_info": "联系方式"
}

内容资产描述：
{CONTENT}`

/* ============ 小区POI数据 ============ */
async function loadCommunityPOI() {
  poiLoading.value = true
  try {
    const params = { page: poiPage.value, pageSize: poiPageSize.value }
    if (poiSearch.value) params.search = poiSearch.value
    if (poiNameOnly.value) params.nameOnly = '1'
    if (poiDistrictFilter.value) params.district = poiDistrictFilter.value
    if (poiMetroFilter.value) params.hasMetro = poiMetroFilter.value
    if (poiDateRange.value && poiDateRange.value.length === 2) {
      params.dateStart = poiDateRange.value[0]
      params.dateEnd = poiDateRange.value[1]
    }
    const res = await api.get('/admin/property-settings/community-poi', { params })
    communityPOIList.value = res.data?.data || []
    poiTotal.value = res.data?.total || 0
  } catch (e) {
    console.error('加载POI数据失败:', e)
  }
  poiLoading.value = false
}

function openPOIRecycleBin() {
  poiRecycleVisible.value = true
  poiRecyclePage.value = 1
  loadPOIRecycleBin()
}

async function loadPOIRecycleBin() {
  poiRecycleLoading.value = true
  try {
    const params = { page: poiRecyclePage.value, pageSize: poiRecyclePageSize.value }
    if (poiRecycleSearch.value) params.search = poiRecycleSearch.value
    if (poiRecycleDistrict.value) params.district = poiRecycleDistrict.value
    const res = await api.get('/admin/property-settings/community-poi-recycle-bin', { params })
    poiRecycleList.value = res.data?.data || []
    poiRecycleTotal.value = res.data?.total || 0
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || '加载POI回收站失败')
  }
  poiRecycleLoading.value = false
}

const SOURCE_CONFIG = [
  { key: 'manual', label: 'POI手动添加', color: '#2F80ED' },
  { key: 'manual_import', label: '朋友圈一键导入', color: '#27AE60' },
  { key: 'csv_import', label: 'CSV文件导入', color: '#E6A23C' },
  { key: 'excel_import', label: 'Excel文件导入', color: '#9B59B6' },
  { key: 'auto', label: '自动更新（已禁止）', color: '#EB5757' },
  { key: 'other', label: '其他', color: '#909399' },
]
const sourceTableData = computed(() => {
  const sb = poiStats.sourceBreakdown
  if (!sb) return []
  return SOURCE_CONFIG
    .filter(c => sb[c.key] && sb[c.key].total > 0)
    .map(c => ({
      ...c,
      data: sb[c.key],
      today: sb[c.key].today,
      week: sb[c.key].week,
      month: sb[c.key].month,
      total: sb[c.key].total,
    }))
})

function sourceTableSummary({ columns, data }) {
  const sums = []
  columns.forEach((col, idx) => {
    if (idx === 0) { sums[idx] = '合计'; return }
    const prop = col.property
    if (prop && data.length > 0) {
      sums[idx] = data.reduce((acc, row) => acc + (Number(row[prop]) || 0), 0)
    } else {
      sums[idx] = ''
    }
  })
  return sums
}

async function loadPOIStats() {
  try {
    const res = await api.get('/admin/property-settings/community-poi-stats')
    if (res.data) {
      poiStats.summary = res.data.summary
      poiStats.districts = res.data.districts || []
      poiStats.timeStats = res.data.timeStats || null
      poiStats.sourceBreakdown = res.data.sourceBreakdown || null
      poiDistrictOptions.value = res.data.districts || []
    }
  } catch (e) {
    console.error('加载POI统计失败:', e)
  }
}

function formatDate(dt) {
  if (!dt) return '-'
  const d = new Date(dt)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${m}-${day} ${h}:${min}`
}

function sourceLabel(s) {
  const map = { manual: '手动', manual_import: '一键导入', csv_import: 'CSV', fangtianxia_csv: 'CSV', national_poi_excel: 'Excel', auto_parse: '自动', auto_enrich: '自动', auto_calibrate: '自动' }
  return map[s] || s || '-'
}

function sourceTagType(s) {
  if (s === 'manual') return ''
  if (s === 'manual_import') return 'success'
  if (s === 'csv_import' || s === 'fangtianxia_csv') return 'warning'
  if (s === 'national_poi_excel') return 'warning'
  if (s === 'auto_parse' || s === 'auto_enrich' || s === 'auto_calibrate') return 'danger'
  return 'info'
}

function jumpToDistrict(district) {
  poiDistrictFilter.value = district
  poiSubTab.value = 'poiList'
  loadCommunityPOI()
}

function openPOIDialog(row = null) {
  if (row) {
    Object.assign(poiForm, {
      id: row.id, community_name: row.community_name, district: row.district,
      board: row.board || '', alias_names: row.alias_names || '',
      address: row.address || '', latitude: row.latitude || '', longitude: row.longitude || '',
      property_type: row.property_type || '住宅',
      nearest_metro_line: row.nearest_metro_line || '', nearest_metro_station: row.nearest_metro_station || '',
      nearest_metro_distance: row.nearest_metro_distance || null,
      ref_price_min: row.ref_price_min || null, ref_price_max: row.ref_price_max || null,
      is_enabled: row.is_enabled ?? 1
    })
    poiAliasArr.value = parseAliases(row.alias_names)
  } else {
    Object.assign(poiForm, {
      id: null, community_name: '', district: '', board: '', alias_names: '',
      address: '', latitude: '', longitude: '', property_type: '住宅',
      nearest_metro_line: '', nearest_metro_station: '', nearest_metro_distance: null,
      ref_price_min: null, ref_price_max: null, is_enabled: 1
    })
    poiAliasArr.value = []
  }
  newAliasInput.value = ''
  poiDialogVisible.value = true
}

async function savePOI() {
  if (!poiForm.community_name) return ElMessage.warning('请输入小区名称')
  if (!poiForm.district) return ElMessage.warning('请选择所属区域')
  syncAliasesToForm()
  try {
    await api.post('/admin/property-settings/community-poi', { ...poiForm })
    ElMessage.success('保存成功')
    poiDialogVisible.value = false
    await loadCommunityPOI()
    await loadPOIStats()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  }
}

async function deletePOI(id) {
  try {
    await ElMessageBox.confirm('确定删除该小区数据？', '确认', { type: 'warning' })
    await api.delete(`/admin/property-settings/community-poi/${id}`)
    communityPOIList.value = communityPOIList.value.filter(p => p.id !== id)
    poiTotal.value--
    ElMessage.success('已移入回收站')
    await loadPOIStats()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}

async function batchDeletePOI() {
  if (poiSelectedIds.value.length === 0) return
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${poiSelectedIds.value.length} 条小区数据？此操作不可撤销`, '批量删除', { type: 'warning' })
    await api.post('/admin/property-settings/community-poi/batch-delete', { ids: poiSelectedIds.value })
    ElMessage.success(`已移入回收站 ${poiSelectedIds.value.length} 条记录`)
    poiSelectedIds.value = []
    await loadCommunityPOI()
    await loadPOIStats()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.message || '批量删除失败')
  }
}

async function restorePOI(row) {
  try {
    await ElMessageBox.confirm(`确定恢复「${row.community_name}」吗？`, '恢复POI', { type: 'info' })
    await api.post(`/admin/property-settings/community-poi/${row.id}/restore`)
    ElMessage.success('恢复成功')
    await loadPOIRecycleBin()
    await loadCommunityPOI()
    await loadPOIStats()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.response?.data?.message || e?.message || '恢复失败')
  }
}

function showImportDialog() {
  importResult.value = null
  csvFile.value = null
  importClearOld.value = false
  importDialogVisible.value = true
}

function onCSVFileChange(file) {
  csvFile.value = file?.raw || null
}

async function doImportCSV() {
  if (!csvFile.value) return ElMessage.warning('请选择CSV文件')

  if (importClearOld.value) {
    try {
      await ElMessageBox.confirm('确定清除所有旧数据后再导入？此操作不可撤销', '警告', { type: 'warning' })
    } catch { return }
  }

  importLoading.value = true
  try {
    const formData = new FormData()
    formData.append('file', csvFile.value)
    formData.append('clearOld', importClearOld.value ? 'true' : 'false')
    const res = await api.post('/admin/property-settings/community-poi/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })
    importResult.value = res.data
    ElMessage.success(res.message || '导入完成')
    await loadCommunityPOI()
    await loadPOIStats()
  } catch (e) {
    ElMessage.error(e?.message || '导入失败')
  }
  importLoading.value = false
}

/* ============ Excel导入 ============ */
function showExcelImportDialog() {
  excelImportResult.value = null
  excelFile.value = null
  excelImportDialogVisible.value = true
}

function onExcelFileChange(file) {
  excelFile.value = file?.raw || null
}

async function doImportExcel() {
  if (!excelFile.value) return ElMessage.warning('请选择Excel文件')
  excelImportLoading.value = true
  try {
    const formData = new FormData()
    formData.append('file', excelFile.value)
    const res = await api.post('/admin/property-settings/community-poi/import-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    })
    excelImportResult.value = res.data
    ElMessage.success(res.message || '导入完成')
    await loadCommunityPOI()
    await loadPOIStats()
  } catch (e) {
    ElMessage.error(e?.message || '导入失败')
  }
  excelImportLoading.value = false
}

/* ============ 高德一键补充 ============ */

async function enrichSinglePOI(row, forceMode = false) {
  row._enriching = true
  try {
    const endpoint = forceMode
      ? `/admin/property-settings/community-poi/${row.id}/enrich-force`
      : `/admin/property-settings/community-poi/${row.id}/enrich`
    const res = await api.post(endpoint, {}, { timeout: 30000 })
    if (res.data?.notFound) {
      ElMessage.warning(res.data.message || `高德地图未找到「${row.community_name}」，请手动填写信息`)
    } else if (res.data?.enriched && Object.keys(res.data.enriched).length > 0) {
      Object.assign(row, res.data.enriched)
      ElMessage.success(`${row.community_name}：成功${forceMode ? '重新获取' : '补充'} ${res.data.fieldsUpdated} 项信息`)
    } else if (!forceMode) {
      row._enriching = false
      try {
        await ElMessageBox.confirm(
          `「${row.community_name}」信息已完整。如果现有数据有误，是否强制从高德重新获取并覆盖？`,
          '信息已完整', { confirmButtonText: '强制重新获取', cancelButtonText: '取消', type: 'warning' }
        )
        return enrichSinglePOI(row, true)
      } catch { return }
    } else {
      ElMessage.info('高德地图未查到更多信息')
    }
  } catch (e) {
    ElMessage.error(`补充失败：${e?.message || '请求错误'}`)
  }
  row._enriching = false
}

async function enrichFromDialog() {
  if (!poiForm.community_name) return ElMessage.warning('请输入小区名称')
  dialogEnriching.value = true
  try {
    const searchAddr = `上海${poiForm.district || ''}${poiForm.community_name}`
    let apiUrl, postData
    if (poiForm.id) {
      apiUrl = `/admin/property-settings/community-poi/${poiForm.id}/enrich-force`
      postData = {}
    } else {
      await savePOI()
      await loadCommunityPOI()
      const newRow = communityPOIList.value.find(r => r.community_name === poiForm.community_name && r.district === poiForm.district)
      if (newRow) {
        apiUrl = `/admin/property-settings/community-poi/${newRow.id}/enrich-force`
        postData = {}
        poiForm.id = newRow.id
      } else {
        dialogEnriching.value = false
        return
      }
    }

    const res = await api.post(apiUrl, postData, { timeout: 30000 })
    if (res.data?.notFound) {
      ElMessage.warning(res.data.message || '高德地图未找到该小区，请手动填写信息')
      dialogEnriching.value = false
      return
    }
    if (res.data?.enriched) {
      const e = res.data.enriched
      if (e.district) poiForm.district = e.district
      if (e.board) poiForm.board = e.board
      if (e.address) poiForm.address = e.address
      if (e.latitude) poiForm.latitude = e.latitude
      if (e.longitude) poiForm.longitude = e.longitude
      if (e.nearest_metro_station) poiForm.nearest_metro_station = e.nearest_metro_station
      if (e.nearest_metro_line) poiForm.nearest_metro_line = e.nearest_metro_line
      if (e.nearest_metro_distance) poiForm.nearest_metro_distance = e.nearest_metro_distance
      if (e.street) poiForm.street = e.street
      ElMessage.success(`成功补充 ${res.data.fieldsUpdated} 项信息`)
    } else {
      ElMessage.info('高德地图未查到更多信息')
    }
  } catch (e) {
    ElMessage.error(`补充失败：${e?.message || '请求错误'}`)
  }
  dialogEnriching.value = false
}

function showBatchEnrichDialog() {
  batchEnrichResult.value = null
  batchEnrichDialogVisible.value = true
}

async function doBatchEnrich() {
  batchEnrichLoading.value = true
  batchEnrichResult.value = null
  try {
    const res = await api.post('/admin/property-settings/community-poi/batch-enrich', {
      mode: batchEnrichMode.value,
      district: batchEnrichDistrict.value,
      limit: batchEnrichLimit.value,
    }, { timeout: 300000 })
    batchEnrichResult.value = res.data
    ElMessage.success(res.message || '批量补充完成')
    await loadCommunityPOI()
    await loadPOIStats()
  } catch (e) {
    ElMessage.error(`批量补充失败：${e?.message || '请求错误'}`)
  }
  batchEnrichLoading.value = false
}

/* 切换tab时自动加载数据 */
watch(activeTab, (val) => {
  if (val === 'communityPOI' && communityPOIList.value.length === 0) {
    loadCommunityPOI()
    loadPOIStats()
  }
  if (val === 'rentalCompanies' && rentalCompanies.value.length === 0) {
    loadRentalCompanies()
  }
  if (val === 'publisherContacts' && publisherContacts.value.length === 0) {
    loadPublisherContacts()
  }
  if (val === 'aiConfig') {
    api.get('/admin/property-settings/ai-parse-config').then(res => {
      if (res.data?.parseStats) Object.assign(parseStats, res.data.parseStats)
      if (res.data?.runtimeStats) Object.assign(runtimeStats, res.data.runtimeStats)
      if (res.data?.unparsedTimeRange) Object.assign(unparsedTimeRange, res.data.unparsedTimeRange)
    }).catch(() => {})
    loadParseLogs()
    startStatsPolling()
  } else {
    stopStatsPolling()
  }
})

watch(poiSubTab, (val) => {
  if (val === 'aliasMap' && aliasList.value.length === 0) {
    loadAliasList()
    loadAliasDistricts()
  }
})
</script>

<style scoped>
.page-header { margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 600; margin: 0; display: flex; align-items: center; }
.card-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.mb-3 { margin-bottom: 16px; }
.mt-3 { margin-top: 16px; }
.me-1 { margin-right: 4px; }
.me-2 { margin-right: 8px; }
.d-flex { display: flex; }
.justify-content-between { justify-content: space-between; }
.justify-content-end { justify-content: flex-end; }
.align-items-center { align-items: center; }
.gap-2 { gap: 8px; }
.flex-wrap { flex-wrap: wrap; }
.text-muted { color: #999; }

/* 地铁线路概览区域 */
.metro-lines-overview {
  background: linear-gradient(135deg, #f8faff 0%, #f0f5ff 100%);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e0eaff;
}
.metro-section-title {
  font-weight: 600;
  font-size: 14px;
  color: #333;
}
.metro-line-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.metro-line-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid #e0e0e0;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
}
.metro-line-chip:hover {
  border-color: #b0c4ff;
  box-shadow: 0 2px 8px rgba(47,128,237,0.12);
  transform: translateY(-1px);
}
.metro-line-chip.is-active {
  border-color: #2F80ED;
  background: #eaf2ff;
  box-shadow: 0 2px 8px rgba(47,128,237,0.18);
}
.chip-color {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.chip-label {
  font-weight: 600;
  color: #333;
  white-space: nowrap;
}
.chip-en {
  color: #999;
  font-size: 11px;
  white-space: nowrap;
}
.chip-count {
  font-size: 11px;
  color: #2F80ED;
  background: #eaf2ff;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 600;
  white-space: nowrap;
}
.metro-line-chip.is-active .chip-count {
  background: #d0e0ff;
}
.chip-actions {
  display: none;
  align-items: center;
  gap: 4px;
  margin-left: 2px;
}
.metro-line-chip:hover .chip-actions {
  display: inline-flex;
}
.metro-line-chip:hover .chip-en {
  display: none;
}
.chip-action-btn {
  font-size: 11px;
  color: #909399;
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  transition: all 0.2s;
}
.chip-action-btn:hover {
  color: #2F80ED;
  background: rgba(47,128,237,0.08);
}
.chip-action-delete:hover {
  color: #EB5757;
  background: rgba(235,87,87,0.08);
}
/* 站点所属线路彩色标签 */
.station-line-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0,0,0,0.15);
}
@media (max-width: 768px) {
  .metro-line-chips { gap: 6px; }
  .metro-line-chip { padding: 4px 8px; font-size: 12px; }
  .chip-en { display: none; }
}

.poi-stats-bar {
  display: flex;
  gap: 24px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f0f7ff 0%, #e8f4f8 100%);
  border-radius: 8px;
  border: 1px solid #d9ecff;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-num {
  font-size: 22px;
  font-weight: 700;
  color: #2F80ED;
  line-height: 1.2;
}
.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.metro-info-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}
.metro-line-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  background: #2F80ED;
  color: #fff;
  white-space: nowrap;
}
.coord-cell {
  font-size: 12px;
  line-height: 1.4;
}
.coord-value {
  color: #409EFF;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 11px;
}
.alias-tags-cell { display: flex; flex-wrap: wrap; gap: 3px; }
.alias-tag-item { font-size: 11px !important; }
.alias-input-wrap { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.alias-edit-tag { margin: 0; }
/* POI子Tab样式 */
.poi-card-container {
  padding-top: 0 !important;
}
.poi-sub-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
  border-bottom: 2px solid #e8e8e8;
}
.poi-sub-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.poi-sub-tabs :deep(.el-tabs__item) {
  font-size: 14px;
  padding: 0 20px;
  height: 38px;
  line-height: 38px;
}
.poi-sub-tabs :deep(.el-tabs__item.is-active) {
  font-weight: 600;
  color: #2F80ED;
}

/* 区域分布 */
.poi-district-stats {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.district-stats-grid {
  padding: 16px 20px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 24px;
}
.district-stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}
.district-stat-item:hover {
  background: #f0f7ff;
}
.district-name {
  width: 70px;
  flex-shrink: 0;
  font-size: 13px;
  color: #333;
}
.district-bar-wrap {
  flex: 1;
  height: 14px;
  background: #f0f0f0;
  border-radius: 7px;
  overflow: hidden;
}
.district-bar {
  height: 100%;
  background: linear-gradient(90deg, #2F80ED, #56CCF2);
  border-radius: 7px;
  transition: width 0.5s ease;
}
.district-count {
  width: 50px;
  flex-shrink: 0;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: #2F80ED;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
}
@media (max-width: 768px) {
  .district-stats-grid {
    grid-template-columns: 1fr;
  }
}

/* 时间维度数据统计 */
.poi-time-stats {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.time-stats-title {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
}
.text-success-val { color: #27AE60; }
.text-danger-val { color: #EB5757; }

/* 来源明细表 */
.source-table {
  margin: 0;
}
.source-table :deep(.el-table__footer td) {
  font-weight: 700;
  font-size: 14px;
  color: #2F80ED;
  background: #f0f7ff !important;
}
.source-table :deep(.el-table__footer td:first-child .cell) {
  color: #333;
}
.source-label-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.source-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.num-highlight {
  font-size: 15px;
  font-weight: 700;
  color: #2F80ED;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
}
.num-zero {
  font-size: 14px;
  color: #c0c4cc;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
}
.num-total {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
}

/* 删除统计卡片 */
.time-stats-grid-delete {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
}
.time-stat-card-mini {
  text-align: center;
  padding: 16px 12px;
  border-right: 1px solid #f0f0f0;
}
.time-stat-card-mini:last-child { border-right: none; }
.time-stat-header-mini {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.time-stat-num-mini {
  font-size: 22px;
  font-weight: 700;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
}
@media (max-width: 576px) {
  .time-stats-grid-delete {
    grid-template-columns: 1fr;
  }
  .time-stat-card-mini {
    border-right: none;
    border-bottom: 1px solid #f0f0f0;
  }
  .time-stat-card-mini:last-child { border-bottom: none; }
}

.import-dialog-content :deep(.el-upload-dragger) {
  padding: 30px 20px;
}

/* AI解析配置样式 */
.ai-parse-alert {
  padding: 12px 16px;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #333;
}
.ai-parse-layout {
  display: flex;
  gap: 16px;
}
.ai-parse-left { flex: 1; min-width: 0; }
.ai-parse-right { width: 320px; flex-shrink: 0; }
@media (max-width: 992px) {
  .ai-parse-layout { flex-direction: column; }
  .ai-parse-right { width: 100%; }
}
.ai-card {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.ai-card-header {
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}
.ai-card-header.bg-primary { background: #2F80ED; }
.ai-card-header.bg-success { background: #27AE60; }
.ai-card-header.bg-info { background: #17a2b8; }
.ai-card-body {
  padding: 16px;
}
.ai-card-inner {
  border: 1px solid #6f42c1;
  border-radius: 6px;
  overflow: hidden;
}
.ai-card-inner-header {
  padding: 8px 14px;
  background: linear-gradient(135deg, #6f42c1 0%, #9b59b6 100%);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}
.ai-card-inner-body {
  padding: 12px 14px;
}
.ai-perf-info {
  font-size: 12px;
  color: #666;
  padding: 8px 10px;
  background: #f0f7ff;
  border-radius: 4px;
}
.ai-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.ai-stat-item {
  text-align: center;
  padding: 8px;
  background: #fafafa;
  border-radius: 6px;
}
.ai-stat-num {
  font-size: 20px;
  font-weight: 700;
  color: #333;
  line-height: 1.2;
}
.ai-stat-num.text-success { color: #27AE60; }
.ai-stat-num.text-warning { color: #E6A23C; }
.ai-stat-num.text-info { color: #17a2b8; }
.ai-stat-num.text-primary { color: #2F80ED; }
.ai-stat-label {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}
.ai-progress-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}
.runtime-stats {
  background: #f0f7ff;
  border: 1px solid #d0e3f7;
  border-radius: 6px;
  padding: 10px 12px;
}
.runtime-stats-title {
  font-size: 13px;
  font-weight: 600;
  color: #2F80ED;
  margin-bottom: 8px;
}
.runtime-stats-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  line-height: 22px;
  color: #555;
}
.runtime-stats-row span:first-child {
  color: #888;
}
.runtime-fail-reasons {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #d7e6f5;
}
.runtime-fail-title {
  font-size: 12px;
  color: #666;
  margin-bottom: 6px;
}
.runtime-fail-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.runtime-fail-tag {
  background: #fdf6ec;
  color: #8a5a15;
  border: 1px solid #f3d19e;
  border-radius: 3px;
  font-size: 11px;
  line-height: 18px;
  padding: 0 6px;
}
.parse-log-item {
  padding: 6px 8px;
  border-radius: 4px;
  margin-bottom: 4px;
  font-size: 12px;
  border-left: 3px solid #ddd;
  background: #fafafa;
}
.parse-log-info { border-left-color: #2F80ED; background: #f0f7ff; }
.parse-log-warning { border-left-color: #e6a23c; background: #fdf6ec; }
.parse-log-error { border-left-color: #f56c6c; background: #fef0f0; }
.parse-log-time {
  color: #999;
  font-size: 11px;
  margin-bottom: 2px;
}
.parse-log-msg {
  color: #333;
  line-height: 1.4;
  word-break: break-all;
}
.parse-log-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 3px;
  font-size: 11px;
  color: #888;
}
.parse-log-meta span {
  background: #f0f0f0;
  padding: 1px 6px;
  border-radius: 3px;
}
.parse-log-fail-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.parse-log-fail-tag {
  font-size: 11px;
  line-height: 18px;
  background: #fef0f0;
  color: #b25252;
  border: 1px solid #f8c6c6;
  border-radius: 3px;
  padding: 0 6px;
}
.form-label { display: block; margin-bottom: 6px; font-size: 13px; }
.fw-bold { font-weight: 600; }
.form-text { font-size: 12px; color: #909399; margin-top: 4px; }
.default-cover-section { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 32px 0; }
.default-cover-preview { width: 240px; height: 180px; border-radius: 8px; border: 1px solid #eee; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.default-cover-preview img { width: 100%; height: 100%; object-fit: cover; }
.default-cover-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 240px; height: 180px; border-radius: 8px; border: 2px dashed #ddd; color: #ccc; }
.default-cover-empty i { font-size: 48px; margin-bottom: 8px; }
.default-cover-empty p { font-size: 13px; margin: 0; }
</style>
