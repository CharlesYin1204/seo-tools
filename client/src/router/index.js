/**
 * Vue Router路由配置
 * 与PHP版路由结构保持一致
 */
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/legal/:type', name: 'Legal', component: () => import('@/views/frontend/Legal.vue') },
  // ============ 前台页面 ============
  {
    path: '/',
    component: () => import('@/views/frontend/Layout.vue'),
    children: [
      { path: '', name: 'Home', component: () => import('@/views/frontend/Home.vue') },
      { path: 'properties', name: 'Properties', component: () => import('@/views/frontend/Properties.vue') },
      { path: 'map-search', name: 'MapSearch', component: () => import('@/views/frontend/MapSearch.vue') },
      { path: 'about', name: 'About', component: () => import('@/views/frontend/About.vue') },
      { path: 'contact', name: 'Contact', component: () => import('@/views/frontend/Contact.vue') },
      { path: 'services', name: 'Services', component: () => import('@/views/frontend/Services.vue') },
      { path: 'blog', name: 'Blog', component: () => import('@/views/frontend/Blog.vue') },
      { path: 'blog/:slug', name: 'BlogDetail', component: () => import('@/views/frontend/BlogDetail.vue') },
      { path: 'articles', name: 'Articles', component: () => import('@/views/frontend/Blog.vue') },
      { path: 'articles/:slug', name: 'ArticleDetail', component: () => import('@/views/frontend/BlogDetail.vue') },
      { path: 'agents', name: 'Agents', component: () => import('@/views/frontend/Agents.vue') },
      { path: 'agents/:id', name: 'AgentProfile', component: () => import('@/views/frontend/AgentProfile.vue') },
      { path: 'share/expat-property/:token', name: 'ShareProperty', component: () => import('@/views/frontend/ShareProperty.vue') },
      { path: 'share/parsed-property/:token', name: 'ShareParsedProperty', component: () => import('@/views/frontend/ShareProperty.vue') },
      { path: 'property/share/:code', name: 'SharePropertyByCode', component: () => import('@/views/frontend/ShareProperty.vue') },
      { path: 'property/:username/share/:code', name: 'SharePropertyByUserAndCode', component: () => import('@/views/frontend/ShareProperty.vue') },
      { path: 'property/:username', name: 'UserProperties', component: () => import('@/views/frontend/UserProperties.vue') },
      { path: 'wechat-robot', name: 'WeChatRobotHome', component: () => import('@/views/frontend/WeChatRobotHome.vue') },
      { path: 'wechat-matrix', name: 'WeChatMatrixHome', component: () => import('@/views/frontend/WeChatMatrixHome.vue') },
      { path: 'ai-property-search', name: 'AIPropertySearch', component: () => import('@/views/frontend/AIPropertySearch.vue') },
      { path: 'ai-rental-assistant', name: 'AIRentalAssistant', component: () => import('@/views/frontend/AIRentalAssistant.vue') },
      { path: 'payment/success', name: 'PaymentSuccess', component: () => import('@/views/frontend/PaymentSuccess.vue') },
      { path: 'payment/process', name: 'PaymentProcess', component: () => import('@/views/frontend/PaymentProcess.vue') },
    ],
  },

  // ============ 内容详情页（独立页面，无Layout导航） ============
  { path: '/properties/:id', name: 'PropertyDetail', component: () => import('@/views/frontend/PropertyDetail.vue') },
  { path: '/property/:username/:id(\\d+)', name: 'UserPropertyDetail', component: () => import('@/views/frontend/PropertyDetail.vue') },

  // ============ 独立开放API后台（不挂载到现有后台菜单） ============
  {
    path: '/open-api-admin',
    name: 'OpenApiAdmin',
    component: () => import('@/views/openapi/OpenApiAdmin.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },

  // ============ 认证页面 ============
  {
    path: '/auth',
    component: () => import('@/views/auth/Layout.vue'),
    children: [
      { path: 'login', name: 'Login', component: () => import('@/views/auth/Login.vue') },
      {
        path: 'register',
        name: 'Register',
        component: () => import('@/views/auth/Register.vue'),
        async beforeEnter(to, from, next) {
          const { useAuthStore } = await import('@/store/auth')
          const auth = useAuthStore()
          await auth.fetchPublicSettings()
          if (!auth.allowRegister) {
            next({ name: 'Login', query: { ...to.query, reason: 'register_closed' }, replace: true })
          } else {
            next()
          }
        },
      },
      { path: 'forgot-password', name: 'ForgotPassword', component: () => import('@/views/auth/ForgotPassword.vue') },
    ],
  },


  // ============ C端用户中心（兼容旧版路由） ============
  {
    path: '/tenant',
    component: () => import('@/views/tenant/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/tenant/dashboard' },
      { path: 'dashboard', name: 'TenantDashboard', component: () => import('@/views/tenant/Dashboard.vue') },
      { path: 'profile', name: 'TenantProfile', component: () => import('@/views/tenant/Profile.vue') },
      { path: 'demands', name: 'TenantDemands', component: () => import('@/views/tenant/Demands.vue') },
      { path: 'favorites', name: 'TenantFavorites', component: () => import('@/views/tenant/Favorites.vue') },
      { path: 'messages', name: 'TenantMessages', component: () => import('@/views/tenant/Messages.vue') },
      { path: 'appointments', name: 'TenantAppointments', component: () => import('@/views/tenant/Appointments.vue') },
      { path: 'applications', name: 'TenantApplications', component: () => import('@/views/tenant/Applications.vue') },
      { path: 'contracts', name: 'TenantContracts', component: () => import('@/views/tenant/Contracts.vue') },
      { path: 'bills', name: 'TenantBills', component: () => import('@/views/tenant/Bills.vue') },
      { path: 'documents', name: 'TenantDocuments', component: () => import('@/views/tenant/Documents.vue') },
      { path: 'service-tickets', name: 'TenantServiceTickets', component: () => import('@/views/tenant/ServiceTickets.vue') },
    ],
  },

  // ============ 用户中心 ============
  {
    path: '/user',
    component: () => import('@/views/user/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
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

      // 站点内容管理（兼容旧版数据接口）
      { path: 'properties', name: 'UserPropertyList', component: () => import('@/views/user/Properties.vue') },
      { path: 'upload-property', name: 'UserUploadProperty', component: () => import('@/views/user/UploadProperty.vue') },
      { path: 'edit-property/:id', name: 'UserEditProperty', component: () => import('@/views/user/UploadProperty.vue'), props: true },

      // 内容同步与发送记录
      { path: 'property-sync', name: 'UserPropertySync', component: () => import('@/views/user/PropertySync.vue') },
      { path: 'share-history', name: 'UserShareHistory', component: () => import('@/views/user/ShareHistory.vue') },

      // 媒体库
      { path: 'media', name: 'UserMedia', component: () => import('@/views/user/Media.vue') },

      // 会员中心
      { path: 'membership', name: 'UserMembership', component: () => import('@/views/user/Membership.vue') },

      // 预约管理
      { path: 'appointments', name: 'UserAppointments', component: () => import('@/views/user/Appointments.vue') },

      // 用户需求
      { path: 'demands', name: 'UserDemands', component: () => import('@/views/user/Demands.vue') },

      // 推荐返利
      { path: 'referral', name: 'UserReferral', component: () => import('@/views/user/Referral.vue') },

      // 订单
      { path: 'orders', name: 'UserOrders', component: () => import('@/views/user/Orders.vue') },
      { path: 'balance', name: 'UserBalance', component: () => import('@/views/user/Balance.vue') },
      { path: 'points', name: 'UserPoints', component: () => import('@/views/user/Points.vue') },
      { path: 'notifications', name: 'UserNotifications', component: () => import('@/views/user/Notifications.vue') },
      { path: 'favorites', name: 'UserFavorites', component: () => import('@/views/user/Favorites.vue') },
      { path: 'followed-agents', name: 'UserFollowedAgents', component: () => import('@/views/user/FollowedAgents.vue') },
      { path: 'service-market', name: 'UserServiceMarket', component: () => import('@/views/user/ServiceMarket.vue') },

      // AI功能
      { path: 'ai-property-search', name: 'UserAIPropertySearch', component: () => import('@/views/user/AIPropertySearch.vue') },
      { path: 'ai-rental-assistant', name: 'UserAIRentalAssistant', component: () => import('@/views/user/AIRentalAssistant.vue') },

      // 微信公众号
      { path: 'wechat/accounts', name: 'WeChatOfficialAccounts', component: () => import('@/views/user/wechat/Accounts.vue') },
      { path: 'wechat/articles', name: 'WeChatUserArticles', component: () => import('@/views/user/wechat/Articles.vue') },
      { path: 'wechat/plugin-market', name: 'WeChatPluginMarket', component: () => import('@/views/user/wechat/PluginMarket.vue') },

      // 微信机器人
      { path: 'wechat-robot', name: 'WeChatRobot', component: () => import('@/views/user/wechat-robot/Index.vue') },
      { path: 'wechat-robot/api-config', name: 'WeChatApiConfig', component: () => import('@/views/user/wechat-robot/ApiConfig.vue') },
      { path: 'wechat-robot/contacts', name: 'WeChatContacts', component: () => import('@/views/user/wechat-robot/Contacts.vue') },
      { path: 'wechat-robot/messages', name: 'WeChatMessages', component: () => import('@/views/user/wechat-robot/Messages.vue') },
      { path: 'wechat-robot/groups', name: 'WeChatGroups', component: () => import('@/views/user/wechat-robot/Groups.vue') },
      { path: 'wechat-robot/moments', name: 'WeChatMoments', component: () => import('@/views/user/wechat-robot/Moments.vue') },
      { path: 'wechat-robot/auto-replies', name: 'WeChatAutoReplies', component: () => import('@/views/user/wechat-robot/AutoReplies.vue') },
      { path: 'wechat-robot/ai-config', name: 'WeChatAiConfig', component: () => import('@/views/user/wechat-robot/AiConfig.vue') },
      { path: 'wechat-robot/materials', name: 'WeChatMaterials', component: () => import('@/views/user/wechat-robot/Materials.vue') },
      { path: 'wechat-robot/scheduled-tasks', name: 'WeChatScheduledTasks', component: () => import('@/views/user/wechat-robot/ScheduledTasks.vue') },
      { path: 'wechat-robot/contact-tags', name: 'WeChatContactTags', component: () => import('@/views/user/wechat-robot/ContactTags.vue') },
      { path: 'wechat-robot/favorites', name: 'WeChatFavorites', component: () => import('@/views/user/wechat-robot/Favorites.vue') },
      { path: 'wechat-robot/finder', name: 'WeChatFinder', component: () => import('@/views/user/wechat-robot/Finder.vue') },

      // 朋友圈解析
      { path: 'wechat-robot/moments-parsed-list', name: 'MomentsParsedList', component: () => import('@/views/user/wechat-robot/MomentsParsedList.vue') },

      // 快速内容检索
      { path: 'quick-search', name: 'UserQuickSearch', component: () => import('@/views/user/QuickSearch.vue') },
      { path: 'quick-search/demands', name: 'UserQuickSearchDemands', component: () => import('@/views/user/QuickSearchDemands.vue') },
      { path: 'moments-refresh-settings', name: 'UserMomentsRefreshSettings', component: () => import('@/views/user/MomentsRefreshSettings.vue') },

      // 所有站点内容
      { path: 'all-properties', name: 'UserAllProperties', component: () => import('@/views/user/AllProperties.vue') },

      // 链接设置
      { path: 'link-settings', name: 'UserLinkSettings', component: () => import('@/views/user/LinkSettings.vue') },

      // 插件中心
      { path: 'plugin-center', name: 'UserPluginCenter', component: () => import('@/views/user/PluginCenter.vue') },
      { path: 'plugin-use/:slug', name: 'UserPluginUse', component: () => import('@/views/user/plugins/PluginUse.vue') },

      // 设置
      { path: 'settings', name: 'UserSettings', component: () => import('@/views/user/Settings.vue') },
    ],
  },

  // ============ 管理后台 ============
  {
    path: '/admin',
    component: () => import('@/views/admin/Layout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', name: 'AdminDashboard', component: () => import('@/views/admin/Dashboard.vue') },
      {
        path: 'seo/authority',
        name: 'AdminSeoAuthority',
        component: () => import('@/views/admin/SeoAuthority.vue'),
      },
      {
        path: 'seo/:module',
        name: 'AdminSeoModule',
        component: () => import('@/views/admin/SeoModule.vue'),
        props: true,
        beforeEnter(to) {
          const modules = {
            sites: ['站点管理', '管理多组织、多客户与多站点接入、所有权验证和 Sitemap 发现。', ['站点接入与验证', 'Sitemap 自动发现', '站点能力声明', '多租户数据隔离']],
            scans: ['扫描任务', '管理手动与定时扫描、抓取配额、失败重试和扫描历史。', ['扫描队列', '抓取配额', '定时扫描', '失败重试']],
            issues: ['问题中心', '以真实页面证据呈现技术、内容和权威问题，并按影响排序。', ['技术 SEO', '内容结构', '外链权威', '规则证据']],
            pages: ['页面分析', '查看 HTTP、Robots、Canonical、Schema、OG、ALT 与链接事实。', ['页面事实模型', '索引状态', '结构化数据', '链接分析']],
            reports: ['报告与趋势', '查看历史趋势、修改前后对比并导出白标报告。', ['历史趋势', '成果对比', 'CSV / PDF', '定时报告']],
            copilot: ['AI SEO Copilot', '基于审计证据解释问题并生成可执行的修复计划。', ['证据问答', '修复优先级', '风险与工作量', '上下文跳转']],
            metadata: ['元数据与摘要', '生成 Title、Meta、OG 与多语言候选，经过质量门槛后审核。', ['三组候选', '原文对比', '批量优化', '品牌规范']],
            content: ['内容质量与简报', '分析搜索意图、内容缺口、重复与过时信息。', ['内容质量', '搜索意图', '内容简报', '关键词蚕食']],
            'internal-links': ['智能内链助手', '推荐来源页、目标页和自然锚文本，确认后形成变更单。', ['孤立页面', '链接推荐', '锚文本检查', '变更单']],
            schema: ['Schema 实体图谱', '基于真实字段生成 Schema 候选并维护品牌实体关系。', ['Schema 候选', '缺失字段', '实体关系', 'JSON-LD 校验']],
            changes: ['变更与审核', '管理候选差异、风险评估、多级审核与版本冲突。', ['变更单', '风险评估', '多级审核', '版本冲突']],
            publishing: ['发布与复扫', '统一管理发布、失败重试、复扫验证和回滚记录。', ['真实发布', '复扫验证', '失败恢复', '回滚记录']],
            connectors: ['CMS 与搜索平台', '连接 WordPress、REST API、Webhook、GSC 与 IndexNow。', ['WordPress', '通用 REST API', 'Google Search Console', 'Bing / IndexNow']],
            tasks: ['任务与告警', '分派负责人、截止时间并跟踪严重问题与扫描异常。', ['任务分派', '严重告警', '邮件周报', '操作日志']],
            geo: ['AI 可发现性中心', '检查 llms.txt、AI 爬虫访问、可引用性与 AI Referral。', ['llms.txt', 'AI Bot 策略', '引用完整性', 'AI Referral']],
            'brand-radar': ['AI 品牌雷达', '追踪品牌提及、引用、情感、竞品和回答变化。', ['提示词监测', '品牌提及', '竞品对比', '可见性指数']],
            knowledge: ['品牌知识库', '维护品牌事实、产品信息、语气、禁用词和合规规则。', ['品牌事实', '内容规范', '禁用词', '合规规则']],
            plans: ['套餐与权益', '配置 Free、Pro、Team、Enterprise 套餐和服务端权益。', ['套餐版本', '功能权益', '试用策略', '预算上限']],
            usage: ['用量与成本', '核对抓取、AI、导出和插件用量流水与毛利。', ['AI 点数', '抓取页数', '成本台账', '异常告警']],
            team: ['成员与权限', '管理 Owner、Admin、SEO、Editor、Reviewer 与 Viewer。', ['组织成员', '角色权限', '客户空间', 'SSO / SCIM']],
            'audit-logs': ['审计日志', '追踪高风险操作、发布、计费、权限和插件行为。', ['操作审计', '发布追踪', '权限变更', '合规导出']],
          }
          const item = modules[to.params.module]
          if (!item) return '/admin/dashboard'
          to.meta.title = item[0]; to.meta.description = item[1]; to.meta.features = item[2]
        },
      },
      { path: 'users', name: 'AdminUsers', component: () => import('@/views/admin/Users.vue') },
      { path: 'ai-models', name: 'AIModels', component: () => import('@/views/admin/AIModels.vue') },
      { path: 'settings', name: 'AdminSettings', component: () => import('@/views/admin/Settings.vue') },
      { path: 'expatshome', name: 'AdminExpatHome', component: () => import('@/views/admin/ExpatHome.vue') },
      { path: 'wechat-robot/api-config', name: 'AdminWeChatApiConfig', component: () => import('@/views/admin/WeChatRobotApiConfig.vue') },
      { path: 'friend-links', name: 'AdminFriendLinks', component: () => import('@/views/admin/FriendLinks.vue') },
      { path: 'points-settings', name: 'AdminPointsSettings', component: () => import('@/views/admin/PointsSettings.vue') },
      { path: 'referral-settings', name: 'AdminReferralSettings', component: () => import('@/views/admin/ReferralSettings.vue') },
      { path: 'marketing-settings', name: 'AdminMarketingSettings', component: () => import('@/views/admin/MarketingSettings.vue') },
      { path: 'demands', name: 'AdminDemandManage', component: () => import('@/views/admin/DemandManage.vue') },
      { path: 'plugins', name: 'AdminPluginManagement', component: () => import('@/views/admin/PluginManagement.vue') },
      { path: 'property-scraper', name: 'AdminPropertyScraper', component: () => import('@/views/admin/PropertyScraper.vue') },

      // 文章管理
      { path: 'articles', name: 'AdminArticles', component: () => import('@/views/admin/Articles.vue') },

      // 会员管理
      { path: 'membership', name: 'AdminMembership', component: () => import('@/views/admin/Membership.vue') },

      // 会员中心设置（功能模块+卡密管理）
      { path: 'feature-modules', name: 'AdminFeatureModules', component: () => import('@/views/admin/FeatureModules.vue') },
      { path: 'card-keys', name: 'AdminCardKeys', component: () => import('@/views/admin/CardKeys.vue') },

      // 媒体管理
      { path: 'media', name: 'AdminMedia', component: () => import('@/views/admin/MediaManagement.vue') },

      // 存储配置
      { path: 'storage-config', name: 'AdminStorageConfig', component: () => import('@/views/admin/StorageConfig.vue') },

      // 支付配置
      { path: 'payment-config', name: 'AdminPaymentConfig', component: () => import('@/views/admin/PaymentConfig.vue') },

      // 认证配置
      { path: 'auth-config', name: 'AdminAuthConfig', component: () => import('@/views/admin/AuthConfig.vue') },

      // 内容资产库

      // 通知管理
      { path: 'notifications', name: 'AdminNotifications', component: () => import('@/views/admin/Notifications.vue') },

      // 首页设置
      { path: 'homepage-settings', name: 'AdminHomepageSettings', component: () => import('@/views/admin/HomepageSettings.vue') },

      // 网站设置
      { path: 'website-settings', name: 'AdminWebsiteSettings', component: () => import('@/views/admin/WebsiteSettings.vue') },

      // 菜单管理

      // 语言管理
      { path: 'languages', name: 'AdminLanguages', component: () => import('@/views/admin/Languages.vue') },

      // 主题管理
      { path: 'themes', name: 'AdminThemes', component: () => import('@/views/admin/Themes.vue') },

      // 订单管理
      { path: 'orders', name: 'AdminOrders', component: () => import('@/views/admin/Orders.vue') },

      { path: 'wechat-robot/accounts', name: 'AdminWeChatAccounts', component: () => import('@/views/user/wechat-robot/Index.vue') },
      { path: 'wechat-robot/contacts', name: 'AdminWeChatContacts', component: () => import('@/views/user/wechat-robot/Contacts.vue') },
      { path: 'wechat-robot/messages', name: 'AdminWeChatMessages', component: () => import('@/views/user/wechat-robot/Messages.vue') },
      { path: 'wechat-robot/groups', name: 'AdminWeChatGroups', component: () => import('@/views/user/wechat-robot/Groups.vue') },
      { path: 'wechat-robot/moments', name: 'AdminWeChatMoments', component: () => import('@/views/user/wechat-robot/Moments.vue') },
      { path: 'wechat-robot/auto-replies', name: 'AdminWeChatAutoReplies', component: () => import('@/views/user/wechat-robot/AutoReplies.vue') },
      { path: 'wechat-robot/ai-config', name: 'AdminWeChatAiConfig', component: () => import('@/views/user/wechat-robot/AiConfig.vue') },
      { path: 'wechat-robot/materials', name: 'AdminWeChatMaterials', component: () => import('@/views/user/wechat-robot/Materials.vue') },
      { path: 'wechat-robot/scheduled-tasks', name: 'AdminWeChatScheduledTasks', component: () => import('@/views/user/wechat-robot/ScheduledTasks.vue') },
      { path: 'wechat-robot/contact-tags', name: 'AdminWeChatContactTags', component: () => import('@/views/user/wechat-robot/ContactTags.vue') },
      { path: 'wechat-robot/favorites', name: 'AdminWeChatFavorites', component: () => import('@/views/user/wechat-robot/Favorites.vue') },
      { path: 'wechat-robot/finder', name: 'AdminWeChatFinder', component: () => import('@/views/user/wechat-robot/Finder.vue') },

      // 快速找房 - 管理员专用（从用户中心迁移）
      { path: 'quick-search', name: 'AdminQuickSearch', component: () => import('@/views/user/QuickSearch.vue') },
      { path: 'quick-search/demands', name: 'AdminQuickSearchDemands', component: () => import('@/views/user/QuickSearchDemands.vue') },
      { path: 'moments-refresh-settings', name: 'AdminMomentsRefreshSettings', component: () => import('@/views/user/MomentsRefreshSettings.vue') },
      { path: 'moments-parsed-list', name: 'AdminMomentsParsedList', component: () => import('@/views/user/wechat-robot/MomentsParsedList.vue') },
      { path: 'property-sync', name: 'AdminPropertySync', component: () => import('@/views/admin/ScheduledPropertySync.vue') },
      { path: 'share-history', name: 'AdminShareHistory', component: () => import('@/views/user/ShareHistory.vue') },
    ],
  },

  // ============ 经纪人后台 ============
  {
    path: '/agent',
    component: () => import('@/views/agent/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/agent/dashboard' },
      { path: 'dashboard', name: 'AgentDashboard', component: () => import('@/views/agent/Dashboard.vue') },
      { path: 'properties', name: 'AgentProperties', component: () => import('@/views/agent/Properties.vue') },
      { path: 'clients', name: 'AgentClients', component: () => import('@/views/agent/Clients.vue') },
      { path: 'appointments', name: 'AgentAppointments', component: () => import('@/views/agent/Appointments.vue') },
      { path: 'demand-hall', name: 'AgentDemandHall', component: () => import('@/views/agent/DemandHall.vue') },
      { path: 'plugins', name: 'AgentPlugins', component: () => import('@/views/agent/Plugins.vue') },
      { path: 'market', name: 'AgentMarket', component: () => import('@/views/agent/Market.vue') },
      { path: 'settings', name: 'AgentSettings', component: () => import('@/views/agent/Settings.vue') },
    ],
  },

  // ============ 房东后台 ============
  {
    path: '/landlord',
    component: () => import('@/views/landlord/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/landlord/dashboard' },
      { path: 'dashboard', name: 'LandlordDashboard', component: () => import('@/views/landlord/Dashboard.vue') },
      { path: 'properties', name: 'LandlordProperties', component: () => import('@/views/landlord/Properties.vue') },
      { path: 'whitelist', name: 'LandlordWhitelist', component: () => import('@/views/landlord/Whitelist.vue') },
    ],
  },

  // 404
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('@/views/frontend/NotFound.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const rawToken = localStorage.getItem('token')
  const token = rawToken && rawToken !== 'undefined' ? rawToken : ''

  let user = null
  try {
    const raw = localStorage.getItem('user')
    if (raw && raw !== 'undefined' && raw !== 'null') {
      user = JSON.parse(raw)
    }
  } catch {
    localStorage.removeItem('user')
  }

  if (to.meta.requiresAuth && !token) {
    return next({ path: '/auth/login', query: { redirect: to.fullPath } })
  }

  if (to.meta.requiresAdmin && (!user || user.role !== 'admin')) {
    return next({ path: user?.role === 'tenant' ? '/tenant/dashboard' : '/user/dashboard' })
  }

  next()
})

export default router
