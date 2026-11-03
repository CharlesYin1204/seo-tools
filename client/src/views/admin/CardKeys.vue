<template>
  <div class="card-keys-page">
    <div class="page-header">
      <h3 class="page-title">卡密管理</h3>
      <p class="text-muted">批量生成和管理功能卡密、余额卡密</p>
    </div>

    <!-- 统计卡片 -->
    <div class="row g-3 mb-4">
      <div class="col-md-2 col-6">
        <el-card shadow="never"><el-statistic title="总卡密" :value="stats.total || 0" /></el-card>
      </div>
      <div class="col-md-2 col-6">
        <el-card shadow="never"><el-statistic title="未使用" :value="stats.unused_count || 0" /></el-card>
      </div>
      <div class="col-md-2 col-6">
        <el-card shadow="never"><el-statistic title="已使用" :value="stats.used_count || 0" /></el-card>
      </div>
      <div class="col-md-2 col-6">
        <el-card shadow="never"><el-statistic title="功能卡密" :value="stats.feature_count || 0" /></el-card>
      </div>
      <div class="col-md-2 col-6">
        <el-card shadow="never"><el-statistic title="余额卡密" :value="stats.balance_count || 0" /></el-card>
      </div>
    </div>

    <!-- 生成卡密 -->
    <el-card class="mb-4">
      <template #header><span>批量生成卡密</span></template>
      <el-tabs v-model="genTab">
        <el-tab-pane label="功能卡密" name="feature">
          <el-form :inline="true" @submit.prevent="generateFeatureKeys">
            <el-form-item label="功能模块">
              <el-select v-model="featureForm.module_id" placeholder="选择模块" style="width:180px">
                <el-option v-for="m in featureModules" :key="m.id" :label="m.name" :value="m.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="时长(月)">
              <el-input-number v-model="featureForm.duration_months" :min="1" :max="36" />
            </el-form-item>
            <el-form-item label="数量">
              <el-input-number v-model="featureForm.count" :min="1" :max="500" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="generateFeatureKeys" :loading="generating">生成功能卡密</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="余额卡密" name="balance">
          <el-form :inline="true" @submit.prevent="generateBalanceKeys">
            <el-form-item label="面额">
              <el-select v-model="balanceForm.balance_amount" placeholder="选择面额" style="width:140px">
                <el-option :value="50" label="¥50" />
                <el-option :value="100" label="¥100" />
                <el-option :value="200" label="¥200" />
                <el-option :value="500" label="¥500" />
              </el-select>
            </el-form-item>
            <el-form-item label="数量">
              <el-input-number v-model="balanceForm.count" :min="1" :max="500" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="generateBalanceKeys" :loading="generating">生成余额卡密</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 卡密列表 -->
    <el-card>
      <template #header>
        <div class="d-flex justify-content-between align-items-center">
          <span>卡密列表</span>
          <div class="d-flex gap-2 flex-wrap">
            <el-select v-model="filter.type" clearable placeholder="类型" size="small" style="width:110px" @change="loadCardKeys">
              <el-option value="feature" label="功能卡密" />
              <el-option value="balance" label="余额卡密" />
            </el-select>
            <el-select v-model="filter.status" clearable placeholder="状态" size="small" style="width:110px" @change="loadCardKeys">
              <el-option value="unused" label="未使用" />
              <el-option value="used" label="已使用" />
              <el-option value="disabled" label="已停用" />
            </el-select>
            <el-input v-model="filter.keyword" size="small" clearable placeholder="搜索卡密/用户" style="width:160px" @clear="loadCardKeys" @keyup.enter="loadCardKeys" />
          </div>
        </div>
      </template>

      <el-table :data="cardKeys" border size="small" v-loading="loading" style="width:100%">
        <el-table-column prop="card_code" label="卡密码" width="200">
          <template #default="{row}"><code>{{ row.card_code }}</code></template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="90">
          <template #default="{row}">
            <el-tag :type="row.type === 'feature' ? 'primary' : 'warning'" size="small">{{ row.type === 'feature' ? '功能' : '余额' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="内容" width="160">
          <template #default="{row}">
            <template v-if="row.type === 'feature'">{{ row.module_name }} / {{ row.duration_months }}个月</template>
            <template v-else>¥{{ row.balance_amount }}</template>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}">
            <el-tag :type="row.status === 'unused' ? 'success' : row.status === 'used' ? 'info' : 'danger'" size="small">
              {{ row.status === 'unused' ? '未使用' : row.status === 'used' ? '已使用' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="兑换用户" width="140">
          <template #default="{row}">{{ row.redeemed_display_name || row.redeemed_username || '-' }}</template>
        </el-table-column>
        <el-table-column prop="redeemed_at" label="兑换时间" width="160" />
        <el-table-column prop="batch_no" label="批次" width="140" />
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{row}">
            <el-button v-if="row.status === 'unused'" size="small" type="danger" link @click="disableKey(row)">停用</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-if="total > 0" class="mt-3" background layout="total, prev, pager, next" :total="total" :page-size="pageSize" v-model:current-page="page" @current-change="loadCardKeys" />
    </el-card>

    <!-- 生成结果弹窗 -->
    <el-dialog v-model="showResult" title="卡密生成成功" width="520px">
      <p>批次号：<strong>{{ resultBatchNo }}</strong>，共生成 <strong>{{ resultCodes.length }}</strong> 张卡密</p>
      <el-input type="textarea" :value="resultCodes.join('\n')" :rows="10" readonly />
      <template #footer>
        <el-button @click="copyAllCodes">复制全部卡密</el-button>
        <el-button type="primary" @click="showResult = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const stats = ref({})
const cardKeys = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const generating = ref(false)
const genTab = ref('feature')
const filter = ref({ type: '', status: '', keyword: '' })
const featureModules = ref([])
const featureForm = ref({ module_id: null, duration_months: 1, count: 10 })
const balanceForm = ref({ balance_amount: 100, count: 10 })
const showResult = ref(false)
const resultCodes = ref([])
const resultBatchNo = ref('')

onMounted(() => { loadAll() })

async function loadAll() {
  loadCardKeys()
  loadStats()
  loadModules()
}

async function loadStats() {
  try {
    const res = await api.get('/admin/card-keys/stats')
    stats.value = res.data?.data || res.data || {}
  } catch {}
}

async function loadModules() {
  try {
    const res = await api.get('/admin/feature-modules')
    const data = res.data?.data || res.data || {}
    featureModules.value = data.modules || []
  } catch {}
}

async function loadCardKeys() {
  loading.value = true
  try {
    const res = await api.get('/admin/card-keys', { params: { page: page.value, pageSize: pageSize.value, ...filter.value } })
    const data = res.data?.data || res.data || {}
    cardKeys.value = data.list || []
    total.value = data.total || 0
  } catch {}
  loading.value = false
}

async function generateFeatureKeys() {
  if (!featureForm.value.module_id) return ElMessage.warning('请选择功能模块')
  generating.value = true
  try {
    const res = await api.post('/admin/card-keys/generate-feature', featureForm.value)
    const data = res.data?.data || res.data || {}
    resultCodes.value = data.codes || []
    resultBatchNo.value = data.batch_no || ''
    showResult.value = true
    loadAll()
  } catch { ElMessage.error('生成失败') }
  generating.value = false
}

async function generateBalanceKeys() {
  generating.value = true
  try {
    const res = await api.post('/admin/card-keys/generate-balance', balanceForm.value)
    const data = res.data?.data || res.data || {}
    resultCodes.value = data.codes || []
    resultBatchNo.value = data.batch_no || ''
    showResult.value = true
    loadAll()
  } catch { ElMessage.error('生成失败') }
  generating.value = false
}

async function disableKey(row) {
  try {
    await api.put(`/admin/card-keys/${row.id}/disable`)
    ElMessage.success('已停用')
    loadCardKeys()
    loadStats()
  } catch { ElMessage.error('停用失败') }
}

function copyAllCodes() {
  navigator.clipboard?.writeText(resultCodes.value.join('\n'))
  ElMessage.success('已复制到剪贴板')
}
</script>
