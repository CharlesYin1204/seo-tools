<template>
  <div>
    <!-- 页面头部 -->
    <div class="media-page-header">
      <div>
        <h3 class="page-title"><i class="fas fa-photo-video text-primary me-2"></i>媒体管理</h3>
        <nav class="breadcrumb-nav">
          <span>仪表板</span> / <span>内容管理</span> / <span class="active">媒体管理</span>
        </nav>
      </div>
      <el-upload action="" :before-upload="handleUpload" :show-file-list="false" multiple accept="image/*,video/*,.pdf,.doc,.docx">
        <el-button type="primary"><i class="fas fa-upload me-2"></i>上传文件</el-button>
      </el-upload>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card blue">
        <div class="stat-value">{{ formatNumber(mediaStats.total_files) }}</div>
        <div class="stat-label"><i class="fas fa-file me-1"></i>总文件数</div>
      </div>
      <div class="stat-card teal">
        <div class="stat-value">{{ formatNumber(mediaStats.image_count) }}</div>
        <div class="stat-label"><i class="fas fa-image me-1"></i>图片文件</div>
      </div>
      <div class="stat-card pink">
        <div class="stat-value">{{ formatNumber(mediaStats.video_audio_count) }}</div>
        <div class="stat-label"><i class="fas fa-play-circle me-1"></i>视频/音频</div>
      </div>
      <div class="stat-card green">
        <div class="stat-value">{{ formatFileSize(mediaStats.total_size) }}</div>
        <div class="stat-label"><i class="fas fa-database me-1"></i>存储空间</div>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="媒体文件" name="files">
        <!-- 筛选区域 -->
        <div class="card-container" v-loading="loading">
          <div class="filter-grid">
            <div class="filter-col">
              <label><i class="fas fa-file-alt me-1"></i>文件类型</label>
              <el-select v-model="typeFilter" placeholder="所有类型" clearable size="default" @change="loadMedia">
                <el-option label="图片" value="image" />
                <el-option label="视频" value="video" />
                <el-option label="音频" value="audio" />
                <el-option label="文档" value="document" />
              </el-select>
            </div>
            <div class="filter-col">
              <label><i class="fas fa-puzzle-piece me-1"></i>插件来源</label>
              <el-select v-model="pluginFilter" placeholder="所有插件" clearable size="default" @change="loadMedia">
                <el-option v-for="p in mediaStats.plugins" :key="p.plugin_slug" :label="`${p.plugin_slug} (${p.count})`" :value="p.plugin_slug" />
              </el-select>
            </div>
            <div class="filter-col">
              <label><i class="fas fa-upload me-1"></i>上传来源</label>
              <el-select v-model="sourceFilter" placeholder="所有来源" clearable size="default" @change="loadMedia">
                <el-option v-for="s in mediaStats.sources" :key="s.source" :label="`${s.source} (${s.count})`" :value="s.source" />
              </el-select>
            </div>
            <div class="filter-col">
              <label><i class="fas fa-search me-1"></i>搜索</label>
              <el-input v-model="searchKeyword" placeholder="搜索文件名..." clearable @keyup.enter="loadMedia" />
            </div>
            <div class="filter-col filter-actions">
              <label>&nbsp;</label>
              <div class="d-flex gap-2">
                <el-button type="primary" @click="loadMedia"><i class="fas fa-search"></i> 筛选</el-button>
                <el-button @click="resetFilters"><i class="fas fa-redo"></i></el-button>
              </div>
            </div>
          </div>

          <!-- 媒体文件网格 -->
          <div class="media-grid" v-if="mediaList.length > 0">
            <div v-for="file in mediaList" :key="file.id" class="media-card">
              <div class="media-preview">
                <el-image v-if="isImage(file)" :src="getFileUrl(file)" fit="cover" class="media-thumb"
                          :preview-src-list="[getFileUrl(file)]" />
                <div v-else-if="isVideo(file)" class="media-placeholder dark">
                  <i class="fas fa-play-circle fa-3x"></i>
                  <span>视频文件</span>
                </div>
                <div v-else-if="isAudio(file)" class="media-placeholder info">
                  <i class="fas fa-music fa-3x"></i>
                  <span>音频文件</span>
                </div>
                <div v-else class="media-placeholder light">
                  <i class="fas fa-file-alt fa-3x"></i>
                  <span>文档文件</span>
                </div>

                <!-- 标签 -->
                <div class="media-badges">
                  <span class="badge" :class="getTypeBadgeClass(file)">{{ getTypeLabel(file) }}</span>
                  <span v-if="file.plugin_slug" class="badge bg-primary">
                    <i class="fas fa-puzzle-piece me-1"></i>{{ file.plugin_slug }}
                  </span>
                </div>

                <!-- 操作菜单 -->
                <div class="media-actions-btn">
                  <el-dropdown trigger="click">
                    <el-button circle size="small"><i class="fas fa-ellipsis-v"></i></el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="openFile(file)"><i class="fas fa-eye me-2 text-info"></i>查看</el-dropdown-item>
                        <el-dropdown-item @click="copyUrl(file)"><i class="fas fa-link me-2 text-success"></i>复制链接</el-dropdown-item>
                        <el-dropdown-item v-if="getFileUrl(file)" @click="openExternal(file)"><i class="fas fa-external-link-alt me-2"></i>打开</el-dropdown-item>
                        <el-dropdown-item divided @click="deleteMedia(file)"><i class="fas fa-trash me-2 text-danger"></i>删除</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
              <div class="media-card-body">
                <div class="media-filename" :title="file.filename || file.name">{{ file.filename || file.name || '未命名' }}</div>
                <div class="media-meta">
                  <span><i class="fas fa-database me-1"></i>{{ formatFileSizeSmall(file.file_size) }}</span>
                  <span><i class="fas fa-calendar me-1"></i>{{ formatDate(file.created_at) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            <i class="fas fa-photo-video"></i>
            <p>暂无媒体文件</p>
          </div>

          <!-- 分页 -->
          <div class="pagination-wrap" v-if="total > 0">
            <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total"
                           layout="total, prev, pager, next" @current-change="loadMedia" />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="小区图片" name="community">
        <div class="card-container" v-loading="communityLoading">
          <div class="community-header">
            <h5 class="section-title"><i class="fas fa-building me-2 text-primary"></i>小区图片管理</h5>
            <div class="community-search">
              <el-input v-model="communitySearch" placeholder="搜索小区名..." clearable size="default" style="width:240px"
                        @keyup.enter="loadCommunityImages" />
              <el-button type="primary" @click="loadCommunityImages"><i class="fas fa-search"></i></el-button>
            </div>
          </div>

          <div v-if="communityGroups.length > 0">
            <div v-for="group in communityGroups" :key="group.community" class="community-group">
              <div class="community-group-header" @click="group._expanded = !group._expanded">
                <div class="community-group-info">
                  <i class="fas fa-folder me-2" :class="group._expanded ? 'text-warning' : 'text-muted'"></i>
                  <strong>{{ group.community }}</strong>
                  <span class="text-muted ms-2">({{ group.image_count }}张图片 / {{ group.property_count }}套内容资产)</span>
                </div>
                <i class="fas" :class="group._expanded ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
              </div>
              <div v-if="group._expanded" class="community-toolbar">
                <div class="community-toolbar-inner">
                  <span class="text-muted small">补充到内容资产：</span>
                  <el-select v-model="communityAddTarget[group.community]" placeholder="选择内容资产" size="small" class="community-add-select">
                    <el-option v-for="p in uniquePropsFromImages(group.images)" :key="p.property_id"
                               :label="`${p.property_code} (#${p.property_id})`" :value="p.property_id" />
                  </el-select>
                  <el-upload action="" :show-file-list="false" accept="image/*"
                             :before-upload="(file) => beforeCommunityAddUpload(file, group.community)">
                    <el-button type="primary" size="small"><i class="fas fa-upload me-1"></i>上传图片</el-button>
                  </el-upload>
                  <el-input v-model="communityImageUrl[group.community]" placeholder="或粘贴图片 URL" size="small" clearable class="community-url-input" />
                  <el-button size="small" @click="submitCommunityImageUrl(group.community)"><i class="fas fa-link me-1"></i>添加链接</el-button>
                </div>
              </div>
              <div v-if="group._expanded" class="community-image-grid">
                <div v-for="(img, idx) in group.images" :key="idx" class="community-image-card">
                  <el-button type="danger" size="small" circle class="community-img-remove" title="从该内容资产移除此图"
                             @click.stop="removeCommunityImage(img)">
                    <i class="fas fa-times"></i>
                  </el-button>
                  <el-image :src="img.url" fit="cover" class="community-thumb"
                            :preview-src-list="group.images.map(i => i.url)" :initial-index="idx" />
                  <div class="community-image-info">
                    <span class="community-image-name" :title="img.filename">{{ img.filename }}</span>
                    <span class="community-image-code">{{ img.property_code }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <i class="fas fa-building"></i>
            <p>暂无小区图片数据</p>
          </div>

          <div class="pagination-wrap" v-if="communityTotal > 0">
            <el-pagination v-model:current-page="communityPage" :page-size="communityPageSize" :total="communityTotal"
                           layout="total, prev, pager, next" @current-change="loadCommunityImages" />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="水印配置" name="watermark">
        <div class="card-container">
          <h5 class="section-title"><i class="fas fa-copyright me-2 text-primary"></i>内容资产媒体水印设置</h5>

          <div class="watermark-switch-row">
            <el-switch v-model="watermarkConfig.enabled" />
            <div>
              <strong>启用水印</strong>
              <span class="text-muted small ms-2">（启用后所有用户内容资产媒体将自动添加水印）</span>
            </div>
          </div>

          <div class="watermark-layout">
            <div class="watermark-form-side">
              <el-form :model="watermarkConfig" label-width="120px">
                <el-form-item label="水印文字"><el-input v-model="watermarkConfig.text" placeholder="请输入水印文字" /></el-form-item>
                <el-form-item label="水印位置">
                  <el-select v-model="watermarkConfig.position" style="width:100%">
                    <el-option label="左上角" value="top-left" /><el-option label="右上角" value="top-right" />
                    <el-option label="左下角" value="bottom-left" /><el-option label="右下角" value="bottom-right" />
                    <el-option label="居中" value="center" />
                  </el-select>
                </el-form-item>
                <el-form-item label="透明度 (%)"><el-slider v-model="watermarkConfig.opacity" :min="10" :max="100" show-input /></el-form-item>
                <el-form-item label="水印大小">
                  <el-select v-model="watermarkConfig.size" style="width:100%">
                    <el-option label="小" value="small" /><el-option label="中" value="medium" />
                    <el-option label="大" value="large" /><el-option label="自定义" value="custom" />
                  </el-select>
                </el-form-item>
                <el-form-item v-if="watermarkConfig.size === 'custom'" label="字体大小 (px)">
                  <el-input-number v-model="watermarkConfig.font_size" :min="12" :max="500" />
                </el-form-item>
              </el-form>
            </div>
            <div class="watermark-preview-side">
              <div class="watermark-preview">
                <i class="fas fa-image fa-3x text-muted"></i>
                <p class="text-muted mt-2">水印预览</p>
                <p class="text-muted small">保存后将应用到所有新上传的媒体</p>
              </div>
            </div>
          </div>

          <div class="text-end mt-3">
            <el-button type="primary" @click="saveWatermark"><i class="fas fa-save me-1"></i>保存设置</el-button>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 预览弹窗 -->
    <el-dialog v-model="previewVisible" title="文件预览" width="700px">
      <div v-if="previewFile" class="text-center">
        <el-image v-if="isImage(previewFile)" :src="getFileUrl(previewFile)" style="max-width:100%;max-height:500px" fit="contain" />
        <video v-else-if="isVideo(previewFile)" :src="getFileUrl(previewFile)" controls style="max-width:100%;max-height:400px"></video>
        <div v-else class="py-5"><i class="fas fa-file-alt fa-5x text-muted"></i></div>
        <div class="mt-3 text-muted">{{ previewFile.filename || previewFile.name }}</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const activeTab = ref('files')
const mediaList = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(24)
const total = ref(0)
const searchKeyword = ref('')
const typeFilter = ref('')
const pluginFilter = ref('')
const sourceFilter = ref('')
const previewVisible = ref(false)
const previewFile = ref(null)
const mediaStats = reactive({ total_files: 0, image_count: 0, video_audio_count: 0, total_size: 0, sources: [], plugins: [] })
const watermarkConfig = ref({
  enabled: false, type: 'text', text: '', image_url: '',
  position: 'bottom-right', opacity: 50, font_size: 24, size: 'medium',
})
const communityLoading = ref(false)
const communityGroups = ref([])
const communitySearch = ref('')
const communityPage = ref(1)
const communityPageSize = ref(30)
const communityTotal = ref(0)
/** 小区展开后：选中的内容资产 ID、外链输入 */
const communityAddTarget = reactive({})
const communityImageUrl = reactive({})

function uniquePropsFromImages(images) {
  const map = new Map()
  for (const img of images || []) {
    if (img.property_id == null) continue
    if (!map.has(img.property_id)) {
      map.set(img.property_id, { property_id: img.property_id, property_code: img.property_code || String(img.property_id) })
    }
  }
  return [...map.values()]
}

onMounted(() => { loadMedia(); loadStats(); loadWatermark(); loadCommunityImages() })

async function loadStats() {
  try {
    const res = await api.get('/admin/media/stats')
    const data = res.data?.data || res.data || {}
    Object.assign(mediaStats, data)
  } catch {}
}

async function loadMedia() {
  loading.value = true
  try {
    const params = { page: page.value, pageSize: pageSize.value, search: searchKeyword.value, type: typeFilter.value }
    if (pluginFilter.value) params.plugin = pluginFilter.value
    if (sourceFilter.value) params.source = sourceFilter.value
    const res = await api.get('/admin/media', { params })
    mediaList.value = res.data?.data || []
    total.value = res.data?.total || 0
  } catch {}
  loading.value = false
}

function resetFilters() {
  searchKeyword.value = ''
  typeFilter.value = ''
  pluginFilter.value = ''
  sourceFilter.value = ''
  page.value = 1
  loadMedia()
}

async function handleUpload(file) {
  const formData = new FormData()
  formData.append('file', file)
  try {
    await api.post('/admin/media/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    ElMessage.success('上传成功')
    loadMedia()
    loadStats()
  } catch (e) { ElMessage.error(e?.message || '上传失败') }
  return false
}

function getFileUrl(file) { return file.file_url || file.url || '' }
function isImage(file) { return (file.file_type || file.type || '').includes('image') }
function isVideo(file) { return (file.file_type || file.type || '').includes('video') }
function isAudio(file) { return (file.file_type || file.type || '').includes('audio') }

function getTypeLabel(file) {
  if (isImage(file)) return '图片'
  if (isVideo(file)) return '视频'
  if (isAudio(file)) return '音频'
  return '文档'
}
function getTypeBadgeClass(file) {
  if (isImage(file)) return 'bg-success'
  if (isVideo(file)) return 'bg-warning'
  if (isAudio(file)) return 'bg-info'
  return 'bg-secondary'
}

function copyUrl(file) {
  const url = getFileUrl(file)
  if (navigator.clipboard && url) { navigator.clipboard.writeText(url); ElMessage.success('链接已复制') }
}
function openFile(file) { previewFile.value = file; previewVisible.value = true }
function openExternal(file) { window.open(getFileUrl(file), '_blank') }

async function deleteMedia(file) {
  try {
    await ElMessageBox.confirm('确定删除该文件？', '确认', { type: 'warning' })
    await api.delete(`/admin/media/${file.id}`)
    ElMessage.success('删除成功')
    loadMedia()
    loadStats()
  } catch {}
}

function formatNumber(n) { return (n || 0).toLocaleString() }
function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i]
}
function formatFileSizeSmall(bytes) {
  if (!bytes) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0) + ' ' + sizes[i]
}
function formatDate(d) { return d ? d.slice(0, 10) : '' }

async function loadWatermark() {
  try {
    const res = await api.get('/admin/media/watermark')
    if (res.data) watermarkConfig.value = { ...watermarkConfig.value, ...res.data }
  } catch {}
}

async function saveWatermark() {
  try { await api.post('/admin/media/watermark', watermarkConfig.value); ElMessage.success('保存成功') }
  catch (e) { ElMessage.error(e?.message || '保存失败') }
}

async function loadCommunityImages() {
  communityLoading.value = true
  try {
    const params = { page: communityPage.value, pageSize: communityPageSize.value }
    if (communitySearch.value) params.community = communitySearch.value
    const res = await api.get('/admin/media/community-images', { params })
    const data = res.data?.data || res.data || {}
    const groups = (data.groups || []).map(g => ({ ...g, _expanded: false }))
    communityGroups.value = groups
    communityTotal.value = data.total || 0
    for (const g of groups) {
      const uniq = uniquePropsFromImages(g.images)
      if (uniq.length) {
        const cur = communityAddTarget[g.community]
        const stillValid = uniq.some((u) => u.property_id === cur)
        if (cur == null || !stillValid) communityAddTarget[g.community] = uniq[0].property_id
      }
    }
  } catch {}
  communityLoading.value = false
}

async function beforeCommunityAddUpload(file, communityKey) {
  const pid = communityAddTarget[communityKey]
  if (!pid) {
    ElMessage.warning('请先选择要补充到的内容资产')
    return false
  }
  const formData = new FormData()
  formData.append('file', file)
  formData.append('property_id', String(pid))
  try {
    const res = await api.post('/admin/media/community-add-image', formData)
    const dup = res.data?.data?.duplicate
    if (dup) ElMessage.info(res.data?.message || '图片已存在')
    else ElMessage.success(res.data?.message || '已添加')
    loadCommunityImages()
    loadStats()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || '上传失败')
  }
  return false
}

async function submitCommunityImageUrl(communityKey) {
  const pid = communityAddTarget[communityKey]
  const url = (communityImageUrl[communityKey] || '').trim()
  if (!pid) {
    ElMessage.warning('请先选择内容资产')
    return
  }
  if (!url) {
    ElMessage.warning('请填写图片地址')
    return
  }
  try {
    const res = await api.post('/admin/media/community-add-image-url', { property_id: pid, image_url: url })
    const dup = res.data?.data?.duplicate
    if (dup) ElMessage.info(res.data?.message || '图片已存在')
    else ElMessage.success(res.data?.message || '已添加')
    communityImageUrl[communityKey] = ''
    loadCommunityImages()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || '添加失败')
  }
}

async function removeCommunityImage(img) {
  if (!img?.property_id || !img?.original_url) {
    ElMessage.warning('缺少内容资产或图片信息')
    return
  }
  try {
    await ElMessageBox.confirm('确定从该内容资产中删除此图片？（不可恢复，需重新上传或同步）', '删除确认', { type: 'warning' })
    await api.post('/admin/media/community-remove-image', {
      property_id: img.property_id,
      original_url: img.original_url,
    })
    ElMessage.success('已删除')
    loadCommunityImages()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.response?.data?.message || '删除失败')
  }
}
</script>

<style scoped>
.media-page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 600; margin: 0 0 4px; display: flex; align-items: center; }
.breadcrumb-nav { font-size: 13px; color: #999; }
.breadcrumb-nav .active { color: #333; }

.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.05); transition: all 0.3s; }
.stat-card:hover { box-shadow: 0 5px 20px rgba(0,0,0,0.1); transform: translateY(-2px); }
.stat-card .stat-value { font-size: 1.8rem; font-weight: 700; line-height: 1.2; }
.stat-card .stat-label { font-size: 13px; color: #888; margin-top: 4px; }
.stat-card.blue .stat-value { color: #2F80ED; }
.stat-card.teal .stat-value { color: #2D9CDB; }
.stat-card.pink .stat-value { color: #EB5757; }
.stat-card.green .stat-value { color: #27AE60; }

.card-container { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.section-title { font-size: 16px; font-weight: 600; margin: 0 0 20px; color: #333; display: flex; align-items: center; }

.filter-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 20px; }
.filter-col label { display: block; font-size: 13px; color: #666; margin-bottom: 6px; font-weight: 500; }
.filter-col .el-select, .filter-col .el-input { width: 100%; }
.filter-actions { display: flex; flex-direction: column; }

.media-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 16px; }
.media-card { background: white; border-radius: 10px; overflow: visible; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #f0f0f0; transition: all 0.3s; }
.media-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
.media-preview { position: relative; overflow: hidden; border-radius: 10px 10px 0 0; }
.media-thumb { width: 100%; height: 180px; display: block; }
.media-placeholder { width: 100%; height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.media-placeholder.dark { background: #2c3e50; color: white; }
.media-placeholder.info { background: #e8f4fd; color: #2D9CDB; }
.media-placeholder.light { background: #f8f9fa; color: #999; }

.media-badges { position: absolute; top: 8px; left: 8px; display: flex; flex-direction: column; gap: 4px; }
.badge { font-size: 11px; padding: 3px 8px; border-radius: 4px; color: white; font-weight: 500; }
.bg-success { background: #27AE60; }
.bg-warning { background: #F2994A; color: #333 !important; }
.bg-info { background: #2D9CDB; }
.bg-secondary { background: #828282; }
.bg-primary { background: rgba(47,128,237,0.85); font-size: 10px !important; }

.media-actions-btn { position: absolute; top: 8px; right: 8px; }
.media-card-body { padding: 12px; }
.media-filename { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 6px; }
.media-meta { display: flex; justify-content: space-between; font-size: 12px; color: #999; }

.pagination-wrap { display: flex; justify-content: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #f0f0f0; }

.empty-state { text-align: center; padding: 60px 20px; color: #ccc; }
.empty-state i { font-size: 48px; margin-bottom: 12px; }

.watermark-switch-row { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding: 12px 16px; background: #f8f9fa; border-radius: 8px; }
.watermark-layout { display: flex; gap: 24px; }
.watermark-form-side { flex: 1; }
.watermark-preview-side { width: 240px; flex-shrink: 0; }
.watermark-preview { border: 2px dashed #ddd; border-radius: 8px; padding: 40px 20px; text-align: center; }

.d-flex { display: flex; }
.gap-2 { gap: 8px; }
.me-1 { margin-right: 4px; }
.me-2 { margin-right: 8px; }
.ms-2 { margin-left: 8px; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 16px; }
.mb-4 { margin-bottom: 24px; }
.py-5 { padding: 40px 0; }
.text-end { text-align: right; }
.text-primary { color: #2F80ED; }
.text-info { color: #2D9CDB; }
.text-success { color: #27AE60; }
.text-danger { color: #EB5757; }
.text-muted { color: #999; }
.small { font-size: 0.85rem; }

.community-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.community-search { display: flex; gap: 8px; align-items: center; }
.community-toolbar { padding: 12px 16px; margin: 0 16px 12px; background: var(--background-light, #F8F9FA); border-radius: 8px; border: 1px solid var(--border-color, #E0E0E0); }
.community-toolbar-inner { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-sm, 8px); }
.community-add-select { width: 200px; }
.community-url-input { width: 240px; max-width: 100%; }
.community-group { border: 1px solid #f0f0f0; border-radius: 10px; margin-bottom: 12px; overflow: hidden; }
.community-group-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; cursor: pointer; background: #fafbfc; transition: background 0.2s; }
.community-group-header:hover { background: #f0f4f8; }
.community-group-info { display: flex; align-items: center; font-size: 14px; }
.community-image-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; padding: 16px 20px; }
.community-image-card { position: relative; border-radius: 8px; overflow: visible; border: 1px solid #eee; transition: all 0.3s; }
.community-image-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.community-img-remove { position: absolute; top: 6px; right: 6px; z-index: 2; opacity: 0.92; }
.community-img-remove:hover { opacity: 1; }
.community-thumb { width: 100%; height: 120px; display: block; cursor: pointer; }
.community-image-info { padding: 6px 8px; }
.community-image-name { display: block; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #333; }
.community-image-code { display: block; font-size: 10px; color: #999; }
.text-warning { color: #F2994A; }

@media (max-width: 992px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .filter-grid { grid-template-columns: repeat(3, 1fr); }
  .media-grid { grid-template-columns: repeat(3, 1fr); }
  .community-image-grid { grid-template-columns: repeat(4, 1fr); }
}
@media (max-width: 768px) {
  .filter-grid { grid-template-columns: 1fr 1fr; }
  .media-grid { grid-template-columns: repeat(2, 1fr); }
  .watermark-layout { flex-direction: column; }
  .watermark-preview-side { width: 100%; }
  .community-image-grid { grid-template-columns: repeat(2, 1fr); }
  .community-header { flex-direction: column; align-items: stretch; }
}
</style>
