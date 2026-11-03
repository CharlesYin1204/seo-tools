<template>
  <div class="watermark-plugin">
    <div class="plugin-card">
      <div class="plugin-card-header"><i class="fas fa-stamp me-2"></i>批量水印工具</div>
      <div class="plugin-card-body">
        <div class="wm-layout">
          <div class="wm-config">
            <h6>水印设置</h6>
            <div class="mb-3">
              <label class="form-label">水印文字</label>
              <input v-model="config.text" class="form-control" placeholder="例：ExpatHome 内容资产" />
            </div>
            <div class="row mb-3">
              <div class="col-6"><label class="form-label">字体大小</label><input v-model.number="config.fontSize" type="number" class="form-control" min="10" max="100" /></div>
              <div class="col-6"><label class="form-label">透明度(%)</label><input v-model.number="config.opacity" type="number" class="form-control" min="5" max="100" /></div>
            </div>
            <div class="row mb-3">
              <div class="col-6"><label class="form-label">颜色</label><input v-model="config.color" type="color" class="form-control form-control-color" /></div>
              <div class="col-6"><label class="form-label">旋转角度</label><input v-model.number="config.rotate" type="number" class="form-control" min="-90" max="90" /></div>
            </div>
            <div class="mb-3">
              <label class="form-label">位置</label>
              <select v-model="config.position" class="form-select">
                <option value="tile">平铺水印</option><option value="center">居中</option>
                <option value="bottomRight">右下角</option><option value="bottomLeft">左下角</option>
                <option value="topRight">右上角</option><option value="topLeft">左上角</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">上传图片（支持批量选择）</label>
              <input type="file" accept="image/*" multiple @change="onFilesChange" class="form-control" />
            </div>
            <button class="btn btn-primary w-100" @click="applyWatermark" :disabled="processing || !images.length">
              <i class="fas" :class="processing ? 'fa-spinner fa-spin' : 'fa-magic'"></i>
              {{ processing ? '处理中...' : `添加水印 (${images.length}张)` }}
            </button>
          </div>
          <div class="wm-preview">
            <h6>预览 ({{ processedImages.length > 0 ? '已处理' : '原图' }})</h6>
            <div class="image-grid" v-if="images.length">
              <div v-for="(img, i) in (processedImages.length ? processedImages : images)" :key="i" class="img-item">
                <img :src="img.dataUrl" class="img-preview" />
                <div class="img-actions">
                  <a :href="img.dataUrl" :download="img.name || 'watermarked.png'" class="btn btn-sm btn-success"><i class="fas fa-download"></i></a>
                  <button class="btn btn-sm btn-outline-danger" @click="removeImage(i)"><i class="fas fa-times"></i></button>
                </div>
              </div>
            </div>
            <div v-else class="empty-state"><i class="fas fa-images"></i><p>请上传图片</p></div>
            <button v-if="processedImages.length > 1" class="btn btn-success mt-3 w-100" @click="downloadAll"><i class="fas fa-download me-1"></i>批量下载全部</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

defineProps({ plugin: Object })

const config = reactive({ text: 'ExpatHome', fontSize: 24, opacity: 30, color: '#ffffff', rotate: -30, position: 'tile' })
const images = ref([])
const processedImages = ref([])
const processing = ref(false)

const onFilesChange = (e) => {
  processedImages.value = []
  const files = Array.from(e.target.files)
  files.forEach(file => {
    const reader = new FileReader()
    reader.onload = (ev) => { images.value.push({ dataUrl: ev.target.result, name: file.name }) }
    reader.readAsDataURL(file)
  })
}

const removeImage = (i) => {
  if (processedImages.value.length) processedImages.value.splice(i, 1)
  else images.value.splice(i, 1)
}

const applyWatermark = async () => {
  if (!images.value.length) return ElMessage.warning('请上传图片')
  if (!config.text.trim()) return ElMessage.warning('请输入水印文字')
  processing.value = true
  processedImages.value = []

  for (const img of images.value) {
    try {
      const processed = await addWatermarkToImage(img.dataUrl, config)
      processedImages.value.push({ dataUrl: processed, name: 'wm_' + (img.name || 'image.png') })
    } catch (err) {
      processedImages.value.push({ ...img, name: 'error_' + img.name })
    }
  }
  processing.value = false
  ElMessage.success(`已处理 ${processedImages.value.length} 张图片`)
}

const addWatermarkToImage = (dataUrl, cfg) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width; canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)

      ctx.globalAlpha = cfg.opacity / 100
      ctx.font = `${cfg.fontSize}px Arial, sans-serif`
      ctx.fillStyle = cfg.color

      if (cfg.position === 'tile') {
        const spacing = cfg.fontSize * 5
        ctx.save(); ctx.rotate(cfg.rotate * Math.PI / 180)
        for (let x = -img.height; x < img.width + img.height; x += spacing) {
          for (let y = -img.height; y < img.height + img.width; y += spacing) {
            ctx.fillText(cfg.text, x, y)
          }
        }
        ctx.restore()
      } else {
        ctx.save(); ctx.rotate(cfg.rotate * Math.PI / 180)
        const tw = ctx.measureText(cfg.text).width
        let x, y
        switch (cfg.position) {
          case 'center': x = (img.width - tw) / 2; y = img.height / 2; break
          case 'bottomRight': x = img.width - tw - 20; y = img.height - 20; break
          case 'bottomLeft': x = 20; y = img.height - 20; break
          case 'topRight': x = img.width - tw - 20; y = cfg.fontSize + 10; break
          case 'topLeft': x = 20; y = cfg.fontSize + 10; break
          default: x = (img.width - tw) / 2; y = img.height / 2
        }
        ctx.fillText(cfg.text, x, y)
        ctx.restore()
      }
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

const downloadAll = () => {
  processedImages.value.forEach((img, i) => {
    setTimeout(() => {
      const link = document.createElement('a')
      link.href = img.dataUrl; link.download = img.name || `watermarked_${i + 1}.png`; link.click()
    }, i * 200)
  })
}
</script>

<style scoped>
.plugin-card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
.plugin-card-header { padding: 16px 20px; background: linear-gradient(135deg, #f093fb, #f5576c); color: #fff; font-size: 16px; font-weight: 600; }
.plugin-card-body { padding: 20px; }
.wm-layout { display: grid; grid-template-columns: 300px 1fr; gap: 20px; }
@media (max-width: 768px) { .wm-layout { grid-template-columns: 1fr; } }
.wm-config h6, .wm-preview h6 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.img-item { position: relative; border-radius: 6px; overflow: hidden; border: 1px solid #eee; }
.img-preview { width: 100%; height: 120px; object-fit: cover; }
.img-actions { position: absolute; top: 4px; right: 4px; display: flex; gap: 4px; }
.empty-state { text-align: center; padding: 60px 20px; color: #ccc; }
.empty-state i { font-size: 48px; }
</style>
