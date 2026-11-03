<template>
  <div>
    <div class="page-header"><h3 class="page-title">微信机器人 API 配置</h3></div>
    <el-card v-loading="loading" class="card-container">
      <el-form :model="form" label-position="top" style="max-width: 700px">
        <el-form-item label="API名称">
          <el-input v-model="form.api_name" placeholder="例如: weiti / custom" />
        </el-form-item>
        <el-form-item label="API URL">
          <el-input v-model="form.api_url" placeholder="例如: https://wechatapi.course123.vip/api" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="form.api_key" type="password" :show-password="true" placeholder="API 访问密钥" />
        </el-form-item>
        <el-form-item label="API Secret">
          <el-input v-model="form.api_secret" type="password" :show-password="true" placeholder="API 密钥" />
        </el-form-item>
        <el-form-item label="API Token">
          <el-input v-model="form.api_token" type="password" :show-password="true" placeholder="访问令牌" />
        </el-form-item>
        <el-form-item label="Webhook URL">
          <el-input v-model="form.webhook_url" placeholder="消息回调地址（可选）" />
        </el-form-item>
        <el-form-item label="允许用户自定义配置">
          <el-switch v-model="form.allow_user_config" active-text="开启" inactive-text="关闭" />
        </el-form-item>
        <el-form-item label="每用户最大机器人数">
          <el-input-number v-model="form.max_robots_per_user" :min="0" :max="99" placeholder="每用户最多可创建的机器人数" style="width: 100%" />
        </el-form-item>
        <el-form-item label="是否需要会员">
          <el-switch v-model="form.require_membership" active-text="需要" inactive-text="不需要" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="saveSettings">保存设置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
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
  api_token: '',
  webhook_url: '',
  allow_user_config: false,
  max_robots_per_user: 1,
  require_membership: false,
})

onMounted(async () => {
  loading.value = true
  try {
    const res = await api.get('/admin/settings')
    const data = res.data || {}
    // 支持 wechat_robot_api_config 嵌套对象或平铺在根
    const config = data.wechat_robot_api_config
      ? (typeof data.wechat_robot_api_config === 'string'
          ? JSON.parse(data.wechat_robot_api_config || '{}')
          : data.wechat_robot_api_config)
      : data
    Object.assign(form, {
      api_name: config.api_name ?? '',
      api_url: config.api_url ?? '',
      api_key: config.api_key ?? '',
      api_secret: config.api_secret ?? '',
      api_token: config.api_token ?? '',
      webhook_url: config.webhook_url ?? '',
      allow_user_config: !!config.allow_user_config,
      max_robots_per_user: parseInt(config.max_robots_per_user, 10) || 1,
      require_membership: !!config.require_membership,
    })
  } catch (err) {
    ElMessage.error(err?.message || '加载配置失败')
  } finally {
    loading.value = false
  }
})

async function saveSettings() {
  saving.value = true
  try {
    await api.post('/admin/settings', {
      wechat_robot_api_config: { ...form },
    })
    ElMessage.success('保存成功')
  } catch (err) {
    ElMessage.error(err?.message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.card-container {
  padding: var(--space-md, 16px);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
