<template>
  <div class="wechat-matrix-home">
    <!-- Hero区 -->
    <section class="matrix-hero">
      <div class="container text-center">
        <div class="hero-icon"><i class="fab fa-weixin"></i></div>
        <h1>WeChat Official Account Matrix</h1>
        <p class="hero-subtitle">Manage multiple WeChat official accounts from a single platform, amplify your property marketing reach</p>
        <div class="hero-actions">
          <router-link to="/auth/login" class="btn-hero-primary">Start Now</router-link>
          <a href="#features" class="btn-hero-outline">Explore Features</a>
        </div>
      </div>
    </section>

    <!-- 功能特点 -->
    <section id="features" class="features-section">
      <div class="container">
        <div class="section-header text-center">
          <h2>Matrix Management Features</h2>
          <p>Powerful tools to manage and grow your WeChat presence</p>
        </div>
        <div class="row g-4">
          <div v-for="(feat, i) in features" :key="i" class="col-md-6 col-lg-4">
            <div class="feature-card">
              <div class="feature-icon"><i :class="feat.icon"></i></div>
              <h4>{{ feat.title }}</h4>
              <p>{{ feat.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 数据亮点 -->
    <section class="stats-section">
      <div class="container">
        <div class="row g-4 text-center">
          <div v-for="(stat, i) in stats" :key="i" class="col-6 col-md-3">
            <div class="stat-item">
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 优势对比 -->
    <section class="advantages-section">
      <div class="container">
        <div class="section-header text-center">
          <h2>Why Choose Our Matrix Platform?</h2>
          <p>Compare the benefits of centralized management</p>
        </div>
        <div class="row g-4">
          <div v-for="(adv, i) in advantages" :key="i" class="col-md-6">
            <div class="advantage-card">
              <div class="adv-icon"><i :class="adv.icon"></i></div>
              <div>
                <h5>{{ adv.title }}</h5>
                <p>{{ adv.desc }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta-section">
      <div class="container text-center">
        <h2>Ready to Scale Your Marketing?</h2>
        <p>Start managing your WeChat accounts more efficiently today</p>
        <router-link v-if="authStore.allowRegister" to="/auth/register" class="btn-cta">Get Started Free</router-link>
        <router-link v-else to="/auth/login" class="btn-cta">Sign In</router-link>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/store/auth'

const authStore = useAuthStore()
onMounted(() => {
  authStore.fetchPublicSettings()
})

const features = [
  { icon: 'fas fa-layer-group', title: 'Multi-Account Management', desc: 'Connect and manage all your WeChat official accounts from a single unified dashboard.' },
  { icon: 'fas fa-sync-alt', title: 'Content Syndication', desc: 'Publish articles to multiple accounts simultaneously with one click, saving hours of manual work.' },
  { icon: 'fas fa-chart-bar', title: 'Unified Analytics', desc: 'View performance metrics across all accounts in consolidated reports and dashboards.' },
  { icon: 'fas fa-users', title: 'Follower Management', desc: 'Centralized follower database with tagging, segmentation, and engagement tracking.' },
  { icon: 'fas fa-clock', title: 'Scheduled Publishing', desc: 'Plan and schedule content across all accounts with an intuitive calendar interface.' },
  { icon: 'fas fa-plug', title: 'Plugin Ecosystem', desc: 'Extend functionality with marketplace plugins for SEO, CRM integration, and more.' },
]

const stats = [
  { value: '500+', label: 'Active Users' },
  { value: '2,000+', label: 'Accounts Managed' },
  { value: '50K+', label: 'Articles Published' },
  { value: '99.9%', label: 'Uptime' },
]

const advantages = [
  { icon: 'fas fa-tachometer-alt', title: 'Save 80% of Time', desc: 'Automate repetitive tasks and manage everything from one place instead of switching between accounts.' },
  { icon: 'fas fa-bullseye', title: 'Targeted Reach', desc: 'Segment your audience across accounts and deliver targeted property listings to the right followers.' },
  { icon: 'fas fa-lock', title: 'Enterprise Security', desc: 'Role-based access control ensures team members only access the accounts they need.' },
  { icon: 'fas fa-headset', title: '24/7 Support', desc: 'Dedicated support team available around the clock to help you maximize your marketing efforts.' },
]
</script>

<style scoped>
.matrix-hero {
  background: linear-gradient(135deg, #07c160 0%, #06ad56 50%, #059b4b 100%);
  padding: 80px 20px 60px; color: white;
}
.hero-icon { font-size: 64px; margin-bottom: 20px; opacity: 0.9; }
.matrix-hero h1 { font-size: 40px; font-weight: 800; margin-bottom: 16px; }
.hero-subtitle { font-size: 18px; opacity: 0.9; max-width: 640px; margin: 0 auto 30px; line-height: 1.6; }
.hero-actions { display: flex; gap: 16px; justify-content: center; }
.btn-hero-primary {
  background: white; color: #07c160; padding: 14px 32px; border-radius: 10px;
  font-weight: 600; font-size: 16px; text-decoration: none; transition: all 0.3s;
}
.btn-hero-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.2); }
.btn-hero-outline {
  border: 2px solid rgba(255,255,255,0.6); color: white; padding: 14px 32px; border-radius: 10px;
  font-weight: 600; font-size: 16px; text-decoration: none; transition: all 0.3s;
}
.btn-hero-outline:hover { background: rgba(255,255,255,0.15); border-color: white; }

.section-header { margin-bottom: 40px; }
.section-header h2 { font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 10px; }
.section-header p { color: #64748b; font-size: 16px; }

.features-section { padding: 60px 20px; background: #f8f9fa; }
.feature-card {
  background: white; border-radius: 12px; padding: 28px; height: 100%;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06); transition: all 0.3s;
}
.feature-card:hover { transform: translateY(-5px); box-shadow: 0 8px 25px rgba(0,0,0,0.12); }
.feature-icon {
  width: 52px; height: 52px; border-radius: 14px;
  background: linear-gradient(135deg, #07c160, #06ad56);
  color: white; display: flex; align-items: center; justify-content: center;
  font-size: 20px; margin-bottom: 16px;
}
.feature-card h4 { font-size: 17px; font-weight: 600; color: #1e293b; margin-bottom: 8px; }
.feature-card p { font-size: 14px; color: #64748b; line-height: 1.6; margin: 0; }

.stats-section { padding: 50px 20px; background: linear-gradient(135deg, #07c160, #06ad56); color: white; }
.stat-value { font-size: 36px; font-weight: 800; margin-bottom: 4px; }
.stat-label { font-size: 14px; opacity: 0.85; }

.advantages-section { padding: 60px 20px; }
.advantage-card {
  display: flex; gap: 16px; align-items: flex-start; background: white; border-radius: 12px;
  padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); transition: all 0.3s; height: 100%;
}
.advantage-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
.adv-icon {
  width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
  background: linear-gradient(135deg, #07c160, #06ad56);
  color: white; display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.advantage-card h5 { font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 6px; }
.advantage-card p { font-size: 13px; color: #64748b; line-height: 1.6; margin: 0; }

.cta-section {
  background: linear-gradient(135deg, #07c160 0%, #059b4b 100%);
  padding: 60px 20px; color: white;
}
.cta-section h2 { font-size: 28px; font-weight: 700; margin-bottom: 12px; }
.cta-section p { font-size: 16px; opacity: 0.9; margin-bottom: 30px; }
.btn-cta {
  background: white; color: #07c160; padding: 14px 36px; border-radius: 10px;
  font-weight: 600; font-size: 16px; text-decoration: none; display: inline-block; transition: all 0.3s;
}
.btn-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.2); }

@media (max-width: 768px) {
  .matrix-hero { padding: 50px 16px 40px; }
  .matrix-hero h1 { font-size: 26px; }
  .hero-subtitle { font-size: 15px; }
  .hero-actions { flex-direction: column; align-items: center; }
  .section-header h2 { font-size: 22px; }
  .stat-value { font-size: 28px; }
}
</style>
