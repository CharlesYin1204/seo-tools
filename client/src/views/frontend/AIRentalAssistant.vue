<template>
  <div class="ai-assistant-page">
    <div class="container">
      <div class="chat-wrapper">
        <!-- 聊天头部 -->
        <div class="chat-header">
          <div class="d-flex align-items-center gap-3">
            <div class="assistant-avatar"><i class="fas fa-robot"></i></div>
            <div>
              <h4 class="mb-0">AI Rental Assistant</h4>
              <span class="status-dot"></span>
              <span class="status-text">Online</span>
            </div>
          </div>
          <button v-if="messages.length > 1" class="clear-chat-btn" @click="clearChat">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>

        <!-- 聊天消息区 -->
        <div ref="chatBody" class="chat-body">
          <div v-for="(msg, i) in messages" :key="i" :class="['chat-message', msg.role]">
            <div class="message-avatar">
              <i :class="msg.role === 'assistant' ? 'fas fa-robot' : 'fas fa-user'"></i>
            </div>
            <div class="message-bubble">
              <div class="message-text" v-html="formatMessage(msg.content)"></div>
              <div class="message-time">{{ msg.time }}</div>
            </div>
          </div>

          <div v-if="thinking" class="chat-message assistant">
            <div class="message-avatar"><i class="fas fa-robot"></i></div>
            <div class="message-bubble">
              <div class="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>

        <!-- 快捷提问 -->
        <div v-if="messages.length <= 1" class="quick-questions">
          <button v-for="q in quickQuestions" :key="q" class="quick-btn" @click="sendQuick(q)">{{ q }}</button>
        </div>

        <!-- 输入区 -->
        <div class="chat-input-area">
          <input
            v-model="inputText"
            type="text"
            class="chat-input"
            placeholder="Ask anything about renting in Shanghai..."
            :disabled="thinking"
            @keyup.enter="sendMessage"
          />
          <button class="send-btn" :disabled="!inputText.trim() || thinking" @click="sendMessage">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import api from '@/api'

const messages = ref([
  { role: 'assistant', content: 'Hello! I\'m your AI Rental Assistant. I can help you with:\n\n- Finding apartments in Shanghai\n- Understanding rental contracts\n- Neighborhood recommendations\n- Price comparisons\n- Moving tips for expats\n\nHow can I help you today?', time: formatTime() }
])
const inputText = ref('')
const thinking = ref(false)
const chatBody = ref(null)

const quickQuestions = [
  'What\'s the average rent in Jing\'an?',
  'Best areas for families with kids?',
  'How to negotiate rental price?',
  'Documents needed for renting?',
]

onMounted(() => loadHistory())

async function loadHistory() {
  try {
    const res = await api.get('/user/ai-rental-assistant/history')
    const hist = res.data?.data || []
    if (hist.length > 0) {
      messages.value = hist.map(m => ({ ...m, time: m.time || formatTime() }))
    }
  } catch { /* 未登录或无历史 */ }
}

async function sendMessage() {
  if (!inputText.value.trim() || thinking.value) return
  const text = inputText.value.trim()
  inputText.value = ''
  messages.value.push({ role: 'user', content: text, time: formatTime() })
  await scrollToBottom()

  thinking.value = true
  try {
    const res = await api.post('/user/ai-rental-assistant/ask', {
      message: text,
      history: messages.value.slice(-10).map(m => ({ role: m.role, content: m.content }))
    })
    messages.value.push({
      role: 'assistant',
      content: res.data?.reply || 'Sorry, I couldn\'t process your request. Please try again.',
      time: formatTime()
    })
  } catch {
    messages.value.push({
      role: 'assistant',
      content: 'Sorry, something went wrong. Please try again later.',
      time: formatTime()
    })
  }
  thinking.value = false
  await scrollToBottom()
}

function sendQuick(q) {
  inputText.value = q
  sendMessage()
}

function clearChat() {
  messages.value = [messages.value[0]]
}

function formatTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatMessage(text) {
  return (text || '').replace(/\n/g, '<br>')
}

async function scrollToBottom() {
  await nextTick()
  if (chatBody.value) {
    chatBody.value.scrollTop = chatBody.value.scrollHeight
  }
}
</script>

<style scoped>
.ai-assistant-page { padding: 30px 20px; background: #f0f2f5; min-height: calc(100vh - 80px); }

.chat-wrapper {
  max-width: 800px; margin: 0 auto; background: white; border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; display: flex; flex-direction: column;
  height: calc(100vh - 160px); min-height: 500px;
}

.chat-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid #f1f3f5;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;
}
.chat-header h4 { font-size: 16px; font-weight: 600; color: white; }
.assistant-avatar {
  width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.status-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: #4ade80; margin-right: 4px;
}
.status-text { font-size: 12px; opacity: 0.85; }
.clear-chat-btn {
  background: rgba(255,255,255,0.15); border: none; color: white; padding: 8px 10px;
  border-radius: 8px; cursor: pointer; transition: background 0.2s;
}
.clear-chat-btn:hover { background: rgba(255,255,255,0.25); }

.chat-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }

.chat-message { display: flex; gap: 10px; max-width: 80%; }
.chat-message.user { margin-left: auto; flex-direction: row-reverse; }
.message-avatar {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 14px;
}
.chat-message.assistant .message-avatar { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
.chat-message.user .message-avatar { background: #e2e8f0; color: #64748b; }

.message-bubble { max-width: 100%; }
.chat-message.assistant .message-bubble {
  background: #f8f9fa; border-radius: 4px 16px 16px 16px; padding: 12px 16px;
}
.chat-message.user .message-bubble {
  background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 16px 4px 16px 16px;
  padding: 12px 16px; color: white;
}
.message-text { font-size: 14px; line-height: 1.6; word-break: break-word; }
.message-time { font-size: 11px; margin-top: 4px; opacity: 0.6; }
.chat-message.user .message-time { text-align: right; }

.typing-indicator { display: flex; gap: 4px; padding: 4px 0; }
.typing-indicator span {
  width: 8px; height: 8px; border-radius: 50%; background: #94a3b8;
  animation: typing-bounce 1.4s infinite;
}
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}

.quick-questions {
  padding: 0 20px 12px; display: flex; gap: 8px; flex-wrap: wrap;
}
.quick-btn {
  background: #f0f4ff; color: #667eea; border: 1px solid #dde4ff; padding: 6px 14px;
  border-radius: 20px; font-size: 13px; cursor: pointer; transition: all 0.2s;
}
.quick-btn:hover { background: #667eea; color: white; border-color: #667eea; }

.chat-input-area {
  display: flex; align-items: center; gap: 8px; padding: 14px 16px;
  border-top: 1px solid #f1f3f5;
}
.chat-input {
  flex: 1; border: 2px solid #e9ecef; border-radius: 12px; padding: 12px 16px;
  font-size: 14px; outline: none; transition: border-color 0.3s;
}
.chat-input:focus { border-color: #667eea; }
.send-btn {
  width: 46px; height: 46px; border-radius: 12px; border: none;
  background: linear-gradient(135deg, #667eea, #764ba2); color: white;
  font-size: 16px; cursor: pointer; transition: all 0.3s; flex-shrink: 0;
}
.send-btn:hover:not(:disabled) { transform: scale(1.05); }
.send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 768px) {
  .ai-assistant-page { padding: 10px; }
  .chat-wrapper { height: calc(100vh - 120px); border-radius: 12px; }
  .chat-message { max-width: 90%; }
  .quick-questions { gap: 6px; }
  .quick-btn { font-size: 12px; padding: 5px 10px; }
}
</style>
