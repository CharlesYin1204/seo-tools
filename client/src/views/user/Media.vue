<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-center">
      <h3 class="page-title">媒体库</h3>
      <el-upload action="" :before-upload="handleUpload" :show-file-list="false" accept="image/*,video/*">
        <el-button type="primary">上传文件</el-button>
      </el-upload>
    </div>

    <div class="card-container">
      <div v-loading="loading">
        <div class="row g-3" v-if="mediaList.length">
          <div class="col-6 col-md-3 col-lg-2" v-for="item in mediaList" :key="item.id">
            <div class="card border-0 shadow-sm position-relative media-card">
              <img v-if="item.type === 'image'" :src="item.url" class="card-img-top" style="height:140px;object-fit:cover" :alt="item.name">
              <div v-else class="card-img-top d-flex align-items-center justify-content-center bg-light" style="height:140px">
                <el-icon :size="48" color="#999"><VideoCamera /></el-icon>
              </div>
              <div class="card-body p-2">
                <small class="text-truncate d-block">{{ item.name }}</small>
                <small class="text-muted">{{ item.size_text }}</small>
              </div>
              <el-button class="position-absolute top-0 end-0 m-1" type="danger" size="small" circle @click="deleteMedia(item)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无媒体文件" />
      </div>

      <div class="d-flex justify-content-center mt-3">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="loadData" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, VideoCamera } from '@element-plus/icons-vue'

const mediaList = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(24)
const total = ref(0)

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const res = await api.get('/user/media', { params: { page: page.value, pageSize: pageSize.value } })
    mediaList.value = res.data?.data || []
    total.value = res.data?.total || 0
  } catch {}
  loading.value = false
}

async function handleUpload(file) {
  const formData = new FormData()
  formData.append('file', file)
  try {
    await api.post('/user/media/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    ElMessage.success('上传成功')
    loadData()
  } catch {}
  return false
}

async function deleteMedia(item) {
  await ElMessageBox.confirm('确定删除该文件？', '确认')
  try {
    await api.delete(`/user/media/${item.id}`)
    ElMessage.success('删除成功')
    loadData()
  } catch {}
}
</script>

<style scoped>
.media-card { transition: transform 0.2s; }
.media-card:hover { transform: scale(1.03); }
</style>
