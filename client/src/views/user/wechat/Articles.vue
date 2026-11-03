<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <h3 class="page-title">微信文章</h3>
      <el-button type="primary" @click="openDialog()">写文章</el-button>
    </div>

    <div class="card-container">
      <el-table :data="articles" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="title" label="标题" min-width="200" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.status === 'published' ? 'success' : 'warning'">{{ row.status === 'published' ? '已发布' : '草稿' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column label="操作" width="160">
          <template #default="{row}">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteArticle(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="d-flex justify-content-center mt-3">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadData" />
      </div>
    </div>

    <el-dialog v-model="showDialog" :title="form.id ? '编辑文章' : '写文章'" width="700px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="摘要"><el-input v-model="form.excerpt" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="10" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="草稿" value="draft" />
            <el-option label="发布" value="published" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveArticle">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const articles = ref([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const form = ref({})

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/user/wechat/articles', { params: { page: page.value, pageSize: pageSize.value } })
    articles.value = res.data?.data || []
    total.value = res.data?.total || 0
  } catch {}
  loading.value = false
}

function openDialog(row) {
  form.value = row ? { ...row } : { status: 'draft' }
  showDialog.value = true
}

async function saveArticle() {
  saving.value = true
  try {
    if (form.value.id) {
      await api.put(`/user/wechat/articles/${form.value.id}`, form.value)
    } else {
      await api.post('/user/wechat/articles', form.value)
    }
    ElMessage.success('保存成功')
    showDialog.value = false
    loadData()
  } catch {}
  saving.value = false
}

async function deleteArticle(row) {
  await ElMessageBox.confirm('确定删除该文章？', '确认')
  try {
    await api.delete(`/user/wechat/articles/${row.id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}
</script>
