<template>
  <div class="contact-tags-page">
    <div class="toolbar">
      <select v-model="selectedRobotId" class="robot-select" @change="loadTags">
        <option value="">选择微信账号</option>
        <option v-for="r in robots" :key="r.id" :value="r.id">{{ r.nickname || r.wxid || '未命名' }}</option>
      </select>
      <button class="btn-add" @click="openAddDialog"><i class="fas fa-plus"></i> 新增标签</button>
    </div>

    <div v-if="!tags.length" class="empty-state">
      <i class="fas fa-tags fa-3x" style="color:#ddd;"></i>
      <p>暂无标签</p>
    </div>

    <div v-else class="tags-grid">
      <div v-for="tag in tags" :key="tag.id" class="tag-card" :style="{ borderLeftColor: tag.color || '#07C160' }">
        <div class="tag-header">
          <span class="tag-color" :style="{ background: tag.color || '#07C160' }"></span>
          <span class="tag-name">{{ tag.name }}</span>
          <span class="tag-count">{{ tag.contact_count || 0 }}人</span>
        </div>
        <p v-if="tag.description" class="tag-desc">{{ tag.description }}</p>
        <div class="tag-actions">
          <button class="action-btn" @click="editTag(tag)"><i class="fas fa-edit"></i></button>
          <button class="action-btn danger" @click="deleteTag(tag)"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <el-dialog v-model="showDialog" :title="editingTag ? '编辑标签' : '新增标签'" width="400px">
      <div class="form-group">
        <label class="form-label">标签名称</label>
        <input v-model="form.name" class="form-input" placeholder="标签名称">
      </div>
      <div class="form-group">
        <label class="form-label">标签颜色</label>
        <div class="color-picker">
          <span v-for="c in colors" :key="c" :class="['color-dot', { active: form.color === c }]" :style="{ background: c }" @click="form.color = c"></span>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">描述</label>
        <input v-model="form.description" class="form-input" placeholder="标签描述（可选）">
      </div>
      <template #footer>
        <button class="btn-cancel" @click="showDialog = false">取消</button>
        <button class="btn-save" @click="handleSave">保存</button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { wechatRobotApi } from '@/api/modules/wechatRobot'

const selectedRobotId = ref('')
const robots = ref([])
const tags = ref([])
const showDialog = ref(false)
const editingTag = ref(null)
const form = reactive({ name: '', color: '#07C160', description: '' })
const colors = ['#07C160', '#576B95', '#FA9D3B', '#9B59B6', '#E53935', '#3498DB', '#1ABC9C', '#F39C12']

async function loadRobots() {
  try {
    const res = await wechatRobotApi.getAccounts()
    robots.value = res?.data?.data || res?.data || []
    if (robots.value.length && !selectedRobotId.value) selectedRobotId.value = robots.value[0].id
  } catch { robots.value = [] }
}

async function loadTags() {
  try {
    const res = await wechatRobotApi.getContactTags(selectedRobotId.value || 0)
    tags.value = res?.data?.data || res?.data || []
    if (!Array.isArray(tags.value)) tags.value = []
  } catch { tags.value = [] }
}

function openAddDialog() {
  editingTag.value = null
  Object.assign(form, { name: '', color: '#07C160', description: '' })
  showDialog.value = true
}
function editTag(tag) {
  editingTag.value = tag
  Object.assign(form, { name: tag.name, color: tag.color || '#07C160', description: tag.description || '' })
  showDialog.value = true
}

async function handleSave() {
  if (!form.name) { ElMessage.warning('请输入标签名称'); return }
  try {
    const data = { ...form }
    if (editingTag.value) data.id = editingTag.value.id
    await wechatRobotApi.saveContactTag(selectedRobotId.value || 0, data)
    ElMessage.success('保存成功')
    showDialog.value = false
    loadTags()
  } catch (err) { ElMessage.error(err?.response?.data?.message || '保存失败') }
}

async function deleteTag(tag) {
  try {
    await ElMessageBox.confirm('确定删除该标签吗？', '提示', { type: 'warning' })
    await wechatRobotApi.deleteContactTag(selectedRobotId.value || 0, tag.id)
    ElMessage.success('删除成功')
    loadTags()
  } catch {}
}

onMounted(() => loadRobots().then(loadTags))
</script>

<style scoped>
.contact-tags-page { max-width: 900px; margin: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.robot-select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; min-width: 160px; }
.btn-add { background: #07C160; border: none; color: #fff; border-radius: 10px; padding: 8px 18px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; }
.empty-state { text-align: center; padding: 60px 20px; background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); color: #888; }
.empty-state p { margin-top: 16px; }

.tags-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.tag-card { background: #fff; border-radius: 12px; padding: 16px 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); border-left: 4px solid #07C160; }
.tag-header { display: flex; align-items: center; gap: 8px; }
.tag-color { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
.tag-name { font-weight: 600; font-size: 0.95rem; flex: 1; }
.tag-count { color: #888; font-size: 0.8rem; }
.tag-desc { color: #888; font-size: 0.82rem; margin: 8px 0 0; }
.tag-actions { display: flex; gap: 6px; margin-top: 12px; }
.action-btn { background: none; border: 1px solid #eee; padding: 5px 10px; border-radius: 6px; cursor: pointer; color: #888; font-size: 0.8rem; }
.action-btn:hover { border-color: #07C160; color: #07C160; }
.action-btn.danger:hover { border-color: #E53935; color: #E53935; }

.form-group { margin-bottom: 16px; }
.form-label { display: block; font-weight: 600; font-size: 0.88rem; margin-bottom: 6px; }
.form-input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.88rem; outline: none; box-sizing: border-box; }
.color-picker { display: flex; gap: 8px; flex-wrap: wrap; }
.color-dot { width: 28px; height: 28px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: all 0.2s; }
.color-dot.active { border-color: #333; transform: scale(1.2); }
.btn-cancel { background: #f5f5f5; border: 1px solid #ddd; color: #666; padding: 8px 18px; border-radius: 8px; cursor: pointer; margin-right: 8px; }
.btn-save { background: #07C160; border: none; color: #fff; padding: 8px 18px; border-radius: 8px; cursor: pointer; }
</style>
