<template>
  <div class="page-container">
    <div class="page-header d-flex align-items-center justify-content-between">
      <h3 class="page-title mb-0">通知中心</h3>
      <el-button size="small" @click="markAllRead" :disabled="!hasUnread">全部标记已读</el-button>
    </div>

    <el-card v-loading="loading">
      <div v-if="notifications.length" class="notification-list">
        <div
          v-for="item in notifications"
          :key="item.id"
          class="notification-item"
          :class="{ 'is-unread': !item.is_read }"
        >
          <div class="notification-dot" v-if="!item.is_read"></div>
          <div class="notification-body">
            <div class="notification-title">{{ item.title }}</div>
            <p class="notification-content">{{ item.content }}</p>
            <span class="notification-time">{{ item.created_at }}</span>
          </div>
          <div class="notification-actions">
            <el-button
              v-if="!item.is_read"
              link
              type="primary"
              size="small"
              @click="markRead(item)"
            >标记已读</el-button>
            <el-button
              link
              type="danger"
              size="small"
              @click="removeNotification(item)"
            >删除</el-button>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无通知" />

      <div class="d-flex justify-content-center mt-3" v-if="total > pageSize">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="loadNotifications"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const notifications = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const hasUnread = computed(() => notifications.value.some((n) => !n.is_read))

async function loadNotifications() {
  loading.value = true
  try {
    const res = await api.get('/user/notifications', {
      params: { page: page.value, pageSize: pageSize.value },
    })
    notifications.value = res.data?.data || res.data || []
    total.value = res.data?.total || 0
  } catch { /* 拦截器已处理 */ }
  loading.value = false
}

async function markRead(item) {
  try {
    await api.put(`/user/notifications/${item.id}/read`)
    item.is_read = true
    ElMessage.success('已标记为已读')
  } catch { /* 拦截器已处理 */ }
}

async function markAllRead() {
  try {
    await api.put('/user/notifications/read-all')
    notifications.value.forEach((n) => { n.is_read = true })
    ElMessage.success('已全部标记为已读')
  } catch { /* 拦截器已处理 */ }
}

async function removeNotification(item) {
  try {
    await ElMessageBox.confirm('确定删除此通知？', '提示', { type: 'warning' })
    await api.delete(`/user/notifications/${item.id}`)
    notifications.value = notifications.value.filter((n) => n.id !== item.id)
    total.value = Math.max(0, total.value - 1)
    ElMessage.success('已删除')
  } catch { /* 用户取消或拦截器已处理 */ }
}

onMounted(() => loadNotifications())
</script>

<style scoped lang="scss">
.page-container {
  padding: 20px;
}
.notification-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.notification-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-md);
  border-bottom: 1px solid var(--border-color);
  transition: background 0.3s ease;
  &:last-child { border-bottom: none; }
  &:hover { background: var(--background-light); }
  &.is-unread {
    background: rgba(47, 128, 237, 0.03);
    .notification-title { font-weight: 600; }
  }
}
.notification-dot {
  width: 8px;
  height: 8px;
  min-width: 8px;
  border-radius: 50%;
  background: var(--primary-color);
  margin-top: 6px;
}
.notification-body {
  flex: 1;
  min-width: 0;
}
.notification-title {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: var(--space-xs);
}
.notification-content {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: var(--space-xs);
  line-height: 1.5;
}
.notification-time {
  font-size: 12px;
  color: #999;
}
.notification-actions {
  display: flex;
  gap: var(--space-sm);
  flex-shrink: 0;
}
</style>
