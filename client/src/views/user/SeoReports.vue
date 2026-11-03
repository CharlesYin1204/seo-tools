<template>
  <section class="reports">
    <header class="head">
      <div>
        <small>SEO AI WORKSPACE</small>
        <h2>报告与趋势</h2>
        <p>基于真实扫描记录对比健康分、页面覆盖与问题变化。</p>
      </div>
      <div class="actions">
        <el-button :disabled="!rows.length" @click="exportReport"
          ><i class="fas fa-download" /> 导出报告</el-button
        ><el-button :loading="loading" @click="load"
          ><i class="fas fa-refresh" /> 刷新</el-button
        >
      </div>
    </header>
    <div class="stats">
      <article>
        <span>完成扫描</span><b>{{ completed.length }}</b>
      </article>
      <article>
        <span>最新健康分</span><b>{{ scoreLabel(latest) }}</b>
      </article>
      <article>
        <span>累计扫描页面</span
        ><b>{{
          completed.reduce((n, r) => n + Number(r.pages_scanned || 0), 0)
        }}</b>
      </article>
      <article>
        <span>最新发现问题</span><b>{{ latest?.issue_count ?? "--" }}</b>
      </article>
    </div>
    <section v-if="latest" class="health-dashboard">
      <div
        class="health-gauge"
        :class="{ pending: scoreLabel(latest) === '待补齐' }"
        :style="gaugeStyle(latest)"
      >
        <strong>{{ scoreLabel(latest) }}</strong
        ><small>SEO</small>
      </div>
      <div class="health-detail">
        <h3>完整 SEO 健康分</h3>
        <p>
          站内已验证贡献：{{ model(latest).onsiteScore ?? "--" }} /
          66；证据覆盖：{{ model(latest).coverage ?? "--" }}%
        </p>
        <div class="dimension-grid">
          <div>
            <b>技术结构</b
            ><strong>{{
              model(latest).dimensions?.technical_structure ??
              model(latest).dimensions?.technical ??
              "--"
            }}</strong
            ><small>权重 33%</small>
          </div>
          <div>
            <b>内容结构</b
            ><strong>{{
              model(latest).dimensions?.content_structure ??
              model(latest).dimensions?.content ??
              "--"
            }}</strong
            ><small>权重 33%</small>
          </div>
          <div>
            <b>外链权威</b
            ><strong>{{
              model(latest).dimensions?.backlink_authority ?? "待配置"
            }}</strong
            ><small>权重 34% · {{ authorityStatus(latest) }}</small>
          </div>
        </div>
      </div>
    </section>
    <section v-if="completed.length >= 2" class="comparison">
      <div>
        <span>健康分变化</span
        ><strong :class="scoreDelta >= 0 ? 'up' : 'down'"
          >{{ scoreDelta > 0 ? "+" : "" }}{{ scoreDelta }}</strong
        >
      </div>
      <div>
        <span>问题变化</span
        ><strong :class="issueDelta <= 0 ? 'up' : 'down'"
          >{{ issueDelta > 0 ? "+" : "" }}{{ issueDelta }}</strong
        >
      </div>
      <div>
        <span>页面覆盖变化</span
        ><strong>{{ pageDelta > 0 ? "+" : "" }}{{ pageDelta }}</strong>
      </div>
      <small>对比最近两次已完成扫描</small>
    </section>
    <el-table :data="rows" v-loading="loading" stripe
      ><el-table-column
        prop="site_name"
        label="站点"
        min-width="170" /><el-table-column label="状态" width="100"
        ><template #default="{ row }"
          ><el-tag
            :type="
              row.status === 'completed'
                ? 'success'
                : row.status === 'failed'
                  ? 'danger'
                  : 'warning'
            "
            >{{ statusText[row.status] || row.status }}</el-tag
          ></template
        ></el-table-column
      ><el-table-column prop="pages_scanned" label="扫描页面" /><el-table-column
        prop="issue_count"
        label="发现问题" /><el-table-column
        prop="score"
        label="健康分" /><el-table-column
        prop="created_at"
        label="扫描时间"
        min-width="170" /><el-table-column
        prop="error_message"
        label="异常"
        min-width="180"
    /></el-table>
  </section>
</template>
<script setup>
import { computed, onMounted, ref } from "vue";
import api from "@/api";
import { ElMessage } from "element-plus";
const rows = ref([]),
  loading = ref(false),
  statusText = {
    queued: "排队中",
    running: "扫描中",
    completed: "已完成",
    failed: "失败",
  },
  completed = computed(() =>
    rows.value.filter((r) => r.status === "completed"),
  ),
  latest = computed(() => completed.value[0]),
  previous = computed(() => completed.value[1]),
  scoreDelta = computed(
    () => Number(latest.value?.score || 0) - Number(previous.value?.score || 0),
  ),
  issueDelta = computed(
    () =>
      Number(latest.value?.issue_count || 0) -
      Number(previous.value?.issue_count || 0),
  ),
  pageDelta = computed(
    () =>
      Number(latest.value?.pages_scanned || 0) -
      Number(previous.value?.pages_scanned || 0),
  ),
  model = (row) => {
    try {
      return typeof row?.last_score_model === "string"
        ? JSON.parse(row.last_score_model || "{}")
        : row?.last_score_model || {};
    } catch {
      return {};
    }
  },
  scoreLabel = (row) =>
    model(row).status === "limited"
      ? "待补齐"
      : (model(row).score ?? row?.score ?? "待补齐"),
  gaugeStyle = (row) => {
    const m = model(row),
      complete = m.status === "complete",
      max = complete ? 100 : 66,
      value = complete ? m.score : m.onsiteScore;
    return {
      "--gauge": `${(Math.max(0, Math.min(max, Number(value) || 0)) / max) * 100}%`,
    };
  },
  authorityStatus = (row) =>
    ({
      connected: "实时",
      cached: "缓存有效",
      stale: "最近有效缓存",
      not_configured: "未配置",
      not_connected: "未配置",
      unavailable: "暂不可用",
    })[model(row).authorityStatus] || "";
async function load() {
  loading.value = true;
  try {
    const r = await api.get("/user/seo/scans");
    rows.value = r.data?.data || r.data || [];
  } finally {
    loading.value = false;
  }
}
function exportReport() {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    ["站点", "状态", "扫描页面", "发现问题", "健康分", "扫描时间"],
    ...rows.value.map((r) => [
      r.site_name,
      statusText[r.status] || r.status,
      r.pages_scanned,
      r.issue_count,
      r.score,
      r.created_at,
    ]),
  ].map((r) => r.map(cell).join(","));
  const blob = new Blob(["\ufeff" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    }),
    link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `seo-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  ElMessage.success("报告已导出");
}
onMounted(load);
</script>
<style scoped>
.reports {
  max-width: 1180px;
  margin: auto;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 18px;
}
.head small {
  color: #1677ff;
  font-weight: 700;
}
.head h2 {
  font-size: 24px;
  margin: 5px 0;
}
.head p {
  margin: 0;
  color: #667085;
}
.actions {
  display: flex;
  gap: 8px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.stats article,
.comparison {
  background: #fff;
  border: 1px solid #e4e8ee;
  border-radius: 7px;
  padding: 15px;
}
.stats span,
.comparison span {
  font-size: 11px;
  color: #667085;
}
.stats b {
  display: block;
  font-size: 24px;
  margin-top: 5px;
}
.comparison {
  display: flex;
  align-items: center;
  gap: 30px;
  margin-bottom: 14px;
}
.comparison div {
  display: flex;
  align-items: center;
  gap: 10px;
}
.comparison strong {
  font-size: 20px;
}
.comparison .up {
  color: #159570;
}
.comparison .down {
  color: #d94b4b;
}
.comparison small {
  margin-left: auto;
  color: #98a2b3;
  font-size: 11px;
}
@media (max-width: 700px) {
  .head p {
    display: none;
  }
  .head {
    gap: 10px;
  }
  .actions {
    flex-direction: column;
  }
  .stats {
    grid-template-columns: 1fr 1fr;
  }
  .comparison {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .comparison small {
    grid-column: 1/-1;
    margin: 0;
  }
}
</style>
<style scoped>
.health-dashboard {
  display: flex;
  gap: 24px;
  align-items: center;
  background: #fff;
  border: 1px solid #e4e8ee;
  border-radius: 7px;
  padding: 20px;
  margin-bottom: 14px;
}
.health-gauge {
  --gauge: 0%;
  width: 150px;
  height: 150px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: conic-gradient(#16a46b var(--gauge), #e8edf2 0);
  position: relative;
}
.health-gauge:before {
  content: "";
  position: absolute;
  inset: 14px;
  border-radius: 50%;
  background: #fff;
}
.health-gauge strong,
.health-gauge small {
  position: relative;
  z-index: 1;
}
.health-gauge strong {
  font-size: 22px;
}
.health-gauge small {
  font-size: 10px;
  color: #667085;
}
.health-gauge.pending {
  background: conic-gradient(#f2b529 var(--gauge), #e8edf2 0);
}
.health-detail {
  flex: 1;
}
.health-detail h3 {
  margin: 0 0 6px;
  font-size: 17px;
}
.health-detail p {
  margin: 0 0 14px;
  color: #667085;
  font-size: 12px;
}
.dimension-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.dimension-grid > div {
  background: #f7f9fb;
  border: 1px solid #edf0f3;
  border-radius: 5px;
  padding: 10px;
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
  margin: 4px 0;
}
@media (max-width: 700px) {
  .health-dashboard {
    align-items: flex-start;
    flex-direction: column;
  }
  .dimension-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
