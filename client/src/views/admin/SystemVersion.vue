<template>
  <div>
    <div class="page-header">
      <h3 class="page-title"><i class="fas fa-code-branch me-2"></i>系统版本</h3>
      <el-button type="primary" size="small" @click="openVersionDialog()"><i class="fas fa-plus me-1"></i>添加版本</el-button>
    </div>

    <!-- 当前版本信息 -->
    <div class="card-container mb-4" v-loading="loading">
      <h5 class="section-title"><i class="fas fa-info-circle me-1"></i>当前版本信息</h5>
      <div class="version-info-grid">
        <div class="version-info-item">
          <div class="version-info-label">版本号</div>
          <div class="version-info-value version-badge">{{ current.version || '-' }}</div>
        </div>
        <div class="version-info-item">
          <div class="version-info-label">发布日期</div>
          <div class="version-info-value">{{ current.release_date || '-' }}</div>
        </div>
        <div class="version-info-item">
          <div class="version-info-label">环境</div>
          <div class="version-info-value">{{ current.environment || '-' }}</div>
        </div>
        <div class="version-info-item">
          <div class="version-info-label">Node.js</div>
          <div class="version-info-value">{{ current.node_version || '-' }}</div>
        </div>
        <div class="version-info-item">
          <div class="version-info-label">MySQL</div>
          <div class="version-info-value">{{ current.mysql_version || '-' }}</div>
        </div>
        <div class="version-info-item">
          <div class="version-info-label">运行状态</div>
          <div class="version-info-value"><span class="status-dot status-online"></span>正常运行</div>
        </div>
      </div>
      <div v-if="current.description" class="version-desc mt-3">{{ current.description }}</div>
    </div>

    <!-- 版本历史 -->
    <div class="card-container">
      <h5 class="section-title"><i class="fas fa-history me-1"></i>版本历史</h5>
      <el-timeline v-if="history.length">
        <el-timeline-item v-for="item in history" :key="item.id || item.version" :timestamp="item.release_date" placement="top">
          <div class="version-item">
            <div class="version-item-header">
              <el-tag size="small" type="primary">{{ item.version }}</el-tag>
              <span class="version-item-title">{{ item.title || '' }}</span>
              <div class="version-item-actions">
                <el-button size="small" text type="primary" @click="openVersionDialog(item)"><i class="fas fa-edit"></i></el-button>
                <el-button size="small" text type="danger" @click="deleteVersion(item)"><i class="fas fa-trash"></i></el-button>
              </div>
            </div>
            <div v-if="item.changelog" class="version-item-changelog">{{ item.changelog }}</div>
          </div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无版本历史" />
    </div>

    <!-- 版本编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="versionForm.id ? '编辑版本' : '添加版本'" width="500px" destroy-on-close>
      <el-form :model="versionForm" label-position="top">
        <el-form-item label="版本号" required>
          <el-input v-model="versionForm.version" placeholder="如：1.0.0" />
        </el-form-item>
        <el-form-item label="版本标题">
          <el-input v-model="versionForm.title" placeholder="版本标题" />
        </el-form-item>
        <el-form-item label="发布日期">
          <el-date-picker v-model="versionForm.release_date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%" />
        </el-form-item>
        <el-form-item label="更新日志">
          <el-input v-model="versionForm.changelog" type="textarea" :rows="6" placeholder="请输入更新日志..." />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="versionForm.description" type="textarea" :rows="3" placeholder="版本描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveVersion">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const current = reactive({ version: '', release_date: '', environment: '', node_version: '', mysql_version: '', description: '' })
const history = ref([])
const versionForm = reactive({ id: null, version: '', title: '', release_date: '', changelog: '', description: '' })

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/admin/system-version')
    if (res.data?.current) Object.assign(current, res.data.current)
    history.value = res.data?.history || []
  } catch (e) {
    console.error('加载版本信息失败:', e)
  }
  loading.value = false
}

function openVersionDialog(item = null) {
  if (item) {
    Object.assign(versionForm, { id: item.id, version: item.version, title: item.title || '', release_date: item.release_date || '', changelog: item.changelog || '', description: item.description || '' })
  } else {
    Object.assign(versionForm, { id: null, version: '', title: '', release_date: new Date().toISOString().split('T')[0], changelog: '', description: '' })
  }
  dialogVisible.value = true
}

async function saveVersion() {
  if (!versionForm.version) return ElMessage.warning('请输入版本号')
  submitting.value = true
  try {
    if (versionForm.id) {
      await api.put(`/admin/system-version/${versionForm.id}`, { ...versionForm })
    } else {
      await api.post('/admin/system-version', { ...versionForm })
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await loadData()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  }
  submitting.value = false
}

async function deleteVersion(item) {
  try {
    await ElMessageBox.confirm(`确定删除版本 ${item.version}？`, '确认', { type: 'warning' })
    await api.delete(`/admin/system-version/${item.id}`)
    ElMessage.success('删除成功')
    await loadData()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.message || '删除失败')
  }
}
</script>

<style scoped>
.page-header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.page-title { font-size: 20px; font-weight: 600; margin: 0; display: flex; align-items: center; }
.card-container {
  background: white; border-radius: 8px; padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.section-title { font-size: 16px; font-weight: 600; margin: 0 0 16px 0; color: #333; }
.mb-4 { margin-bottom: 24px; }
.mt-3 { margin-top: 16px; }
.me-1 { margin-right: 4px; }
.me-2 { margin-right: 8px; }

.version-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.version-info-item {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 14px 18px;
}
.version-info-label { font-size: 12px; color: #999; margin-bottom: 4px; }
.version-info-value { font-size: 18px; font-weight: bold; color: #333; }
.version-badge { color: #2F80ED; }
.version-desc { font-size: 14px; color: #666; line-height: 1.6; }

.status-dot {
  display: inline-block;
  width: 8px; height: 8px; border-radius: 50%;
  margin-right: 6px;
}
.status-online { background: #07c160; }

.version-item-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
}
.version-item-title { font-weight: 600; font-size: 15px; flex: 1; }
.version-item-actions { display: flex; gap: 4px; }
.version-item-changelog {
  font-size: 13px; color: #666; white-space: pre-line; line-height: 1.6;
  padding: 8px 12px; background: #f9f9f9; border-radius: 6px; margin-top: 4px;
}
</style>
