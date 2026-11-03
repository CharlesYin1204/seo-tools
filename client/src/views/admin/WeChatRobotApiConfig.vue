<template>
  <div class="wechat-robot-api-config">
    <div class="page-header">
      <i class="fas fa-plug page-header-icon"></i>
      <h3 class="page-title">微信机器人 API 配置</h3>
    </div>
    <el-card v-loading="loading" class="card-container" element-loading-text="加载中...">
      <el-form
        :model="form"
        label-position="top"
        style="max-width: 700px"
        @submit.prevent="saveSettings"
      >
        <el-form-item label="API名称" prop="api_name">
          <el-input
            v-model="form.api_name"
            placeholder="例如: weiti / custom"
            clearable
          />
        </el-form-item>
        <el-form-item label="API URL" prop="api_url">
          <el-input
            v-model="form.api_url"
            placeholder="例如: https://wechatapi.course123.vip/api"
            clearable
          />
          <div class="form-tip">请填写微信机器人API接口地址，参考文档：<a href="https://weiti.apifox.cn/" target="_blank" class="link-blue">https://weiti.apifox.cn/</a></div>
        </el-form-item>
        <el-form-item label="API Key" prop="api_key">
          <el-input
            v-model="form.api_key"
            type="password"
            show-password
            placeholder="API 访问密钥"
            autocomplete="new-password"
          />
        </el-form-item>
        <el-form-item label="API Secret" prop="api_secret">
          <el-input
            v-model="form.api_secret"
            type="password"
            show-password
            placeholder="API 密钥"
            autocomplete="new-password"
          />
        </el-form-item>
        <el-form-item label="Token" prop="token">
          <el-input
            v-model="form.token"
            placeholder="访问令牌（从API配置中获取）"
            clearable
          />
          <div class="form-tip">API Key 或 Token，用于接口鉴权</div>
        </el-form-item>
        <el-form-item label="Webhook URL" prop="webhook_url">
          <el-input
            v-model="form.webhook_url"
            placeholder="消息回调地址（可选）"
            clearable
          />
        </el-form-item>
        <el-form-item label="允许用户配置" prop="allow_user_config">
          <el-switch
            v-model="form.allow_user_config"
            active-text="开启"
            inactive-text="关闭"
          />
        </el-form-item>
        <el-form-item label="每用户最大机器人数" prop="max_robots_per_user">
          <el-input-number
            v-model="form.max_robots_per_user"
            :min="0"
            :max="99"
            placeholder="每用户最多可创建的机器人数"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="是否需要会员" prop="require_membership">
          <el-switch
            v-model="form.require_membership"
            active-text="需要"
            inactive-text="不需要"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="saveSettings">
            <i class="fas fa-save" style="margin-right: 6px"></i>
            保存设置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
/**
 * 微信机器人 API 配置
 * 管理端全局配置，用于控制微信机器人 API 接入参数及权限策略
 */
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const saving = ref(false)

const form = reactive({
  api_name: '',
  api_url: '',
  api_key: '',
  api_secret: '',
  token: '',
  webhook_url: '',
  allow_user_config: false,
  max_robots_per_user: 1,
  require_membership: false,
})

/** 加载配置 */
async function loadConfig() {
  loading.value = true
  try {
    const res = await api.get('/admin/wechat-robot/api-config')
    const data = res.data?.data ?? res.data ?? {}
    Object.assign(form, {
      api_name: data.api_name ?? '',
      api_url: data.api_url ?? '',
      api_key: data.api_key ?? '',
      api_secret: data.api_secret ?? '',
      token: data.token ?? '',
      webhook_url: data.webhook_url ?? '',
      allow_user_config: !!data.allow_user_config,
      max_robots_per_user: parseInt(data.max_robots_per_user, 10) || 1,
      require_membership: !!data.require_membership,
    })
  } catch (err) {
    ElMessage.error(err?.message || '加载配置失败')
    console.error('[WeChatRobotApiConfig] loadConfig error:', err)
  } finally {
    loading.value = false
  }
}

/** 保存配置 */
async function saveSettings() {
  saving.value = true
  try {
    await api.post('/admin/wechat-robot/api-config', { ...form })
    ElMessage.success('保存成功')
  } catch (err) {
    ElMessage.error(err?.message || '保存失败')
    console.error('[WeChatRobotApiConfig] saveSettings error:', err)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
/* 卡片容器 - 规范编号 CARD-001 */
.wechat-robot-api-config {
  padding: 0;
}

.page-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm, 8px);
  margin-bottom: var(--space-lg, 24px);
}

.page-header-icon {
  font-size: 20px;
  color: var(--primary-color, #2f80ed);
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.card-container {
  padding: var(--space-md, 16px);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}

.link-blue {
  color: #2F80ED;
  text-decoration: none;
}

.link-blue:hover {
  text-decoration: underline;
}
</style>
