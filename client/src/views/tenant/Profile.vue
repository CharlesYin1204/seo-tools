<template>
  <div class="tenant-card">
    <el-form label-width="120px" :model="form" class="profile-form">
      <div class="form-grid">
        <el-form-item label="法定姓名"><el-input v-model="form.legal_name" /></el-form-item>
        <el-form-item label="称呼"><el-input v-model="form.preferred_name" /></el-form-item>
        <el-form-item label="国籍"><el-input v-model="form.nationality" /></el-form-item>
        <el-form-item label="护照/证件"><el-input v-model="form.passport_no" /></el-form-item>
        <el-form-item label="微信号"><el-input v-model="form.wechat_id" /></el-form-item>
        <el-form-item label="偏好语言"><el-select v-model="form.preferred_language"><el-option label="English" value="en"/><el-option label="中文" value="zh"/></el-select></el-form-item>
        <el-form-item label="入住日期"><el-date-picker v-model="form.move_in_date" value-format="YYYY-MM-DD" type="date" /></el-form-item>
        <el-form-item label="租期(月)"><el-input-number v-model="form.lease_months" :min="1" :max="60" /></el-form-item>
        <el-form-item label="最低预算"><el-input-number v-model="form.budget_min" :min="0" /></el-form-item>
        <el-form-item label="最高预算"><el-input-number v-model="form.budget_max" :min="0" /></el-form-item>
        <el-form-item label="公司/学校"><el-input v-model="form.company_or_school" /></el-form-item>
        <el-form-item label="通勤地址"><el-input v-model="form.commute_address" /></el-form-item>
        <el-form-item label="入住人数"><el-input-number v-model="form.occupants" :min="1" :max="20" /></el-form-item>
        <el-form-item label="携带宠物"><el-switch v-model="form.has_pet" /></el-form-item>
      </div>
      <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="4" /></el-form-item>
      <el-form-item><el-button type="primary" :loading="loading" @click="save">保存资料</el-button></el-form-item>
    </el-form>
  </div>
</template>
<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { tenantApi } from '@/api/modules/tenant'
const loading = ref(false)
const form = reactive({ legal_name:'', preferred_name:'', nationality:'', passport_no:'', wechat_id:'', preferred_language:'en', move_in_date:'', lease_months:12, budget_min:null, budget_max:null, company_or_school:'', commute_address:'', occupants:1, has_pet:false, notes:'' })
onMounted(async () => { Object.assign(form, (await tenantApi.getProfile()).data || {}) ; form.has_pet = !!form.has_pet })
async function save() { loading.value = true; try { await tenantApi.updateProfile(form); ElMessage.success('租客资料已保存') } finally { loading.value = false } }
</script>
<style scoped>.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 18px}.profile-form{max-width:980px}:deep(.el-select),:deep(.el-date-editor){width:100%}@media(max-width:760px){.form-grid{grid-template-columns:1fr}:deep(.el-form-item){display:block}:deep(.el-form-item__label){justify-content:flex-start}}</style>
