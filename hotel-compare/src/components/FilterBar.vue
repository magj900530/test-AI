<template>
  <view class="filter-bar">
    <view
      v-for="item in filterItems"
      :key="item.key"
      class="filter-item"
      :class="{ active: currentSort === item.key }"
      @click="handleSort(item.key)"
    >
      <text class="filter-label">{{ item.label }}</text>
      <view v-if="currentSort === item.key" class="active-indicator" />
    </view>

    <!-- 范围选择切换 -->
    <view class="radius-toggle" @click="showRadius = !showRadius">
      <text class="radius-label">{{ radius }}km</text>
      <text class="radius-arrow">{{ showRadius ? '▲' : '▼' }}</text>
    </view>
  </view>

  <!-- 展开的范围选择器 -->
  <RadiusSelector
    v-if="showRadius"
    :current="radius"
    @change="onRadiusChange"
    @close="showRadius = false"
  />
</template>

<script setup>
import { ref } from 'vue'
import RadiusSelector from './RadiusSelector.vue'
import { SORT_LABELS } from '@/utils/ranking.js'

const props = defineProps({
  currentSort: { type: String, default: 'comprehensive' },
  radius: { type: Number, default: 5 }
})

const emit = defineEmits(['sortChange', 'radiusChange'])

const showRadius = ref(false)

const filterItems = Object.entries(SORT_LABELS).map(([key, label]) => ({ key, label }))

function handleSort(key) {
  emit('sortChange', key)
}

function onRadiusChange(km) {
  emit('radiusChange', km)
  showRadius.value = false
}
</script>

<style lang="scss" scoped>
.filter-bar {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 0 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
  height: 80rpx;
}

.filter-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  height: 100%;

  .filter-label {
    font-size: 26rpx;
    color: #666;
  }

  &.active .filter-label {
    color: #007AFF;
    font-weight: 600;
  }

  .active-indicator {
    position: absolute;
    bottom: 0;
    width: 40rpx;
    height: 4rpx;
    background: #007AFF;
    border-radius: 2rpx;
  }
}

.radius-toggle {
  display: flex;
  align-items: center;
  margin-left: 8rpx;
  padding: 8rpx 16rpx;
  background: #F0F7FF;
  border-radius: 20rpx;
  .radius-label { font-size: 24rpx; color: #007AFF; font-weight: 600; }
  .radius-arrow { font-size: 16rpx; color: #007AFF; margin-left: 4rpx; }
}
</style>
