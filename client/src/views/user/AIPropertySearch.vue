<template>
  <div>
    <div class="page-header"><h3 class="page-title">AI智能内容检索</h3></div>

    <div class="row g-4">
      <div class="col-lg-8">
        <el-card>
          <div class="chat-messages" ref="chatRef" style="height:400px;overflow-y:auto;padding:16px">
            <div v-for="(msg, i) in messages" :key="i" :class="['mb-3 d-flex', msg.role === 'user' ? 'justify-content-end' : '']">
              <div :class="['p-3 rounded', msg.role === 'user' ? 'bg-primary text-white' : 'bg-light']" style="max-width:80%">
                <div v-html="msg.content"></div>
              </div>
            </div>
            <div v-if="thinking" class="mb-3">
              <div class="bg-light p-3 rounded"><i class="el-icon-loading"></i> AI正在思考...</div>
            </div>
          </div>
          <div class="d-flex gap-2 mt-3">
            <el-input v-model="input" placeholder="描述您的内容检索需求，例如：我想在浦东找一个两室一厅，预算8000以内..." @keyup.enter="sendMessage" />
            <el-button type="primary" @click="sendMessage" :loading="thinking" :disabled="!input.trim()">发送</el-button>
          </div>
        </el-card>
      </div>
      <div class="col-lg-4">
        <el-card>
          <template #header><span>搜索历史</span></template>
          <div v-if="history.length">
            <div v-for="h in history" :key="h.id" class="mb-2 p-2 border-bottom cursor-pointer" @click="input = h.query">
              <small class="text-muted">{{ h.created_at }}</small>
              <p class="mb-0 small text-truncate">{{ h.query }}</p>
            </div>
          </div>
          <el-empty v-else description="暂无搜索记录" :image-size="60" />
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import api from '@/api'

const messages = ref([])
const history = ref([])
const input = ref('')
const thinking = ref(false)
const chatRef = ref(null)

onMounted(() => loadHistory())

async function loadHistory() {
  try {
    const res = await api.get('/user/ai-property-search/history')
    history.value = res.data || []
  } catch {}
}

async function sendMessage() {
  if (!input.value.trim()) return
  const query = input.value.trim()
  messages.value.push({ role: 'user', content: query })
  input.value = ''
  thinking.value = true
  scrollToBottom()
  try {
    const res = await api.post('/user/ai-property-search/search', { query })
    messages.value.push({ role: 'assistant', content: res.data?.answer || '暂无结果' })
    loadHistory()
  } catch {
    messages.value.push({ role: 'assistant', content: '搜索失败，请稍后重试' })
  }
  thinking.value = false
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => { if (chatRef.value) chatRef.value.scrollTop = chatRef.value.scrollHeight })
}
</script>
