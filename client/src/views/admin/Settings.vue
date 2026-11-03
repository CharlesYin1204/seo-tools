<template>
  <div>
    <div class="page-header"><h3 class="page-title"><i class="fas fa-cog me-2"></i>系统设置</h3></div>
    <div class="card-container" v-loading="loading">
      <el-tabs v-model="activeTab">
        <!-- 基本设置 -->
        <el-tab-pane label="基本设置" name="basic">
          <el-form :model="settings" label-width="150px" style="max-width:700px">
            <h5 class="section-title"><i class="fas fa-globe me-2 text-primary"></i>网站基本信息</h5>
            <el-form-item label="网站名称"><el-input v-model="settings.site_name" placeholder="网站名称" /></el-form-item>
            <el-form-item label="网站描述"><el-input v-model="settings.site_description" type="textarea" :rows="3" placeholder="网站描述" /></el-form-item>
            <el-form-item label="网站关键词"><el-input v-model="settings.site_keywords" placeholder="SEO关键词，逗号分隔" /></el-form-item>
            <el-form-item label="网站Logo">
              <el-input v-model="settings.site_logo" placeholder="Logo图片URL">
                <template #append>
                  <el-button @click="previewLogo"><i class="fas fa-eye"></i></el-button>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item label="网站Favicon"><el-input v-model="settings.site_favicon" placeholder="Favicon图标URL" /></el-form-item>
            <el-form-item label="ICP备案号"><el-input v-model="settings.icp_number" placeholder="如：沪ICP备XXXXXXXX号" /></el-form-item>

            <el-divider content-position="left">显示设置</el-divider>
            <el-form-item label="时区">
              <el-select v-model="settings.timezone" style="width:100%">
                <el-option label="Asia/Shanghai (UTC+8)" value="Asia/Shanghai" />
                <el-option label="UTC" value="UTC" />
                <el-option label="America/New_York (UTC-5)" value="America/New_York" />
                <el-option label="Europe/London (UTC+0)" value="Europe/London" />
              </el-select>
            </el-form-item>
            <el-form-item label="默认语言">
              <el-select v-model="settings.language" style="width:100%">
                <el-option label="简体中文" value="zh-CN" />
                <el-option label="English" value="en" />
              </el-select>
            </el-form-item>
            <el-form-item label="日期格式">
              <el-select v-model="settings.date_format" style="width:100%">
                <el-option label="YYYY-MM-DD" value="YYYY-MM-DD" />
                <el-option label="DD/MM/YYYY" value="DD/MM/YYYY" />
                <el-option label="MM/DD/YYYY" value="MM/DD/YYYY" />
              </el-select>
            </el-form-item>
            <el-form-item label="每页显示条数">
              <el-input-number v-model="settings.items_per_page" :min="5" :max="100" :step="5" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 地图配置 -->
        <el-tab-pane label="地图配置" name="map">
          <el-form :model="settings" label-width="150px" style="max-width:700px">
            <h5 class="section-title"><i class="fas fa-map-marked-alt me-2 text-success"></i>地图服务配置</h5>
            <el-form-item label="高德地图JS API Key"><el-input v-model="settings.amap_js_key" placeholder="高德地图JS API Key" /></el-form-item>
            <el-form-item label="高德安全密钥"><el-input v-model="settings.amap_security_key" placeholder="高德地图安全密钥" /></el-form-item>
            <el-form-item label="高德Web服务Key"><el-input v-model="settings.amap_web_key" placeholder="高德Web服务API Key（地理编码用）" /></el-form-item>
            <el-form-item label="地图默认中心点">
              <div class="d-flex gap-2">
                <el-input v-model="settings.map_center_lng" placeholder="经度" style="width:50%" />
                <el-input v-model="settings.map_center_lat" placeholder="纬度" style="width:50%" />
              </div>
              <div class="form-help">默认地图中心点经纬度，如上海: 121.4737, 31.2304</div>
            </el-form-item>
            <el-form-item label="默认缩放级别">
              <el-input-number v-model="settings.map_default_zoom" :min="1" :max="18" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 邮件配置 -->
        <el-tab-pane label="邮件配置" name="mail">
          <el-form :model="settings" label-width="150px" style="max-width:700px">
            <h5 class="section-title"><i class="fas fa-envelope me-2 text-warning"></i>SMTP邮件配置</h5>
            <el-form-item label="SMTP服务器"><el-input v-model="settings.mail_host" placeholder="如：smtp.gmail.com" /></el-form-item>
            <el-form-item label="SMTP端口"><el-input v-model="settings.mail_port" placeholder="如：465" /></el-form-item>
            <el-form-item label="加密方式">
              <el-select v-model="settings.mail_encryption" style="width:100%">
                <el-option label="SSL" value="ssl" />
                <el-option label="TLS" value="tls" />
                <el-option label="无" value="none" />
              </el-select>
            </el-form-item>
            <el-form-item label="SMTP用户名"><el-input v-model="settings.mail_username" placeholder="邮箱账号" /></el-form-item>
            <el-form-item label="SMTP密码"><el-input v-model="settings.mail_password" type="password" show-password placeholder="邮箱密码或授权码" /></el-form-item>
            <el-form-item label="发件人名称"><el-input v-model="settings.mail_from_name" placeholder="发件人显示名称" /></el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 高级设置 -->
        <el-tab-pane label="高级设置" name="advanced">
          <el-form :model="settings" label-width="150px" style="max-width:700px">
            <h5 class="section-title"><i class="fas fa-tools me-2 text-danger"></i>高级设置</h5>
            <el-form-item label="维护模式"><el-switch v-model="settings.maintenance_mode" /><div class="form-help">开启后前台将显示维护页面</div></el-form-item>
            <el-form-item label="调试模式"><el-switch v-model="settings.debug_mode" /><div class="form-help">开启后将显示详细错误信息</div></el-form-item>
            <el-form-item label="自动保存"><el-switch v-model="settings.auto_save" /><div class="form-help">编辑内容时自动保存草稿</div></el-form-item>
            <el-form-item label="API速率限制">
              <el-input-number v-model="settings.api_rate_limit" :min="10" :max="1000" />
              <span class="ms-2 text-muted">次/分钟</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 链接页面设置 -->
        <el-tab-pane label="链接页面设置" name="link-display">
          <div style="max-width:800px">
            <h5 class="section-title"><i class="fas fa-list-check me-2 text-success"></i>链接页面显示内容设置</h5>
            <p class="text-muted" style="margin-bottom:20px">统一管理所有用户内容资产分享链接页面显示的内容项（全局生效）</p>

            <div class="link-field-section">
              <h6><i class="fas fa-home me-2 text-success"></i>内容资产基本信息</h6>
              <div class="link-field-grid">
                <el-checkbox v-model="linkFields.images">图片/视频</el-checkbox>
                <el-checkbox v-model="linkFields.community">小区</el-checkbox>
                <el-checkbox v-model="linkFields.price">价格</el-checkbox>
                <el-checkbox v-model="linkFields.property_code">编号</el-checkbox>
                <el-checkbox v-model="linkFields.district">区域</el-checkbox>
              </div>
            </div>

            <div class="link-field-section">
              <h6><i class="fas fa-building me-2 text-primary"></i>房屋详情</h6>
              <div class="link-field-grid">
                <el-checkbox v-model="linkFields.bedrooms">卧室</el-checkbox>
                <el-checkbox v-model="linkFields.bathrooms">洗手间</el-checkbox>
                <el-checkbox v-model="linkFields.is_duplex">复式</el-checkbox>
                <el-checkbox v-model="linkFields.outdoor_features">户外</el-checkbox>
                <el-checkbox v-model="linkFields.has_elevator">电梯</el-checkbox>
                <el-checkbox v-model="linkFields.has_parking">车位</el-checkbox>
                <el-checkbox v-model="linkFields.has_commission">佣金</el-checkbox>
              </div>
            </div>

            <div class="link-field-section">
              <h6><i class="fas fa-subway me-2 text-info"></i>交通信息</h6>
              <div class="link-field-grid">
                <el-checkbox v-model="linkFields.metro_lines">地铁线路</el-checkbox>
                <el-checkbox v-model="linkFields.metro_stations">地铁站点</el-checkbox>
              </div>
            </div>

            <div class="link-field-section">
              <h6><i class="fas fa-file-alt me-2 text-warning"></i>其他信息</h6>
              <div class="link-field-grid">
                <el-checkbox v-model="linkFields.publisher_name">发布人</el-checkbox>
                <el-checkbox v-model="linkFields.contact_info">联系方式</el-checkbox>
                <el-checkbox v-model="linkFields.publish_time">发布时间</el-checkbox>
              </div>
            </div>

            <div class="link-field-section">
              <h6><i class="fas fa-address-card me-2 text-danger"></i>联系模块</h6>
              <el-checkbox v-model="linkFields.show_contact_us"><strong>显示联系我们模块</strong></el-checkbox>
            </div>

            <div class="link-field-section">
              <h6><i class="fas fa-language me-2 text-primary"></i>默认语言</h6>
              <el-radio-group v-model="linkFields.default_language">
                <el-radio value="en">English (默认)</el-radio>
                <el-radio value="zh">中文</el-radio>
              </el-radio-group>
            </div>

            <el-button type="primary" @click="saveLinkFields" :loading="savingLinkFields" style="margin-top:16px">
              <i class="fas fa-save me-1"></i>保存链接页面设置
            </el-button>
          </div>
        </el-tab-pane>
      </el-tabs>

      <div class="save-bar">
        <el-button type="primary" @click="save" :loading="saving" size="large">
          <i class="fas fa-save me-1"></i>保存设置
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const activeTab = ref('basic')
const settings = reactive({
  site_name: '', site_description: '', site_keywords: '',
  site_logo: '', site_favicon: '', icp_number: '',
  timezone: 'Asia/Shanghai', language: 'zh-CN', date_format: 'YYYY-MM-DD',
  items_per_page: 20,
  amap_js_key: '', amap_security_key: '', amap_web_key: '',
  amap_api_key: '',
  map_center_lng: '121.4737', map_center_lat: '31.2304', map_default_zoom: 12,
  mail_host: '', mail_port: '465', mail_encryption: 'ssl',
  mail_username: '', mail_password: '', mail_from_name: '',
  maintenance_mode: false, debug_mode: false, auto_save: true,
  api_rate_limit: 60,
})
const loading = ref(true)
const saving = ref(false)
const savingLinkFields = ref(false)

const linkFields = reactive({
  images: true, community: false, price: true, property_code: true, district: true,
  bedrooms: true, bathrooms: true, is_duplex: false, outdoor_features: true,
  has_elevator: true, has_parking: true, has_commission: false,
  metro_lines: true, metro_stations: true,
  publisher_name: false, contact_info: false, publish_time: false,
  show_contact_us: true,
  default_language: 'en',
})

onMounted(async () => {
  try {
    const res = await api.get('/admin/settings')
    const data = res.data?.data || res.data || {}
    Object.keys(data).forEach(k => { if (k in settings) settings[k] = data[k] })
    if (data.amap_api_key && !settings.amap_js_key) settings.amap_js_key = data.amap_api_key
  } catch { /* use defaults */ }
  try {
    const res2 = await api.get('/admin/link-display-settings')
    const ld = res2.data?.data || res2.data || {}
    Object.keys(ld).forEach(k => { if (k in linkFields) linkFields[k] = ld[k] })
  } catch { /* use defaults */ }
  loading.value = false
})

async function save() {
  saving.value = true
  try {
    await api.post('/admin/settings', { ...settings })
    ElMessage.success('保存成功')
  } catch (e) { ElMessage.error(e?.response?.data?.message || '保存失败') }
  saving.value = false
}

function previewLogo() {
  if (settings.site_logo) window.open(settings.site_logo, '_blank')
}

async function saveLinkFields() {
  savingLinkFields.value = true
  try {
    await api.post('/admin/link-display-settings', { ...linkFields })
    ElMessage.success('链接页面设置已保存')
  } catch (e) { ElMessage.error(e?.response?.data?.message || '保存失败') }
  savingLinkFields.value = false
}
</script>

<style scoped>
.page-header { margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 600; margin: 0; display: flex; align-items: center; }
.card-container {
  background: white; border-radius: 12px; padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
.section-title { font-size: 16px; font-weight: 600; margin: 0 0 20px; color: #333; display: flex; align-items: center; }
.form-help { font-size: 12px; color: #999; margin-top: 4px; }
.save-bar { margin-top: 24px; padding-top: 20px; border-top: 1px solid #E0E0E0; }
.d-flex { display: flex; }
.gap-2 { gap: 8px; }
.me-1 { margin-right: 4px; }
.me-2 { margin-right: 8px; }
.ms-2 { margin-left: 8px; }
.text-muted { color: #999; }
.link-field-section {
  background: #f8f9fa; border-radius: 10px; padding: 16px; margin-bottom: 16px;
}
.link-field-section h6 { font-weight: 600; margin-bottom: 12px; color: #333; }
.link-field-grid {
  display: flex; flex-wrap: wrap; gap: 12px;
}
</style>
