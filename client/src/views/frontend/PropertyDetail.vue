<template>
  <div class="property-detail-page" :class="{ 'has-mobile-nav': isLoggedIn }">
    <!-- Top Navbar (same as UserProperties) -->
    <nav class="top-navbar">
      <div class="nav-container">
        <div class="navbar-menu">
          <router-link v-if="ownerUsername" :to="`/property/${ownerUsername}?lang=${lang}`" class="nav-item">
            <i class="fas fa-home"></i>
            <span>{{ t.home }}</span>
          </router-link>
          <router-link v-else to="/" class="nav-item">
            <i class="fas fa-home"></i>
            <span>{{ t.home }}</span>
          </router-link>
          <router-link v-if="ownerUsername" :to="`/property/${ownerUsername}?lang=${lang}`" class="nav-item">
            <i class="fas fa-list"></i>
            <span>{{ t.list_view }}</span>
          </router-link>
          <a :href="langSwitchUrl" class="nav-item navbar-lang-switch">
            <span class="flag-icon" :class="lang === 'en' ? 'flag-cn' : 'flag-en'"></span>
            <span>{{ t.switch_lang }}</span>
          </a>
        </div>
      </div>
    </nav>

    <!-- PC Right Contact Sidebar -->
    <div class="contact-sidebar">
      <div v-if="hasContact" class="contact-sidebar-btn" @mouseenter="showContactPopup = true" @mouseleave="showContactPopup = false">
        <i class="fas fa-headset"></i>
        <div class="sidebar-popup" :class="{ visible: showContactPopup }">
          <div class="sidebar-popup-title">
            <i class="fas fa-address-card"></i>
            {{ t.contact_us }}
          </div>
          <div v-if="contactInfo.phone" class="sidebar-popup-item">
            <i class="fas fa-phone"></i>
            <span>{{ t.phone }}: <a :href="'tel:' + contactInfo.phone">{{ contactInfo.phone }}</a></span>
          </div>
          <div v-if="contactInfo.wechat_id" class="sidebar-popup-item">
            <i class="fab fa-weixin"></i>
            <span>{{ t.wechat }}: <strong>{{ contactInfo.wechat_id }}</strong></span>
          </div>
          <div v-if="contactInfo.qrcode_url" class="sidebar-popup-qrcode">
            <img :src="contactInfo.qrcode_url" alt="WeChat QR Code">
            <p>{{ t.scan_to_add }}</p>
          </div>
        </div>
      </div>
      <div class="contact-sidebar-btn" @mouseenter="showQrPopup = true" @mouseleave="showQrPopup = false">
        <i class="fas fa-qrcode"></i>
        <div class="sidebar-popup page-qr-popup" :class="{ visible: showQrPopup }">
          <div class="sidebar-popup-title">
            <i class="fas fa-mobile-alt"></i>
            {{ t.scan_mobile }}
          </div>
          <div class="sidebar-popup-qrcode">
            <img v-if="pageQrCodeUrl" :src="pageQrCodeUrl" alt="Page QR Code" style="width:120px;height:120px;border-radius:8px;">
            <p>{{ lang === 'zh' ? '使用手机相机扫描' : 'Scan with your phone camera' }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="pd-container">
      <el-skeleton :rows="12" animated />
    </div>

    <template v-else-if="property">
      <div class="pd-container">
        <div class="property-layout">
          <!-- Left: Gallery -->
          <div class="gallery-wrapper">
            <div class="property-title-bar">
              <div class="title-bar-main">
                <h2>{{ cardTitle }}</h2>
              </div>
              <button v-if="isLoggedIn" class="btn-favorite" :class="{ favorited: isFavorited }" @click="toggleFavorite" :disabled="favoriteLoading">
                <i :class="isFavorited ? 'fas fa-heart' : 'far fa-heart'"></i>
                <span>{{ isFavorited ? (lang === 'en' ? 'Saved' : '已收藏') : (lang === 'en' ? 'Save' : '收藏') }}</span>
              </button>
            </div>

            <div class="gallery-section">
              <div v-if="galleryItems.length" class="main-gallery">
                <div class="main-image-container">
                  <template v-if="currentGalleryItem?.type === 'video'">
                    <video
                      :key="currentGalleryItem.url"
                      :src="currentGalleryItem.url"
                      controls
                      playsinline
                      preload="metadata"
                      class="main-image main-video"
                    ></video>
                  </template>
                  <template v-else>
                    <img :src="currentImage" :alt="property.title" class="main-image" @click="imageDialogVisible = true">
                  </template>
                  <button v-if="galleryItems.length > 1" class="image-nav prev-btn" type="button" @click="changeImage(-1)">
                    <i class="fas fa-chevron-left"></i>
                  </button>
                  <button v-if="galleryItems.length > 1" class="image-nav next-btn" type="button" @click="changeImage(1)">
                    <i class="fas fa-chevron-right"></i>
                  </button>
                  <div class="image-counter">{{ currentImageIndex + 1 }} / {{ galleryItems.length }}</div>
                </div>
              </div>
              <div v-else class="no-images">
                <i class="fas fa-image"></i>
                <p>{{ t.no_photos }}</p>
              </div>

              <div v-if="galleryItems.length > 1" class="thumbnail-strip">
                <div class="thumbnail-container">
                  <div
                    v-for="(item, index) in galleryItems"
                    :key="item.url + index"
                    class="thumbnail-item"
                    :class="{ active: index === currentImageIndex, 'thumbnail-video': item.type === 'video' }"
                    @click="setMainImage(index)"
                  >
                    <template v-if="item.type === 'video'">
                      <video :src="item.url" preload="metadata" muted class="thumb-video"></video>
                      <div class="thumb-video-icon"><i class="fas fa-play"></i></div>
                    </template>
                    <template v-else>
                      <img :src="item.url" :alt="`Thumbnail ${index + 1}`" loading="lazy">
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Property Information -->
          <div class="details-section">
            <h1 class="section-title">🏠 {{ t.property_info }}</h1>

            <div v-if="property.property_code" class="property-code-display">
              <span class="property-code-value">{{ property.property_code }}</span>
              <button class="copy-id-btn" @click="copyPropertyCode" :title="lang === 'zh' ? '复制房源ID' : 'Copy Property ID'">
                <i :class="codeCopied ? 'fas fa-check' : 'fas fa-copy'"></i>
                <span>{{ codeCopied ? (lang === 'zh' ? '已复制' : 'Copied!') : (lang === 'zh' ? '复制' : 'Copy') }}</span>
              </button>
            </div>

            <div v-if="images.length || videos.length" class="media-count">
              <span v-if="images.length"><i class="fas fa-camera"></i> {{ images.length }} {{ t.photos }}</span>
              <span v-if="videos.length" :style="images.length ? 'margin-left: 12px' : ''"><i class="fas fa-video"></i> {{ videos.length }} {{ lang === 'zh' ? '视频' : 'Videos' }}</span>
            </div>

            <!-- Circular Icon Attribute Grid -->
            <div class="property-attrs property-attrs-icons">
              <div v-if="property.display_price || property.custom_price || property.price_value" class="attr-item">
                <div class="attr-icon"><i class="fas fa-yen-sign"></i></div>
                <div class="attr-label">{{ t.price }}</div>
                <div class="attr-value price">{{ formatPrice(property.display_price || property.custom_price || property.price_value) }}</div>
              </div>

              <div v-if="property.bedrooms != null" class="attr-item">
                <div class="attr-icon"><i class="fas fa-bed"></i></div>
                <div class="attr-label">{{ t.bedrooms }}</div>
                <div class="attr-value">{{ property.bedrooms }} {{ t.rooms }}</div>
              </div>

              <div v-if="property.bathrooms != null" class="attr-item">
                <div class="attr-icon"><i class="fas fa-bath"></i></div>
                <div class="attr-label">{{ t.bathrooms }}</div>
                <div class="attr-value">{{ property.bathrooms }}</div>
              </div>

              <div v-if="property.area_sqm" class="attr-item">
                <div class="attr-icon"><i class="fas fa-expand-arrows-alt"></i></div>
                <div class="attr-label">{{ t.area }}</div>
                <div class="attr-value">{{ property.area_sqm }}㎡</div>
              </div>

              <div v-if="property.district" class="attr-item">
                <div class="attr-icon"><i class="fas fa-map-marker-alt"></i></div>
                <div class="attr-label">{{ t.district }}</div>
                <div class="attr-value">{{ getDisplayDistrict(property.district) }}</div>
              </div>

              <div v-if="property.floor_info" class="attr-item">
                <div class="attr-icon"><i class="fas fa-layer-group"></i></div>
                <div class="attr-label">{{ t.floor }}</div>
                <div class="attr-value">{{ property.floor_info }}</div>
              </div>

              <div v-if="property.has_elevator" class="attr-item">
                <div class="attr-icon"><i class="fas fa-elevator"></i></div>
                <div class="attr-label">{{ t.elevator }}</div>
                <div class="attr-value">{{ t.yes }}</div>
              </div>

              <div v-if="property.subway_line_name" class="attr-item">
                <div class="attr-icon"><i class="fas fa-subway"></i></div>
                <div class="attr-label">{{ t.metro_lines }}</div>
                <div class="attr-value metro-lines">
                  <span
                    v-for="lineObj in getDisplayMetroLines(property.subway_line_name)"
                    :key="lineObj.name"
                    class="metro-badge"
                    :style="{ background: lineObj.color }"
                  >{{ lineObj.name }}</span>
                </div>
              </div>

              <div v-if="property.subway_station_name" class="attr-item">
                <div class="attr-icon"><i class="fas fa-train"></i></div>
                <div class="attr-label">{{ t.metro_stations }}</div>
                <div class="attr-value">{{ getDisplayMetroStation(property.subway_station_name) }}</div>
              </div>

              <div v-if="property.posted_at || property.created_at" class="attr-item">
                <div class="attr-icon"><i class="fas fa-calendar-alt"></i></div>
                <div class="attr-label">{{ t.publish_date }}</div>
                <div class="attr-value">{{ formatDate(property.posted_at || property.created_at) }}</div>
              </div>
            </div>

            <!-- Contact Us Section (in details card) -->
            <div v-if="hasContact" class="contact-section">
              <div class="contact-header">
                <h3>{{ t.contact_us }}</h3>
                <p>{{ lang === 'zh' ? '联系信息已整理展示，扫码或直接复制即可联系。' : 'Reach out by QR, WeChat, phone, or email.' }}</p>
              </div>
              <div class="contact-info">
                <div class="contact-details">
                  <div v-if="contactInfo.wechat_id" class="contact-item">
                    <span class="contact-item-label">{{ t.wechat }}</span>
                    <span class="contact-item-value" :title="contactInfo.wechat_id">{{ contactInfo.wechat_id }}</span>
                  </div>
                  <div v-if="contactInfo.phone" class="contact-item">
                    <span class="contact-item-label">{{ t.phone }}</span>
                    <span class="contact-item-value" :title="contactInfo.phone">{{ contactInfo.phone }}</span>
                  </div>
                  <div v-if="contactInfo.email" class="contact-item">
                    <span class="contact-item-label">Email</span>
                    <span class="contact-item-value" :title="contactInfo.email">{{ contactInfo.email }}</span>
                  </div>
                </div>
                <div v-if="contactInfo.qrcode_url" class="contact-qrcode">
                  <img :src="contactInfo.qrcode_url" alt="QR Code">
                  <p>{{ t.scan_to_add }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Location Map Section (below both columns) -->
        <div v-if="property.latitude && property.longitude" class="property-map-section">
          <h3><i class="fas fa-map-marker-alt"></i> {{ t.location }}</h3>
          <div class="property-map-shell">
            <div ref="mapContainer" class="property-map"></div>
            <div v-if="mapStatus !== 'ready'" class="map-overlay">
              <i :class="mapStatus === 'loading' ? 'fas fa-spinner fa-spin fa-2x' : 'fas fa-map-location-dot fa-2x'"></i>
              <p>{{ mapMessage }}</p>
            </div>
          </div>
          <div v-if="amapLink" class="map-actions">
            <a :href="amapLink" target="_blank" rel="noopener noreferrer" class="btn-map-open">
              <i class="fas fa-external-link-alt"></i> {{ t.open_in_amap }}
            </a>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="pd-container" style="padding-top: 80px;">
      <div class="empty-state">
        <i class="fas fa-home fa-3x"></i>
        <p>{{ lang === 'zh' ? '房源不存在或已下架' : 'Property not found or delisted' }}</p>
      </div>
    </div>

    <!-- Mobile Bottom Nav - 已登录用户显示与首页一致的菜单 -->
    <nav v-if="isLoggedIn" class="mobile-bottom-nav mobile-bottom-nav--loggedin">
      <a :href="authStore.user?.username ? `/property/${authStore.user.username}` : '/'" class="mnav-item">
        <i class="fas fa-home"></i>
        <span>主页</span>
      </a>
      <a href="/user/wechat-robot/moments-parsed-list" class="mnav-item">
        <i class="fas fa-search"></i>
        <span>找房</span>
      </a>
      <a href="/user/upload-property" class="mnav-item publish-item">
        <div class="publish-btn">
          <i class="fas fa-plus"></i>
        </div>
        <span>发布</span>
      </a>
      <a href="/user/properties" class="mnav-item">
        <i class="fas fa-building"></i>
        <span>我的房源</span>
      </a>
      <a href="/user/dashboard" class="mnav-item">
        <i class="fas fa-user"></i>
        <span>我的</span>
      </a>
    </nav>

    <!-- Image fullscreen dialog -->
    <teleport to="body">
      <div v-if="imageDialogVisible" class="dialog-overlay" @click.self="closeImageDialog">
        <div class="image-dialog">
          <button type="button" class="dialog-close" @click="closeImageDialog">
            <i class="fas fa-times"></i>
          </button>
          <div class="dialog-zoom-controls">
            <button type="button" @click="zoomIn" title="放大"><i class="fas fa-search-plus"></i></button>
            <span class="zoom-level">{{ Math.round(zoomScale * 100) }}%</span>
            <button type="button" @click="zoomOut" title="缩小"><i class="fas fa-search-minus"></i></button>
            <button type="button" @click="resetZoom" title="重置"><i class="fas fa-expand"></i></button>
          </div>
          <template v-if="currentGalleryItem?.type === 'video'">
            <video :key="currentGalleryItem.url" :src="currentGalleryItem.url" controls playsinline class="dialog-image dialog-video"></video>
          </template>
          <template v-else>
            <div
              class="dialog-image-wrapper"
              ref="dialogImageWrapper"
              @wheel.prevent="handleWheel"
              @dblclick="resetZoom"
              @mousedown="startDrag"
              @touchstart.passive="handleTouchStart"
              @touchmove.prevent="handleTouchMove"
              @touchend="handleTouchEnd"
            >
              <img
                :src="currentImage"
                :alt="property?.title || 'Property Image'"
                class="dialog-image zoomable-image"
                :style="zoomStyle"
                draggable="false"
              >
            </div>
          </template>
          <div v-if="galleryItems.length > 1" class="dialog-nav-arrows">
            <button type="button" class="dialog-arrow dialog-arrow-prev" @click="changeImage(-1)"><i class="fas fa-chevron-left"></i></button>
            <button type="button" class="dialog-arrow dialog-arrow-next" @click="changeImage(1)"><i class="fas fa-chevron-right"></i></button>
          </div>
          <div v-if="galleryItems.length > 1" class="dialog-thumbnails">
            <button
              v-for="(item, index) in galleryItems"
              :key="`dialog-${item.url}-${index}`"
              type="button"
              class="dialog-thumb"
              :class="{ active: index === currentImageIndex, 'dialog-thumb-video': item.type === 'video' }"
              @click="setMainImage(index); resetZoom()"
            >
              <template v-if="item.type === 'video'">
                <video :src="item.url" preload="metadata" muted class="thumb-video-dialog"></video>
                <div class="thumb-play-icon"><i class="fas fa-play"></i></div>
              </template>
              <template v-else>
                <img :src="item.url" :alt="`dialog-${index + 1}`">
              </template>
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'
import { useAuthStore } from '@/store/auth'

let amapScriptPromise = null

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const submitting = ref(false)
const activeTab = ref('description')
const currentImageIndex = ref(0)
const imageDialogVisible = ref(false)
const shareDialogVisible = ref(false)
const dialogImageWrapper = ref(null)
const zoomScale = ref(1)
const zoomTranslateX = ref(0)
const zoomTranslateY = ref(0)
let isDragging = false
let dragStartX = 0
let dragStartY = 0
let lastTouchDist = 0
let lastTouchCenterX = 0
let lastTouchCenterY = 0
const mapContainer = ref(null)
const mapInstance = ref(null)
const mapStatus = ref('idle')
const mapMessage = ref('Map loading...')
const showContactPopup = ref(false)
const showQrPopup = ref(false)
const pageQrCodeRef = ref(null)
const codeCopied = ref(false)

const lang = ref(route.query.lang || 'en')
const detail = ref({
  property: null,
  agent: null,
  similar_properties: [],
  agent_properties: [],
  current_user: null,
  has_contacted_agent: false,
  map_config: null,
  owner_settings: {},
})

const texts = {
  en: {
    home: 'Home', list_view: 'List', switch_lang: '中文',
    property_info: 'Property Information', property_id: 'Property ID',
    photos: 'Photos', price: 'Price', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms',
    area: 'Area', district: 'District', street: 'Street', floor: 'Floor',
    elevator: 'Elevator', metro_lines: 'Metro Lines', metro_stations: 'Metro Stations',
    publish_date: 'Publish Date', rooms: 'rooms', yes: 'Yes', no: 'No',
    contact_us: 'Contact Us', phone: 'Phone', wechat: 'WeChat',
    scan_to_add: 'Scan to add', scan_mobile: 'Scan for mobile view',
    location: 'Location', open_in_amap: 'Open in AMap',
    no_photos: 'No photos available',
  },
  zh: {
    home: '首页', list_view: '列表', switch_lang: 'English',
    property_info: '房源信息', property_id: '房源编号',
    photos: '张图片', price: '价格', bedrooms: '卧室', bathrooms: '卫生间',
    area: '面积', district: '区域', street: '街道', floor: '楼层',
    elevator: '电梯', metro_lines: '地铁线路', metro_stations: '地铁站点',
    publish_date: '发布日期', rooms: '室', yes: '有', no: '无',
    contact_us: '联系我们', phone: '电话', wechat: '微信',
    scan_to_add: '扫码添加微信', scan_mobile: '扫码手机查看',
    location: '房源位置', open_in_amap: '在高德地图中打开',
    no_photos: '暂无图片',
  },
}

const t = computed(() => texts[lang.value] || texts.en)

const form = reactive({
  name: '',
  phone: '',
  wechat_id: '',
  message: '',
})

const METRO_LINE_COLORS = {
  '1号线': '#E4002B', '2号线': '#97D700', '3号线': '#FFD100', '4号线': '#5F259F',
  '5号线': '#A05EB5', '6号线': '#D9027D', '7号线': '#F3560F', '8号线': '#009BDA',
  '9号线': '#71C5E8', '10号线': '#C7A1DB', '11号线': '#8D2323', '12号线': '#007B5F',
  '13号线': '#E8AEC4', '14号线': '#82C0C0', '15号线': '#B89268', '16号线': '#00B9E4',
  '17号线': '#BE82C0', '18号线': '#CA8A31',
  'Line 1': '#E4002B', 'Line 2': '#97D700', 'Line 3': '#FFD100', 'Line 4': '#5F259F',
  'Line 5': '#A05EB5', 'Line 6': '#D9027D', 'Line 7': '#F3560F', 'Line 8': '#009BDA',
  'Line 9': '#71C5E8', 'Line 10': '#C7A1DB', 'Line 11': '#8D2323', 'Line 12': '#007B5F',
  'Line 13': '#E8AEC4', 'Line 14': '#82C0C0', 'Line 15': '#B89268', 'Line 16': '#00B9E4',
  'Line 17': '#BE82C0', 'Line 18': '#CA8A31',
}

const i18nMaps = computed(() => detail.value.i18n_maps || { districts: {}, metro_lines: {}, metro_stations: {} })

function i18nTranslate(raw, map, currentLang) {
  if (!raw) return ''
  if (currentLang === 'zh') return raw
  return String(raw).split(',').map(s => s.trim()).filter(Boolean)
    .map(part => map[part] || part)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ')
}

function getDisplayDistrict(district) {
  return i18nTranslate(district, i18nMaps.value.districts, lang.value)
}
function getDisplayMetroLine(lineName) {
  return i18nTranslate(lineName, i18nMaps.value.metro_lines, lang.value)
}
function getDisplayMetroStation(stationName) {
  return i18nTranslate(stationName, i18nMaps.value.metro_stations, lang.value)
}

function getDisplayMetroLines(lineName) {
  if (!lineName) return []
  const parts = String(lineName).split(',').map(s => s.trim()).filter(Boolean)
  return parts.map(cn => {
    const en = i18nMaps.value.metro_lines[cn] || cn
    const displayName = lang.value === 'zh' ? cn : en
    const color = METRO_LINE_COLORS[cn] || METRO_LINE_COLORS[en] || '#666'
    return { name: displayName, color }
  })
}

const property = computed(() => detail.value.property)
const agent = computed(() => detail.value.agent)
const similarProperties = computed(() => detail.value.similar_properties || [])
const hasContactedAgent = computed(() => Boolean(detail.value.has_contacted_agent))
const isLoggedIn = computed(() => authStore.isLoggedIn)
const currentUser = computed(() => detail.value.current_user || null)
const ownerSettings = computed(() => detail.value.owner_settings || {})
const routeUsername = computed(() => route.params.username || '')
const ownerUsername = computed(() => routeUsername.value || agent.value?.username || '')

const contactInfo = computed(() => {
  const s = ownerSettings.value?.contact || {}
  if (s.wechat_id || s.phone || s.qrcode_url) return s
  if (agent.value) {
    return {
      wechat_id: agent.value.wechat_id || '',
      phone: agent.value.phone || '',
      email: agent.value.email || '',
      qrcode_url: '',
    }
  }
  return {}
})
const hasContact = computed(() => !!(contactInfo.value.phone || contactInfo.value.wechat_id || contactInfo.value.qrcode_url))

const langSwitchUrl = computed(() => {
  const switchLang = lang.value === 'en' ? 'zh' : 'en'
  if (routeUsername.value) {
    return `/property/${routeUsername.value}/${route.params.id}?lang=${switchLang}`
  }
  return `${window.location.pathname}?lang=${switchLang}`
})

const pageQrCodeUrl = computed(() => {
  const url = typeof window !== 'undefined' ? window.location.href : ''
  return url ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}` : ''
})

const images = computed(() => {
  if (!property.value) return []
  const raw = Array.isArray(property.value.images) ? property.value.images : []
  return raw.map(url => {
    if (typeof url === 'object') url = url?.thumb || url?.url || ''
    if (!url) return ''
    if (url.startsWith('/api/proxy/image')) return url
    if (url.includes('rains3.com') || url.includes('qpic.cn') || url.includes('wx.qlogo.cn') || url.includes('wechat') || url.includes('mmbiz.qpic.cn') || url.includes('szangels') || url.includes('imgcache.qq.com') || url.includes('hkimg.qq.com') || url.includes('wtimg.qq.com') || url.includes('smartgaga')) {
      return `/api/proxy/image?url=${encodeURIComponent(url)}`
    }
    return url
  }).filter(Boolean)
})

const videos = computed(() => {
  if (!property.value) return []
  const raw = Array.isArray(property.value.videos) ? property.value.videos : []
  return raw.map(url => {
    if (typeof url === 'object') url = url?.url || url?.file_url || ''
    if (url && url.includes('rains3.com')) {
      return `/api/proxy/image?url=${encodeURIComponent(url)}`
    }
    return url
  }).filter(Boolean)
})

const galleryItems = computed(() => {
  const items = images.value.map(url => ({ type: 'image', url }))
  videos.value.forEach(url => items.push({ type: 'video', url }))
  return items
})

const currentGalleryItem = computed(() => {
  if (!galleryItems.value.length) return null
  return galleryItems.value[currentImageIndex.value] || galleryItems.value[0]
})

const currentImage = computed(() => {
  if (!galleryItems.value.length) return ''
  const item = galleryItems.value[currentImageIndex.value]
  return item ? item.url : ''
})

const cardTitle = computed(() => {
  if (!property.value) return ''
  const p = property.value
  const parts = []
  if (p.district) parts.push(getDisplayDistrict(p.district))
  if (p.bedrooms) parts.push(p.bedrooms + 'BR')
  const effectivePrice = p.display_price || p.custom_price || p.price_value
  if (effectivePrice && !isNaN(effectivePrice)) {
    parts.push('¥' + Number(effectivePrice).toLocaleString())
  } else if (p.price) {
    const num = String(p.price).replace(/[^0-9.]/g, '')
    if (num && !isNaN(num)) parts.push('¥' + Number(num).toLocaleString())
    else parts.push(p.price)
  }
  if (p.subway_line_name) parts.push(getDisplayMetroLine(p.subway_line_name))
  if (p.subway_station_name) parts.push(getDisplayMetroStation(p.subway_station_name))
  return parts.length > 0 ? parts.join(' · ') : (p.community || p.title || 'Property')
})

const locationText = computed(() => {
  if (!property.value) return ''
  const district = getDisplayDistrict(property.value.district)
  return [property.value.address, district].filter(Boolean).join(', ')
})

const metroText = computed(() => {
  if (!property.value) return ''
  const line = getDisplayMetroLine(property.value.subway_line_name)
  const station = getDisplayMetroStation(property.value.subway_station_name)
  return [line, station].filter(Boolean).join(' - ')
})

const featureList = computed(() => {
  const list = property.value?.feature_list
  return Array.isArray(list) ? list : []
})

const metroLineColor = computed(() => {
  const lineName = property.value?.subway_line_name
  if (!lineName) return '#666666'
  const firstLine = String(lineName).split(',')[0].trim()
  return METRO_LINE_COLORS[firstLine] || property.value?.metro_line_color || '#666666'
})

const AMENITY_CONFIG = {
  air_conditioning: { icon: 'fas fa-snowflake', label: 'Air Conditioning' },
  washing_machine: { icon: 'fas fa-tshirt', label: 'Washing Machine' },
  refrigerator: { icon: 'fas fa-temperature-low', label: 'Refrigerator' },
  tv: { icon: 'fas fa-tv', label: 'TV' },
  wifi: { icon: 'fas fa-wifi', label: 'WiFi' },
  heating: { icon: 'fas fa-fire', label: 'Heating' },
  kitchen: { icon: 'fas fa-utensils', label: 'Kitchen' },
  water_heater: { icon: 'fas fa-hot-tub', label: 'Water Heater' },
  microwave: { icon: 'fas fa-blender', label: 'Microwave' },
  parking: { icon: 'fas fa-parking', label: 'Parking' },
  elevator: { icon: 'fas fa-elevator', label: 'Elevator' },
  balcony: { icon: 'fas fa-door-open', label: 'Balcony' },
  garden: { icon: 'fas fa-leaf', label: 'Garden' },
  security: { icon: 'fas fa-shield-alt', label: 'Security' },
  pet_friendly: { icon: 'fas fa-paw', label: 'Pet Friendly' },
  furnished: { icon: 'fas fa-couch', label: 'Furnished' },
  gym: { icon: 'fas fa-dumbbell', label: 'Gym' },
  pool: { icon: 'fas fa-swimming-pool', label: 'Pool' },
}

const amenitiesList = computed(() => {
  if (!property.value) return []
  const items = []

  if (property.value.community) {
    items.push({ icon: 'fas fa-building text-primary', label: property.value.community })
  }
  if (property.value.district) {
    items.push({ icon: 'fas fa-location-dot text-primary', label: property.value.district })
  }
  if (property.value.subway_line_name || property.value.subway_station_name) {
    items.push({
      icon: 'fas fa-subway',
      label: metroText.value,
      iconStyle: { color: metroLineColor.value },
    })
  }
  if (property.value.contact_phone_list?.length) {
    items.push({ icon: 'fas fa-phone text-primary', label: property.value.contact_phone_list.join(' / ') })
  }
  if (property.value.floor_info) {
    items.push({ icon: 'fas fa-layer-group text-primary', label: property.value.floor_info })
  }
  if (property.value.posted_at) {
    items.push({ icon: 'fas fa-calendar-alt text-primary', label: formatDate(property.value.posted_at) })
  }

  let amenArr = property.value.amenities_list || property.value.amenities || []
  if (typeof amenArr === 'string') {
    try { amenArr = JSON.parse(amenArr) } catch { amenArr = [] }
  }
  if (Array.isArray(amenArr)) {
    amenArr.forEach(a => {
      const key = typeof a === 'string' ? a : a?.key || a?.name || ''
      const cfg = AMENITY_CONFIG[key]
      if (cfg) items.push({ icon: cfg.icon + ' text-primary', label: cfg.label })
    })
  }

  return items
})

const mapConfig = computed(() => detail.value.map_config || {
  enabled: false,
  js_api_key: '',
  security_js_key: '',
  default_center_lng: 121.4737021,
  default_center_lat: 31.2304324,
  default_zoom: 12,
})

const hasOriginalContent = computed(() => {
  if (!property.value?.original_content) return false
  return property.value.original_content !== property.value.description
})

const nameReadonly = computed(() => Boolean(currentUser.value?.name))
const phoneReadonly = computed(() => Boolean(currentUser.value?.phone))
const showPhoneVerifyHint = computed(() => isLoggedIn.value && !currentUser.value?.phone)

const displaySpecs = computed(() => {
  if (!property.value) return []

  const specs = [
    {
      icon: 'fas fa-bed',
      label: `${property.value.bedrooms || 0} BR`,
    },
    {
      icon: 'fas fa-bath',
      label: `${property.value.bathrooms || 0} BA`,
    },
  ]

  if (property.value.area_sqm) {
    specs.push({
      icon: 'fas fa-expand-arrows-alt',
      label: formatArea(property.value.area_sqm),
    })
  }

  if (property.value.floor_info) {
    specs.push({
      icon: 'fas fa-layer-group',
      label: property.value.floor_info,
    })
  }

  if (metroText.value) {
    specs.push({
      icon: 'fas fa-subway',
      label: metroText.value,
      iconStyle: { color: metroLineColor.value },
    })
  }

  if (property.value.posted_at) {
    specs.push({
      icon: 'fas fa-calendar-alt',
      label: formatDate(property.value.posted_at),
    })
  }

  return specs
})

const amapLink = computed(() => {
  if (!property.value?.latitude || !property.value?.longitude) return ''

  const title = encodeURIComponent(property.value.title || 'Property')
  return `https://uri.amap.com/marker?position=${property.value.longitude},${property.value.latitude}&name=${title}&coordinate=gaode&callnative=1`
})

const messageLink = computed(() => {
  if (!property.value?.user_id) return '/user/messages'
  return `/user/messages?agent_id=${property.value.user_id}`
})

function getFirstShareImage() {
  if (!images.value.length) return ''
  let url = images.value[0]
  if (typeof url === 'object') url = url.thumb || url.url
  if (!url) return ''
  if (url.startsWith('/')) url = location.origin + url
  return url
}

function setMeta(attr, value, content) {
  let el = document.querySelector(`meta[${attr}="${value}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, value)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function updateOgMeta() {
  if (!property.value) return
  const title = cardTitle.value || 'ExpatHome'
  const p = property.value
  const descParts = []
  if (p.community) descParts.push(p.community)
  if (p.district) descParts.push(getDisplayDistrict(p.district))
  if (p.bedrooms) descParts.push(p.bedrooms + ' Bedroom')
  if (p.custom_price || p.price_value) descParts.push('¥' + Number(p.custom_price || p.price_value).toLocaleString() + '/mo')
  if (p.area_sqm) descParts.push(p.area_sqm + '㎡')
  if (p.subway_station_name) descParts.push(getDisplayMetroStation(p.subway_station_name))
  const desc = descParts.length > 0 ? descParts.join(' | ') : 'Find your perfect home - ExpatHome'
  const img = getFirstShareImage()
  const url = window.location.href

  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', desc)
  setMeta('property', 'og:url', url)
  setMeta('property', 'og:type', 'article')
  if (img) setMeta('property', 'og:image', img)
  setMeta('name', 'description', desc)
}

watch(
  () => route.params.id,
  () => {
    fetchDetail()
  }
)

onMounted(() => {
  if (route.query.lang) lang.value = route.query.lang
  fetchDetail()
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  destroyMap()
})

function generatePageQrCode() {
  if (!pageQrCodeRef.value) return
  const url = encodeURIComponent(window.location.href)
  pageQrCodeRef.value.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${url}" alt="QR Code" style="width:120px;height:120px;border-radius:8px;" />`
}

async function fetchDetail() {
  loading.value = true
  activeTab.value = 'description'
  currentImageIndex.value = 0
  resetMapState()

  try {
    const apiUrl = route.params.username
      ? `/property/${route.params.username}/${route.params.id}`
      : `/properties/${route.params.id}`
    const res = await api.get(apiUrl)
    detail.value = res.data || {
      property: null,
      agent: null,
      similar_properties: [],
      agent_properties: [],
      current_user: null,
      has_contacted_agent: false,
      map_config: null,
    }

    applyFormDefaults()
    checkFavoriteStatus()

    nextTick(() => {
      document.title = cardTitle.value ? `${cardTitle.value} - ExpatHome` : 'ExpatHome'
      updateOgMeta()
    })
  } catch (err) {
    detail.value = {
      property: null,
      agent: null,
      similar_properties: [],
      agent_properties: [],
      current_user: null,
      has_contacted_agent: false,
      map_config: null,
    }
  } finally {
    loading.value = false
    window.scrollTo({ top: 0, behavior: 'smooth' })

    await nextTick()
    generatePageQrCode()
    if (detail.value.property?.latitude && detail.value.property?.longitude) {
      setTimeout(() => initLocationMap(), 200)
    }
  }
}

function applyFormDefaults() {
  const currentUser = detail.value.current_user
  if (currentUser) {
    form.name = currentUser.name || ''
    form.phone = currentUser.phone || ''
    form.wechat_id = currentUser.wechat_id || ''
    return
  }

  const storedUser = authStore.user || null
  if (!storedUser) return

  form.name = storedUser.display_name || storedUser.username || ''
  form.phone = storedUser.phone || ''
  form.wechat_id = storedUser.wechat_id || ''
}

function handleKeydown(event) {
  const tagName = document.activeElement?.tagName || ''
  if (tagName === 'INPUT' || tagName === 'TEXTAREA') return
  if (galleryItems.value.length <= 1) return

  if (event.key === 'ArrowLeft') {
    changeImage(-1)
  } else if (event.key === 'ArrowRight') {
    changeImage(1)
  }
}

function setMainImage(index) {
  currentImageIndex.value = index
}

function changeImage(direction) {
  const total = galleryItems.value.length
  if (!total) return

  const nextIndex = currentImageIndex.value + direction
  if (nextIndex >= total) {
    currentImageIndex.value = 0
    return
  }

  if (nextIndex < 0) {
    currentImageIndex.value = total - 1
    return
  }

  currentImageIndex.value = nextIndex
}

const zoomStyle = computed(() => ({
  transform: `translate(${zoomTranslateX.value}px, ${zoomTranslateY.value}px) scale(${zoomScale.value})`,
  cursor: zoomScale.value > 1 ? 'grab' : 'zoom-in',
  transition: isDragging ? 'none' : 'transform 0.2s ease',
}))

function closeImageDialog() {
  imageDialogVisible.value = false
  resetZoom()
}

function resetZoom() {
  zoomScale.value = 1
  zoomTranslateX.value = 0
  zoomTranslateY.value = 0
}

function zoomIn() {
  zoomScale.value = Math.min(zoomScale.value * 1.3, 5)
}

function zoomOut() {
  zoomScale.value = Math.max(zoomScale.value / 1.3, 0.5)
  if (zoomScale.value <= 1) {
    zoomTranslateX.value = 0
    zoomTranslateY.value = 0
  }
}

function handleWheel(e) {
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  const newScale = Math.max(0.5, Math.min(5, zoomScale.value + delta * zoomScale.value))
  zoomScale.value = newScale
  if (newScale <= 1) {
    zoomTranslateX.value = 0
    zoomTranslateY.value = 0
  }
}

function startDrag(e) {
  if (zoomScale.value <= 1) return
  isDragging = true
  dragStartX = e.clientX - zoomTranslateX.value
  dragStartY = e.clientY - zoomTranslateY.value
  const onMove = (ev) => {
    if (!isDragging) return
    zoomTranslateX.value = ev.clientX - dragStartX
    zoomTranslateY.value = ev.clientY - dragStartY
  }
  const onUp = () => {
    isDragging = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function getTouchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function handleTouchStart(e) {
  if (e.touches.length === 2) {
    lastTouchDist = getTouchDist(e.touches)
    lastTouchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2
    lastTouchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2
  } else if (e.touches.length === 1 && zoomScale.value > 1) {
    isDragging = true
    dragStartX = e.touches[0].clientX - zoomTranslateX.value
    dragStartY = e.touches[0].clientY - zoomTranslateY.value
  }
}

function handleTouchMove(e) {
  if (e.touches.length === 2) {
    const dist = getTouchDist(e.touches)
    if (lastTouchDist > 0) {
      const ratio = dist / lastTouchDist
      zoomScale.value = Math.max(0.5, Math.min(5, zoomScale.value * ratio))
    }
    lastTouchDist = dist
  } else if (e.touches.length === 1 && isDragging && zoomScale.value > 1) {
    zoomTranslateX.value = e.touches[0].clientX - dragStartX
    zoomTranslateY.value = e.touches[0].clientY - dragStartY
  }
}

function handleTouchEnd() {
  isDragging = false
  lastTouchDist = 0
  if (zoomScale.value <= 1) {
    zoomTranslateX.value = 0
    zoomTranslateY.value = 0
  }
}

function formatPrice(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return '--'
  return Math.round(numericValue).toLocaleString('en-US')
}

function formatArea(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return ''
  return `${numericValue % 1 === 0 ? numericValue.toFixed(0) : numericValue.toFixed(1)}㎡`
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 10)
}

function formatDescription(value) {
  if (!value) return ''
  return escapeHtml(value).replace(/\n/g, '<br>')
}

function getCoverImage(item) {
  const imageList = item?.images || item?.media_urls || []
  return Array.isArray(imageList) && imageList.length ? imageList[0] : ''
}

function resetMapState() {
  mapStatus.value = 'idle'
  mapMessage.value = 'Map loading...'
  destroyMap()
}

function destroyMap() {
  if (mapInstance.value && typeof mapInstance.value.destroy === 'function') {
    mapInstance.value.destroy()
  }
  mapInstance.value = null
}

async function initLocationMap() {
  if (!property.value) return

  if (!mapConfig.value.enabled || !mapConfig.value.js_api_key) {
    mapStatus.value = 'disabled'
    mapMessage.value = 'AMap is not configured for this site yet.'
    return
  }

  mapStatus.value = 'loading'
  mapMessage.value = 'Map loading...'

  try {
    await loadAmapScript()

    await nextTick()
    await new Promise(r => setTimeout(r, 300))

    if (!mapContainer.value) {
      await nextTick()
      await new Promise(r => setTimeout(r, 500))
    }

    if (!mapContainer.value) {
      mapStatus.value = 'error'
      mapMessage.value = 'Map container unavailable.'
      return
    }

    const { latitude, longitude, address, district } = property.value
    const AMap = window.AMap

    if (!AMap) {
      throw new Error('AMap SDK unavailable')
    }

    const defaultCenter = [
      Number(mapConfig.value.default_center_lng) || 121.4737021,
      Number(mapConfig.value.default_center_lat) || 31.2304324,
    ]

    mapInstance.value = new AMap.Map(mapContainer.value, {
      zoom: Number(mapConfig.value.default_zoom) || 15,
      center: defaultCenter,
      resizeEnable: true,
      touchZoom: true,
      dragEnable: true,
      zoomEnable: true,
    })

    mapInstance.value.on('complete', () => {
      try { mapInstance.value.resize() } catch {}
    })

    setTimeout(() => {
      try { mapInstance.value && mapInstance.value.resize() } catch {}
    }, 800)

    const lat = Number(latitude)
    const lng = Number(longitude)

    if (Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) {
      mapInstance.value.setZoom(16)
      mapInstance.value.setCenter([lng, lat])
      renderMapMarker([lng, lat], false)
      mapStatus.value = 'ready'
      return
    }

    if (address) {
      const geocoder = new AMap.Geocoder()
      const searchAddress = [address, district].filter(Boolean).join(' ')

      geocoder.getLocation(searchAddress, (status, result) => {
        if (status === 'complete' && result?.geocodes?.length) {
          const location = result.geocodes[0].location
          mapInstance.value.setZoom(15)
          mapInstance.value.setCenter(location)
          renderMapMarker(location, false)
          mapStatus.value = 'ready'
          return
        }

        mapInstance.value.setCenter(defaultCenter)
        renderMapMarker(defaultCenter, true)
        mapStatus.value = 'ready'
        mapMessage.value = 'Showing approximate district location.'
      })
      return
    }

    mapStatus.value = 'error'
    mapMessage.value = 'No location information available for this property.'
  } catch (err) {
    mapStatus.value = 'error'
    mapMessage.value = 'Map service is temporarily unavailable.'
  }
}

function renderMapMarker(position, isApproximate) {
  const AMap = window.AMap
  if (!AMap || !mapInstance.value || !property.value) return

  const marker = new AMap.Marker({
    position,
    title: property.value.title || 'Property',
  })

  mapInstance.value.add(marker)

  const infoWindow = new AMap.InfoWindow({
    content: buildMapInfoWindow(isApproximate),
  })

  marker.on('click', () => {
    infoWindow.open(mapInstance.value, position)
  })

  setTimeout(() => {
    infoWindow.open(mapInstance.value, position)
  }, 300)
}

function buildMapInfoWindow(isApproximate) {
  const title = escapeHtml(property.value?.title || 'Property')
  const address = escapeHtml(property.value?.address || property.value?.community || '')
  const price = formatPrice(property.value?.custom_price || property.value?.price_value)

  return `
    <div class="map-info-window">
      <h6>${title}</h6>
      <p><i class="fas fa-map-marker-alt me-1"></i>${address}</p>
      <p class="text-primary">¥${price}/month</p>
      ${isApproximate ? '<p class="map-approximate">Showing approximate location.</p>' : ''}
    </div>
  `
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function loadAmapScript() {
  if (window.AMap) return window.AMap
  if (amapScriptPromise) return amapScriptPromise

  amapScriptPromise = new Promise((resolve, reject) => {
    if (mapConfig.value.security_js_key) {
      window._AMapSecurityConfig = {
        securityJsCode: mapConfig.value.security_js_key,
      }
    }

    const existingScript = document.getElementById('amap-sdk-script')
    if (existingScript) {
      if (window.AMap) {
        resolve(window.AMap)
        return
      }
      existingScript.addEventListener('load', () => resolve(window.AMap), { once: true })
      existingScript.addEventListener('error', reject, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = 'amap-sdk-script'
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(mapConfig.value.js_api_key)}&plugin=AMap.Geocoder,AMap.InfoWindow`
    script.async = true
    script.onload = () => resolve(window.AMap)
    script.onerror = reject
    document.head.appendChild(script)
  })

  return amapScriptPromise
}

async function submitInquiry() {
  if (!property.value) return

  if (!isLoggedIn.value) {
    try {
      await ElMessageBox.confirm(
        '请先登录后再联系经纪人，是否现在去登录？',
        '需要登录',
        {
          confirmButtonText: '去登录',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )
      router.push({
        path: '/auth/login',
        query: { redirect: route.fullPath },
      })
    } catch (err) {
      // User cancelled.
    }
    return
  }

  if (!form.name || !form.phone || !form.wechat_id) {
    ElMessage.warning('请填写姓名、手机号和微信号')
    return
  }

  submitting.value = true

  try {
    await api.post('/submit-property-inquiry', {
      property_id: property.value.id,
      name: form.name,
      phone: form.phone,
      wechat_id: form.wechat_id,
      message: form.message,
    })

    detail.value = {
      ...detail.value,
      has_contacted_agent: true,
    }

    ElMessage.success('咨询提交成功，经纪人会尽快联系你')
  } catch (err) {
    // Request errors are already surfaced by the API interceptor.
  } finally {
    submitting.value = false
  }
}

const isFavorited = ref(false)
const favoriteLoading = ref(false)

async function checkFavoriteStatus() {
  if (!isLoggedIn.value || !property.value?.id) return
  try {
    const res = await api.get('/user/favorites/check', { params: { property_id: property.value.id } })
    const data = res.data?.data || res.data || {}
    isFavorited.value = !!data.is_favorited
  } catch { /* ignore */ }
}

function copyPropertyCode() {
  const code = property.value?.property_code
  if (!code) return
  const done = () => {
    codeCopied.value = true
    ElMessage.success(lang.value === 'en' ? 'Property ID copied' : '房源编号已复制')
    setTimeout(() => { codeCopied.value = false }, 2000)
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(done).catch(() => {
      fallbackCopy(code, done)
    })
  } else {
    fallbackCopy(code, done)
  }
}

function fallbackCopy(text, onDone) {
  const el = document.createElement('textarea')
  el.value = text
  el.style.position = 'fixed'
  el.style.opacity = '0'
  document.body.appendChild(el)
  el.select()
  try {
    document.execCommand('copy')
    if (onDone) onDone()
  } catch {
    ElMessage.error(lang.value === 'en' ? 'Copy failed' : '复制失败')
  }
  document.body.removeChild(el)
}

async function toggleFavorite() {
  if (!isLoggedIn.value) {
    ElMessage.warning(lang.value === 'en' ? 'Please login first' : '请先登录')
    return
  }
  if (favoriteLoading.value) return
  favoriteLoading.value = true
  try {
    if (isFavorited.value) {
      await api.delete(`/user/favorites/${property.value.id}`)
      isFavorited.value = false
      ElMessage.success(lang.value === 'en' ? 'Removed from favorites' : '已取消收藏')
    } else {
      await api.post('/user/favorites', { property_id: property.value.id })
      isFavorited.value = true
      ElMessage.success(lang.value === 'en' ? 'Added to favorites' : '收藏成功')
    }
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || (lang.value === 'en' ? 'Operation failed' : '操作失败'))
  } finally {
    favoriteLoading.value = false
  }
}

async function openShare() {
  if (!property.value) return

  if (navigator.share && !/MicroMessenger/i.test(navigator.userAgent)) {
    try {
      await navigator.share({
        title: property.value.title,
        text: 'I found a great property, come check it out!',
        url: window.location.href,
      })
      return
    } catch (err) {
      // Fall back to the custom share dialog when native share is cancelled or unavailable.
    }
  }

  shareDialogVisible.value = true
}

async function copyShareLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    ElMessage.success('房源链接已复制')
    shareDialogVisible.value = false
  } catch (err) {
    ElMessage.error('复制失败，请手动复制地址栏链接')
  }
}

function shareTo(platform) {
  if (!property.value) return

  const url = encodeURIComponent(window.location.href)
  const title = encodeURIComponent(property.value.title || 'ExpatHome Property')
  const text = encodeURIComponent(`${property.value.title || 'ExpatHome Property'} - I found a great property!`)

  const shareUrls = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    whatsapp: `https://wa.me/?text=${title}%20${url}`,
  }

  const targetUrl = shareUrls[platform]
  if (targetUrl) {
    window.open(targetUrl, '_blank', 'width=720,height=640')
  }
}
</script>

<style scoped>
.property-detail-page {
  background: #f5f7fa;
  min-height: 100vh;
  width: 100%;
}

/* ========== Top Navbar ========== */
.top-navbar {
  background: white;
  box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  position: sticky; top: 0; z-index: 1000;
}
.nav-container {
  max-width: 1400px; margin: 0 auto; padding: 0 20px;
  display: flex; align-items: center; height: 60px;
}
.navbar-menu { display: flex; align-items: center; gap: 20px; width: 100%; }
.nav-item {
  display: flex; align-items: center; gap: 6px;
  text-decoration: none; color: #475569; font-size: 14px; font-weight: 500;
  padding: 8px 16px; border-radius: 8px; transition: all 0.3s;
}
.nav-item:hover { background: #f1f5f9; color: #1e293b; }
.nav-item i { font-size: 16px; }
.navbar-lang-switch { margin-left: auto; }

/* Flag icons */
.flag-icon {
  width: 22px; height: 16px; border-radius: 3px;
  background-size: cover; background-position: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2); flex-shrink: 0; display: inline-block;
}
.flag-cn {
  background: linear-gradient(to bottom, #de2910 0%, #de2910 100%);
  position: relative;
}
.flag-cn::before {
  content: '★'; position: absolute; color: #ffde00;
  font-size: 10px; top: 0; left: 2px; line-height: 1;
}
.flag-en {
  background: linear-gradient(to bottom,
    #012169 0%, #012169 33%, #fff 33%, #fff 44%,
    #c8102e 44%, #c8102e 56%, #fff 56%, #fff 67%,
    #012169 67%, #012169 100%);
}

/* ========== Right Contact Sidebar ========== */
.contact-sidebar {
  position: fixed; right: 0; top: 50%; transform: translateY(-50%);
  z-index: 999; display: flex; flex-direction: column;
}
.contact-sidebar-btn {
  width: 50px; height: 50px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white; display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 18px;
  border: none; position: relative;
}
.contact-sidebar-btn:first-child { border-radius: 8px 0 0 0; }
.contact-sidebar-btn:last-child { border-radius: 0 0 0 8px; }
.contact-sidebar-btn:only-child { border-radius: 8px 0 0 8px; }
.contact-sidebar-btn:hover { width: 55px; }
.sidebar-popup {
  position: absolute; right: 60px; top: 50%; transform: translateY(-50%);
  background: white; border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  padding: 20px; min-width: 260px;
  opacity: 0; visibility: hidden; transition: all 0.3s;
  text-align: left; color: #333;
}
.sidebar-popup.visible { opacity: 1; visibility: visible; right: 55px; }
.sidebar-popup::after {
  content: ''; position: absolute; right: -8px; top: 50%; transform: translateY(-50%);
  border: 8px solid transparent; border-left-color: white;
}
.sidebar-popup-title {
  font-size: 16px; font-weight: 600; color: #1e293b;
  margin-bottom: 15px; display: flex; align-items: center; gap: 8px;
}
.sidebar-popup-title i { color: #667eea; }
.sidebar-popup-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0; border-bottom: 1px solid #f1f5f9;
  color: #475569; font-size: 14px;
}
.sidebar-popup-item:last-child { border-bottom: none; }
.sidebar-popup-item i {
  width: 32px; height: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 14px;
}
.sidebar-popup-item a { color: #667eea; text-decoration: none; }
.sidebar-popup-qrcode { text-align: center; padding-top: 15px; }
.sidebar-popup-qrcode img { width: 120px; height: 120px; border-radius: 8px; border: 2px solid #e2e8f0; }
.sidebar-popup-qrcode p { font-size: 12px; color: #94a3b8; margin-top: 8px; }

.pd-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  overflow: visible;
  box-sizing: border-box;
}

/* Two-column grid layout - 右栏自适应 */
.property-layout {
  display: grid;
  grid-template-columns: 1fr minmax(320px, 460px);
  gap: 24px;
  align-items: start;
}

/* Title bar */
.property-title-bar {
  background: white;
  border-radius: 12px 12px 0 0;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
}
.title-bar-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.title-bar-code-mobile {
  display: none;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
  color: #475569;
}
.title-bar-code-txt {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  color: #2E7D32;
  word-break: break-all;
}
.copy-id-btn--compact {
  margin-left: 0;
  padding: 4px 10px;
  font-size: 12px;
}
.property-title-bar h2 {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  line-height: 1.4;
  flex: 1;
  flex-wrap: wrap;
  overflow: hidden;
  word-break: break-word;
}
.btn-favorite {
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 14px; border-radius: 20px; font-size: 13px; cursor: pointer;
  border: 1px solid #ddd; background: #fff; color: #666; transition: all 0.25s;
  white-space: nowrap;
}
.btn-favorite:hover { border-color: #e91e63; color: #e91e63; }
.btn-favorite.favorited {
  background: linear-gradient(135deg, #e91e63, #c2185b); color: #fff; border-color: transparent;
}
.btn-favorite.favorited:hover { opacity: 0.9; }
.btn-favorite:disabled { opacity: 0.6; cursor: not-allowed; }

/* Gallery */
.gallery-section {
  background: white;
  border-radius: 0 0 12px 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}
.main-gallery {
  position: relative;
}
.main-image-container {
  position: relative;
  aspect-ratio: 4/3;
  background: #1a1a2e;
}
.main-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}
.image-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  background: rgba(0,0,0,0.5);
  color: white;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  z-index: 10;
}
.image-nav:hover { background: rgba(0,0,0,0.8); }
.prev-btn { left: 16px; }
.next-btn { right: 16px; }
.image-counter {
  position: absolute;
  bottom: 16px;
  right: 16px;
  background: rgba(0,0,0,0.6);
  color: white;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
}

/* Thumbnails */
.thumbnail-strip {
  padding: 12px;
  background: #f8f9fa;
}
.thumbnail-container {
  display: flex;
  gap: 8px;
  overflow-x: auto;
}
.thumbnail-item {
  flex-shrink: 0;
  width: 80px;
  height: 56px;
  border: 3px solid transparent;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
}
.thumbnail-item.active { border-color: #4CAF50; }
.thumbnail-item:hover { border-color: #81C784; }
.thumbnail-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.no-images {
  height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 16px;
}
.no-images i { font-size: 48px; margin-bottom: 12px; }

/* Right: Details section - 去掉sticky避免截断 */
.details-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  box-sizing: border-box;
  word-break: break-word;
}
.section-title {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 16px;
  line-height: 1.4;
}

/* Property code */
.property-code-display {
  background: linear-gradient(135deg, #f5fbf6 0%, #e8f5e9 100%);
  border: 1px solid #c8e6c9;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.property-code-value {
  color: #2E7D32;
  font-weight: 600;
  font-size: 16px;
  font-family: 'Courier New', monospace;
  flex: 1;
  min-width: 0;
  word-break: break-all;
}
.copy-id-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  flex-shrink: 0;
  padding: 6px 12px;
  font-size: 13px;
  border: 1px solid #c8e6c9;
  border-radius: 6px;
  background: #fff;
  color: #2E7D32;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.copy-id-btn:hover {
  background: #e8f5e9;
  border-color: #81c784;
}
.copy-id-btn i { font-size: 12px; }

/* Media count */
.media-count {
  color: #666;
  font-size: 14px;
  margin-bottom: 16px;
}
.media-count i { color: #3b82f6; }

/* Attribute grid with circular icons */
.property-attrs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
.attr-item {
  background: #f8f9fa;
  padding: 10px 6px;
  border-radius: 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}
.attr-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 5px;
}
.attr-icon i {
  color: white;
  font-size: 12px;
}
.attr-label {
  font-size: 11px;
  color: #888;
  margin-bottom: 3px;
}
.attr-value {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  word-break: break-word;
}
.attr-value.price {
  color: #e74c3c;
  font-size: 14px;
}

/* Metro line badges */
.metro-lines {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  justify-content: center;
}
.metro-badge {
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  white-space: nowrap;
}

/* Details content */
.details-content {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}
.details-content h3 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.details-content h3 i { color: #3b82f6; }
.details-text {
  font-size: 14px;
  line-height: 1.8;
  color: #555;
  max-height: 300px;
  overflow-y: auto;
  overflow-x: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
}

/* Contact Us section */
.contact-section {
  margin-top: 24px;
  background: linear-gradient(135deg, #f7fbf8 0%, #dcefdc 100%);
  border: 1px solid rgba(46, 125, 50, 0.12);
  border-radius: 18px;
  padding: 18px;
}
.contact-header {
  margin-bottom: 12px;
}
.contact-section h3 {
  font-size: 24px;
  font-weight: 700;
  color: #2E7D32;
  margin-bottom: 6px;
}
.contact-header p {
  margin: 0;
  color: #5f6b64;
  font-size: 13px;
  line-height: 1.6;
}
.contact-info {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 104px;
  align-items: start;
  gap: 10px;
  width: 100%;
}
.contact-details {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.contact-item {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  align-items: start;
  gap: 6px;
  margin-bottom: 0;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.75);
  border-radius: 12px;
  padding: 8px 10px;
  border: 1px solid rgba(76, 175, 80, 0.12);
}
.contact-item-label {
  color: #5c6d61;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  text-align: left;
  white-space: nowrap;
  line-height: 1.35;
  padding-top: 1px;
}
.contact-item-value {
  min-width: 0;
  color: #1d2a21;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  text-align: left;
}
.contact-qrcode {
  width: 104px;
  min-width: 104px;
  max-width: 104px;
  text-align: center;
  background: rgba(255, 255, 255, 0.82);
  border-radius: 16px;
  padding: 8px 6px;
  border: 1px solid rgba(76, 175, 80, 0.15);
  justify-self: end;
  box-sizing: border-box;
}
.contact-qrcode img {
  width: 76px;
  height: 76px;
  border-radius: 8px;
  border: 2px solid white;
  object-fit: cover;
}
.contact-qrcode p {
  font-size: 10px;
  color: #666;
  margin-top: 4px;
}

@media (max-width: 1280px) and (min-width: 901px) {
  .contact-section {
    padding: 16px;
  }
  .contact-info {
    grid-template-columns: minmax(0, 1fr) 92px;
    gap: 8px;
  }
  .contact-item {
    grid-template-columns: 46px minmax(0, 1fr);
    gap: 5px;
    padding: 8px;
  }
  .contact-item-label {
    font-size: 9px;
    letter-spacing: 0.01em;
  }
  .contact-item-value {
    font-size: 12px;
  }
  .contact-qrcode {
    width: 92px;
    min-width: 92px;
    max-width: 92px;
    padding: 7px 5px;
  }
  .contact-qrcode img {
    width: 66px;
    height: 66px;
  }
  .contact-qrcode p {
    font-size: 9px;
  }
}

/* Location map section (below grid) */
.property-map-section {
  margin-top: 24px;
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}
.property-map-section h3 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.property-map-section h3 i { color: #e74c3c; }
.property-map-shell { position: relative; }
.property-map {
  width: 100%;
  height: 400px;
  border-radius: 12px;
  background: #f8f9fa;
  position: relative;
}
.map-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6c757d;
  background: rgba(248, 249, 250, 0.95);
  border-radius: 12px;
  text-align: center;
  z-index: 1;
}
.map-actions {
  margin-top: 12px;
  text-align: right;
}
.btn-map-open {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #4CAF50;
  color: white;
  border-radius: 8px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.3s;
}
.btn-map-open:hover { background: #388E3C; color: white; }

:deep(.map-info-window) { padding: 12px; min-width: 200px; }
:deep(.map-info-window h6) { margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #333; }
:deep(.map-info-window p) { margin: 4px 0; font-size: 12px; }
:deep(.map-info-window .text-primary) { font-weight: 600; font-size: 13px; color: #FF6B35 !important; }

/* Video in gallery */
.main-video {
  object-fit: contain;
  background: #000;
  cursor: default;
}
.thumbnail-video {
  position: relative;
}
.thumb-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb-video-icon,
.thumb-play-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.35);
  color: #fff;
  font-size: 14px;
  pointer-events: none;
}
.dialog-video {
  max-height: 80vh;
  background: #000;
}
.dialog-thumb-video {
  position: relative;
}
.thumb-video-dialog {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
}
.empty-state i { margin-bottom: 16px; }

/* Image dialog */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.9);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.image-dialog {
  position: relative;
  width: min(1100px, 100%);
  max-height: 92vh;
  overflow: auto;
}
.dialog-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  background: rgba(255,255,255,0.2);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4;
  transition: all 0.3s;
}
.dialog-close:hover { background: rgba(255,255,255,0.4); }
.dialog-image-wrapper {
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.dialog-image {
  width: 100%;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 8px;
}
.zoomable-image {
  transform-origin: center center;
  will-change: transform;
}
.dialog-zoom-controls {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 5;
  background: rgba(0,0,0,0.5);
  border-radius: 20px;
  padding: 4px 12px;
}
.dialog-zoom-controls button {
  width: 32px;
  height: 32px;
  background: rgba(255,255,255,0.15);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: background 0.2s;
}
.dialog-zoom-controls button:hover { background: rgba(255,255,255,0.3); }
.zoom-level {
  color: white;
  font-size: 12px;
  min-width: 40px;
  text-align: center;
}
.dialog-nav-arrows {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  display: flex;
  justify-content: space-between;
  padding: 0 8px;
  pointer-events: none;
  z-index: 3;
}
.dialog-arrow {
  pointer-events: auto;
  width: 40px;
  height: 40px;
  background: rgba(0,0,0,0.4);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: background 0.2s;
}
.dialog-arrow:hover { background: rgba(0,0,0,0.6); }
.dialog-thumbnails {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 12px 0;
  justify-content: center;
}
.dialog-thumb {
  flex-shrink: 0;
  width: 60px;
  height: 44px;
  border: 2px solid transparent;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  background: none;
}
.dialog-thumb.active { border-color: #4CAF50; }
.dialog-thumb img { width: 100%; height: 100%; object-fit: cover; }

/* Tablet / small laptop responsive */
@media (max-width: 1100px) and (min-width: 901px) {
  .pd-container { padding: 16px; }
  .property-layout {
    grid-template-columns: 1fr minmax(280px, 380px);
    gap: 16px;
  }
  .details-section { padding: 16px; }
  .property-attrs { grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .attr-icon { width: 28px; height: 28px; }
  .attr-icon i { font-size: 12px; }
  .attr-label { font-size: 11px; }
  .attr-value { font-size: 12px; }
  .section-title { font-size: 18px; }
}

/* Mobile responsive */
@media (max-width: 900px) {
  .property-detail-page.has-mobile-nav { padding-bottom: 60px; }
  .property-detail-page { padding-bottom: 0; }
  .pd-container { padding: 0; max-width: 100vw; }
  .contact-sidebar { display: none; }
  .nav-container { height: 50px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .navbar-menu { gap: 8px; flex-wrap: nowrap; }
  .nav-item { padding: 6px 12px; font-size: 12px; white-space: nowrap; flex-shrink: 0; }
  .nav-item i { font-size: 14px; }
  .property-layout {
    grid-template-columns: 1fr;
    gap: 0;
    max-width: 100%;
  }
  .gallery-wrapper { border-radius: 0; max-width: 100%; overflow: hidden; }
  .gallery-section { border-radius: 0; }
  .image-dialog {
    width: calc(100vw - 16px);
    max-height: calc(100vh - 20px);
    padding-top: 56px;
    box-sizing: border-box;
  }
  .dialog-zoom-controls {
    top: 8px;
  }
  .dialog-close {
    top: 8px;
    right: 8px;
  }
  .dialog-image-wrapper {
    max-height: calc(80vh - 56px);
  }
  .dialog-image {
    max-height: calc(80vh - 56px);
  }
  .property-title-bar { border-radius: 0; padding: 12px 16px; }
  .property-title-bar h2 { font-size: 16px; }
  .title-bar-code-mobile { display: flex; }
  .main-image-container { aspect-ratio: 16/9; }
  .details-section {
    border-radius: 0;
    margin-top: -12px;
    padding: 20px 16px;
    box-sizing: border-box;
    max-width: 100%;
  }
  .section-title { font-size: 18px; word-break: break-word; }
  .property-code-display { flex-wrap: wrap; overflow: hidden; }
  .property-code-value { word-break: break-all; overflow-wrap: break-word; }
  .property-attrs {
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    max-width: 100%;
  }
  .attr-item { padding: 10px 6px; overflow: hidden; min-width: 0; }
  .attr-icon { width: 28px; height: 28px; margin-bottom: 4px; }
  .attr-icon i { font-size: 11px; }
  .attr-label { font-size: 10px; margin-bottom: 2px; }
  .attr-value { font-size: 11px; word-break: break-word; overflow-wrap: break-word; max-width: 100%; }
  .attr-value.price { font-size: 12px; }
  .metro-badge { font-size: 9px; padding: 1px 4px; }
  .details-text { overflow-x: hidden; max-width: 100%; }
  .contact-section { overflow: hidden; padding: 14px; }
  .contact-section h3 { font-size: 20px; }
  .contact-info {
    grid-template-columns: minmax(0, 1fr) 78px;
    align-items: start;
    gap: 6px;
  }
  .contact-details {
    gap: 5px;
  }
  .contact-item {
    grid-template-columns: 42px minmax(0, 1fr);
    align-items: start;
    gap: 5px;
    padding: 8px 7px;
  }
  .contact-item-label {
    font-size: 10px;
    letter-spacing: 0.02em;
  }
  .contact-item-value {
    font-size: 11px;
    text-align: left;
  }
  .contact-qrcode {
    width: 78px;
    min-width: 78px;
    max-width: 78px;
    margin-top: 0;
    padding: 6px 4px;
  }
  .contact-qrcode img {
    width: 58px;
    height: 58px;
  }
  .contact-qrcode p {
    font-size: 9px;
    line-height: 1.4;
    margin-top: 4px;
  }
  .property-map-section {
    margin-top: 0;
    border-radius: 0;
    padding: 16px;
  }
  .property-map {
    height: 300px;
    border-radius: 8px;
  }
  .property-map-shell {
    overflow: visible;
  }
  .dialog-overlay { padding: 8px; }
  .image-dialog { width: 100%; }
}

@media (max-width: 480px) {
  .property-attrs { grid-template-columns: repeat(4, 1fr); }
}

/* Mobile Bottom Nav */
.mobile-bottom-nav { display: none; }

@media (max-width: 900px) {
  .mobile-bottom-nav { display: flex; position: fixed; bottom: 0; left: 0; right: 0; background: rgba(255,255,255,0.98); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); box-shadow: 0 -2px 12px rgba(0,0,0,0.1); z-index: 1000; padding-bottom: env(safe-area-inset-bottom, 0px); }

  /* 已登录样式 - 与UserProperties一致的5项导航 */
  .mobile-bottom-nav--loggedin {
    display: grid; grid-template-columns: repeat(5, 1fr);
    border-top: 1px solid #e9ecef;
  }
  .mobile-bottom-nav--loggedin .mnav-item {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 8px 0 6px; color: #999; text-decoration: none; font-size: 10px;
    transition: color 0.2s; -webkit-tap-highlight-color: transparent;
  }
  .mobile-bottom-nav--loggedin .mnav-item i { font-size: 18px; margin-bottom: 2px; }
  .mobile-bottom-nav--loggedin .mnav-item:hover,
  .mobile-bottom-nav--loggedin .mnav-item:active { color: #667eea; }
  .mobile-bottom-nav--loggedin .publish-item { padding-top: 0; }
  .mobile-bottom-nav--loggedin .publish-btn {
    width: 44px; height: 44px; border-radius: 50%;
    background: linear-gradient(135deg, #FF6B35, #ff8c5a);
    display: flex; align-items: center; justify-content: center;
    color: white; font-size: 20px; margin-top: -18px;
    border: 3px solid #fff; box-shadow: 0 4px 15px rgba(255,107,53,0.4);
    transition: transform 0.2s;
  }
  .mobile-bottom-nav--loggedin .publish-item:active .publish-btn { transform: scale(0.92); }
  .mobile-bottom-nav--loggedin .publish-item span { color: #FF6B35; margin-top: 2px; }
}

</style>
