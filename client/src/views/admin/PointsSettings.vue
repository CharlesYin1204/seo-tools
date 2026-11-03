<template>
  <div>
    <div class="page-header"><h3 class="page-title">积分设置</h3></div>
    <div class="card-container" v-loading="loading">
      <el-form :model="form" label-position="top" style="max-width:600px">
        <el-form-item label="注册奖励积分">
          <el-input v-model="form.register_points" type="number" placeholder="新用户注册赠送积分">
            <template #append>积分</template>
          </el-input>
        </el-form-item>
        <el-form-item label="每日签到奖励">
          <el-input v-model="form.checkin_points" type="number" placeholder="每日签到奖励积分">
            <template #append>积分</template>
          </el-input>
        </el-form-item>
        <el-form-item label="分享奖励积分">
          <el-input v-model="form.share_points" type="number" placeholder="分享内容奖励积分">
            <template #append>积分</template>
          </el-input>
        </el-form-item>
        <el-form-item label="发布内容资产奖励">
          <el-input v-model="form.publish_points" type="number" placeholder="发布内容资产奖励积分">
            <template #append>积分</template>
          </el-input>
        </el-form-item>
        <el-form-item label="积分兑换比例">
          <el-input v-model="form.exchange_rate" type="number" placeholder="多少积分=1元">
            <template #prepend>积分</template>
            <template #append>= 1 元</template>
          </el-input>
        </el-form-item>
        <el-form-item label="积分系统启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="saveSettings">保存设置</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const saving = ref(false)
const form = reactive({
  register_points: 100,
  checkin_points: 10,
  share_points: 5,
  publish_points: 50,
  exchange_rate: 100,
  enabled: true,
})

onMounted(async () => {
  loading.value = true
  try {
    const res = await api.get('/admin/points-settings')
    if (res.data) Object.assign(form, res.data)
  } catch {}
  loading.value = false
})

async function saveSettings() {
  saving.value = true
  try {
    await api.post('/admin/points-settings', { ...form })
    ElMessage.success('保存成功')
  } catch {}
  saving.value = false
}
</script>

<style scoped>
.page-container { padding: 20px; }
</style>
