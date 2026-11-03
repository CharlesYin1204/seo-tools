<template>
  <div class="user-shell" :class="{ collapsed }">
    <div v-if="open" class="overlay" @click="open = false" />
    <aside :class="{ open }">
      <router-link to="/" class="brand"
        ><i class="fas fa-chart-line" /><span>SEO工具</span></router-link
      ><button class="fold" @click="collapsed = !collapsed">
        <i
          :class="
            collapsed ? 'fas fa-angle-double-right' : 'fas fa-angle-double-left'
          "
        />
      </button>
      <nav>
        <router-link
          v-for="item in singles"
          :key="item.to"
          :to="item.to"
          @click="close"
          ><i :class="item.icon" /><span>{{ item.label }}</span></router-link
        ><template v-for="g in groups" :key="g.key"
          ><button
            class="group"
            :class="{ active: isActive(g), expanded: state[g.key] }"
            @click="state[g.key] = !state[g.key]"
          >
            <span><i :class="g.icon" /><em>{{ g.label }}</em></span
            ><i class="fas fa-chevron-right arrow" />
          </button>
          <div v-show="state[g.key]" class="children">
            <router-link
              v-for="item in g.items"
              :key="item.to"
              :to="item.to"
              @click="close"
              ><i :class="item.icon" />{{ item.label }}</router-link
            >
          </div></template
        >
      </nav>
    </aside>
    <main>
      <header>
        <button @click="open = !open"><i class="fas fa-bars" /></button>
        <h1>SEO AI 工作台</h1>
        <div class="user-header-meta">
          <router-link v-if="auth.isAdmin" to="/admin/dashboard"
            >管理后台</router-link
          ><router-link class="header-metric header-entitlement" :to="{ path: '/user/membership', query: { section: 'plans' } }" title="查看套餐权益"><span class="header-metric-icon"><i class="fas fa-crown" /></span><span class="header-metric-copy"><small>会员权益</small><strong>{{ membershipName }}</strong></span></router-link><router-link class="header-metric header-ai" :to="{ path: '/user/membership', query: { section: 'ai' } }" title="查看 AI 算力用量"><span class="header-metric-icon"><i class="fas fa-bolt" /></span><span class="header-metric-copy"><small>AI 算力</small><strong>{{ aiRemaining }}</strong></span></router-link><div class="header-account"><img v-if="auth.user?.avatar" :src="auth.user.avatar" class="header-avatar" alt="用户头像" /><span v-else class="header-avatar header-avatar-fallback">{{ (auth.displayName || '用').slice(0,1) }}</span><span>{{ auth.displayName || "用户" }}</span
          ><button title="退出登录" @click="auth.logout()">
            <i class="fas fa-sign-out-alt" />
          </button></div>
        </div>
      </header>
      <section class="user-content"><router-view /></section>
    </main>
  </div>
</template>
<script setup>
import { ref, reactive, computed, watch, onMounted } from "vue";
import api from "@/api";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/store/auth";
const auth = useAuthStore(),
  route = useRoute(),
  open = ref(false),
  collapsed = ref(localStorage.getItem("seo-ai:user-nav-collapsed") === "1");
const singles = [
    { to: "/user/dashboard", label: "工作台", icon: "fas fa-gauge" },
  ],
  groups = [
    {
      key: "seo",
      label: "网站优化",
      icon: "fas fa-globe",
      items: [
        ["/user/seo-sites", "我的网站", "fas fa-globe"],
        ["/user/seo/copilot", "AI 优化助手", "fas fa-wand-magic-sparkles"],
        ["/user/seo/content", "内容优化", "fas fa-file-lines"],
        ["/user/seo/internal-links", "内链建议", "fas fa-link"],
        ["/user/seo/schema", "结构化数据", "fas fa-code"],
      ],
    },
    {
      key: "execution",
      label: "优化记录",
      icon: "fas fa-code-branch",
      items: [
        ["/user/seo/changes", "修改记录", "fas fa-list-check"],
        ["/user/seo/publishing", "发布与检查", "fas fa-cloud-arrow-up"],
        ["/user/seo/reports", "报告与趋势", "fas fa-chart-line"],
        ["/user/seo/tasks", "任务提醒", "fas fa-bell"],
      ],
    },
    {
      key: "visibility",
      label: "AI 搜索表现",
      icon: "fas fa-robot",
      items: [["/user/seo/geo", "GEO 可发现性", "fas fa-robot"]],
    },
    {
      key: "workspace",
      label: "账户与服务",
      icon: "fas fa-users",
      items: [
        ["/user/seo/team", "团队协作", "fas fa-users"],
        ["/user/plugin-center", "功能工具", "fas fa-puzzle-piece"],
        ["/user/membership", "我的权益", "fas fa-gem"],
        ["/user/orders", "我的订阅", "fas fa-receipt"],
        ["/user/settings", "个人设置", "fas fa-gear"],
      ],
    },
  ].map((g) => ({
    ...g,
    items: g.items.map(([to, label, icon]) => ({ to, label, icon })),
  }));
let savedState = {};
try {
  savedState = JSON.parse(localStorage.getItem("seo-ai:user-nav-groups") || "{}");
} catch {
  savedState = {};
}
const state = reactive(
    Object.fromEntries(groups.map((g) => [g.key, Boolean(savedState[g.key])])),
  ),
  isActive = (g) => g.items.some((i) => route.path.startsWith(i.to)),
  close = () => {
    if (innerWidth < 768) open.value = false;
  };
watch(
  () => route.path,
  () =>
    groups.forEach((g) => {
      if (isActive(g)) state[g.key] = true;
    }),
  { immediate: true },
);
const overview = ref({});
const membershipName = computed(() => overview.value.organization?.plan_name || 'Free 免费版');
const aiRemaining = computed(() => Math.max(0, Number(overview.value.quota?.ai_points || 20) - Number(overview.value.usage?.ai_points || 0)).toLocaleString());
onMounted(async () => { try { overview.value = (await api.get('/user/seo/overview')).data || {}; } catch {} });
watch(collapsed, (value) =>
  localStorage.setItem("seo-ai:user-nav-collapsed", value ? "1" : "0"),
);
watch(
  state,
  (value) =>
    localStorage.setItem("seo-ai:user-nav-groups", JSON.stringify(value)),
  { deep: true },
);
</script>
<style scoped>
.user-shell {
  min-height: 100vh;
  background: #f4f6f8;
}
.user-shell aside {
  position: fixed;
  inset: 0 auto 0 0;
  width: 220px;
  background: #14213d;
  color: #fff;
  z-index: 1000;
  overflow: auto;
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
  border-bottom: 1px solid #ffffff18;
}
.brand i {
  color: #24b896;
}
nav {
  padding: 10px;
}
nav a,
.group {
  display: flex;
  gap: 11px;
  align-items: center;
  width: 100%;
  color: #cbd5e1;
  text-decoration: none;
  padding: 10px 12px;
  border: 0;
  background: none;
  border-radius: 5px;
  font-size: 13px;
  text-align: left;
}
.group {
  justify-content: space-between;
  margin-top: 4px;
}
.group span {
  display: flex;
  gap: 11px;
  align-items: center;
}
.group.active,
.group:hover,
nav a:hover,
nav a.router-link-active,
.children a.router-link-active {
  background: #ffffff16;
  color: #fff;
}
.arrow {
  font-size: 10px;
  transition: 0.2s;
}
.group.expanded .arrow {
  transform: rotate(90deg);
}
.children {
  padding-left: 12px;
}
.children a {
  font-size: 12px;
  padding: 8px 12px;
}
.children i,
nav i {
  width: 16px;
  text-align: center;
}
.fold {
  display: flex;
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
.user-shell main {
  margin-left: 220px;
  transition: 0.2s;
}
.collapsed aside {
  width: 68px;
}
.collapsed main {
  margin-left: 68px;
}
.collapsed .brand span,
.collapsed nav > a span,
.collapsed .group em,
.collapsed .group .arrow,
.collapsed .children {
  display: none;
}
.collapsed .brand,
.collapsed nav > a,
.collapsed .group {
  justify-content: center;
}
header {
  height: 66px;
  background: #fff;
  border-bottom: 1px solid #e5e9ef;
  display: flex;
  align-items: center;
  padding: 0 22px;
  justify-content: space-between;
}
header > button {
  display: none;
}
header h1 {
  font-size: 17px;
  margin: 0;
}
header div {
  display: flex;
  gap: 14px;
  align-items: center;
  font-size: 13px;
}
header a {
  color: #246bfd;
  text-decoration: none;
}
header div button {
  border: 0;
  background: none;
}
.user-header-meta { gap: 0; height: 100%; }
.header-metric { display: flex; align-items: center; gap: 8px; min-width: 138px; height: 42px; padding: 0 13px; border-left: 1px solid #e5e9ef; color: inherit; }
.header-metric-icon { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; flex: 0 0 34px; border-radius: 6px; font-size: 15px; }
.header-entitlement .header-metric-icon { color: #c17b00; background: #fff2d2; }
.header-ai .header-metric-icon { color: #07866f; background: #e5f7f2; }
.header-metric-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; line-height: 1.15; white-space: nowrap; }
.header-metric-copy small { color: #98a2b3; font-size: 11px; font-weight: 400; }
.header-metric-copy strong { color: #25324b; font-size: 14px; font-weight: 700; }
.header-metric:hover, .header-metric:focus-visible { background: #f8fafc; outline: none; }
.header-account { height: 42px; padding-left: 13px; border-left: 1px solid #e5e9ef; }
.header-avatar { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; }
.header-avatar-fallback { display: inline-flex; align-items: center; justify-content: center; background: #dbeafe; color: #1d4ed8; font-weight: 700; }
main > section {
  padding: 22px;
}
.user-content :deep(> *) {
  width: 100%;
  max-width: none !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}
.overlay {
  display: none;
}
@media (max-width: 767px) {
  .fold {
    display: none;
  }
  .user-shell aside,
  .collapsed aside {
    width: 220px;
    transform: translateX(-100%);
    transition: 0.2s;
  }
  .user-shell aside.open,
  .collapsed aside.open {
    transform: none;
  }
  .user-shell main,
  .collapsed main {
    margin-left: 0;
  }
  header > button {
    display: block;
    border: 0;
    background: none;
  }
  main > section {
    padding: 14px;
  }
  .overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: #0007;
    z-index: 999;
  }
  .user-header-meta > a,
  .header-account > span:not(.header-avatar) {
    display: none;
  }
  .header-account { padding-left: 10px; border-left: 0; }
}
</style>
