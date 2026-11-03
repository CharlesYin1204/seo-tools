<template>
  <div class="lead-gen-plugin">
    <div class="plugin-card">
      <div class="plugin-card-header"><i class="fas fa-magnet me-2"></i>智能获客引流</div>
      <div class="plugin-card-body">
        <div class="tab-nav mb-3">
          <button v-for="tab in tabs" :key="tab.key" class="tab-btn" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
            <i :class="tab.icon" class="me-1"></i>{{ tab.label }}
          </button>
        </div>

        <!-- 自动通过好友 -->
        <div v-if="activeTab==='autoAccept'" class="tab-content">
          <div class="config-section">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="mb-0">自动通过好友请求</h6>
              <label class="switch"><input type="checkbox" v-model="autoAcceptConfig.enabled" /><span class="slider"></span></label>
            </div>
            <div class="mb-3"><label class="form-label">欢迎消息</label><textarea v-model="autoAcceptConfig.welcomeMsg" class="form-control" rows="3" placeholder="新好友通过后自动发送的欢迎消息...&#10;支持变量：{nickname}"></textarea></div>
            <div class="mb-3"><label class="form-label">关键词过滤（含以下关键词自动通过）</label><input v-model="autoAcceptConfig.keywords" class="form-control" placeholder="例：租房,内容检索,内容资产,apartment（逗号分隔）" /></div>
            <button class="btn btn-primary" @click="saveConfig('auto_accept', autoAcceptConfig)"><i class="fas fa-save me-1"></i>保存设置</button>
          </div>
        </div>

        <!-- 关键词自动回复 -->
        <div v-if="activeTab==='autoReply'" class="tab-content">
          <div class="config-section">
            <h6 class="mb-3">关键词自动回复规则</h6>
            <div v-for="(rule, i) in replyRules" :key="i" class="reply-rule mb-2">
              <div class="rule-row">
                <input v-model="rule.keyword" class="form-control form-control-sm" placeholder="触发关键词" style="width:120px" />
                <span class="mx-1">→</span>
                <input v-model="rule.reply" class="form-control form-control-sm" placeholder="自动回复内容" />
                <button class="btn btn-sm btn-outline-danger" @click="replyRules.splice(i, 1)"><i class="fas fa-times"></i></button>
              </div>
            </div>
            <button class="btn btn-sm btn-outline-primary mb-3" @click="replyRules.push({keyword:'',reply:''})"><i class="fas fa-plus me-1"></i>添加规则</button>
            <div class="mb-3">
              <h6>预设规则模板</h6>
              <div class="template-grid">
                <button v-for="t in replyTemplates" :key="t.kw" class="template-btn" @click="replyRules.push({keyword:t.kw, reply:t.reply})">
                  <strong>{{ t.kw }}</strong><span class="small text-muted ms-1">→ {{ t.reply.substring(0,20) }}...</span>
                </button>
              </div>
            </div>
            <button class="btn btn-primary" @click="saveConfig('auto_reply', { rules: replyRules })"><i class="fas fa-save me-1"></i>保存规则</button>
          </div>
        </div>

        <!-- 引流话术 -->
        <div v-if="activeTab==='scripts'" class="tab-content">
          <div class="config-section">
            <h6 class="mb-3">引流话术库</h6>
            <div v-for="(s, i) in scripts" :key="i" class="script-card mb-2">
              <div class="script-head">
                <input v-model="s.title" class="form-control form-control-sm" placeholder="话术标题" />
                <button class="btn btn-sm btn-outline-danger" @click="scripts.splice(i, 1)"><i class="fas fa-trash"></i></button>
              </div>
              <textarea v-model="s.content" class="form-control form-control-sm mt-1" rows="2" placeholder="话术内容..."></textarea>
            </div>
            <button class="btn btn-sm btn-outline-primary mb-3" @click="scripts.push({title:'',content:''})"><i class="fas fa-plus me-1"></i>添加话术</button>
            <button class="btn btn-primary" @click="saveConfig('scripts', { items: scripts })"><i class="fas fa-save me-1"></i>保存话术</button>
          </div>
        </div>

        <!-- 获客统计 -->
        <div v-if="activeTab==='stats'" class="tab-content">
          <div class="lead-stats">
            <div class="stat-row"><span>今日新增好友</span><strong>{{ stats.todayNew || 0 }}</strong></div>
            <div class="stat-row"><span>本周新增好友</span><strong>{{ stats.weekNew || 0 }}</strong></div>
            <div class="stat-row"><span>自动回复次数</span><strong>{{ stats.autoReplies || 0 }}</strong></div>
            <div class="stat-row"><span>话术使用次数</span><strong>{{ stats.scriptUses || 0 }}</strong></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

defineProps({ plugin: Object })
const tabs = [
  { key: 'autoAccept', label: '自动通过', icon: 'fas fa-user-plus' },
  { key: 'autoReply', label: '自动回复', icon: 'fas fa-reply' },
  { key: 'scripts', label: '引流话术', icon: 'fas fa-comments' },
  { key: 'stats', label: '获客统计', icon: 'fas fa-chart-pie' },
]
const activeTab = ref('autoAccept')
const autoAcceptConfig = reactive({ enabled: false, welcomeMsg: '你好！欢迎联系 SEO 内容顾问，我们可以协助你完成站点审计、内容优化与增长分析。', keywords: 'SEO,内容优化,站点审计,GEO,content' })
const replyRules = ref([{ keyword: '价格', reply: '请问您的预算范围是多少？我可以为您推荐合适的内容资产。' }])
const scripts = ref([
  { title: '首次接触', content: '您好！我们专注 SEO 审计、内容优化与 AI 搜索可见性运营，可提供站点诊断与修复建议。请问您希望先看哪一项？' },
  { title: '内容资产推荐', content: '根据您的需求，我推荐这套位于{location}的{type}，{area}平米，月租{price}，精装修拎包入住，距离地铁站步行{distance}分钟。需要安排查看内容吗？' }
])
const stats = reactive({ todayNew: 0, weekNew: 0, autoReplies: 0, scriptUses: 0 })
const replyTemplates = [
  { kw: '价格', reply: '请问您的预算范围是多少？我可以为您推荐合适的内容资产。' },
  { kw: '查看内容', reply: '好的，我马上为您安排查看内容时间，请问您什么时候方便？' },
  { kw: '位置', reply: '我们有浦东、静安、徐汇、长宁等区域的优质内容资产，请问您偏好哪个区域？' },
  { kw: '户型', reply: '从一室到四室我们都有内容资产，请问您需要几室的房子？' },
]

const saveConfig = async (type, data) => {
  try {
    await api.post('/user/plugin-exec/smart-lead-gen/data', {
      data_type: type, title: type, content: JSON.stringify(data), data_json: data
    })
    ElMessage.success('配置已保存')
  } catch { ElMessage.error('保存失败') }
}

const loadConfigs = async () => {
  try {
    const res = await api.get('/user/plugin-exec/smart-lead-gen/data')
    const items = res.data?.data || []
    for (const item of items) {
      let d = item.data_json
      try { if (typeof d === 'string') d = JSON.parse(d) } catch { continue }
      if (item.data_type === 'auto_accept') Object.assign(autoAcceptConfig, d)
      if (item.data_type === 'auto_reply' && d.rules) replyRules.value = d.rules
      if (item.data_type === 'scripts' && d.items) scripts.value = d.items
    }
  } catch {}
}

onMounted(loadConfigs)
</script>

<style scoped>
.plugin-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.plugin-card-header { padding: 16px 20px; background: linear-gradient(135deg, #e17055, #fdcb6e); color: #fff; font-size: 16px; font-weight: 600; }
.plugin-card-body { padding: 20px; }
.tab-nav { display: flex; gap: 6px; flex-wrap: wrap; }
.tab-btn { padding: 8px 16px; border: 1px solid #ddd; border-radius: 20px; background: #fff; cursor: pointer; font-size: 13px; transition: all .2s; }
.tab-btn.active { background: #4879FF; color: #fff; border-color: #4879FF; }
.config-section { background: #f8f9fa; border-radius: 8px; padding: 16px; }
h6 { font-size: 14px; font-weight: 600; }
.switch { position: relative; display: inline-block; width: 46px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; inset: 0; background: #ccc; border-radius: 24px; transition: .3s; cursor: pointer; }
.slider:before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: .3s; }
input:checked + .slider { background: #4879FF; }
input:checked + .slider:before { transform: translateX(22px); }
.rule-row { display: flex; align-items: center; gap: 6px; }
.template-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.template-btn { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 6px 10px; font-size: 12px; cursor: pointer; text-align: left; }
.template-btn:hover { border-color: #4879FF; }
.script-head { display: flex; gap: 8px; }
.lead-stats { background: #f8f9fa; border-radius: 8px; padding: 16px; }
.stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px; }

@media (max-width: 768px) {
  .plugin-card-header { padding: 12px 14px; font-size: 14px; }
  .plugin-card-body { padding: 14px; }
  .tab-btn { padding: 6px 12px; font-size: 12px; }
  .config-section { padding: 12px; }
  .rule-row { flex-wrap: wrap; }
  .script-head { flex-wrap: wrap; }
  .template-grid { gap: 4px; }
  .template-btn { font-size: 11px; padding: 5px 8px; }
  .stat-row { font-size: 13px; }
}
</style>
