<template>
  <div class="page-container">
    <div class="page-header"><h3 class="page-title">关注的内容专家</h3></div>

    <div v-loading="loading">
      <div class="row g-4" v-if="agents.length">
        <div class="col-12 col-sm-6 col-lg-4" v-for="agent in agents" :key="agent.id">
          <el-card shadow="hover" class="agent-card">
            <div class="d-flex align-items-center gap-3">
              <el-avatar :size="56" :src="agent.avatar">
                <el-icon :size="28"><UserFilled /></el-icon>
              </el-avatar>
              <div class="agent-info">
                <h5 class="agent-name">{{ agent.name || agent.nickname || '未知内容专家' }}</h5>
                <p class="agent-company" v-if="agent.company">{{ agent.company }}</p>
                <p class="agent-contact" v-if="agent.phone || agent.email">
                  {{ agent.phone || agent.email }}
                </p>
              </div>
            </div>
            <div class="agent-actions mt-3">
              <el-button size="small" type="danger" plain @click="unfollowAgent(agent)">
                取消关注
              </el-button>
              <el-button size="small" type="primary" plain v-if="agent.phone" @click="copyContact(agent.phone)">
                复制电话
              </el-button>
            </div>
          </el-card>
        </div>
      </div>
      <el-empty v-else description="暂未关注内容专家" />
    </div>

    <div class="d-flex justify-content-center mt-4" v-if="total > pageSize">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="loadAgents"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UserFilled } from '@element-plus/icons-vue'

const agents = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(12)
const total = ref(0)

async function loadAgents() {
  loading.value = true
  try {
    const res = await api.get('/user/followed-agents', {
      params: { page: page.value, pageSize: pageSize.value },
    })
    agents.value = res.data?.data || res.data || []
    total.value = res.data?.total || 0
  } catch { /* 拦截器已处理 */ }
  loading.value = false
}

async function unfollowAgent(agent) {
  try {
    await ElMessageBox.confirm(`确定取消关注 ${agent.name || '该内容专家'} ？`, '提示', { type: 'warning' })
    await api.post('/user/unfollow-agent', { agent_id: agent.id })
    agents.value = agents.value.filter((a) => a.id !== agent.id)
    total.value = Math.max(0, total.value - 1)
    ElMessage.success('已取消关注')
  } catch { /* 用户取消或拦截器已处理 */ }
}

function copyContact(text) {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.warning('复制失败，请手动复制')
  })
}

onMounted(() => loadAgents())
</script>

<style scoped lang="scss">
.page-container {
  padding: 20px;
}
.agent-card {
  transition: transform 0.3s ease;
  &:hover {
    transform: translateY(-2px);
  }
}
.agent-info {
  min-width: 0;
  flex: 1;
}
.agent-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}
.agent-company {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 2px;
}
.agent-contact {
  font-size: 12px;
  color: #999;
  margin-bottom: 0;
}
.agent-actions {
  display: flex;
  gap: var(--space-sm);
  border-top: 1px solid var(--border-color);
  padding-top: var(--space-md);
}
</style>
