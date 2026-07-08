<template>
  <view class="detail-page" v-if="hotel">
    <!-- 顶部图片轮播 -->
    <swiper class="image-swiper" indicator-dots indicator-color="rgba(255,255,255,0.5)" indicator-active-color="#fff">
      <swiper-item v-for="(img, i) in hotel.images" :key="i">
        <image :src="img" mode="aspectFill" class="swiper-img" />
      </swiper-item>
    </swiper>

    <!-- 返回按钮 -->
    <view class="back-btn" @click="goBack">
      <text class="back-icon">←</text>
    </view>

    <!-- 收藏按钮 -->
    <view class="detail-fav-btn" @click="toggleFav">
      <text class="fav-icon">{{ isFav ? '❤️' : '🤍' }}</text>
    </view>

    <!-- 酒店基本信息 -->
    <view class="detail-header">
      <view class="name-row flex-between">
        <text class="hotel-name">{{ hotel.name }}</text>
        <text class="star-level">{{ '★'.repeat(hotel.starLevel) }}</text>
      </view>
      <view class="addr-row flex-row">
        <text class="addr-icon">📍</text>
        <text class="addr-text">{{ hotel.address }}</text>
      </view>
      <view v-if="hotel.distance != null" class="dist-row flex-row">
        <text class="dist-icon">📏</text>
        <text class="dist-text">距搜索点 {{ formatDistance(hotel.distance) }}</text>
      </view>

      <!-- 设施标签 -->
      <view class="amenities-row" v-if="hotel.amenities">
        <text v-for="a in hotel.amenities" :key="a" class="amenity-tag">{{ a }}</text>
      </view>
    </view>

    <!-- 价格对比面板 -->
    <PriceCompare
      :platforms="hotel.platforms"
      :priceHistory="mockPriceHistory"
      :isLoading="priceLoading"
      :dataSource="dataSource"
      :updatedAt="updatedAt"
    />

    <!-- 快捷操作 -->
    <view class="quick-actions flex-row">
      <view class="action-item" @click="addToCompare">
        <text class="action-icon">⚖️</text>
        <text class="action-label">加入对比</text>
      </view>
      <view class="action-item" @click="shareHotel">
        <text class="action-icon">📤</text>
        <text class="action-label">分享</text>
      </view>
    </view>

    <!-- 底部分享按钮 -->
    <view class="bottom-safe safe-area-bottom" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useHotelStore } from '@/stores/hotel.js'
import { usePreferenceStore } from '@/stores/preference.js'
import PriceCompare from '@/components/PriceCompare.vue'

const hotelStore = useHotelStore()
const prefStore = usePreferenceStore()

const hotel = ref(null)
const mockPriceHistory = ref([])

// 价格刷新状态
const priceLoading = ref(false)
const dataSource = ref('')
const updatedAt = ref('')

const isFav = computed(() => {
  return hotel.value && hotelStore.favorites.includes(hotel.value.id)
})

onLoad(async (options) => {
  if (options.id) {
    hotel.value = hotelStore.getHotelById(options.id)
    generatePriceHistory()

    // 异步加载实时价格
    if (hotel.value) {
      priceLoading.value = true
      try {
        const result = await hotelStore.refreshPrices(hotel.value.id)
        const source = hotelStore.getPriceSource(hotel.value.id)
        dataSource.value = source.source
        updatedAt.value = source.updatedAt
      } catch (err) {
        console.error('价格刷新失败:', err)
      } finally {
        priceLoading.value = false
      }
    }
  }
})

function generatePriceHistory() {
  if (!hotel.value) return
  const basePrice = hotel.value.minPrice
  const days = ['7/1', '7/2', '7/3', '7/4', '7/5', '7/6', '7/7']
  mockPriceHistory.value = days.map((date, i) => {
    const variance = (Math.sin(i * 1.5) * 0.1 + Math.random() * 0.05)
    return {
      date,
      price: Math.round(basePrice * (1 + variance))
    }
  })
}

function formatDistance(km) {
  if (!km && km !== 0) return ''
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km.toFixed(1)}km`
}

function goBack() {
  uni.navigateBack()
}

function toggleFav() {
  if (hotel.value) {
    hotelStore.toggleFavorite(hotel.value.id)
  }
}

function addToCompare() {
  if (hotel.value) {
    prefStore.addToCompare(hotel.value.id)
  }
}

function shareHotel() {
  // 微信分享
  uni.showToast({ title: '分享功能开发中', icon: 'none' })
}
</script>

<style lang="scss" scoped>
.detail-page {
  background: #f5f5f5;
  min-height: 100vh;
  padding-bottom: 40rpx;
}

.image-swiper {
  width: 100%;
  height: 500rpx;
  .swiper-img {
    width: 100%;
    height: 100%;
    background: #e0e0e0;
  }
}

.back-btn {
  position: fixed;
  top: 60rpx;
  left: 24rpx;
  z-index: 100;
  width: 64rpx;
  height: 64rpx;
  background: rgba(0,0,0,0.4);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  .back-icon { font-size: 32rpx; color: #fff; font-weight: 700; }
}

.detail-fav-btn {
  position: fixed;
  top: 60rpx;
  right: 24rpx;
  z-index: 100;
  width: 64rpx;
  height: 64rpx;
  background: rgba(255,255,255,0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  .fav-icon { font-size: 28rpx; }
}

.detail-header {
  background: #fff;
  padding: 24rpx;
  margin: -24rpx 0 0;
  border-radius: 24rpx 24rpx 0 0;
  position: relative;

  .name-row {
    margin-bottom: 12rpx;
    .hotel-name { font-size: 36rpx; font-weight: 700; color: #1a1a1a; flex: 1; margin-right: 16rpx; }
    .star-level { font-size: 22rpx; color: #FFB800; white-space: nowrap; }
  }

  .addr-row, .dist-row {
    margin-bottom: 8rpx;
    gap: 8rpx;
    .addr-icon, .dist-icon { font-size: 24rpx; }
    .addr-text, .dist-text { font-size: 26rpx; color: #666; }
  }

  .amenities-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8rpx;
    margin-top: 16rpx;
    .amenity-tag {
      font-size: 22rpx; color: #666;
      background: #F5F5F5; padding: 6rpx 14rpx; border-radius: 6rpx;
    }
  }
}

.quick-actions {
  padding: 24rpx;
  gap: 24rpx;
  .action-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24rpx;
    background: #fff;
    border-radius: 16rpx;
    .action-icon { font-size: 40rpx; margin-bottom: 8rpx; }
    .action-label { font-size: 24rpx; color: #666; }
  }
}

.bottom-safe { height: 40rpx; }
</style>
