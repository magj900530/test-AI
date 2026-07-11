<template>
  <view class="recommend-card" @click="goDetail">
    <!-- 排名徽章 -->
    <view class="rank-badge" :class="'rank-' + rank">
      <text class="rank-num">{{ rank }}</text>
    </view>

    <!-- 酒店信息 -->
    <view class="rec-content">
      <view class="rec-header flex-between">
        <text class="rec-name text-ellipsis">{{ item.hotel.name }}</text>
        <view class="rec-tags">
          <text class="star-tag">{{ '★'.repeat(item.hotel.starLevel) }}</text>
          <text class="dist-tag">{{ formatDistance(item.hotel.distance) }}</text>
        </view>
      </view>

      <!-- 推荐理由 -->
      <view class="reasons-list">
        <view v-for="(r, i) in item.reasons" :key="i" class="reason-item">
          <text class="reason-icon">{{ r.icon }}</text>
          <text class="reason-text">{{ r.text }}</text>
        </view>
      </view>

      <!-- 平台价格 -->
      <view class="rec-prices flex-row">
        <view v-for="p in topPlatforms" :key="p.platform" class="rec-price-chip">
          <text class="chip-platform">{{ getShortName(p.platformName) }}</text>
          <text class="chip-price">¥{{ p.minPrice }}</text>
        </view>
      </view>

      <!-- 底部标签 -->
      <view class="rec-footer flex-between">
        <text class="layer-tag">{{ item.layer }}</text>
        <text class="go-detail">查看详情 →</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { formatDistance } from '@/utils/amap.js'

const props = defineProps({
  item: { type: Object, required: true },
  rank: { type: Number, required: true }
})

const topPlatforms = computed(() => {
  return [...props.item.hotel.platforms]
    .sort((a, b) => a.minPrice - b.minPrice)
    .slice(0, 3)
})

function goDetail() {
  uni.navigateTo({
    url: `/pages/detail/detail?id=${props.item.hotel.id}`
  })
}
</script>

<style lang="scss" scoped>
.recommend-card {
  display: flex;
  background: #fff;
  border-radius: 16rpx;
  margin: 0 24rpx 20rpx;
  padding: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
  position: relative;
  overflow: hidden;
}

.rank-badge {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  flex-shrink: 0;
  .rank-num { font-size: 32rpx; font-weight: 800; color: #fff; }
  &.rank-1 { background: linear-gradient(135deg, #FFD700, #FFA000); }
  &.rank-2 { background: linear-gradient(135deg, #C0C0C0, #909090); }
  &.rank-3 { background: linear-gradient(135deg, #CD7F32, #A0522D); }
  &.rank-4, &.rank-5 { background: linear-gradient(135deg, #007AFF, #5856D6); }
}

.rec-content { flex: 1; min-width: 0; }

.rec-header {
  margin-bottom: 12rpx;
  .rec-name { font-size: 30rpx; font-weight: 600; color: #1a1a1a; flex: 1; margin-right: 12rpx; }
  .rec-tags { display: flex; gap: 8rpx; white-space: nowrap; }
  .star-tag { font-size: 20rpx; color: #FFB800; }
  .dist-tag { font-size: 22rpx; color: #007AFF; background: #E8F4FD; padding: 2rpx 10rpx; border-radius: 6rpx; }
}

.reasons-list {
  margin-bottom: 14rpx;
  .reason-item {
    display: flex;
    align-items: baseline;
    margin-bottom: 6rpx;
    .reason-icon { font-size: 22rpx; margin-right: 6rpx; flex-shrink: 0; }
    .reason-text { font-size: 24rpx; color: #666; line-height: 1.4; }
  }
}

.rec-prices {
  gap: 8rpx;
  margin-bottom: 14rpx;
  .rec-price-chip {
    display: flex;
    align-items: center;
    gap: 4rpx;
    background: #f5f5f5;
    padding: 4rpx 12rpx;
    border-radius: 6rpx;
    .chip-platform { font-size: 20rpx; color: #999; }
    .chip-price { font-size: 24rpx; font-weight: 700; color: #FF3B30; }
  }
}

.rec-footer {
  .layer-tag {
    font-size: 22rpx; color: #007AFF; background: #E8F4FD;
    padding: 2rpx 12rpx; border-radius: 10rpx;
  }
  .go-detail { font-size: 24rpx; color: #007AFF; }
}
</style>
