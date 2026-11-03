<template>
  <div class="tenant-wrapper">
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>
    <button class="sidebar-toggle d-md-none" @click="sidebarOpen = !sidebarOpen">
      <i :class="sidebarOpen ? 'fas fa-times' : 'fas fa-bars'"></i>
    </button>

    <nav class="tenant-sidebar" :class="{ show: sidebarOpen }">
      <div class="sidebar-brand">
        <router-link to="/tenant/dashboard" class="brand-link">
          <i class="fas fa-key"></i>
          <span>租客中心</span>
        </router-link>
      </div>
      <ul class="sidebar-nav">
        <li v-for="item in navItems" :key="item.to">
          <router-link :to="item.to" class="nav-link" active-class="active" @click="closeMobile">
            <i :class="item.icon"></i><span>{{ item.label }}</span>
          </router-link>
        </li>
        <li class="nav-divider"></li>
        <li><router-link to="/properties" class="nav-link" @click="closeMobile"><i class="fas fa-search"></i><span>继续找房</span></router-link></li>
        <li><a class="nav-link" href="javascript:void(0)" @click="authStore.logout"><i class="fas fa-sign-out-alt"></i><span>退出登录</span></a></li>
      </ul>
    </nav>

    <main class="tenant-main">
      <header class="tenant-topbar">
        <div>
          <h2 class="page-title">{{ currentTitle }}</h2>
          <p class="page-subtitle">在线找房、咨询、预约、合同与售后都在这里完成</p>
        </div>
        <div class="topbar-right">
          <router-link to="/properties" class="topbar-link"><i class="fas fa-search me-1"></i>找房</router-link>
          <div class="user-info">
            <img :src="authStore.user?.avatar || '/uploads/avatars/default.png'" class="avatar" alt="">
            <span class="d-none d-md-inline">{{ authStore.displayName || '租客' }}</span>
          </div>
        </div>
      </header>
      <div class="tenant-content"><router-view /></div>
    </main>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'

const route = useRoute()
const authStore = useAuthStore()
const sidebarOpen = ref(false)

const navItems = [
  { to: '/tenant/dashboard', label: '租客首页', icon: 'fas fa-home' },
  { to: '/tenant/profile', label: '个人资料', icon: 'fas fa-id-card' },
  { to: '/tenant/demands', label: '找房需求', icon: 'fas fa-list' },
  { to: '/tenant/favorites', label: '收藏房源', icon: 'fas fa-heart' },
  { to: '/tenant/messages', label: '站内沟通', icon: 'fas fa-comments' },
  { to: '/tenant/appointments', label: '看房预约', icon: 'fas fa-calendar-check' },
  { to: '/tenant/applications', label: '租赁申请', icon: 'fas fa-file-signature' },
  { to: '/tenant/contracts', label: '合同中心', icon: 'fas fa-file-contract' },
  { to: '/tenant/bills', label: '账单支付', icon: 'fas fa-receipt' },
  { to: '/tenant/documents', label: '文件中心', icon: 'fas fa-folder-open' },
  { to: '/tenant/service-tickets', label: '入住服务', icon: 'fas fa-tools' },
]

const currentTitle = computed(() => navItems.find((item) => route.path.startsWith(item.to))?.label || '租客中心')
function closeMobile() { if (window.innerWidth < 768) sidebarOpen.value = false }
</script>

<style scoped>
.tenant-wrapper { display: flex; min-height: 100vh; background: #f5f7fa; }
.tenant-sidebar { width: 248px; position: fixed; inset: 0 auto 0 0; z-index: 1000; overflow-y: auto; background: linear-gradient(180deg, #0f766e 0%, #115e59 100%); box-shadow: 2px 0 12px rgba(15, 118, 110, .18); }
.sidebar-brand { padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,.16); }
.brand-link { color: #fff; text-decoration: none; display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; }
.sidebar-nav { list-style: none; margin: 0; padding: 10px 0; }
.nav-link { display: flex; align-items: center; gap: 10px; margin: 2px 10px; padding: 10px 14px; color: rgba(255,255,255,.86); text-decoration: none; border-radius: 8px; font-size: 14px; transition: .2s; }
.nav-link i { width: 18px; text-align: center; }
.nav-link:hover, .nav-link.active { color: #fff; background: rgba(255,255,255,.15); transform: translateX(3px); }
.nav-divider { height: 1px; margin: 10px 18px; background: rgba(255,255,255,.16); }
.tenant-main { flex: 1; margin-left: 248px; min-width: 0; }
.tenant-topbar { min-height: 68px; background: #fff; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 22px; position: sticky; top: 0; z-index: 900; }
.page-title { margin: 0; font-size: 18px; color: #111827; font-weight: 700; }
.page-subtitle { margin: 4px 0 0; color: #64748b; font-size: 12px; }
.topbar-right { display: flex; align-items: center; gap: 14px; }
.topbar-link { color: #0f766e; text-decoration: none; font-size: 13px; font-weight: 600; }
.user-info { display: flex; align-items: center; gap: 8px; color: #334155; font-size: 14px; }
.avatar { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; }
.tenant-content { padding: 20px; }
.sidebar-toggle { position: fixed; top: 12px; left: 12px; z-index: 1100; width: 44px; height: 44px; border: 0; border-radius: 12px; background: #0f766e; color: #fff; display: none; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(15,118,110,.28); }
.sidebar-overlay { position: fixed; inset: 0; z-index: 999; background: rgba(0,0,0,.45); }
:deep(.tenant-card) { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; box-shadow: 0 1px 3px rgba(15,23,42,.04); }
:deep(.empty-state) { padding: 42px 20px; text-align: center; color: #64748b; background: #fff; border: 1px dashed #cbd5e1; border-radius: 8px; }
@media (max-width: 767px) { .sidebar-toggle { display: flex; } .tenant-sidebar { left: -270px; width: 270px; transition: left .25s ease; border-radius: 0 16px 16px 0; } .tenant-sidebar.show { left: 0; } .tenant-main { margin-left: 0; } .tenant-topbar { padding-left: 64px; align-items: flex-start; } .page-subtitle { display: none; } .tenant-content { padding: 12px; } }
</style>
