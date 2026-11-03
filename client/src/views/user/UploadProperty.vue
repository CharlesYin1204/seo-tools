<template>
  <div class="upload-property-page">
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

    <!-- 绿色渐变头部 - 与PHP版一致 -->
    <div class="upload-header">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h2><i class="fas fa-upload me-2"></i>{{ isEditMode ? '编辑内容资产' : '上传内容资产' }}</h2>
          <p class="mb-0 opacity-90">{{ isEditMode ? '修改内容资产信息' : '手动发布新内容资产信息' }}</p>
        </div>
        <router-link to="/user/properties" class="btn-back">
          <i class="fas fa-arrow-left me-1"></i>返回内容资产列表
        </router-link>
      </div>
    </div>

    <!-- 内容资产表单 -->
    <div class="form-card">
      <el-form ref="formRef" :model="form" label-position="top">

        <!-- 内容资产描述与AI解析 -->
        <div class="form-section-title">
          <i class="fas fa-magic"></i>
          <span>内容资产描述</span>
          <el-button class="btn-ai-parse ms-auto" size="small" :loading="aiParsing" :disabled="!form.description" @click="handleAiParse">
            <i class="fas fa-robot me-1"></i>AI一键解析
          </el-button>
        </div>
        <div class="row mb-4">
          <div class="col-12 mb-3">
            <label class="form-label">内容资产描述 <span class="text-muted small">（粘贴内容资产信息，点击AI解析自动填充表单）</span></label>
            <el-input v-model="form.description" type="textarea" :rows="5" placeholder="请粘贴或输入内容资产描述信息，例如：&#10;浦东碧云 精装修3房 15000/月&#10;地铁9号线世纪大道站&#10;高楼层 南北通透 有电梯&#10;联系人：张先生 138xxxx" />
          </div>
        </div>

        <!-- 基本信息 -->
        <div class="form-section-title">
          <i class="fas fa-info-circle"></i>
          <span>基本信息</span>
        </div>
        <div class="row mb-4">
          <div class="col-md-12 mb-3">
            <label class="form-label">内容资产标题 <span class="text-muted small">（不填则自动生成）</span></label>
            <el-input v-model="form.title" placeholder="例如：静安区 3室 38800元/月 近2号线南京西路（不填则按规则自动生成）" maxlength="200" />
          </div>
          <div class="col-md-4 mb-3">
            <label class="form-label">小区 <span class="text-muted small">（填写后自动匹配POI定位）</span></label>
            <div class="community-input-wrap">
              <el-input v-model="form.community" placeholder="例如：碧云国际社区" />
              <span v-if="poiSearching" class="poi-status poi-loading"><i class="fas fa-spinner fa-spin"></i></span>
              <span v-else-if="poiMatchFound" class="poi-status poi-matched"><i class="fas fa-check-circle"></i></span>
            </div>
          </div>
          <div class="col-md-4 mb-3">
            <label class="form-label">价格</label>
            <el-input v-model="form.price" placeholder="例如：15000元/月" />
          </div>
          <div class="col-md-4 mb-3">
            <label class="form-label">卧室数量</label>
            <el-select v-model="form.bedrooms" class="w-100" placeholder="请选择">
              <el-option label="请选择" value="" />
              <el-option label="1室" :value="1" />
              <el-option label="2室" :value="2" />
              <el-option label="3室" :value="3" />
              <el-option label="4室" :value="4" />
              <el-option label="5室+" :value="5" />
            </el-select>
          </div>
          <div class="col-md-4 mb-3">
            <label class="form-label">洗手间数量</label>
            <el-select v-model="form.bathrooms" class="w-100" placeholder="请选择">
              <el-option label="请选择" value="" />
              <el-option label="1个" :value="1" />
              <el-option label="2个" :value="2" />
              <el-option label="3个+" :value="3" />
            </el-select>
          </div>
        </div>

        <!-- 房屋详情 -->
        <div class="form-section-title">
          <i class="fas fa-home"></i>
          <span>房屋详情</span>
        </div>
        <div class="row mb-4">
          <div class="col-md-4 mb-3">
            <label class="form-label">是否复式</label>
            <el-select v-model="form.is_duplex" class="w-100" placeholder="请选择">
              <el-option label="请选择" value="" />
              <el-option label="是" value="1" />
              <el-option label="否" value="0" />
            </el-select>
          </div>
          <div class="col-md-4 mb-3">
            <label class="form-label">户外特征</label>
            <el-input v-model="form.outdoor_features" placeholder="例如：阳台、露台、院子" />
          </div>
          <div class="col-md-4 mb-3">
            <label class="form-label">面积(㎡)</label>
            <el-input v-model="form.area" placeholder="例如：128" />
          </div>
          <div class="col-md-4 mb-3">
            <label class="form-label">楼层</label>
            <el-input v-model="form.floor_info" placeholder="例如：10/20层" />
          </div>
        </div>

        <!-- 位置信息 -->
        <div class="form-section-title">
          <i class="fas fa-map-marker-alt"></i>
          <span>位置信息</span>
        </div>
        <div class="row mb-4">
          <div class="col-md-6 mb-3">
            <label class="form-label">区域</label>
            <el-select v-model="form.district" class="w-100" filterable clearable placeholder="请选择">
              <el-option v-for="d in districts" :key="d" :label="d" :value="d" />
            </el-select>
          </div>
          <div class="col-md-6 mb-3">
            <label class="form-label">详细地址</label>
            <el-input v-model="form.street" placeholder="例如：肇嘉浜路889弄208室" />
          </div>

          <!-- 地铁线路多选 -->
          <div class="col-md-6 mb-3">
            <label class="form-label">地铁线路 <span class="text-muted small">（可多选）</span></label>
            <div class="selected-tags-container lines-container mb-2">
              <span v-for="line in selectedMetroLines" :key="line.id" class="selected-tag">
                {{ line.name_cn }}
                <span class="tag-remove" @click="removeMetroLine(line)">&times;</span>
              </span>
            </div>
            <select class="form-select" multiple size="5" @change="onMetroLineSelect">
              <option v-for="line in metroLines" :key="line.id" :value="line.id"
                :selected="selectedMetroLineIds.includes(line.id)">
                {{ line.name_cn }}
              </option>
            </select>
            <small class="text-muted">点击选择，按住Ctrl可多选</small>
          </div>

          <!-- 地铁站点多选 -->
          <div class="col-md-6 mb-3">
            <label class="form-label">地铁站点 <span class="text-muted small">（可多选）</span></label>
            <div class="selected-tags-container stations-container mb-2">
              <span v-for="station in selectedMetroStations" :key="station.id" class="selected-tag station-tag">
                {{ station.name_cn }}
                <span class="tag-remove" @click="removeMetroStation(station)">&times;</span>
              </span>
            </div>
            <select class="form-select" multiple size="5" @change="onMetroStationSelect">
              <option v-if="!filteredStations.length" disabled>请先选择地铁线路</option>
              <option v-for="st in filteredStations" :key="st.id" :value="st.id"
                :selected="selectedMetroStationIds.includes(st.id)">
                {{ st.name_cn }}
              </option>
            </select>
            <small class="text-muted">点击选择，按住Ctrl可多选</small>
          </div>
        </div>

        <!-- 地图定位 -->
        <div class="form-section-title">
          <i class="fas fa-map"></i>
          <span>地图定位</span>
        </div>
        <div class="row mb-4">
          <div class="col-12 mb-3">
            <label class="form-label">完整地址 <span class="text-muted small">（用于地图定位，可自动组合）</span></label>
            <div class="d-flex gap-2 align-items-center">
              <el-input v-model="fullAddress" placeholder="输入完整地址，如：上海市浦东新区碧云路xxx号" style="flex:1" />
              <el-button type="success" :loading="geocoding" @click="handleGeocode">
                <i class="fas fa-map-marker-alt me-1"></i>地图定位
              </el-button>
              <el-button @click="autoFillAddress">
                <i class="fas fa-magic me-1"></i>自动组合
              </el-button>
            </div>
          </div>
          <div class="col-12 mb-3">
            <div class="map-wrapper">
              <div ref="uploadMapContainer" class="upload-map-container"></div>
              <div v-if="mapLoading" class="map-overlay-upload">
                <i class="fas fa-spinner fa-spin fa-2x text-success"></i>
                <p>地图加载中...</p>
              </div>
              <div v-if="!mapLoaded && !mapLoading" class="map-overlay-upload">
                <i class="fas fa-map fa-2x text-muted"></i>
                <p>请输入地址并点击"地图定位"</p>
              </div>
            </div>
            <div class="map-hint mt-2">
              <small class="text-muted"><i class="fas fa-info-circle me-1"></i>定位后可拖拽标记调整位置，也可直接点击地图选点</small>
            </div>
          </div>
          <div class="col-md-6 mb-3">
            <label class="form-label">纬度</label>
            <el-input v-model="form.latitude" placeholder="自动获取" readonly />
          </div>
          <div class="col-md-6 mb-3">
            <label class="form-label">经度</label>
            <el-input v-model="form.longitude" placeholder="自动获取" readonly />
          </div>
        </div>

        <!-- 联系信息 -->
        <div class="form-section-title">
          <i class="fas fa-address-card"></i>
          <span>联系信息</span>
        </div>
        <div class="row mb-4">
          <div class="col-md-6 mb-3">
            <label class="form-label">发布人</label>
            <el-input v-model="form.publisher_name" placeholder="例如：张先生" />
          </div>
          <div class="col-md-6 mb-3">
            <label class="form-label">联系方式</label>
            <el-input v-model="form.contact_info" placeholder="例如：13800138000" />
          </div>
        </div>

        <!-- 代理人与业主（仅当前用户可见） -->
        <div class="form-section-title">
          <i class="fas fa-user-tie"></i>
          <span>代理人与业主</span>
          <span class="section-hint">仅您自己可见，其他用户不可见</span>
        </div>
        <div class="row mb-4">
          <!-- 选择代理人 -->
          <div class="col-md-6 mb-3">
            <label class="form-label">选择代理人</label>
            <div class="d-flex gap-2 align-items-center">
              <el-select v-model="form.agent_id" class="flex-grow-1" filterable clearable placeholder="请选择代理人" @change="onAgentChange">
                <el-option v-for="a in agentList" :key="a.id" :label="`${a.agent_name}${a.agent_phone ? ' ('+a.agent_phone+')' : ''}`" :value="a.id">
                  <div class="agent-option-row">
                    <span class="agent-option-label">{{ a.agent_name }}{{ a.agent_phone ? ` (${a.agent_phone})` : '' }}</span>
                    <button
                      type="button"
                      class="agent-option-delete"
                      :disabled="deletingAgentId === a.id"
                      title="删除代理人"
                      @mousedown.stop.prevent
                      @click.stop.prevent="deleteAgent(a)"
                    >
                      <i v-if="deletingAgentId === a.id" class="fas fa-spinner fa-spin"></i>
                      <i v-else class="fas fa-trash"></i>
                    </button>
                  </div>
                </el-option>
              </el-select>
              <el-button type="primary" size="small" @click="showAgentDialog = true">
                <i class="fas fa-plus me-1"></i>新增
              </el-button>
            </div>
          </div>
          <!-- 代理人信息展示 -->
          <div v-if="selectedAgent" class="col-md-6 mb-3">
            <label class="form-label">代理人信息</label>
            <div class="agent-info-card">
              <div><i class="fas fa-user me-1"></i>{{ selectedAgent.agent_name }}</div>
              <div v-if="selectedAgent.agent_phone"><i class="fas fa-phone me-1"></i>{{ selectedAgent.agent_phone }}</div>
              <div v-if="selectedAgent.agent_wechat"><i class="fab fa-weixin me-1"></i>{{ selectedAgent.agent_wechat }}</div>
              <el-button size="small" text type="primary" @click="editAgent(selectedAgent)"><i class="fas fa-edit"></i> 编辑</el-button>
              <el-button size="small" text type="danger" @click="removeAgent"><i class="fas fa-trash"></i> 移除</el-button>
              <el-button size="small" text type="danger" :loading="deletingAgentId === selectedAgent.id" @click="deleteAgent(selectedAgent)">
                <i class="fas fa-trash-alt"></i> 删除代理人
              </el-button>
            </div>
          </div>
          <!-- 业主列表 -->
          <div v-if="form.agent_id" class="col-12 mb-3">
            <label class="form-label">业主信息 <span class="text-muted small">（可添加多个业主）</span></label>
            <div class="owner-list">
              <div v-for="(owner, idx) in ownerList" :key="owner.id || idx" class="owner-item">
                <div class="owner-item-info">
                  <span class="owner-name"><i class="fas fa-home me-1"></i>{{ owner.owner_name }}</span>
                  <span v-if="owner.owner_phone" class="owner-contact"><i class="fas fa-phone me-1"></i>{{ owner.owner_phone }}</span>
                  <span v-if="owner.owner_wechat" class="owner-contact"><i class="fab fa-weixin me-1"></i>{{ owner.owner_wechat }}</span>
                </div>
                <div class="owner-item-actions">
                  <el-button size="small" text type="primary" @click="editOwner(owner)"><i class="fas fa-edit"></i></el-button>
                  <el-button size="small" text type="danger" @click="deleteOwner(owner)"><i class="fas fa-trash"></i></el-button>
                </div>
              </div>
              <div v-if="!ownerList.length" class="text-muted small py-2">暂无业主，点击下方按钮添加</div>
            </div>
            <el-button size="small" class="mt-2" @click="showOwnerDialog = true">
              <i class="fas fa-plus me-1"></i>添加业主
            </el-button>
          </div>
        </div>

        <!-- 新增/编辑代理人对话框 -->
        <el-dialog v-model="showAgentDialog" :title="editingAgent ? '编辑代理人' : '新增代理人'" width="480px" destroy-on-close>
          <el-form label-position="top">
            <el-form-item label="代理人名称" required>
              <el-input v-model="agentForm.agent_name" placeholder="请输入代理人名称" />
            </el-form-item>
            <el-form-item label="电话">
              <el-input v-model="agentForm.agent_phone" placeholder="请输入代理人电话" />
            </el-form-item>
            <el-form-item label="微信号">
              <el-input v-model="agentForm.agent_wechat" placeholder="请输入代理人微信号" />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="agentForm.notes" type="textarea" :rows="2" placeholder="备注信息" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="showAgentDialog = false">取消</el-button>
            <el-button type="primary" :loading="agentSaving" @click="saveAgent">保存</el-button>
          </template>
        </el-dialog>

        <!-- 新增/编辑业主对话框 -->
        <el-dialog v-model="showOwnerDialog" :title="editingOwner ? '编辑业主' : '添加业主'" width="480px" destroy-on-close>
          <el-form label-position="top">
            <el-form-item label="业主名称" required>
              <el-input v-model="ownerForm.owner_name" placeholder="请输入业主名称" />
            </el-form-item>
            <el-form-item label="电话">
              <el-input v-model="ownerForm.owner_phone" placeholder="请输入业主电话" />
            </el-form-item>
            <el-form-item label="微信号">
              <el-input v-model="ownerForm.owner_wechat" placeholder="请输入业主微信号" />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="ownerForm.notes" type="textarea" :rows="2" placeholder="备注信息" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="showOwnerDialog = false">取消</el-button>
            <el-button type="primary" :loading="ownerSaving" @click="saveOwner">保存</el-button>
          </template>
        </el-dialog>

        <!-- 配套设施 -->
        <div class="form-section-title">
          <i class="fas fa-check-circle"></i>
          <span>配套设施</span>
        </div>
        <div class="row mb-4">
          <div class="col-md-3 mb-3">
            <el-checkbox v-model="form.has_elevator">有电梯</el-checkbox>
          </div>
          <div class="col-md-3 mb-3">
            <el-checkbox v-model="form.has_parking">有车位</el-checkbox>
          </div>
          <div class="col-md-3 mb-3">
            <el-checkbox v-model="form.has_commission">有佣金</el-checkbox>
          </div>
        </div>

        <!-- 内容资产图片 -->
        <div class="form-section-title">
          <i class="fas fa-images"></i>
          <span>内容资产图片</span>
        </div>
        <div class="row mb-4">
          <div class="col-12 mb-3">
            <label class="form-label">上传内容资产图片 <span class="text-muted small">（最多9张，支持jpg/png/gif格式，单张最大5MB）</span></label>
            <div class="upload-zone" @click="$refs.imageInput.click()" @dragover.prevent="dragover = true" @dragleave.prevent="dragover = false" @drop.prevent="handleImageDrop" :class="{ dragover }">
              <input ref="imageInput" type="file" multiple accept="image/*" style="display: none" @change="handleImageSelect">
              <i class="fas fa-cloud-upload-alt fa-3x text-muted mb-2"></i>
              <p class="text-muted mb-0">点击或拖拽图片到此处上传</p>
            </div>
            <div v-if="imageFiles.length" class="image-sort-tip">拖动图片即可调整顺序，第一张会作为内容资产封面。</div>
            <div class="image-preview-container mt-3" v-if="imageFiles.length">
              <div
                v-for="(img, idx) in imageFiles"
                :key="img.preview || idx"
                class="image-preview-item"
                :class="{ 'is-dragging': draggingImageIndex === idx, 'is-cover': idx === 0 }"
                draggable="true"
                @dragstart="handlePreviewDragStart(idx)"
                @dragover.prevent
                @drop.prevent="handlePreviewDrop(idx)"
                @dragend="handlePreviewDragEnd"
              >
                <img v-if="!img.loadError" :src="img.preview" alt="" @error="handleExistingImageError(img)">
                <div v-else class="image-missing-placeholder">
                  <i class="fas fa-exclamation-triangle"></i>
                  <span>图片文件缺失</span>
                </div>
                <span class="cover-badge">{{ idx === 0 ? '封面' : `#${idx + 1}` }}</span>
                <button type="button" class="remove-btn" @click="removeImage(idx)"><i class="fas fa-times"></i></button>
              </div>
            </div>
          </div>
        </div>

        <!-- 内容资产视频 -->
        <div class="form-section-title">
          <i class="fas fa-video"></i>
          <span>内容资产视频</span>
        </div>
        <div class="row mb-4">
          <div class="col-12 mb-3">
            <label class="form-label">上传内容资产视频 <span class="text-muted small">（最多1个，支持mp4/mov格式，最大50MB）</span></label>
            <div v-if="!videoFile" class="video-upload-zone" @click="$refs.videoInput.click()">
              <input ref="videoInput" type="file" accept="video/mp4,video/quicktime,video/x-m4v" style="display: none" @change="handleVideoSelect">
              <i class="fas fa-film fa-3x text-info mb-2"></i>
              <p class="text-muted mb-0">点击上传视频</p>
            </div>
            <div v-else class="video-preview-container mt-2">
              <div class="video-preview-item">
                <video :src="videoFile.preview" muted></video>
                <button type="button" class="remove-btn" @click="removeVideo"><i class="fas fa-times"></i></button>
              </div>
              <small v-if="videoFile.file" class="text-muted ms-2">{{ videoFile.file.name }} ({{ (videoFile.file.size / 1024 / 1024).toFixed(1) }}MB)</small>
              <small v-else class="text-muted ms-2">已有视频</small>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="text-end form-actions">
          <el-button @click="resetForm"><i class="fas fa-undo me-1"></i>重置表单</el-button>
          <el-button class="btn-save-draft" :loading="publishing" @click="handleSave('draft')">
            <i class="fas fa-save me-1"></i>{{ isEditMode ? '保存为草稿' : '保存草稿' }}
          </el-button>
          <el-button class="btn-upload-submit" :loading="publishing" @click="handleSave('published')">
            <i class="fas fa-check me-1"></i>{{ isEditMode ? '保存并发布' : '发布内容资产' }}
          </el-button>
        </div>
      </el-form>
    </div>

    <!-- 图片预览弹窗 -->
    <el-dialog v-model="previewVisible" title="图片预览" width="800px">
      <img :src="previewUrl" style="width: 100%" alt="">
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'

const router = useRouter()
const route = useRoute()
const featureBlocked = ref(false)
const editId = ref(route.params.id || null)
const isEditMode = computed(() => !!editId.value)
const formRef = ref(null)
const publishing = ref(false)
const aiParsing = ref(false)
const previewVisible = ref(false)
const previewUrl = ref('')
const dragover = ref(false)
const draggingImageIndex = ref(-1)

const districts = ref([])
const metroLines = ref([])
const metroStations = ref([])

const selectedMetroLines = ref([])
const selectedMetroStations = ref([])
const selectedMetroLineIds = computed(() => selectedMetroLines.value.map(l => l.id))
const selectedMetroStationIds = computed(() => selectedMetroStations.value.map(s => s.id))

const filteredStations = computed(() => {
  if (!selectedMetroLineIds.value.length) return []
  return metroStations.value.filter(s =>
    selectedMetroLineIds.value.includes(s.line_id)
  )
})

const imageFiles = ref([])
const videoFile = ref(null)
const uploadMapContainer = ref(null)
const fullAddress = ref('')
const geocoding = ref(false)
const mapLoading = ref(false)
const mapLoaded = ref(false)
const poiSearching = ref(false)
const poiMatchFound = ref(false)
let mapInstance = null
let mapMarker = null
let communityDebounceTimer = null

const form = reactive({
  title: '', description: '', community: '', price: '',
  bedrooms: '', bathrooms: '',
  is_duplex: '', outdoor_features: '', area: '', floor_info: '',
  district: '', street: '',
  latitude: '', longitude: '',
  publisher_name: '', contact_info: '',
  has_elevator: false, has_parking: false, has_commission: false,
  agent_id: null, agent_owners: null,
})

// 代理人与业主
const agentList = ref([])
const ownerList = ref([])
const showAgentDialog = ref(false)
const showOwnerDialog = ref(false)
const agentSaving = ref(false)
const ownerSaving = ref(false)
const deletingAgentId = ref(null)
const editingAgent = ref(null)
const editingOwner = ref(null)
const agentForm = reactive({ agent_name: '', agent_phone: '', agent_wechat: '', notes: '' })
const ownerForm = reactive({ owner_name: '', owner_phone: '', owner_wechat: '', notes: '' })

const selectedAgent = computed(() => {
  if (!form.agent_id) return null
  return agentList.value.find(a => a.id === form.agent_id) || null
})

async function loadAgents() {
  try {
    const res = await api.get('/user/property-agents')
    agentList.value = res.data?.data || res.data || []
  } catch { agentList.value = [] }
}

async function onAgentChange(agentId) {
  ownerList.value = []
  if (!agentId) return
  try {
    const res = await api.get(`/user/property-agents/${agentId}/owners`)
    ownerList.value = res.data?.data || res.data || []
  } catch { ownerList.value = [] }
}

function editAgent(agent) {
  editingAgent.value = agent
  Object.assign(agentForm, { agent_name: agent.agent_name, agent_phone: agent.agent_phone || '', agent_wechat: agent.agent_wechat || '', notes: agent.notes || '' })
  showAgentDialog.value = true
}

function removeAgent() {
  form.agent_id = null
  ownerList.value = []
}

async function deleteAgent(agent) {
  if (!agent?.id || deletingAgentId.value) return
  try {
    await ElMessageBox.confirm(
      `确定删除代理人「${agent.agent_name}」吗？删除后该代理人及其业主将不再显示。`,
      '删除代理人',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      }
    )
  } catch {
    return
  }

  deletingAgentId.value = agent.id
  try {
    await api.delete(`/user/property-agents/${agent.id}`)
    if (form.agent_id === agent.id) {
      form.agent_id = null
      ownerList.value = []
    }
    agentList.value = agentList.value.filter(item => item.id !== agent.id)
    ElMessage.success('代理人已删除')
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '删除失败')
  } finally {
    deletingAgentId.value = null
  }
}

async function saveAgent() {
  if (!agentForm.agent_name) { ElMessage.warning('请输入代理人名称'); return }
  agentSaving.value = true
  try {
    if (editingAgent.value) {
      await api.put(`/user/property-agents/${editingAgent.value.id}`, { ...agentForm })
    } else {
      const res = await api.post('/user/property-agents', { ...agentForm })
      const newAgent = res.data?.data
      if (newAgent) form.agent_id = newAgent.id
    }
    await loadAgents()
    if (form.agent_id) await onAgentChange(form.agent_id)
    showAgentDialog.value = false
    editingAgent.value = null
    Object.assign(agentForm, { agent_name: '', agent_phone: '', agent_wechat: '', notes: '' })
    ElMessage.success('保存成功')
  } catch (e) { ElMessage.error(e.response?.data?.message || '保存失败') }
  agentSaving.value = false
}

function editOwner(owner) {
  editingOwner.value = owner
  Object.assign(ownerForm, { owner_name: owner.owner_name, owner_phone: owner.owner_phone || '', owner_wechat: owner.owner_wechat || '', notes: owner.notes || '' })
  showOwnerDialog.value = true
}

async function deleteOwner(owner) {
  if (!owner.id) { ownerList.value = ownerList.value.filter(o => o !== owner); return }
  try {
    await api.delete(`/user/property-agent-owners/${owner.id}`)
    ownerList.value = ownerList.value.filter(o => o.id !== owner.id)
    ElMessage.success('删除成功')
  } catch (e) { ElMessage.error('删除失败') }
}

async function saveOwner() {
  if (!ownerForm.owner_name) { ElMessage.warning('请输入业主名称'); return }
  ownerSaving.value = true
  try {
    if (editingOwner.value && editingOwner.value.id) {
      await api.put(`/user/property-agent-owners/${editingOwner.value.id}`, { ...ownerForm })
    } else {
      await api.post(`/user/property-agents/${form.agent_id}/owners`, { ...ownerForm })
    }
    await onAgentChange(form.agent_id)
    showOwnerDialog.value = false
    editingOwner.value = null
    Object.assign(ownerForm, { owner_name: '', owner_phone: '', owner_wechat: '', notes: '' })
    ElMessage.success('保存成功')
  } catch (e) { ElMessage.error(e.response?.data?.message || '保存失败') }
  ownerSaving.value = false
}

function onMetroLineSelect(e) {
  const opts = Array.from(e.target.selectedOptions)
  const ids = opts.map(o => parseInt(o.value))
  selectedMetroLines.value = metroLines.value.filter(l => ids.includes(l.id))
  selectedMetroStations.value = selectedMetroStations.value.filter(s =>
    selectedMetroLineIds.value.includes(s.line_id)
  )
}

function removeMetroLine(line) {
  selectedMetroLines.value = selectedMetroLines.value.filter(l => l.id !== line.id)
  selectedMetroStations.value = selectedMetroStations.value.filter(s => s.line_id !== line.id)
}

function onMetroStationSelect(e) {
  const opts = Array.from(e.target.selectedOptions)
  const ids = opts.map(o => parseInt(o.value))
  selectedMetroStations.value = filteredStations.value.filter(s => ids.includes(s.id))
}

function removeMetroStation(station) {
  selectedMetroStations.value = selectedMetroStations.value.filter(s => s.id !== station.id)
}

function handleImageSelect(e) {
  const files = Array.from(e.target.files || [])
  addImages(files)
  e.target.value = ''
}

function handleImageDrop(e) {
  dragover.value = false
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
  addImages(files)
}

function addImages(files) {
  const MAX_IMAGES = 9
  const MAX_SIZE = 5 * 1024 * 1024
  for (const file of files) {
    if (imageFiles.value.length >= MAX_IMAGES) {
      ElMessage.warning(`最多上传${MAX_IMAGES}张图片`)
      break
    }
    if (file.size > MAX_SIZE) {
      ElMessage.warning(`图片 ${file.name} 超过5MB限制`)
      continue
    }
    imageFiles.value.push({ file, preview: URL.createObjectURL(file) })
  }
}

function removeImage(idx) {
  const item = imageFiles.value[idx]
  if (item && item.preview && !item.existing) URL.revokeObjectURL(item.preview)
  imageFiles.value.splice(idx, 1)
}

function handleExistingImageError(img) {
  if (!img) return
  img.loadError = true
}

function handlePreviewDragStart(idx) {
  draggingImageIndex.value = idx
}

function handlePreviewDrop(targetIdx) {
  const sourceIdx = draggingImageIndex.value
  if (sourceIdx < 0 || sourceIdx === targetIdx) return
  const list = [...imageFiles.value]
  const [moved] = list.splice(sourceIdx, 1)
  list.splice(targetIdx, 0, moved)
  imageFiles.value = list
}

function handlePreviewDragEnd() {
  draggingImageIndex.value = -1
}

function handleVideoSelect(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > 50 * 1024 * 1024) {
    ElMessage.warning('视频文件超过50MB限制')
    return
  }
  videoFile.value = { file, preview: URL.createObjectURL(file) }
  e.target.value = ''
}

function removeVideo() {
  if (videoFile.value) URL.revokeObjectURL(videoFile.value.preview)
  videoFile.value = null
}

async function handleAiParse() {
  if (!form.description) return
  aiParsing.value = true
  try {
    const res = await api.post('/user/expat/parse-moments', { text: form.description, mode: 'single' })
    const data = res.data?.data || res.data || {}
    if (!form.title && data.title) form.title = data.title
    if (data.price) form.price = data.price
    if (data.bedrooms) form.bedrooms = parseInt(data.bedrooms) || ''
    if (data.bathrooms) form.bathrooms = parseInt(data.bathrooms) || ''
    if (data.district) form.district = data.district
    if (data.community) form.community = data.community
    if (data.street || data.address) form.street = data.street || data.address
    if (data.area_sqm) form.area = data.area_sqm
    if (data.floor_info || data.floor) form.floor_info = data.floor_info || data.floor
    if (data.outdoor_features) form.outdoor_features = data.outdoor_features
    if (data.is_duplex === true || data.is_duplex === 'true') form.is_duplex = '1'
    if (data.has_elevator === true || data.has_elevator === 'true') form.has_elevator = true
    if (data.has_parking === true || data.has_parking === 'true') form.has_parking = true
    if (data.has_commission === true || data.has_commission === 'true') form.has_commission = true
    applyMetroFromText(data.metro_lines, data.metro_stations)
    if (data.publisher_name) form.publisher_name = data.publisher_name
    if (data.contact_info) form.contact_info = data.contact_info
    autoFillAddress()
    ElMessage.success('AI解析完成，已自动填入表单')
    if (form.community) {
      await autoGeocodeFromPOI(form.community)
    }
    generateTitle()
  } catch { ElMessage.warning('AI解析暂时不可用，请手动填写') }
  aiParsing.value = false
}

/**
 * 根据地铁线路和站点文本匹配系统中的地铁数据
 * AI解析和POI数据复用同一逻辑
 */
function applyMetroFromText(linesText, stationsText) {
  if (linesText) {
    const lineNames = typeof linesText === 'string' ? linesText.split(',').map(s => s.trim()).filter(Boolean) : []
    if (lineNames.length) {
      const matched = metroLines.value.filter(l => lineNames.some(n => l.name_cn.includes(n) || n.includes(l.name_cn)))
      if (matched.length) selectedMetroLines.value = matched
    }
  }
  if (stationsText) {
    const stNames = typeof stationsText === 'string' ? stationsText.split(',').map(s => s.trim()).filter(Boolean) : []
    if (stNames.length) {
      const lineIds = selectedMetroLines.value.map(l => l.id)
      const candidates = lineIds.length ? metroStations.value.filter(s => lineIds.includes(s.line_id)) : metroStations.value
      const matched = candidates.filter(s => stNames.some(n => s.name_cn.includes(n) || n.includes(s.name_cn)))
      if (matched.length) selectedMetroStations.value = matched
    }
  }
}

/**
 * 根据小区名从POI数据库获取完整信息，自动填充区域、地址、地铁、地图定位等
 * AI解析未能提供的字段由POI数据补充（不覆盖AI已填写的内容）
 * 同时传入原始描述文本，供后端在小区名匹配失败时从中提取地址回退匹配
 */
async function autoGeocodeFromPOI(communityName) {
  if (!communityName || !communityName.trim()) return
  poiSearching.value = true
  try {
    const res = await api.get('/user/community-poi/geocode', {
      params: { community: communityName.trim(), text: form.description || '' }
    })
    const poiData = res.data?.data || res.data
    if (poiData && poiData.longitude && poiData.latitude) {
      const lng = parseFloat(poiData.longitude)
      const lat = parseFloat(poiData.latitude)
      if (!isNaN(lng) && !isNaN(lat) && lng > 0 && lat > 0) {
        form.latitude = lat.toFixed(6)
        form.longitude = lng.toFixed(6)

        if (poiData.community_name && poiData.community_name !== communityName.trim()) {
          form.community = poiData.community_name
        }
        if (!form.district && poiData.district) form.district = poiData.district
        if (!form.street && poiData.address) form.street = poiData.address
        if (poiData.address) {
          fullAddress.value = ['上海市', poiData.district, poiData.address].filter(Boolean).join('')
        } else {
          autoFillAddress()
        }

        const poiMetroLines = poiData.metro_lines || poiData.nearest_metro_line || ''
        const poiMetroStations = poiData.metro_stations || poiData.nearest_metro_station || ''
        if (!selectedMetroLines.value.length && poiMetroLines) {
          applyMetroFromText(poiMetroLines, poiMetroStations)
        }

        if (!mapInstance) await initMap([lng, lat], 16)
        else mapInstance.setZoom(16)
        setMapMarker([lng, lat])
        poiMatchFound.value = true
        poiSearching.value = false

        const extras = []
        if (poiData.district && !form.district) extras.push('区域')
        if (poiMetroLines) extras.push('地铁')
        const extrasMsg = extras.length ? `，已补充${extras.join('、')}信息` : ''
        ElMessage.success(`已从小区库匹配到「${poiData.community_name}」的位置${extrasMsg}`)
        return
      }
    }
    poiMatchFound.value = false
    ElMessage.info('小区库中未找到该小区的定位数据，请使用地图定位或手动输入地址后点击"地图定位"')
  } catch {
    poiMatchFound.value = false
  }
  poiSearching.value = false
}

function autoFillAddress() {
  const parts = ['上海市', form.district, form.street, form.community].filter(Boolean)
  fullAddress.value = parts.join('')
}

/**
 * 自动生成内容资产标题：区域 + X室 + 价格 + 地铁线路和站点
 * 仅在标题为空时生成，不覆盖用户手动输入的标题
 */
function generateTitle() {
  if (form.title) return
  const parts = []
  if (form.district) parts.push(form.district)
  if (form.bedrooms) parts.push(`${form.bedrooms}室`)
  if (form.price) {
    const priceNum = String(form.price).replace(/[^0-9]/g, '')
    if (priceNum) parts.push(`${priceNum}元/月`)
  }
  if (selectedMetroLines.value.length || selectedMetroStations.value.length) {
    const lineStr = selectedMetroLines.value.map(l => l.name_cn).join('/') || ''
    const stationStr = selectedMetroStations.value.map(s => s.name_cn).join('/') || ''
    if (lineStr && stationStr) parts.push(`近${lineStr}${stationStr}`)
    else if (lineStr) parts.push(`近${lineStr}`)
    else if (stationStr) parts.push(`近${stationStr}`)
  }
  if (parts.length) form.title = parts.join(' ')
}

async function loadAMapScript() {
  if (window.AMap) return window.AMap
  return new Promise((resolve, reject) => {
    api.get('/user/map-settings').then(res => {
      const data = res.data?.data || res.data || {}
      const key = data.amap_js_key || ''
      const secKey = data.amap_security_key || ''
      if (!key) { reject(new Error('地图服务未配置')); return }
      if (secKey) window._AMapSecurityConfig = { securityJsCode: secKey }
      const script = document.createElement('script')
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.Geocoder,AMap.PlaceSearch,AMap.Scale,AMap.ToolBar`
      script.async = true
      script.onload = () => resolve(window.AMap)
      script.onerror = reject
      document.head.appendChild(script)
    }).catch(reject)
  })
}

async function initMap(center, zoom) {
  if (!uploadMapContainer.value) return
  mapLoading.value = true
  try {
    const AMap = await loadAMapScript()
    if (mapInstance) { mapInstance.destroy(); mapInstance = null; mapMarker = null }
    mapInstance = new AMap.Map(uploadMapContainer.value, {
      zoom: zoom || 15,
      center: center || [121.4737, 31.2304],
      resizeEnable: true,
    })
    mapInstance.addControl(new AMap.Scale())
    mapInstance.addControl(new AMap.ToolBar({ position: 'RT' }))
    mapInstance.on('click', (e) => {
      setMapMarker([e.lnglat.getLng(), e.lnglat.getLat()])
    })
    mapLoaded.value = true
  } catch { ElMessage.warning('地图服务暂不可用') }
  mapLoading.value = false
}

function setMapMarker(lngLat) {
  if (!mapInstance || !window.AMap) return
  const AMap = window.AMap
  if (mapMarker) mapInstance.remove(mapMarker)
  mapMarker = new AMap.Marker({
    position: lngLat,
    draggable: true,
    animation: 'AMAP_ANIMATION_DROP',
  })
  mapMarker.on('dragend', (e) => {
    const pos = mapMarker.getPosition()
    form.latitude = pos.getLat().toFixed(6)
    form.longitude = pos.getLng().toFixed(6)
  })
  mapInstance.add(mapMarker)
  mapInstance.setCenter(lngLat)
  form.latitude = lngLat[1].toFixed ? lngLat[1].toFixed(6) : String(lngLat[1])
  form.longitude = lngLat[0].toFixed ? lngLat[0].toFixed(6) : String(lngLat[0])
}

async function handleGeocode() {
  if (!fullAddress.value) { ElMessage.warning('请先输入地址'); return }
  geocoding.value = true
  try {
    if (!mapInstance) await initMap()
    const AMap = window.AMap
    if (!AMap) { ElMessage.error('地图服务未加载'); geocoding.value = false; return }
    const geocoder = new AMap.Geocoder()
    geocoder.getLocation(fullAddress.value, (status, result) => {
      if (status === 'complete' && result?.geocodes?.length) {
        const loc = result.geocodes[0].location
        mapInstance.setZoom(16)
        setMapMarker([loc.getLng(), loc.getLat()])
        ElMessage.success('定位成功')
      } else if (status === 'no_data') {
        ElMessage.warning('未找到该地址，请尝试输入更详细的地址')
      } else {
        ElMessage.warning(`定位失败(${status})，可能是地图API限流，请稍后重试或联系管理员检查地图Key配置`)
      }
      geocoding.value = false
    })
  } catch (e) {
    ElMessage.error('地图服务加载失败，请检查网络或联系管理员')
    geocoding.value = false
  }
}

async function handleSave(status) {
  if (!form.community && !form.description) {
    ElMessage.warning('请至少填写小区名或内容资产描述')
    return
  }
  publishing.value = true
  try {
    const features = {}
    if (form.community) features.community = form.community
    if (form.is_duplex) features.is_duplex = form.is_duplex
    if (form.outdoor_features) features.outdoor_features = form.outdoor_features
    if (form.has_parking) features.parking = true
    if (form.has_elevator) features.elevator = true
    if (form.has_commission) features.commission = true
    if (form.publisher_name) features.publisher_name = form.publisher_name
    if (form.contact_info) features.contact_info = form.contact_info

    const amenities = []
    if (form.has_elevator) amenities.push('elevator')
    if (form.has_parking) amenities.push('parking')

    const metroLineNames = selectedMetroLines.value.map(l => l.name_cn).join(',')
    const metroStationNames = selectedMetroStations.value.map(s => s.name_cn).join(',')

    if (!form.title) generateTitle()
    const payload = {
      title: form.title || form.community || '新内容资产',
      description: form.description,
      price: form.price ? parseFloat(String(form.price).replace(/[^0-9.]/g, '')) || 0 : 0,
      bedrooms: form.bedrooms ? parseInt(form.bedrooms) : 0,
      bathrooms: form.bathrooms ? parseInt(form.bathrooms) : 0,
      area: form.area ? parseFloat(form.area) : null,
      floor: form.floor_info || null,
      district: form.district,
      address: form.street,
      metro_line: metroLineNames,
      metro_station: metroStationNames,
      subway_line: metroLineNames,
      subway_station: metroStationNames,
      features: JSON.stringify(features),
      amenities: JSON.stringify(amenities),
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      city: '上海',
      status: status,
      agent_id: form.agent_id || null,
      agent_owners: ownerList.value.length > 0 ? JSON.stringify(ownerList.value.map(o => ({
        id: o.id, name: o.owner_name, phone: o.owner_phone, wechat: o.owner_wechat
      }))) : null,
    }

    let propId
    if (isEditMode.value) {
      await api.put(`/user/properties/${editId.value}`, payload)
      propId = editId.value
    } else {
      const res = await api.post('/user/properties', payload)
      propId = res.data?.data?.id || res.data?.id
    }

    const newImageFiles = imageFiles.value.filter(f => f.file && !f.existing)
    const hasNewVideo = videoFile.value && videoFile.value.file && !videoFile.value.existing

    if (propId && (newImageFiles.length > 0 || hasNewVideo)) {
      const formData = new FormData()
      newImageFiles.forEach(f => formData.append('files', f.file))
      if (hasNewVideo) formData.append('files', videoFile.value.file)
      formData.append('propertyId', propId)
      formData.append('type', 'property')
      try {
        const uploadRes = await api.post('/user/media/upload', formData)
        const urls = uploadRes.data?.data?.urls || uploadRes.data?.urls || []
        const newImgUrls = urls.filter(u => !u.match(/\.(mp4|mov|m4v)$/i))
        const newVidUrls = urls.filter(u => u.match(/\.(mp4|mov|m4v)$/i))

        const existingImgUrls = imageFiles.value.filter(f => f.existing && !f.loadError).map(f => f.preview)
        const existingVidUrls = (videoFile.value && videoFile.value.existing) ? [videoFile.value.preview] : []

        const allImgUrls = [...existingImgUrls, ...newImgUrls]
        const allVidUrls = [...existingVidUrls, ...newVidUrls]

        const mediaUpdates = {}
        if (allImgUrls.length) mediaUpdates.images = JSON.stringify(allImgUrls)
        if (allVidUrls.length) mediaUpdates.videos = JSON.stringify(allVidUrls)
        if (Object.keys(mediaUpdates).length) {
          await api.put(`/user/properties/${propId}`, mediaUpdates)
        }
      } catch (uploadErr) {
        console.error('Media upload error:', uploadErr)
        ElMessage.warning('媒体文件上传失败，但内容资产信息已保存')
      }
    } else if (isEditMode.value) {
      const existingImgUrls = imageFiles.value.filter(f => f.existing && !f.loadError).map(f => f.preview)
      const existingVidUrls = (videoFile.value && videoFile.value.existing) ? [videoFile.value.preview] : []
      await api.put(`/user/properties/${propId}`, {
        images: JSON.stringify(existingImgUrls),
        videos: JSON.stringify(existingVidUrls),
      })
    } else if (propId && imageFiles.value.length === 0 && !videoFile.value) {
      await api.put(`/user/properties/${propId}`, {
        images: JSON.stringify([]),
        videos: JSON.stringify([]),
      })
    }

    ElMessage.success(isEditMode.value ? '修改成功！' : (status === 'published' ? '发布成功！' : '保存草稿成功！'))
    router.push('/user/properties')
  } catch (e) {
    ElMessage.error(e.response?.data?.message || e.message || '保存失败')
  }
  publishing.value = false
}

function resetForm() {
  Object.assign(form, {
    title: '', description: '', community: '', price: '',
    bedrooms: '', bathrooms: '',
    is_duplex: '', outdoor_features: '', area: '', floor_info: '',
    district: '', street: '', latitude: '', longitude: '',
    publisher_name: '', contact_info: '',
    has_elevator: false, has_parking: false, has_commission: false,
  })
  fullAddress.value = ''
  if (mapInstance && mapMarker) { mapInstance.remove(mapMarker); mapMarker = null }
  selectedMetroLines.value = []
  selectedMetroStations.value = []
  imageFiles.value.forEach(f => URL.revokeObjectURL(f.preview))
  imageFiles.value = []
  if (videoFile.value) URL.revokeObjectURL(videoFile.value.preview)
  videoFile.value = null
}

async function loadPropertyForEdit(id) {
  try {
    const res = await api.get(`/user/properties/${id}`)
    const p = res.data?.data || res.data || {}
    form.title = p.title || ''
    form.description = p.description || ''
    form.price = p.price || ''
    form.bedrooms = p.bedrooms || ''
    form.bathrooms = p.bathrooms || ''
    form.area = p.area || ''
    form.floor_info = p.floor || ''
    form.district = p.district || ''
    form.street = p.address || ''
    form.latitude = p.latitude || ''
    form.longitude = p.longitude || ''
    form.publisher_name = ''
    form.contact_info = ''
    form.has_elevator = false
    form.has_parking = false
    form.has_commission = false
    form.is_duplex = ''
    form.outdoor_features = ''
    form.community = ''
    form.agent_id = p.agent_id || null
    if (p.agent_id) { onAgentChange(p.agent_id) }

    let features = p.features
    if (typeof features === 'string') { try { features = JSON.parse(features) } catch { features = {} } }
    if (features && typeof features === 'object') {
      form.community = features.community || ''
      form.is_duplex = features.is_duplex || ''
      form.outdoor_features = features.outdoor_features || ''
      form.publisher_name = features.publisher_name || ''
      form.contact_info = features.contact_info || ''
      form.has_parking = !!features.parking
      form.has_elevator = !!features.elevator
      form.has_commission = !!features.commission
    }

    let amenities = p.amenities
    if (typeof amenities === 'string') { try { amenities = JSON.parse(amenities) } catch { amenities = [] } }
    if (Array.isArray(amenities)) {
      if (amenities.includes('elevator')) form.has_elevator = true
      if (amenities.includes('parking')) form.has_parking = true
    }

    if (p.subway_line || p.metro_line) {
      const lineStr = p.subway_line || p.metro_line || ''
      const lineNames = lineStr.split(',').map(s => s.trim()).filter(Boolean)
      selectedMetroLines.value = metroLines.value.filter(l => lineNames.some(n => l.name_cn.includes(n)))
    }
    if (p.subway_station || p.metro_station) {
      const stStr = p.subway_station || p.metro_station || ''
      const stNames = stStr.split(',').map(s => s.trim()).filter(Boolean)
      selectedMetroStations.value = metroStations.value.filter(s => stNames.some(n => s.name_cn.includes(n)))
    }

    let imgs = p.images
    if (typeof imgs === 'string') { try { imgs = JSON.parse(imgs) } catch { imgs = [] } }
    if (Array.isArray(imgs) && imgs.length) {
      imageFiles.value = imgs.map(url => {
        const u = typeof url === 'string' ? url : (url.url || url.thumb || '')
        return { preview: u, file: null, existing: true, loadError: false }
      })
    }

    let vids = p.videos
    if (typeof vids === 'string') { try { vids = JSON.parse(vids) } catch { vids = [] } }
    if (Array.isArray(vids) && vids.length) {
      const vUrl = typeof vids[0] === 'string' ? vids[0] : (vids[0].url || '')
      if (vUrl) videoFile.value = { preview: vUrl, file: null, existing: true }
    }

    if (form.latitude && form.longitude) {
      fullAddress.value = [form.district, form.street, form.community].filter(Boolean).join(' ')
      setTimeout(() => {
        initMap([parseFloat(form.longitude), parseFloat(form.latitude)], 16).then(() => {
          setMapMarker([parseFloat(form.longitude), parseFloat(form.latitude)])
        }).catch(() => {})
      }, 500)
    }
  } catch (e) {
    ElMessage.error('加载内容资产数据失败')
    console.error('[loadPropertyForEdit]', e)
  }
}

// 监听小区名变化，自动从POI获取经纬度（防抖处理，仅在非AI解析触发时）
watch(() => form.community, (newVal, oldVal) => {
  if (!newVal || newVal === oldVal || aiParsing.value) return
  if (communityDebounceTimer) clearTimeout(communityDebounceTimer)
  communityDebounceTimer = setTimeout(() => {
    if (form.community && form.community.trim().length >= 2) {
      autoGeocodeFromPOI(form.community)
    }
  }, 800)
})

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

  try {
    const [distRes, lineRes, stationRes] = await Promise.all([
      api.get('/districts').catch(() => ({ data: [] })),
      api.get('/metro-lines').catch(() => ({ data: [] })),
      api.get('/metro-stations').catch(() => ({ data: [] })),
    ])
    const distData = distRes.data?.data || distRes.data || []
    districts.value = Array.isArray(distData) ? distData.map(d => d.name_cn || d) : []
    metroLines.value = lineRes.data?.data || lineRes.data || []
    metroStations.value = stationRes.data?.data || stationRes.data || []
  } catch {}

  await loadAgents()

  if (editId.value) {
    await loadPropertyForEdit(editId.value)
  }
})
</script>

<style scoped>
/* 绿色渐变头部 - 与PHP版一致 */
.upload-header {
  background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%);
  color: white; border-radius: 16px; padding: 24px; margin-bottom: 24px;
}
.upload-header h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 8px; color: white; }
.upload-header p { font-size: 13px; color: rgba(255,255,255,0.85); }
.btn-back {
  display: inline-flex; align-items: center; padding: 8px 16px;
  background: rgba(255,255,255,0.2); color: white; border-radius: 8px;
  text-decoration: none; transition: all 0.3s; font-size: 13px;
}
.btn-back:hover { background: rgba(255,255,255,0.3); color: white; }

.form-card {
  background: white; border-radius: 16px; padding: 24px;
  margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

.form-section-title {
  font-size: 1.05rem; font-weight: 600; color: #191919;
  margin-bottom: 18px; padding-bottom: 10px;
  border-bottom: 2px solid #4CAF50;
  display: flex; align-items: center;
}
.form-section-title i { color: #4CAF50; margin-right: 10px; }
.section-hint {
  margin-left: auto; font-size: 12px; font-weight: 400; color: #e67e22;
  background: #fef5e7; padding: 2px 10px; border-radius: 12px;
}

/* 代理人信息卡 */
.agent-info-card {
  background: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 12px 16px; font-size: 13px; color: #333;
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
}
.agent-info-card i { color: #4CAF50; }
.agent-option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 32px;
}
.agent-option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.agent-option-delete {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #E74C3C;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
}
.agent-option-delete:hover {
  background: #fff0f0;
}
.agent-option-delete:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

/* 业主列表 */
.owner-list {
  background: #fafafa; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 8px; max-height: 280px; overflow-y: auto;
}
.owner-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; border-radius: 8px; transition: background 0.2s;
}
.owner-item:hover { background: #f0f4f8; }
.owner-item + .owner-item { border-top: 1px solid #eee; }
.owner-item-info { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; font-size: 13px; }
.owner-name { font-weight: 600; color: #1a1a1a; }
.owner-contact { color: #666; }
.owner-contact i { color: #4CAF50; margin-right: 2px; }
.owner-item-actions { display: flex; gap: 4px; flex-shrink: 0; }

.form-label { font-size: 13px; font-weight: 500; color: #333; margin-bottom: 6px; display: block; }
.required-mark { color: #E74C3C; margin-left: 4px; }

.btn-ai-parse {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border: none !important; color: white !important; border-radius: 8px !important;
}
.btn-ai-parse:hover { box-shadow: 0 4px 12px rgba(102,126,234,0.4); }

/* 地铁标签 */
.selected-tags-container {
  display: flex; flex-wrap: wrap; gap: 8px;
  min-height: 36px; padding: 8px 12px;
  background: #f8f9fa; border: 1px dashed #dee2e6; border-radius: 8px;
  align-items: center;
}
.selected-tags-container:empty::before { content: "未选择"; color: #999; font-size: 13px; }
.selected-tags-container.lines-container:empty::before { content: "请在下方选择地铁线路"; }
.selected-tags-container.stations-container:empty::before { content: "请先选择线路，再选择站点"; }
.selected-tag {
  display: inline-flex; align-items: center;
  background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%);
  color: white; padding: 5px 12px; border-radius: 20px;
  font-size: 13px; font-weight: 500;
  box-shadow: 0 2px 6px rgba(76,175,80,0.35);
  animation: tagAppear 0.2s ease-out;
}
.selected-tag.station-tag {
  background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
  box-shadow: 0 2px 6px rgba(33,150,243,0.35);
}
@keyframes tagAppear { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.tag-remove {
  margin-left: 6px; cursor: pointer; opacity: 0.85;
  font-size: 14px; font-weight: bold;
  width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.25); border-radius: 50%;
}
.tag-remove:hover { opacity: 1; background: rgba(255,255,255,0.4); }

.form-select {
  width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px;
  font-size: 13px; background: white;
}
.form-select:focus { border-color: #4CAF50; outline: none; box-shadow: 0 0 0 3px rgba(76,175,80,0.1); }

/* 地图 */
.map-wrapper {
  position: relative; border-radius: 12px; overflow: hidden;
  border: 1px solid #ddd; background: #f8f9fa;
}
.upload-map-container { width: 100%; height: 350px; }
.map-overlay-upload {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; background: rgba(248,249,250,0.95);
  color: #888;
}
.map-overlay-upload p { margin-top: 12px; font-size: 13px; }
.map-hint { font-size: 12px; }

.image-missing-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #909399;
  background: #f5f7fa;
  font-size: 12px;
  text-align: center;
  padding: 8px;
}
.image-missing-placeholder i {
  color: #e6a23c;
  font-size: 18px;
}

/* 图片上传 */
.upload-zone {
  border: 2px dashed #ddd; border-radius: 12px; padding: 40px;
  text-align: center; cursor: pointer; transition: all 0.3s; background: #fafafa;
}
.upload-zone:hover { border-color: #4CAF50; background: #f0fff0; }
.upload-zone.dragover { border-color: #4CAF50; background: #e8f5e9; }

.image-sort-tip {
  margin-top: 10px;
  color: #4b5563;
  font-size: 12px;
}
.image-preview-container { display: flex; flex-wrap: wrap; gap: 10px; }
.image-preview-item {
  position: relative; width: 120px; height: 120px;
  border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  cursor: grab;
  border: 2px solid transparent;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.image-preview-item:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(0,0,0,0.12); }
.image-preview-item.is-cover { border-color: #4CAF50; }
.image-preview-item.is-dragging { opacity: 0.55; cursor: grabbing; }
.image-preview-item img { width: 100%; height: 100%; object-fit: cover; }
.cover-badge {
  position: absolute;
  left: 6px;
  bottom: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

/* 视频上传 */
.video-upload-zone {
  border: 2px dashed #17a2b8; border-radius: 12px; padding: 30px;
  text-align: center; cursor: pointer; transition: all 0.3s; background: #f8fcff;
}
.video-upload-zone:hover { border-color: #138496; background: #e3f2fd; }
.video-preview-container { display: flex; align-items: center; }
.video-preview-item {
  position: relative; width: 200px; height: 150px;
  border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.video-preview-item video { width: 100%; height: 100%; object-fit: cover; }

.remove-btn {
  position: absolute; top: 4px; right: 4px;
  width: 24px; height: 24px; border-radius: 50%;
  background: rgba(231,76,60,0.9); color: white; border: none;
  cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px;
}
.remove-btn:hover { background: #c0392b; }

/* 操作按钮 */
.form-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 20px; }
.btn-upload-submit {
  background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%) !important;
  border: none !important; color: white !important; border-radius: 10px !important; font-weight: 600 !important;
  padding: 10px 28px !important;
}
.btn-upload-submit:hover { box-shadow: 0 4px 12px rgba(76,175,80,0.3); }
.btn-save-draft {
  background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%) !important;
  border: none !important; color: white !important; border-radius: 10px !important; font-weight: 600 !important;
  padding: 10px 28px !important;
}
.btn-save-draft:hover { box-shadow: 0 4px 12px rgba(255,152,0,0.3); }

/* 响应式 */
@media (max-width: 767px) {
  .upload-header { padding: 14px 16px; border-radius: 10px; }
  .upload-header h2 { font-size: 1.1rem; }
  .upload-header p { display: none; }
  .form-card { padding: 16px; border-radius: 10px; }
  .form-actions { flex-wrap: wrap; }
  .form-actions .el-button { flex: 1; min-width: 80px; }
  .image-preview-item { width: 80px; height: 80px; }
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
