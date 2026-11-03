<template>
  <div>
    <div class="page-header"><h3 class="page-title">推荐设置</h3></div>
    <div class="card-container" v-loading="loading">
      <el-form :model="form" label-position="top" style="max-width:600px">
        <el-form-item label="推荐人奖励金额">
          <el-input v-model="form.referrer_reward" type="number" placeholder="推荐人获得的奖励金额">
            <template #append>元</template>
          </el-input>
        </el-form-item>
        <el-form-item label="被推荐人奖励金额">
          <el-input v-model="form.referee_reward" type="number" placeholder="被推荐人获得的奖励金额">
            <template #append>元</template>
          </el-input>
        </el-form-item>
        <el-form-item label="推荐奖励积分">
          <el-input v-model="form.referral_points" type="number" placeholder="推荐成功额外奖励积分">
            <template #append>积分</template>
          </el-input>
        </el-form-item>
        <el-form-item label="推荐链接模板">
          <el-input v-model="form.link_template" placeholder="如: https://yourdomain.com/register?ref={code}" />
          <div class="el-form-item__help" style="color:#999;font-size:12px;margin-top:4px">{code} 将被替换为用户的推荐码</div>
        </el-form-item>
        <el-form-item label="推荐有效期（天）">
          <el-input v-model="form.validity_days" type="number" placeholder="推荐链接有效期" />
        </el-form-item>
        <el-form-item label="推荐系统启用">
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
  referrer_reward: 10,
  referee_reward: 5,
  referral_points: 50,
  link_template: '',
  validity_days: 30,
  enabled: true,
})

onMounted(async () => {
  loading.value = true
  try {
    const res = await api.get('/admin/referral-settings')
    if (res.data) Object.assign(form, res.data)
  } catch {}
  loading.value = false
})

async function saveSettings() {
  saving.value = true
  try {
    await api.post('/admin/referral-settings', { ...form })
    ElMessage.success('保存成功')
  } catch {}
  saving.value = false
}
</script>

<style scoped>
.page-container { padding: 20px; }
</style>
