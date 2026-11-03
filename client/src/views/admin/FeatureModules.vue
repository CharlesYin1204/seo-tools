<template>
  <div class="feature-modules-page">
    <div class="page-header">
      <h3 class="page-title">会员中心设置</h3>
      <p class="text-muted">管理功能模块、套餐价格和试用设置</p>
    </div>

    <!-- 试用天数设置 -->
    <el-card class="mb-4">
      <template #header><span><i class="fas fa-clock"></i> 试用设置</span></template>
      <el-form :inline="true" @submit.prevent="saveTrialDays">
        <el-form-item label="默认试用天数">
          <el-input-number v-model="trialDays" :min="0" :max="365" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveTrialDays" :loading="savingTrial">保存试用设置</el-button>
        </el-form-item>
      </el-form>
      <p class="text-muted" style="margin-top:8px;font-size:13px;">新用户首次进入功能模块时自动获得试用期。设为0则不提供试用。</p>
    </el-card>

    <!-- 功能模块列表 -->
    <el-card v-for="mod in modules" :key="mod.id" class="mb-4">
      <template #header>
        <div class="d-flex justify-content-between align-items-center">
          <span><i :class="mod.icon"></i> {{ mod.name }} <el-tag size="small" :type="mod.is_active ? 'success' : 'info'">{{ mod.is_active ? '启用' : '停用' }}</el-tag></span>
          <div>
            <el-button size="small" @click="editModule(mod)"><i class="fas fa-edit"></i> 编辑</el-button>
          </div>
        </div>
      </template>

      <el-descriptions :column="3" border size="small" class="mb-3">
        <el-descriptions-item label="标识(slug)">{{ mod.slug }}</el-descriptions-item>
        <el-descriptions-item label="图标">{{ mod.icon }}</el-descriptions-item>
        <el-descriptions-item label="描述">{{ mod.description || '-' }}</el-descriptions-item>
      </el-descriptions>

      <h5 class="mb-2">套餐价格</h5>
      <el-table :data="mod.plans" border size="small" style="width:100%">
        <el-table-column prop="duration_months" label="时长(月)" width="100">
          <template #default="{row}">
            <el-input-number v-model="row.duration_months" :min="1" :max="36" size="small" controls-position="right" />
          </template>
        </el-table-column>
        <el-table-column prop="price" label="价格(元)" width="130">
          <template #default="{row}">
            <el-input-number v-model="row.price" :min="0" :precision="2" size="small" controls-position="right" />
          </template>
        </el-table-column>
        <el-table-column prop="original_price" label="原价(划线价)" width="130">
          <template #default="{row}">
            <el-input-number v-model="row.original_price" :min="0" :precision="2" size="small" controls-position="right" />
          </template>
        </el-table-column>
        <el-table-column prop="label" label="标签" width="120">
          <template #default="{row}">
            <el-input v-model="row.label" size="small" placeholder="如：推荐" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{$index}">
            <el-button size="small" type="danger" link @click="mod.plans.splice($index, 1)"><i class="fas fa-trash"></i></el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="mt-2">
        <el-button size="small" @click="mod.plans.push({ duration_months: 1, price: 0, original_price: null, label: '', is_active: true })"><i class="fas fa-plus"></i> 添加套餐</el-button>
        <el-button size="small" type="primary" @click="savePlans(mod)" :loading="mod._saving">保存套餐</el-button>
      </div>
    </el-card>

    <!-- 新增功能模块 -->
    <el-card>
      <template #header><span><i class="fas fa-plus-circle"></i> 新增功能模块</span></template>
      <el-button type="primary" @click="editModule(null)"><i class="fas fa-plus"></i> 添加新功能模块</el-button>
      <p class="text-muted mt-2" style="font-size:13px;">可扩展更多功能模块，每个模块支持独立定价和卡密激活。</p>
    </el-card>

    <!-- 模块编辑弹窗 -->
    <el-dialog v-model="showModuleDialog" :title="editingModule?.id ? '编辑功能模块' : '新增功能模块'" width="520px">
      <el-form label-width="90px">
        <el-form-item label="模块名称">
          <el-input v-model="moduleForm.name" placeholder="如：快速内容检索" />
        </el-form-item>
        <el-form-item label="标识(slug)">
          <el-input v-model="moduleForm.slug" placeholder="如：quick-search" :disabled="!!editingModule?.id" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="moduleForm.icon" placeholder="如：fas fa-search" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="moduleForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="moduleForm.is_active" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showModuleDialog = false">取消</el-button>
        <el-button type="primary" @click="saveModule" :loading="savingModule">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const modules = ref([])
const trialDays = ref(7)
const savingTrial = ref(false)
const showModuleDialog = ref(false)
const editingModule = ref(null)
const savingModule = ref(false)
const moduleForm = ref({ name: '', slug: '', description: '', icon: 'fas fa-cube', is_active: true })

onMounted(() => { loadData() })

async function loadData() {
  try {
    const res = await api.get('/admin/feature-modules')
    const data = res.data?.data || res.data || {}
    modules.value = (data.modules || []).map(m => ({ ...m, _saving: false }))
    trialDays.value = data.trialDays != null ? data.trialDays : 7
  } catch (e) {
    ElMessage.error('加载数据失败')
  }
}

async function saveTrialDays() {
  savingTrial.value = true
  try {
    await api.post('/admin/feature-modules/trial-days', { trial_days: trialDays.value })
    ElMessage.success('试用天数已保存')
  } catch { ElMessage.error('保存失败') }
  savingTrial.value = false
}

function editModule(mod) {
  editingModule.value = mod
  moduleForm.value = mod
    ? { name: mod.name, slug: mod.slug, description: mod.description, icon: mod.icon, is_active: !!mod.is_active, id: mod.id }
    : { name: '', slug: '', description: '', icon: 'fas fa-cube', is_active: true }
  showModuleDialog.value = true
}

async function saveModule() {
  savingModule.value = true
  try {
    await api.post('/admin/feature-modules', moduleForm.value)
    ElMessage.success('保存成功')
    showModuleDialog.value = false
    loadData()
  } catch { ElMessage.error('保存失败') }
  savingModule.value = false
}

async function savePlans(mod) {
  mod._saving = true
  try {
    await api.post('/admin/feature-modules/plans', { module_id: mod.id, plans: mod.plans })
    ElMessage.success('套餐价格已保存')
    loadData()
  } catch { ElMessage.error('保存失败') }
  mod._saving = false
}
</script>
