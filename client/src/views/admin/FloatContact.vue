<template>
  <div>
    <div class="page-header"><h3 class="page-title"><i class="fas fa-comment-dots me-2"></i>悬浮弹窗设置</h3></div>
    <div class="card-container" v-loading="loading">
      <el-form :model="form" label-position="top" style="max-width:650px">
        <h5 class="section-title"><i class="fas fa-cog me-1"></i>基本设置</h5>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="是否启用">
              <el-switch v-model="form.enabled" active-text="启用" inactive-text="关闭" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="显示位置">
              <el-select v-model="form.position" style="width:100%">
                <el-option label="右下角" value="bottom-right" />
                <el-option label="左下角" value="bottom-left" />
                <el-option label="右上角" value="top-right" />
                <el-option label="左上角" value="top-left" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="自动展开">
              <el-switch v-model="form.auto_expand" active-text="是" inactive-text="否" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="移动端显示">
              <el-switch v-model="form.show_on_mobile" active-text="显示" inactive-text="隐藏" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="动画效果">
              <el-select v-model="form.animation" style="width:100%">
                <el-option label="弹跳" value="bounce" />
                <el-option label="淡入" value="fade" />
                <el-option label="滑入" value="slide" />
                <el-option label="无" value="none" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="主题颜色">
              <el-color-picker v-model="form.theme_color" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider />
        <h5 class="section-title"><i class="fas fa-address-book me-1"></i>联系方式</h5>

        <el-form-item label="联系电话">
          <el-input v-model="form.phone" placeholder="联系电话"><template #prefix><i class="fas fa-phone"></i></template></el-input>
        </el-form-item>
        <el-form-item label="邮箱地址">
          <el-input v-model="form.email" placeholder="联系邮箱"><template #prefix><i class="fas fa-envelope"></i></template></el-input>
        </el-form-item>
        <el-form-item label="微信号">
          <el-input v-model="form.wechat_id" placeholder="微信号"><template #prefix><i class="fab fa-weixin"></i></template></el-input>
        </el-form-item>
        <el-form-item label="微信二维码URL">
          <el-input v-model="form.wechat_qr_url" placeholder="微信二维码图片链接" />
          <div v-if="form.wechat_qr_url" class="mt-2">
            <img :src="form.wechat_qr_url" alt="微信二维码预览" class="qr-preview" />
          </div>
        </el-form-item>
        <el-form-item label="WhatsApp">
          <el-input v-model="form.whatsapp" placeholder="WhatsApp号码(含国际区号)"><template #prefix><i class="fab fa-whatsapp"></i></template></el-input>
        </el-form-item>
        <el-form-item label="Telegram">
          <el-input v-model="form.telegram" placeholder="Telegram用户名"><template #prefix><i class="fab fa-telegram"></i></template></el-input>
        </el-form-item>
        <el-form-item label="Facebook Messenger">
          <el-input v-model="form.facebook_messenger" placeholder="Facebook Messenger链接"><template #prefix><i class="fab fa-facebook-messenger"></i></template></el-input>
        </el-form-item>
        <el-form-item label="在线聊天链接">
          <el-input v-model="form.chat_url" placeholder="在线客服链接"><template #prefix><i class="fas fa-comments"></i></template></el-input>
        </el-form-item>

        <el-divider />
        <h5 class="section-title"><i class="fas fa-link me-1"></i>自定义链接</h5>
        <div v-for="(link, idx) in form.custom_links" :key="idx" class="custom-link-row">
          <el-row :gutter="8" align="middle">
            <el-col :span="5">
              <el-input v-model="link.icon" placeholder="图标类名" size="small" />
            </el-col>
            <el-col :span="7">
              <el-input v-model="link.label" placeholder="显示文字" size="small" />
            </el-col>
            <el-col :span="9">
              <el-input v-model="link.url" placeholder="链接地址" size="small" />
            </el-col>
            <el-col :span="3">
              <el-button type="danger" size="small" plain @click="removeCustomLink(idx)"><i class="fas fa-trash"></i></el-button>
            </el-col>
          </el-row>
        </div>
        <el-button size="small" @click="addCustomLink" class="mt-2"><i class="fas fa-plus me-1"></i>添加自定义链接</el-button>

        <el-divider />
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="saveConfig"><i class="fas fa-save me-1"></i>保存设置</el-button>
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
  phone: '',
  email: '',
  wechat_id: '',
  wechat_qr_url: '',
  whatsapp: '',
  telegram: '',
  facebook_messenger: '',
  chat_url: '',
  position: 'bottom-right',
  enabled: true,
  auto_expand: false,
  show_on_mobile: true,
  animation: 'bounce',
  theme_color: '#2F80ED',
  custom_links: [],
})

onMounted(async () => {
  loading.value = true
  try {
    const res = await api.get('/admin/float-contact')
    if (res.data) {
      const d = res.data
      if (typeof d.custom_links === 'string') {
        try { d.custom_links = JSON.parse(d.custom_links) } catch { d.custom_links = [] }
      }
      if (!Array.isArray(d.custom_links)) d.custom_links = []
      Object.assign(form, d)
    }
  } catch (e) {
    console.error('加载悬浮设置失败:', e)
  }
  loading.value = false
})

function addCustomLink() {
  form.custom_links.push({ icon: 'fas fa-link', label: '', url: '' })
}

function removeCustomLink(idx) {
  form.custom_links.splice(idx, 1)
}

async function saveConfig() {
  saving.value = true
  try {
    await api.post('/admin/float-contact', { ...form })
    ElMessage.success('保存成功')
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  }
  saving.value = false
}
</script>

<style scoped>
.page-header { margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 600; margin: 0; display: flex; align-items: center; }
.card-container {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #333;
}
.qr-preview {
  max-width: 150px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}
.custom-link-row {
  margin-bottom: 8px;
}
.me-1 { margin-right: 4px; }
.me-2 { margin-right: 8px; }
.mt-2 { margin-top: 8px; }
</style>
