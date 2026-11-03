<template>
  <div class="ai-config-page">
    <div class="toolbar">
      <select v-model="selectedRobotId" class="robot-select" @change="loadConfig">
        <option value="">选择微信账号</option>
        <option v-for="r in robots" :key="r.id" :value="r.id">{{ r.nickname || r.wxid || '未命名' }}</option>
      </select>
    </div>

    <div class="config-center">
      <!-- AI类型选择 -->
      <div class="config-card">
        <div class="config-card-header"><h5><i class="fas fa-brain"></i> AI自动回复配置</h5></div>
        <div class="config-card-body">
          <div class="ai-type-grid">
            <div v-for="t in aiTypes" :key="t.value" :class="['ai-type-card', { active: form.ai_type === t.value }]" @click="form.ai_type = t.value">
              <i :class="t.icon" :style="{ color: t.color }"></i>
              <span>{{ t.label }}</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">API Key <span class="required">*</span></label>
            <input v-model="form.api_key" type="password" class="form-input" placeholder="输入API密钥">
          </div>
          <div class="form-group">
            <label class="form-label">模型</label>
            <input v-model="form.model" class="form-input" placeholder="如: gpt-4o, claude-3-opus 等">
          </div>
          <div class="form-group">
            <label class="form-label">系统提示词</label>
            <textarea v-model="form.system_prompt" class="form-input" rows="4" placeholder="设定AI的角色和行为规则..."></textarea>
          </div>

          <!-- 开关 -->
          <div class="enable-row">
            <span>启用AI自动回复</span>
            <label class="switch">
              <input type="checkbox" v-model="form.is_enabled">
              <span class="slider"></span>
            </label>
          </div>

          <div class="form-actions">
            <button class="btn-test" @click="handleTest"><i class="fas fa-flask"></i> 测试连接</button>
            <button class="btn-save" :disabled="saving" @click="handleSave">
              <i :class="saving ? 'fas fa-spinner fa-spin' : 'fas fa-save'"></i> 保存配置
            </button>
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

const selectedRobotId = ref('')
const robots = ref([])
const saving = ref(false)
const form = reactive({ ai_type: 'openai', api_key: '', model: '', system_prompt: '', is_enabled: false })

const aiTypes = [
  { value: 'openai', label: 'OpenAI', icon: 'fas fa-robot', color: '#10A37F' },
  { value: 'claude', label: 'Claude', icon: 'fas fa-brain', color: '#D97706' },
  { value: 'deepseek', label: 'DeepSeek', icon: 'fas fa-microchip', color: '#4F46E5' },
  { value: 'custom', label: '自定义', icon: 'fas fa-cog', color: '#666' },
]

async function loadRobots() {
  try {
    const res = await wechatRobotApi.getAccounts()
    robots.value = res?.data?.data || res?.data || []
    if (robots.value.length && !selectedRobotId.value) selectedRobotId.value = robots.value[0].id
  } catch { robots.value = [] }
}

async function loadConfig() {
  if (!selectedRobotId.value) return
  try {
    const res = await wechatRobotApi.getAiConfig(selectedRobotId.value)
    const d = res?.data?.data || res?.data || {}
    form.ai_type = d.ai_type || 'openai'
    form.api_key = d.api_key || ''
    form.model = d.model || ''
    form.system_prompt = d.system_prompt || ''
    form.is_enabled = !!d.is_enabled
  } catch {}
}

async function handleSave() {
  if (!selectedRobotId.value) { ElMessage.warning('请先选择微信账号'); return }
  saving.value = true
  try {
    await wechatRobotApi.saveAiConfig(selectedRobotId.value, form)
    ElMessage.success('配置保存成功')
  } catch (err) { ElMessage.error(err?.response?.data?.message || '保存失败') }
  saving.value = false
}

function handleTest() { ElMessage.info('测试连接功能开发中') }

onMounted(() => loadRobots().then(loadConfig))
</script>

<style scoped>
.ai-config-page { max-width: 800px; margin: 0; }
.toolbar { margin-bottom: 20px; }
.robot-select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; min-width: 200px; }
.config-card { background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; }
.config-card-header { background: #F7F7F7; padding: 20px 24px; border-bottom: 1px solid #E5E5E5; }
.config-card-header h5 { margin: 0; font-weight: 600; color: #191919; display: flex; align-items: center; gap: 8px; }
.config-card-body { padding: 24px; }

.ai-type-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
.ai-type-card { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px; border: 2px solid #eee; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
.ai-type-card:hover { border-color: #07C160; }
.ai-type-card.active { border-color: #07C160; background: rgba(7,193,96,0.05); }
.ai-type-card i { font-size: 24px; }
.ai-type-card span { font-size: 0.85rem; font-weight: 500; }

.form-group { margin-bottom: 20px; }
.form-label { display: block; font-weight: 600; font-size: 0.9rem; margin-bottom: 6px; color: #333; }
.required { color: #E53935; }
.form-input { width: 100%; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; outline: none; box-sizing: border-box; }
.form-input:focus { border-color: #07C160; }
textarea.form-input { resize: none; }

.enable-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-top: 1px solid #f0f0f0; margin-top: 16px; font-weight: 500; }
.switch { position: relative; display: inline-block; width: 44px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #ccc; border-radius: 24px; transition: 0.3s; }
.slider:before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.3s; }
input:checked + .slider { background: #07C160; }
input:checked + .slider:before { transform: translateX(20px); }

.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
.btn-test { background: #fff; border: 1px solid #07C160; color: #07C160; padding: 10px 20px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
.btn-test:hover { background: rgba(7,193,96,0.05); }
.btn-save { background: #07C160; border: none; color: #fff; padding: 10px 24px; border-radius: 10px; cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 6px; }
.btn-save:hover { background: #06AD56; }
.btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

@media (max-width: 767px) { .ai-type-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
