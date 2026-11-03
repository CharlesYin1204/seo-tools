<template>
  <div class="map-search-page" :class="{ 'is-mobile': isMobile }">
    <!-- 椤堕儴瀵艰埅鏍?-->
    <nav class="top-navbar">
      <div class="nav-container">
        <div class="navbar-menu">
          <router-link :to="propertyListUrl" class="nav-item">
            <i class="fas fa-home"></i>
            <span>{{ t.home }}</span>
          </router-link>
          <router-link :to="propertyListUrl" class="nav-item">
            <i class="fas fa-list"></i>
            <span>{{ t.list_view }}</span>
          </router-link>
          <a :href="mapViewUrl" class="nav-item active">
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

    <!-- PC绔細宸︿晶鍒楄〃 + 鍙充晶鍦板浘 -->
    <div class="map-body">
      <!-- PC绔瓫閫夋爮 + 宸︿晶鎴挎簮鍒楄〃 -->
      <div class="left-panel" v-show="!isMobile">
        <!-- 绛涢€夋爮 -->
        <div class="filter-section">
          <div class="filter-row">
            <select v-model="filters.district" @change="applyFilters" class="filter-select">
              <option value="">{{ t.all_districts }}</option>
              <option v-for="d in districts" :key="d.id" :value="d.name_cn">{{ lang === 'en' ? (d.name_en || d.name_cn) : d.name_cn }}</option>
            </select>
            <select v-model="filters.bedrooms" @change="applyFilters" class="filter-select">
              <option value="">{{ t.beds }}</option>
              <option value="1">1 BR</option><option value="2">2 BR</option>
              <option value="3">3 BR</option><option value="4">4 BR</option><option value="5">5+ BR</option>
            </select>
            <select v-model="filters.price_range" @change="applyFilters" class="filter-select">
              <option value="">{{ t.price }}</option>
              <option value="0-5000">{{ lang === 'en' ? 'Under ¥5K' : '5000以下' }}</option>
              <option value="5000-10000">¥5K-10K</option>
              <option value="10000-15000">¥10K-15K</option>
              <option value="15000-20000">¥15K-20K</option>
              <option value="20000-30000">¥20K-30K</option>
              <option value="30000+">{{ lang === 'en' ? 'Above ¥30K' : '30000以上' }}</option>
            </select>
          </div>
          <div class="filter-row">
            <select v-model="filters.metro_line" @change="onMetroLineChange" class="filter-select">
              <option value="">{{ t.line }}</option>
              <option v-for="l in metroLines" :key="l.id" :value="l.name_cn">{{ lang === 'en' ? (l.name_en || l.name_cn) : l.name_cn }}</option>
            </select>
            <select v-model="filters.metro_station" @change="applyFilters" class="filter-select" :disabled="!filters.metro_line">
              <option value="">{{ t.station }}</option>
              <option v-for="s in filteredStations" :key="s.id" :value="s.name_cn">{{ lang === 'en' ? (s.name_en || s.name_cn) : s.name_cn }}</option>
            </select>
            <div class="filter-keyword-wrap">
              <input v-model="filters.keyword" :placeholder="t.keyword" class="filter-keyword" @keyup.enter="applyFilters" />
              <i class="fas fa-search filter-keyword-icon"></i>
            </div>
            <button class="filter-reset-btn" @click="resetFilters" :title="t.reset"><i class="fas fa-undo"></i></button>
          </div>
        </div>

        <!-- 鎴挎簮缁熻 -->
        <div class="list-header">
          <span class="list-count">{{ lang === 'en' ? 'Total' : 'Total' }} <b>{{ filteredProperties.length }}</b> {{ lang === 'en' ? 'listings' : 'listings' }} | {{ lang === 'en' ? 'Map' : 'Map' }} <b>{{ mapPropertiesCount }}</b> {{ lang === 'en' ? 'marked' : 'marked' }}</span>
        </div>

        <!-- 鎴挎簮鍒楄〃 -->
        <div class="property-list" ref="propertyListRef">
          <div
            v-for="p in filteredProperties"
            :key="p.id"
            :data-id="p.id"
            class="property-card"
            :class="{ active: focusedId === p.id }"
            @click="onPropertyCardClick(p)"
            @mouseenter="onPropertyCardHover(p)"
          >
            <div class="card-img-wrap">
              <img :src="getPropertyImage(p)" :alt="p.community" class="card-img" @error="onImgError($event)" />
              <span class="card-tag" v-if="p.bedrooms">{{ p.bedrooms }}{{ lang === 'en' ? 'BR' : 'BR' }}</span>
            </div>
            <div class="card-info">
              <h5 class="card-title">{{ getCardTitle(p) }}</h5>
              <p class="card-meta">
                {{ p.area_sqm ? p.area_sqm + 'm² | ' : '' }}{{ p.bedrooms || '-' }}{{ lang === 'en' ? 'BR' : 'BR' }}{{ p.bathrooms ? (p.bathrooms + (lang === 'en' ? 'BA' : 'BA')) : '' }}
                <span v-if="p.floor_info"> | {{ p.floor_info }}</span>
              </p>
              <p class="card-community">
                <i class="fas fa-map-marker-alt"></i>
                {{ [p.community || '', lang === 'en' ? getDistrictEn(p.district) : p.district].filter(Boolean).join(' · ') }}
              </p>
              <p class="card-metro" v-if="p.metro_lines || p.metro_stations">
                <i class="fas fa-subway"></i>
                {{ [translateParts(p.metro_lines, metroLineMap), p.metro_stations ? translateParts(p.metro_stations, metroStationMap) : ''].filter(Boolean).join(' · ') }}
              </p>
              <div class="card-price">
                <span class="price-value" v-if="p.price_value">¥{{ Number(p.price_value).toLocaleString() }}</span>
                <span class="price-unit">/{{ lang === 'en' ? 'mo' : 'mo' }}</span>
              </div>
            </div>
          </div>
          <div v-if="filteredProperties.length === 0" class="no-results">
            <i class="fas fa-search"></i>
            <p>{{ lang === 'en' ? 'No properties found' : '未找到符合条件的房源' }}</p>
          </div>
        </div>
      </div>

      <!-- 绉诲姩绔瓫閫夋爮 -->
      <div class="mobile-filter-bar" v-show="isMobile">
        <div class="mobile-filter-scroll">
          <select v-model="filters.district" @change="applyFilters" class="m-filter-select">
            <option value="">{{ t.all_districts }}</option>
            <option v-for="d in districts" :key="d.id" :value="d.name_cn">{{ lang === 'en' ? (d.name_en || d.name_cn) : d.name_cn }}</option>
          </select>
          <select v-model="filters.bedrooms" @change="applyFilters" class="m-filter-select">
            <option value="">{{ t.beds }}</option>
            <option value="1">1BR</option><option value="2">2BR</option>
            <option value="3">3BR</option><option value="4">4BR</option><option value="5">5+</option>
          </select>
          <select v-model="filters.price_range" @change="applyFilters" class="m-filter-select">
            <option value="">{{ t.price }}</option>
            <option value="0-5000">&lt;5K</option>
            <option value="5000-10000">5-10K</option>
            <option value="10000-15000">10-15K</option>
            <option value="15000-20000">15-20K</option>
            <option value="20000-30000">20-30K</option>
            <option value="30000+">30K+</option>
          </select>
          <select v-model="filters.metro_line" @change="onMetroLineChange" class="m-filter-select">
            <option value="">{{ t.line }}</option>
            <option v-for="l in metroLines" :key="l.id" :value="l.name_cn">{{ lang === 'en' ? (l.name_en || l.name_cn) : l.name_cn }}</option>
          </select>
          <button class="m-filter-reset" @click="resetFilters" v-if="hasActiveFilter"><i class="fas fa-times"></i></button>
        </div>
      </div>

      <!-- 鍦板浘鍖哄煙 -->
      <div class="map-area" :class="{ 'map-area--mobile': isMobile }">
        <div id="amap-container" ref="amapRef" class="map-container"></div>
        <div v-if="mapStatus !== 'ready'" class="map-placeholder">
          <template v-if="mapStatus === 'loading'">
            <i class="fas fa-spinner fa-spin fa-2x"></i>
            <p>{{ lang === 'en' ? 'Loading map...' : 'Loading map...' }}</p>
          </template>
          <template v-else>
            <i class="fas fa-map-marked-alt fa-2x"></i>
            <p>{{ mapError || (lang === 'en' ? 'Map unavailable' : 'Map unavailable') }}</p>
          </template>
        </div>
        <!-- 绉诲姩绔湴鍥句笂鐨勬埧婧愭暟閲廱adge -->
        <div class="map-count-badge" v-if="isMobile && mapStatus === 'ready'">
          <i class="fas fa-home"></i> {{ mapPropertiesCount }}
        </div>
      </div>

      <!-- 绉诲姩绔簳閮ㄥ脊鍑洪潰鏉?-->
      <div v-if="isMobile" class="mobile-bottom-panel" :class="{ expanded: mobilePanel.expanded, collapsed: !mobilePanel.expanded }">
        <div class="panel-handle" @click="toggleMobilePanel">
          <div class="handle-bar"></div>
          <span class="panel-title" v-if="mobilePanel.selectedProperty">
            {{ getCardTitle(mobilePanel.selectedProperty) }}
          </span>
          <span class="panel-title" v-else>
            {{ filteredProperties.length }} {{ lang === 'en' ? 'listings nearby' : 'listings nearby' }}
          </span>
        </div>
        <div class="panel-content" v-if="mobilePanel.expanded">
          <!-- 鍗曚釜鎴挎簮璇︽儏锛堢偣鍑诲湴鍥炬爣璁拌Е鍙戯級 -->
          <div v-if="mobilePanel.selectedProperty" class="mobile-detail-card">
            <div class="detail-close" @click.stop="closeMobileDetail"><i class="fas fa-times"></i></div>
            <div class="detail-body">
              <img :src="getPropertyImage(mobilePanel.selectedProperty)" class="detail-img" @error="onImgError($event)" />
              <div class="detail-info">
                <h5>{{ getCardTitle(mobilePanel.selectedProperty) }}</h5>
                <p class="detail-meta">
                  {{ mobilePanel.selectedProperty.area_sqm ? mobilePanel.selectedProperty.area_sqm + 'm²' : '' }}
                  {{ mobilePanel.selectedProperty.bedrooms ? ' | ' + mobilePanel.selectedProperty.bedrooms + (lang === 'en' ? 'BR' : 'BR') : '' }}
                  {{ mobilePanel.selectedProperty.floor_info ? ' | ' + mobilePanel.selectedProperty.floor_info : '' }}
                </p>
                <p class="detail-location">
                  <i class="fas fa-map-marker-alt"></i>
                  {{ [mobilePanel.selectedProperty.community, mobilePanel.selectedProperty.district].filter(Boolean).join(' · ') }}
                </p>
                <div class="detail-price">
                  <span class="price-val">¥{{ Number(mobilePanel.selectedProperty.price_value || 0).toLocaleString() }}</span>
                  <span class="price-unit">/{{ lang === 'en' ? 'mo' : 'mo' }}</span>
                </div>
                <a :href="getDetailUrl(mobilePanel.selectedProperty)" class="detail-view-btn" target="_blank">
                  {{ lang === 'en' ? 'View Details' : 'View Details' }} →                </a>
              </div>
            </div>
          </div>
          <!-- 鎴挎簮鍒楄〃锛堟棤閫変腑鏃跺睍绀猴級 -->
          <div v-else class="mobile-property-list">
            <div
              v-for="p in filteredProperties.slice(0, 20)"
              :key="p.id"
              class="mobile-card"
              @click="onMobileCardClick(p)"
            >
              <img :src="getPropertyImage(p)" class="mobile-card-img" @error="onImgError($event)" />
              <div class="mobile-card-info">
                <h6>{{ getCardTitle(p) }}</h6>
                <p>{{ p.area_sqm ? p.area_sqm + 'm²' : '' }} {{ p.bedrooms || '-' }}{{ lang === 'en' ? 'BR' : 'BR' }}</p>
                <div class="mobile-card-price">¥{{ Number(p.price_value || 0).toLocaleString() }}/{{ lang === 'en' ? 'mo' : 'mo' }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 绉诲姩绔簳閮ㄥ鑸?-->
    <nav v-if="isLoggedIn && isMobile" class="mobile-bottom-nav mobile-bottom-nav--loggedin">
      <a :href="propertyListUrl" class="mnav-item">
        <i class="fas fa-home"></i>
        <span>{{ lang === 'zh' ? '首页' : 'Home' }}</span>
      </a>
      <a href="/user/wechat-robot/moments-parsed-list" class="mnav-item">
        <i class="fas fa-search"></i>
        <span>{{ lang === 'zh' ? '找房' : 'Search' }}</span>
      </a>
      <a href="/user/upload-property" class="mnav-item publish-item">
        <div class="publish-btn"><i class="fas fa-plus"></i></div>
        <span>{{ lang === 'zh' ? '发布' : 'Post' }}</span>
      </a>
      <a href="/user/properties" class="mnav-item">
        <i class="fas fa-building"></i>
        <span>{{ lang === 'zh' ? '房源' : 'Listings' }}</span>
      </a>
      <a href="/user/dashboard" class="mnav-item">
        <i class="fas fa-user"></i>
        <span>{{ lang === 'zh' ? '我的' : 'My' }}</span>
      </a>
    </nav>
    <nav v-else-if="!isLoggedIn && isMobile" class="mobile-bottom-nav mobile-bottom-nav--guest">
      <a :href="propertyListUrl" class="home-btn">
        <i class="fas fa-home"></i>
        <span>{{ lang === 'zh' ? '首页' : 'Home' }}</span>
      </a>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/api'
import { useAuthStore } from '@/store/auth'

const route = useRoute()
const authStore = useAuthStore()
const isLoggedIn = computed(() => !!authStore.token && !!authStore.user)

const username = computed(() => route.query.user || '')
const lang = ref(route.query.lang || 'en')
const isMobile = ref(window.innerWidth < 768)

const t = computed(() => {
  if (lang.value === 'zh') {
    return {
      home: 'Home', list_view: 'List', map_view: 'Map', switch_lang: 'EN',
      all_districts: 'All Districts', beds: 'Beds', price: 'Price', line: 'Line',
      station: 'Station', keyword: 'Keyword...', reset: 'Reset',
    }
  }
  return {
    home: 'Home', list_view: 'List', map_view: 'Map', switch_lang: '中文',
    all_districts: 'All Districts', beds: 'Beds', price: 'Price', line: 'Line',
    station: 'Station', keyword: 'Keyword...', reset: 'Reset',
  }
})

const propertyListUrl = computed(() => {
  if (username.value) return `/property/${username.value}?lang=${lang.value}`
  return '/'
})
const mapViewUrl = computed(() => {
  const params = new URLSearchParams()
  if (username.value) params.set('user', username.value)
  params.set('lang', lang.value)
  return `/map-search?${params.toString()}`
})
const langSwitchUrl = computed(() => {
  const newLang = lang.value === 'en' ? 'zh' : 'en'
  const params = new URLSearchParams()
  if (username.value) params.set('user', username.value)
  params.set('lang', newLang)
  return `/map-search?${params.toString()}`
})

const properties = ref([])
const districts = ref([])
const metroLines = ref([])
const metroStations = ref([])
const focusedId = ref(null)
const mapStatus = ref('loading')
const mapError = ref('')
const amapRef = ref(null)
const propertyListRef = ref(null)

let mapInstance = null
let markerList = []
const markerByPropertyId = new Map()
let amapScriptPromise = null
let mapConfig = null
let currentInfoWindow = null
let activeMarkerKey = null
const CORE_AREA_RADIUS_DEGREES = 0.025

const districtMap = {}
const metroLineMap = {}
const metroStationMap = {}

const filters = ref({
  district: '', bedrooms: '', price_range: '', metro_line: '', metro_station: '', keyword: '',
})

const hasActiveFilter = computed(() => {
  const f = filters.value
  return f.district || f.bedrooms || f.price_range || f.metro_line || f.metro_station || f.keyword
})

const mobilePanel = reactive({
  expanded: false,
  selectedProperty: null,
})

const filteredStations = computed(() => {
  if (!filters.value.metro_line) return []
  return metroStations.value.filter(s => s.line_name === filters.value.metro_line)
})

const filteredProperties = computed(() => {
  let list = properties.value
  const f = filters.value

  if (f.district) list = list.filter(p => p.district === f.district)

  if (f.bedrooms) {
    const b = parseInt(f.bedrooms)
    list = list.filter(p => b >= 5 ? (p.bedrooms || 0) >= 5 : (p.bedrooms || 0) === b)
  }

  if (f.price_range) {
    if (f.price_range.includes('+')) {
      const min = parseInt(f.price_range)
      list = list.filter(p => (p.price_value || 0) >= min)
    } else if (f.price_range.includes('-')) {
      const [min, max] = f.price_range.split('-').map(Number)
      list = list.filter(p => {
        const pv = p.price_value || 0
        return pv >= min && pv <= max
      })
    }
  }

  if (f.metro_line) {
    list = list.filter(p => p.metro_lines && String(p.metro_lines).split(',').some(l => l.trim() === f.metro_line))
  }

  if (f.metro_station) {
    list = list.filter(p => p.metro_stations && String(p.metro_stations).split(',').some(s => s.trim() === f.metro_station))
  }

  if (f.keyword) {
    const kw = f.keyword.toLowerCase()
    list = list.filter(p =>
      (p.community || '').toLowerCase().includes(kw) ||
      (p.district || '').toLowerCase().includes(kw) ||
      (p.title || '').toLowerCase().includes(kw) ||
      (p.description || '').toLowerCase().includes(kw) ||
      (p.metro_stations || '').toLowerCase().includes(kw)
    )
  }

  return list
})

const mapPropertiesCount = computed(() => {
  return filteredProperties.value.filter(p => {
    const lat = parseFloat(p.latitude)
    const lng = parseFloat(p.longitude)
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0
  }).length
})

function buildMaps() {
  districts.value.forEach(d => { districtMap[d.name_cn] = d.name_en || d.name_cn })
  metroLines.value.forEach(l => { metroLineMap[l.name_cn] = l.name_en || l.name_cn })
  metroStations.value.forEach(s => { metroStationMap[s.name_cn] = s.name_en || s.name_cn })
}

function getDistrictEn(cn) { return districtMap[cn] || cn }

function translateParts(raw, map) {
  if (!raw) return ''
  return String(raw).split(',').map(s => s.trim()).filter(Boolean)
    .map(part => map[part] || part)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ')
}

/** 涓?UserProperties 鍒楄〃鍗＄墖 getPropertyTitle 涓€鑷达細鎸夎瑷€鐢ㄥ尯鍩?鎴峰瀷/浠锋牸/鍦伴搧锛岄伩鍏嶈嫳鏂囨ā寮忎笅浠嶆樉绀轰腑鏂?title 瀛楁 */
function translateMetroLinesForTitle(raw) {
  if (!raw) return ''
  if (lang.value === 'zh') {
    return String(raw).split(',').map(s => s.trim()).filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(', ')
  }
  return translateParts(raw, metroLineMap)
}

function getCardTitle(p) {
  const parts = []
  if (p.district) {
    parts.push(lang.value === 'zh' ? p.district : getDistrictEn(p.district))
  }
  if (p.bedrooms) parts.push(`${p.bedrooms}BR`)
  const priceVal = p.custom_price || p.price_value || p.price
  if (priceVal) {
    const num = parseFloat(String(priceVal).replace(/[^\d.]/g, ''))
    if (!isNaN(num) && num > 0) parts.push(`¥${num.toLocaleString()}`)
  }
  if (p.metro_lines) parts.push(translateMetroLinesForTitle(p.metro_lines))
  if (parts.length > 0) return parts.join(' · ')
  return p.property_code || (lang.value === 'zh' ? '房源' : 'Property')
}

function getMarkerLabel(p) {
  if (p.price_value) {
    const pv = p.price_value
    return '¥' + (pv >= 10000 ? Math.round(pv / 1000) + 'K' : Number(pv).toLocaleString())
  }
  return p.community || 'Property'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getCoordinateKey(p) {
  const lat = Number(parseFloat(p.latitude).toFixed(6))
  const lng = Number(parseFloat(p.longitude).toFixed(6))
  return `${lng},${lat}`
}

function getMapGroups() {
  const groups = new Map()
  const validProps = filteredProperties.value.filter(p => {
    const lat = parseFloat(p.latitude)
    const lng = parseFloat(p.longitude)
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0
  })
  for (const p of validProps) {
    const key = getCoordinateKey(p)
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        latitude: parseFloat(p.latitude),
        longitude: parseFloat(p.longitude),
        community: p.community || '',
        properties: [],
      })
    }
    groups.get(key).properties.push(p)
  }
  return Array.from(groups.values())
}

function getCoreMapGroups(groups) {
  if (groups.length <= 3 || hasActiveFilter.value) return groups

  let bestGroup = null
  let bestScore = 0
  for (const group of groups) {
    const nearby = groups.filter(item =>
      Math.abs(item.latitude - group.latitude) <= CORE_AREA_RADIUS_DEGREES &&
      Math.abs(item.longitude - group.longitude) <= CORE_AREA_RADIUS_DEGREES
    )
    const score = nearby.reduce((sum, item) => sum + item.properties.length, 0)
    if (score > bestScore) {
      bestScore = score
      bestGroup = group
    }
  }

  if (!bestGroup) return groups
  const coreGroups = groups.filter(item =>
    Math.abs(item.latitude - bestGroup.latitude) <= CORE_AREA_RADIUS_DEGREES &&
    Math.abs(item.longitude - bestGroup.longitude) <= CORE_AREA_RADIUS_DEGREES
  )
  return coreGroups.length >= 2 ? coreGroups : groups
}

function getGroupMarkerLabel(group) {
  if (group.properties.length > 1) return group.properties.length
  return getMarkerLabel(group.properties[0])
}

function buildInfoWindowContent(group) {
  const title = escapeHtml(group.community || 'Properties')
  const countText = group.properties.length > 1
    ? `${group.properties.length} listings`
    : '1 listing'
  const items = group.properties.slice(0, 8).map((p) => {
    const imgUrl = escapeHtml(getPropertyImage(p))
    const cardTitle = escapeHtml(getCardTitle(p))
    const detailUrl = escapeHtml(getDetailUrl(p))
    const price = p.price_value ? `¥${Number(p.price_value).toLocaleString()}/mo` : ''
    const meta = [
      p.area_sqm ? `${p.area_sqm}m²` : '',
      p.bedrooms ? `${p.bedrooms}BR` : '',
      p.metro_stations ? translateParts(p.metro_stations, metroStationMap) : '',
    ].filter(Boolean).join(' · ')
    return `<a class="map-info-list-item" href="${detailUrl}" target="_blank" data-prop-id="${p.id}">
      <img src="${imgUrl}" class="info-card-img" onerror="this.style.display='none'" />
      <span class="map-info-list-text">
        <strong>${cardTitle}</strong>
        <em>${escapeHtml(price)}</em>
        <small>${escapeHtml(meta)}</small>
      </span>
    </a>`
  }).join('')
  const more = group.properties.length > 8
    ? `<div class="map-info-more">+${group.properties.length - 8} more</div>`
    : ''
  return `<div class="map-info-card map-info-card--cluster">
    <div class="map-info-cluster-head">
      <strong>${title}</strong>
      <span>${countText}</span>
    </div>
    <div class="map-info-list">${items}${more}</div>
  </div>`
}

/** 涓?UserProperties getThumbUrl 涓€鑷达細浼樺厛 thumb_url锛屽啀 local_images/media_urls 棣栧紶闈炶棰戝浘锛堜慨澶嶄粎 1 寮犲浘鏃惰鐢ㄥ崰浣嶅浘锛?*/
function getPropertyImage(p) {
  let url = p.thumb_url || ''
  if (!url) {
    const raw = p.local_images || p.media_urls
    if (raw) {
      try {
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (Array.isArray(arr) && arr.length > 0) {
          const first = arr.find(u => {
            const s = typeof u === 'string' ? u : (u?.url || u?.thumb || '')
            return s && !/\.(mp4|mov|avi|m4v)$/i.test(s)
          }) || arr[0]
          url = typeof first === 'string' ? first : (first?.thumb || first?.url || first?.file_url || '')
        }
      } catch { /* ignore */ }
    }
  }
  if (!url) return '/assets/images/default-property.svg'
  if (url.startsWith('/api/proxy/image')) return url
  if (url.includes('X-Amz-Signature')) return url
  if (url.includes('qpic.cn') || url.includes('wx.qlogo.cn') || url.includes('rains3.com') || url.includes('wechat') || url.includes('mmbiz') || url.includes('szangels') || url.includes('imgcache.qq.com') || url.includes('hkimg.qq.com') || url.includes('wtimg.qq.com') || url.includes('smartgaga')) {
    return '/api/proxy/image?url=' + encodeURIComponent(url)
  }
  return url
}

function getDetailUrl(p) {
  return username.value
    ? `/properties/${p.id}?user=${username.value}&lang=${lang.value}`
    : `/properties/${p.id}`
}

function onImgError(e) {
  e.target.src = '/assets/images/default-property.svg'
}

function onMetroLineChange() {
  filters.value.metro_station = ''
  applyFilters()
}

function resetFilters() {
  filters.value = { district: '', bedrooms: '', price_range: '', metro_line: '', metro_station: '', keyword: '' }
  applyFilters()
}

function applyFilters() {
  focusedId.value = null
  mobilePanel.selectedProperty = null
  if (mapInstance) renderMarkers()
}

function onPropertyCardClick(p) {
  focusedId.value = p.id
  const lat = parseFloat(p.latitude)
  const lng = parseFloat(p.longitude)
  if (mapInstance && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    mapInstance.panTo([lng, lat], 300)
    setTimeout(() => {
      if (mapInstance) mapInstance.setZoom(16)
    }, 100)
    const marker = markerByPropertyId.get(p.id)
    if (marker) {
      setTimeout(() => {
        window.AMap && marker.emit('click', { target: marker })
      }, 350)
    }
  }
}

function onPropertyCardHover(p) {
  if (isMobile.value) return
  focusedId.value = p.id
}

function onMobileCardClick(p) {
  mobilePanel.selectedProperty = p
  const lat = parseFloat(p.latitude)
  const lng = parseFloat(p.longitude)
  if (mapInstance && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    mapInstance.panTo([lng, lat], 300)
    setTimeout(() => {
      if (mapInstance) mapInstance.setZoom(16)
    }, 100)
  }
}

function toggleMobilePanel() {
  mobilePanel.expanded = !mobilePanel.expanded
}

function closeMobileDetail() {
  mobilePanel.selectedProperty = null
}

function scrollToCard(propertyId) {
  if (!propertyListRef.value) return
  const card = propertyListRef.value.querySelector(`.property-card[data-id="${propertyId}"]`)
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

async function loadMapData() {
  try {
    const params = {}
    if (username.value) params.user = username.value
    if (lang.value) params.lang = lang.value
    const res = await api.get('/api/map-search', { params, timeout: 120000 })
    const data = res.data?.data || res.data || {}
    properties.value = data.properties || []
    districts.value = data.districts || []
    metroLines.value = data.metroLines || []
    metroStations.value = data.metroStations || []
    mapConfig = data.map_config || null
    buildMaps()
    console.log('[MapSearch] Data loaded:', properties.value.length, 'properties')
  } catch (err) {
    console.error('[MapSearch] Failed to load map data:', err)
  }
}

async function loadAmapScript(key, securityKey) {
  if (window.AMap) return window.AMap
  if (amapScriptPromise) return amapScriptPromise
  amapScriptPromise = new Promise((resolve, reject) => {
    if (securityKey) {
      window._AMapSecurityConfig = { securityJsCode: securityKey }
    }
    const s = document.createElement('script')
    s.id = 'amap-sdk-script-map'
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&plugin=AMap.InfoWindow,AMap.Scale`
    s.async = true
    s.onload = () => resolve(window.AMap)
    s.onerror = (e) => reject(new Error('Failed to load AMap SDK'))
    document.head.appendChild(s)
  })
  return amapScriptPromise
}

async function initMap() {
  if (!mapConfig || !mapConfig.enabled || !mapConfig.js_api_key) {
    mapStatus.value = 'error'
    mapError.value = lang.value === 'en' ? 'Map API Key not configured' : 'Map API Key not configured'
    return
  }
  try {
    const AMap = await loadAmapScript(mapConfig.js_api_key, mapConfig.security_js_key)
    await nextTick()
    const container = amapRef.value
    if (!container) {
      mapStatus.value = 'error'
      mapError.value = lang.value === 'en' ? 'Map container not found' : 'Map container not found'
      return
    }

    const dbZ = Number(mapConfig.default_zoom)
    const cfgZoom = Number.isFinite(dbZ) && dbZ >= 3 && dbZ <= 20 ? dbZ : 15
    const initialZoom = Math.max(15, Math.min(17, cfgZoom))

    mapInstance = new AMap.Map(container, {
      center: [mapConfig.default_center_lng || 121.4737, mapConfig.default_center_lat || 31.2304],
      zoom: initialZoom,
      resizeEnable: true,
      lang: lang.value === 'zh' ? 'zh_cn' : 'en',
    })

    mapInstance.on('complete', () => {
      console.log('[MapSearch] Map tiles loaded')
    })

    mapStatus.value = 'ready'

    await nextTick()
    setTimeout(() => {
      if (mapInstance) {
        try { mapInstance.resize() } catch {}
        renderMarkers()
      }
    }, 600)
  } catch (err) {
    mapStatus.value = 'error'
    mapError.value = lang.value === 'en' ? 'Map failed to load' : 'Map failed to load'
    console.error('[MapSearch] Map init error:', err)
  }
}

function renderMarkers() {
  if (!mapInstance || !window.AMap) return
  const AMap = window.AMap

  for (const m of markerList) mapInstance.remove(m)
  markerList = []
  const markerByGroupKey = new Map()
  markerByPropertyId.clear()
  if (currentInfoWindow) { currentInfoWindow.close(); currentInfoWindow = null }
  activeMarkerKey = null

  const groups = getMapGroups()

  for (const group of groups) {
    const lat = group.latitude
    const lng = group.longitude
    const primary = group.properties[0]
    const isCluster = group.properties.length > 1
    const label = getGroupMarkerLabel(group)

    const marker = new AMap.Marker({
      position: [lng, lat],
      content: `<div class="map-marker-bubble${isCluster ? ' map-marker-bubble--cluster' : ''}">${label}</div>`,
      offset: new AMap.Pixel(isCluster ? -18 : -40, isCluster ? -18 : -16),
    })
    marker._propId = primary.id
    markerByGroupKey.set(group.key, marker)
    group.properties.forEach(p => markerByPropertyId.set(p.id, marker))

    marker.on('click', () => {
      if (activeMarkerKey === group.key) {
        if (currentInfoWindow) { currentInfoWindow.close(); currentInfoWindow = null }
        activeMarkerKey = null
        focusedId.value = null
        if (isMobile.value) {
          mobilePanel.selectedProperty = null
          mobilePanel.expanded = false
        }
        return
      }

      if (currentInfoWindow) { currentInfoWindow.close(); currentInfoWindow = null }
      activeMarkerKey = group.key
      focusedId.value = primary.id

      mapInstance.panTo([lng, lat], 200)
      setTimeout(() => {
        if (mapInstance) mapInstance.setZoom(16)
      }, 50)

      if (isMobile.value) {
        mobilePanel.selectedProperty = primary
        mobilePanel.expanded = true
      } else {
        const infoContent = buildInfoWindowContent(group)

        setTimeout(() => {
          if (activeMarkerKey !== group.key) return
          const infoWindow = new AMap.InfoWindow({ content: infoContent, offset: new AMap.Pixel(0, -20) })
          infoWindow.open(mapInstance, marker.getPosition())
          currentInfoWindow = infoWindow
          infoWindow.on('close', () => {
            if (activeMarkerKey === group.key) activeMarkerKey = null
          })
        }, 250)

        scrollToCard(primary.id)
      }
    })
    markerList.push(marker)
    mapInstance.add(marker)
  }

  if (groups.length > 0 && !focusedId.value) {
    const targetGroups = getCoreMapGroups(groups)
    const targetMarkers = targetGroups.map(group => markerByGroupKey.get(group.key)).filter(Boolean)
    if (targetMarkers.length === 1) {
      const group = targetGroups[0]
      mapInstance.setCenter([group.longitude, group.latitude])
      mapInstance.setZoom(isMobile.value ? 15 : 16)
    } else if (targetMarkers.length > 1) {
      mapInstance.setFitView(targetMarkers, false, [60, 60, 60, 60])
      const z = mapInstance.getZoom()
      const minAfterFit = hasActiveFilter.value ? (isMobile.value ? 12 : 13) : (isMobile.value ? 14 : 15)
      if (typeof z === 'number' && z < minAfterFit) {
        mapInstance.setZoom(minAfterFit)
      }
    }
  }
}
function handleResize() {
  isMobile.value = window.innerWidth < 768
  if (mapInstance) {
    nextTick(() => {
      try { mapInstance.resize() } catch {}
    })
  }
}

onMounted(async () => {
  lang.value = route.query.lang || 'en'
  window.addEventListener('resize', handleResize)
  await loadMapData()
  await initMap()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (mapInstance) {
    mapInstance.destroy()
    mapInstance = null
  }
})

watch(() => route.query.lang, (newLang) => {
  if (newLang && newLang !== lang.value) {
    lang.value = newLang
    if (mapInstance && window.AMap) {
      try {
        mapInstance.setLang(newLang === 'zh' ? 'zh_cn' : 'en')
      } catch { /* 閮ㄥ垎鐗堟湰鏃?setLang */ }
    }
  }
})

watch(mapStatus, (newVal) => {
  if (newVal === 'ready' && mapInstance) {
    nextTick(() => {
      try { mapInstance.resize() } catch {}
    })
  }
})
</script>

<style scoped>
.map-search-page {
  display: flex; flex-direction: column;
  height: 100vh;
  overflow: hidden;
  margin: -20px 0 -60px 0;
}

/* 椤堕儴瀵艰埅鏍?*/
.top-navbar {
  background: white;
  box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  flex-shrink: 0;
  z-index: 100;
}
.nav-container {
  max-width: 1400px; margin: 0 auto; padding: 0 20px;
  display: flex; align-items: center; height: 56px;
}
.navbar-menu { display: flex; align-items: center; gap: 20px; width: 100%; }
.nav-item {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px;
  color: #333; text-decoration: none;
  font-size: 14px; font-weight: 500; transition: all 0.3s;
}
.nav-item:hover, .nav-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
.nav-item i { font-size: 16px; }
.navbar-lang-switch { margin-left: auto; }
.flag-icon { display: inline-block; width: 20px; height: 14px; border-radius: 2px; }
.flag-en { background: linear-gradient(to bottom, #00247d 50%, #cf142b 50%); }
.flag-cn { background: linear-gradient(to bottom, #de2910 50%, #ffde00 50%); }

/* 涓讳綋锛氬乏渚у垪琛?+ 鍙充晶鍦板浘 */
.map-body {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
}

/* ===== PC绔細宸︿晶闈㈡澘 ===== */
.left-panel {
  width: 420px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  z-index: 10;
}

.filter-section {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafbfc;
}
.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.filter-row:last-child { margin-bottom: 0; }

.filter-select {
  flex: 1;
  padding: 7px 8px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 13px;
  color: #333;
  background: white;
  outline: none;
  min-width: 0;
}
.filter-select:focus { border-color: #667eea; }
.filter-select:disabled { opacity: 0.5; }

.filter-keyword-wrap {
  flex: 1.5;
  position: relative;
}
.filter-keyword {
  width: 100%;
  padding: 7px 30px 7px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}
.filter-keyword:focus { border-color: #667eea; }
.filter-keyword-icon {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
  font-size: 12px;
}

.filter-reset-btn {
  width: 34px; height: 34px; border-radius: 6px;
  border: 1px solid #e0e0e0; background: white; color: #666;
  cursor: pointer; font-size: 12px; flex-shrink: 0; transition: all 0.2s;
  display: flex; align-items: center; justify-content: center;
}
.filter-reset-btn:hover { border-color: #667eea; color: #667eea; }

.list-header {
  padding: 10px 16px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
  color: #666;
}
.list-header b { color: #333; }

/* 鎴挎簮鍒楄〃 */
.property-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.property-list::-webkit-scrollbar { width: 4px; }
.property-list::-webkit-scrollbar-thumb { background: #ddd; border-radius: 4px; }

.property-card {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.15s;
}
.property-card:hover { background: #f8f9ff; }
.property-card.active { background: #eef1ff; border-left: 3px solid #667eea; }

.card-img-wrap {
  width: 120px;
  height: 90px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}
.card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.card-tag {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(0,0,0,0.6);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
}

.card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-meta {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 3px;
}
.card-community {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 2px;
}
.card-community i { color: #667eea; margin-right: 3px; font-size: 10px; }
.card-metro {
  font-size: 11px;
  color: #94a3b8;
  margin: 0 0 4px;
}
.card-metro i { color: #667eea; margin-right: 3px; }

.card-price {
  margin-top: auto;
}
.price-value {
  font-size: 18px;
  font-weight: 700;
  color: #e74c3c;
}
.price-unit {
  font-size: 12px;
  color: #999;
  margin-left: 2px;
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #94a3b8;
}
.no-results i { font-size: 36px; margin-bottom: 12px; }

/* ===== 鍦板浘鍖哄煙 ===== */
.map-area {
  flex: 1;
  position: relative;
  min-height: 0;
  overflow: hidden;
}
.map-container { width: 100%; height: 100%; min-height: 300px; }
.map-placeholder {
  position: absolute; inset: 0; z-index: 5;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: #94a3b8; background: #f0f0f0;
}
.map-placeholder p { margin-top: 12px; font-size: 14px; }

.map-count-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(102,126,234,0.9);
  color: white;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.map-count-badge i { margin-right: 4px; }

/* ===== 绉诲姩绔瓫閫夋爮 ===== */
.mobile-filter-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(10px);
  padding: 8px 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.mobile-filter-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.mobile-filter-scroll::-webkit-scrollbar { display: none; }

.m-filter-select {
  padding: 6px 8px;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  font-size: 12px;
  color: #333;
  background: white;
  outline: none;
  white-space: nowrap;
  flex-shrink: 0;
}
.m-filter-select:focus { border-color: #667eea; }

.m-filter-reset {
  width: 30px; height: 30px;
  border-radius: 50%;
  border: 1px solid #e0e0e0;
  background: white;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 12px;
}

/* ===== 绉诲姩绔簳閮ㄥ脊鍑洪潰鏉?===== */
.mobile-bottom-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 30;
  background: white;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.12);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 60vh;
  display: flex;
  flex-direction: column;
}
.mobile-bottom-panel.collapsed {
  transform: translateY(calc(100% - 50px));
}
.mobile-bottom-panel.expanded {
  transform: translateY(0);
}

.panel-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 10px 16px;
  cursor: pointer;
  flex-shrink: 0;
}
.handle-bar {
  width: 36px;
  height: 4px;
  background: #ddd;
  border-radius: 2px;
  margin-bottom: 6px;
}
.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
}

/* 绉诲姩绔鎯呭崱鐗?*/
.mobile-detail-card {
  position: relative;
}
.detail-close {
  position: absolute;
  top: 0;
  right: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #666;
  z-index: 5;
}
.detail-body {
  display: flex;
  gap: 12px;
}
.detail-img {
  width: 120px;
  height: 90px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}
.detail-info {
  flex: 1;
  min-width: 0;
}
.detail-info h5 {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px;
}
.detail-meta {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 3px;
}
.detail-location {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 6px;
}
.detail-location i { color: #667eea; margin-right: 3px; }
.detail-price {
  margin-bottom: 8px;
}
.detail-price .price-val {
  font-size: 20px;
  font-weight: 700;
  color: #e74c3c;
}
.detail-price .price-unit {
  font-size: 12px;
  color: #999;
}
.detail-view-btn {
  display: inline-block;
  padding: 8px 20px;
  background: #667eea;
  color: white;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s;
}
.detail-view-btn:hover { background: #5a6fd6; }

/* 绉诲姩绔埧婧愬垪琛?*/
.mobile-property-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mobile-card {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}
.mobile-card:active { background: #eef1ff; }
.mobile-card-img {
  width: 100px;
  height: 75px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}
.mobile-card-info {
  flex: 1;
  min-width: 0;
}
.mobile-card-info h6 {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mobile-card-info p {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 4px;
}
.mobile-card-price {
  font-size: 16px;
  font-weight: 700;
  color: #e74c3c;
}

/* 搴曢儴瀵艰埅 */
.mobile-bottom-nav { display: none; }

/* ===== PC绔?===== */
@media (min-width: 768px) {
  .map-search-page {
    height: 100vh;
    margin: 0;
  }
  .map-area--mobile { display: none; }
  .mobile-filter-bar { display: none; }
  .mobile-bottom-panel { display: none; }
}

/* ===== 绉诲姩绔?===== */
@media (max-width: 767px) {
  .map-search-page {
    height: calc(100vh - 56px);
    margin: 0 0 -60px 0;
  }
  .nav-container { height: 48px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .navbar-menu { gap: 6px; flex-wrap: nowrap; }
  .nav-item { padding: 6px 10px; font-size: 12px; white-space: nowrap; flex-shrink: 0; }
  .nav-item i { font-size: 14px; }

  .left-panel { display: none !important; }

  .map-body {
    flex-direction: column;
  }

  .map-area {
    flex: 1;
    padding-top: 46px;
  }

  .mobile-bottom-nav {
    display: flex; position: fixed; bottom: 0; left: 0; right: 0;
    background: rgba(255,255,255,0.98);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 -2px 12px rgba(0,0,0,0.1);
    z-index: 1000;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
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

  .mobile-bottom-nav--guest {
    padding: 10px 20px; justify-content: center; align-items: center;
  }
  .mobile-bottom-nav--guest a {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-decoration: none;
    color: #64748b; font-size: 10px; padding: 4px 12px;
    transition: all 0.3s; border-radius: 8px;
  }
  .mobile-bottom-nav--guest a i { font-size: 18px; margin-bottom: 3px; }
  .mobile-bottom-nav--guest a.home-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white; border-radius: 12px; padding: 10px 24px;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
  }
}
</style>

<style>
/* 鍦板浘鏍囪姘旀场锛堥潪scoped锛岄珮寰峰湴鍥惧姩鎬丏OM锛?*/
.map-marker-bubble {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 2px 10px rgba(102,126,234,0.45);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  border: 2px solid rgba(255,255,255,0.9);
}
.map-marker-bubble:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 16px rgba(102,126,234,0.6);
}
.map-marker-bubble--cluster {
  min-width: 36px;
  height: 36px;
  padding: 0 8px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2f80ed, #27ae60);
  box-shadow: 0 4px 14px rgba(47,128,237,0.35);
}

/* 淇℃伅绐楀彛鍗＄墖 */
.map-info-card {
  min-width: 250px; max-width: 320px; background: white;
  border-radius: 12px; overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}
.info-card-body {
  display: flex; gap: 10px; padding: 12px;
  align-items: flex-start;
}
.info-card-img {
  width: 80px; height: 60px; object-fit: cover;
  border-radius: 8px; flex-shrink: 0;
}
.info-card-content { flex: 1; min-width: 0; }
.info-card-content h6 {
  margin: 0 0 4px; font-size: 14px; font-weight: 600;
  color: #1e293b; line-height: 1.3; word-break: break-word;
}
.info-card-price {
  margin: 0 0 2px; font-size: 15px; color: #e74c3c; font-weight: 700;
}
.info-card-community {
  margin: 0; font-size: 11px; color: #64748b;
}
.info-card-metro {
  margin: 2px 0 0; font-size: 10px; color: #94a3b8;
}
.info-card-metro i { color: #667eea; margin-right: 3px; }
.info-card-link {
  display: block; text-align: center; padding: 10px;
  background: #667eea; color: white; font-size: 13px;
  font-weight: 600; text-decoration: none; transition: background 0.2s;
}
.info-card-link:hover { background: #5a6fd6; }
.map-info-card--cluster {
  min-width: 320px;
  max-width: 380px;
}
.map-info-cluster-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid #eef2f7;
}
.map-info-cluster-head strong {
  font-size: 15px;
  color: #1e293b;
}
.map-info-cluster-head span {
  font-size: 12px;
  color: #667eea;
  font-weight: 700;
}
.map-info-list {
  max-height: 360px;
  overflow-y: auto;
}
.map-info-list-item {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid #f1f5f9;
}
.map-info-list-item:hover {
  background: #f8f9ff;
}
.map-info-list-text {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.map-info-list-text strong {
  font-size: 13px;
  color: #1e293b;
  line-height: 1.3;
}
.map-info-list-text em {
  color: #e74c3c;
  font-size: 13px;
  font-style: normal;
  font-weight: 700;
}
.map-info-list-text small {
  color: #64748b;
  font-size: 11px;
}
.map-info-more {
  padding: 8px 12px 10px;
  color: #667eea;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

/* 闅愯棌楂樺痉榛樿鍏抽棴鎸夐挳 */
.amap-info-close { display: none !important; }
</style>

