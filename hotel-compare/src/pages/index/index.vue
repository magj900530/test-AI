<template>
  <view class="home-page">
    <!-- 地图区域（上半屏） -->
    <MapView
      :center="mapCenter"
      :address="locStore.currentAddress || '正在定位...'"
      :hotels="hotelStore.filteredHotels"
      :radius="locStore.radius"
      :mapHeight="mapHeight"
      @markerTap="onMarkerTap"
      @chooseLocation="handleChooseLocation"
    />

    <!-- 拖拽手柄 -->
    <view class="drag-handle" @touchmove="onDragMove" @touchend="onDragEnd">
      <view class="handle-bar" />
    </view>

    <!-- 列表区域（下半屏） -->
    <view class="list-section" :style="{ height: `calc(100vh - ${mapHeight}px - 60rpx)` }">
      <!-- 筛选栏 -->
      <FilterBar
        :currentSort="hotelStore.sortType"
        :radius="locStore.radius"
        @sortChange="onSortChange"
        @radiusChange="onRadiusChange"
      />

      <!-- 酒店数量提示 -->
      <view class="result-count">
        <text class="count-text">
          找到 <text class="count-num">{{ hotelStore.filteredHotels.length }}</text> 家酒店
          <text v-if="locStore.radius"> · {{ locStore.radius }}km 内</text>
        </text>
      </view>

      <!-- 酒店列表 -->
      <scroll-view
        class="hotel-list"
        scroll-y
        :style="{ height: scrollViewHeight }"
        :refresher-enabled="true"
        :refresher-triggered="refreshing"
        @refresherrefresh="onRefresh"
        @scrolltolower="onLoadMore"
      >
        <!-- 加载中 -->
        <view v-if="hotelStore.isLoading" class="loading-state flex-center">
          <text class="loading-text">正在搜索周边酒店...</text>
        </view>

        <!-- 空状态 -->
        <view v-else-if="!hotelStore.filteredHotels.length" class="empty-state flex-col">
          <text class="empty-icon">{{ hotelStore.isLoading ? '🔍' : '🏨' }}</text>
          <text class="empty-title">{{ hotelStore.isLoading ? '正在搜索周边酒店...' : '暂无酒店' }}</text>
          <text class="empty-desc">{{ hotelStore.isLoading ? '正在通过高德地图查询真实酒店数据' : (locStore.hasLocation ? '当前范围内未找到酒店，试试扩大搜索半径' : '请先定位或选择地点') }}</text>
          <view v-if="!locStore.hasLocation" class="locate-btn" @click="handleLocate">
            <text>📍 获取当前位置</text>
          </view>
          <view v-else class="radius-btns flex-row">
            <view v-for="r in [5, 10, 20]" :key="r" class="radius-btn" @click="onRadiusChange(r)">
              <text>{{ r }}km</text>
            </view>
          </view>
        </view>

        <!-- 酒店卡片 -->
        <HotelCard
          v-for="hotel in hotelStore.sortedHotels"
          :key="hotel.id"
          :hotel="hotel"
          @favorite="onFavChange"
        />

        <!-- 底部安全区 -->
        <view class="safe-area-bottom" style="height: 40rpx;" />
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useLocationStore } from '@/stores/location.js'
import { useHotelStore } from '@/stores/hotel.js'
import { usePreferenceStore } from '@/stores/preference.js'
import MapView from '@/components/MapView.vue'
import FilterBar from '@/components/FilterBar.vue'
import HotelCard from '@/components/HotelCard.vue'
import { chooseLocation } from '@/utils/amap.js'

const locStore = useLocationStore()
const hotelStore = useHotelStore()
const prefStore = usePreferenceStore()

const refreshing = ref(false)
const mapHeight = ref(400) // 默认地图高度 px

// scroll-view 显式高度（微信小程序 flex:1 在 scroll-view 上不生效）
const scrollViewHeight = computed(() => {
  // list-section = 100vh - mapHeight - 60rpx(drag-handle)
  // scroll-view = list-section - FilterBar(~72rpx) - result-count(~48rpx)
  return `calc(100vh - ${mapHeight.value}px - 180rpx)`
})

// 地图中心点
const mapCenter = computed(() => {
  return locStore.searchCenter || { lat: 22.547, lng: 114.054 }
})

onMounted(async () => {
  // 恢复偏好
  hotelStore.restoreFavorites()
  prefStore.restore()

  // 自动定位
  await handleLocate()
})

// ====== 定位 ======
async function handleLocate() {
  const pos = await locStore.locate()
  if (pos) {
    // 搜索周边真实酒店（高德 API）
    await hotelStore.searchNearbyHotels(pos.lat, pos.lng, locStore.radius)
  } else {
    // 定位失败，降级到本地数据
    hotelStore.loadHotels()
    hotelStore.filterByLocation()
  }
}

// ====== 地图选点 ======
async function handleChooseLocation() {
  try {
    const point = await chooseLocation()
    locStore.setSelectedPoint(point)
    uni.showToast({ title: `已选择: ${point.name}`, icon: 'success', duration: 1500 })
    await hotelStore.searchNearbyHotels(point.lat, point.lng, locStore.radius)
  } catch (e) {
    // 用户取消选点，不做处理
    console.log('[选点] 用户取消或失败:', e?.message || e)
  }
}

// ====== 排序变化 ======
function onSortChange(type) {
  hotelStore.setSortType(type)
  prefStore.setDefaultSort(type)
}

// ====== 半径变化 ======
function onRadiusChange(km) {
  locStore.setRadius(km)
  prefStore.setDefaultRadius(km)
  // 用新半径重新搜索周边酒店
  const center = locStore.searchCenter
  if (center) {
    hotelStore.searchNearbyHotels(center.lat, center.lng, km)
  }
}

// ====== 地图标记点击 ======
function onMarkerTap(hotel) {
  uni.navigateTo({ url: `/pages/detail/detail?id=${hotel.id}` })
}

// ====== 拖拽地图与列表分界 ======
let dragStartY = 0
function onDragMove(e) {
  const dy = e.touches[0].clientY - dragStartY
  mapHeight.value = Math.max(200, Math.min(600, mapHeight.value + dy))
  dragStartY = e.touches[0].clientY
}

function onDragEnd() {
  // 吸附到 200, 350, 500
  if (mapHeight.value < 275) mapHeight.value = 200
  else if (mapHeight.value < 425) mapHeight.value = 350
  else mapHeight.value = 500
}

// ====== 下拉刷新 ======
async function onRefresh() {
  refreshing.value = true
  await handleLocate()
  refreshing.value = false
}

// ====== 加载更多 ======
function onLoadMore() {
  // MVP 阶段数据已全部加载，预留分页
}

function onFavChange() {
  // 收藏变化回调
}
</script>

<style lang="scss" scoped>
.home-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
  overflow: hidden;
}

.drag-handle {
  display: flex;
  justify-content: center;
  padding: 12rpx 0;
  background: #fff;
  .handle-bar {
    width: 60rpx;
    height: 6rpx;
    background: #ddd;
    border-radius: 3rpx;
  }
}

.list-section {
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.result-count {
  padding: 12rpx 24rpx;
  .count-text { font-size: 24rpx; color: #999; }
  .count-num { color: #007AFF; font-weight: 600; }
}

.hotel-list {
  /* height 通过 inline style 动态计算，微信 scroll-view 需要显式高度 */
}

.loading-state {
  padding: 80rpx 0;
  .loading-text { font-size: 28rpx; color: #999; }
}

.empty-state {
  padding: 80rpx 24rpx;
  align-items: center;
  text-align: center;
  .empty-icon { font-size: 80rpx; margin-bottom: 24rpx; }
  .empty-title { font-size: 32rpx; color: #333; margin-bottom: 12rpx; }
  .empty-desc { font-size: 26rpx; color: #999; margin-bottom: 32rpx; }
  .locate-btn {
    background: #007AFF; color: #fff; padding: 16rpx 48rpx;
    border-radius: 40rpx; font-size: 28rpx;
  }
  .radius-btns { gap: 16rpx; }
  .radius-btn {
    background: #E8F4FD; padding: 12rpx 32rpx;
    border-radius: 24rpx; font-size: 28rpx; color: #007AFF;
  }
}
</style>
