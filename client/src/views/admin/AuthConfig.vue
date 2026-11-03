<template>
  <div>
    <div class="page-header">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h3 class="page-title">
            <i class="fas fa-user-shield me-2"></i>登录注册配置
          </h3>
          <p class="text-muted mb-0">
            配置各种登录注册方式，为用户提供便捷的身份验证选项
          </p>
        </div>
      </div>
    </div>

    <!-- 注册开关设置 -->
    <div class="card-container mb-4" v-loading="loading">
      <div class="register-toggle-row">
        <div class="register-toggle-info">
          <div
            class="register-toggle-icon"
            :class="config.allow_register ? 'bg-success' : 'bg-danger'"
          >
            <i
              :class="
                config.allow_register ? 'fas fa-user-plus' : 'fas fa-user-slash'
              "
            ></i>
          </div>
          <div>
            <h5 class="mb-0">用户注册功能</h5>
            <p class="text-muted small mb-0">
              {{
                config.allow_register
                  ? "当前已开放新用户注册"
                  : "当前已关闭新用户注册，用户无法创建新账号"
              }}
            </p>
          </div>
        </div>
        <div class="register-toggle-action">
          <el-switch
            v-model="config.allow_register"
            active-text="开启注册"
            inactive-text="关闭注册"
            inline-prompt
            :active-value="true"
            :inactive-value="false"
            style="
              --el-switch-on-color: #27ae60;
              --el-switch-off-color: #eb5757;
            "
            @change="saveConfig"
          />
        </div>
      </div>
    </div>

    <!-- 认证方式配置卡片 -->
    <div class="auth-grid" v-loading="loading">
      <!-- 注册设置 -->
      <div class="auth-card">
        <div class="auth-card-header">
          <div class="auth-icon bg-register">
            <i class="fas fa-user-plus"></i>
          </div>
          <div>
            <h5>注册设置</h5>
            <small class="text-muted">注册方式与限制</small>
          </div>
        </div>
        <p class="auth-desc">
          配置注册规则、默认角色、验证要求等注册相关设置。
        </p>
        <div class="d-flex justify-content-between align-items-center">
          <el-tag
            :type="config.allow_register ? 'success' : 'danger'"
            size="small"
            >{{ config.allow_register ? "已开放" : "已关闭" }}</el-tag
          >
          <el-button
            type="warning"
            size="small"
            plain
            @click="
              activeTab = 'register';
              showConfigDialog = true;
            "
          >
            <i class="fas fa-cog me-1"></i>配置
          </el-button>
        </div>
      </div>

      <!-- 聚合登录 -->
      <div class="auth-card">
        <div class="auth-card-header">
          <div class="auth-icon bg-primary"><i class="fas fa-link"></i></div>
          <div>
            <h5>聚合登录</h5>
            <small class="text-muted">第三方登录集成</small>
          </div>
        </div>
        <p class="auth-desc">
          支持QQ、微信、支付宝、微博等多种第三方账号登录。
        </p>
        <div class="d-flex justify-content-between align-items-center">
          <el-tag
            :type="config.rainbow_login ? 'success' : 'info'"
            size="small"
            >{{ config.rainbow_login ? "已启用" : "未配置" }}</el-tag
          >
          <el-button
            type="primary"
            size="small"
            plain
            @click="
              activeTab = 'oauth';
              showConfigDialog = true;
            "
          >
            <i class="fas fa-cog me-1"></i>配置
          </el-button>
        </div>
      </div>

      <!-- 短信验证登录 -->
      <div class="auth-card">
        <div class="auth-card-header">
          <div class="auth-icon bg-success"><i class="fas fa-sms"></i></div>
          <div>
            <h5>短信验证登录</h5>
            <small class="text-muted">阿里云短信服务</small>
          </div>
        </div>
        <p class="auth-desc">
          接入阿里云短信服务，支持手机号验证码登录和注册。
        </p>
        <div class="d-flex justify-content-between align-items-center">
          <el-tag
            :type="config.sms_aliyun_key ? 'success' : 'info'"
            size="small"
            >{{ config.sms_aliyun_key ? "已配置" : "未配置" }}</el-tag
          >
          <el-button
            type="success"
            size="small"
            plain
            @click="
              activeTab = 'sms';
              showConfigDialog = true;
            "
          >
            <i class="fas fa-cog me-1"></i>配置
          </el-button>
        </div>
      </div>

      <!-- 邮件注册登录 -->
      <div class="auth-card">
        <div class="auth-card-header">
          <div class="auth-icon bg-info"><i class="fas fa-envelope"></i></div>
          <div>
            <h5>邮件注册登录</h5>
            <small class="text-muted">SMTP发件箱配置</small>
          </div>
        </div>
        <p class="auth-desc">
          配置SMTP发件箱，支持邮箱验证注册和密码找回功能。
        </p>
        <div class="d-flex justify-content-between align-items-center">
          <el-tag :type="config.smtp_host ? 'success' : 'info'" size="small">{{
            config.smtp_host ? "已配置" : "未配置"
          }}</el-tag>
          <el-button
            type="info"
            size="small"
            plain
            @click="
              activeTab = 'email';
              showConfigDialog = true;
            "
          >
            <i class="fas fa-cog me-1"></i>配置
          </el-button>
        </div>
      </div>

      <!-- 微信扫码登录 -->
      <div class="auth-card">
        <div class="auth-card-header">
          <div class="auth-icon bg-wechat"><i class="fab fa-weixin"></i></div>
          <div>
            <h5>微信扫码登录</h5>
            <small class="text-muted">官方微信登录</small>
          </div>
        </div>
        <p class="auth-desc">接入微信官方登录接口，支持微信扫码登录功能。</p>
        <div class="d-flex justify-content-between align-items-center">
          <el-tag
            :type="config.wechat_login ? 'success' : 'info'"
            size="small"
            >{{ config.wechat_login ? "已启用" : "未配置" }}</el-tag
          >
          <el-button
            type="success"
            size="small"
            plain
            @click="
              activeTab = 'wechat';
              showConfigDialog = true;
            "
          >
            <i class="fas fa-cog me-1"></i>配置
          </el-button>
        </div>
      </div>
    </div>

    <!-- 用户统计信息 -->
    <div class="card-container mt-4">
      <h5 class="section-title"><i class="fas fa-users me-2"></i>用户统计</h5>
      <div class="user-stats-row">
        <div class="user-stat-item">
          <div class="user-stat-value text-primary">
            {{ userStats.totalUsers }}
          </div>
          <div class="user-stat-label">总用户数</div>
        </div>
        <div class="user-stat-item">
          <div class="user-stat-value text-success">
            {{ userStats.todayUsers }}
          </div>
          <div class="user-stat-label">今日注册</div>
        </div>
        <div class="user-stat-item">
          <div class="user-stat-value text-info">
            {{ userStats.activeUsers }}
          </div>
          <div class="user-stat-label">活跃用户</div>
        </div>
        <div class="user-stat-item">
          <div class="user-stat-value text-warning">
            {{ userStats.loginMethods }}
          </div>
          <div class="user-stat-label">登录方式</div>
        </div>
      </div>
    </div>

    <!-- 安全设置 -->
    <div class="card-container mt-4">
      <h5 class="section-title">
        <i class="fas fa-shield-alt me-2"></i>安全设置
      </h5>
      <div class="security-grid">
        <div class="security-item">
          <el-switch v-model="config.require_email" />
          <div>
            <div class="fw-bold">强制邮箱验证</div>
            <div class="text-muted small">用户注册后必须验证邮箱才能使用</div>
          </div>
        </div>
        <div class="security-item">
          <el-switch v-model="config.allow_guest" />
          <div>
            <div class="fw-bold">允许访客浏览</div>
            <div class="text-muted small">未登录用户可以浏览部分内容</div>
          </div>
        </div>
        <div class="security-item">
          <el-switch v-model="config.enable_captcha" />
          <div>
            <div class="fw-bold">启用验证码</div>
            <div class="text-muted small">登录和注册时显示验证码</div>
          </div>
        </div>
        <div class="security-item">
          <el-switch v-model="config.enable_login_limit" />
          <div>
            <div class="fw-bold">登录频率限制</div>
            <div class="text-muted small">限制同一IP的登录尝试次数</div>
          </div>
        </div>
      </div>
      <div class="mt-3">
        <el-button type="primary" :loading="saving" @click="saveConfig">
          <i class="fas fa-save me-1"></i>保存安全设置
        </el-button>
      </div>
    </div>

    <!-- 详细配置弹窗 -->
    <el-dialog
      v-model="showConfigDialog"
      :title="dialogTitles[activeTab]"
      width="650px"
    >
      <el-form :model="config" label-width="160px">
        <!-- 注册设置 -->
        <template v-if="activeTab === 'register'">
          <el-form-item label="开放注册"
            ><el-switch v-model="config.allow_register" />
            <div class="form-help">关闭后新用户将无法注册</div></el-form-item
          >
          <el-form-item label="注册需手机验证"
            ><el-switch v-model="config.require_phone"
          /></el-form-item>
          <el-form-item label="注册需邮箱验证"
            ><el-switch v-model="config.require_email"
          /></el-form-item>
          <el-form-item label="默认用户角色">
            <el-select v-model="config.default_role" style="width: 100%">
              <el-option label="普通用户" value="user" /><el-option
                label="SEO 专员"
                value="agent"
              /><el-option label="内容管理员" value="landlord" />
            </el-select>
          </el-form-item>
        </template>

        <!-- 短信配置 -->
        <template v-if="activeTab === 'sms'">
          <el-form-item label="短信服务商">
            <el-select v-model="config.sms_provider" style="width: 100%">
              <el-option label="阿里云短信" value="aliyun" /><el-option
                label="短信宝"
                value="smsbao"
              />
            </el-select>
          </el-form-item>
          <template v-if="config.sms_provider === 'aliyun'">
            <el-form-item label="AccessKey ID"
              ><el-input v-model="config.sms_aliyun_key"
            /></el-form-item>
            <el-form-item label="AccessKey Secret"
              ><el-input
                v-model="config.sms_aliyun_secret"
                type="password"
                show-password
            /></el-form-item>
            <el-form-item label="签名名称"
              ><el-input v-model="config.sms_aliyun_sign"
            /></el-form-item>
            <el-form-item label="模板Code"
              ><el-input v-model="config.sms_aliyun_template"
            /></el-form-item>
          </template>
          <template v-if="config.sms_provider === 'smsbao'">
            <el-form-item label="用户名"
              ><el-input v-model="config.sms_smsbao_user"
            /></el-form-item>
            <el-form-item label="密码"
              ><el-input
                v-model="config.sms_smsbao_pass"
                type="password"
                show-password
            /></el-form-item>
          </template>
        </template>

        <!-- 邮件配置 -->
        <template v-if="activeTab === 'email'">
          <el-form-item label="SMTP服务器"
            ><el-input
              v-model="config.smtp_host"
              placeholder="如：smtp.gmail.com"
          /></el-form-item>
          <el-form-item label="SMTP端口"
            ><el-input v-model="config.smtp_port" placeholder="如：465"
          /></el-form-item>
          <el-form-item label="加密方式">
            <el-select v-model="config.smtp_encryption" style="width: 100%">
              <el-option label="SSL" value="ssl" /><el-option
                label="TLS"
                value="tls"
              /><el-option label="无" value="none" />
            </el-select>
          </el-form-item>
          <el-form-item label="SMTP用户名"
            ><el-input v-model="config.smtp_username"
          /></el-form-item>
          <el-form-item label="SMTP密码"
            ><el-input
              v-model="config.smtp_password"
              type="password"
              show-password
          /></el-form-item>
          <el-form-item label="发件人邮箱"
            ><el-input v-model="config.from_email"
          /></el-form-item>
          <el-form-item label="发件人名称"
            ><el-input v-model="config.from_name"
          /></el-form-item>
          <el-form-item
            ><el-button @click="testEmail" :loading="testingEmail"
              ><i class="fas fa-paper-plane me-1"></i>发送测试邮件</el-button
            ></el-form-item
          >
        </template>

        <!-- OAuth / 聚合登录 -->
        <template v-if="activeTab === 'oauth'">
          <el-divider content-position="left"
            ><i class="fab fa-weixin me-1" style="color: #07c160"></i
            >微信登录</el-divider
          >
          <el-form-item label="启用微信登录"
            ><el-switch v-model="config.wechat_login"
          /></el-form-item>
          <template v-if="config.wechat_login">
            <el-form-item label="AppID"
              ><el-input v-model="config.wechat_app_id"
            /></el-form-item>
            <el-form-item label="AppSecret"
              ><el-input
                v-model="config.wechat_app_secret"
                type="password"
                show-password
            /></el-form-item>
            <el-form-item label="回调地址"
              ><el-input v-model="config.wechat_callback_url"
            /></el-form-item>
          </template>
          <el-divider content-position="left"
            ><i class="fab fa-google me-1" style="color: #4285f4"></i
            >Google登录</el-divider
          >
          <el-form-item label="启用Google登录"
            ><el-switch v-model="config.google_login"
          /></el-form-item>
          <template v-if="config.google_login">
            <el-form-item label="Client ID"
              ><el-input v-model="config.google_client_id"
            /></el-form-item>
            <el-form-item label="Client Secret"
              ><el-input
                v-model="config.google_client_secret"
                type="password"
                show-password
            /></el-form-item>
            <el-form-item label="Search Console 回调地址"
              ><el-input
                v-model="config.google_gsc_callback_url"
                placeholder="https://你的域名/api/user/seo/gsc/callback"
            /></el-form-item>
          </template>
          <el-divider content-position="left"
            ><i class="fas fa-rainbow me-1" style="color: #ff6b6b"></i
            >彩虹聚合登录</el-divider
          >
          <el-form-item label="启用彩虹登录"
            ><el-switch v-model="config.rainbow_login"
          /></el-form-item>
          <template v-if="config.rainbow_login">
            <el-form-item label="AppID"
              ><el-input v-model="config.rainbow_app_id"
            /></el-form-item>
            <el-form-item label="AppKey"
              ><el-input
                v-model="config.rainbow_app_key"
                type="password"
                show-password
            /></el-form-item>
            <el-form-item label="回调地址"
              ><el-input v-model="config.rainbow_callback_url"
            /></el-form-item>
          </template>
        </template>

        <!-- 微信扫码 -->
        <template v-if="activeTab === 'wechat'">
          <el-form-item label="启用微信扫码"
            ><el-switch v-model="config.wechat_login"
          /></el-form-item>
          <el-form-item label="AppID"
            ><el-input v-model="config.wechat_app_id"
          /></el-form-item>
          <el-form-item label="AppSecret"
            ><el-input
              v-model="config.wechat_app_secret"
              type="password"
              show-password
          /></el-form-item>
          <el-form-item label="回调地址"
            ><el-input v-model="config.wechat_callback_url"
          /></el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="showConfigDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig"
          ><i class="fas fa-save me-1"></i>保存配置</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import api from "@/api";
import { ElMessage } from "element-plus";

const activeTab = ref("register");
const showConfigDialog = ref(false);
const config = ref({
  allow_register: true,
  require_phone: false,
  require_email: false,
  default_role: "user",
  allow_guest: true,
  enable_captcha: false,
  enable_login_limit: false,
  sms_provider: "aliyun",
  sms_aliyun_key: "",
  sms_aliyun_secret: "",
  sms_aliyun_sign: "",
  sms_aliyun_template: "",
  sms_smsbao_user: "",
  sms_smsbao_pass: "",
  smtp_host: "",
  smtp_port: "465",
  smtp_encryption: "ssl",
  smtp_username: "",
  smtp_password: "",
  from_email: "",
  from_name: "",
  wechat_login: false,
  wechat_app_id: "",
  wechat_app_secret: "",
  wechat_callback_url: "",
  google_login: false,
  google_client_id: "",
  google_client_secret: "",
  google_gsc_callback_url: "",
  rainbow_login: false,
  rainbow_app_id: "",
  rainbow_app_key: "",
  rainbow_callback_url: "",
});
const loading = ref(false);
const saving = ref(false);
const testingEmail = ref(false);
const userStats = reactive({
  totalUsers: "-",
  todayUsers: "-",
  activeUsers: "-",
  loginMethods: "-",
});

const dialogTitles = {
  register: "注册设置",
  sms: "短信验证配置",
  email: "邮件服务配置",
  oauth: "聚合登录配置",
  wechat: "微信扫码登录配置",
};

onMounted(() => {
  loadConfig();
  loadStats();
});

async function loadConfig() {
  loading.value = true;
  try {
    const res = await api.get("/admin/auth-config");
    const raw = res.data?.data || res.data || {};
    if (raw && typeof raw === "object")
      config.value = { ...config.value, ...raw };
  } catch {}
  loading.value = false;
}

async function loadStats() {
  try {
    const res = await api.get("/admin/auth-config/statistics");
    if (res.data) {
      userStats.totalUsers = res.data.total_users || 0;
      userStats.todayUsers = res.data.today_users || 0;
      userStats.activeUsers = res.data.active_users || 0;
      userStats.loginMethods = res.data.login_methods || 0;
    }
  } catch {
    try {
      const res = await api.get("/admin/users", { params: { pageSize: 1 } });
      userStats.totalUsers = res.data?.total || 0;
    } catch {}
  }
}

async function saveConfig() {
  saving.value = true;
  try {
    await api.post("/admin/auth-config", config.value);
    ElMessage.success("保存成功");
    showConfigDialog.value = false;
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || "保存失败");
  }
  saving.value = false;
}

async function testEmail() {
  testingEmail.value = true;
  try {
    const res = await api.post("/admin/auth-config/test-email", config.value);
    ElMessage.success(res.data?.message || "测试邮件已发送");
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || "发送失败");
  }
  testingEmail.value = false;
}
</script>

<style scoped>
.page-header {
  margin-bottom: 20px;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
}
.card-container {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 20px;
  color: #333;
  display: flex;
  align-items: center;
}
.form-help {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.auth-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
.auth-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}
.auth-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}
.auth-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.auth-card-header h5 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.auth-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
  flex-shrink: 0;
}
.auth-icon.bg-primary {
  background: #2f80ed;
}
.auth-icon.bg-success {
  background: #27ae60;
}
.auth-icon.bg-info {
  background: #2d9cdb;
}
.auth-icon.bg-wechat {
  background: #07c160;
}
.auth-desc {
  color: #666;
  font-size: 13px;
  margin-bottom: 12px;
}

.user-stats-row {
  display: flex;
  text-align: center;
  gap: 0;
}
.user-stat-item {
  flex: 1;
  padding: 16px;
  border-right: 1px solid #eee;
}
.user-stat-item:last-child {
  border-right: none;
}
.user-stat-value {
  font-size: 24px;
  font-weight: 700;
}
.user-stat-label {
  font-size: 13px;
  color: #999;
  margin-top: 4px;
}

.security-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.security-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: #f8f9fa;
}
.security-item .fw-bold {
  font-size: 14px;
  margin-bottom: 2px;
}

.d-flex {
  display: flex;
}
.gap-2 {
  gap: 8px;
}
.mt-3 {
  margin-top: 16px;
}
.mt-4 {
  margin-top: 24px;
}
.mb-0 {
  margin-bottom: 0;
}
.me-1 {
  margin-right: 4px;
}
.me-2 {
  margin-right: 8px;
}
.text-muted {
  color: #999;
}
.text-primary {
  color: #2f80ed;
}
.text-success {
  color: #27ae60;
}
.text-info {
  color: #2d9cdb;
}
.text-warning {
  color: #f2994a;
}
.fw-bold {
  font-weight: 600;
}
.small {
  font-size: 0.85rem;
}
.align-items-center {
  align-items: center;
}
.justify-content-between {
  justify-content: space-between;
}

@media (max-width: 768px) {
  .auth-grid {
    grid-template-columns: 1fr;
  }
  .security-grid {
    grid-template-columns: 1fr;
  }
  .user-stats-row {
    flex-wrap: wrap;
  }
  .user-stat-item {
    min-width: 50%;
    border-right: none;
  }
}
</style>
