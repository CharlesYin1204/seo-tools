<template>
  <div class="link-settings-page">
    <!-- 未购买功能模块：全屏遮罩 + 居中弹窗 -->
    <teleport to="body">
      <div v-if="featureBlocked" class="fb-mask">
        <div class="fb-modal">
          <div class="fb-icon"><i class="fas fa-lock"></i></div>
          <h3 class="fb-title">功能未开通</h3>
          <p class="fb-desc">您尚未购买「内容资产库管理」功能模块，<br>开通后即可浏览所有内容资产、上传管理等功能。</p>
          <button class="fb-btn fb-btn-primary" @click="router.push('/user/membership')">
            <i class="fas fa-crown"></i> 前往购买会员
          </button>
          <button class="fb-btn fb-btn-secondary" @click="router.push('/user/dashboard')">返回首页</button>
        </div>
      </div>
    </teleport>

    <!-- 页面头部 - 紫色渐变（与PHP版一致） -->
    <div class="page-header-purple">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <h2><i class="fas fa-address-book me-2"></i>客服设置</h2>
          <p class="mb-0 opacity-90">设置您的联系方式，将展示在内容资产分享链接和内容资产详情页面</p>
        </div>
      </div>
    </div>

    <div class="row" v-loading="loading">
      <!-- 联系我们设置 -->
      <div class="col-lg-8 mx-auto mb-4">
        <div class="module-card">
          <div class="module-title">
            <span class="module-icon"><i class="fas fa-address-book"></i></span>
            <span>联系我们信息设置</span>
          </div>
          <p class="text-muted mb-3">设置链接页面和内容资产详情页底部显示的联系方式</p>

          <div class="mb-3">
            <label class="form-label"><i class="fab fa-weixin me-2 text-success"></i>微信号</label>
            <el-input v-model="form.contact.wechat_id" placeholder="请输入微信号" />
          </div>

          <div class="mb-3">
            <label class="form-label"><i class="fas fa-phone me-2 text-primary"></i>手机号码</label>
            <el-input v-model="form.contact.phone" placeholder="请输入手机号码" />
          </div>

          <div class="mb-3">
            <label class="form-label"><i class="fas fa-envelope me-2 text-info"></i>邮箱地址</label>
            <el-input v-model="form.contact.email" placeholder="请输入邮箱地址" type="email" />
          </div>

          <div class="mb-3">
            <label class="form-label"><i class="fas fa-qrcode me-2 text-success"></i>微信二维码</label>
            <div class="qrcode-upload-area" @click="triggerQrcodeUpload">
              <div v-if="form.contact.qrcode_url">
                <img :src="form.contact.qrcode_url" class="qrcode-preview" alt="二维码">
                <p class="text-muted mt-2 mb-0" style="font-size: 12px">点击更换</p>
              </div>
              <div v-else>
                <i class="fas fa-cloud-upload-alt fa-2x text-muted mb-2"></i>
                <p class="text-muted mb-0">点击上传微信二维码图片</p>
                <small class="text-muted">支持 JPG、PNG 格式</small>
              </div>
            </div>
            <input ref="qrcodeInput" type="file" accept="image/*" style="display: none" @change="handleQrcodeUpload" />
          </div>

          <div class="mb-3">
            <label class="form-label"><i class="fas fa-comment-dots me-2 text-warning"></i>附加说明</label>
            <el-input v-model="form.contact.note" type="textarea" :rows="2" placeholder="如：工作时间 9:00-18:00" />
          </div>

          <hr />

          <!-- 预览效果 -->
          <h6 class="mb-3"><i class="fas fa-eye me-2"></i>预览效果</h6>
          <div class="contact-info-preview">
            <template v-if="hasContactInfo">
              <div v-if="form.contact.wechat_id" class="contact-preview-item">
                <i class="fab fa-weixin"></i>
                <span class="label">微信号</span>
                <span class="value">{{ form.contact.wechat_id }}</span>
              </div>
              <div v-if="form.contact.phone" class="contact-preview-item">
                <i class="fas fa-phone"></i>
                <span class="label">手机</span>
                <span class="value">{{ form.contact.phone }}</span>
              </div>
              <div v-if="form.contact.email" class="contact-preview-item">
                <i class="fas fa-envelope"></i>
                <span class="label">邮箱</span>
                <span class="value">{{ form.contact.email }}</span>
              </div>
              <div v-if="form.contact.qrcode_url" class="text-center mt-2">
                <img :src="form.contact.qrcode_url" style="max-width: 100px; border-radius: 6px" alt="二维码">
              </div>
              <div v-if="form.contact.note" class="mt-2 text-muted" style="font-size: 13px">
                <i class="fas fa-info-circle me-1"></i>{{ form.contact.note }}
              </div>
            </template>
            <div v-else class="text-center text-muted">
              <i class="fas fa-address-card fa-2x mb-2"></i>
              <p class="mb-0">填写信息后可预览效果</p>
            </div>
          </div>

          <div class="d-flex gap-2 mt-3">
            <el-button type="primary" class="btn-purple" :loading="saving" @click="saveSettings">
              <i class="fas fa-save me-1"></i>保存设置
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/api'

const router = useRouter()
const featureBlocked = ref(false)
const loading = ref(false)
const saving = ref(false)
const qrcodeInput = ref(null)

const fieldGroups = {
  basic: [
    { key: 'images', label: '图片/视频' },
    { key: 'description', label: '内容资产描述' },
    { key: 'community', label: '小区' },
    { key: 'price', label: '价格' },
    { key: 'property_code', label: '编号' },
    { key: 'district', label: '区域' },
  ],
  detail: [
    { key: 'bedrooms', label: '卧室' },
    { key: 'bathrooms', label: '洗手间' },
    { key: 'is_duplex', label: '复式' },
    { key: 'outdoor_features', label: '户外' },
    { key: 'has_elevator', label: '电梯' },
    { key: 'has_parking', label: '车位' },
    { key: 'has_commission', label: '佣金' },
  ],
  traffic: [
    { key: 'metro_lines', label: '地铁线路' },
    { key: 'metro_stations', label: '地铁站点' },
  ],
  other: [
    { key: 'publisher_name', label: '发布人' },
    { key: 'contact_info', label: '联系方式' },
    { key: 'publish_time', label: '发布时间' },
  ],
}

const defaultDisplayFields = {}
Object.values(fieldGroups).forEach(group => {
  group.forEach(f => { defaultDisplayFields[f.key] = true })
})

const form = reactive({
  display_fields: { ...defaultDisplayFields },
  show_contact_us: true,
  contact: {
    wechat_id: '',
    phone: '',
    email: '',
    qrcode_url: '',
    note: '',
  },
  default_language: 'en',
})

const hasContactInfo = computed(() => {
  return form.contact.wechat_id || form.contact.phone || form.contact.email || form.contact.qrcode_url
})

function triggerQrcodeUpload() {
  qrcodeInput.value?.click()
}

async function handleQrcodeUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await api.post('/user/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    const url = res.data?.data?.url || res.data?.url || ''
    if (url) {
      form.contact.qrcode_url = url
      ElMessage.success('二维码上传成功')
    }
  } catch {
    ElMessage.error('上传失败')
  }
  e.target.value = ''
}

async function fetchSettings() {
  loading.value = true
  try {
    const res = await api.get('/user/link-settings')
    const data = res.data?.data || res.data
    if (data) {
      if (data.display_fields) Object.assign(form.display_fields, data.display_fields)
      if (data.show_contact_us !== undefined) form.show_contact_us = data.show_contact_us
      if (data.contact) Object.assign(form.contact, data.contact)
      if (data.default_language) form.default_language = data.default_language
    }
  } catch {}
  loading.value = false
}

async function saveSettings() {
  saving.value = true
  try {
    await api.post('/user/link-settings', {
      display_fields: form.display_fields,
      show_contact_us: form.show_contact_us,
      contact: form.contact,
      default_language: form.default_language,
    })
    ElMessage.success('设置保存成功')
  } catch {
    ElMessage.error('保存失败，请重试')
  }
  saving.value = false
}

onMounted(async () => {
  try {
    const checkRes = await api.get('/user/feature-modules/check/property-library')
    const access = checkRes.data
    if (access && access.allowed === false) {
      featureBlocked.value = true
      return
    }
  } catch (e) {
    if (e.response?.status === 403) {
      featureBlocked.value = true
      return
    }
  }
  fetchSettings()
})
</script>

<style scoped>
.link-settings-page { max-width: 1200px; }

/* 紫色渐变头部 - 与PHP版一致 */
.page-header-purple {
  background: linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%);
  color: white;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}
.page-header-purple h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 8px; }
.page-header-purple p { opacity: 0.9; margin-bottom: 0; }

/* 作用范围说明 */
.scope-info {
  background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
  border-left: 4px solid #4CAF50;
}
.scope-info h5 { color: #2E7D32; font-weight: 600; margin-bottom: 8px; font-size: 1rem; }
.scope-info ul { margin: 0; padding-left: 20px; }
.scope-info li { color: #388E3C; margin-bottom: 4px; font-size: 14px; }

/* 模块卡片 */
.module-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}
.module-title {
  font-size: 1.1rem; font-weight: 600; color: #191919;
  margin-bottom: 20px; display: flex; align-items: center;
}
.module-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%);
  color: white; display: inline-flex; align-items: center; justify-content: center;
  margin-right: 12px;
}

/* 链接设置卡片 */
.link-settings-card {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}
.link-settings-card h6 { font-weight: 600; margin-bottom: 12px; color: #333; }
.link-field-checkbox {
  display: flex; flex-wrap: wrap; gap: 10px;
}
.field-check-item {
  background: white;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  transition: border-color 0.2s;
}
.field-check-item:hover { border-color: #9C27B0; }

/* 紫色按钮 */
.btn-purple {
  background: #9C27B0 !important;
  border-color: #9C27B0 !important;
  color: white !important;
}
.btn-purple:hover { background: #8E24AA !important; border-color: #8E24AA !important; }

/* 二维码上传区 */
.qrcode-upload-area {
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}
.qrcode-upload-area:hover { border-color: #9C27B0; background: #fdf5ff; }
.qrcode-preview { max-width: 120px; max-height: 120px; border-radius: 8px; }

/* 联系信息预览 */
.contact-info-preview {
  background: #f3e5f5;
  border-radius: 8px;
  padding: 12px;
}
.contact-preview-item {
  display: flex; align-items: center; padding: 8px 0;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}
.contact-preview-item:last-child { border-bottom: none; }
.contact-preview-item i { width: 30px; color: #9C27B0; }
.contact-preview-item .label { width: 60px; color: #666; font-size: 13px; }
.contact-preview-item .value { flex: 1; font-weight: 500; }

/* 响应式 */
@media (max-width: 767px) {
  .page-header-purple { padding: 14px 16px; border-radius: 10px; margin-bottom: 12px; }
  .page-header-purple h2 { font-size: 1.1rem; }
  .module-card { padding: 12px; border-radius: 10px; }
  .link-settings-card { padding: 10px; }
  .link-field-checkbox { gap: 6px; }
  .field-check-item { padding: 4px 8px; }
}

/* 功能未开通弹窗 - 非 scoped */
.fb-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 99999;
  background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
}
.fb-modal {
  background: #fff; border-radius: 16px; padding: 40px 36px 32px;
  max-width: 400px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.fb-icon {
  width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 32px;
}
.fb-title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin: 0 0 12px; }
.fb-desc { font-size: 14px; color: #666; line-height: 1.8; margin: 0 0 28px; }
.fb-btn {
  display: block; width: 240px; margin: 0 auto; padding: 12px 0;
  border-radius: 8px; font-size: 15px; cursor: pointer; transition: all 0.2s;
}
.fb-btn + .fb-btn { margin-top: 12px; }
.fb-btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2); color: #fff;
  border: none; font-weight: 600;
}
.fb-btn-primary:hover { transform: translateY(-2px); }
.fb-btn-primary i { margin-right: 6px; }
.fb-btn-secondary {
  background: transparent; color: #999; font-weight: 500;
  border: 1px solid #ddd;
}
.fb-btn-secondary:hover { color: #666; }
</style>
