<template>
  <div class="landlord-wrapper">
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>
    <button class="sidebar-toggle d-md-none" @click="sidebarOpen = !sidebarOpen">
      <i :class="sidebarOpen ? 'fas fa-times' : 'fas fa-bars'"></i>
    </button>

    <nav class="landlord-sidebar" :class="{ show: sidebarOpen }">
      <div class="sidebar-brand">
        <router-link to="/landlord/dashboard" class="brand-link">
          <i class="fas fa-building"></i>
          <span>ExpatHome 房东</span>
        </router-link>
      </div>
      <ul class="sidebar-nav">
        <li><router-link to="/landlord/dashboard" class="nav-link" active-class="active" @click="closeMobile"><i class="fas fa-tachometer-alt"></i>工作台</router-link></li>
        <li><router-link to="/landlord/properties" class="nav-link" active-class="active" @click="closeMobile"><i class="fas fa-home"></i>我的房源</router-link></li>
        <li class="mt-3"><a class="nav-link" href="javascript:void(0)" @click="authStore.logout"><i class="fas fa-sign-out-alt"></i>退出登录</a></li>
      </ul>
    </nav>

    <main class="landlord-main">
      <header class="landlord-topbar">
        <h2 class="page-title">房东后台</h2>
        <div class="topbar-right">
          <router-link to="/user/dashboard" class="btn-link"><i class="fas fa-arrow-left me-1"></i>返回用户中心</router-link>
          <div class="user-info">
            <img :src="authStore.user?.avatar || '/uploads/avatars/default.png'" class="avatar" alt="">
            <span class="d-none d-md-inline">{{ authStore.displayName }}</span>
          </div>
        </div>
      </header>
      <div class="landlord-content"><router-view /></div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/store/auth'
const authStore = useAuthStore()
const sidebarOpen = ref(false)
function closeMobile() { if (window.innerWidth < 768) sidebarOpen.value = false }
</script>

<style scoped>
.landlord-wrapper { display: flex; min-height: 100vh; }

.landlord-sidebar {
  width: 240px; background: linear-gradient(180deg, #F39C12 0%, #D68910 100%);
  position: fixed; top: 0; left: 0; bottom: 0; z-index: 1000;
  overflow-y: auto; box-shadow: 2px 0 10px rgba(0,0,0,0.1);
}
.sidebar-brand { padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,0.2); }
.brand-link { color: #fff; text-decoration: none; display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 14px; }
.sidebar-nav { list-style: none; padding: 8px 0; margin: 0; }
.sidebar-nav .nav-link {
  display: flex; align-items: center; padding: 10px 16px; margin: 2px 10px;
  color: rgba(255,255,255,0.9); text-decoration: none; border-radius: 8px;
  transition: all 0.25s; font-size: 14px; cursor: pointer;
}
.sidebar-nav .nav-link i { width: 20px; margin-right: 10px; text-align: center; }
.sidebar-nav .nav-link:hover, .sidebar-nav .nav-link.active {
  color: #fff; background: rgba(255,255,255,0.2); transform: translateX(3px);
}

.landlord-main { flex: 1; margin-left: 240px; background: #f5f7fa; display: flex; flex-direction: column; }
.landlord-topbar {
  height: 56px; background: #fff; border-bottom: 1px solid #e8e8e8;
  display: flex; align-items: center; justify-content: space-between; padding: 0 20px;
  position: sticky; top: 0; z-index: 900;
}
.page-title { font-size: 16px; font-weight: 600; margin: 0; color: #333; }
.topbar-right { display: flex; align-items: center; gap: 16px; }
.btn-link { color: #F39C12; text-decoration: none; font-size: 13px; }
.btn-link:hover { text-decoration: underline; }
.user-info { display: flex; align-items: center; gap: 6px; }
.avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
.landlord-content { flex: 1; padding: 20px; }

.sidebar-toggle {
  position: fixed; top: 12px; left: 12px; z-index: 1100;
  background: #F39C12; color: #fff; border: none; border-radius: 12px;
  width: 44px; height: 44px; display: none; align-items: center; justify-content: center;
  box-shadow: 0 4px 15px rgba(243,156,18,0.4); cursor: pointer; font-size: 18px;
}
.sidebar-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 999; }

@media (max-width: 767px) {
  .sidebar-toggle { display: flex !important; }
  .landlord-sidebar { left: -260px; width: 260px; transition: left 0.3s ease; border-radius: 0 16px 16px 0; }
  .landlord-sidebar.show { left: 0; }
  .landlord-main { margin-left: 0; }
  .landlord-topbar { padding-left: 60px; }
  .landlord-content { padding: 12px; }
}
</style>
