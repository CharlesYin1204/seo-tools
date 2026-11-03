<template>
  <div>
    <div class="page-header"><h3 class="page-title">营销设置</h3></div>
    <div class="card-container" v-loading="loading">
      <el-form :model="form" label-position="top" style="max-width:700px">
        <el-form-item label="营销文案标题">
          <el-input v-model="form.title" placeholder="推广活动标题" />
        </el-form-item>
        <el-form-item label="营销文案内容">
          <el-input v-model="form.content" type="textarea" :rows="5" placeholder="推广活动详细描述..." />
        </el-form-item>
        <el-form-item label="推广横幅图片">
          <el-input v-model="form.banner_url" placeholder="横幅图片URL" />
          <div v-if="form.banner_url" class="mt-2">
            <img :src="form.banner_url" alt="横幅预览" style="max-width:400px;max-height:120px;border:1px solid #e0e0e0;border-radius:4px" />
          </div>
        </el-form-item>
        <el-form-item label="推广链接">
          <el-input v-model="form.promotion_url" placeholder="点击跳转的目标链接" />
        </el-form-item>
        <el-form-item label="折扣配置">
          <div class="d-flex gap-3 align-items-center flex-wrap">
            <el-input v-model="form.discount_percent" type="number" style="width:160px" placeholder="折扣百分比">
              <template #append>%</template>
            </el-input>
            <span style="color:#999">有效期：</span>
            <el-date-picker v-model="form.discount_start" type="date" placeholder="开始日期" style="width:160px" />
            <span>至</span>
            <el-date-picker v-model="form.discount_end" type="date" placeholder="结束日期" style="width:160px" />
          </div>
        </el-form-item>
        <el-form-item label="推广功能开关">
          <el-switch v-model="form.promotion_enabled" active-text="开启" inactive-text="关闭" />
        </el-form-item>
        <el-form-item label="折扣功能开关">
          <el-switch v-model="form.discount_enabled" active-text="开启" inactive-text="关闭" />
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
  title: '',
  content: '',
  banner_url: '',
  promotion_url: '',
  discount_percent: 0,
  discount_start: '',
  discount_end: '',
  promotion_enabled: false,
  discount_enabled: false,
})

onMounted(async () => {
  loading.value = true
  try {
    const res = await api.get('/admin/marketing-settings')
    if (res.data) Object.assign(form, res.data)
  } catch {}
  loading.value = false
})

async function saveSettings() {
  saving.value = true
  try {
    await api.post('/admin/marketing-settings', { ...form })
    ElMessage.success('保存成功')
  } catch {}
  saving.value = false
}
</script>

<style scoped>
.page-container { padding: 20px; }
</style>
