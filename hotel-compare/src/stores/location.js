/**
 * 位置状态管理
 * 管理用户当前位置、地图选点、搜索范围
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getUserLocation, calcDistance } from '@/utils/amap.js'

export const useLocationStore = defineStore('location', () => {
  // ====== 状态 ======
  const currentLocation = ref(null) // GPS 定位 { lat, lng }
  const currentAddress = ref('')     // 当前地址描述
  const selectedPoint = ref(null)    // 用户选择的地点 { name, address, lat, lng }
  const radius = ref(5)              // 搜索半径（km）
  const isLocating = ref(false)      // 定位中

  // ====== 计算属性 ======
  // 当前搜索中心点（优先使用选点，其次 GPS 定位）
  const searchCenter = computed(() => {
    return selectedPoint.value || currentLocation.value
  })

  const hasLocation = computed(() => {
    return !!(currentLocation.value || selectedPoint.value)
  })

  // ====== 方法 ======

  /**
   * 获取 GPS 定位
   */
  async function locate() {
    isLocating.value = true
    try {
      const pos = await getUserLocation()
      currentLocation.value = pos
      currentAddress.value = ''
      return pos
    } catch (e) {
      console.error('[定位] GPS 权限未授予或定位失败:', JSON.stringify(e))
      // 真机上 GPS 失败是常见情况（权限未授予、微信定位未开启等）
      // 使用默认位置作为降级，确保 App 仍可展示数据
      const fallback = { lat: 22.547, lng: 114.054 }
      currentLocation.value = fallback
      currentAddress.value = '定位失败，使用默认位置'
      return fallback
    } finally {
      isLocating.value = false
    }
  }

  /**
   * 设置手动选点
   */
  function setSelectedPoint(point) {
    selectedPoint.value = point
    if (point) {
      currentAddress.value = point.address || point.name
    }
  }

  /**
   * 清除手动选点，回到 GPS 定位
   */
  function clearSelectedPoint() {
    selectedPoint.value = null
    currentAddress.value = ''
  }

  /**
   * 设置搜索半径
   */
  function setRadius(km) {
    radius.value = km
  }

  /**
   * 判断酒店是否在搜索范围内
   */
  function isInRange(hotelLat, hotelLng) {
    if (!searchCenter.value) return true
    const dist = calcDistance(
      searchCenter.value.lat,
      searchCenter.value.lng,
      hotelLat,
      hotelLng
    )
    return dist <= radius.value
  }

  /**
   * 计算酒店到搜索中心的距离
   */
  function getDistance(hotelLat, hotelLng) {
    if (!searchCenter.value) return 0
    return calcDistance(
      searchCenter.value.lat,
      searchCenter.value.lng,
      hotelLat,
      hotelLng
    )
  }

  return {
    currentLocation,
    currentAddress,
    selectedPoint,
    radius,
    isLocating,
    searchCenter,
    hasLocation,
    locate,
    setSelectedPoint,
    clearSelectedPoint,
    setRadius,
    isInRange,
    getDistance
  }
})
