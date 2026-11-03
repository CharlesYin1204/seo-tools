<template>
  <section class="authority">
    <header>
      <div><small>SEO AI OPERATIONS</small><h2>外链权威配置</h2><p>配置 Ahrefs Domain Rating API，站点扫描按刷新周期读取真实外链权威数据。</p></div>
      <el-button type="primary" :loading="saving" @click="save">保存配置</el-button>
    </header>
    <el-form label-position="top" class="form" @submit.prevent>
      <el-form-item label="启用 Ahrefs"><el-switch v-model="form.enabled" /></el-form-item>
      <el-form-item label="API 地址"><el-input v-model="form.endpoint" placeholder="https://api.ahrefs.com/v3/public/domain-rating-free" /></el-form-item>
      <el-form-item label="API Token">
        <el-input v-model="form.token" type="password" show-password :placeholder="form.token_configured ? 'Token 已加密保存，留空保持不变' : '输入 Ahrefs API Token'" />
        <span class="field-state" :class="{ configured: form.token_configured }">{{ form.token_configured ? '已配置' : '未配置' }}</span>
      </el-form-item>
      <el-form-item label="刷新周期（小时）"><el-input-number v-model="form.refresh_hours" :min="1" :max="168" /></el-form-item>
      <div class="test-row">
        <el-input v-model="testTarget" placeholder="输入真实域名，例如 example.com" @keyup.enter="testConnection" />
        <el-button :loading="testing" @click="testConnection">测试连接</el-button>
      </div>
      <el-alert v-if="testResult" type="success" :closable="false" show-icon :title="`${testResult.target} 的 Domain Rating 为 ${testResult.domain_rating}`" />
      <el-alert v-else type="info" :closable="false" title="测试会直接调用 Ahrefs 官方 API；失败或未配置时不会生成或缓存权威分。" />
    </el-form>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const saving = ref(false)
const testing = ref(false)
const testTarget = ref('')
const testResult = ref(null)
const form = reactive({ enabled: false, endpoint: '', token: '', refresh_hours: 24, token_configured: false })

async function load() { const response = await api.get('/admin/seo-operations/authority-config'); Object.assign(form, response.data || {}) }
async function save() {
  saving.value = true
  try { const response = await api.put('/admin/seo-operations/authority-config', form); Object.assign(form, response.data || {}, { token: '' }); ElMessage.success('外链权威配置已保存') }
  finally { saving.value = false }
}
async function testConnection() {
  testing.value = true; testResult.value = null
  try { const response = await api.post('/admin/seo-operations/authority-config/test', { endpoint: form.endpoint, token: form.token, target: testTarget.value }); testResult.value = response.data; ElMessage.success('Ahrefs API 连接成功') }
  finally { testing.value = false }
}
onMounted(load)
</script>

<style scoped>
.authority{max-width:900px;margin:auto}.authority header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:24px}.authority small{color:#1677ff;font-weight:700}.authority h2{margin:5px 0}.authority p{color:#667085;margin:0}.form{max-width:680px}.field-state{display:block;margin-top:6px;color:#98a2b3;font-size:13px}.field-state.configured{color:#067647}.test-row{display:grid;grid-template-columns:1fr auto;gap:10px;margin:10px 0 16px}@media(max-width:640px){.authority header{display:block}.authority header .el-button{margin-top:16px}.test-row{grid-template-columns:1fr}}
</style>
