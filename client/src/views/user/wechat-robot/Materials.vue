<template>
  <div class="materials-page">
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="filter-tabs">
          <button v-for="tab in typeTabs" :key="tab.value" :class="['tab-btn', { active: activeType === tab.value }]"
            @click="activeType = tab.value; page = 1; loadMaterials()">{{ tab.label }}</button>
        </div>
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input v-model="searchKeyword" placeholder="搜索素材..." @keyup.enter="page=1;loadMaterials()">
        </div>
      </div>
      <button class="btn-add" @click="openAddDialog"><i class="fas fa-plus"></i> 添加素材</button>
    </div>

    <div v-if="loading" class="loading-state"><i class="fas fa-spinner fa-spin fa-2x" style="color:#07C160;"></i></div>
    <div v-else-if="!materials.length" class="empty-state">
      <i class="fas fa-folder-open fa-3x" style="color:#ddd;"></i>
      <p>暂无素材</p>
    </div>

    <div v-else class="material-grid">
      <div v-for="m in materials" :key="m.id" class="material-card">
        <div class="material-header">
          <span class="type-badge" :class="m.type || 'text'">{{ typeLabel(m.type) }}</span>
          <span class="material-title">{{ m.title || '未命名素材' }}</span>
        </div>
        <div class="material-body">
          <div v-if="m.type === 'image' && m.url" class="material-image">
            <img :src="m.url" alt="">
          </div>
          <p v-else class="material-content">{{ m.content || m.url || '-' }}</p>
        </div>
        <div class="material-footer">
          <span class="material-time">{{ formatDate(m.created_at) }}</span>
          <button class="action-btn danger" @click="handleDelete(m)"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>

    <div v-if="total > pageSize" class="pagination-bar">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total"
        :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next"
        @size-change="loadMaterials" @current-change="loadMaterials" />
    </div>

    <!-- 添加素材弹窗 -->
    <el-dialog v-model="showAddDialog" title="添加素材" width="500px">
      <div class="form-group">
        <label class="form-label">类型</label>
        <select v-model="addForm.type" class="form-input">
          <option value="text">文本</option>
          <option value="image">图片</option>
          <option value="link">链接</option>
          <option value="file">文件</option>
          <option value="video">视频</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">标题</label>
        <input v-model="addForm.title" class="form-input" placeholder="素材标题">
      </div>
      <div class="form-group">
        <label class="form-label">{{ addForm.type === 'text' ? '内容' : 'URL地址' }}</label>
        <textarea v-if="addForm.type === 'text'" v-model="addForm.content" class="form-input" rows="4" placeholder="素材内容"></textarea>
        <input v-else v-model="addForm.url" class="form-input" placeholder="素材URL">
      </div>
      <template #footer>
        <button class="btn-cancel" @click="showAddDialog = false">取消</button>
        <button class="btn-save" @click="handleAdd">添加</button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { wechatRobotApi } from '@/api/modules/wechatRobot'

const materials = ref([])
const loading = ref(false)
const activeType = ref('')
const searchKeyword = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const showAddDialog = ref(false)
const addForm = reactive({ type: 'text', title: '', content: '', url: '' })

const typeTabs = [
  { value: '', label: '全部' }, { value: 'text', label: '文本' },
  { value: 'image', label: '图片' }, { value: 'link', label: '链接' },
  { value: 'file', label: '文件' }, { value: 'video', label: '视频' },
]

function typeLabel(t) { return { text: '文本', image: '图片', link: '链接', file: '文件', video: '视频' }[t] || t }
function formatDate(d) { if (!d) return ''; return new Date(d).toLocaleDateString('zh-CN') }

async function loadMaterials() {
  loading.value = true
  try {
    const res = await wechatRobotApi.getMaterials({ page: page.value, per_page: pageSize.value, type: activeType.value, keyword: searchKeyword.value })
    const d = res?.data?.data || res?.data || {}
    materials.value = d.list || d.data || (Array.isArray(d) ? d : [])
    total.value = d.total || materials.value.length
  } catch { materials.value = [] }
  loading.value = false
}

function openAddDialog() {
  Object.assign(addForm, { type: 'text', title: '', content: '', url: '' })
  showAddDialog.value = true
}

async function handleAdd() {
  try {
    await wechatRobotApi.saveMaterial(addForm)
    ElMessage.success('添加成功')
    showAddDialog.value = false
    loadMaterials()
  } catch (err) { ElMessage.error(err?.response?.data?.message || '添加失败') }
}

async function handleDelete(m) {
  try {
    await ElMessageBox.confirm('确定删除该素材吗？', '提示', { type: 'warning' })
    await wechatRobotApi.deleteMaterial(m.id)
    ElMessage.success('删除成功')
    loadMaterials()
  } catch {}
}

onMounted(loadMaterials)
</script>

<style scoped>
.materials-page { max-width: 1200px; margin: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.toolbar-left { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.filter-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.tab-btn { padding: 6px 12px; border: 1px solid #ddd; border-radius: 6px; background: #fff; cursor: pointer; font-size: 0.82rem; color: #666; }
.tab-btn.active { background: #07C160; color: #fff; border-color: #07C160; }
.tab-btn:hover:not(.active) { border-color: #07C160; color: #07C160; }
.search-box { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border: 1px solid #ddd; border-radius: 8px; background: #fff; }
.search-box i { color: #999; }
.search-box input { border: none; outline: none; font-size: 0.85rem; width: 130px; }
.btn-add { background: #07C160; border: none; color: #fff; border-radius: 10px; padding: 8px 18px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; }
.loading-state, .empty-state { text-align: center; padding: 60px 20px; background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); color: #888; }
.empty-state p { margin-top: 16px; }

.material-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.material-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.material-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #f5f5f5; }
.type-badge { padding: 2px 8px; border-radius: 8px; font-size: 0.72rem; font-weight: 500; }
.type-badge.text { background: rgba(7,193,96,0.1); color: #07C160; }
.type-badge.image { background: rgba(87,107,149,0.1); color: #576B95; }
.type-badge.link { background: rgba(250,157,59,0.1); color: #FA9D3B; }
.type-badge.file { background: rgba(155,89,182,0.1); color: #9B59B6; }
.type-badge.video { background: rgba(229,57,53,0.1); color: #E53935; }
.material-title { font-weight: 500; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.material-body { padding: 12px 16px; min-height: 60px; }
.material-image img { max-width: 100%; border-radius: 6px; }
.material-content { color: #666; font-size: 0.85rem; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin: 0; }
.material-footer { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-top: 1px solid #f5f5f5; }
.material-time { color: #bbb; font-size: 0.78rem; }
.action-btn { background: none; border: none; color: #ccc; cursor: pointer; padding: 4px; }
.action-btn.danger:hover { color: #E53935; }
.pagination-bar { margin-top: 16px; }
.form-group { margin-bottom: 16px; }
.form-label { display: block; font-weight: 600; font-size: 0.88rem; margin-bottom: 6px; }
.form-input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.88rem; outline: none; box-sizing: border-box; }
.form-input:focus { border-color: #07C160; }
textarea.form-input { resize: none; }
.btn-cancel { background: #f5f5f5; border: 1px solid #ddd; color: #666; padding: 8px 18px; border-radius: 8px; cursor: pointer; margin-right: 8px; }
.btn-save { background: #07C160; border: none; color: #fff; padding: 8px 18px; border-radius: 8px; cursor: pointer; }
</style>
