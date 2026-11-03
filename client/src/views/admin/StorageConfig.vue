<template>
  <div>
    <div class="page-header">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h3 class="page-title"><i class="fas fa-database me-2"></i>存储配置</h3>
          <p class="text-muted mb-0">管理各种云存储服务配置，包括阿里云OSS、腾讯云COS、亚马逊S3等</p>
        </div>
        <div class="d-flex gap-2">
          <el-button @click="loadConfig"><i class="fas fa-sync-alt me-1"></i>刷新配置</el-button>
        </div>
      </div>
    </div>

    <!-- 默认存储选择 -->
    <div class="card-container mb-4">
      <div class="card-header-bar">
        <h5 class="section-title"><i class="fas fa-star me-2 text-warning"></i>默认存储服务</h5>
        <small class="text-muted">系统将优先使用选择的存储服务</small>
      </div>
      <div class="d-flex align-items-center gap-3 mt-3">
        <div style="flex:1">
          <label class="form-label fw-bold">选择默认存储服务：</label>
          <el-select v-model="config.driver" style="width:100%" size="large">
            <el-option value="local" label="本地存储" />
            <el-option value="oss" label="阿里云OSS" />
            <el-option value="cos" label="腾讯云COS" />
            <el-option value="s3" label="亚马逊S3" />
            <el-option value="qiniu" label="七牛云存储" />
            <el-option value="upyun" label="又拍云存储" />
            <el-option value="rainyun_s3" label="雨云S3存储" />
          </el-select>
          <div class="form-help">当多个存储服务都启用时，系统将使用此处选择的存储服务作为默认上传目标</div>
        </div>
        <div>
          <el-button type="success" size="large" @click="saveConfig" :loading="saving">
            <i class="fas fa-check me-1"></i>设为默认
          </el-button>
        </div>
      </div>
    </div>

    <!-- 当前默认存储状态 -->
    <el-alert type="info" :closable="false" class="mb-4">
      <template #default>
        <i class="fas fa-info-circle me-2"></i>
        <strong>当前默认存储：</strong>
        <span>{{ storageNames[config.driver] || '未知' }}</span>
        <el-tag type="success" size="small" class="ms-2">运行中</el-tag>
      </template>
    </el-alert>

    <!-- 统计卡片 -->
    <div class="stats-row mb-4">
      <div class="stat-card border-primary">
        <div class="stat-label text-primary">已配置存储</div>
        <div class="stat-value">{{ configuredCount }}</div>
        <i class="fas fa-cloud stat-icon text-primary-light"></i>
      </div>
      <div class="stat-card border-success">
        <div class="stat-label text-success">可用存储服务</div>
        <div class="stat-value">7</div>
        <i class="fas fa-server stat-icon text-success-light"></i>
      </div>
      <div class="stat-card border-info">
        <div class="stat-label text-info">存储类型</div>
        <div class="stat-value">{{ storageNames[config.driver] || '本地' }}</div>
        <i class="fas fa-upload stat-icon text-info-light"></i>
      </div>
      <div class="stat-card border-warning">
        <div class="stat-label text-warning">状态</div>
        <div class="stat-value">正常</div>
        <i class="fas fa-database stat-icon text-warning-light"></i>
      </div>
    </div>

    <!-- 存储服务配置卡片列表 -->
    <div class="card-container mb-4">
      <div class="card-header-bar mb-3">
        <h5 class="section-title"><i class="fas fa-cloud me-2"></i>存储服务配置</h5>
      </div>
      <div class="storage-grid">
        <!-- 阿里云OSS -->
        <div class="storage-card" :class="{ active: config.driver === 'oss' }" @click="openConfigDialog('oss')">
          <div class="storage-card-header">
            <div class="storage-icon oss"><i class="fas fa-cloud"></i></div>
            <div>
              <h5>阿里云对象存储 OSS <i v-if="config.driver === 'oss'" class="fas fa-star text-warning ms-1"></i></h5>
              <el-tag :type="config.driver === 'oss' ? 'success' : 'info'" size="small">{{ config.driver === 'oss' ? '已启用' : '未配置' }}</el-tag>
              <el-tag v-if="config.driver === 'oss'" type="warning" size="small" class="ms-1">默认</el-tag>
            </div>
          </div>
          <p class="storage-desc">阿里云对象存储服务，提供海量、安全、低成本、高可靠的云存储服务。</p>
          <div class="storage-metrics">
            <div><div class="fw-bold">可靠性</div><div>99.9%</div></div>
            <div><div class="fw-bold">存储类型</div><div>标准/IA/归档</div></div>
            <div><div class="fw-bold">地域</div><div>全球多地域</div></div>
          </div>
          <el-button type="primary" size="small" @click.stop="openConfigDialog('oss')"><i class="fas fa-cog me-1"></i>配置</el-button>
        </div>

        <!-- 腾讯云COS -->
        <div class="storage-card" :class="{ active: config.driver === 'cos' }" @click="openConfigDialog('cos')">
          <div class="storage-card-header">
            <div class="storage-icon cos"><i class="fas fa-cloud"></i></div>
            <div>
              <h5>腾讯云对象存储 COS <i v-if="config.driver === 'cos'" class="fas fa-star text-warning ms-1"></i></h5>
              <el-tag :type="config.driver === 'cos' ? 'success' : 'info'" size="small">{{ config.driver === 'cos' ? '已启用' : '未配置' }}</el-tag>
              <el-tag v-if="config.driver === 'cos'" type="warning" size="small" class="ms-1">默认</el-tag>
            </div>
          </div>
          <p class="storage-desc">腾讯云对象存储，为企业和个人开发者提供高可用、高稳定、强安全的云端存储服务。</p>
          <div class="storage-metrics">
            <div><div class="fw-bold">可靠性</div><div>99.9%</div></div>
            <div><div class="fw-bold">存储类型</div><div>标准/低频/归档</div></div>
            <div><div class="fw-bold">地域</div><div>国内外多地域</div></div>
          </div>
          <el-button type="primary" size="small" @click.stop="openConfigDialog('cos')"><i class="fas fa-cog me-1"></i>配置</el-button>
        </div>

        <!-- 亚马逊S3 -->
        <div class="storage-card" :class="{ active: config.driver === 's3' }" @click="openConfigDialog('s3')">
          <div class="storage-card-header">
            <div class="storage-icon s3"><i class="fab fa-aws"></i></div>
            <div>
              <h5>亚马逊 S3 <i v-if="config.driver === 's3'" class="fas fa-star text-warning ms-1"></i></h5>
              <el-tag :type="config.driver === 's3' ? 'success' : 'info'" size="small">{{ config.driver === 's3' ? '已启用' : '未配置' }}</el-tag>
            </div>
          </div>
          <p class="storage-desc">Amazon Simple Storage Service，业界领先的对象存储服务。</p>
          <div class="storage-metrics">
            <div><div class="fw-bold">可靠性</div><div>99.999999999%</div></div>
            <div><div class="fw-bold">存储类型</div><div>多种存储类</div></div>
            <div><div class="fw-bold">地域</div><div>全球各区域</div></div>
          </div>
          <el-button type="primary" size="small" @click.stop="openConfigDialog('s3')"><i class="fas fa-cog me-1"></i>配置</el-button>
        </div>

        <!-- 七牛云 -->
        <div class="storage-card" :class="{ active: config.driver === 'qiniu' }" @click="openConfigDialog('qiniu')">
          <div class="storage-card-header">
            <div class="storage-icon qiniu"><i class="fas fa-cloud-upload-alt"></i></div>
            <div>
              <h5>七牛云存储 <i v-if="config.driver === 'qiniu'" class="fas fa-star text-warning ms-1"></i></h5>
              <el-tag :type="config.driver === 'qiniu' ? 'success' : 'info'" size="small">{{ config.driver === 'qiniu' ? '已启用' : '未配置' }}</el-tag>
            </div>
          </div>
          <p class="storage-desc">七牛云存储，为互联网公司提供安全、稳定、高效的云存储服务。</p>
          <div class="storage-metrics">
            <div><div class="fw-bold">可靠性</div><div>99.9%</div></div>
            <div><div class="fw-bold">存储类型</div><div>标准/低频</div></div>
            <div><div class="fw-bold">CDN</div><div>全球加速</div></div>
          </div>
          <el-button type="primary" size="small" @click.stop="openConfigDialog('qiniu')"><i class="fas fa-cog me-1"></i>配置</el-button>
        </div>

        <!-- 又拍云 -->
        <div class="storage-card" :class="{ active: config.driver === 'upyun' }" @click="openConfigDialog('upyun')">
          <div class="storage-card-header">
            <div class="storage-icon upyun"><i class="fas fa-cloud"></i></div>
            <div>
              <h5>又拍云存储 <i v-if="config.driver === 'upyun'" class="fas fa-star text-warning ms-1"></i></h5>
              <el-tag :type="config.driver === 'upyun' ? 'success' : 'info'" size="small">{{ config.driver === 'upyun' ? '已启用' : '未配置' }}</el-tag>
            </div>
          </div>
          <p class="storage-desc">又拍云存储，专业的云存储服务提供商，提供快速、稳定的存储方案。</p>
          <div class="storage-metrics">
            <div><div class="fw-bold">可靠性</div><div>99.9%</div></div>
            <div><div class="fw-bold">存储类型</div><div>标准存储</div></div>
            <div><div class="fw-bold">CDN</div><div>全网加速</div></div>
          </div>
          <el-button type="primary" size="small" @click.stop="openConfigDialog('upyun')"><i class="fas fa-cog me-1"></i>配置</el-button>
        </div>

        <!-- 雨云S3 -->
        <div class="storage-card" :class="{ active: config.driver === 'rainyun_s3' }" @click="openConfigDialog('rainyun_s3')">
          <div class="storage-card-header">
            <div class="storage-icon rainyun"><i class="fas fa-cloud"></i></div>
            <div>
              <h5>雨云S3存储 <i v-if="config.driver === 'rainyun_s3'" class="fas fa-star text-warning ms-1"></i></h5>
              <el-tag :type="config.driver === 'rainyun_s3' ? 'success' : 'info'" size="small">{{ config.driver === 'rainyun_s3' ? '已启用' : '未配置' }}</el-tag>
            </div>
          </div>
          <p class="storage-desc">雨云对象存储服务（ROS），兼容S3协议，提供高性价比的云存储方案。</p>
          <div class="storage-metrics">
            <div><div class="fw-bold">可靠性</div><div>99.9%</div></div>
            <div><div class="fw-bold">协议</div><div>S3兼容</div></div>
            <div><div class="fw-bold">特点</div><div>高性价比</div></div>
          </div>
          <el-button type="primary" size="small" @click.stop="openConfigDialog('rainyun_s3')"><i class="fas fa-cog me-1"></i>配置</el-button>
        </div>

        <!-- 本地存储 -->
        <div class="storage-card" :class="{ active: config.driver === 'local' }" @click="openConfigDialog('local')">
          <div class="storage-card-header">
            <div class="storage-icon local"><i class="fas fa-hdd"></i></div>
            <div>
              <h5>本地存储 <i v-if="config.driver === 'local'" class="fas fa-star text-warning ms-1"></i></h5>
              <el-tag type="success" size="small">已启用</el-tag>
              <el-tag v-if="config.driver === 'local'" type="warning" size="small" class="ms-1">默认</el-tag>
            </div>
          </div>
          <p class="storage-desc">本地文件系统存储，适合小型项目或开发环境使用。</p>
          <div class="storage-metrics">
            <div><div class="fw-bold">可靠性</div><div>取决于硬盘</div></div>
            <div><div class="fw-bold">成本</div><div>免费</div></div>
            <div><div class="fw-bold">速度</div><div>快速访问</div></div>
          </div>
          <el-button type="primary" size="small" @click.stop="openConfigDialog('local')"><i class="fas fa-cog me-1"></i>配置</el-button>
        </div>
      </div>
    </div>

    <!-- 配置弹窗 -->
    <el-dialog v-model="showConfigDialog" :title="dialogTitle" width="600px">
      <el-form :model="config" label-width="140px">
        <template v-if="editingDriver === 'local'">
          <el-form-item label="存储路径"><el-input v-model="config.local_path" placeholder="如：/uploads" /></el-form-item>
          <el-form-item label="访问域名"><el-input v-model="config.local_domain" placeholder="如：https://yourdomain.com" /></el-form-item>
          <el-form-item label="最大文件大小">
            <el-input-number v-model="config.max_file_size" :min="1" :max="100" /><span class="ms-2 text-muted">MB</span>
          </el-form-item>
        </template>
        <template v-if="editingDriver === 'oss'">
          <el-form-item label="AccessKey ID"><el-input v-model="config.oss_access_key" /></el-form-item>
          <el-form-item label="AccessKey Secret"><el-input v-model="config.oss_secret_key" type="password" show-password /></el-form-item>
          <el-form-item label="Bucket名称"><el-input v-model="config.oss_bucket" /></el-form-item>
          <el-form-item label="区域(Region)"><el-input v-model="config.oss_region" placeholder="如：oss-cn-shanghai" /></el-form-item>
          <el-form-item label="自定义域名"><el-input v-model="config.oss_domain" placeholder="可选，自定义CDN域名" /></el-form-item>
          <el-form-item label="存储目录前缀"><el-input v-model="config.oss_prefix" placeholder="如：uploads/" /></el-form-item>
        </template>
        <template v-if="editingDriver === 'cos'">
          <el-form-item label="SecretId"><el-input v-model="config.cos_secret_id" /></el-form-item>
          <el-form-item label="SecretKey"><el-input v-model="config.cos_secret_key" type="password" show-password /></el-form-item>
          <el-form-item label="Bucket名称"><el-input v-model="config.cos_bucket" /></el-form-item>
          <el-form-item label="区域"><el-input v-model="config.cos_region" placeholder="如：ap-shanghai" /></el-form-item>
          <el-form-item label="自定义域名"><el-input v-model="config.cos_domain" placeholder="可选" /></el-form-item>
        </template>
        <template v-if="editingDriver === 'qiniu'">
          <el-form-item label="AccessKey"><el-input v-model="config.qiniu_access_key" /></el-form-item>
          <el-form-item label="SecretKey"><el-input v-model="config.qiniu_secret_key" type="password" show-password /></el-form-item>
          <el-form-item label="Bucket名称"><el-input v-model="config.qiniu_bucket" /></el-form-item>
          <el-form-item label="访问域名"><el-input v-model="config.qiniu_domain" /></el-form-item>
        </template>
        <template v-if="editingDriver === 's3'">
          <el-form-item label="Access Key"><el-input v-model="config.s3_access_key" /></el-form-item>
          <el-form-item label="Secret Key"><el-input v-model="config.s3_secret_key" type="password" show-password /></el-form-item>
          <el-form-item label="Bucket"><el-input v-model="config.s3_bucket" /></el-form-item>
          <el-form-item label="Region"><el-input v-model="config.s3_region" placeholder="如：us-east-1" /></el-form-item>
          <el-form-item label="Endpoint"><el-input v-model="config.s3_endpoint" placeholder="可选" /></el-form-item>
        </template>
        <template v-if="editingDriver === 'upyun'">
          <el-form-item label="服务名称"><el-input v-model="config.upyun_service" /></el-form-item>
          <el-form-item label="操作员账号"><el-input v-model="config.upyun_operator" /></el-form-item>
          <el-form-item label="操作员密码"><el-input v-model="config.upyun_password" type="password" show-password /></el-form-item>
          <el-form-item label="访问域名"><el-input v-model="config.upyun_domain" /></el-form-item>
        </template>
        <template v-if="editingDriver === 'rainyun_s3'">
          <el-form-item label="Access Key"><el-input v-model="config.rainyun_access_key" /></el-form-item>
          <el-form-item label="Secret Key"><el-input v-model="config.rainyun_secret_key" type="password" show-password /></el-form-item>
          <el-form-item label="Bucket"><el-input v-model="config.rainyun_bucket" /></el-form-item>
          <el-form-item label="Endpoint"><el-input v-model="config.rainyun_endpoint" placeholder="S3兼容端点" /></el-form-item>
          <el-form-item label="访问域名"><el-input v-model="config.rainyun_domain" /></el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="showConfigDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig"><i class="fas fa-save me-1"></i>保存</el-button>
        <el-button :loading="testing" @click="testConnection"><i class="fas fa-plug me-1"></i>测试连接</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const config = ref({ driver: 'local', local_path: '/uploads', max_file_size: 10 })
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const showConfigDialog = ref(false)
const editingDriver = ref('local')

const storageNames = {
  local: '本地存储', oss: '阿里云OSS', cos: '腾讯云COS',
  s3: '亚马逊S3', qiniu: '七牛云存储', upyun: '又拍云存储', rainyun_s3: '雨云S3存储'
}

const dialogTitle = computed(() => `${storageNames[editingDriver.value] || '存储'} 配置`)
const configuredCount = computed(() => {
  let count = 1;
  if (config.value.oss_access_key) count++
  if (config.value.cos_secret_id) count++
  if (config.value.qiniu_access_key) count++
  return count
})

onMounted(() => loadConfig())

function openConfigDialog(driver) {
  editingDriver.value = driver
  showConfigDialog.value = true
}

async function loadConfig() {
  loading.value = true
  try {
    const res = await api.get('/admin/storage-config')
    const data = res.data?.data || res.data || {}
    if (data && typeof data === 'object') config.value = { ...config.value, ...data }
  } catch {}
  loading.value = false
}

async function saveConfig() {
  saving.value = true
  try {
    await api.post('/admin/storage-config', config.value)
    ElMessage.success('保存成功')
    showConfigDialog.value = false
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  }
  saving.value = false
}

async function testConnection() {
  testing.value = true
  try {
    const res = await api.post('/admin/storage-config/test', config.value)
    if (res.data?.success !== false) ElMessage.success('连接测试成功！')
    else ElMessage.error(res.data?.message || '连接测试失败')
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '连接测试失败')
  }
  testing.value = false
}
</script>

<style scoped>
.page-header { margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 600; margin: 0; display: flex; align-items: center; }
.card-container { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.card-header-bar { display: flex; justify-content: space-between; align-items: center; }
.section-title { font-size: 16px; font-weight: 600; margin: 0; color: #333; display: flex; align-items: center; }
.form-help { font-size: 12px; color: #999; margin-top: 4px; }
.form-label { font-size: 14px; color: #333; margin-bottom: 6px; display: block; }

.stats-row { display: flex; gap: 16px; flex-wrap: wrap; }
.stat-card { flex: 1; min-width: 180px; background: white; border-radius: 12px; padding: 16px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); position: relative; border-left: 4px solid; }
.stat-card.border-primary { border-left-color: #2F80ED; }
.stat-card.border-success { border-left-color: #27AE60; }
.stat-card.border-info { border-left-color: #2D9CDB; }
.stat-card.border-warning { border-left-color: #F2994A; }
.stat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
.stat-value { font-size: 20px; font-weight: 700; color: #333; }
.stat-icon { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 28px; opacity: 0.2; }

.storage-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
@media (max-width: 768px) { .storage-grid { grid-template-columns: 1fr; } }

.storage-card {
  border: 1px solid #e3e6f0; border-radius: 12px; padding: 20px;
  transition: transform 0.2s, box-shadow 0.2s; cursor: pointer;
}
.storage-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
.storage-card.active { border-color: #2F80ED; background: #f8f9ff; }
.storage-card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.storage-card-header h5 { margin: 0; font-size: 15px; font-weight: 600; }
.storage-icon {
  width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
  font-size: 18px; color: white; flex-shrink: 0;
}
.storage-icon.oss { background: #FF6A00; }
.storage-icon.cos { background: #00A4FF; }
.storage-icon.s3 { background: #FF9900; }
.storage-icon.qiniu { background: #07BEB8; }
.storage-icon.upyun { background: #4C8BF5; }
.storage-icon.rainyun { background: #6C63FF; }
.storage-icon.local { background: #999; }
.storage-desc { color: #666; font-size: 13px; margin-bottom: 12px; }
.storage-metrics { display: flex; text-align: center; font-size: 12px; color: #999; margin-bottom: 12px; gap: 4px; }
.storage-metrics > div { flex: 1; }
.storage-metrics .fw-bold { color: #666; font-weight: 600; margin-bottom: 2px; }

.d-flex { display: flex; }
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.mb-0 { margin-bottom: 0; }
.mb-4 { margin-bottom: 24px; }
.mt-3 { margin-top: 16px; }
.me-1 { margin-right: 4px; }
.me-2 { margin-right: 8px; }
.ms-1 { margin-left: 4px; }
.ms-2 { margin-left: 8px; }
.text-muted { color: #999; }
.text-primary { color: #2F80ED; }
.text-success { color: #27AE60; }
.text-info { color: #2D9CDB; }
.text-warning { color: #F2994A; }
.fw-bold { font-weight: 600; }
.align-items-center { align-items: center; }
.justify-content-between { justify-content: space-between; }
</style>
