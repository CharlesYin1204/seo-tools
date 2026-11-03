<template>
  <div class="intro-image-plugin">
    <!-- 步骤1: 选择内容资产 -->
    <div class="step-card" v-if="!selectedProperty">
      <div class="step-header"><i class="fas fa-home me-2"></i>选择内容资产</div>
      <div class="step-body">
        <el-input v-model="searchKw" placeholder="搜索内容资产标题/地址..." clearable size="default" @input="debounceSearch" class="mb-3" />
        <div class="property-list">
          <div v-for="p in propertyList" :key="p.id" class="property-item" @click="selectProperty(p)">
            <div class="property-item-info">
              <div class="property-item-title">{{ p.title || p.address || '未命名内容资产' }}</div>
              <div class="property-item-meta">
                <span v-if="p.price">¥{{ Number(p.price).toLocaleString() }}/月</span>
                <span v-if="p.district">{{ p.district }}</span>
                <span v-if="p.bedrooms">{{ p.bedrooms }}室</span>
              </div>
            </div>
            <i class="fas fa-chevron-right"></i>
          </div>
          <div v-if="!propertyList.length" class="empty-list">
            <i class="fas fa-inbox"></i>
            <p>暂无内容资产数据</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 步骤2: 配置并预览 -->
    <div v-if="selectedProperty" class="config-area">
      <div class="config-toolbar">
        <el-button size="small" @click="selectedProperty = null"><i class="fas fa-arrow-left me-1"></i>重新选择</el-button>
        <div class="config-right">
          <el-select v-model="templateId" size="small" style="width:130px" @change="renderPreview">
            <el-option v-for="t in templates" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
          <el-button type="primary" size="small" @click="downloadImage" :loading="downloading">
            <i class="fas fa-download me-1"></i>下载PNG图片
          </el-button>
        </div>
      </div>

      <!-- 联系方式和二维码配置 -->
      <div class="config-row">
        <div class="config-item">
          <label>联系方式</label>
          <el-input v-model="contactInfo" placeholder="微信号/手机号" size="small" />
        </div>
        <div class="config-item">
          <label>网站链接（生成二维码）</label>
          <el-input v-model="websiteUrl" placeholder="https://..." size="small" />
        </div>
        <div class="config-item">
          <label>品牌名</label>
          <el-input v-model="brandName" placeholder="ExpatHome" size="small" />
        </div>
      </div>

      <!-- 海报预览 -->
      <div class="poster-preview-wrap">
        <div ref="posterRef" class="poster-canvas" :style="{ background: currentTemplate.bg }">
          <!-- 顶部区块 -->
          <div class="poster-top">
            <div class="poster-badge">{{ currentTemplate.badge }}</div>
            <div class="poster-brand-top">{{ brandName || 'ExpatHome' }}</div>
          </div>

          <!-- 内容资产图片区域 -->
          <div class="poster-image-area">
            <img v-if="propertyImage" :src="propertyImage" class="poster-main-img" crossorigin="anonymous" />
            <div v-else class="poster-no-img"><i class="fas fa-image"></i><span>暂无图片</span></div>
          </div>

          <!-- 内容资产信息 -->
          <div class="poster-info-area" :style="{ color: currentTemplate.textColor }">
            <h2 class="poster-title">{{ selectedProperty.title || selectedProperty.address || '内容资产标题' }}</h2>
            <div class="poster-price-row">
              <span class="poster-price">¥{{ Number(selectedProperty.price || 0).toLocaleString() }}</span>
              <span class="poster-price-unit">/月</span>
            </div>

            <div class="poster-details">
              <div class="poster-detail-item" v-if="selectedProperty.bedrooms">
                <i class="fas fa-bed"></i>
                <span>{{ selectedProperty.bedrooms }}室{{ selectedProperty.bathrooms ? selectedProperty.bathrooms + '卫' : '' }}</span>
              </div>
              <div class="poster-detail-item" v-if="selectedProperty.area">
                <i class="fas fa-expand-arrows-alt"></i>
                <span>{{ selectedProperty.area }}m²</span>
              </div>
              <div class="poster-detail-item" v-if="selectedProperty.district">
                <i class="fas fa-map-marker-alt"></i>
                <span>{{ selectedProperty.district }}</span>
              </div>
              <div class="poster-detail-item" v-if="selectedProperty.subway_line || selectedProperty.metro_line">
                <i class="fas fa-subway"></i>
                <span>{{ selectedProperty.subway_line || selectedProperty.metro_line }}</span>
              </div>
            </div>

            <!-- 内容资产特点标签 -->
            <div class="poster-tags" v-if="featureTags.length">
              <span v-for="tag in featureTags" :key="tag" class="poster-tag">{{ tag }}</span>
            </div>
          </div>

          <!-- 底部: 联系方式 + 二维码 -->
          <div class="poster-footer">
            <div class="poster-contact-area">
              <div class="poster-contact-label">联系咨询</div>
              <div class="poster-contact-value">{{ contactInfo || '请设置联系方式' }}</div>
              <div class="poster-website" v-if="websiteUrl">{{ websiteUrl }}</div>
            </div>
            <div class="poster-qr" v-if="qrCodeUrl">
              <img :src="qrCodeUrl" crossorigin="anonymous" class="poster-qr-img" />
              <span class="poster-qr-label">扫码查看</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

defineProps({ plugin: Object })

const propertyList = ref([])
const selectedProperty = ref(null)
const searchKw = ref('')
const templateId = ref('modern')
const contactInfo = ref('')
const websiteUrl = ref('')
const brandName = ref('ExpatHome')
const downloading = ref(false)
const posterRef = ref(null)
const propertyImage = ref(null)

const templates = [
  { id: 'modern', name: '现代简约', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', badge: '优质内容资产', textColor: '#fff' },
  { id: 'luxury', name: '高端大气', bg: 'linear-gradient(135deg, #0c0c1d 0%, #1a1a3e 50%, #2d2d6b 100%)', badge: '豪华推荐', textColor: '#d4af37' },
  { id: 'fresh', name: '清新自然', bg: 'linear-gradient(135deg, #e0f7fa 0%, #fff3e0 100%)', badge: '精选好房', textColor: '#333' },
  { id: 'warm', name: '暖色温馨', bg: 'linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)', badge: '温馨推荐', textColor: '#fff' },
  { id: 'dark', name: '商务深色', bg: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', badge: '商务臻选', textColor: '#fff' },
]

const currentTemplate = computed(() => templates.find(t => t.id === templateId.value) || templates[0])

const featureTags = computed(() => {
  if (!selectedProperty.value) return []
  const tags = []
  const p = selectedProperty.value
  if (p.furnished && p.furnished !== 'no') tags.push('精装修')
  if (p.pets_allowed) tags.push('可养宠物')
  let features = p.features
  if (typeof features === 'string') { try { features = JSON.parse(features) } catch { features = null } }
  if (Array.isArray(features)) {
    features.forEach(f => {
      if (typeof f === 'string') tags.push(f)
      else if (f?.name) tags.push(f.name)
    })
  }
  if (!tags.length) {
    if (p.subway_line || p.metro_line) tags.push('近地铁')
    if (p.bedrooms >= 3) tags.push('大户型')
    tags.push('拎包入住')
  }
  return tags.slice(0, 5)
})

const qrCodeUrl = computed(() => {
  if (!websiteUrl.value) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(websiteUrl.value)}`
})

let searchTimer = null
const debounceSearch = () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadProperties, 300)
}

const loadProperties = async () => {
  try {
    const res = await api.get('/user/plugin-exec/crm/properties-search', { params: { keyword: searchKw.value, pageSize: 50 } })
    propertyList.value = res.data?.data || res.data || []
  } catch { propertyList.value = [] }
}

const selectProperty = async (p) => {
  selectedProperty.value = { ...p }
  if (!websiteUrl.value) {
    websiteUrl.value = `${window.location.origin}/property/${p.id}`
  }
  let images = p.images
  if (typeof images === 'string') { try { images = JSON.parse(images) } catch { images = null } }
  if (Array.isArray(images) && images.length) {
    const firstImg = images[0]
    propertyImage.value = typeof firstImg === 'string' ? firstImg : firstImg?.url || firstImg?.path || null
  } else {
    propertyImage.value = null
  }
}

const downloadImage = async () => {
  const el = posterRef.value
  if (!el) return ElMessage.warning('请先选择内容资产')
  downloading.value = true
  try {
    const { default: html2canvas } = await import('https://esm.sh/html2canvas@1.4.1')
    const canvas = await html2canvas(el, { useCORS: true, scale: 2, backgroundColor: null, allowTaint: true })
    const link = document.createElement('a')
    link.download = `property-intro-${selectedProperty.value?.id || Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    ElMessage.success('图片已下载')
  } catch (err) {
    console.error('html2canvas failed', err)
    ElMessage.warning('图片生成失败，请尝试截图保存')
  }
  downloading.value = false
}

onMounted(loadProperties)
</script>

<style scoped>
.intro-image-plugin { max-width: 100%; }

.step-card {
  background: #fff; border-radius: 10px; overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
}
.step-header {
  padding: 16px 20px; background: linear-gradient(135deg, #43e97b, #38f9d7);
  color: #fff; font-size: 16px; font-weight: 600;
}
.step-body { padding: 20px; }

.property-list { max-height: 500px; overflow-y: auto; }
.property-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px; border-bottom: 1px solid #f5f5f5;
  cursor: pointer; transition: all 0.2s; border-radius: 8px;
}
.property-item:hover { background: #f0f7ff; }
.property-item-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
.property-item-meta { font-size: 12px; color: #888; display: flex; gap: 10px; }
.property-item-meta span:first-child { color: #F56C6C; font-weight: 600; }
.property-item i { color: #ccc; font-size: 12px; }
.empty-list { text-align: center; padding: 40px; color: #ccc; }
.empty-list i { font-size: 36px; margin-bottom: 8px; display: block; }
.empty-list p { color: #999; }

/* 配置区域 */
.config-area { }
.config-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px; flex-wrap: wrap; gap: 8px;
}
.config-right { display: flex; gap: 8px; align-items: center; }

.config-row {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
  margin-bottom: 16px; background: #fff; padding: 16px; border-radius: 10px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.05);
}
.config-item label { font-size: 12px; color: #888; display: block; margin-bottom: 4px; }

/* 海报预览 */
.poster-preview-wrap {
  display: flex; justify-content: center; padding: 20px;
  background: #f5f6fa; border-radius: 10px;
}
.poster-canvas {
  width: 400px; border-radius: 16px; overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15); position: relative;
}

.poster-top {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px;
}
.poster-badge {
  background: rgba(255,255,255,0.2); padding: 4px 14px; border-radius: 20px;
  font-size: 12px; color: #fff; backdrop-filter: blur(4px);
}
.poster-brand-top { font-size: 12px; color: rgba(255,255,255,0.7); font-weight: 600; }

.poster-image-area {
  width: 100%; height: 220px; overflow: hidden;
}
.poster-main-img { width: 100%; height: 100%; object-fit: cover; }
.poster-no-img {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px;
  background: rgba(0,0,0,0.1); color: rgba(255,255,255,0.5);
  font-size: 14px;
}
.poster-no-img i { font-size: 36px; }

.poster-info-area { padding: 20px; }
.poster-title { font-size: 18px; font-weight: 700; margin: 0 0 10px; line-height: 1.3; }
.poster-price-row { margin-bottom: 16px; display: flex; align-items: baseline; gap: 2px; }
.poster-price { font-size: 28px; font-weight: 800; color: #FFD700; }
.poster-price-unit { font-size: 14px; color: #FFD700; opacity: 0.8; }

.poster-details {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;
}
.poster-detail-item {
  display: flex; align-items: center; gap: 6px; font-size: 13px; opacity: 0.9;
}
.poster-detail-item i { width: 16px; text-align: center; font-size: 12px; }

.poster-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.poster-tag {
  background: rgba(255,255,255,0.15); padding: 3px 10px; border-radius: 12px;
  font-size: 11px; backdrop-filter: blur(4px);
}

.poster-footer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; background: rgba(0,0,0,0.15);
  backdrop-filter: blur(8px); margin-top: 8px;
}
.poster-contact-area { flex: 1; }
.poster-contact-label { font-size: 11px; color: rgba(255,255,255,0.6); margin-bottom: 3px; }
.poster-contact-value { font-size: 15px; font-weight: 600; color: #fff; }
.poster-website { font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 3px; word-break: break-all; }

.poster-qr { text-align: center; flex-shrink: 0; }
.poster-qr-img { width: 72px; height: 72px; border-radius: 6px; border: 2px solid rgba(255,255,255,0.3); }
.poster-qr-label { display: block; font-size: 10px; color: rgba(255,255,255,0.6); margin-top: 3px; }

@media (max-width: 768px) {
  .config-row { grid-template-columns: 1fr; }
  .poster-canvas { width: 100%; max-width: 360px; }
  .config-toolbar { flex-direction: column; align-items: stretch; }
  .config-right { justify-content: flex-end; }
}
</style>
