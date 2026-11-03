<template>
  <div class="wechat-robot-home">
    <!-- Hero区 -->
    <section class="robot-hero">
      <div class="container text-center">
        <div class="hero-icon"><i class="fas fa-robot"></i></div>
        <h1>WeChat AI Robot</h1>
        <p class="hero-subtitle">Intelligent property assistant powered by AI, helping you find your perfect home in Shanghai</p>
        <div class="hero-actions">
          <router-link to="/auth/login" class="btn-hero-primary">Get Started</router-link>
          <a href="#features" class="btn-hero-outline">Learn More</a>
        </div>
      </div>
    </section>

    <!-- 功能介绍 -->
    <section id="features" class="features-section">
      <div class="container">
        <div class="section-header text-center">
          <h2>Smart Features</h2>
          <p>Our AI-powered WeChat robot provides comprehensive rental assistance</p>
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

    <!-- 使用流程 -->
    <section class="flow-section">
      <div class="container">
        <div class="section-header text-center">
          <h2>How It Works</h2>
          <p>Three simple steps to start using our AI robot</p>
        </div>
        <div class="row g-4">
          <div v-for="(step, i) in steps" :key="i" class="col-md-4">
            <div class="step-card text-center">
              <div class="step-number">{{ i + 1 }}</div>
              <h4>{{ step.title }}</h4>
              <p>{{ step.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta-section">
      <div class="container text-center">
        <h2>Ready to Find Your Dream Home?</h2>
        <p>Join thousands of expats who found their perfect home with our AI assistant</p>
        <router-link v-if="authStore.allowRegister" to="/auth/register" class="btn-cta">Create Free Account</router-link>
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
  { icon: 'fas fa-comments', title: 'Auto Reply', desc: 'Instantly respond to tenant inquiries 24/7, providing property information and answering common questions.' },
  { icon: 'fas fa-brain', title: 'Smart Q&A', desc: 'AI-powered natural language understanding to answer complex rental questions in multiple languages.' },
  { icon: 'fas fa-paper-plane', title: 'Property Push', desc: 'Automatically push matching properties to tenants based on their preferences and search history.' },
  { icon: 'fas fa-language', title: 'Multi-language', desc: 'Support Chinese, English, Japanese, Korean and more languages for seamless communication.' },
  { icon: 'fas fa-chart-line', title: 'Smart Analytics', desc: 'Track tenant interactions and preferences to optimize property recommendations over time.' },
  { icon: 'fas fa-shield-alt', title: 'Secure & Reliable', desc: 'Enterprise-grade security ensuring all conversations and data are protected and private.' },
]

const steps = [
  { title: 'Add the Robot', desc: 'Scan QR code or search our WeChat ID to add the AI robot as your contact.' },
  { title: 'Describe Your Needs', desc: 'Tell the robot your budget, preferred area, and room requirements in any language.' },
  { title: 'Get Recommendations', desc: 'Receive personalized property recommendations and schedule viewings directly.' },
]
</script>

<style scoped>
.robot-hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 80px 20px 60px; color: white;
}
.hero-icon { font-size: 64px; margin-bottom: 20px; opacity: 0.9; }
.robot-hero h1 { font-size: 42px; font-weight: 800; margin-bottom: 16px; }
.hero-subtitle { font-size: 18px; opacity: 0.9; max-width: 600px; margin: 0 auto 30px; line-height: 1.6; }
.hero-actions { display: flex; gap: 16px; justify-content: center; }
.btn-hero-primary {
  background: white; color: #764ba2; padding: 14px 32px; border-radius: 10px;
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
  background: white; border-radius: 12px; padding: 30px; height: 100%;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06); transition: all 0.3s;
}
.feature-card:hover { transform: translateY(-5px); box-shadow: 0 8px 25px rgba(0,0,0,0.12); }
.feature-icon {
  width: 56px; height: 56px; border-radius: 14px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white; display: flex; align-items: center; justify-content: center;
  font-size: 22px; margin-bottom: 16px;
}
.feature-card h4 { font-size: 17px; font-weight: 600; color: #1e293b; margin-bottom: 8px; }
.feature-card p { font-size: 14px; color: #64748b; line-height: 1.6; margin: 0; }

.flow-section { padding: 60px 20px; }
.step-card {
  background: white; border-radius: 12px; padding: 30px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06); transition: all 0.3s;
}
.step-card:hover { transform: translateY(-4px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
.step-number {
  width: 48px; height: 48px; border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white; font-size: 20px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
}
.step-card h4 { font-size: 17px; font-weight: 600; color: #1e293b; margin-bottom: 8px; }
.step-card p { font-size: 14px; color: #64748b; line-height: 1.6; margin: 0; }

.cta-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 60px 20px; color: white;
}
.cta-section h2 { font-size: 28px; font-weight: 700; margin-bottom: 12px; }
.cta-section p { font-size: 16px; opacity: 0.9; margin-bottom: 30px; }
.btn-cta {
  background: white; color: #764ba2; padding: 14px 36px; border-radius: 10px;
  font-weight: 600; font-size: 16px; text-decoration: none; display: inline-block; transition: all 0.3s;
}
.btn-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.2); }

@media (max-width: 768px) {
  .robot-hero { padding: 50px 16px 40px; }
  .robot-hero h1 { font-size: 28px; }
  .hero-subtitle { font-size: 15px; }
  .hero-actions { flex-direction: column; align-items: center; }
  .section-header h2 { font-size: 22px; }
}
</style>
