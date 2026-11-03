<template>
  <div class="user-properties-standalone" :class="{ 'lang-zh': lang === 'zh' }">
    <!-- 顶部导航栏 -->
    <nav class="top-navbar">
      <div class="nav-container">
        <div class="navbar-menu">
          <router-link :to="`/property/${username}?lang=${lang}`" class="nav-item active">
            <i class="fas fa-home"></i>
            <span>{{ t.home }}</span>
          </router-link>
          <router-link :to="`/property/${username}?lang=${lang}`" class="nav-item active">
            <i class="fas fa-list"></i>
            <span>{{ t.list_view }}</span>
          </router-link>
          <a :href="`/map-search?user=${username}&lang=${lang}`" class="nav-item">
            <i class="fas fa-map-marker-alt"></i>
            <span>{{ t.map_view }}</span>
          </a>
          <a :href="langSwitchUrl" class="nav-item navbar-lang-switch">
            <span class="flag-icon" :class="lang === 'en' ? 'flag-cn' : 'flag-en'"></span>
            <span>{{ t.switch_lang }}</span>
          </a>
        </div>
      </div>
    </nav>

    <!-- PC端右侧浮窗：客服+二维码 -->
    <div class="contact-sidebar">
      <div v-if="hasContact" class="contact-sidebar-btn" @mouseenter="showContactPopup = true" @mouseleave="showContactPopup = false">
        <i class="fas fa-headset"></i>
        <div class="sidebar-popup" :class="{ visible: showContactPopup }">
          <div class="sidebar-popup-title">
            <i class="fas fa-address-card"></i>
            {{ t.contact }} {{ displayName }}
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
            <img v-if="pageQrCodeUrl" :src="pageQrCodeUrl" alt="Page QR Code" style="width:120px;height:120px;">
            <p>{{ lang === 'zh' ? '使用手机相机扫描' : 'Scan with your phone camera' }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索区域 -->
    <section class="search-hero-section">
      <div class="hero-container">
        <div class="hero-title-area">
          <h1><i class="fas fa-home"></i> {{ lang === 'zh' ? '找到您的理想住所' : 'Find Your Perfect Home' }}</h1>
          <p>{{ lang === 'zh' ? '从精选房源中发现优质房产' : 'Discover quality properties from our curated listings' }}</p>
        </div>

        <div class="search-box-container">
          <!-- 移动端横向滚动筛选 -->
          <div class="mobile-filters-scroll">
            <a :href="`/map-search?user=${username}&lang=${lang}`" class="mobile-filter-btn map-btn">
              <i class="fas fa-map-marker-alt"></i>
              <span>{{ lang === 'zh' ? '地图' : 'Map' }}</span>
            </a>
            <div class="custom-dropdown" v-for="dd in mobileDropdowns" :key="dd.name"
                 :data-dropdown="dd.name"
                 :class="{ open: openDropdown === dd.name }">
              <div class="custom-dropdown-btn" :class="{ active: filters[dd.name] }"
                   @click.stop="toggleDropdown(dd.name)">
                {{ getDropdownLabel(dd) }}
              </div>
              <Teleport to="body">
                <div class="custom-dropdown-menu mobile-dropdown-portal"
                     v-show="openDropdown === dd.name"
                     :style="getDropdownMenuStyle(dd.name)"
                     @click.stop>
                  <div class="custom-dropdown-item" :class="{ selected: !filters[dd.name] }"
                       @click.stop="selectFilter(dd.name, '')">{{ dd.placeholder }}</div>
                  <div class="custom-dropdown-item" v-for="opt in dd.options" :key="opt.value"
                       :class="{ selected: filters[dd.name] === opt.value }"
                       @click.stop="selectFilter(dd.name, opt.value)">
                    {{ opt.label }}
                  </div>
                </div>
              </Teleport>
            </div>
            <input type="text" class="mobile-filter-input" v-model="filters.keyword"
                   :placeholder="t.keyword" @keyup.enter="doSearch">
          </div>
          <div class="mobile-filter-actions">
            <button class="btn-search" @click="doSearch">
              <i class="fas fa-search"></i> {{ t.search }}
            </button>
            <a :href="`/property/${username}?lang=${lang}`" class="btn-reset">{{ t.reset }}</a>
          </div>

          <!-- 桌面端筛选 -->
          <div class="desktop-filters">
            <div class="filter-row">
              <div class="filter-item" style="flex: 0 0 auto; width: auto; min-width: auto;">
                <a :href="`/map-search?user=${username}&lang=${lang}`" class="btn-map">
                  <i class="fas fa-map-marker-alt"></i> {{ lang === 'zh' ? '地图' : 'Map' }}
                </a>
              </div>
              <div class="filter-item">
                <select v-model="filters.district">
                  <option value="">{{ t.all_districts }}</option>
                  <option v-for="d in districts" :key="d.value" :value="d.value">
                    {{ lang === 'zh' ? d.value : d.label }}
                  </option>
                </select>
              </div>
              <div class="filter-item">
                <select v-model="filters.price_range">
                  <option value="">{{ t.price_range }}</option>
                  <option v-for="pr in priceRanges" :key="pr.value" :value="pr.value">{{ pr.label }}</option>
                </select>
              </div>
              <div class="filter-item">
                <select v-model="filters.bedrooms">
                  <option value="">{{ t.bedrooms }}</option>
                  <option v-for="n in 5" :key="n" :value="String(n)">{{ n }} {{ lang === 'zh' ? '室' : 'BR' }}</option>
                </select>
              </div>
              <div class="filter-item">
                <select v-model="filters.metro_line" @change="filters.metro_station = ''">
                  <option value="">{{ t.metro_line }}</option>
                  <option v-for="ml in metroLines" :key="ml.value" :value="ml.value">{{ ml.label }}</option>
                </select>
              </div>
              <div class="filter-item">
                <select v-model="filters.metro_station">
                  <option value="">{{ filters.metro_line ? t.metro_station : t.select_line_first }}</option>
                  <template v-if="filters.metro_line">
                    <option v-for="ms in filteredStations" :key="ms.value" :value="ms.value">{{ ms.label }}</option>
                  </template>
                </select>
              </div>
              <div class="filter-item">
                <input type="text" v-model="filters.keyword" :placeholder="t.keyword" @keyup.enter="doSearch">
              </div>
              <div class="filter-buttons">
                <button class="btn-search" @click="doSearch">
                  <i class="fas fa-search"></i> {{ t.search }}
                </button>
                <a :href="`/property/${username}?lang=${lang}`" class="btn-reset">{{ t.reset }}</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 房源列表区域 -->
    <section class="properties-section">
      <div class="props-container">
        <div class="properties-header">
          <h2><i class="fas fa-building"></i> {{ t.available_properties }}</h2>
          <div class="header-right">
            <span class="properties-count">
              <strong>{{ total }}</strong> {{ t.properties_found }}
            </span>
            <a :href="`/map-search?user=${username}&lang=${lang}`" class="btn-map-sm">
              <i class="fas fa-map-marker-alt"></i>
              <span>{{ t.map_view }}</span>
            </a>
            <select v-model="currentSort" @change="changeSort" class="sort-select">
              <option value="publish_time">{{ t.publish_time }}</option>
              <option value="upload_time">{{ t.upload_time }}</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="loading-state">
          <i class="fas fa-spinner fa-spin"></i>
          <p>{{ lang === 'zh' ? '加载中...' : 'Loading...' }}</p>
        </div>

        <div v-else-if="properties.length" class="properties-grid">
          <a v-for="prop in properties" :key="prop.id"
             :href="getPropertyUrl(prop)" class="property-card">
            <div class="property-card-image">
              <img :src="getThumbUrl(prop)" :alt="getPropertyTitle(prop)"
                   @error="onImgError" loading="lazy">
              <span v-if="getPublishTimeAgo(prop)" class="property-date-badge">
                <i class="fas fa-calendar-alt"></i>
                {{ getPublishTimeAgo(prop) }}
              </span>
            </div>
            <div class="property-card-content">
              <h3 class="property-card-title">{{ getPropertyTitle(prop) }}</h3>
              <div class="property-card-info">
                <span v-if="prop.bedrooms">
                  <i class="fas fa-bed"></i>
                  {{ prop.bedrooms }} {{ lang === 'zh' ? '室' : (prop.bedrooms == 1 ? 'Bedroom' : 'Bedrooms') }}
                </span>
              </div>
              <div v-if="prop.district" class="property-card-location">
                <i class="fas fa-map-marker-alt"></i>
                {{ getDistrictDisplay(prop.district) }}
              </div>
              <div v-if="prop.metro_lines || prop.metro_stations" class="property-card-location">
                <i class="fas fa-subway"></i>
                {{ getMetroDisplay(prop) }}
              </div>
            </div>
          </a>
        </div>

        <div v-else class="empty-state">
          <i class="fas fa-home"></i>
          <h3>{{ t.no_properties }}</h3>
          <p>{{ t.try_adjust }}</p>
        </div>

        <!-- 分页 -->
        <div v-if="totalPages > 1" class="pagination-container">
          <nav>
            <ul class="pagination">
              <li class="page-item" :class="{ disabled: currentPage <= 1 }">
                <a class="page-link" href="#" @click.prevent="goToPage(currentPage - 1)">
                  <i class="fas fa-chevron-left"></i>
                </a>
              </li>
              <template v-for="p in paginationPages" :key="p">
                <li v-if="p === '...'" class="page-item disabled">
                  <span class="page-link">...</span>
                </li>
                <li v-else class="page-item" :class="{ active: p === currentPage }">
                  <a class="page-link" href="#" @click.prevent="goToPage(p)">{{ p }}</a>
                </li>
              </template>
              <li class="page-item" :class="{ disabled: currentPage >= totalPages }">
                <a class="page-link" href="#" @click.prevent="goToPage(currentPage + 1)">
                  <i class="fas fa-chevron-right"></i>
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </section>

    <!-- 微信弹窗 -->
    <div v-if="showWechatModal" class="wechat-modal" @click.self="showWechatModal = false">
      <div class="wechat-modal-content">
        <div class="wechat-modal-header">
          <i class="fab fa-weixin" style="color: #07C160; font-size: 28px;"></i>
          <span>{{ lang === 'zh' ? '微信联系' : 'WeChat Contact' }}</span>
          <button class="wechat-modal-close" @click="showWechatModal = false">&times;</button>
        </div>
        <div class="wechat-modal-body">
          <div class="wechat-id-display">
            <label>{{ lang === 'zh' ? '微信号' : 'WeChat ID' }}</label>
            <div class="wechat-id-value">{{ contactInfo.wechat_id }}</div>
          </div>
          <button class="wechat-copy-btn" @click="copyWechatId">
            <i class="fas fa-copy"></i> {{ t.copy_wechat }}
          </button>
          <p class="wechat-modal-tip">
            <i class="fas fa-info-circle"></i> {{ t.copy_tip }}
          </p>
        </div>
      </div>
    </div>

    <!-- 移动端底部导航栏 - 已登录用户（默认中文） -->
    <nav v-if="isLoggedIn" class="mobile-bottom-nav mobile-bottom-nav--loggedin">
      <a :href="`/property/${authStore.user?.username || username}`" class="mnav-item">
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

    <!-- 移动端底部导航栏 - 未登录用户 -->
    <nav v-else class="mobile-bottom-nav mobile-bottom-nav--guest">
      <a v-if="contactInfo.phone" :href="'tel:' + contactInfo.phone">
        <i class="fas fa-phone"></i>
        <span>{{ t.call }}</span>
      </a>
      <a href="javascript:void(0)" @click="onWechatClick">
        <i class="fab fa-weixin"></i>
        <span>{{ t.wechat }}</span>
      </a>
      <a :href="`/property/${username}?lang=${lang}`" class="home-btn">
        <i class="fas fa-home"></i>
        <span>{{ t.home }}</span>
      </a>
    </nav>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api'
import { useAuthStore } from '@/store/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const isLoggedIn = computed(() => !!authStore.token && !!authStore.user)

const username = computed(() => route.params.username || '')
const lang = ref(route.query.lang || 'en')
const loading = ref(true)
const userData = ref(null)
const properties = ref([])
const total = ref(0)
const totalPages = ref(0)
const currentPage = ref(parseInt(route.query.page, 10) || 1)
const currentSort = ref(route.query.sort || 'publish_time')
const districts = ref([])
const metroLines = ref([])
const metroStations = ref([])
const settings = ref({})
const defaultCoverImage = ref('/images/no-image.png')

const showContactPopup = ref(false)
const showQrPopup = ref(false)
const showWechatModal = ref(false)
const openDropdown = ref(null)
const dropdownMenuStyle = ref({})
const pageQrCodeRef = ref(null)
const pageQrCodeUrl = computed(() => {
  const url = typeof window !== 'undefined' ? window.location.href : ''
  return url ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}` : ''
})

const filters = reactive({
  district: route.query.district || '',
  price_range: route.query.price_range || '',
  bedrooms: route.query.bedrooms || '',
  metro_line: route.query.metro_line || '',
  metro_station: route.query.metro_station || '',
  keyword: route.query.keyword || '',
})

const priceRanges = [
  { value: '2000-5000', label: '¥2,000-5,000' },
  { value: '5000-8000', label: '¥5,000-8,000' },
  { value: '8000-10000', label: '¥8,000-10,000' },
  { value: '10000-15000', label: '¥10,000-15,000' },
  { value: '15000-20000', label: '¥15,000-20,000' },
  { value: '20000-25000', label: '¥20,000-25,000' },
  { value: '25000-30000', label: '¥25,000-30,000' },
  { value: '30000+', label: '¥30,000+' },
]

// 多语言文本
const texts = {
  en: {
    home: 'Home', list_view: 'List View', map_view: 'Map View',
    contact: 'Contact', phone: 'Phone', wechat: 'WeChat',
    scan_to_add: 'Scan to add on WeChat', scan_mobile: 'Scan to view on mobile',
    all_districts: 'All Districts', area: 'Area', price: 'Price',
    price_range: 'Price Range', bedrooms: 'Bedrooms',
    metro_line: 'Metro Line', metro_station: 'Metro Station', station: 'Station',
    keyword: 'Keyword', search: 'Search', reset: 'Reset',
    available_properties: 'Available Properties', properties_found: 'properties',
    publish_time: 'Publish Time', upload_time: 'Upload Time',
    no_properties: 'No Properties Found',
    try_adjust: 'Try adjusting your search filters or check back later for new listings.',
    call: 'Call', switch_lang: '中文',
    select_line_first: '-- Select Line First --',
    copy_wechat: 'Copy WeChat ID', copied: 'Copied!',
    copy_tip: 'Copy the ID and search in WeChat to add as friend',
  },
  zh: {
    home: '首页', list_view: '列表视图', map_view: '地图视图',
    contact: '联系方式', phone: '电话', wechat: '微信',
    scan_to_add: '扫码添加微信', scan_mobile: '扫码手机查看',
    all_districts: '全部区域', area: '区域', price: '价格',
    price_range: '价格范围', bedrooms: '卧室',
    metro_line: '地铁线路', metro_station: '地铁站点', station: '站点',
    keyword: '关键词', search: '搜索', reset: '重置',
    available_properties: '可租房源', properties_found: '套',
    publish_time: '发布时间', upload_time: '上传时间',
    no_properties: '暂无房源',
    try_adjust: '请调整筛选条件或稍后再来查看新房源',
    call: '电话', switch_lang: 'English',
    select_line_first: '-- 请先选择线路 --',
    copy_wechat: '复制微信号', copied: '已复制!',
    copy_tip: '复制微信号后在微信中搜索添加好友',
  },
}
const t = computed(() => texts[lang.value] || texts.en)

const displayName = computed(() => userData.value?.display_name || userData.value?.username || '')
const contactInfo = computed(() => settings.value?.contact || {})
const hasContact = computed(() => !!(contactInfo.value.phone || contactInfo.value.wechat_id || contactInfo.value.qrcode_url))

const filteredStations = computed(() => {
  if (!filters.metro_line) return []
  return metroStations.value.filter(s =>
    s.line_value === filters.metro_line || (s.line_name && s.line_name === filters.metro_line)
  )
})

const langSwitchUrl = computed(() => {
  const switchLang = lang.value === 'en' ? 'zh' : 'en'
  const params = new URLSearchParams(route.query)
  params.set('lang', switchLang)
  return `/property/${username.value}?${params.toString()}`
})

const mobileDropdowns = computed(() => [
  {
    name: 'district',
    placeholder: t.value.area,
    options: districts.value.map(d => ({
      value: d.value,
      label: lang.value === 'zh' ? d.value : d.label
    }))
  },
  {
    name: 'price_range',
    placeholder: t.value.price,
    options: priceRanges
  },
  {
    name: 'bedrooms',
    placeholder: t.value.bedrooms,
    options: [1,2,3,4,5].map(n => ({
      value: String(n),
      label: `${n} ${n === 1 ? (lang.value === 'zh' ? '室' : 'Bed') : (lang.value === 'zh' ? '室' : 'Beds')}`
    }))
  },
  {
    name: 'metro_line',
    placeholder: lang.value === 'zh' ? '地铁' : 'Metro',
    options: metroLines.value
  },
])

const paginationPages = computed(() => {
  const pages = []
  const cp = currentPage.value
  const tp = totalPages.value
  const start = Math.max(1, cp - 2)
  const end = Math.min(tp, cp + 2)
  if (start > 1) { pages.push(1); if (start > 2) pages.push('...') }
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < tp) { if (end < tp - 1) pages.push('...'); pages.push(tp) }
  return pages
})

function getDropdownLabel(dd) {
  const val = filters[dd.name]
  if (!val) return dd.placeholder
  const opt = dd.options.find(o => o.value === val)
  return opt ? opt.label : val
}

function updateDropdownMenuPosition(name) {
  if (typeof window === 'undefined' || !name) return
  const el = document.querySelector(`.custom-dropdown[data-dropdown="${name}"] .custom-dropdown-btn`)
  if (!el) return
  const rect = el.getBoundingClientRect()
  const minWidth = Math.max(140, Math.ceil(rect.width))
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 375
  const left = Math.min(Math.max(12, Math.round(rect.left)), Math.max(12, viewportWidth - minWidth - 12))
  dropdownMenuStyle.value = {
    left: `${left}px`,
    top: `${Math.round(rect.bottom + 8)}px`,
    minWidth: `${minWidth}px`,
    zIndex: '2147483647',
  }
}

function getDropdownMenuStyle(name) {
  return openDropdown.value === name ? dropdownMenuStyle.value : {}
}

function toggleDropdown(name) {
  if (openDropdown.value === name) {
    openDropdown.value = null
    return
  }
  openDropdown.value = name
  nextTick(() => updateDropdownMenuPosition(name))
}

function selectFilter(name, value) {
  filters[name] = value
  if (name === 'metro_line') filters.metro_station = ''
  openDropdown.value = null
  doSearch()
}

function getDistrictDisplay(district) {
  if (!district) return ''
  if (lang.value === 'zh') return district
  const found = districts.value.find(d => d.value === district)
  return found ? found.label : district
}

function translateMetro(raw, list) {
  if (!raw) return ''
  if (lang.value === 'zh') return raw
  return String(raw).split(',').map(s => s.trim()).filter(Boolean)
    .map(cn => {
      const found = list.find(m => m.value === cn)
      return found ? found.label : cn
    })
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ')
}

function getMetroDisplay(prop) {
  const parts = []
  if (prop.metro_lines) parts.push(translateMetro(prop.metro_lines, metroLines.value))
  if (prop.metro_stations) parts.push(translateMetro(prop.metro_stations, metroStations.value))
  return parts.join(' · ')
}

function getPropertyUrl(prop) {
  if (prop.id) return `/property/${username.value}/${prop.id}?lang=${lang.value}`
  if (prop.share_url) return prop.share_url
  if (prop.share_code) return `/property/${username.value}/share/${prop.share_code}`
  return '#'
}

const FALLBACK_IMG = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#F0F2F5"/><rect x="130" y="90" width="140" height="100" rx="8" fill="#E0E4EA"/><path d="M170 155 L195 120 L220 150 L245 110 L270 155Z" fill="#C8CED8"/><circle cx="175" cy="115" r="10" fill="#C8CED8"/><text x="200" y="220" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#A0A8B4">No Image</text></svg>'
)

function getThumbUrl(prop) {
  let url = prop.thumb_url || ''
  if (!url) {
    const raw = prop.local_images || prop.media_urls
    if (raw) {
      try {
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (Array.isArray(arr) && arr.length > 1) {
          const first = arr.find(u => {
            const s = typeof u === 'string' ? u : (u?.url || u?.thumb || '')
            return s && !/\.(mp4|mov|avi|m4v)$/i.test(s)
          }) || arr[0]
          url = typeof first === 'string' ? first : (first?.thumb || first?.url || first?.file_url || '')
        }
      } catch { /* ignore */ }
    }
  }
  if (!url) return defaultCoverImage.value || FALLBACK_IMG
  if (url.startsWith('/api/proxy/image')) return url
  if (url.includes('X-Amz-Signature')) return url
  if (url.includes('rains3.com') || url.includes('qpic.cn') || url.includes('wx.qlogo.cn') || url.includes('wechat') || url.includes('mmbiz') || url.includes('szangels') || url.includes('imgcache.qq.com') || url.includes('hkimg.qq.com') || url.includes('wtimg.qq.com') || url.includes('smartgaga')) {
    return '/api/proxy/image?url=' + encodeURIComponent(url)
  }
  return url
}

function onImgError(e) {
  if (e.target.src !== FALLBACK_IMG) {
    e.target.src = FALLBACK_IMG
  }
}

function getPropertyTitle(prop) {
  const parts = []
  if (prop.district) {
    parts.push(getDistrictDisplay(prop.district))
  }
  if (prop.bedrooms) parts.push(`${prop.bedrooms}BR`)
  const priceVal = prop.custom_price || prop.price_value || prop.price
  if (priceVal) {
    const num = parseFloat(priceVal)
    if (!isNaN(num)) parts.push(`¥${num.toLocaleString()}`)
  }
  if (prop.metro_lines) parts.push(translateMetro(prop.metro_lines, metroLines.value))
  return parts.length > 0 ? parts.join(' · ') : (prop.property_code || 'Property')
}

function getPublishTimeAgo(prop) {
  const ts = prop.moment_publish_time || prop.effective_publish_time || prop.created_at
  if (!ts) return ''
  const now = Date.now()
  const then = new Date(ts).getTime()
  if (isNaN(then)) return ''
  const diff = Math.max(0, now - then)
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (lang.value === 'zh') {
    if (years > 0) return `${years}年前`
    if (months > 0) return `${months}个月前`
    if (weeks > 0) return `${weeks}周前`
    if (days > 0) return `${days}天前`
    if (hours > 0) return `${hours}小时前`
    if (minutes > 0) return `${minutes}分钟前`
    return '刚刚'
  } else {
    if (years > 0) return years === 1 ? '1 year ago' : `${years} years ago`
    if (months > 0) return months === 1 ? '1 month ago' : `${months} months ago`
    if (weeks > 0) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
    if (days > 0) return days === 1 ? '1 day ago' : `${days} days ago`
    if (hours > 0) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
    if (minutes > 0) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
    return 'just now'
  }
}

function doSearch() {
  currentPage.value = 1
  openDropdown.value = null
  loadProperties()
}

function changeSort() {
  currentPage.value = 1
  loadProperties()
}

function goToPage(p) {
  if (p < 1 || p > totalPages.value) return
  currentPage.value = p
  loadProperties()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function onWechatClick() {
  if (contactInfo.value.wechat_id) {
    showWechatModal.value = true
  } else {
    alert(lang.value === 'zh' ? '未配置微信号' : 'WeChat ID not configured')
  }
}

async function copyWechatId() {
  try {
    await navigator.clipboard.writeText(contactInfo.value.wechat_id)
    alert(t.value.copied)
    showWechatModal.value = false
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = contactInfo.value.wechat_id
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    alert(t.value.copied)
    showWechatModal.value = false
  }
}

async function loadProperties() {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      pageSize: 20,
      lang: lang.value,
      sort: currentSort.value,
    }
    if (filters.district) params.district = filters.district
    if (filters.price_range) params.price_range = filters.price_range
    if (filters.bedrooms) params.bedrooms = filters.bedrooms
    if (filters.metro_line) params.metro_line = filters.metro_line
    if (filters.metro_station) params.metro_station = filters.metro_station
    if (filters.keyword) params.keyword = filters.keyword

    const res = await api.get(`/property/${username.value}`, { params, timeout: 120000 })
    const data = res.data || {}
    userData.value = data.user || userData.value
    properties.value = data.properties || []
    total.value = data.total || 0
    totalPages.value = data.totalPages || Math.ceil(total.value / 20)
    settings.value = data.settings || {}
    defaultCoverImage.value = data.defaultCoverImage || '/images/no-image.png'

    if (data.districts && data.districts.length) districts.value = data.districts
    if (data.metro_lines && data.metro_lines.length) metroLines.value = data.metro_lines
    if (data.metro_stations && data.metro_stations.length) metroStations.value = data.metro_stations
  } catch { /* ignore */ }
  loading.value = false
}

// 关闭下拉框
function onDocClick(e) {
  if (!e.target.closest('.custom-dropdown')) {
    openDropdown.value = null
  }
}

function onViewportChange() {
  if (openDropdown.value) updateDropdownMenuPosition(openDropdown.value)
}

onMounted(async () => {
  document.addEventListener('click', onDocClick)
  window.addEventListener('resize', onViewportChange, { passive: true })
  window.addEventListener('scroll', onViewportChange, { passive: true })
  await checkUserTrial()
  await loadProperties()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange)
})

async function checkUserTrial() {
  if (!username.value) return
  try {
    const res = await api.get(`/api/check-user-trial/${username.value}`)
    const data = res.data?.data || {}
    if (data.is_trial && data.expired) {
      router.replace('/')
    }
  } catch { /* 忽略检查失败 */ }
}

watch(() => route.query.lang, (newLang) => {
  if (newLang && newLang !== lang.value) {
    lang.value = newLang
  }
})
</script>

<style scoped>
/* 独立页面 - 全屏覆盖父Layout */
.user-properties-standalone {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 9999;
  background: #f8fafc;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  color: #333;
  line-height: 1.6;
}

/* ========== 顶部导航 ========== */
.top-navbar {
  background: white;
  box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  position: sticky; top: 0; z-index: 1000;
}
.nav-container, .hero-container, .props-container {
  max-width: 1400px; margin: 0 auto; padding: 0 20px;
}
.nav-container { display: flex; align-items: center; height: 60px; }
.navbar-menu { display: flex; align-items: center; gap: 20px; width: 100%; }
.nav-item {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px;
  text-decoration: none; color: #64748b;
  font-size: 14px; font-weight: 500; transition: all 0.3s;
}
.nav-item:hover, .nav-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
.nav-item i { font-size: 16px; }
.navbar-lang-switch { margin-left: auto; }

/* 国旗图标 */
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

/* ========== 右侧浮窗 ========== */
.contact-sidebar {
  position: fixed; right: 0; top: 50%; transform: translateY(-50%);
  z-index: 999; display: flex; flex-direction: column;
}
.contact-sidebar-btn {
  width: 50px; height: 50px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white; display: flex; align-items: center; justify-content: center;
  font-size: 20px; cursor: pointer; transition: all 0.3s;
  border: none; position: relative;
}
.contact-sidebar-btn:first-child { border-radius: 8px 0 0 0; }
.contact-sidebar-btn:last-child { border-radius: 0 0 0 8px; }
.contact-sidebar-btn:only-child { border-radius: 8px 0 0 8px; }
.contact-sidebar-btn:hover { width: 55px; }
.sidebar-popup {
  position: absolute; right: 60px; top: 50%; transform: translateY(-50%);
  background: white; border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  padding: 20px; min-width: 280px;
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

/* ========== 搜索区域 ========== */
.search-hero-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 30px 0 25px 0; margin-bottom: 30px;
}
.hero-title-area { text-align: center; margin-bottom: 20px; }
.hero-title-area h1 {
  font-size: 24px; font-weight: 700; color: white; margin-bottom: 8px;
}
.hero-title-area p { color: rgba(255,255,255,0.9); font-size: 14px; margin: 0; }
.search-box-container {
  background: white; border-radius: 16px;
  padding: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.15);
}

/* 移动端筛选 - 默认隐藏 */
.mobile-filters-scroll { display: none; }
.mobile-filter-actions { display: none; }

/* 桌面端筛选 */
.desktop-filters .filter-row {
  display: flex; gap: 12px; flex-wrap: nowrap; align-items: stretch;
}
.desktop-filters .filter-item { flex: 1; min-width: 120px; }
.desktop-filters .filter-item select,
.desktop-filters .filter-item input {
  width: 100%; height: 100%; padding: 12px 14px;
  border: 2px solid #e9ecef; border-radius: 10px;
  font-size: 14px; background: white; cursor: pointer; transition: all 0.3s;
}
.desktop-filters .filter-item select:focus,
.desktop-filters .filter-item input:focus {
  border-color: #667eea; outline: none;
}
.filter-buttons { display: flex; gap: 8px; flex-shrink: 0; }
.btn-search {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white; border: none; padding: 12px 20px;
  border-radius: 10px; font-weight: 600; cursor: pointer;
  transition: all 0.3s; white-space: nowrap;
}
.btn-search:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}
.btn-reset {
  background: #f1f3f5; color: #495057; border: none;
  padding: 12px 16px; border-radius: 10px; font-weight: 600;
  cursor: pointer; white-space: nowrap; transition: all 0.3s;
  text-decoration: none; display: inline-flex; align-items: center;
}
.btn-reset:hover { background: #e9ecef; }
.btn-map {
  background: linear-gradient(135deg, #27AE60 0%, #229954 100%);
  color: white; border: none; padding: 0 16px;
  border-radius: 10px; font-weight: 600; cursor: pointer;
  transition: all 0.3s; text-decoration: none;
  display: inline-flex; align-items: center; justify-content: center;
  height: 100%; gap: 6px; white-space: nowrap;
}
.btn-map:hover { color: white; }

/* ========== 房源列表 ========== */
.properties-section { padding: 0 0 40px 0; }
.properties-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 25px; padding-bottom: 15px;
  border-bottom: 2px solid #f1f3f5;
}
.properties-header h2 { font-size: 18px; font-weight: 700; color: #1e293b; margin: 0; }
.header-right {
  display: flex; align-items: center; gap: 10px; flex-wrap: nowrap;
}
.properties-count { color: #64748b; font-size: 14px; white-space: nowrap; }
.properties-count strong { color: #667eea; }
.btn-map-sm {
  background: linear-gradient(135deg, #27AE60 0%, #229954 100%);
  color: white; border: none; padding: 6px 12px;
  border-radius: 6px; font-weight: 600; cursor: pointer;
  transition: all 0.3s; text-decoration: none;
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; white-space: nowrap;
}
.btn-map-sm:hover { color: white; }
.sort-select {
  padding: 5px 8px; border: 1px solid #e9ecef; border-radius: 6px;
  font-size: 12px; font-weight: 500; color: #495057;
  background: white; cursor: pointer; outline: none; min-width: 110px;
}

/* 房源网格 - PC端5列 */
.properties-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20px;
}
.property-card {
  background: white; border-radius: 12px; overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  transition: all 0.3s ease; cursor: pointer;
  text-decoration: none; color: inherit; display: block;
}
.property-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.15);
}
.property-card-image {
  position: relative; width: 100%; padding-top: 66.67%;
  background: #f1f3f5; overflow: hidden;
}
.property-card-image img {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  object-fit: cover; transition: transform 0.3s;
}
.property-card:hover .property-card-image img { transform: scale(1.05); }
.property-date-badge {
  position: absolute; top: 10px; right: 10px;
  background: rgba(255, 255, 255, 0.95); color: #333;
  padding: 4px 8px; border-radius: 12px;
  font-size: 10px; font-weight: 500;
  display: flex; align-items: center; gap: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.property-date-badge i { color: #667eea; font-size: 9px; }
.property-card-content { padding: 14px; }
.property-card-title {
  font-size: 14px; font-weight: 600; color: #1e293b;
  margin-bottom: 8px; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
  min-height: 39px;
}
.property-card-info {
  display: flex; flex-wrap: wrap; gap: 8px;
  font-size: 12px; color: #64748b;
}
.property-card-info span { display: flex; align-items: center; gap: 4px; }
.property-card-info i { color: #667eea; font-size: 11px; }
.property-card-location {
  font-size: 12px; color: #94a3b8; margin-top: 8px;
  display: flex; align-items: center; gap: 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.property-card-location i { color: #667eea; flex-shrink: 0; }

/* 加载 & 空状态 */
.loading-state {
  text-align: center; padding: 80px 20px; color: #999;
}
.loading-state i { font-size: 3rem; margin-bottom: 16px; display: block; }
.empty-state {
  text-align: center; padding: 60px 20px;
  background: white; border-radius: 12px;
}
.empty-state i { font-size: 64px; color: #cbd5e1; margin-bottom: 20px; display: block; }
.empty-state h3 { color: #64748b; font-size: 18px; margin-bottom: 10px; }
.empty-state p { color: #94a3b8; font-size: 14px; }

/* 分页 */
.pagination-container { display: flex; justify-content: center; margin-top: 40px; }
.pagination { display: flex; gap: 8px; list-style: none; padding: 0; align-items: center; }
.page-item .page-link {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 40px; height: 40px; padding: 0 12px;
  border: 2px solid #e9ecef; border-radius: 10px;
  color: #495057; font-weight: 500; font-size: 14px;
  transition: all 0.3s; text-decoration: none; white-space: nowrap;
}
.page-item.active .page-link {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent; color: white;
}
.page-item .page-link:hover { border-color: #667eea; color: #667eea; }
.page-item.disabled .page-link { color: #cbd5e1; cursor: not-allowed; border-color: #f1f3f5; }

/* 微信弹窗 */
.wechat-modal {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 10000; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
}
.wechat-modal-content {
  background: white; border-radius: 16px;
  width: 90%; max-width: 340px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: modalSlideIn 0.3s ease;
}
@keyframes modalSlideIn {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.wechat-modal-header {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 20px; border-bottom: 1px solid #f0f0f0;
  font-size: 18px; font-weight: 600; color: #333;
}
.wechat-modal-close {
  margin-left: auto; background: none; border: none;
  font-size: 28px; color: #999; cursor: pointer;
  line-height: 1; padding: 0; width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%; transition: all 0.2s;
}
.wechat-modal-close:hover { background: #f5f5f5; color: #333; }
.wechat-modal-body { padding: 24px 20px; }
.wechat-id-display { margin-bottom: 20px; }
.wechat-id-display label { display: block; font-size: 13px; color: #666; margin-bottom: 8px; }
.wechat-id-value {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 2px solid #07C160; border-radius: 12px;
  padding: 16px; font-size: 20px; font-weight: 700;
  color: #07C160; text-align: center; letter-spacing: 1px; word-break: break-all;
}
.wechat-copy-btn {
  width: 100%; padding: 14px 20px;
  background: linear-gradient(135deg, #07C160 0%, #06AD56 100%);
  color: white; border: none; border-radius: 12px;
  font-size: 16px; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(7, 193, 96, 0.3);
}
.wechat-copy-btn:hover { transform: translateY(-2px); }
.wechat-modal-tip {
  margin-top: 16px; font-size: 13px; color: #888;
  text-align: center; display: flex; align-items: center;
  justify-content: center; gap: 6px;
}

/* 移动端底部导航 - PC隐藏 */
.mobile-bottom-nav { display: none; }

/* 已登录用户底部导航 */
.mobile-bottom-nav--loggedin {
  display: none;
}
.mobile-bottom-nav--loggedin .mnav-item {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 8px 0 6px; color: #999; text-decoration: none; font-size: 10px;
  transition: color 0.2s; -webkit-tap-highlight-color: transparent; flex: 1;
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

/* ========== 响应式 ========== */
@media (max-width: 1400px) {
  .properties-grid { grid-template-columns: repeat(4, 1fr); }
}
@media (max-width: 1100px) {
  .properties-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 768px) {
  .user-properties-standalone { padding-bottom: 65px; }
  .contact-sidebar { display: none; }
  .nav-container { height: 50px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .navbar-menu { gap: 8px; flex-wrap: nowrap; }
  .nav-item { padding: 6px 12px; font-size: 12px; white-space: nowrap; flex-shrink: 0; }
  .nav-item i { font-size: 14px; }

  .desktop-filters { display: none; }
  .mobile-filters-scroll {
    display: flex; overflow-x: auto; gap: 8px;
    padding-bottom: 8px; margin-bottom: 12px;
    -webkit-overflow-scrolling: touch;
  }
  .mobile-filters-scroll::-webkit-scrollbar { display: none; }
  .mobile-filter-actions { display: flex !important; gap: 10px; justify-content: center; }
  .mobile-filter-actions .btn-search {
    padding: 8px 16px; font-size: 12px; height: 34px;
    display: flex; align-items: center; gap: 6px;
  }
  .mobile-filter-actions .btn-reset {
    padding: 8px 12px; font-size: 12px; height: 34px;
    display: flex; align-items: center;
  }

  .mobile-filter-btn, .mobile-filter-input {
    flex-shrink: 0; padding: 0 8px;
    border: 1px solid #e2e8f0; border-radius: 6px;
    background: white; color: #475569;
    font-size: 11px; height: 28px; line-height: 26px;
    white-space: nowrap; cursor: pointer; transition: all 0.3s;
  }
  .mobile-filter-input { width: 100px; outline: none; }
  .map-btn {
    display: flex; align-items: center; gap: 6px;
    text-decoration: none; color: #27AE60; font-weight: 600;
  }

  .custom-dropdown { position: relative; flex-shrink: 0; z-index: 100; }
  .custom-dropdown.open { z-index: 9999; }
  .custom-dropdown-btn {
    padding: 0 24px 0 8px; border: 1px solid #e2e8f0;
    border-radius: 6px; background: white; color: #475569;
    font-size: 11px; height: 28px; line-height: 26px;
    white-space: nowrap; cursor: pointer; display: inline-flex;
    align-items: center; position: relative;
  }
  .custom-dropdown-btn::after {
    content: ''; position: absolute; right: 6px; top: 50%;
    transform: translateY(-50%);
    width: 0; height: 0;
    border-left: 4px solid transparent; border-right: 4px solid transparent;
    border-top: 5px solid #6b7280; transition: transform 0.2s;
  }
  .custom-dropdown.open .custom-dropdown-btn::after { transform: translateY(-50%) rotate(180deg); }
  .custom-dropdown-btn.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-color: transparent; color: white;
  }
  .custom-dropdown-btn.active::after { border-top-color: white; }
  .custom-dropdown-menu {
    position: fixed; min-width: 140px; max-width: calc(100vw - 24px);
    max-height: 50vh; overflow-y: auto;
    background: white; border: none; border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    z-index: 2147483647; padding: 6px 0;
    isolation: isolate;
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
  }
  .custom-dropdown-item {
    padding: 10px 14px; font-size: 13px; color: #374151;
    cursor: pointer; transition: all 0.15s ease;
    margin: 2px 6px; border-radius: 8px;
  }
  .custom-dropdown-item:hover { background: #f3f4f6; color: #111827; }
  .custom-dropdown-item.selected {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white; font-weight: 500;
  }

  .properties-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .properties-header {
    flex-direction: column; gap: 8px; align-items: flex-start;
  }
  .search-hero-section { padding: 20px 0 15px 0; }
  .search-box-container { padding: 12px; }

  .property-date-badge { font-size: 9px; padding: 3px 6px; top: 8px; right: 8px; }

  .mobile-bottom-nav {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: rgba(255,255,255,0.98);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 -2px 12px rgba(0,0,0,0.1);
    z-index: 1000;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .mobile-bottom-nav--guest {
    display: flex; padding: 10px 20px;
    padding-bottom: max(10px, env(safe-area-inset-bottom));
    justify-content: space-around; align-items: center;
  }
  .mobile-bottom-nav--guest a {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-decoration: none;
    color: #64748b; font-size: 10px; padding: 4px 12px;
    transition: all 0.3s; border-radius: 8px;
  }
  .mobile-bottom-nav--guest a:hover,
  .mobile-bottom-nav--guest a:active { color: #667eea; background: rgba(102, 126, 234, 0.1); }
  .mobile-bottom-nav--guest a i { font-size: 18px; margin-bottom: 3px; }
  .mobile-bottom-nav--guest a.home-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white; border-radius: 12px; padding: 10px 24px;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
  }
  .mobile-bottom-nav--guest a.home-btn:hover { color: white; }
  .mobile-bottom-nav--loggedin {
    display: grid; grid-template-columns: repeat(5, 1fr);
    border-top: 1px solid #e9ecef;
  }
}
@media (max-width: 480px) {
  .properties-grid { gap: 10px; }
  .property-date-badge { font-size: 8px; padding: 2px 5px; top: 6px; right: 6px; }
  .property-card-content { padding: 10px; }
  .property-card-title { font-size: 12px; min-height: 33px; }
}
</style>
