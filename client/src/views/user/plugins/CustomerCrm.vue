<template>
  <div class="crm-plugin">
    <!-- 统计卡片 -->
    <div class="crm-stats-bar">
      <div class="stat-item" :class="{ active: filterStatus === '' }" @click="onStatClick('')">
        <div class="stat-num">{{ stats.total }}</div>
        <div class="stat-label">全部客户</div>
      </div>
      <div class="stat-item" :class="{ active: filterStatus === 'active' }" @click="onStatClick('active')">
        <div class="stat-num text-primary">{{ stats.active }}</div>
        <div class="stat-label">跟进中</div>
      </div>
      <div class="stat-item" :class="{ active: filterStatus === 'potential' }" @click="onStatClick('potential')">
        <div class="stat-num text-warning">{{ stats.potential }}</div>
        <div class="stat-label">潜在客户</div>
      </div>
      <div class="stat-item" :class="{ active: filterStatus === 'deal' }" @click="onStatClick('deal')">
        <div class="stat-num text-success">{{ stats.deal }}</div>
        <div class="stat-label">已成交</div>
      </div>
      <div class="stat-item" :class="{ active: filterStatus === 'lost' }" @click="onStatClick('lost')">
        <div class="stat-num" style="color:#999">{{ stats.lost }}</div>
        <div class="stat-label">已流失</div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="crm-toolbar">
      <div class="toolbar-filters">
        <el-input v-model="keyword" placeholder="搜索客户姓名/手机/微信..." clearable size="small" style="width:200px" @input="debounceSearch" @clear="loadClients" />
        <el-select v-model="filterStatus" placeholder="全部状态" clearable size="small" style="width:120px" @change="loadClients">
          <el-option label="全部状态" value="" />
          <el-option label="跟进中" value="active" />
          <el-option label="潜在客户" value="potential" />
          <el-option label="已成交" value="deal" />
          <el-option label="已流失" value="lost" />
        </el-select>
        <el-date-picker v-model="filterDateRange" type="daterange" range-separator="-" start-placeholder="咨询开始" end-placeholder="咨询结束" size="small" style="width:240px" value-format="YYYY-MM-DD" @change="onDatePickerChange" />
        <div class="date-shortcuts">
          <el-button size="small" :type="activeDateShortcut === 'today' ? 'primary' : ''" @click="setDateShortcut('today')" plain>今天</el-button>
          <el-button size="small" :type="activeDateShortcut === 'week' ? 'primary' : ''" @click="setDateShortcut('week')" plain>本周</el-button>
          <el-button size="small" :type="activeDateShortcut === 'month' ? 'primary' : ''" @click="setDateShortcut('month')" plain>本月</el-button>
        </div>
      </div>
      <div class="toolbar-right">
        <el-button type="primary" size="small" @click="openAddForm"><i class="fas fa-plus me-1"></i>添加客户</el-button>
      </div>
    </div>

    <!-- 客户列表（表格） -->
    <div class="crm-table-wrap">
      <el-table :data="clients" stripe :row-class-name="tableRowClass" @row-click="openDetail" empty-text="暂无客户数据" class="crm-table" size="small">
        <el-table-column label="" width="30" align="center">
          <template #default="{ $index }">
            <i class="fas fa-grip-vertical drag-handle" @click.stop @mousedown="startDrag($index, $event)"></i>
          </template>
        </el-table-column>
        <el-table-column label="客户" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="cell-client">
              <div class="cell-avatar" :class="'status-' + (row.status || 'potential')">{{ (row.name || '?')[0] }}</div>
              <div class="cell-client-info">
                <div class="cell-name-row">
                  <span class="cell-name">{{ row.name }}</span>
                  <i v-if="row.is_pinned" class="fas fa-thumbtack pin-icon" title="已置顶"></i>
                  <span v-if="row.importance" class="importance-stars"><i v-for="s in row.importance" :key="s" class="fas fa-star"></i></span>
                </div>
                <div class="cell-contact">
                  <span v-if="row.phone"><i class="fas fa-phone"></i>{{ row.phone }}</span>
                  <span v-if="row.wechat"><i class="fab fa-weixin"></i>{{ row.wechat }}</span>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="70" align="center">
          <template #default="{ row }">
            <span class="status-tag" :class="'tag-' + (row.status || 'potential')">{{ statusText(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="国籍" width="60" align="center" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.nationality || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="预算(元/月)" width="120" align="center">
          <template #default="{ row }">
            <span v-if="row.demand_budget_min || row.demand_budget_max" class="cell-price">
              ¥{{ row.demand_budget_min ? Number(row.demand_budget_min).toLocaleString() : '?' }}-{{ row.demand_budget_max ? Number(row.demand_budget_max).toLocaleString() : '?' }}
            </span>
            <span v-else class="cell-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column label="卧" width="42" align="center">
          <template #default="{ row }">
            <span v-if="row.demand_bedrooms" class="cell-num">{{ row.demand_bedrooms }}</span>
            <span v-else class="cell-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="56" align="center">
          <template #default="{ row }">
            <span v-if="row.demand_property_type" class="cell-type">{{ propertyTypeText(row.demand_property_type) }}</span>
            <span v-else class="cell-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column label="区域" width="72" align="center" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.demand_district">{{ row.demand_district }}</span>
            <span v-else class="cell-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column label="地铁线路" width="120">
          <template #default="{ row }">
            <div v-if="row.demand_metro_lines?.length" class="metro-tags">
              <span v-for="line in row.demand_metro_lines" :key="line" class="metro-line-tag" :style="{ background: getMetroColor(line) }">{{ line }}</span>
            </div>
            <span v-else class="cell-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column label="地铁站" width="100" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.demand_metro_stations?.length" class="cell-station">{{ row.demand_metro_stations.join(', ') }}</span>
            <span v-else class="cell-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column label="电梯" width="42" align="center">
          <template #default="{ row }">
            <span v-if="row.demand_has_elevator" class="badge-green">有</span>
            <span v-else class="badge-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column label="车位" width="42" align="center">
          <template #default="{ row }">
            <span v-if="row.demand_has_parking" class="badge-green">有</span>
            <span v-else class="badge-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column label="户外" width="90">
          <template #default="{ row }">
            <div v-if="row.demand_outdoor_features?.length" class="outdoor-tags">
              <span v-for="feat in row.demand_outdoor_features" :key="feat" class="badge-outdoor" :class="outdoorBadgeClass(feat)">{{ outdoorText(feat) }}</span>
            </div>
            <span v-else class="cell-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column label="租期" width="60" align="center">
          <template #default="{ row }">
            <span v-if="row.rental_duration">{{ durationText(row.rental_duration) }}</span>
            <span v-else class="cell-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" align="center" fixed="right">
          <template #default="{ row, $index }">
            <div class="table-actions" @click.stop>
              <el-tooltip content="置顶" placement="top"><button class="act-btn" :class="{ active: row.is_pinned }" @click="togglePin(row)"><i class="fas fa-thumbtack"></i></button></el-tooltip>
              <el-tooltip content="跟进" placement="top"><button class="act-btn" @click="openFollowup(row)"><i class="fas fa-comment-dots"></i></button></el-tooltip>
              <el-tooltip content="编辑" placement="top"><button class="act-btn" @click="openEditForm(row)"><i class="fas fa-edit"></i></button></el-tooltip>
              <el-tooltip content="删除" placement="top"><button class="act-btn danger" @click="deleteClient(row)"><i class="fas fa-trash"></i></button></el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!clients.length" class="empty-state">
        <i class="fas fa-users"></i>
        <p>暂无客户数据</p>
        <el-button type="primary" size="small" @click="openAddForm">添加第一个客户</el-button>
      </div>
    </div>

    <!-- 添加/编辑客户弹窗 -->
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="modal-box crm-form-modal">
        <div class="modal-header">
          <h5>{{ editingId ? '编辑客户' : '添加客户' }}</h5>
          <button class="btn-close" @click="showForm = false"></button>
        </div>
        <div class="modal-body">
          <el-tabs v-model="formTab">
            <el-tab-pane label="基本信息" name="basic">
              <div class="form-grid">
                <div class="form-item full">
                  <label class="required">客户姓名</label>
                  <el-input v-model="form.name" placeholder="请输入姓名" />
                </div>
                <div class="form-item">
                  <label>国籍</label>
                  <el-input v-model="form.nationality" placeholder="如：中国/美国" />
                </div>
                <div class="form-item">
                  <label>公司/单位</label>
                  <el-input v-model="form.company" placeholder="客户公司" />
                </div>
                <div class="form-item">
                  <label>手机号码</label>
                  <el-input v-model="form.phone" placeholder="手机号" />
                </div>
                <div class="form-item">
                  <label>微信号</label>
                  <el-input v-model="form.wechat" placeholder="微信ID" />
                </div>
                <div class="form-item">
                  <label>邮箱</label>
                  <el-input v-model="form.email" placeholder="Email" />
                </div>
                <div class="form-item">
                  <label>客户来源</label>
                  <el-select v-model="form.source" placeholder="选择来源" clearable class="w-100">
                    <el-option v-for="opt in CRM_CLIENT_SOURCE_OPTIONS" :key="opt.value" :label="opt.label" :value="opt.value" />
                  </el-select>
                </div>
                <div v-if="form.source === CRM_SOURCE_COOPERATIVE_LISTING" class="form-item full">
                  <label>合作对象</label>
                  <el-input v-model="form.cooperative_partner" placeholder="填写合作方名称或联系方式" maxlength="200" show-word-limit />
                </div>
                <div class="form-item">
                  <label>客户状态</label>
                  <el-select v-model="form.status" class="w-100">
                    <el-option label="潜在客户" value="potential" />
                    <el-option label="跟进中" value="active" />
                    <el-option label="已成交" value="deal" />
                    <el-option label="已流失" value="lost" />
                  </el-select>
                </div>
                <div class="form-item">
                  <label>重要程度</label>
                  <div class="importance-selector">
                    <i v-for="s in 5" :key="s" class="fas fa-star" :class="{ active: s <= form.importance }" @click="form.importance = (form.importance === s ? 0 : s)"></i>
                  </div>
                </div>
                <div class="form-item">
                  <label>咨询日期</label>
                  <el-date-picker v-model="form.inquiry_date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width:100%" />
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="内容检索需求" name="demand">
              <div class="form-grid">
                <div class="form-item">
                  <label>预算最低 (元/月)</label>
                  <el-input v-model.number="form.demand_budget_min" placeholder="最低预算" type="number" />
                </div>
                <div class="form-item">
                  <label>预算最高 (元/月)</label>
                  <el-input v-model.number="form.demand_budget_max" placeholder="最高预算" type="number" />
                </div>
                <div class="form-item">
                  <label>卧室数量</label>
                  <el-select v-model="form.demand_bedrooms" placeholder="不限" clearable class="w-100">
                    <el-option v-for="n in 5" :key="n" :label="`${n}室`" :value="String(n)" />
                    <el-option label="5室+" value="6" />
                  </el-select>
                </div>
                <div class="form-item">
                  <label>意向区域</label>
                  <el-select v-model="form.demand_district" placeholder="选择区域" clearable filterable class="w-100">
                    <el-option v-for="d in districtOptions" :key="d" :label="d" :value="d" />
                  </el-select>
                </div>
                <div class="form-item full">
                  <label>意向地铁线路 (可多选)</label>
                  <el-select v-model="form.demand_metro_lines" placeholder="选择地铁线路" multiple clearable collapse-tags :max-collapse-tags="3" class="w-100">
                    <el-option v-for="l in metroLineOptions" :key="l" :label="l" :value="l" />
                  </el-select>
                </div>
                <div class="form-item full">
                  <label>意向地铁站点</label>
                  <el-input v-model="form.demand_metro_stations_text" placeholder="手动输入站点，逗号分隔" />
                </div>
                <div class="form-item">
                  <label>内容资产类型</label>
                  <el-select v-model="form.demand_property_type" placeholder="不限" clearable class="w-100">
                    <el-option label="公寓" value="apartment" />
                    <el-option label="别墅" value="villa" />
                    <el-option label="老洋房" value="lane_house" />
                    <el-option label="商住" value="commercial" />
                  </el-select>
                </div>
                <div class="form-item">
                  <label>租房起始时间</label>
                  <el-date-picker v-model="form.rental_start_date" type="date" placeholder="计划入住日期" value-format="YYYY-MM-DD" style="width:100%" />
                </div>
                <div class="form-item">
                  <label>租期</label>
                  <el-select v-model="form.rental_duration" placeholder="不限" clearable class="w-100">
                    <el-option label="3个月" value="3" />
                    <el-option label="6个月" value="6" />
                    <el-option label="1年" value="12" />
                    <el-option label="2年" value="24" />
                    <el-option label="长期" value="long" />
                  </el-select>
                </div>
                <div class="form-item check-row">
                  <el-checkbox v-model="form.demand_has_elevator">有电梯</el-checkbox>
                  <el-checkbox v-model="form.demand_has_parking">有车位</el-checkbox>
                </div>
                <div class="form-item full">
                  <label>户外/配套 (可多选)</label>
                  <el-select v-model="form.demand_outdoor_features" placeholder="选择配套" multiple clearable class="w-100">
                    <el-option label="阳台" value="balcony" />
                    <el-option label="露台" value="terrace" />
                    <el-option label="花园" value="garden" />
                    <el-option label="泳池" value="pool" />
                    <el-option label="健身房" value="gym" />
                  </el-select>
                </div>
                <div class="form-item full">
                  <label>需求备注</label>
                  <el-input v-model="form.demand_notes" type="textarea" :rows="2" placeholder="其他需求说明..." />
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="备注" name="notes">
              <el-input v-model="form.notes" type="textarea" :rows="6" placeholder="客户备注信息..." />
            </el-tab-pane>
          </el-tabs>
        </div>
        <div class="modal-footer">
          <el-button @click="showForm = false">取消</el-button>
          <el-button type="primary" @click="saveClient" :loading="saving">保存客户</el-button>
        </div>
      </div>
    </div>

    <!-- 客户详情弹窗 -->
    <div v-if="showDetail" class="modal-overlay" @click.self="showDetail = false">
      <div class="modal-box crm-detail-modal">
        <div class="modal-header detail-header" :class="'status-bg-' + (detailClient.status || 'potential')">
          <div class="detail-header-info">
            <div class="detail-avatar">{{ (detailClient.name || '?')[0] }}</div>
            <div>
              <h5>{{ detailClient.name }}
                <span v-if="detailClient.is_pinned" class="pin-badge"><i class="fas fa-thumbtack"></i></span>
                <span v-if="detailClient.importance" class="importance-stars"><i v-for="s in detailClient.importance" :key="s" class="fas fa-star"></i></span>
              </h5>
              <div class="detail-sub">
                <span class="status-tag" :class="'tag-' + (detailClient.status || 'potential')">{{ statusText(detailClient.status) }}</span>
                <span v-if="detailClient.nationality">{{ detailClient.nationality }}</span>
                <span v-if="detailClient.company">{{ detailClient.company }}</span>
              </div>
            </div>
          </div>
          <button class="btn-close btn-close-white" @click="showDetail = false"></button>
        </div>
        <div class="modal-body detail-body">
          <el-tabs v-model="detailTab">
            <el-tab-pane label="客户信息" name="info">
              <div class="detail-section">
                <h6><i class="fas fa-address-card me-1"></i>联系方式</h6>
                <div class="detail-grid">
                  <div v-if="detailClient.phone"><label>手机</label><span>{{ detailClient.phone }}</span></div>
                  <div v-if="detailClient.wechat"><label>微信</label><span>{{ detailClient.wechat }}</span></div>
                  <div v-if="detailClient.email"><label>邮箱</label><span>{{ detailClient.email }}</span></div>
                  <div v-if="detailClient.source"><label>来源</label><span>{{ sourceText(detailClient.source) }}</span></div>
                  <div v-if="detailClient.source === CRM_SOURCE_COOPERATIVE_LISTING"><label>合作对象</label><span>{{ detailClient.cooperative_partner || '-' }}</span></div>
                  <div v-if="detailClient.inquiry_date"><label>咨询日期</label><span>{{ detailClient.inquiry_date }}</span></div>
                </div>
              </div>
              <div class="detail-section" v-if="detailClient.demand_budget_min || detailClient.demand_budget_max || detailClient.demand_bedrooms || detailClient.demand_district || detailClient.demand_metro_lines?.length">
                <h6><i class="fas fa-search me-1"></i>内容检索需求</h6>
                <div class="detail-grid">
                  <div v-if="detailClient.demand_budget_min || detailClient.demand_budget_max"><label>预算</label><span>¥{{ detailClient.demand_budget_min || '?' }} - ¥{{ detailClient.demand_budget_max || '?' }}/月</span></div>
                  <div v-if="detailClient.demand_bedrooms"><label>户型</label><span>{{ detailClient.demand_bedrooms }}室</span></div>
                  <div v-if="detailClient.demand_district"><label>区域</label><span>{{ detailClient.demand_district }}</span></div>
                  <div v-if="detailClient.demand_metro_lines?.length"><label>地铁</label><span>{{ detailClient.demand_metro_lines.join('、') }}</span></div>
                  <div v-if="detailClient.demand_metro_stations?.length"><label>站点</label><span>{{ detailClient.demand_metro_stations.join('、') }}</span></div>
                  <div v-if="detailClient.demand_property_type"><label>类型</label><span>{{ propertyTypeText(detailClient.demand_property_type) }}</span></div>
                  <div v-if="detailClient.rental_start_date"><label>入住时间</label><span>{{ detailClient.rental_start_date }}</span></div>
                  <div v-if="detailClient.rental_duration"><label>租期</label><span>{{ durationText(detailClient.rental_duration) }}</span></div>
                  <div v-if="detailClient.demand_has_elevator"><label>电梯</label><span>需要</span></div>
                  <div v-if="detailClient.demand_has_parking"><label>车位</label><span>需要</span></div>
                  <div v-if="detailClient.demand_outdoor_features?.length"><label>配套</label><span>{{ detailClient.demand_outdoor_features.map(f => outdoorText(f)).join('、') }}</span></div>
                </div>
                <div v-if="detailClient.demand_notes" class="detail-note mt-2"><label>需求备注</label><p>{{ detailClient.demand_notes }}</p></div>
              </div>
              <div class="detail-section" v-if="detailClient.notes">
                <h6><i class="fas fa-sticky-note me-1"></i>备注</h6>
                <p class="notes-text">{{ detailClient.notes }}</p>
              </div>
            </el-tab-pane>

            <el-tab-pane name="followup">
              <template #label><span>沟通记录 <el-badge :value="detailClient.followups?.length || 0" :max="99" type="info" /></span></template>
              <div class="followup-add">
                <el-input v-model="newFollowup" type="textarea" :rows="2" placeholder="记录沟通内容..." />
                <div class="followup-add-actions">
                  <el-radio-group v-model="newFollowupType" size="small">
                    <el-radio-button value="note">备注</el-radio-button>
                    <el-radio-button value="call">电话</el-radio-button>
                    <el-radio-button value="wechat">微信</el-radio-button>
                    <el-radio-button value="visit">带看</el-radio-button>
                  </el-radio-group>
                  <el-button type="primary" size="small" @click="submitFollowup" :loading="savingFollowup">添加记录</el-button>
                </div>
              </div>
              <div class="followup-list">
                <div v-for="f in (detailClient.followups || [])" :key="f.id" class="followup-item">
                  <div class="followup-dot" :class="'dot-' + (f.type || 'note')"></div>
                  <div class="followup-content">
                    <div class="followup-head">
                      <span class="followup-type">{{ followupTypeText(f.type) }}</span>
                      <span class="followup-time">{{ formatTime(f.created_at) }}</span>
                      <button class="followup-del" @click="deleteFollowup(f.id)" title="删除"><i class="fas fa-times"></i></button>
                    </div>
                    <p>{{ f.content }}</p>
                  </div>
                </div>
                <div v-if="!detailClient.followups?.length" class="empty-followup">暂无沟通记录</div>
              </div>
            </el-tab-pane>

            <el-tab-pane name="properties">
              <template #label><span>已发内容资产 <el-badge :value="detailClient.sent_property_ids?.length || 0" :max="99" type="info" /></span></template>
              <div class="prop-search-bar">
                <el-input v-model="propSearchKw" placeholder="搜索内容资产（标题/编号/小区）..." clearable size="small" style="width:260px" @input="debounceSearchProps" />
                <el-button type="primary" size="small" @click="saveSentProperties" :loading="savingProps">保存关联</el-button>
              </div>
              <div class="prop-select-list">
                <el-checkbox-group v-model="selectedPropIds">
                  <div v-for="p in searchedProperties" :key="p.id" class="prop-select-item">
                    <el-checkbox :value="p.id">
                      <div class="prop-info-inline">
                        <span class="prop-code">#{{ p.id }}</span>
                        <span class="prop-title">{{ p.title || p.address || '未命名' }}</span>
                        <span class="prop-price" v-if="p.price">¥{{ p.price }}</span>
                        <span class="prop-detail" v-if="p.district || p.bedrooms">{{ p.district }} {{ p.bedrooms ? p.bedrooms + '室' : '' }}</span>
                      </div>
                    </el-checkbox>
                  </div>
                </el-checkbox-group>
                <div v-if="!searchedProperties.length" class="empty-followup">暂无内容资产数据</div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
    </div>

    <!-- 快速跟进弹窗 -->
    <div v-if="showQuickFollowup" class="modal-overlay" @click.self="showQuickFollowup = false">
      <div class="modal-box" style="max-width:480px">
        <div class="modal-header"><h5>快速跟进 - {{ quickFollowupClient?.name }}</h5><button class="btn-close" @click="showQuickFollowup = false"></button></div>
        <div class="modal-body">
          <el-input v-model="quickFollowupContent" type="textarea" :rows="3" placeholder="记录跟进内容..." />
          <div class="mt-2">
            <el-radio-group v-model="quickFollowupType" size="small">
              <el-radio-button value="note">备注</el-radio-button>
              <el-radio-button value="call">电话</el-radio-button>
              <el-radio-button value="wechat">微信</el-radio-button>
              <el-radio-button value="visit">带看</el-radio-button>
            </el-radio-group>
          </div>
        </div>
        <div class="modal-footer">
          <el-button @click="showQuickFollowup = false">取消</el-button>
          <el-button type="primary" @click="submitQuickFollowup" :loading="savingFollowup">保存</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  CRM_CLIENT_SOURCE_OPTIONS,
  CRM_SOURCE_COOPERATIVE_LISTING,
  getCrmSourceLabel,
} from '@/config/crmClientSources.js'

defineProps({ plugin: Object })

const clients = ref([])
const allClients = ref([])
const keyword = ref('')
const filterStatus = ref('')
const filterDateRange = ref(null)
const activeDateShortcut = ref('')
const showForm = ref(false)
const showDetail = ref(false)
const showQuickFollowup = ref(false)
const saving = ref(false)
const savingFollowup = ref(false)
const savingProps = ref(false)
const editingId = ref(null)
const formTab = ref('basic')
const detailTab = ref('info')

const detailClient = ref({})
const newFollowup = ref('')
const newFollowupType = ref('note')

const quickFollowupClient = ref(null)
const quickFollowupContent = ref('')
const quickFollowupType = ref('note')

const propSearchKw = ref('')
const searchedProperties = ref([])
const selectedPropIds = ref([])

const districtOptions = [
  '黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区',
  '浦东新区', '闵行区', '宝山区', '嘉定区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'
]
const metroLineOptions = [
  '1号线', '2号线', '3号线', '4号线', '5号线', '6号线', '7号线', '8号线',
  '9号线', '10号线', '11号线', '12号线', '13号线', '14号线', '15号线', '16号线', '17号线', '18号线'
]

const defaultForm = () => ({
  name: '', nationality: '', phone: '', wechat: '', email: '', company: '', source: '', cooperative_partner: '',
  status: 'potential', importance: 0,
  demand_budget_min: null, demand_budget_max: null, demand_bedrooms: '',
  demand_district: '', demand_metro_lines: [], demand_metro_stations_text: '',
  demand_property_type: '', demand_has_elevator: false, demand_has_parking: false,
  demand_outdoor_features: [], demand_notes: '',
  inquiry_date: '', rental_start_date: '', rental_duration: '',
  notes: '',
})
const form = reactive(defaultForm())

const stats = computed(() => {
  const all = allClients.value
  return {
    total: all.length,
    active: all.filter(c => c.status === 'active').length,
    potential: all.filter(c => c.status === 'potential').length,
    deal: all.filter(c => c.status === 'deal').length,
    lost: all.filter(c => c.status === 'lost').length,
  }
})

const statusText = (s) => ({ potential: '潜在', active: '跟进中', deal: '已成交', lost: '已流失' }[s] || '潜在')
const sourceText = getCrmSourceLabel
const propertyTypeText = (t) => ({ apartment: '公寓', villa: '别墅', lane_house: '老洋房', commercial: '商住' }[t] || t || '-')
const durationText = (d) => ({ '3': '3个月', '6': '6个月', '12': '1年', '24': '2年', 'long': '长期' }[d] || d || '-')
const outdoorText = (f) => ({ balcony: '阳台', terrace: '露台', garden: '花园', pool: '泳池', gym: '健身房', rooftop: '天台' }[f] || f)

const hasDemandData = (c) => c.demand_budget_min || c.demand_budget_max || c.demand_bedrooms || c.demand_district || c.demand_property_type || c.rental_duration
const hasDemandExtra = (c) => c.demand_metro_lines?.length || c.demand_metro_stations?.length || c.demand_has_elevator || c.demand_has_parking || c.demand_outdoor_features?.length

const getMetroColor = (line) => {
  const colors = {
    '1号线': '#E4002B', '2号线': '#97D700', '3号线': '#FFD100', '4号线': '#532E8A',
    '5号线': '#A6217C', '6号线': '#D9017A', '7号线': '#ED6F00', '8号线': '#009CD2',
    '9号线': '#6CC24A', '10号线': '#C1A7E2', '11号线': '#872920', '12号线': '#007A61',
    '13号线': '#EF95CF', '14号线': '#6B6B00', '15号线': '#BCA88A', '16号线': '#20B2AA',
    '17号线': '#C19A6B', '18号线': '#D4A76A',
  }
  return colors[line] || '#999'
}

const outdoorBadgeClass = (f) => ({
  balcony: 'od-balcony', terrace: 'od-terrace', garden: 'od-garden',
  pool: 'od-pool', gym: 'od-gym', rooftop: 'od-terrace',
}[f] || 'od-default')

const tableRowClass = ({ row }) => row.is_pinned ? 'pinned-row' : ''

const onStatClick = (status) => {
  filterStatus.value = status
  loadClients()
}
const followupTypeText = (t) => ({ note: '备注', call: '电话', wechat: '微信', visit: '带看' }[t] || '备注')

const formatRelTime = (t) => {
  if (!t) return ''
  const diff = Date.now() - new Date(t).getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'
  return new Date(t).toLocaleDateString('zh-CN')
}
const formatTime = (t) => {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

let searchTimer = null
const debounceSearch = () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadClients(), 300)
}

let propSearchTimer = null
const debounceSearchProps = () => {
  clearTimeout(propSearchTimer)
  propSearchTimer = setTimeout(() => searchProperties(), 300)
}

const loadClients = async () => {
  try {
    const params = {}
    if (keyword.value) params.keyword = keyword.value
    if (filterStatus.value) params.status = filterStatus.value
    const res = await api.get('/user/plugin-exec/crm/clients', { params })
    allClients.value = res.data?.data || res.data || []
    applyLocalFilters()
  } catch { allClients.value = []; clients.value = [] }
}

const applyLocalFilters = () => {
  let list = [...allClients.value]
  if (filterDateRange.value && filterDateRange.value.length === 2) {
    const [start, end] = filterDateRange.value
    list = list.filter(c => {
      if (!c.inquiry_date) return false
      const d = c.inquiry_date.slice(0, 10)
      return d >= start && d <= end
    })
  }
  clients.value = list
}

const onDatePickerChange = () => {
  activeDateShortcut.value = ''
  applyLocalFilters()
}

const setDateShortcut = (type) => {
  if (activeDateShortcut.value === type) {
    activeDateShortcut.value = ''
    filterDateRange.value = null
    applyLocalFilters()
    return
  }
  activeDateShortcut.value = type
  const today = new Date()
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const todayStr = fmt(today)

  if (type === 'today') {
    filterDateRange.value = [todayStr, todayStr]
  } else if (type === 'week') {
    const day = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
    filterDateRange.value = [fmt(monday), todayStr]
  } else if (type === 'month') {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    filterDateRange.value = [fmt(firstDay), todayStr]
  }
  applyLocalFilters()
}

watch(() => form.source, (v) => {
  if (v !== CRM_SOURCE_COOPERATIVE_LISTING) form.cooperative_partner = ''
})

const openAddForm = () => {
  editingId.value = null
  Object.assign(form, defaultForm())
  formTab.value = 'basic'
  showForm.value = true
}

const openEditForm = (c) => {
  editingId.value = c.id
  Object.assign(form, {
    name: c.name || '', nationality: c.nationality || '', phone: c.phone || '',
    wechat: c.wechat || '', email: c.email || '', company: c.company || '',
    source: c.source || '', cooperative_partner: c.cooperative_partner || '', status: c.status || 'potential', importance: c.importance || 0,
    demand_budget_min: c.demand_budget_min || null, demand_budget_max: c.demand_budget_max || null,
    demand_bedrooms: c.demand_bedrooms || '', demand_district: c.demand_district || '',
    demand_metro_lines: c.demand_metro_lines || [], demand_metro_stations_text: (c.demand_metro_stations || []).join('、'),
    demand_property_type: c.demand_property_type || '',
    demand_has_elevator: c.demand_has_elevator || false, demand_has_parking: c.demand_has_parking || false,
    demand_outdoor_features: c.demand_outdoor_features || [], demand_notes: c.demand_notes || '',
    inquiry_date: c.inquiry_date || '', rental_start_date: c.rental_start_date || '',
    rental_duration: c.rental_duration || '', notes: c.notes || '',
  })
  formTab.value = 'basic'
  showForm.value = true
}

const saveClient = async () => {
  if (!form.name?.trim()) return ElMessage.warning('请输入客户姓名')
  saving.value = true
  try {
    const stationsArr = form.demand_metro_stations_text
      ? form.demand_metro_stations_text.split(/[,，、\s]+/).filter(Boolean)
      : []
    const payload = {
      ...form,
      demand_metro_stations: stationsArr,
      id: editingId.value || undefined,
    }
    delete payload.demand_metro_stations_text
    await api.post('/user/plugin-exec/crm/client', payload)
    ElMessage.success('保存成功')
    showForm.value = false
    loadClients()
    if (showDetail.value && editingId.value === detailClient.value.id) {
      loadClientDetail(editingId.value)
    }
  } catch (err) {
    ElMessage.error('保存失败: ' + (err.response?.data?.message || err.message))
  }
  saving.value = false
}

const deleteClient = async (c) => {
  try {
    await ElMessageBox.confirm(`确定删除客户「${c.name}」？`, '确认删除', { type: 'warning' })
    await api.delete(`/user/plugin-exec/customer-crm/data/${c.id}`)
    ElMessage.success('已删除')
    loadClients()
    if (showDetail.value && detailClient.value.id === c.id) showDetail.value = false
  } catch {}
}

const togglePin = async (c) => {
  try {
    await api.put(`/user/plugin-exec/crm/client/${c.id}/pin`)
    loadClients()
  } catch {}
}

const openDetail = async (c) => {
  detailTab.value = 'info'
  await loadClientDetail(c.id)
  showDetail.value = true
  searchProperties()
}

const loadClientDetail = async (id) => {
  try {
    const res = await api.get(`/user/plugin-exec/crm/client/${id}`)
    detailClient.value = res.data?.data || res.data || {}
    selectedPropIds.value = [...(detailClient.value.sent_property_ids || [])]
  } catch { detailClient.value = {} }
}

const submitFollowup = async () => {
  if (!newFollowup.value?.trim()) return ElMessage.warning('请输入跟进内容')
  savingFollowup.value = true
  try {
    await api.post(`/user/plugin-exec/crm/client/${detailClient.value.id}/followup`, {
      content: newFollowup.value,
      type: newFollowupType.value,
    })
    newFollowup.value = ''
    ElMessage.success('跟进已记录')
    await loadClientDetail(detailClient.value.id)
    loadClients()
  } catch (err) {
    ElMessage.error('保存失败')
  }
  savingFollowup.value = false
}

const deleteFollowup = async (fId) => {
  try {
    await api.delete(`/user/plugin-exec/crm/client/${detailClient.value.id}/followup/${fId}`)
    await loadClientDetail(detailClient.value.id)
    ElMessage.success('已删除')
  } catch {}
}

const openFollowup = (c) => {
  quickFollowupClient.value = c
  quickFollowupContent.value = ''
  quickFollowupType.value = 'note'
  showQuickFollowup.value = true
}

const submitQuickFollowup = async () => {
  if (!quickFollowupContent.value?.trim()) return ElMessage.warning('请输入跟进内容')
  savingFollowup.value = true
  try {
    await api.post(`/user/plugin-exec/crm/client/${quickFollowupClient.value.id}/followup`, {
      content: quickFollowupContent.value,
      type: quickFollowupType.value,
    })
    ElMessage.success('跟进已记录')
    showQuickFollowup.value = false
    loadClients()
  } catch { ElMessage.error('保存失败') }
  savingFollowup.value = false
}

const searchProperties = async () => {
  try {
    const res = await api.get('/user/plugin-exec/crm/properties-search', { params: { keyword: propSearchKw.value } })
    searchedProperties.value = res.data?.data || res.data || []
  } catch { searchedProperties.value = [] }
}

const saveSentProperties = async () => {
  savingProps.value = true
  try {
    await api.post(`/user/plugin-exec/crm/client/${detailClient.value.id}/properties`, { property_ids: selectedPropIds.value })
    ElMessage.success('内容资产关联已保存')
    await loadClientDetail(detailClient.value.id)
  } catch { ElMessage.error('保存失败') }
  savingProps.value = false
}

/* ====== 拖拽排序 ====== */
let dragIdx = null
let dragStartY = 0
const startDrag = (idx, e) => {
  dragIdx = idx
  dragStartY = e.clientY
  const onMove = (ev) => {
    const diff = ev.clientY - dragStartY
    const step = 50
    if (Math.abs(diff) > step) {
      const dir = diff > 0 ? 1 : -1
      const newIdx = dragIdx + dir
      if (newIdx >= 0 && newIdx < clients.value.length) {
        const temp = clients.value[dragIdx]
        clients.value[dragIdx] = clients.value[newIdx]
        clients.value[newIdx] = temp
        dragIdx = newIdx
        dragStartY = ev.clientY
      }
    }
  }
  const onUp = async () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    const orders = clients.value.map((c, i) => ({ id: c.id, sort_order: i }))
    try { await api.put('/user/plugin-exec/crm/reorder', { orders }) } catch {}
    dragIdx = null
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

onMounted(loadClients)
</script>

<style scoped>
.crm-plugin { max-width: 100%; }

/* 统计栏 */
.crm-stats-bar {
  display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto;
  background: #fff; border-radius: 10px; padding: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.06);
}
.stat-item {
  flex: 1; min-width: 80px; text-align: center; padding: 10px 8px;
  border-radius: 8px; cursor: pointer; transition: all 0.2s;
}
.stat-item:hover, .stat-item.active { background: #f0f4ff; }
.stat-item.active { box-shadow: inset 0 -2px 0 var(--primary-color, #2F80ED); }
.stat-num { font-size: 22px; font-weight: 700; }
.stat-label { font-size: 12px; color: #888; margin-top: 2px; }

/* 工具栏 */
.crm-toolbar {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  margin-bottom: 16px; flex-wrap: wrap;
}
.toolbar-filters {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.date-shortcuts {
  display: inline-flex; gap: 4px;
}
.date-shortcuts .el-button { padding: 5px 10px; font-size: 12px; }
.toolbar-right { display: flex; gap: 8px; flex-shrink: 0; }

/* 表格容器 */
.crm-table-wrap {
  background: #fff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); overflow: hidden;
}
.crm-table { width: 100%; }
:deep(.crm-table) { font-size: 13px; }
:deep(.crm-table .el-table__row) { cursor: pointer; }
:deep(.crm-table .el-table__row:hover > td) { background: #f0f7ff !important; }
:deep(.crm-table .pinned-row > td) { background: #fffbf0 !important; }
:deep(.crm-table th.el-table__cell) { background: #fafbfc; font-size: 12px; color: #606266; font-weight: 600; padding: 8px 0; }
:deep(.crm-table td.el-table__cell) { padding: 6px 0; }

.drag-handle { color: #ccc; cursor: grab; font-size: 12px; }
.drag-handle:hover { color: #999; }

/* 客户信息单元格 */
.cell-client { display: flex; align-items: center; gap: 8px; }
.cell-avatar {
  width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.cell-avatar.status-potential { background: linear-gradient(135deg, #E6A23C, #F7BA2A); }
.cell-avatar.status-active { background: linear-gradient(135deg, #409EFF, #66b1ff); }
.cell-avatar.status-deal { background: linear-gradient(135deg, #67C23A, #85ce61); }
.cell-avatar.status-lost { background: linear-gradient(135deg, #999, #bbb); }
.cell-client-info { min-width: 0; }
.cell-name-row { display: flex; align-items: center; gap: 4px; }
.cell-name { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pin-icon { color: #E6A23C; font-size: 10px; }
.importance-stars { color: #F7BA2A; font-size: 9px; display: inline-flex; gap: 1px; }
.cell-contact { font-size: 11px; color: #999; margin-top: 2px; display: flex; gap: 8px; }
.cell-contact i { margin-right: 2px; font-size: 10px; }

/* 状态标签 */
.status-tag { font-size: 11px; padding: 1px 8px; border-radius: 10px; font-weight: 500; white-space: nowrap; }
.tag-potential { background: #FDF6EC; color: #E6A23C; }
.tag-active { background: #ECF5FF; color: #409EFF; }
.tag-deal { background: #F0F9EB; color: #67C23A; }
.tag-lost { background: #F4F4F5; color: #909399; }

/* 价格 */
.cell-price { color: #F56C6C; font-weight: 600; font-size: 12px; white-space: nowrap; }
.cell-num { font-weight: 600; color: #409EFF; }
.cell-type { font-size: 12px; color: #67C23A; }
.cell-station { font-size: 12px; color: #337ab7; }
.cell-empty { color: #ccc; }

/* 地铁标签 */
.metro-tags { display: flex; gap: 3px; flex-wrap: wrap; }
.metro-line-tag {
  display: inline-flex; align-items: center;
  padding: 1px 6px; border-radius: 3px; font-size: 10px;
  color: #fff; font-weight: 500; white-space: nowrap; line-height: 18px;
}

/* 电梯/车位徽章 */
.badge-green { color: #67C23A; font-weight: 500; font-size: 12px; }
.badge-gray { color: #ddd; }

/* 户外配套标签 */
.outdoor-tags { display: flex; gap: 3px; flex-wrap: wrap; }
.badge-outdoor {
  display: inline-block; padding: 1px 6px; border-radius: 3px;
  font-size: 10px; font-weight: 500; white-space: nowrap; line-height: 18px;
}
.od-garden { background: #E1F3D8; color: #67C23A; }
.od-balcony { background: #E0F5F0; color: #13CE66; }
.od-terrace { background: #FDF2E9; color: #E6A23C; }
.od-pool { background: #E0F7FA; color: #00ACC1; }
.od-gym { background: #F3E8FF; color: #9B59B6; }
.od-default { background: #F4F4F5; color: #909399; }

/* 操作按钮 */
.table-actions { display: flex; gap: 3px; justify-content: center; }
.act-btn {
  width: 26px; height: 26px; border: none; background: #f5f7fa; border-radius: 5px;
  cursor: pointer; color: #666; font-size: 11px; transition: all 0.2s;
  display: flex; align-items: center; justify-content: center;
}
.act-btn:hover { background: #e8edf3; color: #409EFF; }
.act-btn.active { color: #E6A23C; background: #FDF6EC; }
.act-btn.danger:hover { background: #FEF0F0; color: #F56C6C; }

/* 空状态 */
.empty-state {
  text-align: center; padding: 60px 20px; color: #ccc;
  background: #fff; border-radius: 10px; box-shadow: 0 1px 6px rgba(0,0,0,0.05);
}
.empty-state i { font-size: 48px; margin-bottom: 12px; display: block; }
.empty-state p { color: #999; margin-bottom: 16px; }

/* 弹窗 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; padding-top: 40px; overflow-y: auto; }
.modal-box { background: #fff; border-radius: 12px; width: 92%; max-height: 90vh; overflow-y: auto; }
.crm-form-modal { max-width: 680px; }
.crm-detail-modal { max-width: 720px; }
.modal-header { padding: 16px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
.modal-header h5 { margin: 0; font-size: 16px; font-weight: 600; }
.modal-body { padding: 20px; }
.modal-footer { padding: 12px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 8px; }

/* 表单网格 */
.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.form-item { display: flex; flex-direction: column; }
.form-item.full { grid-column: 1 / -1; }
.form-item label { font-size: 13px; color: #555; margin-bottom: 4px; font-weight: 500; }
.form-item label.required::after { content: ' *'; color: #F56C6C; }
.check-row { flex-direction: row; gap: 16px; align-items: center; padding-top: 20px; }

.importance-selector { display: flex; gap: 4px; padding-top: 4px; }
.importance-selector .fa-star { font-size: 20px; color: #ddd; cursor: pointer; transition: color 0.15s; }
.importance-selector .fa-star.active { color: #F7BA2A; }
.importance-selector .fa-star:hover { color: #F7BA2A; }

/* 详情弹窗 */
.detail-header {
  padding: 20px 24px; border-radius: 12px 12px 0 0; color: #fff; position: relative;
}
.status-bg-potential { background: linear-gradient(135deg, #E6A23C, #F7BA2A); }
.status-bg-active { background: linear-gradient(135deg, #409EFF, #79bbff); }
.status-bg-deal { background: linear-gradient(135deg, #67C23A, #95d475); }
.status-bg-lost { background: linear-gradient(135deg, #909399, #b1b3b8); }
.detail-header-info { display: flex; align-items: center; gap: 14px; }
.detail-avatar {
  width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.25);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 700; flex-shrink: 0;
}
.detail-header h5 { margin: 0; font-size: 18px; display: flex; align-items: center; gap: 6px; }
.detail-sub { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 13px; opacity: 0.9; }
.detail-sub .status-tag { background: rgba(255,255,255,0.25); color: #fff; }
.detail-body { padding: 16px 20px; max-height: 60vh; overflow-y: auto; }

.detail-section { margin-bottom: 20px; }
.detail-section h6 { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #f0f0f0; }
.detail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 16px; }
.detail-grid > div { display: flex; gap: 8px; font-size: 13px; }
.detail-grid label { color: #999; min-width: 56px; flex-shrink: 0; }
.detail-grid span { color: #333; }
.detail-note label { font-size: 13px; color: #999; }
.detail-note p { font-size: 13px; color: #555; margin-top: 4px; }
.notes-text { font-size: 13px; color: #555; white-space: pre-wrap; }

/* 跟进记录 */
.followup-add { margin-bottom: 16px; }
.followup-add-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
.followup-list { position: relative; padding-left: 20px; }
.followup-list::before { content: ''; position: absolute; left: 7px; top: 0; bottom: 0; width: 2px; background: #e8e8e8; }
.followup-item { display: flex; gap: 12px; margin-bottom: 16px; position: relative; }
.followup-dot {
  width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; margin-top: 4px;
  position: relative; z-index: 1;
}
.dot-note { background: #409EFF; }
.dot-call { background: #67C23A; }
.dot-wechat { background: #07C160; }
.dot-visit { background: #E6A23C; }
.followup-content { flex: 1; }
.followup-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.followup-type { font-size: 12px; font-weight: 600; color: #555; }
.followup-time { font-size: 11px; color: #bbb; }
.followup-del { border: none; background: none; color: #ccc; cursor: pointer; font-size: 12px; padding: 2px; margin-left: auto; }
.followup-del:hover { color: #F56C6C; }
.followup-content p { font-size: 13px; color: #444; margin: 0; }
.empty-followup { text-align: center; color: #ccc; padding: 30px; font-size: 13px; }

/* 内容资产选择 */
.prop-search-bar { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; }
.prop-select-list { max-height: 360px; overflow-y: auto; }
.prop-select-item { padding: 8px 4px; border-bottom: 1px solid #f5f5f5; }
.prop-select-item:last-child { border-bottom: none; }
.prop-info-inline { display: inline-flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 13px; }
.prop-code { color: #999; font-size: 12px; }
.prop-title { font-weight: 500; }
.prop-price { color: #F56C6C; font-weight: 600; }
.prop-detail { color: #888; font-size: 12px; }

/* 响应式 */
@media (max-width: 768px) {
  .crm-stats-bar { gap: 4px; padding: 8px; flex-wrap: wrap; }
  .stat-item { padding: 8px 4px; min-width: 60px; }
  .stat-num { font-size: 18px; }
  .crm-toolbar { flex-wrap: wrap; gap: 8px; }
  .crm-toolbar .el-input { width: 100% !important; }
  .form-grid { grid-template-columns: 1fr; }
  .detail-grid { grid-template-columns: 1fr; }
  .crm-form-modal, .crm-detail-modal { width: 96% !important; max-height: 85vh; }
  .modal-overlay { padding-top: 10px; padding-bottom: 10px; }
  .crm-table-wrap { border-radius: 6px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .crm-table { min-width: 600px; }
}

.w-100 { width: 100%; }
</style>
