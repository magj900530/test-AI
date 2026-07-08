<template>
  <view class="search-page">
    <SearchLocation
      @select="onSelectLocation"
      @close="goBack"
    />
  </view>
</template>

<script setup>
import SearchLocation from '@/components/SearchLocation.vue'
import { useLocationStore } from '@/stores/location.js'
import { useHotelStore } from '@/stores/hotel.js'

const locStore = useLocationStore()
const hotelStore = useHotelStore()

async function onSelectLocation(point) {
  locStore.setSelectedPoint(point)
  uni.showToast({ title: `已选择: ${point.name}`, icon: 'success', duration: 1500 })

  try {
    // 先搜索真实酒店数据，完成后再跳转（避免竞态条件）
    await hotelStore.searchNearbyHotels(point.lat, point.lng, locStore.radius)
  } catch (e) {
    console.error('[搜索] 搜索周边酒店失败:', e.message)
  }

  // 搜索完成后再返回首页
  setTimeout(() => {
    uni.switchTab({ url: '/pages/index/index' })
  }, 300)
}

function goBack() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.search-page {
  min-height: 100vh;
  background: #fff;
}
</style>
