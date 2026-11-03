<template>
  <div class="tenant-card">
    <div class="head"><h3>找房需求</h3><el-button type="primary" @click="openCreate">新增需求</el-button></div>
    <el-table v-if="rows.length" :data="rows" class="mt-3"><el-table-column prop="title" label="标题"/><el-table-column prop="budget_min" label="最低预算"/><el-table-column prop="budget_max" label="最高预算"/><el-table-column prop="bedrooms" label="卧室"/><el-table-column prop="status" label="状态"/><el-table-column label="操作" width="150"><template #default="{row}"><el-button link type="primary" @click="edit(row)">编辑</el-button><el-button link type="danger" @click="remove(row.id)">删除</el-button></template></el-table-column></el-table>
    <div v-else class="empty-state mt-3">还没有找房需求，新增后中介可以更准确地匹配房源。</div>
    <el-dialog v-model="visible" :title="form.id ? '编辑需求' : '新增需求'" width="640px"><el-form label-width="100px" :model="form"><el-form-item label="标题"><el-input v-model="form.title"/></el-form-item><el-form-item label="预算"><div class="range"><el-input-number v-model="form.budget_min" :min="0"/><span>-</span><el-input-number v-model="form.budget_max" :min="0"/></div></el-form-item><el-form-item label="卧室"><el-input-number v-model="form.bedrooms" :min="0"/></el-form-item><el-form-item label="入住日期"><el-date-picker v-model="form.move_in_date" value-format="YYYY-MM-DD" type="date"/></el-form-item><el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="4"/></el-form-item></el-form><template #footer><el-button @click="visible=false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template></el-dialog>
  </div>
</template>
<script setup>
import { onMounted, reactive, ref } from 'vue'; import { ElMessage, ElMessageBox } from 'element-plus'; import { tenantApi } from '@/api/modules/tenant'
const rows=ref([]), visible=ref(false); const form=reactive({id:null,title:'',budget_min:null,budget_max:null,bedrooms:null,move_in_date:'',description:''})
async function load(){rows.value=(await tenantApi.getDemands()).data||[]} function openCreate(){Object.assign(form,{id:null,title:'',budget_min:null,budget_max:null,bedrooms:null,move_in_date:'',description:''});visible.value=true} function edit(row){Object.assign(form,row);visible.value=true}
async function save(){ if(form.id) await tenantApi.updateDemand(form.id,form); else await tenantApi.createDemand(form); visible.value=false; ElMessage.success('已保存'); load() }
async function remove(id){ await ElMessageBox.confirm('确定删除这条需求吗？','提示'); await tenantApi.deleteDemand(id); ElMessage.success('已删除'); load() }
onMounted(load)
</script><style scoped>.head{display:flex;justify-content:space-between;align-items:center}.head h3{font-size:16px;margin:0}.range{display:flex;align-items:center;gap:10px}</style>
