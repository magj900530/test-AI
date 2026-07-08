<template>
  <view class="search-location">
    <view class="search-box">
      <view class="search-input-wrap">
        <text class="search-icon">🔍</text>
        <input
          class="search-input"
          v-model="keyword"
          placeholder="搜索城市或商圈名称"
          placeholder-style="color:#999"
          @confirm="handleSearch"
          focus
        />
        <text v-if="keyword" class="clear-btn" @click="keyword = ''">✕</text>
      </view>
      <text class="cancel-btn" @click="$emit('close')">取消</text>
    </view>

    <!-- 搜索结果 -->
    <view class="search-results" v-if="results.length">
      <view class="result-hint" v-if="results.length > 0 && keyword">
        <text>搜索 "{{ keyword }}" 的结果，选择一个地点即可搜索周边酒店</text>
      </view>
      <view
        v-for="(item, i) in results"
        :key="i"
        class="result-item flex-row"
        @click="handleSelect(item)"
      >
        <view class="result-icon">{{ item.icon || '📍' }}</view>
        <view class="result-info">
          <text class="result-name">{{ item.name }}</text>
          <text class="result-addr text-ellipsis">{{ item.address }}</text>
        </view>
      </view>
    </view>

    <!-- 空结果提示 -->
    <view class="empty-hint" v-if="searched && !results.length">
      <text class="empty-text">未找到相关地点</text>
      <text class="empty-sub">试试其他关键词，或从下方常用城市中选择</text>
    </view>

    <!-- 常用地点快捷选择 -->
    <view class="quick-places" v-if="!searched || !results.length">
      <view class="section-title">{{ !searched ? '常用城市' : '试试这些城市' }}</view>
      <view class="city-grid">
        <view
          v-for="city in quickCities"
          :key="city.name"
          class="city-item"
          @click="handleSelect(city)"
        >
          <text class="city-icon">{{ city.icon }}</text>
          <text class="city-name">{{ city.name }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { searchPOI } from '@/utils/amap.js'

const emit = defineEmits(['select', 'close'])

const keyword = ref('')
const results = ref([])
const searched = ref(false)
const isSearching = ref(false)

const quickCities = [
  { name: '深圳·福田', lat: 22.547, lng: 114.054, address: '深圳市福田区', icon: '🏙️' },
  { name: '深圳·南山', lat: 22.533, lng: 113.93, address: '深圳市南山区', icon: '🏙️' },
  { name: '北京·国贸', lat: 39.9087, lng: 116.4605, address: '北京市朝阳区国贸', icon: '🏛️' },
  { name: '北京·西单', lat: 39.9133, lng: 116.3736, address: '北京市西城区西单', icon: '🏛️' },
  { name: '上海·陆家嘴', lat: 31.2398, lng: 121.4988, address: '上海市浦东新区陆家嘴', icon: '🌆' },
  { name: '上海·静安寺', lat: 31.2253, lng: 121.4467, address: '上海市静安区静安寺', icon: '🌆' },
  { name: '广州·天河', lat: 23.1291, lng: 113.327, address: '广州市天河区', icon: '🏙️' },
  { name: '广州·珠江新城', lat: 23.1196, lng: 113.3215, address: '广州市天河区珠江新城', icon: '🏙️' },
  { name: '杭州·西湖', lat: 30.259, lng: 120.146, address: '杭州市西湖区', icon: '🏞️' },
  { name: '成都·春熙路', lat: 30.6586, lng: 104.0815, address: '成都市锦江区春熙路', icon: '🐼' },
  { name: '重庆·解放碑', lat: 29.5628, lng: 106.5753, address: '重庆市渝中区解放碑', icon: '🏙️' },
  { name: '武汉·光谷', lat: 30.5065, lng: 114.4192, address: '武汉市洪山区光谷', icon: '🏙️' },
  { name: '南京·新街口', lat: 32.0415, lng: 118.7838, address: '南京市玄武区新街口', icon: '🏙️' },
  { name: '西安·钟楼', lat: 34.2608, lng: 108.9422, address: '西安市碑林区钟楼', icon: '🏯' },
  { name: '长沙·五一广场', lat: 28.1998, lng: 112.974, address: '长沙市天心区五一广场', icon: '🏙️' },
  { name: '厦门·鼓浪屿', lat: 24.4479, lng: 118.0691, address: '厦门市思明区鼓浪屿', icon: '🏝️' }
]

async function handleSearch() {
  if (!keyword.value.trim()) return
  searched.value = true
  isSearching.value = true

  let found = false
  try {
    // 优先调用高德 POI 搜索 API
    const pois = await searchPOI(keyword.value.trim())
    if (pois.length > 0) {
      results.value = pois.map(p => ({
        ...p,
        icon: '📍'
      }))
      found = true
      return
    }
    // pois.length === 0 可能是 API Key 错误或真无结果
  } catch (e) {
    console.error('[搜索] 高德搜索异常:', e.message)
  } finally {
    isSearching.value = false
  }

  if (found) return

  // 降级：本地匹配快捷城市（高德 API 不可用时使用）
  const kw = keyword.value.toLowerCase().trim()
  const matched = quickCities.filter(c =>
    c.name.toLowerCase().includes(kw) || c.address.toLowerCase().includes(kw)
  )
  if (matched.length > 0) {
    results.value = matched
  } else {
    // 模糊匹配：按首字或拼音首字母
    const fuzzy = quickCities.filter(c => {
      const parts = c.name.split('·')
      return parts.some(p => p.startsWith(keyword.value.charAt(0)))
    })
    results.value = fuzzy.length > 0 ? fuzzy : quickCities.slice(0, 8)
  }
}

function handleSelect(item) {
  emit('select', {
    name: item.name,
    address: item.address,
    lat: item.lat,
    lng: item.lng
  })
}
</script>

<style lang="scss" scoped>
.search-location {
  background: #fff;
  min-height: 100vh;
}

.search-box {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  gap: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: #F5F5F5;
  border-radius: 24rpx;
  padding: 12rpx 20rpx;
  .search-icon { font-size: 28rpx; margin-right: 12rpx; }
  .search-input { flex: 1; font-size: 28rpx; }
  .clear-btn { font-size: 28rpx; color: #999; padding: 4rpx; }
}

.cancel-btn { font-size: 28rpx; color: #007AFF; white-space: nowrap; }

.search-results {
  padding: 16rpx 0;
  .result-hint {
    padding: 12rpx 24rpx;
    font-size: 24rpx;
    color: #999;
    border-bottom: 1rpx solid #f0f0f0;
  }
  .result-item {
    padding: 24rpx;
    border-bottom: 1rpx solid #f5f5f5;
    .result-icon { font-size: 32rpx; margin-right: 16rpx; }
    .result-info {
      flex: 1;
      .result-name { font-size: 28rpx; color: #333; display: block; margin-bottom: 4rpx; }
      .result-addr { font-size: 24rpx; color: #999; display: block; }
    }
  }
}

.empty-hint {
  padding: 80rpx 0;
  text-align: center;
  .empty-text { font-size: 28rpx; color: #999; display: block; }
  .empty-sub { font-size: 24rpx; color: #ccc; display: block; margin-top: 8rpx; }
}

.quick-places {
  padding: 24rpx;
  .section-title { font-size: 28rpx; color: #999; margin-bottom: 20rpx; }
}

.city-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  .city-item {
    width: calc(50% - 8rpx);
    display: flex;
    align-items: center;
    padding: 24rpx 20rpx;
    background: #F8F9FA;
    border-radius: 12rpx;
    .city-icon { font-size: 36rpx; margin-right: 12rpx; }
    .city-name { font-size: 26rpx; color: #333; }
  }
}
</style>
