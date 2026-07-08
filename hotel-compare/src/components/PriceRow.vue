<template>
  <view class="price-row" :class="'row-' + platform.platform" @click="$emit('book', platform)">
    <view class="row-left">
      <text class="platform-badge" :class="'badge-' + platform.platform">{{ platform.platformName }}</text>
      <text class="price-text">
        <text class="price-yuan">¥</text>
        <text class="price-num">{{ platform.minPrice }}</text>
        <text class="price-qi">起</text>
      </text>
    </view>
    <view class="row-right flex-row">
      <view class="rating-box">
        <text class="rating-star">★</text>
        <text class="rating-val">{{ platform.rating }}</text>
      </view>
      <text class="review-count">{{ formatCount(platform.reviewCount) }}条评价</text>
      <text class="book-arrow">去预订 →</text>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  platform: { type: Object, required: true }
})

defineEmits(['book'])

function formatCount(count) {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return count
}
</script>

<style lang="scss" scoped>
.price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 20rpx;
  margin-bottom: 12rpx;
  border-radius: 10rpx;
  background: #fafafa;
}

.row-meituan { background: #FFFEF7; }
.row-xiecheng { background: #F7FBFF; }
.row-qunar { background: #F7FDFF; }
.row-feizhu { background: #FFF8F5; }

.row-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.platform-badge {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  color: #fff;
  min-width: 72rpx;
  text-align: center;
}
.badge-meituan { background: #FFC83D; color: #333; }
.badge-xiecheng { background: #096DD9; }
.badge-qunar { background: #0088CC; }
.badge-feizhu { background: #FF5000; }

.price-text {
  .price-yuan { font-size: 22rpx; color: #FF3B30; }
  .price-num { font-size: 32rpx; font-weight: 700; color: #FF3B30; }
  .price-qi { font-size: 22rpx; color: #999; margin-left: 4rpx; }
}

.row-right {
  gap: 12rpx;
  .rating-box {
    display: flex;
    align-items: center;
    gap: 4rpx;
    .rating-star { color: #FFB800; font-size: 22rpx; }
    .rating-val { font-size: 24rpx; font-weight: 600; color: #FF9500; }
  }
  .review-count { font-size: 22rpx; color: #999; }
  .book-arrow { font-size: 24rpx; color: #007AFF; white-space: nowrap; }
}
</style>
