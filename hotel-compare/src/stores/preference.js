/**
 * 用户偏好状态管理
 * 管理默认排序、默认半径、主题模式等偏好设置
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const usePreferenceStore = defineStore('preference', () => {
  // ====== 状态 ======
  const defaultSort = ref('comprehensive')
  const defaultRadius = ref(5)
  const isDarkMode = ref(false)
  const compareList = ref([]) // 对比列表（最多 4 家酒店 ID）

  // ====== 方法 ======

  /**
   * 设置默认排序
   */
  function setDefaultSort(type) {
    defaultSort.value = type
    persistToStorage('pref_sort', type)
  }

  /**
   * 设置默认半径
   */
  function setDefaultRadius(km) {
    defaultRadius.value = km
    persistToStorage('pref_radius', km)
  }

  /**
   * 切换夜间模式
   */
  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value
    persistToStorage('pref_dark', isDarkMode.value)
  }

  /**
   * 添加酒店到对比列表
   */
  function addToCompare(hotelId) {
    if (compareList.value.length >= 4) {
      uni.showToast({ title: '最多对比 4 家酒店', icon: 'none' })
      return false
    }
    if (!compareList.value.includes(hotelId)) {
      compareList.value.push(hotelId)
      uni.showToast({ title: '已加入对比', icon: 'success' })
      return true
    }
    return false
  }

  /**
   * 从对比列表移除
   */
  function removeFromCompare(hotelId) {
    const idx = compareList.value.indexOf(hotelId)
    if (idx > -1) {
      compareList.value.splice(idx, 1)
    }
  }

  /**
   * 清除对比列表
   */
  function clearCompare() {
    compareList.value = []
  }

  /**
   * 从本地存储恢复偏好
   */
  function restore() {
    try {
      defaultSort.value = uni.getStorageSync('pref_sort') || 'comprehensive'
      defaultRadius.value = uni.getStorageSync('pref_radius') || 5
      isDarkMode.value = uni.getStorageSync('pref_dark') || false
    } catch (e) {
      // 保持默认值
    }
  }

  /**
   * 持久化到本地存储
   */
  function persistToStorage(key, value) {
    try {
      uni.setStorageSync(key, value)
    } catch (e) {
      // 静默失败
    }
  }

  return {
    defaultSort,
    defaultRadius,
    isDarkMode,
    compareList,
    setDefaultSort,
    setDefaultRadius,
    toggleDarkMode,
    addToCompare,
    removeFromCompare,
    clearCompare,
    restore
  }
})
