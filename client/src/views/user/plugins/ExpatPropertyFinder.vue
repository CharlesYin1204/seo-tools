<template>
  <div class="finder-plugin">
    <div class="plugin-card">
      <div class="plugin-card-header"><i class="fas fa-search-location me-2"></i>涉外内容资产自动内容检索</div>
      <div class="plugin-card-body">
        <div class="finder-desc mb-3">
          <div class="alert alert-info mb-0">
            <i class="fas fa-info-circle me-1"></i>
            该功能已集成到微信机器人系统中。机器人会自动从微信群聊中识别和解析内容资产信息，并同步到您的内容资产管理系统。
          </div>
        </div>

        <div class="finder-features">
          <h6>功能说明</h6>
          <div class="feature-grid">
            <div class="feature-item">
              <div class="feature-icon"><i class="fas fa-robot"></i></div>
              <h6>自动识别</h6>
              <p>AI自动识别微信群中的内容资产信息</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon"><i class="fas fa-database"></i></div>
              <h6>自动录入</h6>
              <p>识别的内容资产自动保存到系统数据库</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon"><i class="fas fa-globe"></i></div>
              <h6>多语言支持</h6>
              <p>支持中英日韩等多语言内容资产内容</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon"><i class="fas fa-bell"></i></div>
              <h6>智能通知</h6>
              <p>新内容资产实时推送通知</p>
            </div>
          </div>
        </div>

        <div class="quick-access mt-4">
          <h6>快捷入口</h6>
          <div class="d-flex gap-2 flex-wrap">
            <router-link to="/user/wechat-robot" class="btn btn-outline-primary"><i class="fas fa-robot me-1"></i>微信机器人管理</router-link>
            <router-link to="/user/properties" class="btn btn-outline-primary"><i class="fas fa-home me-1"></i>内容资产管理</router-link>
            <router-link to="/user/quick-publish" class="btn btn-outline-primary"><i class="fas fa-bolt me-1"></i>快速发布内容资产</router-link>
          </div>
        </div>

        <div class="usage-guide mt-4">
          <h6><i class="fas fa-book me-1"></i>使用指南</h6>
          <ol class="guide-steps">
            <li>在「微信机器人管理」中配置机器人登录</li>
            <li>将机器人拉入内容资产相关的微信群</li>
            <li>开启「自动解析内容资产」功能</li>
            <li>机器人会自动识别群消息中的内容资产并保存</li>
            <li>在「内容资产管理」中查看和管理已识别的内容资产</li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// no vue imports needed
defineProps({ plugin: Object })
</script>

<style scoped>
.plugin-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.plugin-card-header { padding: 16px 20px; background: linear-gradient(135deg, #4879FF, #00b4d8); color: #fff; font-size: 16px; font-weight: 600; }
.plugin-card-body { padding: 20px; }
h6 { font-size: 14px; font-weight: 600; margin-bottom: 10px; }
.feature-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
@media (max-width: 768px) { .feature-grid { grid-template-columns: repeat(2, 1fr); } }
.feature-item { background: #f8f9fa; border-radius: 8px; padding: 16px; text-align: center; }
.feature-icon { font-size: 28px; color: #4879FF; margin-bottom: 8px; }
.feature-item h6 { font-size: 13px; }
.feature-item p { font-size: 12px; color: #888; margin: 0; }
.guide-steps { font-size: 13px; line-height: 2; padding-left: 20px; }
.guide-steps li { color: #555; }
</style>
