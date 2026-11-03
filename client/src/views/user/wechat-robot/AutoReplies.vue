<template>
  <div class="auto-replies-page">
    <div class="toolbar">
      <div class="toolbar-left">
        <select v-model="selectedRobotId" class="robot-select" @change="onRobotChange">
          <option value="">选择微信账号</option>
          <option v-for="r in robots" :key="r.id" :value="r.id">{{ r.nickname || r.wxid || '未命名' }}</option>
        </select>
      </div>
      <button class="btn-add" @click="openAddDialog"><i class="fas fa-plus"></i> 添加规则</button>
    </div>

    <div v-if="loading" class="loading-state"><i class="fas fa-spinner fa-spin fa-2x" style="color:#07C160;"></i></div>
    <div v-else-if="!rules.length" class="empty-state">
      <i class="fas fa-robot fa-3x" style="color:#ddd;"></i>
      <p>{{ selectedRobotId ? '暂无自动回复规则' : '请选择微信账号' }}</p>
    </div>

    <div v-else class="rules-list">
      <div v-for="rule in rules" :key="rule.id" class="rule-card">
        <div class="rule-header">
          <div class="rule-title">
            <span class="type-badge" :class="rule.trigger_type || 'keyword'">{{ typeLabel(rule.trigger_type) }}</span>
            <span class="rule-name">{{ rule.name || '自动回复规则' }}</span>
          </div>
          <div class="rule-switch">
            <label class="switch">
              <input type="checkbox" :checked="rule.is_enabled" @change="toggleRule(rule)">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div class="rule-body">
          <div class="rule-row"><label>触发词:</label> <span>{{ rule.trigger_keywords || rule.keywords || '-' }}</span></div>
          <div class="rule-row"><label>回复内容:</label> <span>{{ rule.reply_content || '-' }}</span></div>
        </div>
        <div class="rule-footer">
          <button class="action-btn" @click="editRule(rule)"><i class="fas fa-edit"></i> 编辑</button>
          <button class="action-btn danger" @click="deleteRule(rule)"><i class="fas fa-trash"></i> 删除</button>
        </div>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <el-dialog v-model="showDialog" :title="editingRule ? '编辑规则' : '添加自动回复规则'" width="500px">
      <div class="form-group">
        <label class="form-label">规则名称</label>
        <input v-model="form.name" class="form-input" placeholder="规则名称">
      </div>
      <div class="form-group">
        <label class="form-label">匹配方式</label>
        <select v-model="form.trigger_type" class="form-input">
          <option value="keyword">关键词匹配</option>
          <option value="regex">正则匹配</option>
          <option value="all">全部消息</option>
        </select>
      </div>
      <div v-if="form.trigger_type !== 'all'" class="form-group">
        <label class="form-label">触发关键词</label>
        <input v-model="form.trigger_keywords" class="form-input" placeholder="多个关键词用英文逗号分隔">
      </div>
      <div class="form-group">
        <label class="form-label">回复内容</label>
        <textarea v-model="form.reply_content" class="form-input" rows="4" placeholder="收到匹配消息后的自动回复内容"></textarea>
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
const rules = ref([])
const loading = ref(false)
const showDialog = ref(false)
const editingRule = ref(null)
const form = reactive({ name: '', trigger_type: 'keyword', trigger_keywords: '', reply_content: '' })

function typeLabel(t) { return { keyword: '关键词', regex: '正则', all: '全部' }[t] || '关键词' }

async function loadRobots() {
  try {
    const res = await wechatRobotApi.getAccounts()
    robots.value = res?.data?.data || res?.data || []
    if (robots.value.length && !selectedRobotId.value) selectedRobotId.value = robots.value[0].id
  } catch { robots.value = [] }
}

function onRobotChange() { loadRules() }

async function loadRules() {
  if (!selectedRobotId.value) { rules.value = []; return }
  loading.value = true
  try {
    const res = await wechatRobotApi.getAutoReplies(selectedRobotId.value)
    rules.value = res?.data?.data || res?.data || []
    if (!Array.isArray(rules.value)) rules.value = []
  } catch { rules.value = [] }
  loading.value = false
}

function openAddDialog() {
  editingRule.value = null
  Object.assign(form, { name: '', trigger_type: 'keyword', trigger_keywords: '', reply_content: '' })
  showDialog.value = true
}
function editRule(rule) {
  editingRule.value = rule
  Object.assign(form, { name: rule.name || '', trigger_type: rule.trigger_type || 'keyword', trigger_keywords: rule.trigger_keywords || rule.keywords || '', reply_content: rule.reply_content || '' })
  showDialog.value = true
}

async function handleSave() {
  if (!selectedRobotId.value) return
  try {
    const data = { ...form }
    if (editingRule.value) data.id = editingRule.value.id
    await wechatRobotApi.saveAutoReply(selectedRobotId.value, data)
    ElMessage.success('保存成功')
    showDialog.value = false
    loadRules()
  } catch (err) { ElMessage.error(err?.response?.data?.message || '保存失败') }
}

async function deleteRule(rule) {
  try {
    await ElMessageBox.confirm('确定删除该规则吗？', '提示', { type: 'warning' })
    await wechatRobotApi.deleteAutoReply(selectedRobotId.value, rule.id)
    ElMessage.success('删除成功')
    loadRules()
  } catch {}
}

function toggleRule(rule) {
  const newData = { ...rule, is_enabled: !rule.is_enabled }
  wechatRobotApi.saveAutoReply(selectedRobotId.value, newData).then(() => { rule.is_enabled = !rule.is_enabled }).catch(() => ElMessage.error('操作失败'))
}

onMounted(() => loadRobots().then(loadRules))
</script>

<style scoped>
.auto-replies-page { max-width: 900px; margin: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.toolbar-left { display: flex; gap: 12px; align-items: center; }
.robot-select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; min-width: 160px; }
.btn-add { background: #07C160; border: none; color: #fff; border-radius: 10px; padding: 10px 20px; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; }
.btn-add:hover { background: #06AD56; }
.loading-state, .empty-state { text-align: center; padding: 60px 20px; background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); color: #888; }
.empty-state p { margin-top: 16px; }

.rules-list { display: flex; flex-direction: column; gap: 12px; }
.rule-card { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
.rule-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; }
.rule-title { display: flex; align-items: center; gap: 10px; }
.type-badge { padding: 3px 10px; border-radius: 10px; font-size: 0.75rem; font-weight: 500; }
.type-badge.keyword { background: rgba(7,193,96,0.1); color: #07C160; }
.type-badge.regex { background: rgba(87,107,149,0.1); color: #576B95; }
.type-badge.all { background: rgba(250,157,59,0.1); color: #FA9D3B; }
.rule-name { font-weight: 600; color: #191919; }
.switch { position: relative; display: inline-block; width: 44px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #ccc; border-radius: 24px; transition: 0.3s; }
.slider:before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.3s; }
input:checked + .slider { background: #07C160; }
input:checked + .slider:before { transform: translateX(20px); }
.rule-body { padding: 16px 20px; }
.rule-row { margin-bottom: 8px; font-size: 0.88rem; }
.rule-row:last-child { margin-bottom: 0; }
.rule-row label { color: #888; margin-right: 8px; }
.rule-footer { display: flex; gap: 8px; padding: 12px 20px; border-top: 1px solid #f0f0f0; }
.action-btn { background: none; border: 1px solid #ddd; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; color: #666; display: flex; align-items: center; gap: 4px; }
.action-btn:hover { border-color: #07C160; color: #07C160; }
.action-btn.danger:hover { border-color: #E53935; color: #E53935; }

.form-group { margin-bottom: 16px; }
.form-label { display: block; font-weight: 600; font-size: 0.9rem; margin-bottom: 6px; color: #333; }
.form-input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; outline: none; box-sizing: border-box; }
.form-input:focus { border-color: #07C160; }
textarea.form-input { resize: none; }
.btn-cancel { background: #f5f5f5; border: 1px solid #ddd; color: #666; padding: 8px 20px; border-radius: 8px; cursor: pointer; margin-right: 8px; }
.btn-save { background: #07C160; border: none; color: #fff; padding: 8px 20px; border-radius: 8px; cursor: pointer; }
.btn-save:hover { background: #06AD56; }
</style>
