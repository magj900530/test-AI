<template>
  <view class="compare-panel" v-if="compareHotels.length">
    <view class="compare-header flex-between">
      <text class="compare-title">⚖️ 酒店对比 ({{ compareHotels.length }}/4)</text>
      <text class="clear-btn" @click="$emit('clear')">清空</text>
    </view>

    <scroll-view scroll-x class="compare-table">
      <view class="table-row table-header">
        <view class="row-label">项目</view>
        <view
          v-for="h in compareHotels"
          :key="h.id"
          class="table-cell header-cell"
        >
          <image :src="h.coverImage" mode="aspectFill" class="cell-cover" />
          <text class="cell-name text-ellipsis">{{ h.name }}</text>
        </view>
      </view>

      <view class="table-row">
        <view class="row-label">星级</view>
        <view v-for="h in compareHotels" :key="h.id" class="table-cell">
          <text class="cell-star">{{ '★'.repeat(h.starLevel) }}</text>
        </view>
      </view>

      <view class="table-row">
        <view class="row-label">距离</view>
        <view v-for="h in compareHotels" :key="h.id" class="table-cell">
          <text class="cell-value">{{ formatDist(h.distance) }}</text>
        </view>
      </view>

      <view class="table-row" v-for="platform in platforms" :key="platform">
        <view class="row-label">
          <text class="platform-label">{{ getPlatformName(platform) }}</text>
        </view>
        <view
          v-for="h in compareHotels"
          :key="h.id"
          class="table-cell"
          :class="getPriceClass(h, platform)"
        >
          <text class="cell-price">{{ getPrice(h, platform) }}</text>
          <text class="cell-rating">{{ getRating(h, platform) }}</text>
        </view>
      </view>

      <view class="table-row">
        <view class="row-label">设施</view>
        <view v-for="h in compareHotels" :key="h.id" class="table-cell">
          <text class="cell-amenities">{{ (h.amenities || []).slice(0, 4).join(' ') }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  hotels: { type: Array, default: () => [] },
  allHotels: { type: Array, default: () => [] }
})

defineEmits(['clear'])

const platforms = ['meituan', 'xiecheng', 'qunar', 'feizhu']

const compareHotels = computed(() => {
  return props.allHotels.filter(h => props.hotels.includes(h.id))
})

function getPlatformName(p) {
  const map = { meituan: '美团', xiecheng: '携程', qunar: '去哪儿', feizhu: '飞猪' }
  return map[p] || p
}

function getPrice(hotel, platform) {
  const p = hotel.platforms.find(x => x.platform === platform)
  return p ? `¥${p.minPrice}` : '-'
}

function getRating(hotel, platform) {
  const p = hotel.platforms.find(x => x.platform === platform)
  return p ? `${p.rating}分` : ''
}

function getPriceClass(hotel, platform) {
  const allPrices = compareHotels.value
    .map(h => h.platforms.find(x => x.platform === platform))
    .filter(Boolean)
    .map(p => p.minPrice)

  const current = hotel.platforms.find(x => x.platform === platform)
  if (!current || allPrices.length < 2) return ''

  const minPrice = Math.min(...allPrices)
  return current.minPrice === minPrice ? 'best-price' : ''
}

function formatDist(km) {
  if (!km && km !== 0) return '-'
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km.toFixed(1)}km`
}
</script>

<style lang="scss" scoped>
.compare-panel {
  background: #fff;
  margin: 20rpx 24rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}

.compare-header {
  margin-bottom: 16rpx;
  .compare-title { font-size: 30rpx; font-weight: 600; }
  .clear-btn { font-size: 26rpx; color: #FF3B30; }
}

.compare-table {
  white-space: nowrap;
}

.table-row {
  display: flex;
  border-bottom: 1rpx solid #f5f5f5;
}

.table-header {
  border-bottom: 2rpx solid #e5e5e5;
}

.row-label {
  width: 120rpx;
  min-width: 120rpx;
  padding: 16rpx 12rpx;
  font-size: 24rpx;
  color: #999;
  display: flex;
  align-items: center;
}

.table-cell {
  flex: 1;
  min-width: 200rpx;
  padding: 16rpx 8rpx;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.header-cell {
  .cell-cover {
    width: 160rpx;
    height: 120rpx;
    border-radius: 8rpx;
    background: #e0e0e0;
    margin-bottom: 8rpx;
  }
  .cell-name {
    font-size: 24rpx;
    color: #333;
    font-weight: 600;
    max-width: 180rpx;
  }
}

.cell-star { color: #FFB800; font-size: 22rpx; }
.cell-value { font-size: 26rpx; color: #333; font-weight: 600; }
.cell-price { font-size: 28rpx; color: #FF3B30; font-weight: 700; }
.cell-rating { font-size: 22rpx; color: #FF9500; margin-top: 4rpx; }
.cell-amenities {
  font-size: 20rpx; color: #666;
  white-space: normal; word-break: break-all;
  line-height: 1.4;
}

.best-price {
  background: #FFF8F0;
  border-radius: 8rpx;
  .cell-price { color: #34C759; }
}

.platform-label { font-size: 24rpx; font-weight: 600; color: #333; }
</style>
