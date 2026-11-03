<template>
  <div>
    <div class="page-header"><h3 class="page-title">推荐返利</h3></div>

    <div class="row g-4 mb-4">
      <div class="col-md-6">
        <el-card class="h-100">
          <template #header><span>我的推荐码</span></template>
          <div class="text-center">
            <div class="fs-2 fw-bold text-primary mb-3">{{ referralCode || '暂无' }}</div>
            <el-button type="primary" @click="copyCode" :disabled="!referralCode">复制推荐码</el-button>
            <p class="text-muted mt-3 small">分享推荐码给好友，好友注册后您将获得返利奖励</p>
          </div>
        </el-card>
      </div>
      <div class="col-md-6">
        <el-card class="h-100">
          <template #header><span>推荐统计</span></template>
          <div class="row text-center">
            <div class="col-4">
              <div class="fs-3 fw-bold text-primary">{{ stats.total_referrals || 0 }}</div>
              <div class="text-muted small">推荐人数</div>
            </div>
            <div class="col-4">
              <div class="fs-3 fw-bold text-success">{{ stats.successful || 0 }}</div>
              <div class="text-muted small">成功注册</div>
            </div>
            <div class="col-4">
              <div class="fs-3 fw-bold text-warning">¥{{ stats.total_earnings || 0 }}</div>
              <div class="text-muted small">累计收益</div>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <el-card>
      <template #header><span>推荐记录</span></template>
      <el-table :data="records" stripe v-loading="loading">
        <el-table-column prop="username" label="被推荐人" />
        <el-table-column prop="registered_at" label="注册时间" />
        <el-table-column prop="reward" label="奖励金额">
          <template #default="{row}">¥{{ row.reward || 0 }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态">
          <template #default="{row}">
            <el-tag :type="row.status === 'paid' ? 'success' : 'warning'">{{ row.status === 'paid' ? '已发放' : '待发放' }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const referralCode = ref('')
const stats = ref({})
const records = ref([])
const loading = ref(false)

onMounted(() => { loadCode(); loadStats() })

async function loadCode() {
  try {
    const res = await api.get('/user/referral')
    referralCode.value = res.data?.code || ''
    records.value = res.data?.records || []
  } catch {}
}

async function loadStats() {
  loading.value = true
  try {
    const res = await api.get('/user/referral/stats')
    stats.value = res.data || {}
  } catch {}
  loading.value = false
}

function copyCode() {
  navigator.clipboard.writeText(referralCode.value)
  ElMessage.success('已复制推荐码')
}
</script>
