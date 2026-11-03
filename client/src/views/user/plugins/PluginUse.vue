<template>
  <div class="plugin-config">
    <router-link to="/user/plugin-center" class="back"><i class="fas fa-arrow-left" /> 返回插件中心</router-link>
    <div v-loading="loading">
      <el-empty v-if="!loading && !plugin" description="插件未安装或已下架" />
      <template v-else-if="plugin">
        <header>
          <div class="icon"><i :class="plugin.icon || 'fas fa-puzzle-piece'" /></div>
          <div><h2>{{ plugin.name }}</h2><p>{{ plugin.description }}</p></div>
          <el-tag type="success">已启用</el-tag>
        </header>

        <div class="layout">
          <section>
            <h3>运行配置</h3>
            <el-form label-position="top">
              <el-form-item label="应用站点范围">
                <el-input v-model="form.site_scope" maxlength="100" placeholder="all 或输入站点域名" />
              </el-form-item>
              <el-form-item label="执行模式">
                <el-segmented v-model="form.execution_mode" :options="modes" />
              </el-form-item>
              <el-form-item label="任务通知">
                <el-switch v-model="form.notifications" />
                <span class="hint">插件完成任务或发生错误时发送站内通知</span>
              </el-form-item>
              <el-button type="primary" :loading="saving" @click="save"><i class="fas fa-save" /> 保存配置</el-button>
            </el-form>
          </section>

          <aside>
            <h3>授权与计费</h3>
            <dl>
              <template v-for="permission in plugin.permissions" :key="permission">
                <dt><i class="fas fa-check-circle" /></dt><dd>{{ permission }}</dd>
              </template>
            </dl>
            <div class="meta"><span>数据去向</span><strong>{{ plugin.data_destination || 'SEO AI 工作区' }}</strong></div>
            <div class="meta"><span>AI 算力</span><strong>{{ plugin.points_per_use ? plugin.points_per_use + ' 点/次' : '不消耗' }}</strong></div>
            <div class="meta"><span>兼容套餐</span><strong>{{ (plugin.compatible_plans || []).join(' / ') }}</strong></div>
            <div class="meta"><span>累计使用</span><strong>{{ plugin.usage_count || 0 }} 次</strong></div>
          </aside>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/api'

const route = useRoute()
const loading = ref(true)
const saving = ref(false)
const plugin = ref(null)
const form = reactive({ site_scope: 'all', execution_mode: 'review', notifications: true })
const modes = [
  { label: '手动', value: 'manual' },
  { label: '审核后执行', value: 'review' },
  { label: '自动执行', value: 'automatic' },
]

async function load() {
  loading.value = true
  try {
    const res = await api.get('/user/plugin-center')
    const list = res.data?.data || res.data || []
    plugin.value = list.find(item => item.slug === route.params.slug && item.is_installed) || null
    if (plugin.value?.user_settings) Object.assign(form, plugin.value.user_settings)
  } catch { plugin.value = null }
  loading.value = false
}

async function save() {
  saving.value = true
  try {
    await api.put(`/user/plugin-center/${plugin.value.id}/settings`, form)
    ElMessage.success('插件配置已保存')
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '保存失败')
  }
  saving.value = false
}

onMounted(load)
</script>

<style scoped>
.plugin-config { max-width: 1040px; margin: 0 auto; }
.back { display:inline-flex;align-items:center;gap:7px;margin-bottom:16px;color:#2f80ed;text-decoration:none;font-size:13px; }
header { display:flex;align-items:flex-start;gap:14px;padding:18px 0;border-bottom:1px solid #e5e7eb; }
header .icon { width:44px;height:44px;display:grid;place-items:center;background:#176b87;color:#fff;border-radius:8px;flex:none; }
header div:nth-child(2) { flex:1;min-width:0; }
h2 { margin:0 0 5px;font-size:20px;letter-spacing:0; } header p { margin:0;color:#64748b;font-size:13px;line-height:1.55; }
.layout { display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:28px;padding-top:22px; }
section,aside { background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px; }
h3 { margin:0 0 18px;font-size:15px;letter-spacing:0; }
.hint { margin-left:10px;color:#64748b;font-size:12px; }
dl { display:grid;grid-template-columns:20px 1fr;gap:8px;margin:0 0 18px;font-size:13px; }
dt { color:#287a55; } dd { margin:0;color:#334155; }
.meta { padding:12px 0;border-top:1px solid #eef2f6;display:flex;justify-content:space-between;gap:16px;font-size:12px; }
.meta span { color:#64748b; }.meta strong { color:#1f2937;text-align:right;font-weight:600; }
@media(max-width:767px){.layout{grid-template-columns:1fr;gap:14px}.plugin-config{padding-bottom:72px}header{align-items:center}header p{display:none}section,aside{padding:16px}.hint{display:block;margin:8px 0 0}}
</style>
