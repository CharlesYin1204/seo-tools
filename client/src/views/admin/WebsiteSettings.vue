<template>
  <div>
    <div class="page-header"><h3 class="page-title"><i class="fas fa-globe me-2"></i>网站设置</h3></div>
    <el-tabs v-model="activeTab" type="card">
      <!-- 基本信息 -->
      <el-tab-pane label="基本信息" name="basic">
        <div class="card-container" v-loading="loading">
          <el-form :model="config" label-width="140px" style="max-width:700px">
            <el-form-item label="网站名称"><el-input v-model="config.site_name" placeholder="请输入网站名称" /></el-form-item>
            <el-form-item label="网站副标题"><el-input v-model="config.site_subtitle" placeholder="网站副标题" /></el-form-item>
            <el-form-item label="网站描述">
              <el-input v-model="config.site_description" type="textarea" :rows="3" placeholder="网站描述" />
            </el-form-item>
            <el-form-item label="网站Logo">
              <el-input v-model="config.site_logo" placeholder="Logo URL">
                <template #append><i class="fas fa-image"></i></template>
              </el-input>
              <div v-if="config.site_logo" class="preview-img mt-2">
                <img :src="config.site_logo" alt="Logo预览" />
              </div>
            </el-form-item>
            <el-form-item label="网站图标(Favicon)">
              <el-input v-model="config.site_favicon" placeholder="Favicon URL">
                <template #append><i class="fas fa-image"></i></template>
              </el-input>
            </el-form-item>
            <el-form-item label="备案号"><el-input v-model="config.icp_number" placeholder="如：京ICP备XXXXXXXX号" /></el-form-item>
            <el-form-item label="版权信息"><el-input v-model="config.copyright" placeholder="© 2024 Company Name" /></el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveConfig"><i class="fas fa-save me-1"></i>保存设置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- 联系方式 -->
      <el-tab-pane label="联系方式" name="contact">
        <div class="card-container" v-loading="loading">
          <el-form :model="config" label-width="140px" style="max-width:700px">
            <el-form-item label="联系电话"><el-input v-model="config.contact_phone" placeholder="联系电话"><template #prefix><i class="fas fa-phone"></i></template></el-input></el-form-item>
            <el-form-item label="联系邮箱"><el-input v-model="config.contact_email" placeholder="联系邮箱"><template #prefix><i class="fas fa-envelope"></i></template></el-input></el-form-item>
            <el-form-item label="联系地址"><el-input v-model="config.contact_address" placeholder="联系地址"><template #prefix><i class="fas fa-map-marker-alt"></i></template></el-input></el-form-item>
            <el-form-item label="微信号"><el-input v-model="config.wechat_id" placeholder="微信号"><template #prefix><i class="fab fa-weixin"></i></template></el-input></el-form-item>
            <el-form-item label="WhatsApp"><el-input v-model="config.whatsapp" placeholder="WhatsApp号码"><template #prefix><i class="fab fa-whatsapp"></i></template></el-input></el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveConfig"><i class="fas fa-save me-1"></i>保存设置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- SEO设置 -->
      <el-tab-pane label="SEO设置" name="seo">
        <div class="card-container" v-loading="loading">
          <el-form :model="config" label-width="140px" style="max-width:700px">
            <el-form-item label="SEO标题">
              <el-input v-model="config.seo_title" placeholder="SEO标题（留空则使用网站名称）" />
              <div class="form-help">搜索引擎显示的标题，建议不超过60个字符</div>
            </el-form-item>
            <el-form-item label="SEO描述">
              <el-input v-model="config.seo_description" type="textarea" :rows="3" placeholder="SEO描述" maxlength="200" show-word-limit />
              <div class="form-help">搜索引擎显示的描述，建议不超过160个字符</div>
            </el-form-item>
            <el-form-item label="SEO关键词">
              <el-input v-model="config.seo_keywords" type="textarea" :rows="2" placeholder="多个关键词用英文逗号分隔" />
              <div class="form-help">搜索引擎关键词，如：上海租房,expatriate,apartment</div>
            </el-form-item>
            <el-form-item label="Google Analytics">
              <el-input v-model="config.google_analytics_id" placeholder="GA Tracking ID (如: G-XXXXXXXXXX)" />
            </el-form-item>
            <el-form-item label="百度统计代码">
              <el-input v-model="config.baidu_analytics" placeholder="百度统计ID" />
            </el-form-item>
            <el-form-item label="自定义Head代码">
              <el-input v-model="config.custom_head_code" type="textarea" :rows="4" placeholder="会插入到<head>标签中的自定义代码" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveConfig"><i class="fas fa-save me-1"></i>保存设置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- 社交媒体 -->
      <el-tab-pane label="社交媒体" name="social">
        <div class="card-container" v-loading="loading">
          <el-form :model="config" label-width="140px" style="max-width:700px">
            <el-form-item label="微信公众号"><el-input v-model="config.wechat_official" placeholder="微信公众号名称"><template #prefix><i class="fab fa-weixin"></i></template></el-input></el-form-item>
            <el-form-item label="微信公众号二维码"><el-input v-model="config.wechat_qr_url" placeholder="微信公众号二维码图片URL" /></el-form-item>
            <el-form-item label="Facebook"><el-input v-model="config.facebook_url" placeholder="Facebook主页链接"><template #prefix><i class="fab fa-facebook"></i></template></el-input></el-form-item>
            <el-form-item label="Instagram"><el-input v-model="config.instagram_url" placeholder="Instagram链接"><template #prefix><i class="fab fa-instagram"></i></template></el-input></el-form-item>
            <el-form-item label="LinkedIn"><el-input v-model="config.linkedin_url" placeholder="LinkedIn链接"><template #prefix><i class="fab fa-linkedin"></i></template></el-input></el-form-item>
            <el-form-item label="YouTube"><el-input v-model="config.youtube_url" placeholder="YouTube频道链接"><template #prefix><i class="fab fa-youtube"></i></template></el-input></el-form-item>
            <el-form-item label="小红书"><el-input v-model="config.xiaohongshu_url" placeholder="小红书主页链接" /></el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveConfig"><i class="fas fa-save me-1"></i>保存设置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const activeTab = ref('basic')
const config = ref({})
const loading = ref(false)
const saving = ref(false)

onMounted(() => loadConfig())

async function loadConfig() {
  loading.value = true
  try {
    const res = await api.get('/admin/website-settings')
    if (res.data) config.value = res.data
  } catch (e) {
    console.error('加载网站设置失败:', e)
  }
  loading.value = false
}

async function saveConfig() {
  saving.value = true
  try {
    await api.post('/admin/website-settings', config.value)
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
.form-help {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  line-height: 1.4;
}
.preview-img img {
  max-height: 60px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}
.me-1 { margin-right: 4px; }
.me-2 { margin-right: 8px; }
.mt-2 { margin-top: 8px; }
</style>
