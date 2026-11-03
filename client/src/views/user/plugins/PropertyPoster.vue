<template>
  <div class="poster-plugin">
    <div class="plugin-card">
      <div class="plugin-card-header"><i class="fas fa-image me-2"></i>内容资产海报生成器</div>
      <div class="plugin-card-body">
        <div class="poster-layout">
          <div class="poster-config">
            <h6>海报配置</h6>
            <div class="mb-3">
              <label class="form-label">内容资产标题</label>
              <input v-model="form.title" class="form-control" placeholder="例：浦东陆家嘴精装3房2厅" />
            </div>
            <div class="mb-3">
              <label class="form-label">价格</label>
              <input v-model="form.price" class="form-control" placeholder="例：¥18,000/月" />
            </div>
            <div class="mb-3">
              <label class="form-label">面积/户型</label>
              <input v-model="form.area" class="form-control" placeholder="例：120m² | 3室2厅" />
            </div>
            <div class="mb-3">
              <label class="form-label">位置</label>
              <input v-model="form.location" class="form-control" placeholder="例：浦东新区世纪大道88号" />
            </div>
            <div class="mb-3">
              <label class="form-label">亮点标签（逗号分隔）</label>
              <input v-model="form.tags" class="form-control" placeholder="例：地铁口,精装修,拎包入住" />
            </div>
            <div class="mb-3">
              <label class="form-label">联系方式</label>
              <input v-model="form.contact" class="form-control" placeholder="例：微信号 / 手机号" />
            </div>
            <div class="mb-3">
              <label class="form-label">内容资产图片</label>
              <input type="file" accept="image/*" @change="onImageChange" class="form-control" />
            </div>
            <div class="mb-3">
              <label class="form-label">模板风格</label>
              <div class="template-options">
                <div v-for="t in templates" :key="t.id" class="template-option" :class="{ active: form.template === t.id }" @click="form.template = t.id">
                  <div class="template-preview" :style="{ background: t.bg }">
                    <span class="template-name">{{ t.name }}</span>
                  </div>
                </div>
              </div>
            </div>
            <button class="btn btn-primary w-100" @click="generatePoster" :disabled="generating">
              <i class="fas" :class="generating ? 'fa-spinner fa-spin' : 'fa-magic'"></i>
              {{ generating ? '生成中...' : '生成海报' }}
            </button>
          </div>
          <div class="poster-preview">
            <h6>海报预览</h6>
            <div ref="posterRef" class="poster-canvas" :style="posterStyle">
              <div class="poster-overlay"></div>
              <img v-if="imagePreview" :src="imagePreview" class="poster-bg-img" />
              <div class="poster-content">
                <div class="poster-badge">{{ currentTemplate.badge || '优质内容资产' }}</div>
                <h2 class="poster-title">{{ form.title || '内容资产标题' }}</h2>
                <div class="poster-price">{{ form.price || '¥0/月' }}</div>
                <div class="poster-info">
                  <span v-if="form.area"><i class="fas fa-expand-arrows-alt"></i> {{ form.area }}</span>
                  <span v-if="form.location"><i class="fas fa-map-marker-alt"></i> {{ form.location }}</span>
                </div>
                <div class="poster-tags" v-if="form.tags">
                  <span v-for="tag in form.tags.split(',')" :key="tag" class="poster-tag">{{ tag.trim() }}</span>
                </div>
                <div class="poster-footer">
                  <div class="poster-contact"><i class="fas fa-phone-alt"></i> {{ form.contact || '联系我' }}</div>
                  <div class="poster-brand">ExpatHome</div>
                </div>
              </div>
            </div>
            <div class="preview-actions mt-3" v-if="posterGenerated">
              <button class="btn btn-success" @click="downloadPoster"><i class="fas fa-download me-1"></i>下载海报</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'

defineProps({ plugin: Object })

const templates = [
  { id: 'modern', name: '现代简约', bg: 'linear-gradient(135deg,#667eea,#764ba2)', badge: '品质推荐', textColor: '#fff' },
  { id: 'luxury', name: '高端奢华', bg: 'linear-gradient(135deg,#1a1a2e,#16213e)', badge: '豪华内容资产', textColor: '#d4af37' },
  { id: 'fresh', name: '清新自然', bg: 'linear-gradient(135deg,#a8edea,#fed6e3)', badge: '优质好房', textColor: '#333' },
  { id: 'warm', name: '温馨家居', bg: 'linear-gradient(135deg,#f5af19,#f12711)', badge: '温馨之选', textColor: '#fff' },
]

const form = reactive({ title: '', price: '', area: '', location: '', tags: '', contact: '', template: 'modern' })
const imagePreview = ref(null)
const generating = ref(false)
const posterGenerated = ref(false)
const posterRef = ref(null)

const currentTemplate = computed(() => templates.find(t => t.id === form.template) || templates[0])
const posterStyle = computed(() => ({ background: currentTemplate.value.bg }))

const onImageChange = (e) => {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => { imagePreview.value = ev.target.result }
  reader.readAsDataURL(file)
}

const generatePoster = () => {
  if (!form.title) return ElMessage.warning('请输入内容资产标题')
  generating.value = true
  setTimeout(() => { generating.value = false; posterGenerated.value = true; ElMessage.success('海报已生成！') }, 800)
}

const downloadPoster = async () => {
  try {
    const el = posterRef.value
    if (!el) return
    const { default: html2canvas } = await import('https://esm.sh/html2canvas@1.4.1')
    const canvas = await html2canvas(el, { useCORS: true, scale: 2 })
    const link = document.createElement('a')
    link.download = `poster-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    ElMessage.success('海报已下载')
  } catch {
    const el = posterRef.value
    const data = el.outerHTML
    const blob = new Blob([`<html><head><style>*{margin:0;padding:0;box-sizing:border-box;font-family:system-ui}</style></head><body>${data}</body></html>`], { type: 'text/html' })
    const link = document.createElement('a')
    link.download = `poster-${Date.now()}.html`
    link.href = URL.createObjectURL(blob)
    link.click()
    ElMessage.info('已导出HTML格式，请在浏览器中打开后截图保存')
  }
}
</script>

<style scoped>
.plugin-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.plugin-card-header { padding: 16px 20px; background: linear-gradient(135deg, #f093fb, #f5576c); color: #fff; font-size: 16px; font-weight: 600; }
.plugin-card-body { padding: 20px; }
.poster-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media (max-width: 768px) {
  .poster-layout { grid-template-columns: 1fr; gap: 14px; }
  .plugin-card-header { padding: 12px 14px; font-size: 14px; }
  .plugin-card-body { padding: 14px; }
  .template-options { grid-template-columns: repeat(3, 1fr); gap: 6px; }
}
.poster-config h6, .poster-preview h6 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.template-options { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.template-option { cursor: pointer; border-radius: 6px; overflow: hidden; border: 2px solid transparent; }
.template-option.active { border-color: #4879FF; }
.template-preview { padding: 8px; text-align: center; color: #fff; font-size: 11px; border-radius: 4px; min-height: 40px; display: flex; align-items: center; justify-content: center; }
.poster-canvas { position: relative; width: 100%; max-width: 400px; min-height: 560px; border-radius: 12px; overflow: hidden; color: #fff; }
.poster-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); z-index: 1; }
.poster-bg-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.poster-content { position: relative; z-index: 2; padding: 24px; display: flex; flex-direction: column; min-height: 560px; }
.poster-badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-bottom: 16px; backdrop-filter: blur(4px); align-self: flex-start; }
.poster-title { font-size: 22px; font-weight: 700; margin-bottom: 10px; line-height: 1.3; }
.poster-price { font-size: 28px; font-weight: 800; color: #FFD700; margin-bottom: 16px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
.poster-info { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; font-size: 13px; }
.poster-info i { margin-right: 6px; width: 16px; text-align: center; }
.poster-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: auto; padding-bottom: 20px; }
.poster-tag { background: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 12px; font-size: 11px; backdrop-filter: blur(4px); }
.poster-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 14px; margin-top: auto; }
.poster-contact { font-size: 13px; }
.poster-brand { font-size: 12px; opacity: 0.7; }
</style>
