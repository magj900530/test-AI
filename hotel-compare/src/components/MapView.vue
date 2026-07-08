<template>
  <view class="map-container" :style="{ height: mapHeight + 'px' }">
    <map
      id="hotel-map"
      class="hotel-map"
      :latitude="center.lat"
      :longitude="center.lng"
      :scale="scale"
      :markers="markers"
      :circles="circles"
      :show-location="true"
      @markertap="onMarkerTap"
      @regionchange="onRegionChange"
    />

    <!-- 地图操作按钮 -->
    <view class="map-actions">
      <!-- 地图选点按钮 -->
      <view class="map-btn" @click="openMapPicker">
        <text class="btn-icon">🔍</text>
      </view>
    </view>

    <!-- 当前位置标签 -->
    <view v-if="address" class="location-label flex-row">
      <text class="loc-icon">📍</text>
      <text class="loc-text text-ellipsis">{{ address }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  center: { type: Object, default: () => ({ lat: 22.547, lng: 114.054 }) },
  address: { type: String, default: '' },
  hotels: { type: Array, default: () => [] },
  radius: { type: Number, default: 5 },
  mapHeight: { type: Number, default: 400 }
})

const emit = defineEmits(['markerTap', 'chooseLocation'])

const scale = ref(14)

// 地图标记点
const markers = computed(() => {
  return props.hotels.map((h, i) => ({
    id: i,
    latitude: h.lat,
    longitude: h.lng,
    title: h.name,
    iconPath: `/static/icons/marker-${h.starLevel || 3}.png`,
    width: 32,
    height: 32,
    callout: {
      content: h.minPrice != null ? `${h.name}\n最低¥${h.minPrice}` : h.name,
      fontSize: 12,
      borderRadius: 8,
      padding: 8,
      display: 'BYCLICK'
    },
    label: {
      content: h.minPrice != null ? `¥${h.minPrice}` : h.name.substring(0, 4),
      fontSize: 11,
      color: '#FF3B30',
      anchorX: -16,
      anchorY: -36,
      bgColor: '#ffffff',
      borderRadius: 8,
      padding: 4
    }
  }))
})

// 范围圈
const circles = computed(() => [{
  latitude: props.center.lat,
  longitude: props.center.lng,
  radius: props.radius * 1000,
  fillColor: 'rgba(0, 122, 255, 0.06)',
  strokeColor: 'rgba(0, 122, 255, 0.3)',
  strokeWidth: 2
}])

function onMarkerTap(e) {
  const hotel = props.hotels[e.detail.markerId]
  if (hotel) {
    emit('markerTap', hotel)
  }
}

function onRegionChange(e) {
  if (e.type === 'end' && e.detail.scale) {
    scale.value = e.detail.scale
  }
}

function openMapPicker() {
  emit('chooseLocation')
}
</script>

<style lang="scss" scoped>
.map-container {
  position: relative;
  width: 100%;
}

.hotel-map {
  width: 100%;
  height: 100%;
}

.map-actions {
  position: absolute;
  right: 16rpx;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.map-btn {
  width: 72rpx;
  height: 72rpx;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.15);
  .btn-icon { font-size: 32rpx; }
}

.location-label {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  right: 16rpx;
  background: rgba(255,255,255,0.95);
  padding: 12rpx 20rpx;
  border-radius: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.1);
  .loc-icon { font-size: 28rpx; margin-right: 8rpx; }
  .loc-text { font-size: 26rpx; color: #333; flex: 1; }
}
</style>
