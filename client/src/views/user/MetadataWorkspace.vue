<template>
  <section class="metadata-page">
    <header class="head">
      <div>
        <small>AI METADATA WORKBENCH</small>
        <h2>元数据与摘要</h2>
        <p>只基于已扫描页面事实生成候选，审核通过后方可导出。</p>
      </div>
      <el-button @click="load" :loading="loading"
        ><i class="fas fa-refresh" /> 刷新</el-button
      >
    </header>
    <div class="quota">
      <span>本月 AI 算力</span
      ><b
        >{{ overview.usage?.ai_points || 0 }} /
        {{ overview.quota?.ai_points || 0 }}</b
      ><router-link to="/user/membership">查看额度</router-link>
    </div>
    <section class="generator">
      <div>
        <label>选择已扫描页面</label
        ><el-select
          v-model="pageId"
          filterable
          placeholder="请选择页面"
          style="width: 100%"
          ><el-option
            v-for="page in pages"
            :key="page.id"
            :value="page.id"
            :label="`${page.site_name} · ${page.url}`"
        /></el-select>
      </div>
      <el-button
        type="primary"
        :loading="generating"
        :disabled="!pageId"
        @click="generate"
        ><i class="fas fa-wand-magic-sparkles" /> 生成候选（1 点）</el-button
      >
    </section>
    <el-empty
      v-if="!pages.length && !loading"
      description="请先添加站点并完成首次扫描"
      ><router-link to="/user/seo-sites">进入站点与审计</router-link></el-empty
    >
    <div class="candidate-list" v-loading="loading">
      <article v-for="item in candidates" :key="item.id">
        <div class="candidate-head">
          <div>
            <strong>{{ item.site_name }}</strong
            ><a :href="item.url" target="_blank" rel="noopener">{{
              item.url
            }}</a>
          </div>
          <el-tag :type="statusType(item.status)" size="small">{{
            statusName(item.status)
          }}</el-tag>
        </div>
        <div class="compare">
          <div>
            <small>当前标题</small>
            <p>{{ item.original_title || "(空)" }}</p>
            <small>当前描述</small>
            <p>{{ item.original_description || "(空)" }}</p>
          </div>
          <div class="proposed">
            <small>AI 候选标题</small>
            <p>{{ item.candidate_title }}</p>
            <small>AI 候选描述</small>
            <p>{{ item.candidate_description }}</p>
          </div>
        </div>
        <div class="reason">
          <i class="fas fa-link" /> 事实依据：{{
            item.rationale ||
            "基于页面 URL、当前元数据、HTTP 状态和 H1 事实生成"
          }}
        </div>
        <div class="actions">
          <span
            >模型 {{ item.model_code }} ·
            {{ formatTime(item.created_at) }}</span
          ><template v-if="item.status === 'draft'"
            ><el-button size="small" @click="review(item, 'rejected')"
              >拒绝</el-button
            ><el-button
              type="success"
              size="small"
              @click="review(item, 'approved')"
              >批准候选</el-button
            ></template
          ><el-button
            v-if="['approved', 'exported'].includes(item.status)"
            type="primary"
            size="small"
            @click="exportItem(item)"
            ><i class="fas fa-download" />
            {{ item.status === "exported" ? "再次下载" : "导出" }}</el-button
          >
          <el-button
            v-if="['approved', 'exported', 'publish_failed'].includes(item.status)"
            type="warning"
            size="small"
            :loading="publishing === item.id"
            @click="simulatePublish(item)"
            ><i class="fas fa-cloud-arrow-up" />
            {{
              item.status === "publish_failed" ? "重新发布" : "发布并复扫"
            }}</el-button
          >
          <el-tag v-if="item.status === 'published'" type="success"
            >已发布并验证</el-tag
          >
        </div>
      </article>
      <el-empty
        v-if="pages.length && !candidates.length && !loading"
        description="选择页面生成第一个 AI 元数据候选"
      />
    </div>
  </section>
</template>
<script setup>
import { onMounted, ref } from "vue";
import api from "@/api";
import { ElMessage } from "element-plus";
const loading = ref(false),
  generating = ref(false),
  pages = ref([]),
  candidates = ref([]),
  overview = ref({}),
  publishing = ref(null),
  pageId = ref(null);
async function load() {
  loading.value = true;
  try {
    const [o, p, c] = await Promise.all([
      api.get("/user/seo/overview"),
      api.get("/user/seo/pages"),
      api.get("/user/seo/candidates"),
    ]);
    overview.value = o.data || {};
    pages.value = p.data || [];
    candidates.value = c.data || [];
    if (!pageId.value && pages.value.length) pageId.value = pages.value[0].id;
  } finally {
    loading.value = false;
  }
}
async function generate() {
  generating.value = true;
  try {
    await api.post(
      "/user/seo/candidates/metadata",
      { page_id: pageId.value },
      { timeout: 90000 },
    );
    ElMessage.success("候选已生成，请核对事实后批准");
    await load();
  } finally {
    generating.value = false;
  }
}
async function review(item, status) {
  await api.put(`/user/seo/candidates/${item.id}/review`, { status });
  ElMessage.success(status === "approved" ? "候选已批准" : "候选已拒绝");
  await load();
}
async function simulatePublish(item) {
  publishing.value = item.id;
  try {
    await api.post(
      `/user/seo/candidates/${item.id}/publish-check`,
      {},
      { timeout: 60000 },
    );
    ElMessage.success("发布成功，原页面标题与描述复扫验证一致");
    await load();
  } finally {
    publishing.value = null;
  }
}
async function exportItem(item) {
  const r = await api.post(`/user/seo/candidates/${item.id}/export`),
    v = r.data || {};
  const csv = [
      "URL,Title,Description",
      [v.url, v.title, v.description].map(csvCell).join(","),
    ].join("\n"),
    blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
    link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `seo-metadata-${item.id}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  ElMessage.success("候选已导出并记录审计");
  await load();
}
const csvCell = (v) => `"${String(v || "").replace(/"/g, '""')}"`,
  statusName = (v) =>
    ({
      draft: "待审核",
      approved: "已批准",
      rejected: "已拒绝",
      exported: "已导出",
      publishing: "发布中",
      published: "已发布并验证",
      publish_failed: "发布失败",
    })[v] || v,
  statusType = (v) =>
    ({
      draft: "warning",
      approved: "success",
      rejected: "info",
      exported: "success",
      publishing: "warning",
      published: "success",
      publish_failed: "danger",
    })[v] || "info",
  formatTime = (v) => (v ? new Date(v).toLocaleString("zh-CN") : "-");
onMounted(load);
</script>
<style scoped>
.metadata-page {
  max-width: 1180px;
  margin: auto;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
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
.quota {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid #e4e8ee;
  border-radius: 7px;
  padding: 12px 15px;
  margin-bottom: 12px;
  font-size: 12px;
}
.quota a {
  margin-left: auto;
  color: #1677ff;
  text-decoration: none;
}
.generator {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: 12px;
  background: #fff;
  border: 1px solid #e4e8ee;
  border-radius: 7px;
  padding: 16px;
}
.generator label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 7px;
}
.candidate-list {
  display: grid;
  gap: 12px;
  margin-top: 12px;
  min-height: 120px;
}
.candidate-list article {
  background: #fff;
  border: 1px solid #e4e8ee;
  border-radius: 7px;
  padding: 16px;
}
.candidate-head,
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.candidate-head strong,
.candidate-head a {
  display: block;
}
.candidate-head a {
  font-size: 11px;
  color: #667085;
  margin-top: 3px;
  max-width: 760px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 14px 0;
}
.compare > div {
  background: #f7f8fa;
  padding: 13px;
  border-radius: 5px;
}
.compare .proposed {
  background: #eef8f5;
}
.compare small {
  color: #667085;
  font-size: 10px;
}
.compare p {
  font-size: 12px;
  margin: 4px 0 10px;
  line-height: 1.55;
}
.reason {
  font-size: 11px;
  color: #475467;
  background: #f0f6ff;
  padding: 9px;
  border-radius: 5px;
}
.actions {
  margin-top: 12px;
  justify-content: flex-end;
}
.actions span {
  margin-right: auto;
  color: #98a2b3;
  font-size: 10px;
}
@media (max-width: 700px) {
  .head p {
    display: none;
  }
  .generator,
  .compare {
    grid-template-columns: 1fr;
  }
  .candidate-head {
    align-items: flex-start;
  }
  .candidate-head a {
    max-width: 250px;
  }
  .actions {
    flex-wrap: wrap;
  }
}
</style>
