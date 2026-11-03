import { createRouter, createWebHistory } from 'vue-router'

const seoAdminModules = {
  sites: ['站点管理', '管理站点接入、所有权验证和 Sitemap。'], scans: ['扫描任务', '管理扫描、失败重试和历史。'],
  issues: ['问题中心', '按影响查看技术和内容问题。'], pages: ['页面分析', '查看页面结构、索引和链接事实。'],
  reports: ['报告与趋势', '查看趋势和优化前后对比。'], authority: ['外链权威配置', '配置外链数据来源。'],
  copilot: ['AI SEO Copilot', '基于证据生成修复计划。'], metadata: ['元数据与摘要', '生成并审核元数据候选。'],
  content: ['内容质量与简报', '分析搜索意图和内容缺口。'], 'internal-links': ['智能内链助手', '生成可审核的内链建议。'],
  schema: ['Schema 实体图谱', '生成并校验结构化数据。'], changes: ['变更与审核', '管理候选差异和审核。'],
  publishing: ['发布与复扫', '管理发布、复扫和失败恢复。'], connectors: ['CMS 与搜索平台', '管理 CMS、GSC 与 IndexNow。'],
  tasks: ['任务与告警', '分派问题并跟踪进度。'], geo: ['AI 可发现性中心', '检查 AI 爬虫和可引用性。'],
  'brand-radar': ['AI 品牌雷达', '追踪品牌提及和竞品。'], knowledge: ['品牌知识库', '维护品牌事实和内容规范。'],
  plans: ['套餐与权益', '配置套餐和服务权益。'], usage: ['用量与成本', '核对抓取和 AI 用量。'],
  team: ['成员与权限', '管理团队角色和权限。'], 'audit-logs': ['审计日志', '追踪发布、计费和权限操作。'],
}

const routes = [
  { path: '/legal/:type', name: 'Legal', component: () => import('@/views/frontend/Legal.vue') },
  { path: '/', component: () => import('@/views/frontend/Layout.vue'), children: [
    { path: '', name: 'Home', component: () => import('@/views/frontend/Home.vue') },
    { path: 'blog', name: 'Blog', component: () => import('@/views/frontend/Blog.vue') },
    { path: 'blog/:slug', name: 'BlogDetail', component: () => import('@/views/frontend/BlogDetail.vue') },
  ] },
  { path: '/auth', component: () => import('@/views/auth/Layout.vue'), children: [
    { path: 'login', name: 'Login', component: () => import('@/views/auth/Login.vue') },
    { path: 'register', name: 'Register', component: () => import('@/views/auth/Register.vue') },
    { path: 'forgot-password', name: 'ForgotPassword', component: () => import('@/views/auth/ForgotPassword.vue') },
  ] },
  { path: '/user', component: () => import('@/views/user/Layout.vue'), meta: { requiresAuth: true }, children: [
    { path: '', redirect: '/user/dashboard' },
    { path: 'dashboard', name: 'UserDashboard', component: () => import('@/views/user/Dashboard.vue') },
    { path: 'seo-sites', name: 'UserSeoSites', component: () => import('@/views/user/SeoSites.vue') },
    { path: 'seo/tasks', name: 'UserSeoTasks', component: () => import('@/views/user/SeoTasks.vue') },
    { path: 'seo/reports', name: 'UserSeoReports', component: () => import('@/views/user/SeoReports.vue') },
    { path: 'seo/changes', name: 'UserSeoChanges', component: () => import('@/views/user/SeoChanges.vue') },
    { path: 'seo/team', name: 'UserSeoTeam', component: () => import('@/views/user/Team.vue') },
    { path: 'seo/metadata', name: 'UserSeoMetadata', component: () => import('@/views/user/MetadataWorkspace.vue') },
    { path: 'seo/publishing', name: 'UserSeoPublishing', component: () => import('@/views/user/PublishingWorkspace.vue') },
    { path: 'seo/:module', name: 'UserSeoFeature', component: () => import('@/views/user/SeoFeature.vue') },
    { path: 'plugin-center', name: 'UserPluginCenter', component: () => import('@/views/user/PluginCenter.vue') },
    { path: 'membership', name: 'UserMembership', component: () => import('@/views/user/Membership.vue') },
    { path: 'orders', name: 'UserOrders', component: () => import('@/views/user/Orders.vue') },
    { path: 'settings', name: 'UserSettings', component: () => import('@/views/user/Settings.vue') },
  ] },
  { path: '/admin', component: () => import('@/views/admin/Layout.vue'), meta: { requiresAuth: true, requiresAdmin: true }, children: [
    { path: '', redirect: '/admin/dashboard' },
    { path: 'dashboard', name: 'AdminDashboard', component: () => import('@/views/admin/Dashboard.vue') },
    { path: 'seo/authority', name: 'AdminSeoAuthority', component: () => import('@/views/admin/SeoAuthority.vue') },
    { path: 'seo/:module', name: 'AdminSeoModule', component: () => import('@/views/admin/SeoModule.vue'), props: true,
      beforeEnter(to) { const item = seoAdminModules[to.params.module]; if (!item) return '/admin/dashboard'; [to.meta.title, to.meta.description] = item } },
    { path: 'users', name: 'AdminUsers', component: () => import('@/views/admin/Users.vue') },
    { path: 'orders', name: 'AdminOrders', component: () => import('@/views/admin/Orders.vue') },
    { path: 'plugins', name: 'AdminPluginManagement', component: () => import('@/views/admin/PluginManagement.vue') },
    { path: 'ai-models', name: 'AIModels', component: () => import('@/views/admin/AIModels.vue') },
    { path: 'articles', name: 'AdminArticles', component: () => import('@/views/admin/Articles.vue') },
    { path: 'notifications', name: 'AdminNotifications', component: () => import('@/views/admin/Notifications.vue') },
    { path: 'payment-config', name: 'AdminPaymentConfig', component: () => import('@/views/admin/PaymentConfig.vue') },
    { path: 'auth-config', name: 'AdminAuthConfig', component: () => import('@/views/admin/AuthConfig.vue') },
    { path: 'storage-config', name: 'AdminStorageConfig', component: () => import('@/views/admin/StorageConfig.vue') },
    { path: 'website-settings', name: 'AdminWebsiteSettings', component: () => import('@/views/admin/WebsiteSettings.vue') },
  ] },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('@/views/frontend/NotFound.vue') },
]

const router = createRouter({ history: createWebHistory(), routes, scrollBehavior: () => ({ top: 0 }) })
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  let user = null
  try { user = JSON.parse(localStorage.getItem('user') || 'null') } catch { localStorage.removeItem('user') }
  if (to.meta.requiresAuth && !token) return next({ path: '/auth/login', query: { redirect: to.fullPath } })
  if (to.meta.requiresAdmin && user?.role !== 'admin') return next('/user/dashboard')
  next()
})
export default router
