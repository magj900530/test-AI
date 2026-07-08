<template>
  <view class="hotel-card" @click="goDetail">
    <!-- 封面图 -->
    <view class="card-cover">
      <image :src="hotel.coverImage" mode="aspectFill" class="cover-img" />
      <view class="star-badge">{{ '★'.repeat(hotel.starLevel) }}</view>
      <!-- 收藏按钮 -->
      <view class="favorite-btn" @click.stop="toggleFav">
        <text :class="['fav-icon', isFav ? 'active' : '']">{{ isFav ? '❤️' : '🤍' }}</text>
      </view>
    </view>

    <!-- 信息区 -->
    <view class="card-body">
      <!-- 酒店名称 & 距离 -->
      <view class="hotel-header">
        <text class="hotel-name text-ellipsis">{{ hotel.name }}</text>
        <text v-if="hotel.distance != null" class="distance-tag">
          {{ formatDistance(hotel.distance) }}
        </text>
      </view>

      <!-- 设施标签 -->
      <view class="amenities-row" v-if="hotel.amenities && hotel.amenities.length">
        <text v-for="item in hotel.amenities.slice(0, 4)" :key="item" class="amenity-tag">{{ item }}</text>
      </view>

      <!-- 价格对比条 -->
      <view class="price-compare-bar">
        <view
          v-for="p in sortedPlatforms.slice(0, 4)"
          :key="p.platform"
          class="platform-price-chip"
          :class="[getPlatformClass(p.platform), { 'clickable': p.jumpUrl }]"
          @click.stop="openPlatform(p)"
        >
          <text class="platform-label">{{ p.platformName }}</text>
          <text class="platform-price">
            ¥{{ p.minPrice != null && p.minPrice > 0 ? p.minPrice : '--' }}
          </text>
          <text v-if="p._pending" class="pending-tag">查询中</text>
          <text v-else-if="p._notFound" class="notfound-tag">未上架</text>
          <text v-else-if="p._source === 'scraped'" class="real-tag">实时</text>
        </view>
      </view>

      <!-- 底部：综合评分 & 最低价 -->
      <view class="card-footer flex-between">
        <view class="rating-info flex-row">
          <text class="score-label">综合评分</text>
          <text class="score-value">{{ hotel.avgRating ? hotel.avgRating.toFixed(1) : '-' }}</text>
        </view>
        <view class="min-price-info">
          <text class="price-label">最低</text>
          <text class="price-value">¥{{ hotel.minPrice != null ? hotel.minPrice : '--' }}</text>
          <text class="price-suffix">起</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { useHotelStore } from '@/stores/hotel.js'

const props = defineProps({
  hotel: { type: Object, required: true }
})

const emit = defineEmits(['favorite'])

const hotelStore = useHotelStore()

const isFav = computed(() => hotelStore.favorites.includes(props.hotel.id))

// 价格从小到大排列（null 排最后）
const sortedPlatforms = computed(() => {
  return [...props.hotel.platforms].sort((a, b) => {
    if (a.minPrice == null && b.minPrice == null) return 0
    if (a.minPrice == null) return 1
    if (b.minPrice == null) return -1
    return a.minPrice - b.minPrice
  })
})

function getPlatformClass(platform) {
  const map = {
    meituan: 'chip-meituan',
    xiecheng: 'chip-xiecheng',
    qunar: 'chip-qunar',
    feizhu: 'chip-feizhu'
  }
  return map[platform] || ''
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km.toFixed(1)}km`
}

function goDetail() {
  uni.navigateTo({
    url: `/pages/detail/detail?id=${props.hotel.id}`
  })
}

function openPlatform(p) {
  if (!p.jumpUrl) return
  // #ifdef MP-WEIXIN
  uni.setClipboardData({
    data: p.jumpUrl,
    success: () => {
      uni.showToast({
        title: `已复制${p.platformName}链接，请在浏览器中打开`,
        icon: 'none',
        duration: 2500
      })
    }
  })
  // #endif
  // #ifdef H5
  window.open(p.jumpUrl, '_blank')
  // #endif
}

function toggleFav() {
  hotelStore.toggleFavorite(props.hotel.id)
  emit('favorite', props.hotel.id)
}
</script>

<style lang="scss" scoped>
.hotel-card {
  background: #fff;
  border-radius: 16rpx;
  margin: 0 24rpx 20rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.card-cover {
  position: relative;
  height: 320rpx;
  .cover-img {
    width: 100%;
    height: 100%;
    background: #e0e0e0;
  }
  .star-badge {
    position: absolute;
    top: 16rpx;
    left: 16rpx;
    background: rgba(0,0,0,0.5);
    color: #FFB800;
    font-size: 22rpx;
    padding: 4rpx 16rpx;
    border-radius: 20rpx;
  }
  .favorite-btn {
    position: absolute;
    top: 16rpx;
    right: 16rpx;
    width: 56rpx;
    height: 56rpx;
    background: rgba(255,255,255,0.9);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    .fav-icon { font-size: 28rpx; }
  }
}

.card-body {
  padding: 20rpx 24rpx 24rpx;
}

.hotel-header {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
  .hotel-name {
    flex: 1;
    font-size: 32rpx;
    font-weight: 600;
    color: #1a1a1a;
    margin-right: 16rpx;
  }
  .distance-tag {
    font-size: 24rpx;
    color: #007AFF;
    background: #E8F4FD;
    padding: 4rpx 12rpx;
    border-radius: 8rpx;
    white-space: nowrap;
  }
}

.amenities-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-bottom: 16rpx;
  .amenity-tag {
    font-size: 22rpx;
    color: #666;
    background: #F5F5F5;
    padding: 4rpx 12rpx;
    border-radius: 6rpx;
  }
}

.price-compare-bar {
  display: flex;
  gap: 8rpx;
  margin-bottom: 20rpx;
  .platform-price-chip {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10rpx 8rpx;
    border-radius: 8rpx;
    background: #f8f8f8;
    position: relative;
    transition: transform 0.1s;
    .platform-label { font-size: 20rpx; color: #999; margin-bottom: 4rpx; }
    .platform-price { font-size: 26rpx; font-weight: 700; }
    .pending-tag {
      font-size: 16rpx; color: #999; background: #f0f0f0;
      padding: 1rpx 8rpx; border-radius: 4rpx; margin-top: 2rpx;
    }
    .notfound-tag {
      font-size: 16rpx; color: #ccc; background: #fafafa;
      padding: 1rpx 8rpx; border-radius: 4rpx; margin-top: 2rpx;
    }
    .real-tag {
      font-size: 16rpx; color: #fff; background: #34C759;
      padding: 1rpx 8rpx; border-radius: 4rpx; margin-top: 2rpx;
    }
    &.clickable {
      cursor: pointer;
      &:active { transform: scale(0.95); opacity: 0.8; }
    }
  }
  .chip-meituan { background: #FFF8E1; .platform-price { color: #FF9800; } }
  .chip-xiecheng { background: #E3F2FD; .platform-price { color: #096DD9; } }
  .chip-qunar { background: #E0F7FA; .platform-price { color: #0088CC; } }
  .chip-feizhu { background: #FFF0EB; .platform-price { color: #FF5000; } }
}

.card-footer {
  padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
  .rating-info {
    .score-label { font-size: 24rpx; color: #999; margin-right: 8rpx; }
    .score-value {
      font-size: 32rpx; font-weight: 700; color: #FF9500;
      background: #FFF8E1; padding: 2rpx 12rpx; border-radius: 8rpx;
    }
  }
  .min-price-info {
    .price-label { font-size: 22rpx; color: #999; }
    .price-value { font-size: 36rpx; font-weight: 700; color: #FF3B30; }
    .price-suffix { font-size: 22rpx; color: #999; }
  }
}
</style>
