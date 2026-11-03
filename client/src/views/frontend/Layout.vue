<template>
  <div class="frontend-layout">
    <!-- Header - 与PHP版layout.php导航一致，地图页面隐藏（地图页自带导航） -->
    <header v-if="!isMapSearchPage" class="main-header d-none d-md-block">
      <nav class="navbar navbar-expand-lg navbar-light bg-white border-bottom shadow-sm">
        <div class="container">
          <router-link to="/" class="navbar-brand">
            <i class="fas fa-chart-line me-2" style="color:#21b892"></i>
            <span class="brand-text">SEO工具</span>
          </router-link>

          <button class="navbar-toggler" type="button" @click="menuOpen = !menuOpen">
            <span class="navbar-toggler-icon"></span>
          </button>

          <div :class="['collapse navbar-collapse', { show: menuOpen }]">
            <ul class="navbar-nav me-auto">
              <li class="nav-item">
                <router-link to="/" class="nav-link" exact-active-class="active">产品</router-link>
              </li>
              <li class="nav-item">
                <a href="/#workflow" class="nav-link">工作流程</a>
              </li>
              <li class="nav-item">
                <a href="/#capabilities" class="nav-link">功能能力</a>
              </li>
              <li class="nav-item">
                <router-link to="/blog" class="nav-link" active-class="active">SEO 内容</router-link>
              </li>
            </ul>

            <div class="d-flex align-items-center gap-2 ms-lg-3">
              <template v-if="authStore.isLoggedIn">
                <div class="dropdown">
                  <button class="btn btn-outline-primary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
                    <img v-if="authStore.user?.avatar" :src="authStore.user.avatar" class="user-avatar" alt="" />
                    <i v-else class="fas fa-user me-1"></i>
                    {{ authStore.displayName }}
                  </button>
                  <ul class="dropdown-menu dropdown-menu-end">
                    <li><router-link :to="authStore.user?.role === 'tenant' ? '/tenant/dashboard' : '/user/dashboard'" class="dropdown-item"><i class="fas fa-tachometer-alt me-2"></i>User Center</router-link></li>
                    <li v-if="authStore.user?.role === 'admin'">
                      <router-link to="/admin/dashboard" class="dropdown-item"><i class="fas fa-cog me-2"></i>Admin Panel</router-link>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item" href="#" @click.prevent="doLogout"><i class="fas fa-sign-out-alt me-2"></i>Logout</a></li>
                  </ul>
                </div>
              </template>
              <template v-else>
                <router-link to="/auth/login" class="btn btn-outline-primary btn-sm">登录</router-link>
                <router-link v-if="authStore.allowRegister" to="/auth/register" class="btn btn-primary btn-sm">免费注册</router-link>
              </template>
            </div>
          </div>
        </div>
      </nav>
    </header>

    <!-- 移动端顶部 (简化)，地图页面隐藏 -->
    <header v-if="!isMapSearchPage" class="mobile-header d-block d-md-none">
      <div class="container-fluid d-flex align-items-center justify-content-between">
        <router-link to="/" class="mobile-brand">
          <i class="fas fa-chart-line" style="color:#21b892"></i>
          <span>SEO工具</span>
        </router-link>
        <div class="d-flex align-items-center gap-2">
          <template v-if="authStore.isLoggedIn">
            <router-link :to="authStore.user?.role === 'tenant' ? '/tenant/dashboard' : '/user/dashboard'" class="btn btn-sm btn-outline-primary">
              <i class="fas fa-user"></i>
            </router-link>
          </template>
          <template v-else>
            <router-link to="/auth/login" class="btn btn-sm btn-outline-primary">登录</router-link>
          </template>
        </div>
      </div>
    </header>

    <!-- Page Content -->
    <main class="page-main">
      <router-view />
    </main>
    <footer class="policy-footer"><router-link to="/legal/privacy">隐私政策</router-link><router-link to="/legal/terms">服务协议</router-link><router-link to="/legal/refund">退款规则</router-link><router-link to="/legal/ai">AI 与 SEO 说明</router-link></footer>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const menuOpen = ref(false)

const isMapSearchPage = computed(() => route.path === '/map-search')

onMounted(() => {
  authStore.fetchPublicSettings()
})

function doLogout() {
  authStore.logout()
  router.push('/')
}
</script>

<style scoped>
.frontend-layout { min-height: 100vh; }
.main-header { position: sticky; top: 0; z-index: 1030; }
.navbar { padding: 0; }
.navbar-brand {
  display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 20px;
  color: #1e293b; text-decoration: none; padding: 12px 0;
}
.brand-text { color: #1e293b; }
.nav-link { font-size: 14px; font-weight: 500; color: #475569; padding: 16px 12px !important; transition: color 0.3s; }
.nav-link:hover, .nav-link.active { color: #667eea; }
.user-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; margin-right: 4px; }

/* 移动端顶部 */
.mobile-header {
  position: sticky; top: 0; z-index: 1030;
  background: #fff; border-bottom: 1px solid #e8e8e8;
  padding: 10px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.mobile-brand {
  display: flex; align-items: center; gap: 6px;
  color: #1e293b; text-decoration: none; font-weight: 700; font-size: 16px;
}

/* 移动端底部导航 - 匹配PHP版 */
.mobile-bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: rgba(255,255,255,0.96);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-top: 1px solid rgba(0,0,0,0.06);
  display: flex; justify-content: space-around; align-items: center;
  padding: 6px 0;
  padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
  z-index: 1040;
  box-shadow: 0 -2px 12px rgba(0,0,0,0.06);
}
.bottom-nav-item {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-decoration: none; color: #666; font-size: 10px;
  padding: 4px 12px; border-radius: 8px; transition: all 0.2s;
  position: relative;
}
.bottom-nav-item i { font-size: 18px; margin-bottom: 2px; }
.bottom-nav-item.active { color: #667eea; }
.bottom-nav-item.active::after {
  content: '';
  position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
  width: 20px; height: 3px; border-radius: 2px; background: #667eea;
}

/* 移动端 body 底部留空 */
.page-main { padding-bottom: 0; }
.policy-footer{display:flex;justify-content:center;gap:20px;padding:22px 16px;color:#667085;font-size:12px;border-top:1px solid #eef1f4}.policy-footer a{color:inherit;text-decoration:none}.policy-footer a:hover{color:#1677ff}
@media (max-width: 767px) {
  .page-main { padding-bottom: 60px; }
}

@media (max-width: 991px) {
  .navbar-collapse { padding: 12px 0; }
  .nav-link { padding: 8px 0 !important; }
}
</style>
