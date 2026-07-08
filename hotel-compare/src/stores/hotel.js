/**
 * 酒店数据状态管理
 * 管理酒店列表、筛选、排序、详情
 *
 * 价格策略：平台价格仅来自后端爬虫实时抓取。
 * 不做任何估算/兜底 — 抓取不到则该平台显示"暂无"。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLocationStore } from './location'
import { sortHotels } from '@/utils/ranking.js'
import { generateRecommendations } from '@/utils/recommend.js'
import { getPriceCompare } from '@/utils/request.js'
import { searchAround } from '@/utils/amap.js'
import { amapPOIsToHotels } from '@/utils/hotel-adapter.js'
import hotelData from '@/data/hotels.json'

export const useHotelStore = defineStore('hotel', () => {
  // ====== 状态 ======
  const allHotels = ref([])
  const filteredHotels = ref([])
  const sortType = ref('comprehensive')
  const currentDetail = ref(null)
  const isLoading = ref(false)
  const favorites = ref([])
  const priceCache = ref({})          // { hotelId: { platforms, updatedAt, timestamp } }
  const isPriceLoading = ref(false)

  // ====== 计算属性 ======
  const sortedHotels = computed(() => {
    return sortHotels(filteredHotels.value, sortType.value)
  })

  const recommendations = computed(() => {
    return generateRecommendations(filteredHotels.value)
  })

  const favoriteHotels = computed(() => {
    return filteredHotels.value.filter(h => favorites.value.includes(h.id))
  })

  // ====== 方法 ======

  /**
   * 计算衍生字段（兼容 null 价格）
   * minPrice: 仅统计有真实价格的平台（minPrice > 0）
   */
  function computeHotelFields(hotel) {
    const validPrices = hotel.platforms
      .map(p => p.minPrice)
      .filter(p => p != null && p > 0)
    const validRatings = hotel.platforms
      .map(p => p.rating)
      .filter(r => r != null && r > 0)
    const validReviews = hotel.platforms
      .map(p => p.reviewCount)
      .filter(r => r != null)

    return {
      ...hotel,
      minPrice: validPrices.length ? Math.min(...validPrices) : null,
      maxPrice: validPrices.length ? Math.max(...validPrices) : null,
      avgRating: validRatings.length
        ? validRatings.reduce((a, b) => a + b, 0) / validRatings.length
        : 0,
      maxReviewCount: validReviews.length ? Math.max(...validReviews) : 0,
      platformCount: hotel.platforms.filter(p => p.minPrice != null && p.minPrice > 0).length
    }
  }

  /**
   * 加载本地酒店数据（离线/降级用）
   */
  function loadHotels() {
    isLoading.value = true
    try {
      allHotels.value = hotelData.map(h => computeHotelFields(h))
    } catch (e) {
      console.error('加载酒店数据失败:', e)
      allHotels.value = []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 通过高德 API 搜索周边真实酒店
   */
  async function searchNearbyHotels(lat, lng, radiusKm = 5) {
    isLoading.value = true
    try {
      console.log(`[酒店] 搜索周边酒店: (${lat}, ${lng}) ${radiusKm}km`)
      const pois = await searchAround(lat, lng, radiusKm * 1000)
      console.log(`[酒店] 高德返回 ${pois.length} 条酒店`)

      if (pois.length > 0) {
        const hotels = amapPOIsToHotels(pois)
        allHotels.value = hotels.map(computeHotelFields)
        console.log(`[酒店] 已加载 ${allHotels.value.length} 家酒店（价格待后端抓取），开始拉取实时价格...`)
        fetchAllRealPrices()
      } else {
        console.warn('[酒店] 高德无结果，降级到本地数据')
        allHotels.value = hotelData.map(computeHotelFields)
        uni.showToast({ title: '暂无周边酒店，显示示例数据', icon: 'none', duration: 2000 })
      }
    } catch (e) {
      console.error('[酒店] 搜索失败，降级到本地数据:', e.message)
      allHotels.value = hotelData.map(computeHotelFields)
      uni.showToast({ title: '网络异常，显示示例数据', icon: 'none', duration: 2000 })
    } finally {
      isLoading.value = false
      filterByLocation()
    }
  }

  /**
   * 根据位置和半径筛选酒店
   */
  function filterByLocation() {
    const locStore = useLocationStore()
    if (!locStore.searchCenter) {
      filteredHotels.value = [...allHotels.value]
      return
    }

    const { lat, lng } = locStore.searchCenter
    filteredHotels.value = allHotels.value
      .map(h => {
        const distance = locStore.getDistance(h.lat, h.lng)
        return { ...h, distance }
      })
      .filter(h => h.distance <= locStore.radius)
  }

  function setSortType(type) {
    if (['comprehensive', 'distance', 'rating', 'price', 'star'].includes(type)) {
      sortType.value = type
    }
  }

  function getHotelById(id) {
    const hotel = allHotels.value.find(h => h.id === id)
    if (hotel) {
      const locStore = useLocationStore()
      if (locStore.searchCenter) {
        hotel.distance = locStore.getDistance(hotel.lat, hotel.lng)
      }
      currentDetail.value = hotel
    }
    return hotel
  }

  function toggleFavorite(hotelId) {
    const idx = favorites.value.indexOf(hotelId)
    if (idx > -1) {
      favorites.value.splice(idx, 1)
    } else {
      favorites.value.push(hotelId)
    }
    uni.setStorageSync('hotel_favorites', favorites.value)
  }

  function restoreFavorites() {
    try {
      const saved = uni.getStorageSync('hotel_favorites')
      if (saved) favorites.value = saved
    } catch (e) {
      favorites.value = []
    }
  }

  /**
   * 从后端刷新单个酒店的实时爬虫价格
   *
   * 合并策略：
   * - 后端返回的平台数据 → 更新对应平台（_pending: false, _source: 'scraped'）
   * - 后端未返回的平台 → 标记为未上架（_pending: false, _notFound: true）
   * - 每个酒店 5 分钟内不重复请求
   *
   * @param {string} hotelId 酒店 ID
   * @returns 更新后的 platforms 数组
   */
  async function refreshPrices(hotelId) {
    const hotel = allHotels.value.find(h => h.id === hotelId)
    if (!hotel) return null

    // 检查缓存（5 分钟内不重复请求）
    const cached = priceCache.value[hotelId]
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      console.log(`[价格] 使用缓存: ${hotel.name}`)
      return cached.platforms
    }

    try {
      const city = hotel.address ? hotel.address.substring(0, 2) : ''
      const address = hotel.address || ''

      const result = await getPriceCompare(hotel.name, city, address)
      console.log(`[价格] 后端返回: ${hotel.name}`, JSON.stringify(result?.platforms?.map(p => `${p.platform}:¥${p.minPrice}`)))

      if (result && result.platforms) {
        // 构建后端平台数据映射 { meituan: {...}, xiecheng: {...}, ... }
        const backendMap = {}
        result.platforms.forEach(p => {
          backendMap[p.platform] = p
        })

        // 合并到现有平台占位中
        const hotelIndex = allHotels.value.findIndex(h => h.id === hotelId)
        if (hotelIndex > -1) {
          const currentHotel = allHotels.value[hotelIndex]
          const updatedPlatforms = currentHotel.platforms.map(existing => {
            const backendData = backendMap[existing.platform]
            if (backendData && backendData.minPrice > 0) {
              // 后端抓取到了该平台价格
              return {
                ...existing,
                ...backendData,
                _pending: false,
                _source: 'scraped',
                _notFound: false
              }
            }
            // 后端未抓取到该平台 → 标记为未上架
            return {
              ...existing,
              minPrice: null,
              _pending: false,
              _notFound: true
            }
          })

          allHotels.value[hotelIndex] = computeHotelFields({
            ...currentHotel,
            platforms: updatedPlatforms
          })

          const foundCount = updatedPlatforms.filter(p => p.minPrice != null && p.minPrice > 0).length
          console.log(`[价格] ✅ ${hotel.name}: ${foundCount}/4 平台有价格`)
        }

        // 写入缓存
        priceCache.value[hotelId] = {
          platforms: result.platforms,
          timestamp: Date.now()
        }

        return result.platforms
      }
    } catch (err) {
      console.error(`[价格] 请求失败: ${hotel.name}`, err.message)
      // 缓存失败状态避免重复请求
      priceCache.value[hotelId] = {
        platforms: hotel.platforms,
        timestamp: Date.now()
      }
    }

    return hotel.platforms
  }

  /**
   * 异步拉取所有酒店的实时爬虫价格
   */
  async function fetchAllRealPrices() {
    const hotels = [...allHotels.value]
    let fetched = 0
    let updated = 0

    for (const hotel of hotels) {
      try {
        const platforms = await refreshPrices(hotel.id)
        if (platforms && platforms.some(p => p.minPrice > 0)) {
          updated++
        }
        fetched++
      } catch (e) {
        // 单个酒店失败不影响其他
      }
    }

    console.log(`[价格] 拉取完成: ${fetched}/${hotels.length} 家请求, ${updated} 家获得实时价格`)
    if (updated > 0) {
      filterByLocation()
    }
  }

  /**
   * 获取价格数据来源信息
   */
  function getPriceSource(hotelId) {
    const cached = priceCache.value[hotelId]
    if (!cached) return { source: 'pending', updatedAt: null }
    return { source: 'scraped', updatedAt: null }
  }

  return {
    allHotels,
    filteredHotels,
    sortType,
    currentDetail,
    isLoading,
    favorites,
    priceCache,
    isPriceLoading,
    sortedHotels,
    recommendations,
    favoriteHotels,
    loadHotels,
    searchNearbyHotels,
    filterByLocation,
    setSortType,
    getHotelById,
    toggleFavorite,
    restoreFavorites,
    refreshPrices,
    getPriceSource
  }
})
