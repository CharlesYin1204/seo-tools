<template>
  <div class="seo-sites">
    <header class="page-head">
      <div>
        <small>SEO WORKSPACE</small>
        <h2>站点与审计</h2>
        <p>添加公网网站，执行真实首页审计并处理有证据的问题。</p>
      </div>
      <el-button type="primary" @click="dialog = true"
        ><i class="fas fa-plus" /> 添加站点</el-button
      >
    </header>
    <div class="quota" v-if="workspace">
      <span
        ><b>{{ workspace.organization.plan_name }}</b> 当前套餐</span
      >
      <span
        >站点 {{ sites.length }} /
        {{ workspace.organization.entitlements.sites }}</span
      >
      <span
        >本月抓取 {{ workspace.usage.crawl_pages }} /
        {{ workspace.quota.crawl_pages }} 页</span
      >
      <span
        class="quota-action"
        @click="
          tab = 'issues';
          loadIssues();
        "
        ><i class="fas fa-list-check" /> 优先处理
        {{ workspace.issues?.serious || 0 }} 个高优先级问题</span
      >
    </div>
    <el-tabs v-model="tab" @tab-change="loadTab">
      <el-tab-pane label="站点" name="sites">
        <div class="site-list" v-loading="loading">
          <el-empty
            v-if="!sites.length && !loading"
            description="添加第一个站点，15 分钟内完成首次价值体验"
          />
          <article v-for="site in sites" :key="site.id">
            <div class="site-icon"><i class="fas fa-globe" /></div>
            <div class="site-main">
              <h3>{{ site.name }}</h3>
              <a :href="site.base_url" target="_blank" rel="noopener">{{
                site.base_url
              }}</a>
              <div>
                <el-tag
                  size="small"
                  :type="
                    site.ownership_status === 'verified' ? 'success' : 'info'
                  "
                  >{{
                    site.ownership_status === "verified"
                      ? "所有权已验证"
                      : "待验证"
                  }}</el-tag
                >
                <span v-if="site.last_http_status"
                  >HTTP {{ site.last_http_status }}</span
                ><span>{{ site.open_issues || 0 }} 个待处理问题</span
                ><el-tag v-if="site.primary_language" size="small" type="info"
                  >{{ site.primary_language
                  }}{{
                    site.language_source === "text_detection"
                      ? "（待确认）"
                      : ""
                  }}</el-tag
                ><el-tag
                  v-if="site.connection_status"
                  size="small"
                  :type="
                    site.connection_status === 'approved'
                      ? 'success'
                      : site.connection_status === 'rejected'
                        ? 'danger'
                        : 'warning'
                  "
                  >接入{{
                    connectionStatusText[site.connection_status] || "待审核"
                  }}</el-tag
                ><el-tag
                  v-if="site.auto_scan_enabled"
                  size="small"
                  type="success"
                  >定时扫描已开启</el-tag
                >
              </div>
            </div>
            <div class="score-dashboard">
              <div
                class="score-gauge"
                :class="{ pending: scoreLabel(site) === '待补齐' }"
                :style="gaugeStyle(site)"
              >
                <strong>{{ scoreLabel(site) }}</strong
                ><small>SEO</small>
              </div>
              <div class="score-dashboard-meta">
                <b>完整 SEO 分数</b
                ><span v-if="scoreModel(site).onsiteScore !== undefined"
                  >站内已验证贡献 {{ scoreModel(site).onsiteScore }} / 66</span
                ><span v-if="site.last_score_model"
                  >证据覆盖 {{ scoreCoverage(site) }}% · 置信
                  {{ scoreConfidence(site) }}%</span
                >
              </div>
            </div>
            <div v-if="site.gsc_status" class="gsc-dashboard">
              <div class="gsc-head"><div><i class="fab fa-google" /><b>Search Console</b><span>{{ site.gsc_property_url }}</span></div><el-tag :type="site.gsc_status === 'active' ? 'success' : 'danger'">{{ site.gsc_status === 'active' ? '已连接' : site.gsc_status === 'error' ? '同步异常' : '已断开' }}</el-tag></div>
              <div v-if="site.gsc_status !== 'disconnected'" class="gsc-metrics">
                <div><span>28 天点击</span><b>{{ formatMetric(site.gsc_clicks_28d) }}</b></div>
                <div><span>28 天曝光</span><b>{{ formatMetric(site.gsc_impressions_28d) }}</b></div>
                <div><span>点击率</span><b>{{ formatPercent(site.gsc_ctr_28d) }}</b></div>
                <div><span>平均排名</span><b>{{ site.gsc_position_28d == null ? '--' : Number(site.gsc_position_28d).toFixed(1) }}</b></div>
                <div><span>首页索引</span><b>{{ gscVerdict(site.gsc_index_verdict) }}</b><small>{{ site.gsc_coverage_state || '尚无检查结果' }}</small></div>
              </div>
              <small v-if="site.gsc_last_synced_at" class="gsc-sync-time">最近同步 {{ new Date(site.gsc_last_synced_at).toLocaleString('zh-CN') }}</small>
            </div>
            <el-button
              v-if="site.last_score_model"
              text
              type="primary"
              class="details-btn"
              @click="toggleDetails(site)"
              ><i
                :class="
                  siteDetails[site.id]
                    ? 'fas fa-chevron-up'
                    : 'fas fa-chevron-down'
                "
              />
              {{
                siteDetails[site.id] ? "收起详情" : "查看评分详情"
              }}</el-button
            >
            <div class="site-actions">
              <el-button
                v-if="
                  site.ownership_status === 'verified' || site.sitemap_count
                "
                :loading="scanning === site.id || Boolean(site.active_scan_id)"
                :disabled="scanBlocked(site) || Boolean(site.active_scan_id)"
                :title="scanHint(site)"
                @click="scan(site)"
                ><i class="fas fa-radar" />
                {{ scanButtonText(site) }}</el-button
              ><el-button plain @click="openSitemap(site)"
                ><i class="fas fa-sitemap" /> 站点地图
                <el-tag size="small" round>{{
                  site.sitemap_count || 0
                }}</el-tag></el-button
              ><el-button
                plain
                :loading="authorityRefreshing === site.id"
                @click="refreshAuthority(site)"
                ><i class="fas fa-link" /> 刷新外链权威</el-button
              ><el-button
                v-if="site.ownership_status !== 'verified'"
                type="primary"
                plain
                @click="openVerify(site)"
                ><i class="fas fa-shield-alt" /> 验证所有权</el-button
              ><el-button
                v-else
                type="primary"
                plain
                @click="openConnection(site)"
                ><i class="fas fa-plug" /> 接入修改</el-button
              ><el-button
                v-if="site.gsc_status !== 'active'"
                plain
                @click="importGsc(site)"
                ><i class="fab fa-google" /> 导入 GSC</el-button
              ><el-button
                v-else
                plain
                :loading="gscSyncing === site.id"
                @click="syncGsc(site)"
                ><i class="fas fa-arrows-rotate" /> 同步 GSC</el-button
              ><el-button
                v-if="site.gsc_status === 'active' || site.gsc_status === 'error'"
                text
                @click="disconnectGsc(site)"
                >断开 GSC</el-button
              ><el-button
                text
                type="danger"
                @click="removeSite(site)"
                title="归档站点"
                ><i class="fas fa-trash" /> 删除</el-button
              ><el-switch
                v-if="site.ownership_status === 'verified'"
                v-model="site.auto_scan_enabled"
                inline-prompt
                active-text="自动"
                inactive-text="手动"
                @change="toggleSchedule(site)"
              />
            </div>
            <div
              v-if="siteDetails[site.id]"
              class="score-details"
              v-loading="detailsLoading[site.id]"
            >
              <template v-if="details[site.id]"
                ><div class="detail-head">
                  <strong>三维 SEO 评分明细</strong
                  ><span
                    >扫描 {{ details[site.id].scan?.completed_at || "--" }} ·
                    {{ details[site.id].scan?.pages_scanned || 0 }} /
                    {{ details[site.id].scan?.pages_discovered || 0 }} 页</span
                  >
                </div>
                <div class="score-notice">
                  {{ scoreSummary(details[site.id].score_model) }}
                </div>
                <div class="dimension-grid">
                  <div v-for="key in dimensionKeys" :key="key">
                    <b>{{ dimensionName(key) }}</b
                    ><strong>{{
                      details[site.id].score_model?.dimensions?.[key] ?? "--"
                    }}</strong
                    ><small
                      >权重
                      {{
                        details[site.id].score_model?.weights?.[key] ||
                        dimensionWeight(key)
                      }}% ·
                      {{
                        details[site.id].score_model?.dimensions?.[key] === null
                          ? authorityStatusText(details[site.id].score_model)
                          : "维度分 / 100"
                      }}</small
                    >
                  </div>
                </div>
                <div class="detail-columns">
                  <div>
                    <h4>
                      扣分问题（{{ details[site.id].issues?.length || 0 }}）
                    </h4>
                    <div
                      v-for="issue in details[site.id].issues"
                      :key="issue.id"
                      class="detail-issue"
                    >
                      <el-tag
                        size="small"
                        :type="severityType(issue.severity)"
                        >{{ severityName(issue.severity) }}</el-tag
                      >
                      <div>
                        <b>{{ issue.title }}</b>
                        <p>{{ issue.evidence }}</p>
                        <small>建议：{{ issue.recommendation }}</small>
                      </div>
                    </div>
                    <el-empty
                      v-if="!details[site.id].issues?.length"
                      description="本次扫描没有发现问题"
                    />
                  </div>
                  <div>
                    <h4>
                      页面分数（{{ details[site.id].pages?.length || 0 }}）
                    </h4>
                    <div
                      v-for="page in details[site.id].pages"
                      :key="page.id"
                      class="detail-page"
                    >
                      <span :title="page.url">{{ page.title || page.url }}</span
                      ><b>{{ page.page_score ?? "待补齐" }}</b
                      ><small
                        >站内 {{ page.onsite_score ?? "--" }}/66 · 技术
                        {{ page.dimensions?.technical_structure ?? "--" }} ·
                        内容 {{ page.dimensions?.content_structure ?? "--" }} ·
                        外链
                        {{
                          page.dimensions?.backlink_authority ?? "待接入"
                        }}</small
                      >
                    </div>
                  </div>
                </div></template
              >
            </div>
          </article>
        </div>
      </el-tab-pane>
      <el-tab-pane
        :label="`问题中心 ${issues.length ? issues.length : ''}`"
        name="issues"
      >
        <div class="filters">
          <el-select
            v-model="issueFilter"
            clearable
            placeholder="状态"
            @change="loadIssues"
            ><el-option label="待处理" value="open" /><el-option
              label="处理中"
              value="in_progress" /><el-option label="已解决" value="resolved"
          /></el-select>
        </div>
        <div class="next-action" v-if="nextIssue">
          <div>
            <small>建议下一步</small><strong>{{ nextIssue.title }}</strong
            ><span>{{ nextIssue.site_name }} · {{ nextIssue.evidence }}</span>
          </div>
          <el-button type="primary" size="small" @click="startIssue(nextIssue)"
            ><i class="fas fa-wand-magic-sparkles" /> 生成修复候选</el-button
          >
        </div>
        <el-table :data="issues" v-loading="loading" stripe>
          <el-table-column label="严重度" width="90"
            ><template #default="{ row }"
              ><el-tag :type="severityType(row.severity)" size="small">{{
                severityName(row.severity)
              }}</el-tag></template
            ></el-table-column
          >
          <el-table-column prop="title" label="问题" min-width="180" />
          <el-table-column prop="site_name" label="站点" min-width="130" />
          <el-table-column label="真实证据" min-width="260"
            ><template #default="{ row }"
              ><span class="evidence">{{ row.evidence }}</span></template
            ></el-table-column
          >
          <el-table-column label="状态" width="145"
            ><template #default="{ row }"
              ><el-select
                v-model="row.status"
                size="small"
                @change="updateIssue(row)"
                ><el-option label="待处理" value="open" /><el-option
                  label="处理中"
                  value="in_progress" /><el-option
                  label="已解决"
                  value="resolved" /><el-option
                  label="忽略"
                  value="ignored" /></el-select></template
          ></el-table-column>
          <el-table-column label="动作" width="90"
            ><template #default="{ row }"
              ><el-button
                link
                type="primary"
                size="small"
                @click="startIssue(row)"
                >处理</el-button
              ></template
            ></el-table-column
          >
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="扫描历史" name="scans">
        <el-table :data="scans" v-loading="loading" stripe
          ><el-table-column prop="site_name" label="站点" /><el-table-column
            label="状态"
            ><template #default="{ row }"
              ><el-tag
                :type="
                  row.status === 'completed'
                    ? 'success'
                    : row.status === 'failed'
                      ? 'danger'
                      : 'warning'
                "
                >{{ scanStatus(row.status) }}</el-tag
              ></template
            ></el-table-column
          ><el-table-column prop="pages_scanned" label="页面" /><el-table-column
            prop="issue_count"
            label="问题" /><el-table-column
            prop="score"
            label="分数" /><el-table-column
            prop="created_at"
            label="开始时间"
            min-width="160" /><el-table-column
            prop="error_message"
            label="失败原因"
            min-width="180"
        /></el-table>
      </el-tab-pane>
      <el-tab-pane label="页面分数" name="pages"
        ><el-table :data="pages" v-loading="loading" stripe
          ><el-table-column
            prop="site_name"
            label="站点"
            min-width="140"
          /><el-table-column
            prop="url"
            label="页面"
            min-width="240"
          /><el-table-column label="SEO 仪表盘" width="150"
            ><template #default="{ row }"
              ><div class="page-score-dashboard">
                <div
                  class="mini-gauge"
                  :class="{ pending: row.page_score == null }"
                  :style="pageGaugeStyle(row)"
                >
                  <b>{{ row.page_score ?? "待补齐" }}</b>
                </div>
                <span>站内 {{ row.onsite_score ?? "--" }}/66</span>
              </div></template
            ></el-table-column
          ><el-table-column label="三维健康数据" min-width="260"
            ><template #default="{ row }"
              ><div class="page-health-data">
                <span
                  >技术
                  {{ row.page_dimensions?.technical_structure ?? "--" }}</span
                ><span
                  >内容
                  {{ row.page_dimensions?.content_structure ?? "--" }}</span
                ><span
                  >外链
                  {{
                    row.page_dimensions?.backlink_authority ?? authorityStatusText(row)
                  }}</span
                ><span>覆盖 {{ row.page_coverage ?? "--" }}%</span>
              </div></template
            ></el-table-column
          ><el-table-column label="操作" width="210"
            ><template #default="{ row }"
              ><el-button link type="primary" @click="openPageScore(row)"
                >查看详情</el-button
              ><el-button
                link
                type="success"
                :loading="metadataGenerating === row.id"
                @click="generatePageMetadata(row)"
                >AI 标题与摘要</el-button
              ></template
            ></el-table-column
          ></el-table
        ></el-tab-pane
      >
    </el-tabs>
    <el-dialog v-model="pageScoreDialog" title="页面 SEO 分析" width="760px"
      ><template v-if="selectedPage"
        ><div class="page-score-modal">
          <div class="modal-score">
            <div
              class="score-gauge pending"
              :style="pageGaugeStyle(selectedPage)"
            >
              <strong>{{ selectedPage.page_score ?? "待补齐" }}</strong
              ><small>SEO</small>
            </div>
            <div>
              <h3>{{ selectedPage.title || selectedPage.url }}</h3>
              <p>{{ selectedPage.url }}</p>
              <b>站内已验证贡献 {{ selectedPage.onsite_score ?? "--" }} / 66</b>
            </div>
          </div>
          <div class="dimension-grid">
            <div>
              <b>技术结构</b
              ><strong>{{
                selectedPage.page_dimensions?.technical_structure ?? "--"
              }}</strong
              ><small>权重 33%</small>
            </div>
            <div>
              <b>内容结构</b
              ><strong>{{
                selectedPage.page_dimensions?.content_structure ?? "--"
              }}</strong
              ><small>权重 33%</small>
            </div>
            <div>
              <b>外链权威</b><strong>{{ selectedPage.page_dimensions?.backlink_authority ?? authorityStatusText(selectedPage) }}</strong><small>权重 34%</small>
            </div>
          </div>
          <div class="rule-groups">
            <section v-for="group in ruleGroups" :key="group.status">
              <header>
                <b>{{ group.label }}</b
                ><span>{{ group.items.length }}</span>
              </header>
              <div v-if="group.items.length">
                <article v-for="rule in group.items" :key="rule.key">
                  <i :class="group.status"></i>
                  <div>
                    <b>{{ rule.label }}</b
                    ><small>{{ rule.evidence }}</small>
                  </div>
                  <span>{{ rule.points }}/{{ rule.weight }}</span>
                </article>
              </div>
              <p v-else>历史扫描未保存逐项规则证据，重新扫描后显示。</p>
            </section>
          </div>
        </div></template
      ></el-dialog
    >
    <el-dialog v-model="dialog" title="添加 SEO 站点" width="480px">
      <el-form label-position="top"
        ><el-form-item label="网站地址"
          ><el-input
            v-model="form.url"
            placeholder="https://example.com" /></el-form-item
        ><el-form-item label="站点名称（可选）"
          ><el-input
            v-model="form.name"
            placeholder="例如：品牌官网" /></el-form-item
        ><el-form-item label="主要语言"
          ><el-select v-model="form.language" style="width: 100%"
            ><el-option label="自动识别" value="auto" /><el-option
              v-for="lang in languageOptions"
              :key="lang.value"
              :label="lang.label"
              :value="lang.value" /></el-select></el-form-item
      ></el-form>
      <div class="gsc-import">
        <i class="fab fa-google" />
        <div>
          <b>导入 Google Search Console 数据</b
          ><span
            >添加站点后可授权导入查询、点击和索引数据，不替代站点扫描或所有权验证。</span
          >
        </div>
        <el-button text type="primary" @click="importGscAfterCreate"
          >授权导入</el-button
        >
      </div>
      <div class="security">
        <i class="fas fa-shield-alt" /> 系统仅允许扫描公网 HTTP/HTTPS
        地址，并限制页面大小和响应时间。
      </div>
      <template #footer
        ><el-button @click="dialog = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="create"
          >添加并继续</el-button
        ></template
      >
    </el-dialog>
    <el-dialog v-model="sitemapDialog" title="站点地图" width="680px"
      ><p class="verify-intro">
        可添加多个公开 Sitemap。扫描时会合并全部 URL 并自动去重，无需网站授权。
      </p>
      <div class="sitemap-add">
        <el-input
          v-model="sitemapUrl"
          placeholder="https://example.com/sitemap.xml"
          @keyup.enter="saveSitemap"
        /><el-button
          type="primary"
          :loading="sitemapSaving"
          @click="saveSitemap"
          ><i class="fas fa-plus" /> 添加</el-button
        >
      </div>
      <div class="sitemap-list" v-loading="sitemapLoading">
        <div v-for="item in sitemaps" :key="item.id" class="sitemap-row">
          <div>
            <a :href="item.url" target="_blank" rel="noopener">{{ item.url }}</a
            ><span
              >{{ item.page_count }} 个 URL ·
              {{ item.last_fetched_at || "尚未读取" }}</span
            >
          </div>
          <el-tag
            :type="item.status === 'active' ? 'success' : 'danger'"
            size="small"
            >{{ item.status === "active" ? "可用" : "读取失败" }}</el-tag
          ><el-button
            text
            type="danger"
            title="删除站点地图"
            @click="removeSitemap(item)"
            ><i class="fas fa-trash"
          /></el-button>
        </div>
        <el-empty
          v-if="!sitemaps.length && !sitemapLoading"
          description="暂未添加站点地图"
          :image-size="72"
        />
      </div>
      <template #footer
        ><el-button @click="sitemapDialog = false">完成</el-button
        ><el-button
          type="primary"
          :disabled="!sitemaps.length"
          :loading="scanning === sitemapSite?.id"
          @click="scan(sitemapSite)"
          ><i class="fas fa-radar" /> 开始评分</el-button
        ></template
      ></el-dialog
    >
    <el-dialog v-model="verifyDialog" title="验证网站所有权" width="620px">
      <template v-if="verifySite">
        <p class="verify-intro">
          任选一种方式配置完成后，点击“立即验证”。系统验证成功后才允许扫描该域名。
        </p>
        <el-tabs v-model="verifyMethod">
          <el-tab-pane label="HTML 文件" name="html_file"
            ><p class="label">下载验证文件并上传到网站根目录：</p>
            <div class="code-box">
              <code
                >/kanseo-verification-{{
                  verifySite.verification_token
                }}.html</code
              ><el-button text type="primary" @click="downloadVerification"
                >下载文件</el-button
              >
            </div></el-tab-pane
          ><el-tab-pane label="HTML Meta" name="meta">
            <p class="label">
              将以下标签添加到网站首页的 <code>&lt;head&gt;</code> 中：
            </p>
            <div class="code-box">
              <code>{{ metaCode }}</code
              ><el-button text type="primary" @click="copy(metaCode)"
                >复制</el-button
              >
            </div>
          </el-tab-pane>
          <el-tab-pane label="DNS TXT" name="dns">
            <p class="label">
              在域名 {{ verifySite.normalized_host }} 添加 TXT 记录：
            </p>
            <div class="code-box">
              <code>{{ dnsCode }}</code
              ><el-button text type="primary" @click="copy(dnsCode)"
                >复制</el-button
              >
            </div>
            <p class="tip">
              DNS 生效可能需要几分钟到 48 小时，取决于域名服务商。
            </p>
          </el-tab-pane>
        </el-tabs>
      </template>
      <template #footer
        ><el-button @click="verifyDialog = false">稍后验证</el-button
        ><el-button type="primary" :loading="verifying" @click="verify"
          ><i class="fas fa-check-circle" /> 立即验证</el-button
        ></template
      >
    </el-dialog>
    <el-dialog v-model="connectionDialog" title="连接网站" width="560px"
      ><p class="verify-intro">
        推荐使用账号授权，无需查找或填写 API Key。系统只申请完成 SEO
        工作所需的最小权限，随时可以撤销。
      </p>
      <div class="auth-choice">
        <button @click="importGsc">
          <i class="fab fa-google" /><b>Google 账号授权</b
          ><span>同步 Search Console 数据，适合所有网站</span></button
        ><button @click="connectionForm.connector_type = 'wordpress'">
          <i class="fab fa-wordpress" /><b>WordPress 授权</b
          ><span>连接后可提交已审核的页面修改</span>
        </button>
      </div>
      <el-collapse
        ><el-collapse-item title="开发者高级接入" name="advanced"
          ><el-form label-position="top"
            ><el-form-item label="接入方式"
              ><el-select
                v-model="connectionForm.connector_type"
                style="width: 100%"
                ><el-option label="WordPress" value="wordpress" /><el-option
                  label="通用 REST API"
                  value="rest" /><el-option
                  label="Webhook"
                  value="webhook" /></el-select></el-form-item
            ><el-form-item label="发布接口地址"
              ><el-input
                v-model="connectionForm.endpoint"
                placeholder="https://example.com/wp-json/seo-ai/v1/metadata" /></el-form-item
            ><el-form-item label="认证方式"
              ><el-select v-model="connectionForm.auth_type" style="width: 100%"
                ><el-option label="Bearer Token" value="bearer" /><el-option
                  label="Basic Auth"
                  value="basic" /><el-option
                  label="HMAC 签名"
                  value="hmac" /><el-option
                  label="无认证"
                  value="none" /></el-select></el-form-item
            ><el-form-item
              v-if="connectionForm.auth_type === 'bearer'"
              label="访问令牌"
              ><el-input
                v-model="connectionForm.token"
                type="password"
                show-password
                autocomplete="new-password" /></el-form-item
            ><template v-else-if="connectionForm.auth_type === 'basic'"
              ><el-form-item label="用户名"
                ><el-input
                  v-model="connectionForm.username"
                  autocomplete="off" /></el-form-item
              ><el-form-item label="密码"
                ><el-input
                  v-model="connectionForm.password"
                  type="password"
                  show-password
                  autocomplete="new-password" /></el-form-item></template
            ><el-form-item
              v-else-if="connectionForm.auth_type === 'hmac'"
              label="签名密钥"
              ><el-input
                v-model="connectionForm.secret"
                type="password"
                show-password
                autocomplete="new-password" /></el-form-item></el-form></el-collapse-item></el-collapse
      ><template #footer
        ><el-button @click="connectionDialog = false">取消</el-button
        ><el-button
          v-if="connectionSite?.connection_status === 'approved'"
          :loading="connectionTesting"
          @click="testConnection"
          ><i class="fas fa-vial" /> 测试连接</el-button
        ><el-button
          type="primary"
          :loading="connectionSubmitting"
          @click="requestConnection"
          ><i class="fas fa-paper-plane" /> 继续连接</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>
<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "@/api";
import { ElMessage, ElMessageBox } from "element-plus";
const route = useRoute(),
  router = useRouter();
const pageScoreDialog = ref(false),
  selectedPage = ref(null),
  metadataGenerating = ref(null);
const sitemapDialog = ref(false),
  sitemapSaving = ref(false),
  sitemapLoading = ref(false),
  sitemapUrl = ref(""),
  sitemapSite = ref(null),
  sitemaps = ref([]);
const tab = ref("sites"),
  loading = ref(false),
  saving = ref(false),
  scanning = ref(null),
  authorityRefreshing = ref(null),
  gscSyncing = ref(null),
  dialog = ref(false),
  verifyDialog = ref(false),
  verifying = ref(false),
  verifySite = ref(null),
  verifyMethod = ref("html_file"),
  sites = ref([]),
  issues = ref([]),
  scans = ref([]),
  pages = ref([]),
  workspace = ref(null),
  siteDetails = ref({}),
  details = ref({}),
  detailsLoading = ref({}),
  issueFilter = ref(""),
  form = reactive({ url: "", name: "", language: "auto" }),
  languageOptions = [
    { value: "zh-CN", label: "简体中文" },
    { value: "zh-TW", label: "繁體中文" },
    { value: "en-US", label: "English" },
    { value: "ja-JP", label: "日本語" },
    { value: "ko-KR", label: "한국어" },
    { value: "de-DE", label: "Deutsch" },
    { value: "fr-FR", label: "Français" },
    { value: "es-ES", label: "Español" },
  ],
  connectionDialog = ref(false),
  connectionSubmitting = ref(false),
  connectionTesting = ref(false),
  connectionSite = ref(null),
  connectionForm = reactive({
    connector_type: "wordpress",
    endpoint: "",
    auth_type: "bearer",
    token: "",
    username: "",
    password: "",
    secret: "",
  }),
  connectionStatusText = {
    pending: "待审核",
    approved: "已批准",
    rejected: "已拒绝",
  };
const metaCode = computed(() =>
  verifySite.value
    ? `<meta name="seo-ai-verification" content="${verifySite.value.verification_token}">`
    : "",
);
const dnsCode = computed(() =>
  verifySite.value
    ? `seo-ai-verification=${verifySite.value.verification_token}`
    : "",
);
const nextIssue = computed(
  () =>
    issues.value.find(
      (i) => ["critical", "high"].includes(i.severity) && i.status === "open",
    ) || issues.value.find((i) => i.status === "open"),
);
async function loadSitemaps() {
  if (!sitemapSite.value) return;
  sitemapLoading.value = true;
  try {
    const r = await api.get(`/user/seo/sites/${sitemapSite.value.id}/sitemaps`);
    sitemaps.value = r.data || [];
  } finally {
    sitemapLoading.value = false;
  }
}
function openSitemap(site) {
  sitemapSite.value = site;
  sitemapUrl.value = "";
  sitemaps.value = [];
  sitemapDialog.value = true;
  loadSitemaps();
}
async function saveSitemap() {
  if (!sitemapSite.value || !sitemapUrl.value.trim())
    return ElMessage.warning("请输入 Sitemap 地址");
  sitemapSaving.value = true;
  try {
    const r = await api.post(
      `/user/seo/sites/${sitemapSite.value.id}/sitemap`,
      { sitemap_url: sitemapUrl.value.trim() },
    );
    sitemapUrl.value = "";
    ElMessage.success(`已添加，发现 ${r.data.pages_discovered} 个 URL`);
    await Promise.all([loadSitemaps(), loadSites()]);
  } catch (e) {
    ElMessage.error(e.response?.data?.message || "添加 Sitemap 失败");
  } finally {
    sitemapSaving.value = false;
  }
}
async function removeSitemap(item) {
  try {
    await ElMessageBox.confirm(
      `确定删除此站点地图吗？\n${item.url}`,
      "删除站点地图",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" },
    );
    await api.delete(
      `/user/seo/sites/${sitemapSite.value.id}/sitemaps/${item.id}`,
    );
    ElMessage.success("站点地图已删除");
    await Promise.all([loadSitemaps(), loadSites()]);
  } catch (e) {
    if (e !== "cancel")
      ElMessage.error(e.response?.data?.message || "删除失败");
  }
}
async function loadOverview() {
  try {
    const r = await api.get("/user/seo/overview");
    workspace.value = r.data;
  } catch {}
}
async function loadSites() {
  loading.value = true;
  try {
    const r = await api.get("/user/seo/sites");
    sites.value = r.data?.sites || [];
  } finally {
    loading.value = false;
  }
}
async function loadIssues() {
  loading.value = true;
  try {
    const r = await api.get("/user/seo/issues", {
      params: { status: issueFilter.value || undefined },
    });
    issues.value = r.data || [];
  } finally {
    loading.value = false;
  }
}
async function loadScans() {
  loading.value = true;
  try {
    const r = await api.get("/user/seo/scans");
    scans.value = r.data || [];
  } finally {
    loading.value = false;
  }
}
async function loadPages() {
  loading.value = true;
  try {
    const r = await api.get("/user/seo/pages");
    pages.value = r.data?.data || r.data || [];
  } finally {
    loading.value = false;
  }
}
function loadTab(name) {
  if (name === "issues") loadIssues();
  else if (name === "scans") loadScans();
  else if (name === "pages") loadPages();
  else loadSites();
}
const openPageScore = (row) => {
  selectedPage.value = row;
  pageScoreDialog.value = true;
};
const ruleGroups = computed(() => {
  const rows = selectedPage.value?.score_breakdown || [];
  return [
    {
      status: "problem",
      label: "严重问题",
      items: rows.filter((x) => x.status === "problem"),
    },
    {
      status: "improve",
      label: "改进建议",
      items: rows.filter((x) => x.status === "improve"),
    },
    {
      status: "good",
      label: "已通过",
      items: rows.filter((x) => x.status === "good"),
    },
  ];
});
async function generatePageMetadata(row) {
  metadataGenerating.value = row.id;
  try {
    await api.post(
      "/user/seo/candidates/metadata",
      { page_id: row.id },
      { timeout: 180000, suppressGlobalError: true },
    );
    ElMessage.success("AI 标题与摘要已生成，请到变更与审核中确认");
  } catch (e) {
    ElMessage.error(
      e.response?.data?.message || "生成失败，本次不会扣除 AI 点数",
    );
  } finally {
    metadataGenerating.value = null;
  }
}
async function create() {
  if (!form.url) return ElMessage.warning("请输入网站地址");
  saving.value = true;
  try {
    const r = await api.post("/user/seo/sites", form);
    dialog.value = false;
    form.url = "";
    form.name = "";
    form.language = "auto";
    ElMessage.success("站点已添加，请完成所有权验证");
    await Promise.all([loadSites(), loadOverview()]);
    openVerify(r.data);
  } finally {
    saving.value = false;
  }
}
async function importGscAfterCreate() {
  if (!form.url) return ElMessage.warning("请先填写网站地址");
  saving.value = true;
  try {
    const r = await api.post("/user/seo/sites", form);
    dialog.value = false;
    form.url = "";
    form.name = "";
    form.language = "auto";
    await Promise.all([loadSites(), loadOverview()]);
    verifySite.value = r.data;
    const auth = await api.get(`/user/seo/sites/${r.data.id}/gsc/authorize`);
    if (auth.data?.url) window.location.href = auth.data.url;
    else ElMessage.info("GSC 授权尚未配置，请联系管理员");
  } finally {
    saving.value = false;
  }
}
function openVerify(site) {
  verifySite.value = site;
  verifyDialog.value = true;
}
async function copy(value) {
  await navigator.clipboard.writeText(value);
  ElMessage.success("已复制");
}
function downloadVerification() {
  const blob = new Blob(
      [`kanseo-verification:${verifySite.value.verification_token}`],
      { type: "text/html" },
    ),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `kanseo-verification-${verifySite.value.verification_token}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
}
async function importGsc(site = verifySite.value) {
  if (!site?.id) return ElMessage.warning("请先选择站点");
  const r = await api
    .get(`/user/seo/sites/${site.id}/gsc/authorize`)
    .catch(() => null);
  if (r?.data?.url) window.location.href = r.data.url;
}
async function syncGsc(site) {
  gscSyncing.value = site.id;
  try {
    const r = await api.post(`/user/seo/sites/${site.id}/gsc/sync`, {}, { timeout: 60000 });
    ElMessage.success(`同步完成，更新 ${r.data?.rows || 0} 天真实指标`);
    await loadSites();
  } finally { gscSyncing.value = null; }
}
async function disconnectGsc(site) {
  try {
    await ElMessageBox.confirm("断开后将删除本地 Search Console 指标和授权令牌，确定继续吗？", "断开 Search Console", { type: "warning", confirmButtonText: "断开并删除", cancelButtonText: "取消" });
    await api.delete(`/user/seo/sites/${site.id}/gsc`);
    ElMessage.success("已断开并删除本地 GSC 数据");
    await loadSites();
  } catch (e) { if (e !== "cancel") ElMessage.error(e.response?.data?.message || "断开失败"); }
}
const formatMetric = value => Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 });
const formatPercent = value => `${(Number(value || 0) * 100).toFixed(2)}%`;
const gscVerdict = value => ({ PASS: "已编入索引", FAIL: "未编入索引", PARTIAL: "部分通过", NEUTRAL: "待确认", UNAVAILABLE: "暂不可用" }[value] || "待同步");
async function verify() {
  if (!verifySite.value) return;
  verifying.value = true;
  try {
    const r = await api.post(`/user/seo/sites/${verifySite.value.id}/verify`, {
      method: verifyMethod.value,
    });
    ElMessage.success(`验证成功，发现 ${r.data.pages_discovered} 个页面`);
    verifyDialog.value = false;
    await Promise.all([loadSites(), loadOverview()]);
  } finally {
    verifying.value = false;
  }
}
const dimensionKeys = [
  "technical_structure",
  "content_structure",
  "backlink_authority",
];
const scoreModel = (site) => {
  try {
    return typeof site.last_score_model === "string"
      ? JSON.parse(site.last_score_model || "{}")
      : site.last_score_model || {};
  } catch {
    return {};
  }
};
const scoreCoverage = (site) =>
  Math.round(Number(scoreModel(site).coverage || 0));
const scoreConfidence = (site) =>
  Math.round(Number(scoreModel(site).confidence || 0) * 100);
const scoreLabel = (site) =>
  scoreModel(site).status === "limited" ||
  scoreModel(site).dimensions?.backlink_authority === null
    ? "待补齐"
    : (site.last_score ?? "待补齐");
const gaugeStyle = (site) => {
  const m = scoreModel(site),
    v = Number(m.onsiteScore);
  return {
    "--gauge": `${Number.isFinite(v) ? (Math.max(0, Math.min(66, v)) / 66) * 100 : 0}%`,
  };
};
const pageGaugeStyle = (row) => ({
  "--gauge": `${row.page_score == null ? (Math.max(0, Math.min(66, Number(row.onsite_score) || 0)) / 66) * 100 : Number(row.page_score)}%`,
});
const dimensionWeight = (key) =>
  ({ technical_structure: 33, content_structure: 33, backlink_authority: 34 })[
    key
  ] || 0;
const dimensionName = (key) =>
  ({
    technical_structure: "技术结构",
    content_structure: "内容结构",
    backlink_authority: "外链权威",
    technical: "技术结构",
    content: "内容结构",
  })[key] || key;
const authorityStatusText = (model) =>
  ({
    auth_error: "鉴权失败",
    rate_limited: "请求受限",
    unavailable: "暂不可用",
    not_configured: "未配置",
    not_connected: "未刷新",
  })[model?.authorityStatus] || "待刷新";
const scoreSummary = (model) =>
  model?.status === "limited" || model?.dimensions?.backlink_authority === null
    ? `站内已验证贡献 ${model?.onsiteScore ?? "--"}/66；外链权威${authorityStatusText(model)}${model?.authorityMessage ? `：${model.authorityMessage}` : ""}，因此暂不生成完整分数。`
    : `完整 SEO 分数 ${model?.score ?? "--"}/100`;
async function refreshAuthority(site) {
  authorityRefreshing.value = site.id;
  try {
    const r = await api.post(`/user/seo/sites/${site.id}/authority/refresh`, {}, { timeout: 30000, suppressGlobalError: true });
    ElMessage.success(`外链权威已更新：DR ${r.data?.domain_rating ?? "--"}，完整 SEO 分数 ${r.data?.score ?? "--"}`);
  } catch (e) {
    ElMessage.error(e.response?.data?.message || "外链权威刷新失败");
  } finally {
    details.value[site.id] = null;
    await Promise.all([loadSites(), loadOverview(), loadScans(), loadPages()]);
    authorityRefreshing.value = null;
  }
}
async function toggleDetails(site) {
  siteDetails.value[site.id] = !siteDetails.value[site.id];
  if (!siteDetails.value[site.id] || details.value[site.id]) return;
  detailsLoading.value[site.id] = true;
  try {
    const r = await api.get(`/user/seo/sites/${site.id}/score-details`);
    details.value[site.id] = r.data?.data ||
      r.data || {
        site: null,
        scan: null,
        score_model: {},
        issues: [],
        pages: [],
      };
  } catch (err) {
    details.value[site.id] = {
      site: null,
      scan: null,
      score_model: {},
      issues: [],
      pages: [],
      error: err?.response?.data?.message || "暂时无法读取评分详情",
    };
  } finally {
    detailsLoading.value[site.id] = false;
  }
}
async function scan(site) {
  if (scanning.value !== null) return;
  if (scanBlocked(site)) {
    ElMessage.warning(scanHint(site));
    return;
  }
  scanning.value = site.id;
  try {
    const r = await api.post(
      `/user/seo/sites/${site.id}/scan`,
      {},
      { timeout: 600000, suppressGlobalError: true },
    );
    ElMessage.success(
      `审计 ${r.data.pages_scanned} 页完成，站内已验证贡献 ${r.data.score_model?.onsiteScore ?? "--"}/66`,
    );
    details.value[site.id] = null;
    await Promise.all([
      loadSites(),
      loadOverview(),
      loadScans(),
      loadPages(),
      loadIssues(),
    ]);
  } catch (e) {
    const message = e.response?.data?.message || e.message || "站点扫描失败";
    if (["SCAN_INTERVAL", "SCAN_IN_PROGRESS"].includes(e.response?.data?.code)) ElMessage.warning(message);
    else ElMessage.error(message);
  } finally {
    scanning.value = null;
  }
}
function scanRetryAt(site) {
  const value = site?.next_manual_scan_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}
function scanBlocked(site) {
  return scanRetryAt(site) > Date.now();
}
function scanRemaining(site) {
  const minutes = Math.max(1, Math.ceil((scanRetryAt(site) - Date.now()) / 60000));
  if (minutes >= 60) return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
  return `${minutes} 分钟`;
}
function scanHint(site) {
  if (site?.active_scan_id) return `扫描任务 #${site.active_scan_id} 正在运行，请等待完成`;
  if (!scanBlocked(site)) return site?.last_scan_at ? "重新扫描站点" : "开始站点评分";
  return `扫描冷却中，${scanRemaining(site)}后可再次扫描（${new Date(scanRetryAt(site)).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}）`;
}
function scanButtonText(site) {
  if (scanning.value === site.id || site?.active_scan_id) return "扫描中";
  if (scanBlocked(site)) return "冷却中";
  return site?.last_scan_at ? "重新扫描" : "开始评分";
}
function openConnection(site) {
  connectionSite.value = site;
  connectionForm.connector_type = "wordpress";
  connectionForm.endpoint = "";
  connectionForm.auth_type = "bearer";
  connectionForm.token = "";
  connectionForm.username = "";
  connectionForm.password = "";
  connectionForm.secret = "";
  connectionDialog.value = true;
}
async function removeSite(site) {
  try {
    await ElMessageBox.confirm(
      `确定删除站点“${site.name}”吗？站点历史扫描、分数和审计记录会保留。`,
      "删除站点",
      {
        type: "warning",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
      },
    );
    await api.delete(`/user/seo/sites/${site.id}`);
    ElMessage.success("站点已删除，历史数据已保留");
    await Promise.all([loadSites(), loadOverview()]);
  } catch (e) {
    if (e !== "cancel")
      ElMessage.error(e.response?.data?.message || "删除站点失败");
  }
}
async function requestConnection() {
  if (!connectionSite.value) return;
  connectionSubmitting.value = true;
  try {
    await api.post(
      `/user/seo/sites/${connectionSite.value.id}/connection-request`,
      connectionForm,
    );
    ElMessage.success("接入申请已提交，等待管理员审核");
    connectionForm.token = "";
    connectionForm.password = "";
    connectionForm.secret = "";
    connectionDialog.value = false;
    await loadSites();
  } finally {
    connectionSubmitting.value = false;
  }
}
async function testConnection() {
  if (!connectionSite.value) return;
  connectionTesting.value = true;
  try {
    await api.post(
      `/user/seo/sites/${connectionSite.value.id}/connection-test`,
      { endpoint: connectionForm.endpoint },
    );
    ElMessage.success("连接测试通过");
  } finally {
    connectionTesting.value = false;
  }
}
async function toggleSchedule(site) {
  const enabled = !!site.auto_scan_enabled;
  try {
    const r = await api.put(`/user/seo/sites/${site.id}/schedule`, { enabled });
    site.next_scan_at = r.data?.next_scan_at || site.next_scan_at;
    ElMessage.success(enabled ? "定时扫描已开启" : "定时扫描已关闭");
  } catch {
    site.auto_scan_enabled = !enabled;
  }
}
async function updateIssue(row) {
  try {
    await api.put(`/user/seo/issues/${row.id}/status`, { status: row.status });
    ElMessage.success("状态已更新");
    loadOverview();
  } catch {
    loadIssues();
  }
}
async function startIssue(row) {
  if (!row.page_id) {
    ElMessage.info(
      "该问题没有关联页面，仍保持待处理，请在审核队列补充修复方案",
    );
    return;
  }
  try {
    await api.post("/user/seo/candidates/metadata", {
      page_id: row.page_id,
      issue_id: row.id,
    });
    if (row.status === "open") {
      row.status = "in_progress";
      await updateIssue(row);
    }
    ElMessage.success("已生成基于页面事实的候选，请进入审核");
    window.location.href = "/user/seo/metadata";
  } catch (e) {
    ElMessage.error(
      e.response?.data?.message || "候选生成失败，未扣除 AI 算力",
    );
  }
}
const severityType = (s) =>
    ({ critical: "danger", high: "danger", medium: "warning", low: "info" })[s],
  severityName = (s) =>
    ({ critical: "严重", high: "高", medium: "中", low: "低" })[s],
  scanStatus = (s) =>
    ({
      queued: "排队中",
      running: "扫描中",
      completed: "已完成",
      failed: "失败",
    })[s] || s;
onMounted(() => {
  const messages = {
      imported: ["success", "Google Search Console 资源导入成功"],
      no_matching_property: [
        "warning",
        "Google 账号中没有与该域名匹配的已验证资源",
      ],
      denied: ["warning", "已取消 Google 授权"],
      invalid_state: ["error", "Google 授权已过期，请重新发起"],
      not_configured: ["error", "Google OAuth 尚未配置"],
      failed: ["error", "Google Search Console 导入失败"],
    },
    status = String(route.query.gsc || "");
  if (messages[status]) {
    ElMessage({ type: messages[status][0], message: messages[status][1] });
    const nextQuery = { ...route.query };
    delete nextQuery.gsc;
    router.replace({ path: route.path, query: nextQuery });
  }
  return Promise.all([loadOverview(), loadSites()]);
});
</script>
<style scoped>
.verify-intro {
  font-size: 13px;
  color: #475467;
  line-height: 1.6;
}
.label,
.tip {
  font-size: 12px;
  color: #667085;
}
.code-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: #17202a;
  color: #e7edf4;
  padding: 12px;
  border-radius: 6px;
  overflow: auto;
}
.code-box code {
  white-space: nowrap;
  font-size: 11px;
}
.auth-choice {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 14px 0;
}
.auth-choice button {
  display: grid;
  grid-template-columns: 30px 1fr;
  text-align: left;
  gap: 3px 8px;
  padding: 14px;
  border: 1px solid #dfe4ea;
  background: #fff;
  border-radius: 7px;
  cursor: pointer;
}
.auth-choice button:hover {
  border-color: #1677ff;
}
.auth-choice i {
  grid-row: 1/3;
  font-size: 22px;
  color: #1677ff;
}
.auth-choice b {
  font-size: 13px;
}
.auth-choice span {
  font-size: 11px;
  color: #667085;
}
.seo-sites {
  max-width: 1180px;
  margin: auto;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.page-head small {
  color: #1677ff;
  font-weight: 700;
}
.page-head h2 {
  font-size: 24px;
  margin: 5px 0;
}
.page-head p {
  margin: 0;
  color: #667085;
}
.quota {
  display: flex;
  gap: 28px;
  background: #fff;
  border: 1px solid #e4e8ee;
  border-radius: 7px;
  padding: 13px 16px;
  margin-bottom: 14px;
  font-size: 12px;
  color: #475467;
}
.site-list {
  display: grid;
  gap: 10px;
  min-height: 160px;
}
.site-list article {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #fff;
  border: 1px solid #e4e8ee;
  border-radius: 7px;
  padding: 16px;
}
.site-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  background: #edf5ff;
  color: #1677ff;
  border-radius: 7px;
}
.site-main {
  flex: 1;
  min-width: 0;
}
.site-main h3 {
  font-size: 14px;
  margin: 0 0 3px;
}
.site-main a {
  font-size: 12px;
  color: #667085;
}
.site-main > div {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 8px;
  font-size: 11px;
  color: #667085;
}
.score {
  text-align: center;
  width: 65px;
}
.score strong {
  display: block;
  font-size: 24px;
}
.score span {
  font-size: 10px;
  color: #667085;
}
.filters {
  margin-bottom: 12px;
}
.filters .el-select {
  width: 150px;
}
.evidence {
  font-size: 12px;
  color: #475467;
}
.security {
  font-size: 12px;
  color: #667085;
  background: #f7f9fb;
  padding: 10px;
  border-radius: 5px;
}
@media (max-width: 700px) {
  .page-head {
    gap: 10px;
  }
  .page-head p {
    display: none;
  }
  .quota {
    overflow: auto;
    white-space: nowrap;
  }
  .site-list article {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .site-main {
    width: calc(100% - 60px);
    flex: none;
  }
  .score {
    margin-left: 55px;
  }
}
.details-btn {
  white-space: nowrap;
}
.score small {
  display: block;
  color: #667085;
  font-size: 9px;
  line-height: 1.5;
  white-space: nowrap;
}
.score-details {
  flex-basis: 100%;
  border-top: 1px solid #edf0f3;
  padding: 16px 4px 2px;
  margin-top: 2px;
}
.detail-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #667085;
  font-size: 11px;
  margin-bottom: 12px;
}
.detail-head strong {
  font-size: 13px;
  color: #344054;
}
.dimension-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}
.dimension-grid > div {
  background: #f7f9fb;
  border: 1px solid #edf0f3;
  padding: 10px;
  border-radius: 5px;
}
.dimension-grid b,
.dimension-grid small {
  display: block;
  color: #667085;
  font-size: 10px;
}
.dimension-grid strong {
  display: block;
  font-size: 20px;
  margin: 3px 0;
}
.detail-columns {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 18px;
}
.detail-columns h4 {
  font-size: 12px;
  margin: 0 0 8px;
}
.detail-issue {
  display: flex;
  gap: 8px;
  padding: 9px 0;
  border-bottom: 1px solid #f0f2f5;
}
.detail-issue b {
  font-size: 12px;
}
.detail-issue p,
.detail-issue small {
  display: block;
  margin: 3px 0;
  color: #667085;
  font-size: 11px;
  line-height: 1.45;
}
.detail-page {
  display: grid;
  grid-template-columns: 1fr 38px;
  gap: 4px;
  border-bottom: 1px solid #f0f2f5;
  padding: 8px 0;
  font-size: 11px;
}
.detail-page span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail-page b {
  text-align: right;
  color: #1677ff;
  font-size: 15px;
}
.detail-page small {
  grid-column: 1/-1;
  color: #667085;
  font-size: 10px;
}
@media (max-width: 700px) {
  .detail-columns {
    grid-template-columns: 1fr;
  }
  .detail-head {
    display: block;
  }
  .detail-head span {
    display: block;
    margin-top: 4px;
  }
  .details-btn {
    margin-left: 55px;
  }
}
</style>
<style scoped>
.page-score-modal {
  display: grid;
  gap: 16px;
}
.modal-score {
  display: flex;
  align-items: center;
  gap: 16px;
}
.modal-score h3 {
  font-size: 14px;
  margin: 0 0 5px;
}
.modal-score p {
  font-size: 11px;
  color: #667085;
  margin: 0 0 8px;
  word-break: break-all;
}
.rule-groups {
  display: grid;
  gap: 10px;
}
.rule-groups section {
  border: 1px solid #e4e8ee;
  border-radius: 6px;
  overflow: hidden;
}
.rule-groups section > header {
  display: flex;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f8fafc;
  font-size: 12px;
}
.rule-groups article {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-top: 1px solid #edf0f3;
}
.rule-groups article i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.rule-groups article i.problem {
  background: #d94b4b;
}
.rule-groups article i.improve {
  background: #d39a25;
}
.rule-groups article i.good {
  background: #159570;
}
.rule-groups article b {
  display: block;
  font-size: 11px;
}
.rule-groups article small {
  display: block;
  color: #667085;
  margin-top: 3px;
}
.rule-groups section > p {
  padding: 10px 12px;
  color: #98a2b3;
  font-size: 11px;
}
</style>
<style scoped>
.gsc-import {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f3f7ff;
  border: 1px solid #d7e5ff;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.gsc-import > i {
  font-size: 20px;
  color: #1677ff;
}
.gsc-import > div {
  display: grid;
  flex: 1;
}
.gsc-import span {
  font-size: 11px;
  color: #667085;
  margin-top: 2px;
}
.gsc-dashboard{grid-column:2/-1;background:#f8fafc;border:1px solid #e4e8ee;border-radius:7px;padding:12px 14px}.gsc-head{display:flex;align-items:flex-start;justify-content:space-between}.gsc-head>div{display:flex;align-items:center;gap:7px;min-width:0}.gsc-head i{color:#4285f4}.gsc-head span{font-size:11px;color:#667085;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gsc-metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:10px}.gsc-metrics>div{background:#fff;border:1px solid #edf0f3;border-radius:5px;padding:9px}.gsc-metrics span,.gsc-metrics small,.gsc-sync-time{display:block;color:#667085;font-size:10px}.gsc-metrics b{display:block;font-size:16px;margin-top:3px}.gsc-metrics small{margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gsc-sync-time{margin-top:8px}
@media(max-width:900px){.gsc-dashboard{grid-column:1/-1}.gsc-metrics{grid-template-columns:repeat(2,1fr)}.gsc-metrics>div:last-child{grid-column:1/-1}}
.site-list article {
  flex-wrap: wrap;
}
.score-details {
  flex: 0 0 100%;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
}
@media (max-width: 700px) {
  .site-actions {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
  }
  .site-actions .el-switch {
    margin-left: auto;
  }
  .dimension-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.quota-action {
  color: #1677ff;
  cursor: pointer;
  margin-left: auto;
}
.quota-action i {
  margin-right: 4px;
}
.next-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  background: #f0f6ff;
  border: 1px solid #cfe0ff;
  border-radius: 6px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.next-action small {
  display: block;
  color: #1677ff;
  font-size: 11px;
}
.next-action strong {
  display: block;
  font-size: 13px;
  margin: 3px 0;
}
.next-action span {
  display: block;
  color: #667085;
  font-size: 11px;
  max-width: 650px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.score-notice {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #f0f9f4;
  border: 1px solid #ccebd9;
  border-radius: 5px;
  color: #16784b;
  font-size: 12px;
}
.score {
  width: 110px;
}
.score strong {
  font-size: 20px;
}
.dimension-grid > div:last-child strong {
  color: #98a2b3;
}
.score-dashboard {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 220px;
}
.score-gauge {
  --gauge: 0%;
  width: 74px;
  height: 74px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: conic-gradient(#16a46b var(--gauge), #e8edf2 0);
  position: relative;
}
.score-gauge:before {
  content: "";
  position: absolute;
  inset: 8px;
  border-radius: 50%;
  background: #fff;
}
.score-gauge strong,
.score-gauge small {
  position: relative;
  z-index: 1;
}
.score-gauge strong {
  font-size: 16px;
}
.score-gauge small {
  font-size: 8px;
  color: #667085;
}
.score-gauge.pending {
  background: conic-gradient(#f2b529 var(--gauge), #e8edf2 0);
}
.score-dashboard-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 10px;
  color: #667085;
  white-space: nowrap;
}
.score-dashboard-meta b {
  font-size: 12px;
  color: #344054;
}
.page-score-dashboard {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mini-gauge {
  --gauge: 0%;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: conic-gradient(#16a46b var(--gauge), #e8edf2 0);
  position: relative;
}
.mini-gauge:before {
  content: "";
  position: absolute;
  inset: 5px;
  background: #fff;
  border-radius: 50%;
}
.mini-gauge b {
  position: relative;
  z-index: 1;
  font-size: 10px;
}
.mini-gauge.pending {
  background: conic-gradient(#f2b529 var(--gauge), #e8edf2 0);
}
.page-score-dashboard span {
  font-size: 10px;
  color: #667085;
}
.page-health-data {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.page-health-data span {
  padding: 3px 6px;
  background: #f5f7fa;
  border-radius: 4px;
  color: #667085;
  font-size: 10px;
}
@media (max-width: 700px) {
  .score-dashboard {
    min-width: 190px;
  }
  .score-dashboard-meta {
    font-size: 9px;
  }
  .score-gauge {
    width: 64px;
    height: 64px;
  }
}
.sitemap-add {
  display: flex;
  gap: 10px;
  margin: 14px 0;
}
.sitemap-list {
  min-height: 100px;
  border-top: 1px solid #edf0f3;
}
.sitemap-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 34px;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #edf0f3;
}
.sitemap-row > div {
  min-width: 0;
}
.sitemap-row a {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #1677ff;
  font-size: 12px;
}
.sitemap-row span {
  display: block;
  margin-top: 4px;
  color: #667085;
  font-size: 10px;
}
@media (max-width: 700px) {
  .sitemap-add {
    align-items: stretch;
  }
  .sitemap-row {
    grid-template-columns: minmax(0, 1fr) 34px;
  }
  .sitemap-row .el-tag {
    display: none;
  }
}
</style>
