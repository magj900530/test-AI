<template>
  <view class="recommend-page">
    <!-- 顶部说明 -->
    <view class="rec-header">
      <text class="rec-title">🎯 优选推荐</text>
      <text class="rec-subtitle">基于距离、价格、评分、设施综合评估</text>

      <!-- 搜索点信息 -->
      <view class="location-info" v-if="locStore.hasLocation">
        <text class="loc-icon">📍</text>
        <text class="loc-text">{{ locStore.currentAddress || `${locStore.searchCenter.lat.toFixed(4)}, ${locStore.searchCenter.lng.toFixed(4)}` }}</text>
        <text class="radius-badge">{{ locStore.radius }}km 内</text>
      </view>

      <!-- 无位置提示 -->
      <view v-else class="no-location">
        <text class="no-loc-text">请先在首页定位或选择地点</text>
        <view class="go-home-btn" @click="goHome">
          <text>去定位 →</text>
        </view>
      </view>
    </view>

    <!-- 推荐列表 -->
    <scroll-view class="rec-list" scroll-y v-if="recommendations.length">
      <!-- 层标题 -->
      <view v-for="(group, gi) in groupedRecommendations" :key="gi">
        <view class="layer-title">
          <text class="layer-icon">{{ gi === 0 ? '🥇' : gi === 1 ? '🥈' : '🥉' }}</text>
          <text class="layer-label">{{ group.layer }}</text>
        </view>

        <!-- 推荐卡片 -->
        <RecommendCard
          v-for="(item, i) in group.items"
          :key="item.hotel.id"
          :item="item"
          :rank="group.startRank + i"
        />
      </view>

      <view class="safe-area-bottom" style="height: 40rpx;" />
    </scroll-view>

    <!-- 空状态 -->
    <view v-else-if="locStore.hasLocation" class="empty-rec flex-col">
      <text class="empty-icon">🔍</text>
      <text class="empty-title">暂无推荐</text>
      <text class="empty-desc">当前范围内酒店数量不足，试试扩大搜索半径</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { useLocationStore } from '@/stores/location.js'
import { useHotelStore } from '@/stores/hotel.js'
import RecommendCard from '@/components/RecommendCard.vue'

const locStore = useLocationStore()
const hotelStore = useHotelStore()

const recommendations = computed(() => hotelStore.recommendations)

// 按层分组
const groupedRecommendations = computed(() => {
  const groups = {}
  recommendations.value.forEach(r => {
    if (!groups[r.layer]) {
      groups[r.layer] = { layer: r.layer, items: [], startRank: 0 }
    }
    groups[r.layer].items.push(r)
  })

  const result = Object.values(groups)
  // 计算各层的起始排名
  let rank = 1
  result.forEach(g => {
    g.startRank = rank
    rank += g.items.length
  })
  return result
})

function goHome() {
  uni.switchTab({ url: '/pages/index/index' })
}
</script>

<style lang="scss" scoped>
.recommend-page {
  background: #f5f5f5;
  min-height: 100vh;
}

.rec-header {
  background: linear-gradient(135deg, #007AFF, #5856D6);
  padding: 48rpx 24rpx 32rpx;
  color: #fff;

  .rec-title {
    font-size: 40rpx;
    font-weight: 700;
    display: block;
    margin-bottom: 8rpx;
  }
  .rec-subtitle {
    font-size: 26rpx;
    opacity: 0.8;
    display: block;
    margin-bottom: 20rpx;
  }
}

.location-info {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.15);
  padding: 12rpx 20rpx;
  border-radius: 12rpx;
  .loc-icon { font-size: 24rpx; margin-right: 8rpx; }
  .loc-text { font-size: 24rpx; flex: 1; color: rgba(255,255,255,0.9); }
  .radius-badge {
    font-size: 22rpx; background: rgba(255,255,255,0.25);
    padding: 4rpx 12rpx; border-radius: 10rpx;
  }
}

.no-location {
  text-align: center;
  padding: 24rpx 0;
  .no-loc-text { font-size: 26rpx; opacity: 0.8; display: block; margin-bottom: 16rpx; }
  .go-home-btn {
    display: inline-block;
    background: rgba(255,255,255,0.2);
    padding: 10rpx 32rpx; border-radius: 20rpx;
    font-size: 26rpx;
  }
}

.layer-title {
  display: flex;
  align-items: center;
  padding: 24rpx 24rpx 12rpx;
  .layer-icon { font-size: 32rpx; margin-right: 8rpx; }
  .layer-label { font-size: 28rpx; font-weight: 600; color: #333; }
}

.rec-list {
  height: calc(100vh - 280rpx);
}

.empty-rec {
  padding: 120rpx 24rpx;
  align-items: center;
  text-align: center;
  .empty-icon { font-size: 80rpx; margin-bottom: 24rpx; }
  .empty-title { font-size: 32rpx; color: #333; margin-bottom: 12rpx; }
  .empty-desc { font-size: 26rpx; color: #999; }
}
</style>
