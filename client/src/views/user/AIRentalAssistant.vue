<template>
  <div>
    <div class="page-header"><h3 class="page-title">AI租房助手</h3></div>

    <div class="row g-4">
      <div class="col-lg-8">
        <el-card>
          <div class="chat-messages" ref="chatRef" style="height:400px;overflow-y:auto;padding:16px">
            <div v-if="!messages.length" class="text-center text-muted py-5">
              <el-icon :size="48"><ChatDotRound /></el-icon>
              <p class="mt-3">您好！我是AI租房助手，可以为您解答租房相关的各种问题。</p>
              <div class="d-flex gap-2 flex-wrap justify-content-center mt-3">
                <el-button size="small" v-for="q in quickQuestions" :key="q" @click="input = q; sendMessage()">{{ q }}</el-button>
              </div>
            </div>
            <div v-for="(msg, i) in messages" :key="i" :class="['mb-3 d-flex', msg.role === 'user' ? 'justify-content-end' : '']">
              <div :class="['p-3 rounded', msg.role === 'user' ? 'bg-primary text-white' : 'bg-light']" style="max-width:80%">
                <div v-html="msg.content"></div>
              </div>
            </div>
            <div v-if="thinking" class="mb-3">
              <div class="bg-light p-3 rounded">AI正在思考...</div>
            </div>
          </div>
          <div class="d-flex gap-2 mt-3">
            <el-input v-model="input" placeholder="输入您的租房问题..." @keyup.enter="sendMessage" />
            <el-button type="primary" @click="sendMessage" :loading="thinking" :disabled="!input.trim()">发送</el-button>
          </div>
        </el-card>
      </div>
      <div class="col-lg-4">
        <el-card>
          <template #header><span>历史对话</span></template>
          <div v-if="history.length">
            <div v-for="h in history" :key="h.id" class="mb-2 p-2 border-bottom">
              <small class="text-muted">{{ h.created_at }}</small>
              <p class="mb-0 small text-truncate">{{ h.question }}</p>
            </div>
          </div>
          <el-empty v-else description="暂无历史对话" :image-size="60" />
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import api from '@/api'
import { ChatDotRound } from '@element-plus/icons-vue'

const messages = ref([])
const history = ref([])
const input = ref('')
const thinking = ref(false)
const chatRef = ref(null)

const quickQuestions = ['租房合同注意什么？', '如何选择合适的区域？', '租房常见陷阱有哪些？', '押金一般怎么约定？']

onMounted(() => loadHistory())

async function loadHistory() {
  try {
    const res = await api.get('/user/ai-rental-assistant/history')
    history.value = res.data || []
  } catch {}
}

async function sendMessage() {
  if (!input.value.trim()) return
  const question = input.value.trim()
  messages.value.push({ role: 'user', content: question })
  input.value = ''
  thinking.value = true
  scrollToBottom()
  try {
    const res = await api.post('/user/ai-rental-assistant/ask', { question })
    messages.value.push({ role: 'assistant', content: res.data?.answer || '暂无回答' })
    loadHistory()
  } catch {
    messages.value.push({ role: 'assistant', content: '请求失败，请稍后重试' })
  }
  thinking.value = false
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => { if (chatRef.value) chatRef.value.scrollTop = chatRef.value.scrollHeight })
}
</script>
