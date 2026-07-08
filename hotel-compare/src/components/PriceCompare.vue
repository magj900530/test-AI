<template>
  <view class="price-compare">
    <view class="section-title-row">
      <text class="section-title">📊 各平台价格对比</text>
      <view class="source-badge" v-if="dataSource" :class="`source-${dataSource}`">
        <text class="source-dot"></text>
        <text class="source-text">{{ sourceLabel }}</text>
      </view>
    </view>

    <!-- 加载中骨架屏 -->
    <view v-if="isLoading" class="loading-skeleton">
      <view v-for="i in 4" :key="i" class="skeleton-row">
        <view class="skeleton-line w-60 skeleton-animate"></view>
        <view class="skeleton-line w-40 skeleton-animate"></view>
      </view>
    </view>

    <view class="platform-rows" v-else>
      <view
        v-for="p in sortedPlatforms"
        :key="p.platform"
        class="platform-row"
        :class="getRowClass(p.platform)"
        @click="goBook(p)"
      >
        <!-- 平台信息 -->
        <view class="platform-info">
          <view class="platform-name-row">
            <text class="platform-name">{{ p.platformName }}</text>
            <text v-if="p === cheapestPlatform" class="best-tag">最低价</text>
            <text v-if="p.rating >= 4.7" class="recommend-tag">推荐</text>
          </view>
          <view class="rating-row flex-row">
            <text class="stars">{{ '★'.repeat(Math.floor(p.rating)) }}{{ '☆'.repeat(5 - Math.floor(p.rating)) }}</text>
            <text class="rating-score">{{ p.rating }}</text>
            <text class="review-count">| {{ formatReviewCount(p.reviewCount) }} 条评价</text>
          </view>
        </view>

        <!-- 价格 & 房型 -->
        <view class="platform-price-action">
          <view class="price-block">
            <text class="currency">¥</text>
            <text class="amount">{{ p.minPrice }}</text>
            <text class="suffix">起</text>
          </view>
          <view class="room-type text-ellipsis">{{ p.roomTypes[0]?.name || '标准房' }}</view>
          <view class="go-book-btn" :class="getBtnClass(p.platform)">去预订 →</view>
        </view>
      </view>
    </view>

    <!-- 价格历史趋势 -->
    <view class="price-history" v-if="priceHistory.length">
      <view class="section-title">📈 近7天价格趋势</view>
      <view class="chart-container">
        <view class="chart-bars">
          <view v-for="(h, i) in priceHistory" :key="i" class="chart-bar-col">
            <view class="bar-wrapper">
              <view
                class="bar"
                :style="{ height: (h.price / maxHistoryPrice * 100) + '%' }"
              />
            </view>
            <text class="bar-price">¥{{ h.price }}</text>
            <text class="bar-date">{{ h.date }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 去预订提示 -->
    <view class="book-notice">
      <text class="notice-text">💡 点击各平台行即可跳转预订（MVP 阶段模拟跳转）</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  platforms: { type: Array, required: true },
  priceHistory: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
  dataSource: { type: String, default: '' },    // 'scraped' | 'cached' | 'mock' | ''
  updatedAt: { type: String, default: '' }       // ISO timestamp
})

// 价格从低到高
const sortedPlatforms = computed(() => {
  return [...props.platforms].sort((a, b) => a.minPrice - b.minPrice)
})

const cheapestPlatform = computed(() => sortedPlatforms.value[0])

const maxHistoryPrice = computed(() => {
  if (!props.priceHistory.length) return 1
  return Math.max(...props.priceHistory.map(h => h.price)) * 1.15
})

const sourceLabel = computed(() => {
  const labels = {
    scraped: '实时价格',
    cached: '缓存数据',
    mock: '模拟数据'
  }
  return labels[props.dataSource] || ''
})

const dataSource = computed(() => props.dataSource)

function getRowClass(platform) {
  return `row-${platform}`
}

function getBtnClass(platform) {
  return `btn-${platform}`
}

function formatReviewCount(count) {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}千`
  return count
}

function goBook(platform) {
  // MVP 阶段模拟跳转
  uni.showModal({
    title: '预订跳转',
    content: `即将跳转至 ${platform.platformName} 预订页面\n\n链接: ${platform.jumpUrl || '暂无'}`,
    confirmText: '模拟跳转',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: `已跳转至${platform.platformName}`, icon: 'success' })
        // 真实环境:
        // if (platform.deepLink) {
        //   plus.runtime.openURL(platform.deepLink)
        // } else {
        //   uni.navigateTo({ url: '/pages/webview/webview?url=' + encodeURIComponent(platform.jumpUrl) })
        // }
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.price-compare {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 20rpx 24rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 20rpx;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;

  .section-title {
    margin-bottom: 0;
  }
}

/* 数据来源标签 */
.source-badge {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
  font-size: 22rpx;

  .source-dot {
    width: 10rpx;
    height: 10rpx;
    border-radius: 50%;
  }
}

.source-scraped {
  background: #E8F5E9;
  .source-text { color: #2E7D32; }
  .source-dot { background: #4CAF50; animation: pulse 2s infinite; }
}

.source-cached {
  background: #FFF3E0;
  .source-text { color: #E65100; }
  .source-dot { background: #FF9800; }
}

.source-mock {
  background: #F5F5F5;
  .source-text { color: #999; }
  .source-dot { background: #BDBDBD; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* 加载骨架屏 */
.loading-skeleton {
  padding: 8rpx 0;
}

.skeleton-row {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 24rpx 16rpx;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
  background: #fafafa;
}

.skeleton-line {
  height: 20rpx;
  border-radius: 6rpx;
  background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
  background-size: 200% 100%;
}

.skeleton-animate {
  animation: shimmer 1.5s ease-in-out infinite;
}

.w-60 { width: 60%; }
.w-40 { width: 40%; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.platform-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 16rpx;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
  border-left: 6rpx solid #ddd;
}

.row-meituan { background: #FFFEF7; border-left-color: #FFC83D; }
.row-xiecheng { background: #F7FBFF; border-left-color: #096DD9; }
.row-qunar { background: #F7FDFF; border-left-color: #0088CC; }
.row-feizhu { background: #FFF8F5; border-left-color: #FF5000; }

.platform-info {
  flex: 1;
  .platform-name-row {
    display: flex;
    align-items: center;
    gap: 8rpx;
    margin-bottom: 8rpx;
    .platform-name { font-size: 30rpx; font-weight: 600; }
    .best-tag {
      font-size: 20rpx; color: #fff; background: #FF3B30;
      padding: 2rpx 8rpx; border-radius: 4rpx;
    }
    .recommend-tag {
      font-size: 20rpx; color: #fff; background: #34C759;
      padding: 2rpx 8rpx; border-radius: 4rpx;
    }
  }
  .rating-row {
    gap: 8rpx;
    .stars { color: #FFB800; font-size: 22rpx; }
    .rating-score { font-size: 24rpx; color: #FF9500; font-weight: 600; }
    .review-count { font-size: 22rpx; color: #999; }
  }
}

.platform-price-action {
  text-align: right;
  .price-block {
    .currency { font-size: 22rpx; color: #FF3B30; }
    .amount { font-size: 36rpx; font-weight: 700; color: #FF3B30; }
    .suffix { font-size: 22rpx; color: #999; }
  }
  .room-type { font-size: 22rpx; color: #999; margin: 4rpx 0 8rpx; max-width: 200rpx; }
  .go-book-btn {
    font-size: 24rpx; padding: 8rpx 20rpx; border-radius: 20rpx;
    color: #fff; text-align: center; display: inline-block;
  }
  .btn-meituan { background: linear-gradient(135deg, #FFC83D, #FF9800); }
  .btn-xiecheng { background: linear-gradient(135deg, #096DD9, #0050B3); }
  .btn-qunar { background: linear-gradient(135deg, #0088CC, #006699); }
  .btn-feizhu { background: linear-gradient(135deg, #FF5000, #CC4000); }
}

/* 价格趋势图 */
.price-history {
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid #f0f0f0;
}

.chart-container { padding: 20rpx 0 0; }

.chart-bars {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 200rpx;
  padding: 0 8rpx;
}

.chart-bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}

.bar-wrapper {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 4rpx;
}

.bar {
  width: 36rpx;
  min-height: 8rpx;
  background: linear-gradient(180deg, #FF6B6B, #FF3B30);
  border-radius: 6rpx 6rpx 0 0;
  transition: height 0.3s;
}

.bar-price { font-size: 20rpx; color: #FF3B30; font-weight: 600; }
.bar-date { font-size: 18rpx; color: #999; }

.book-notice {
  margin-top: 24rpx;
  padding: 16rpx;
  background: #F5F7FA;
  border-radius: 8rpx;
  .notice-text { font-size: 24rpx; color: #999; }
}
</style>
