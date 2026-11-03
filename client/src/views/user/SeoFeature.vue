<template>
  <div
    class="feature-page"
    :class="`module-${route.params.module}`"
    v-loading="loading"
  >
    <header class="page-head">
      <div>
        <small>SEO AI WORKSPACE</small>
        <h2>{{ meta.title }}</h2>
        <p>{{ meta.description }}</p>
      </div>
      <el-button type="primary" @click="run"
        ><i class="fas fa-wand-magic-sparkles" /> {{ meta.action }}</el-button
      >
    </header>
    <el-alert
      v-if="loadError"
      :title="loadError"
      type="error"
      show-icon
      :closable="false"
      class="load-error"
      ><el-button size="small" type="danger" plain @click="loadWorkspace"
        >重新获取工作区</el-button
      ></el-alert
    >
    <section class="summary">
      <div>
        <span>工作区</span
        ><b>{{ overview.organization?.plan_name || "Free 免费版" }}</b>
      </div>
      <div>
        <span>活跃站点</span><b>{{ overview.sites?.total || 0 }}</b>
      </div>
      <div>
        <span>待处理问题</span><b>{{ overview.issues?.open || 0 }}</b>
      </div>
      <div>
        <span>本月 AI 算力</span
        ><b
          >{{ overview.usage?.ai_points || 0 }} /
          {{ overview.quota?.ai_points || 20 }}</b
        >
      </div>
    </section>
    <section class="workspace">
      <div class="panel">
        <div class="panel-head">
          <h3>{{ meta.title }}工作台</h3>
          <el-tag type="success" size="small">人工审核保护</el-tag>
        </div>
        <p class="module-intro">{{ meta.intro }}</p>
        <el-input
          v-if="isAi"
          v-model="prompt"
          type="textarea"
          :rows="4"
          :placeholder="meta.placeholder"
        /><el-select
          v-else-if="isEvidenceModule"
          v-model="query"
          filterable
          clearable
          class="page-select"
          placeholder="选择当前工作区已扫描页面"
        >
          <el-option v-for="page in pages" :key="page.id" :label="`${page.site_name} · ${page.title || page.url}`" :value="page.url">
            <span>{{ page.title || '未设置标题' }}</span><small>{{ page.url }}</small>
          </el-option>
        </el-select><el-input
          v-else
          v-model="query"
          :placeholder="meta.placeholder"
          clearable
          ><template #prefix><i class="fas fa-search" /></template
        ></el-input>
        <div class="capabilities">
          <span v-for="item in meta.capabilities" :key="item"
            ><i class="fas fa-check" /> {{ item }}</span
          >
        </div>
        <div class="result" v-if="result">
          <i class="fas fa-circle-check" />
          <div>
            <b>{{ result.title }}</b>
            <p>{{ result.text }}</p>
          </div>
          <el-button v-if="!analysis" size="small" @click="approve">{{
            meta.resultAction
          }}</el-button>
        </div>
        <div v-else class="empty">
          <i :class="meta.icon" />
          <p>{{ meta.empty }}</p>
        </div>
      </div>
      <aside class="checklist">
        <h3>{{ meta.flowTitle }}</h3>
        <div
          v-for="(step, i) in steps"
          :key="step"
          :class="{ done: i < progress }"
        >
          <em>{{ i < progress ? "✓" : i + 1 }}</em
          ><span>{{ step }}</span>
        </div>
        <el-button text type="primary" @click="$router.push('/user/seo-sites')"
          >查看站点与问题 <i class="fas fa-arrow-right"
        /></el-button>
      </aside>
    </section>
    <section v-if="analysis" class="module-output evidence-output">
      <header>
        <b>真实分析证据</b><span>{{ analysis.url }}</span>
      </header>
      <template v-if="analysis.summary"
        ><dl>
          <dt>标题</dt>
          <dd>{{ analysis.summary.title || "未检测到" }}</dd>
          <dt>描述</dt>
          <dd>{{ analysis.summary.description || "未检测到" }}</dd>
          <dt>正文字符</dt>
          <dd>{{ analysis.summary.body_chars }}</dd>
          <dt>H1 数量</dt>
          <dd>{{ analysis.summary.h1_count }}</dd>
        </dl>
        <div class="brief-box">
          <b>当前页面内容简报</b>
          <span>核心主题：{{ analysis.summary.brief?.primary_topic || "未从页面识别" }}</span>
          <span>证据来源：{{ analysis.summary.brief?.evidence_source }}</span>
          <p>{{ analysis.summary.body_excerpt || "本次扫描尚未保存正文摘要，请重新扫描站点后生成完整简报。" }}</p>
        </div>
        <div v-for="item in analysis.summary.recommendations" :key="item" class="evidence-row"><b>建议</b><span>{{ item }}</span></div>
        <div
          v-for="item in analysis.summary.issues"
          :key="item.title"
          class="evidence-row"
        >
          <b>{{ item.title }}</b
          ><span>{{ item.evidence }}</span
          ><small>{{ item.recommendation }}</small>
        </div></template
      ><template v-else-if="analysis.links"
        ><el-alert
          :title="analysis.links.recommendation"
          :type="analysis.links.orphan ? 'warning' : 'success'"
          :closable="false"
        />
        <div
          v-for="link in analysis.links.outgoing"
          :key="link.url"
          class="evidence-row"
        >
          <b>{{ link.anchor || "无锚文本" }}</b><span>{{ link.url }}</span><small>{{ link.nofollow ? "nofollow" : "可跟踪" }}</small>
        </div>
        <div v-for="item in analysis.links.opportunities" :key="item.target_url" class="evidence-row opportunity"><b>建议链接：{{ item.target_title }}</b><span>{{ item.target_url }}</span><small>建议锚文本：{{ item.anchor_suggestion || "请人工填写" }}</small></div>
      </template><template v-else-if="analysis.schema"
        ><el-alert
          :title="analysis.schema.recommendation"
          :type="analysis.schema.valid ? 'success' : 'warning'"
          :closable="false"
        />
        <pre>{{
          JSON.stringify(analysis.schema.detected, null, 2)
        }}</pre><b>基于当前页面事实的候选</b><pre>{{ JSON.stringify(analysis.schema.candidate, null, 2) }}</pre></template
      ><template v-else-if="analysis.geo"
        ><dl>
          <dt>llms.txt</dt>
          <dd>
            {{
              analysis.geo.llms_available
                ? `可访问（HTTP ${analysis.geo.llms_status}）`
                : "未发现"
            }}
          </dd>
          <dt>页面索引</dt>
          <dd>{{ analysis.geo.checks?.indexable ? "允许" : "页面禁止索引" }}</dd>
          <dt>引用准备度</dt>
          <dd>{{ analysis.geo.citation_ready ? "通过" : "待优化" }}</dd>
          <dt>GEO 检查分</dt><dd>{{ analysis.geo.score }}</dd>
        </dl>
        <div v-for="(allowed, agent) in analysis.geo.agent_access" :key="agent" class="evidence-row"><b>{{ agent }}</b><span>{{ allowed ? "robots.txt 未发现全站阻断" : "robots.txt 已阻断" }}</span></div>
        <div v-for="item in analysis.geo.recommendations" :key="item" class="evidence-row"><b>待改进</b><span>{{ item }}</span></div>
      </template>
      <footer v-if="analysis.history?.length" class="history-note">已保存本页 {{ analysis.history.length }} 次分析记录，最近一次编号 #{{ analysis.history[0].id }}</footer>
    </section>
    <section
      v-else-if="route.params.module === 'publishing'"
      class="module-output publish-lanes"
    >
      <div
        v-for="(label, i) in ['已批准', '发布中', '复扫验证', '已完成']"
        :key="label"
      >
        <em>{{ i + 1 }}</em
        ><b>{{ label }}</b
        ><span>{{ i === 0 ? "从修改记录进入" : "状态自动推进" }}</span>
      </div>
    </section>
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import api from "@/api";
import { ElMessage } from "element-plus";
const route = useRoute(),
  overview = ref({}),
  issues = ref([]),
  prompt = ref(""),
  query = ref(""),
  result = ref(null),
  analysis = ref(null),
  pages = ref([]),
  progress = ref(1),
  loading = ref(false),
  loadError = ref("");
const definitions = {
  copilot: [
    "AI SEO Copilot",
    "基于真实审计证据解释问题，生成按影响和风险排序的修复计划。",
    "询问 Copilot",
  ],
  metadata: [
    "元数据与摘要",
    "生成 Title、Meta、OG 与多语言候选，经过长度、事实和品牌规范检查。",
    "生成候选",
  ],
  content: [
    "内容质量与简报",
    "识别搜索意图、主题缺口、重复和过时内容，输出可执行简报。",
    "生成内容简报",
  ],
  "internal-links": [
    "智能内链助手",
    "发现孤立页面并推荐来源页、目标页和自然锚文本。",
    "生成内链建议",
  ],
  schema: [
    "Schema 实体图谱",
    "根据真实字段生成 JSON-LD 候选并校验实体关系。",
    "生成 Schema",
  ],
  changes: [
    "变更与审核",
    "统一管理候选差异、风险评估、多级审核与版本冲突。",
    "查看审核队列",
  ],
  publishing: [
    "发布与复扫",
    "发布前风险检查，支持失败重试、复扫验证和回滚记录。",
    "查看发布任务",
  ],
  geo: [
    "AI 可发现性中心",
    "检查 llms.txt、AI 爬虫策略、引用完整性和 AI Referral。",
    "运行可见性检查",
  ],
  "brand-radar": [
    "AI 品牌雷达",
    "追踪品牌提及、引用、情感、竞品与回答变化。",
    "配置监测",
  ],
  reports: [
    "报告与趋势",
    "对比历史健康分和修改前后效果，导出 CSV/PDF。",
    "生成报告",
  ],
  tasks: [
    "任务与告警",
    "分派负责人、截止时间，跟踪严重问题和扫描异常。",
    "创建任务",
  ],
  billing: ["账单与订阅", "管理套餐、试用、支付、用量和升级。", "查看套餐"],
  team: [
    "团队与权限",
    "邀请成员并管理 Owner、Admin、SEO、Editor、Reviewer、Viewer。",
    "管理成员",
  ],
};
const moduleConfig = {
  copilot: [
    "请描述问题或目标，Copilot 会引用审计证据回答。",
    ["证据问答", "影响排序", "工作量估算"],
    "生成修复计划",
    "生成结果后进入审核队列",
  ],
  metadata: [
    "输入页面 URL 生成标题和描述候选。",
    ["长度检查", "事实校验", "品牌规范"],
    "创建元数据变更",
    "选择页面后生成基于事实的候选",
  ],
  content: [
    "输入页面 URL 或主题，生成内容质量简报。",
    ["搜索意图", "内容缺口", "重复检测"],
    "创建内容简报",
    "选择页面后开始内容质量分析",
  ],
  "internal-links": [
    "输入页面 URL，发现孤立页面和内链机会。",
    ["孤立页识别", "来源页推荐", "锚文本校验"],
    "创建内链变更",
    "选择站点后生成内链建议",
  ],
  schema: [
    "输入页面 URL，检查结构化数据实体和缺失字段。",
    ["JSON-LD 校验", "实体关系", "字段完整性"],
    "创建 Schema 变更",
    "选择页面后运行 Schema 检查",
  ],
  changes: [
    "输入变更单编号或页面 URL，查看差异与风险。",
    ["差异对比", "风险分级", "多人审核"],
    "打开审核队列",
    "所有候选必须先通过审核",
  ],
  publishing: [
    "输入已批准的变更单，检查发布和复扫状态。",
    ["发布前检查", "失败重试", "复扫验证"],
    "打开发布任务",
    "只有已批准候选可以进入发布",
  ],
  geo: [
    "输入域名或页面 URL，检查 AI 可发现性。",
    ["llms.txt", "AI 爬虫", "引用完整性"],
    "运行可见性检查",
    "结果将记录到 GEO 监测报告",
  ],
  "brand-radar": [
    "输入品牌或竞品，配置 AI 提及监测。",
    ["品牌提及", "竞品对比", "情感变化"],
    "配置监测任务",
    "监测结果会进入定期报告",
  ],
  tasks: [
    "输入问题或扫描任务，创建负责人和截止时间。",
    ["责任人", "截止时间", "严重告警"],
    "创建跟进任务",
    "任务状态和扫描失败会触发告警",
  ],
};
const meta = computed(() => {
    const d = definitions[route.params.module] || definitions.copilot,
      c = moduleConfig[route.params.module] || moduleConfig.copilot;
    return {
      title: d[0],
      description: d[1],
      action: d[2],
      placeholder: c[0],
      capabilities: c[1],
      resultAction: c[2],
      empty: c[3],
      intro: d[1],
      flowTitle: route.params.module === "publishing" ? "发布闭环" : "执行闭环",
      icon:
        {
          content: "fas fa-file-lines",
          schema: "fas fa-code",
          geo: "fas fa-robot",
          changes: "fas fa-list-check",
          publishing: "fas fa-cloud-arrow-up",
        }[route.params.module] || "fas fa-layer-group",
    };
  }),
  isAi = computed(() => route.params.module === "copilot"),
  isEvidenceModule = computed(() => ["content", "internal-links", "schema", "geo"].includes(route.params.module)),
  steps = computed(() =>
    route.params.module === "publishing"
      ? ["选择已批准变更", "发布前检查", "提交网站", "复扫验证"]
      : route.params.module === "geo"
        ? ["检查 AI 入口", "评估可引用性", "生成建议", "持续监测"]
        : ["发现问题", "生成候选", "人工审核", "发布并复扫"],
  ),
  related = computed(() =>
    Object.entries(definitions)
      .filter(([k]) => k !== route.params.module)
      .slice(0, 6)
      .map(([key, d]) => ({
        key,
        title: d[0],
        text: d[1].slice(0, 26) + "…",
        icon:
          {
            copilot: "fas fa-wand-magic-sparkles",
            metadata: "fas fa-pen-to-square",
            content: "fas fa-file-lines",
            geo: "fas fa-robot",
            billing: "fas fa-receipt",
            team: "fas fa-users",
          }[key] || "fas fa-chart-line",
      })),
  );
async function run() {
  if (
    ["content", "internal-links", "schema", "geo"].includes(
      route.params.module,
    ) &&
    !query.value.trim() &&
    prompt.value.trim()
  )
    query.value = prompt.value.trim();
  if (!isAi.value && !query.value.trim())
    return ElMessage.warning("请输入页面 URL");
  try {
    if (isEvidenceModule.value) {
      const r = await api.post(
        `/user/seo/features/${route.params.module}/analyze`,
        { url: query.value.trim() },
      );
      const d = r.data?.data || r.data || {};
      analysis.value = d;
      result.value = {
        title: `${meta.value.title}已完成`,
        text: `分析页面：${d.url}。${route.params.module === "content" ? `发现 ${(d.summary?.issues || []).length} 个内容问题。` : route.params.module === "internal-links" ? `发现 ${d.links?.outgoing?.length || 0} 个同站链接和 ${d.links?.opportunities?.length || 0} 个机会。` : route.params.module === "schema" ? `检测到 ${d.schema?.detected?.length || 0} 个结构化数据块。` : `GEO 检查分 ${d.geo?.score ?? 0}，引用准备度 ${d.geo?.citation_ready ? "通过" : "待优化"}。`}`,
      };
    } else if (!isAi.value) {
      const r = await api.post("/user/plugin-exec/seo-analyze", { url: query.value.trim() });
      const d = r.data?.data || r.data || {};
      result.value = { title: `页面健康分 ${d.score ?? "--"}`, text: `已完成真实页面分析：发现 ${(d.issues || []).length} 个问题。` };
    } else {
      const r = await api.get("/user/seo/issues", {
        params: { status: "open" },
      });
      const items = r.data?.data || r.data || [];
      if (!items.length)
        return ElMessage.info("当前没有可引用的审计问题，请先完成站点扫描");
      const first = items[0];
      result.value = {
        title: `已读取 ${items.length} 条真实审计证据`,
        text: `优先处理：${first.title}。证据：${String(first.evidence || "").slice(0, 180)}；结果仅基于当前工作区数据，提交后进入人工审核。`,
      };
    }
    progress.value = 2;
    ElMessage.success("分析完成，失败不会扣除用量");
  } catch (e) {
    ElMessage.error(
      e.response?.data?.message || "分析失败，请检查 URL 是否可访问",
    );
  }
}
function approve() {
  progress.value = 3;
  ElMessage.success("已创建变更单，请在审核队列确认后发布");
}
async function loadWorkspace() {
  loading.value = true;
  loadError.value = "";
  try {
    const [workspace, evidence, pageList] = await Promise.all([
      api.get("/user/seo/workspace"),
      api.get("/user/seo/issues", { params: { status: "open" } }),
      api.get("/user/seo/pages"),
    ]);
    overview.value = workspace.data || {};
    issues.value = evidence.data?.data || evidence.data || [];
    pages.value = pageList.data?.data || pageList.data || [];
    if (!query.value && isEvidenceModule.value && pages.value.length) query.value = pages.value[0].url;
  } catch (e) {
    loadError.value = e.response?.data?.message || "获取工作区失败，请稍后重试";
  } finally {
    loading.value = false;
  }
}
onMounted(loadWorkspace);
</script>
<style scoped>
.module-output {
  margin-top: 14px;
  background: #fff;
  border: 1px solid #e4e8ee;
  border-radius: 7px;
  padding: 16px;
}
.module-output header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}
.module-output header span,
.module-output small,
.module-output article span,
.publish-lanes span {
  font-size: 11px;
  color: #667085;
}
.content-map > div {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-top: 1px solid #f0f2f5;
}
.content-map > div > span {
  display: grid;
  flex: 1;
}
.link-flow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  min-height: 100px;
  color: #667085;
}
.link-flow strong {
  background: #ecfdf3;
  color: #067647;
  padding: 9px 14px;
  border-radius: 5px;
}
.schema-view > div {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 14px;
}
.schema-view code {
  background: #17202a;
  color: #d7f9ec;
  padding: 18px;
  border-radius: 5px;
}
.schema-view ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.schema-view li {
  padding: 7px;
  color: #475467;
}
.geo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 0;
}
.geo-grid article {
  display: grid;
  gap: 6px;
  padding: 20px;
  border-right: 1px solid #e4e8ee;
}
.geo-grid article:last-child {
  border: 0;
}
.geo-grid i {
  font-size: 22px;
  color: #7c3aed;
}
.publish-lanes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}
.publish-lanes div {
  display: grid;
  gap: 5px;
  padding: 10px 16px;
  border-right: 1px solid #e4e8ee;
}
.publish-lanes em {
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #eef5ff;
  color: #1677ff;
  font-style: normal;
}
@media (max-width: 700px) {
  .geo-grid,
  .publish-lanes {
    grid-template-columns: 1fr 1fr;
  }
  .schema-view > div {
    grid-template-columns: 1fr;
  }
}
</style>
<style scoped>
.evidence-output dl {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px 14px;
}
.evidence-output dt {
  color: #667085;
}
.evidence-output dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.evidence-row {
  display: grid;
  gap: 4px;
  padding: 12px 0;
  border-top: 1px solid #f0f2f5;
}
.evidence-row span,
.evidence-row small {
  overflow-wrap: anywhere;
}
.evidence-output pre {
  overflow: auto;
  background: #17202a;
  color: #d7f9ec;
  padding: 14px;
  border-radius: 5px;
  max-height: 320px;
}
</style>
<style scoped>
.feature-page {
  max-width: 1180px;
  margin: auto;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 18px;
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
.load-error {
  margin-bottom: 14px;
}
.summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}
.summary > div,
.panel,
.checklist,
.cards article {
  background: #fff;
  border: 1px solid #e4e8ee;
  border-radius: 7px;
}
.summary > div {
  padding: 14px;
}
.summary span {
  display: block;
  color: #667085;
  font-size: 11px;
}
.summary b {
  display: block;
  font-size: 20px;
  margin-top: 5px;
}
.workspace {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 14px;
}
.panel,
.checklist {
  padding: 18px;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.panel h3,
.checklist h3 {
  margin: 0;
  font-size: 15px;
}
.module-intro {
  font-size: 12px;
  color: #667085;
  margin: 0 0 14px;
}
.capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 12px;
}
.capabilities span {
  font-size: 11px;
  color: #276b5b;
  background: #eef8f5;
  border-radius: 4px;
  padding: 5px 8px;
}
.capabilities i {
  margin-right: 3px;
}
.empty {
  text-align: center;
  padding: 40px 20px;
  color: #98a2b3;
}
.empty i {
  font-size: 28px;
}
.result {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #eef8f5;
  padding: 14px;
  margin-top: 14px;
  border-radius: 6px;
}
.result > i {
  color: #159570;
  font-size: 22px;
}
.result p {
  margin: 4px 0 0;
  color: #667085;
  font-size: 12px;
}
.result div {
  flex: 1;
}
.checklist div {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 0;
  border-bottom: 1px solid #f0f2f5;
  color: #667085;
  font-size: 13px;
}
.checklist em {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f2f4f7;
  display: grid;
  place-items: center;
  font-style: normal;
}
.checklist .done {
  color: #159570;
}
.checklist .done em {
  background: #d9f5eb;
}
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 14px;
}
.cards article {
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  cursor: pointer;
}
.cards i {
  color: #1677ff;
  font-size: 18px;
}
.cards span {
  font-size: 11px;
  color: #667085;
}
@media (max-width: 700px) {
  .summary {
    grid-template-columns: 1fr 1fr;
  }
  .workspace {
    grid-template-columns: 1fr;
  }
  .cards {
    grid-template-columns: 1fr 1fr;
  }
  .page-head p {
    display: none;
  }
}
</style>
