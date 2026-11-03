<template>
  <div>
    <!-- 页面头部 -->
    <div class="page-header">
      <h3 class="page-title">AI模型管理</h3>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card green">
        <div class="stat-value">{{ activeModels.length }}</div>
        <div class="stat-icon"><i class="fas fa-robot"></i></div>
        <div class="stat-label"><i class="fas fa-check-circle me-1"></i>已激活模型</div>
        <div class="stat-sub" v-if="activeModels.length > 0">✓ 运行正常</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-value">{{ models.length }}</div>
        <div class="stat-icon"><i class="fas fa-cubes"></i></div>
        <div class="stat-label"><i class="fas fa-th-large me-1"></i>可用模型</div>
        <div class="stat-sub">+ 可配置</div>
      </div>
      <div class="stat-card teal">
        <div class="stat-value">0</div>
        <div class="stat-icon"><i class="fas fa-book"></i></div>
        <div class="stat-label"><i class="fas fa-database me-1"></i>已激活知识库</div>
        <div class="stat-sub">已连接</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-value">{{ totalUsage.toLocaleString() }}</div>
        <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
        <div class="stat-label"><i class="fas fa-fire me-1"></i>总调用次数</div>
        <div class="stat-sub">↑ 本月统计</div>
      </div>
    </div>

    <!-- 模型管理工具 -->
    <div class="card-container mb-4" v-loading="loading">
      <div class="tools-header">
        <h5 class="section-title"><i class="fas fa-cogs me-2"></i>模型管理工具</h5>
        <div class="tools-actions">
          <el-button size="small" @click="loadData"><i class="fas fa-sync-alt me-1"></i>刷新</el-button>
          <el-button size="small" type="primary" @click="showForm(null)"><i class="fas fa-plus me-1"></i>新建模型</el-button>
        </div>
      </div>

      <div class="tool-cards">
        <div class="tool-card" @click="batchTest">
          <div class="tool-icon green"><i class="fas fa-vial"></i></div>
          <div class="tool-name">批量测试</div>
        </div>
        <div class="tool-card" @click="ElMessage.info('使用统计功能开发中')">
          <div class="tool-icon blue"><i class="fas fa-chart-bar"></i></div>
          <div class="tool-name">使用统计</div>
        </div>
        <div class="tool-card" @click="ElMessage.info('导出配置功能开发中')">
          <div class="tool-icon teal"><i class="fas fa-download"></i></div>
          <div class="tool-name">导出配置</div>
        </div>
        <div class="tool-card" @click="ElMessage.info('清理缓存功能开发中')">
          <div class="tool-icon red"><i class="fas fa-trash-alt"></i></div>
          <div class="tool-name">清理缓存</div>
        </div>
      </div>
    </div>

    <!-- 已激活AI模型 -->
    <div class="card-container">
      <div class="tools-header">
        <h5 class="section-title">
          <i class="fas fa-bolt me-2"></i>已激活AI模型
          <el-tag type="success" size="small" class="ms-2">{{ activeModels.length }}</el-tag>
        </h5>
        <div class="tools-actions">
          <el-button :type="modelFilter === 'all' ? 'primary' : ''" size="small" @click="modelFilter = 'all'">
            <i class="fas fa-th me-1"></i>全部 {{ models.length }}
          </el-button>
          <el-button :type="modelFilter === 'chat' ? 'success' : ''" size="small" @click="modelFilter = 'chat'">
            <i class="fas fa-comments me-1"></i>对话模型 {{ chatModels.length }}
          </el-button>
        </div>
      </div>

      <div class="model-grid">
        <div v-for="model in filteredModels" :key="model.id" class="model-card">
          <div class="model-card-top">
            <div class="model-icon-wrap">
              <img v-if="model.icon_url" :src="model.icon_url" class="model-icon-img" />
              <div v-else class="model-icon-default"><i class="fas fa-robot"></i></div>
            </div>
            <div class="model-info">
              <div class="model-name">{{ model.model_name }}</div>
              <div class="model-category">{{ model.model_provider || 'Custom' }} - {{ capitalize(model.model_type || 'Chat') }}</div>
            </div>
            <el-tag v-if="model.model_type === 'chat'" type="success" size="small">对话模型</el-tag>
            <el-tag v-else type="warning" size="small">{{ model.model_type }}</el-tag>
          </div>
          <div class="model-card-actions">
            <el-button :type="model.is_enabled ? 'danger' : 'success'" size="small" plain
                       @click="toggleModel(model)">
              {{ model.is_enabled ? '停用' : '启用' }}
            </el-button>
            <el-button size="small" plain @click="showForm(model)">配置</el-button>
            <el-button size="small" plain @click="testModel(model.id)" :loading="testing === model.id">
              <i class="fas fa-flask me-1"></i>测试
            </el-button>
            <el-button size="small" type="danger" plain @click="deleteModel(model.id)">删除</el-button>
          </div>
          <div class="model-usage">
            <i class="fas fa-chart-line me-1"></i>调用次数: {{ (model.usage_count || 0).toLocaleString() }} 次
          </div>
        </div>
      </div>

      <div v-if="filteredModels.length === 0" class="empty-state">
        <i class="fas fa-robot"></i>
        <p>暂无{{ modelFilter === 'chat' ? '对话' : '' }}模型</p>
      </div>
    </div>

    <!-- 新建/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑模型' : '添加模型'" width="550px">
      <el-form :model="form" label-position="top">
        <el-form-item label="模型名称"><el-input v-model="form.model_name" placeholder="如: gpt-4o-mini" /></el-form-item>
        <el-form-item label="模型代码"><el-input v-model="form.model_code" placeholder="如: gpt-4o-mini" /></el-form-item>
        <el-form-item label="API地址"><el-input v-model="form.api_url" placeholder="如: https://api.openai.com/v1/chat/completions" /></el-form-item>
        <el-form-item label="API Key"><el-input v-model="form.api_key" type="password" show-password /></el-form-item>
        <el-form-item label="提供商"><el-input v-model="form.model_provider" placeholder="如: OpenAI, Custom" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.model_type" style="width:100%">
            <el-option label="聊天(Chat)" value="chat" />
            <el-option label="补全(Completion)" value="completion" />
            <el-option label="图片(Image)" value="image" />
            <el-option label="视频(Video)" value="video" />
            <el-option label="向量(Embedding)" value="embedding" />
            <el-option label="重排(Rerank)" value="rerank" />
            <el-option label="语音(TTS)" value="tts" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.is_active" :active-value="1" :inactive-value="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveModel"><i class="fas fa-save me-1"></i>保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const models = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const testing = ref(null)
const modelFilter = ref('all')
const form = reactive({
  id: null, model_name: '', model_code: '', api_url: '', api_key: '',
  model_provider: '', model_type: 'chat', description: '', is_active: 1
})

const activeModels = computed(() => models.value.filter(m => m.is_enabled || m.is_active))
const chatModels = computed(() => models.value.filter(m => m.model_type === 'chat'))
const totalUsage = computed(() => models.value.reduce((sum, m) => sum + (m.usage_count || 0), 0))
const filteredModels = computed(() => {
  if (modelFilter.value === 'chat') return models.value.filter(m => m.model_type === 'chat')
  return models.value
})

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/admin/ai-models')
    models.value = Array.isArray(res.data) ? res.data : (res.data?.data || [])
  } catch {}
  loading.value = false
}

function showForm(row) {
  if (row) Object.assign(form, { ...row, is_active: row.is_enabled ?? row.is_active ?? 1 })
  else Object.assign(form, { id: null, model_name: '', model_code: '', api_url: '', api_key: '', model_provider: '', model_type: 'chat', description: '', is_active: 1 })
  dialogVisible.value = true
}

async function saveModel() {
  try {
    await api.post('/admin/ai-models', form)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadData()
  } catch {}
}

async function deleteModel(id) {
  try {
    await ElMessageBox.confirm('确定删除该模型？', '确认', { type: 'warning' })
    await api.delete(`/admin/ai-models/${id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}

async function testModel(id) {
  testing.value = id
  try {
    await api.post(`/admin/ai-models/${id}/test`)
    ElMessage.success('模型测试成功')
  } catch { ElMessage.error('模型测试失败') }
  testing.value = null
}

async function toggleModel(model) {
  try {
    const newStatus = model.is_enabled ? 0 : 1
    await api.post('/admin/ai-models', { ...model, is_active: newStatus, is_enabled: newStatus })
    ElMessage.success(newStatus ? '已启用' : '已停用')
    loadData()
  } catch {}
}

async function batchTest() {
  if (!models.value.length) return ElMessage.warning('暂无模型')
  for (const m of activeModels.value) {
    testing.value = m.id
    try {
      await api.post(`/admin/ai-models/${m.id}/test`)
    } catch {}
  }
  testing.value = null
  ElMessage.success('批量测试完成')
}
</script>

<style scoped>
.page-header { margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 600; margin: 0; }

.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card {
  border-radius: 12px; padding: 20px; color: white; position: relative; overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.stat-card.green { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }
.stat-card.blue { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
.stat-card.teal { background: linear-gradient(135deg, #38b2ac 0%, #4fd1c5 100%); }
.stat-card.orange { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
.stat-value { font-size: 2rem; font-weight: 700; line-height: 1.2; }
.stat-icon { position: absolute; right: 16px; top: 16px; font-size: 2rem; opacity: 0.3; }
.stat-label { margin-top: 4px; font-size: 14px; opacity: 0.95; }
.stat-sub { font-size: 12px; opacity: 0.8; margin-top: 4px; }

.card-container { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.mb-4 { margin-bottom: 24px; }
.section-title { font-size: 16px; font-weight: 600; margin: 0; color: #333; display: flex; align-items: center; }
.tools-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.tools-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.tool-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.tool-card {
  border: 2px solid #f0f0f0; border-radius: 12px; padding: 24px; text-align: center;
  cursor: pointer; transition: all 0.3s ease;
}
.tool-card:hover { border-color: #4facfe; transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
.tool-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 20px; color: white; }
.tool-icon.green { background: linear-gradient(135deg, #43e97b, #38f9d7); }
.tool-icon.blue { background: linear-gradient(135deg, #4facfe, #00f2fe); }
.tool-icon.teal { background: linear-gradient(135deg, #38b2ac, #4fd1c5); }
.tool-icon.red { background: linear-gradient(135deg, #f5576c, #f093fb); }
.tool-name { font-size: 14px; font-weight: 500; color: #333; }

.model-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; }
.model-card {
  border: 1px solid #eee; border-radius: 12px; padding: 16px;
  transition: all 0.3s ease;
}
.model-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-color: #ddd; }
.model-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.model-icon-wrap { flex-shrink: 0; }
.model-icon-img { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; }
.model-icon-default { width: 40px; height: 40px; border-radius: 8px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; display: flex; align-items: center; justify-content: center; font-size: 18px; }
.model-info { flex: 1; min-width: 0; }
.model-name { font-size: 15px; font-weight: 600; color: #333; }
.model-category { font-size: 12px; color: #999; }
.model-card-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.model-usage { font-size: 12px; color: #999; padding-top: 8px; border-top: 1px solid #f0f0f0; }

.empty-state { text-align: center; padding: 60px 20px; color: #ccc; }
.empty-state i { font-size: 48px; margin-bottom: 12px; }
.empty-state p { font-size: 14px; }

.me-1 { margin-right: 4px; }
.me-2 { margin-right: 8px; }
.ms-2 { margin-left: 8px; }

@media (max-width: 768px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .tool-cards { grid-template-columns: repeat(2, 1fr); }
  .model-grid { grid-template-columns: 1fr; }
}
</style>
