<template>
  <div class="admin-shell" :class="{ collapsed }">
    <div v-if="open" class="overlay" @click="open = false" />
    <aside :class="{ open }">
      <router-link class="brand" to="/admin/dashboard"
        ><i class="fas fa-chart-line" /><span>SEO工具</span></router-link
      >
      <button class="fold d-none d-md-flex" @click="collapsed = !collapsed">
        <i
          :class="
            collapsed ? 'fas fa-angle-double-right' : 'fas fa-angle-double-left'
          "
        />
      </button>
      <nav>
        <router-link to="/admin/dashboard" active-class="active"
          ><i class="fas fa-gauge" /><span>运营仪表盘</span></router-link
        >
        <template v-for="g in groups" :key="g.key">
          <button
            class="group"
            :class="{ active: isActive(g), expanded: state[g.key] }"
            @click="state[g.key] = !state[g.key]"
          >
            <span
              ><i :class="g.icon" /><b>{{ g.label }}</b></span
            ><i class="fas fa-chevron-right arrow" />
          </button>
          <div class="children" :class="{ expanded: state[g.key] }">
            <router-link
              v-for="i in g.items"
              :key="i.path"
              :to="i.path"
              active-class="active"
              @click="close"
              ><i :class="i.icon" /><span>{{ i.label }}</span></router-link
            >
          </div>
        </template>
        <a href="#" @click.prevent="auth.logout()"
          ><i class="fas fa-sign-out-alt" /><span>退出登录</span></a
        >
      </nav>
    </aside>
    <main>
      <header>
        <button class="hamburger d-md-none" @click="open = !open">
          <i class="fas fa-bars" />
        </button>
        <div>
          <h1>{{ title }}</h1>
          <p>SEO AI 商业化运营平台</p>
        </div>
        <div class="account">
          <i class="fas fa-bell" /><img
            v-if="avatar"
            :src="avatar"
            alt="头像"
          /><i v-else class="fas fa-user-circle account-avatar" /><span>{{
            auth.displayName || "管理员"
          }}</span>
        </div>
      </header>
      <section class="content"><router-view /></section>
    </main>
  </div>
</template>
<script setup>
import { ref, reactive, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/store/auth";
const route = useRoute(),
  auth = useAuthStore(),
  open = ref(false),
  collapsed = ref(localStorage.getItem("seo-ai:admin-nav-collapsed") === "1");
const groups = [
  {
    key: "sites",
    label: "网站与检测",
    icon: "fas fa-globe",
    items: [
      ["sites", "站点管理", "fa-layer-group"],
      ["scans", "扫描任务", "fa-chart-area"],
      ["issues", "问题中心", "fa-exclamation-triangle"],
      ["pages", "页面分析", "fa-file-alt"],
      ["reports", "报告与趋势", "fa-chart-area"],
      ["authority", "外链权威配置", "fa-link"],
    ],
  },
  {
    key: "ai",
    label: "AI SEO 工作台",
    icon: "fas fa-magic",
    items: [
      ["copilot", "AI SEO Copilot", "fa-comments"],
      ["metadata", "元数据与摘要", "fa-pencil-alt"],
      ["content", "内容质量与简报", "fa-newspaper"],
      ["internal-links", "智能内链助手", "fa-link"],
      ["schema", "Schema 实体图谱", "fa-project-diagram"],
    ],
  },
  {
    key: "execution",
    label: "执行与发布",
    icon: "fas fa-code-branch",
    items: [
      ["changes", "变更审核", "fa-list"],
      ["publishing", "发布与复扫", "fa-rocket"],
      ["connectors", "CMS 与搜索平台", "fa-plug"],
      ["tasks", "任务与告警", "fa-bell"],
    ],
  },
  {
    key: "geo",
    label: "GEO / AEO",
    icon: "fas fa-compass",
    items: [
      ["geo", "AI 可发现性中心", "fa-search"],
      ["brand-radar", "AI 品牌雷达", "fa-satellite-dish"],
      ["knowledge", "品牌知识库", "fa-book-open"],
    ],
  },
  {
    key: "commercial",
    label: "套餐与用量",
    icon: "fas fa-chart-pie",
    items: [
      ["plans", "套餐与权益", "fa-gem"],
      ["usage", "用量与成本", "fa-tachometer-alt"],
    ],
  },
  {
    key: "platform",
    label: "平台与安全",
    icon: "fas fa-shield-halved",
    items: [
      ["team", "成员与权限", "fa-user-shield"],
      ["audit-logs", "审计日志", "fa-clipboard-list"],
    ],
  },
].map((g) => ({
  ...g,
  items: g.items.map(([slug, label, icon]) => ({
    path: "/admin/seo/" + slug,
    label,
    icon: "fas " + icon,
  })),
}));
groups.push(
  {
    key: "customers",
    label: "用户与交易",
    icon: "fas fa-building",
    items: [
      { path: "/admin/users", label: "用户与团队", icon: "fas fa-users" },
      { path: "/admin/orders", label: "订单与订阅", icon: "fas fa-receipt" },
      {
        path: "/admin/payment-config",
        label: "支付配置",
        icon: "fas fa-credit-card",
      },
    ],
  },
  {
    key: "ecosystem",
    label: "内容与能力",
    icon: "fas fa-puzzle-piece",
    items: [
      {
        path: "/admin/plugins",
        label: "功能插件",
        icon: "fas fa-puzzle-piece",
      },
      { path: "/admin/ai-models", label: "AI 模型管理", icon: "fas fa-brain" },
      { path: "/admin/articles", label: "文章内容", icon: "fas fa-file-pen" },
      {
        path: "/admin/notifications",
        label: "通知管理",
        icon: "fas fa-envelope",
      },
    ],
  },
  {
    key: "configuration",
    label: "系统设置",
    icon: "fas fa-sliders",
    items: [
      { path: "/admin/auth-config", label: "登录注册配置", icon: "fas fa-key" },
      {
        path: "/admin/storage-config",
        label: "存储与备份",
        icon: "fas fa-cloud-upload-alt",
      },
      {
        path: "/admin/website-settings",
        label: "网站设置",
        icon: "fas fa-gear",
      },
    ],
  },
);
let savedState = {};
try {
  savedState = JSON.parse(
    localStorage.getItem("seo-ai:admin-nav-groups") || "{}",
  );
} catch {
  savedState = {};
}
const state = reactive(
  Object.fromEntries(groups.map((g) => [g.key, Boolean(savedState[g.key])])),
);
const isActive = (g) => g.items.some((i) => route.path.startsWith(i.path)),
  close = () => {
    if (innerWidth < 768) open.value = false;
  };
const title = computed(
  () =>
    [
      ...groups.flatMap((g) => g.items),
      { path: "/admin/dashboard", label: "运营仪表盘" },
    ].find((i) => i.path === route.path)?.label || "SEO工具",
);
const avatar = computed(() => auth.user?.avatar || "");
watch(
  () => route.path,
  () => {
    groups.forEach((g) => {
      if (isActive(g)) state[g.key] = true;
    });
    close();
  },
  { immediate: true },
);
watch(collapsed, (value) =>
  localStorage.setItem("seo-ai:admin-nav-collapsed", value ? "1" : "0"),
);
watch(
  state,
  (value) =>
    localStorage.setItem("seo-ai:admin-nav-groups", JSON.stringify(value)),
  { deep: true },
);
</script>
<style scoped>
.account-avatar {
  font-size: 30px;
  color: #718096;
}
.admin-shell {
  min-height: 100vh;
  background: #f4f6f8;
  color: #17202a;
}
.admin-shell aside {
  position: fixed;
  inset: 0 auto 0 0;
  width: 232px;
  background: #14213d;
  color: #fff;
  z-index: 1000;
  overflow: auto;
  transition: 0.2s;
}
.brand {
  height: 66px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  font-size: 17px;
  border-bottom: 1px solid #ffffff18;
}
.brand i {
  color: #25c2a0;
}
.fold {
  margin: 8px 12px 2px auto;
  border: 0;
  background: #ffffff12;
  color: #fff;
  width: 30px;
  height: 28px;
  border-radius: 4px;
  align-items: center;
  justify-content: center;
}
nav {
  padding: 4px 10px 22px;
}
nav > a,
.group,
.children a {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 11px;
  border: 0;
  background: none;
  color: #cbd5e1;
  text-decoration: none;
  padding: 10px 12px;
  border-radius: 5px;
  font-size: 13px;
  text-align: left;
  margin: 2px 0;
}
.group {
  justify-content: space-between;
}
.group span {
  display: flex;
  gap: 11px;
  align-items: center;
}
.group b {
  font-weight: 500;
}
.group:hover,
.group.active,
nav > a:hover,
nav > a.active,
.children a:hover,
.children a.active {
  background: #ffffff16;
  color: #fff;
}
.arrow {
  font-size: 10px;
  transition: 0.2s;
}
.expanded .arrow {
  transform: rotate(90deg);
}
.children {
  display: none;
  padding-left: 12px;
}
.children.expanded {
  display: block;
}
.children a {
  padding: 8px 10px;
  font-size: 12px;
}
.children i,
nav > a > i,
.group span > i {
  width: 16px;
  text-align: center;
}
.admin-shell main {
  margin-left: 232px;
  flex: 1;
  width: auto;
  min-width: 0;
  min-height: 100vh;
  transition: 0.2s;
}
header {
  height: 66px;
  background: #fff;
  border-bottom: 1px solid #e5e9ef;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 100;
}
header h1 {
  font-size: 17px;
  margin: 0;
}
header p {
  font-size: 11px;
  color: #87909d;
  margin: 3px 0 0;
}
.account {
  display: flex;
  align-items: center;
  gap: 11px;
  font-size: 13px;
}
.account img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}
.content {
  padding: 22px;
}
.content :deep(> *) {
  width: 100%;
  max-width: none !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}
.collapsed aside {
  width: 68px;
}
.collapsed main {
  margin-left: 68px;
  width: auto;
}
.collapsed .brand span,
.collapsed nav > a span,
.collapsed .group b,
.collapsed .arrow,
.collapsed .children {
  display: none;
}
.collapsed .brand,
.collapsed nav > a,
.collapsed .group {
  justify-content: center;
}
.hamburger {
  border: 0;
  background: none;
  font-size: 20px;
}
.overlay {
  display: none;
}
@media (max-width: 767px) {
  .admin-shell aside,
  .collapsed aside {
    width: 232px;
    transform: translateX(-100%);
  }
  .admin-shell aside.open,
  .collapsed aside.open {
    transform: none;
  }
  .admin-shell main,
  .collapsed main {
    margin-left: 0;
    width: 100%;
  }
  .content {
    padding: 14px;
  }
  header {
    padding: 0 14px;
  }
  header > div:first-of-type {
    flex: 1;
    margin-left: 10px;
  }
  .account span {
    display: none;
  }
  .overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: #0007;
    z-index: 999;
  }
}
</style>
