<template>
  <view class="radius-selector">
    <view class="radius-options">
      <view
        v-for="opt in radiusOptions"
        :key="opt.value"
        class="radius-option"
        :class="{ active: current === opt.value }"
        @click="handleSelect(opt.value)"
      >
        <text class="option-value">{{ opt.value }}km</text>
        <text class="option-label">{{ opt.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  current: { type: Number, default: 5 }
})

const emit = defineEmits(['change', 'close'])

const radiusOptions = [
  { value: 1, label: '步行圈' },
  { value: 3, label: '骑行圈' },
  { value: 5, label: '驾车圈' },
  { value: 10, label: '远距离' }
]

function handleSelect(value) {
  emit('change', value)
}
</script>

<style lang="scss" scoped>
.radius-selector {
  background: #fff;
  padding: 16rpx 24rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.radius-options {
  display: flex;
  gap: 16rpx;
}

.radius-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx;
  border-radius: 12rpx;
  background: #F5F5F5;
  transition: all 0.2s;

  .option-value {
    font-size: 32rpx;
    font-weight: 700;
    color: #333;
    margin-bottom: 4rpx;
  }
  .option-label {
    font-size: 22rpx;
    color: #999;
  }

  &.active {
    background: #E8F4FD;
    .option-value { color: #007AFF; }
    .option-label { color: #007AFF; }
  }
}
</style>
