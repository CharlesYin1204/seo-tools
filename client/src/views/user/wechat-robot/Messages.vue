<template>
  <div class="messages-page">
    <!-- 顶部工具栏 -->
    <div class="msg-toolbar">
      <div class="toolbar-left">
        <select v-model="selectedRobotId" class="robot-select" @change="onRobotChange">
          <option value="">选择微信账号</option>
          <option v-for="r in robots" :key="r.id" :value="r.id">{{ r.nickname || r.wxid || '未命名' }}</option>
        </select>
        <span v-if="selectedRobotId" class="device-status" :class="deviceOnline ? 'online' : 'offline'">
          <i :class="deviceOnline ? 'fas fa-circle' : 'fas fa-circle'"></i> {{ deviceOnline ? '在线' : '离线' }}
        </span>
      </div>
      <div class="toolbar-right">
        <button class="tool-btn" @click="handleSyncContacts" :disabled="!selectedRobotId"><i class="fas fa-sync-alt"></i> 同步通讯录</button>
        <button class="tool-btn" @click="loadConversations" :disabled="!selectedRobotId"><i class="fas fa-download"></i> 加载联系人</button>
      </div>
    </div>

    <!-- 聊天主区域 -->
    <div class="chat-container">
      <!-- 左侧会话列表 -->
      <div class="conv-panel" :class="{ 'mobile-open': mobileShowConv }">
        <div class="conv-search">
          <i class="fas fa-search"></i>
          <input v-model="convSearch" placeholder="搜索联系人...">
        </div>
        <div class="conv-list">
          <div v-for="c in filteredConversations" :key="c.wxid || c.id"
               class="conv-item" :class="{ active: selectedWxid === (c.wxid || c.contact_wxid) }"
               @click="selectConv(c)">
            <div class="conv-avatar">
              <img v-if="c.avatar" :src="c.avatar" alt="">
              <i v-else class="fas fa-user"></i>
            </div>
            <div class="conv-info">
              <div class="conv-name">{{ c.nickname || c.remark || c.wxid }}</div>
              <div class="conv-preview">{{ c.last_message || c.last_msg || '' }}</div>
            </div>
            <div class="conv-meta">
              <span class="conv-time">{{ formatTime(c.last_time || c.updated_at) }}</span>
              <span v-if="c.unread_count" class="unread-badge">{{ c.unread_count > 99 ? '99+' : c.unread_count }}</span>
            </div>
          </div>
          <div v-if="!filteredConversations.length" class="conv-empty">暂无会话</div>
        </div>
      </div>

      <!-- 右侧聊天区 -->
      <div class="chat-panel">
        <template v-if="selectedWxid">
          <!-- 聊天头部 -->
          <div class="chat-header">
            <button class="mobile-back" @click="mobileShowConv = true"><i class="fas fa-arrow-left"></i></button>
            <span class="chat-name">{{ currentConv?.nickname || currentConv?.remark || selectedWxid }}</span>
          </div>
          <!-- 消息列表 -->
          <div class="chat-messages" ref="chatMsgRef">
            <div v-if="msgLoading" class="msg-loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>
            <div v-for="m in messages" :key="m.id || m.msg_id" class="msg-row" :class="{ self: m.is_self || m.direction === 'send' }">
              <div class="msg-avatar">
                <img v-if="getMsgAvatar(m)" :src="getMsgAvatar(m)" alt="">
                <i v-else class="fas fa-user"></i>
              </div>
              <div class="msg-bubble">
                <div class="msg-text" v-if="m.msg_type === 'text' || !m.msg_type">{{ m.content }}</div>
                <div v-else-if="m.msg_type === 'image'" class="msg-image">
                  <img :src="m.media_url || m.content" alt="图片" @click="previewImage(m.media_url || m.content)">
                </div>
                <div v-else class="msg-text">[{{ m.msg_type }}] {{ m.content }}</div>
                <span class="msg-time-label">{{ formatTime(m.created_at) }}</span>
              </div>
            </div>
            <div v-if="!msgLoading && !messages.length" class="msg-empty">暂无消息记录</div>
          </div>
          <!-- 输入区 -->
          <div class="chat-input">
            <div class="input-toolbar">
              <button class="input-tool" title="发送图片"><i class="fas fa-image"></i></button>
              <button class="input-tool" title="发送文件"><i class="fas fa-paperclip"></i></button>
              <button class="input-tool" title="发送名片"><i class="fas fa-id-card"></i></button>
              <button class="input-tool" title="发送链接"><i class="fas fa-link"></i></button>
            </div>
            <textarea v-model="sendContent" placeholder="输入消息... (Ctrl+Enter 发送)" @keydown.ctrl.enter="handleSend" rows="3"></textarea>
            <div class="input-actions">
              <button class="btn-send" :disabled="!sendContent.trim() || sending" @click="handleSend">
                <i :class="sending ? 'fas fa-spinner fa-spin' : 'fas fa-paper-plane'"></i> 发送
              </button>
            </div>
          </div>
        </template>
        <!-- 空状态 -->
        <div v-else class="chat-empty">
          <i class="fas fa-comments fa-4x" style="color:#ddd;"></i>
          <p>请从左侧选择一个会话开始聊天</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import { wechatRobotApi } from '@/api/modules/wechatRobot'
import api from '@/api'

const route = useRoute()
const isAdmin = computed(() => route.path.startsWith('/admin'))
function apiPrefix() { return isAdmin.value ? '/admin' : '/user' }

const selectedRobotId = ref('')
const robots = ref([])
const conversations = ref([])
const convSearch = ref('')
const selectedWxid = ref(null)
const currentConv = ref(null)
const messages = ref([])
const msgLoading = ref(false)
const sendContent = ref('')
const sending = ref(false)
const deviceOnline = ref(false)
const mobileShowConv = ref(true)
const chatMsgRef = ref(null)

const filteredConversations = computed(() => {
  if (!convSearch.value) return conversations.value
  const kw = convSearch.value.toLowerCase()
  return conversations.value.filter(c =>
    (c.nickname || '').toLowerCase().includes(kw) ||
    (c.remark || '').toLowerCase().includes(kw) ||
    (c.wxid || '').toLowerCase().includes(kw)
  )
})

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d)) return t
  const today = new Date()
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function getMsgAvatar(m) {
  if (m.is_self || m.direction === 'send') {
    const robot = robots.value.find(r => r.id == selectedRobotId.value)
    return robot?.avatar || ''
  }
  return m.from_avatar || currentConv.value?.avatar || ''
}

async function loadRobots() {
  try {
    const url = `${apiPrefix()}/wechat-robot/accounts`
    const res = await api.get(url)
    robots.value = res?.data?.data || res?.data || []
    if (robots.value.length && !selectedRobotId.value) {
      selectedRobotId.value = robots.value[0].id
    }
  } catch { robots.value = [] }
}

function onRobotChange() {
  selectedWxid.value = null; currentConv.value = null; messages.value = []
  loadConversations(); checkDevice()
}

async function loadConversations() {
  if (!selectedRobotId.value) { conversations.value = []; return }
  try {
    const res = await api.get(`${apiPrefix()}/wechat-robot/${selectedRobotId.value}/conversations`)
    const d = res?.data?.data || res?.data || []
    conversations.value = Array.isArray(d) ? d : (d.list || [])
  } catch { conversations.value = [] }
}

function selectConv(c) {
  selectedWxid.value = c.wxid || c.contact_wxid
  currentConv.value = c
  mobileShowConv.value = false
  loadMessages()
}

async function loadMessages() {
  if (!selectedRobotId.value || !selectedWxid.value) return
  msgLoading.value = true
  try {
    const res = await api.get(`${apiPrefix()}/wechat-robot/${selectedRobotId.value}/messages/${selectedWxid.value}`, {
      params: { page: 1, per_page: 50 }
    })
    const d = res?.data?.data || res?.data || []
    messages.value = (Array.isArray(d) ? d : (d.list || d.data || [])).reverse()
    nextTick(scrollToBottom)
  } catch { messages.value = [] }
  msgLoading.value = false
}

function scrollToBottom() {
  if (chatMsgRef.value) chatMsgRef.value.scrollTop = chatMsgRef.value.scrollHeight
}

async function handleSend() {
  const content = sendContent.value?.trim()
  if (!content || !selectedRobotId.value || !selectedWxid.value) return
  sending.value = true
  try {
    await api.post(`${apiPrefix()}/wechat-robot/${selectedRobotId.value}/messages`, { toWxid: selectedWxid.value, content })
    messages.value.push({ id: Date.now(), content, is_self: true, msg_type: 'text', created_at: new Date().toISOString() })
    sendContent.value = ''
    nextTick(scrollToBottom)
  } catch (err) { ElMessage.error(err?.response?.data?.message || '发送失败') }
  sending.value = false
}

async function handleSyncContacts() {
  if (!selectedRobotId.value) return
  try {
    await api.post(`${apiPrefix()}/wechat-robot/${selectedRobotId.value}/contacts/sync`, {}, { timeout: 180000 })
    ElMessage.success('同步已发起')
    setTimeout(loadConversations, 3000)
  } catch (err) { ElMessage.error(err?.response?.data?.message || '同步失败') }
}

async function checkDevice() {
  if (!selectedRobotId.value) { deviceOnline.value = false; return }
  try {
    const statusUrl = isAdmin.value
      ? `/admin/wechat-robot/${selectedRobotId.value}/device-status`
      : `/user/wechat-robot/check-device-status/${selectedRobotId.value}`
    const res = await api.get(statusUrl)
    const d = res?.data?.data || res?.data || {}
    deviceOnline.value = d.is_online === true || d.status === 'online'
  } catch { deviceOnline.value = false }
}

function previewImage(url) {
  window.open(url, '_blank')
}

onMounted(() => loadRobots().then(() => { loadConversations(); checkDevice() }))
</script>

<style scoped>
.messages-page { display: flex; flex-direction: column; height: calc(100vh - 120px); min-height: 500px; }

.msg-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; background: #fff; border-bottom: 1px solid #E5E5E5;
  flex-shrink: 0;
}
.toolbar-left { display: flex; align-items: center; gap: 12px; }
.toolbar-right { display: flex; gap: 8px; }
.robot-select { padding: 6px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.85rem; min-width: 150px; }
.device-status { font-size: 0.8rem; padding: 4px 10px; border-radius: 12px; }
.device-status.online { background: rgba(7,193,96,0.1); color: #07C160; }
.device-status.offline { background: rgba(136,136,136,0.1); color: #888; }
.device-status i { font-size: 8px; margin-right: 4px; }

.tool-btn {
  background: #fff; border: 1px solid #ddd; padding: 6px 12px;
  border-radius: 6px; font-size: 0.8rem; cursor: pointer; color: #555;
  display: flex; align-items: center; gap: 4px; transition: all 0.2s;
}
.tool-btn:hover { border-color: #07C160; color: #07C160; }
.tool-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.chat-container { display: flex; flex: 1; overflow: hidden; background: #f5f5f5; }

/* 会话列表 */
.conv-panel {
  width: 300px; flex-shrink: 0; background: #fff;
  border-right: 1px solid #E5E5E5; display: flex; flex-direction: column;
}
.conv-search {
  padding: 10px 12px; border-bottom: 1px solid #f0f0f0;
  display: flex; align-items: center; gap: 8px;
}
.conv-search i { color: #999; font-size: 14px; }
.conv-search input { flex: 1; border: none; outline: none; font-size: 0.85rem; }
.conv-list { flex: 1; overflow-y: auto; }
.conv-item {
  display: flex; align-items: center; padding: 12px 14px;
  cursor: pointer; border-bottom: 1px solid #f5f5f5; transition: background 0.15s;
}
.conv-item:hover { background: #FAFAFA; }
.conv-item.active { background: #E8F5E9; }
.conv-avatar {
  width: 44px; height: 44px; border-radius: 10px; overflow: hidden;
  background: #F7F7F7; display: flex; align-items: center; justify-content: center;
  font-size: 18px; color: #07C160; flex-shrink: 0;
}
.conv-avatar img { width: 100%; height: 100%; object-fit: cover; }
.conv-info { flex: 1; margin-left: 10px; min-width: 0; }
.conv-name { font-weight: 500; font-size: 0.9rem; color: #191919; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conv-preview { font-size: 0.78rem; color: #999; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conv-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; margin-left: 8px; }
.conv-time { font-size: 0.7rem; color: #bbb; }
.unread-badge {
  background: #E53935; color: #fff; font-size: 0.65rem;
  padding: 1px 6px; border-radius: 10px; min-width: 16px; text-align: center;
}
.conv-empty { padding: 40px 0; text-align: center; color: #ccc; }

/* 聊天区 */
.chat-panel { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.chat-header {
  padding: 14px 16px; background: #fff; border-bottom: 1px solid #E5E5E5;
  font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 10px;
}
.mobile-back { display: none; background: none; border: none; cursor: pointer; font-size: 1.1rem; color: #666; }
.chat-messages { flex: 1; overflow-y: auto; padding: 16px; }
.msg-loading { text-align: center; color: #999; padding: 20px; }
.msg-empty { text-align: center; color: #ccc; padding: 40px; }
.msg-row { display: flex; margin-bottom: 16px; gap: 10px; }
.msg-row.self { flex-direction: row-reverse; }
.msg-avatar {
  width: 36px; height: 36px; border-radius: 8px; overflow: hidden;
  background: #f0f0f0; display: flex; align-items: center; justify-content: center;
  font-size: 14px; color: #aaa; flex-shrink: 0;
}
.msg-avatar img { width: 100%; height: 100%; object-fit: cover; }
.msg-bubble { max-width: 65%; }
.msg-text {
  background: #fff; padding: 10px 14px; border-radius: 12px;
  font-size: 0.9rem; line-height: 1.5; word-break: break-word;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.msg-row.self .msg-text { background: #07C160; color: #fff; }
.msg-image img { max-width: 200px; border-radius: 8px; cursor: pointer; }
.msg-time-label { display: block; font-size: 0.7rem; color: #bbb; margin-top: 4px; }
.msg-row.self .msg-time-label { text-align: right; }

.chat-input { background: #fff; border-top: 1px solid #E5E5E5; padding: 10px 16px; }
.input-toolbar { display: flex; gap: 12px; margin-bottom: 8px; }
.input-tool { background: none; border: none; color: #888; font-size: 1rem; cursor: pointer; }
.input-tool:hover { color: #07C160; }
.chat-input textarea {
  width: 100%; border: 1px solid #eee; border-radius: 8px; padding: 8px 12px;
  font-size: 0.88rem; resize: none; outline: none; box-sizing: border-box;
}
.chat-input textarea:focus { border-color: #07C160; }
.input-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
.btn-send {
  background: #07C160; border: none; color: #fff; padding: 8px 20px;
  border-radius: 8px; cursor: pointer; font-size: 0.85rem;
  display: flex; align-items: center; gap: 6px; transition: all 0.2s;
}
.btn-send:hover { background: #06AD56; }
.btn-send:disabled { opacity: 0.5; cursor: not-allowed; }

.chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #ccc; }
.chat-empty p { margin-top: 16px; }

@media (max-width: 767px) {
  .conv-panel { position: absolute; left: 0; top: 0; bottom: 0; width: 85%; z-index: 10; transform: translateX(-100%); transition: transform 0.3s; }
  .conv-panel.mobile-open { transform: translateX(0); }
  .mobile-back { display: block; }
  .msg-toolbar { flex-wrap: wrap; gap: 8px; }
  .toolbar-right { flex-wrap: wrap; }
}
</style>
