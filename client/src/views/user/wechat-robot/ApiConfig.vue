<template>
  <div class="api-config-page">
    <div class="config-center">
      <!-- 配置表单卡片 -->
      <div class="config-card">
        <div class="config-card-header">
          <h5><i class="fas fa-plug"></i> API接口配置</h5>
        </div>
        <div class="config-card-body">
          <div class="form-group">
            <label class="form-label">API地址 <span class="required">*</span></label>
            <input v-model="form.api_url" type="url" class="form-input" placeholder="例如: https://wechatapi.course123.vip/api">
            <p class="form-hint">微信机器人API的完整地址</p>
          </div>
          <div class="form-group">
            <label class="form-label">Token</label>
            <input v-model="form.token" type="text" class="form-input" placeholder="访问令牌 (如果需要)">
            <p class="form-hint">API访问令牌</p>
          </div>
          <div class="form-group">
            <label class="form-label">消息回调URL</label>
            <input v-model="form.webhook_url" type="url" class="form-input" placeholder="例如: https://yourdomain.com/webhook/wechat-robot">
            <p class="form-hint">用于接收微信消息的回调地址（可选）</p>
          </div>
          <div class="form-actions">
            <button class="btn-cancel" @click="$router.push('/admin/wechat-robot')">取消</button>
            <button class="btn-save" :disabled="saving" @click="handleSave">
              <i :class="saving ? 'fas fa-spinner fa-spin' : 'fas fa-save'"></i> 保存配置
            </button>
          </div>
        </div>
      </div>

      <!-- 使用说明 -->
      <div class="config-card mt-card">
        <div class="config-card-header">
          <h5><i class="fas fa-info-circle"></i> 使用说明</h5>
        </div>
        <div class="config-card-body">
          <div class="step-item">
            <h6>1. 获取API凭证</h6>
            <p>访问 weiti API 官网注册账号，获取API地址和访问凭证。</p>
          </div>
          <div class="step-item">
            <h6>2. 配置API信息</h6>
            <p>在上方表单中填入您获取的API地址和凭证信息。</p>
          </div>
          <div class="step-item">
            <h6>3. 添加微信账号</h6>
            <p>配置完成后，返回微信机器人页面添加微信账号，扫码登录即可使用。</p>
          </div>
          <div class="step-item last">
            <h6>4. 开始使用</h6>
            <p>登录成功后，您可以管理好友、发送消息、管理群聊、发布朋友圈等。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { wechatRobotApi } from '@/api/modules/wechatRobot'

const saving = ref(false)
const form = reactive({ api_url: '', token: '', webhook_url: '' })

async function loadConfig() {
  try {
    const res = await wechatRobotApi.getApiConfig()
    const d = res?.data?.data || res?.data || {}
    form.api_url = d.api_url || ''
    form.token = d.token || ''
    form.webhook_url = d.webhook_url || ''
  } catch {}
}

async function handleSave() {
  if (!form.api_url) { ElMessage.warning('请输入API地址'); return }
  saving.value = true
  try {
    await wechatRobotApi.saveApiConfig({ api_name: 'custom', ...form })
    ElMessage.success('配置保存成功')
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || '保存失败')
  }
  saving.value = false
}

onMounted(loadConfig)
</script>

<style scoped>
.api-config-page { max-width: 800px; margin: 0; }
.config-center { }

.config-card {
  background: #fff; border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;
}
.config-card.mt-card { margin-top: 24px; }
.config-card-header {
  background: #F7F7F7; padding: 20px 24px; border-bottom: 1px solid #E5E5E5;
}
.config-card-header h5 {
  margin: 0; font-weight: 600; color: #191919; font-size: 1rem;
  display: flex; align-items: center; gap: 8px;
}
.config-card-body { padding: 24px; }

.form-group { margin-bottom: 24px; }
.form-label { display: block; font-weight: 600; font-size: 0.9rem; margin-bottom: 8px; color: #333; }
.required { color: #E53935; }
.form-input {
  width: 100%; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px;
  font-size: 0.9rem; transition: border-color 0.2s; outline: none;
  box-sizing: border-box;
}
.form-input:focus { border-color: #07C160; }
.form-hint { color: #888; font-size: 0.8rem; margin: 6px 0 0; }

.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
.btn-cancel {
  background: #f5f5f5; border: 1px solid #ddd; color: #666;
  padding: 10px 20px; border-radius: 10px; cursor: pointer; font-size: 0.9rem;
}
.btn-cancel:hover { background: #eee; }
.btn-save {
  background: #07C160; border: none; color: #fff;
  padding: 10px 24px; border-radius: 10px; cursor: pointer;
  font-weight: 500; font-size: 0.9rem; transition: all 0.3s;
  display: flex; align-items: center; gap: 6px;
}
.btn-save:hover { background: #06AD56; transform: translateY(-2px); }
.btn-save:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

.step-item { margin-bottom: 20px; }
.step-item.last { margin-bottom: 0; }
.step-item h6 { color: #07C160; font-weight: 600; font-size: 0.95rem; margin: 0 0 6px; }
.step-item p { color: #888; margin: 0; font-size: 0.88rem; }
</style>
