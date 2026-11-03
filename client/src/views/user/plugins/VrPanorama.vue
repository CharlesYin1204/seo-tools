<template>
  <div class="vr-plugin">
    <div class="plugin-card">
      <div class="plugin-card-header"><i class="fas fa-vr-cardboard me-2"></i>内容资产VR全景</div>
      <div class="plugin-card-body">
        <div class="vr-layout">
          <div class="vr-form">
            <h6>创建VR全景</h6>
            <div class="mb-3"><label class="form-label">内容资产标题</label><input v-model="form.title" class="form-control" placeholder="输入内容资产名称" /></div>
            <div class="mb-3">
              <label class="form-label">全景图片（上传360°全景照片）</label>
              <input type="file" accept="image/*" multiple @change="onImagesChange" class="form-control" />
              <div class="small text-muted mt-1">建议使用全景相机拍摄的360°图片，支持JPG/PNG格式</div>
              <div class="image-list mt-2" v-if="form.images.length">
                <div v-for="(img, i) in form.images" :key="i" class="img-thumb">
                  <img :src="img.preview" /><span class="img-name">{{ img.name }}</span>
                  <button @click="form.images.splice(i,1)"><i class="fas fa-times"></i></button>
                </div>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">场景名称（对应每张图片）</label>
              <div v-for="(img, i) in form.images" :key="i" class="mb-1">
                <input v-model="img.sceneName" class="form-control form-control-sm" :placeholder="'场景'+(i+1)+': 例如 客厅、卧室'" />
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">背景音乐</label>
              <select v-model="form.bgm" class="form-select">
                <option value="">无</option><option value="soft">轻柔钢琴</option><option value="nature">自然音效</option><option value="modern">现代简约</option>
              </select>
            </div>
            <button class="btn btn-primary w-100" @click="createVr" :disabled="saving">
              <i class="fas" :class="saving?'fa-spinner fa-spin':'fa-cube'"></i>
              {{ saving ? '生成中...' : '生成VR全景' }}
            </button>
          </div>
          <div class="vr-list">
            <h6><i class="fas fa-list me-1"></i>我的VR全景</h6>
            <div v-for="item in vrList" :key="item.id" class="vr-item">
              <div class="vr-item-head">
                <strong>{{ item.title }}</strong>
                <span class="badge bg-success">已生成</span>
              </div>
              <div class="vr-item-meta text-muted small">{{ item.data_json?.scenes || 0 }}个场景 | {{ formatTime(item.created_at) }}</div>
              <div class="vr-item-actions mt-1">
                <button class="btn btn-sm btn-outline-primary" @click="previewVr(item)"><i class="fas fa-eye me-1"></i>预览</button>
                <button class="btn btn-sm btn-outline-success" @click="copyVrLink(item)"><i class="fas fa-link me-1"></i>复制链接</button>
                <button class="btn btn-sm btn-outline-danger" @click="deleteVr(item.id)"><i class="fas fa-trash"></i></button>
              </div>
            </div>
            <div v-if="!vrList.length" class="text-center text-muted py-4"><i class="fas fa-vr-cardboard" style="font-size:36px"></i><p class="mt-2">暂无VR全景</p></div>
          </div>
        </div>

        <div v-if="showPreview" class="vr-preview-modal" @click.self="showPreview=false">
          <div class="vr-preview-box">
            <div class="vr-preview-header"><h5>{{ previewTitle }}</h5><button class="btn-close" @click="showPreview=false"></button></div>
            <div class="vr-preview-content">
              <div class="vr-viewer">
                <div class="vr-scene" v-for="(img, i) in previewImages" :key="i" :class="{ active: currentScene === i }">
                  <img :src="img.preview || img" class="vr-scene-img" />
                  <div class="scene-label">{{ img.sceneName || '场景'+(i+1) }}</div>
                </div>
                <div class="vr-controls">
                  <button @click="currentScene = Math.max(0, currentScene-1)" :disabled="currentScene===0"><i class="fas fa-chevron-left"></i></button>
                  <span>{{ currentScene+1 }} / {{ previewImages.length }}</span>
                  <button @click="currentScene = Math.min(previewImages.length-1, currentScene+1)" :disabled="currentScene>=previewImages.length-1"><i class="fas fa-chevron-right"></i></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

defineProps({ plugin: Object })
const form = reactive({ title: '', images: [], bgm: '' })
const vrList = ref([])
const saving = ref(false)
const showPreview = ref(false)
const previewTitle = ref('')
const previewImages = ref([])
const currentScene = ref(0)

const onImagesChange = (e) => {
  Array.from(e.target.files).forEach(f => {
    const r = new FileReader(); r.onload = ev => form.images.push({ preview: ev.target.result, name: f.name, sceneName: '' }); r.readAsDataURL(f)
  })
}

const createVr = async () => {
  if (!form.title.trim()) return ElMessage.warning('请输入内容资产标题')
  if (!form.images.length) return ElMessage.warning('请上传全景图片')
  saving.value = true
  try {
    await api.post('/user/plugin-exec/vr-panorama/data', {
      data_type: 'vr_tour', title: form.title,
      content: JSON.stringify(form.images.map(img => ({ sceneName: img.sceneName, name: img.name }))),
      data_json: { scenes: form.images.length, bgm: form.bgm, status: 'generated' }
    })
    ElMessage.success('VR全景已生成')
    form.title = ''; form.images = []; form.bgm = ''
    loadVrList()
  } catch { ElMessage.error('创建失败') }
  saving.value = false
}

const previewVr = (item) => {
  previewTitle.value = item.title; currentScene.value = 0
  try { previewImages.value = JSON.parse(item.content || '[]') } catch { previewImages.value = [] }
  showPreview.value = true
}

const copyVrLink = (item) => {
  const link = `${window.location.origin}/vr-tour/${item.id}`
  navigator.clipboard.writeText(link).then(() => ElMessage.success('链接已复制')).catch(() => ElMessage.info('VR链接: ' + link))
}

const deleteVr = async (id) => {
  try { await api.delete(`/user/plugin-exec/vr-panorama/data/${id}`); ElMessage.success('已删除'); loadVrList() } catch {}
}

const loadVrList = async () => {
  try {
    const res = await api.get('/user/plugin-exec/vr-panorama/data', { params: { data_type: 'vr_tour' } })
    vrList.value = (res.data?.data || []).map(r => { try { if (typeof r.data_json === 'string') r.data_json = JSON.parse(r.data_json) } catch {}; return r })
  } catch {}
}

const formatTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : ''

onMounted(loadVrList)
</script>

<style scoped>
.plugin-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.plugin-card-header { padding: 16px 20px; background: linear-gradient(135deg, #0984e3, #6c5ce7); color: #fff; font-size: 16px; font-weight: 600; }
.plugin-card-body { padding: 20px; }
.vr-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@media (max-width: 768px) { .vr-layout { grid-template-columns: 1fr; } }
h6 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.image-list { display: flex; flex-wrap: wrap; gap: 8px; }
.img-thumb { display: flex; align-items: center; gap: 6px; background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
.img-thumb img { width: 30px; height: 30px; object-fit: cover; border-radius: 3px; }
.img-thumb button { border: none; background: none; color: #e74c3c; cursor: pointer; }
.vr-item { background: #f8f9fa; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
.vr-item-head { display: flex; justify-content: space-between; align-items: center; }
.vr-preview-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.vr-preview-box { background: #fff; border-radius: 10px; width: 90%; max-width: 700px; overflow: hidden; }
.vr-preview-header { padding: 14px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
.vr-preview-header h5 { margin: 0; font-size: 16px; }
.vr-preview-content { padding: 20px; }
.vr-viewer { position: relative; }
.vr-scene { display: none; }
.vr-scene.active { display: block; }
.vr-scene-img { width: 100%; height: 400px; object-fit: cover; border-radius: 8px; }
.scene-label { text-align: center; margin-top: 8px; font-weight: 600; }
.vr-controls { display: flex; justify-content: center; gap: 16px; align-items: center; margin-top: 12px; }
.vr-controls button { border: none; background: #4879FF; color: #fff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; }
.vr-controls button:disabled { opacity: 0.4; }
</style>
