<template>
  <div class="auth-layout d-flex justify-content-center align-items-center min-vh-100">
    <div class="auth-container">
      <div class="text-center mb-4">
        <router-link to="/" class="text-decoration-none">
          <h2 class="fw-bold text-primary">SEO工具</h2>
          <p class="text-muted small">多站点 SEO + AI 搜索可见性运营平台</p>
        </router-link>
      </div>
      <router-view />
    </div>
  </div>
</template>

<style scoped>
.auth-layout {
  background: #14213d;
}
.auth-container {
  width: 100%;
  max-width: 420px;
  padding: 16px;
}
</style>
