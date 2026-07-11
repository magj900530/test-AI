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

  const _searchToken = ref(0)  // 竞态控制：每次新搜索递增，旧请求结果被丢弃

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
    const token = ++_searchToken.value  // 递增版本号，旧请求的结果将被忽略
    try {
      const pois = await searchAround(lat, lng, radiusKm * 1000)

      // 竞态保护：如果新搜索已发起，丢弃本次结果
      if (token !== _searchToken.value) return

      if (pois.length > 0) {
        const hotels = amapPOIsToHotels(pois)
        allHotels.value = hotels.map(computeHotelFields)
        fetchAllRealPrices()
      } else {
        allHotels.value = hotelData.map(computeHotelFields)
        uni.showToast({ title: '暂无周边酒店，显示示例数据', icon: 'none', duration: 2000 })
      }
    } catch (e) {
      if (token !== _searchToken.value) return
      allHotels.value = hotelData.map(computeHotelFields)
      uni.showToast({ title: '网络异常，显示示例数据', icon: 'none', duration: 2000 })
    } finally {
      if (token === _searchToken.value) {
        isLoading.value = false
        filterByLocation()
      }
    }
  }

  /**
   * 根据位置和半径筛选酒店（单次遍历，复用缓存距离）
   */
  function filterByLocation() {
    const locStore = useLocationStore()
    if (!locStore.searchCenter) {
      filteredHotels.value = [...allHotels.value]
      return
    }

    const { lat, lng, radius } = locStore.searchCenter
    filteredHotels.value = allHotels.value.reduce((result, h) => {
      const distance = h.distance != null ? h.distance : locStore.getDistance(h.lat, h.lng)
      if (distance <= radius) result.push({ ...h, distance })
      return result
    }, [])
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
   * 检查价格缓存是否有效（5 分钟内不重复请求）
   */
  function checkPriceCache(hotelId) {
    const cached = priceCache.value[hotelId]
    return (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) ? cached : null
  }

  /**
   * 将后端平台数据合并到酒店平台的占位中
   */
  function mergePlatformPrices(hotel, backendPlatforms) {
    const backendMap = {}
    backendPlatforms.forEach(p => { backendMap[p.platform] = p })

    return hotel.platforms.map(existing => {
      const backendData = backendMap[existing.platform]
      if (backendData && backendData.minPrice > 0) {
        return { ...existing, ...backendData, _pending: false, _source: 'scraped', _notFound: false }
      }
      return { ...existing, minPrice: null, _pending: false, _notFound: true }
    })
  }

  /**
   * 从后端刷新单个酒店的实时爬虫价格
   */
  async function refreshPrices(hotelId) {
    const hotel = allHotels.value.find(h => h.id === hotelId)
    if (!hotel) return null

    const cached = checkPriceCache(hotelId)
    if (cached) return cached.platforms

    try {
      const city = hotel.address ? hotel.address.substring(0, 2) : ''
      const address = hotel.address || ''
      const result = await getPriceCompare(hotel.name, city, address)

      if (result?.platforms) {
        const hotelIndex = allHotels.value.findIndex(h => h.id === hotelId)
        if (hotelIndex > -1) {
          const updatedPlatforms = mergePlatformPrices(allHotels.value[hotelIndex], result.platforms)
          allHotels.value[hotelIndex] = computeHotelFields({ ...allHotels.value[hotelIndex], platforms: updatedPlatforms })
        }
        priceCache.value[hotelId] = { platforms: result.platforms, timestamp: Date.now() }
        return result.platforms
      }
    } catch (err) {
      priceCache.value[hotelId] = { platforms: hotel.platforms, timestamp: Date.now() }
    }
    return hotel.platforms
  }

  /**
   * 并发池：限制同时进行的异步任务数
   * @param {number} concurrency 最大并发数
   * @param {Array} items 任务列表
   * @param {Function} fn 每个任务的处理函数 (item) => Promise
   */
  async function runWithConcurrency(concurrency, items, fn) {
    const results = []
    const queue = [...items]

    async function worker() {
      while (queue.length > 0) {
        const item = queue.shift()
        try {
          results.push(await fn(item))
        } catch (_) { /* 单个失败不影响其他 */ }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
    return results
  }

  /**
   * 异步拉取所有酒店的实时爬虫价格（并发池，最多 5 个同时请求）
   */
  async function fetchAllRealPrices() {
    const hotels = [...allHotels.value]
    let updated = 0

    await runWithConcurrency(5, hotels, async (hotel) => {
      try {
        const platforms = await refreshPrices(hotel.id)
        if (platforms && platforms.some(p => p.minPrice > 0)) {
          updated++
        }
        return true
      } catch (e) {
        return false
      }
    })

    const fetched = hotels.length
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
    return { source: 'scraped', updatedAt: cached.timestamp }
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
