/**
 * 高德地图 SDK 封装
 * 提供 POI 搜索、逆地理编码、距离计算等功能
 */

// 高德 Web API Key（从环境变量读取，不写死在代码中）
// ⚠️ 重要：必须使用「Web服务」类型的 Key
// 申请地址：https://console.amap.com/dev/key/app
// 本地开发：复制 .env.example 为 .env，填入你的 Key
const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || ''
const AMAP_BASE = 'https://restapi.amap.com/v3'

// 记录是否已提示过 Key 配置问题（避免重复弹 toast）
let keyWarningShown = false

/**
 * 检查 API 响应是否为 Key 配置错误
 */
function checkKeyError(status, info) {
  if (String(status) !== '1' && String(info).includes('USERKEY_PLAT_NOMATCH')) {
    console.error('='.repeat(50))
    console.error('[高德] ⚠️ API Key 配置错误: USERKEY_PLAT_NOMATCH')
    console.error('[高德] 当前 Key 类型不是「Web服务」，请到高德开放平台重新创建 Key')
    console.error('[高德] 申请地址: https://console.amap.com/dev/key/app')
    console.error('[高德] 选择「Web服务」平台类型，获取新 Key 后替换 AMAP_KEY')
    console.error('='.repeat(50))
    if (!keyWarningShown) {
      keyWarningShown = true
      uni.showToast({
        title: '高德 Key 未配置为Web服务类型',
        icon: 'none',
        duration: 4000
      })
    }
    return true
  }
  return false
}

/**
 * Haversine 公式计算两点间距离（km）
 */
export function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371 // 地球半径（km）
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg) {
  return deg * (Math.PI / 180)
}

/**
 * 格式化距离显示
 */
export function formatDistance(km) {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`
  }
  return `${km.toFixed(1)}km`
}

/**
 * 逆地理编码：经纬度 → 地址
 */
export async function reverseGeocode(lat, lng) {
  try {
    const res = await uni.request({
      url: `${AMAP_BASE}/geocode/regeo`,
      data: {
        key: AMAP_KEY,
        location: `${lng},${lat}`,
        extensions: 'base'
      }
    })
    if (res.data.status === '1') {
      return res.data.regeocode
    }
    return null
  } catch (e) {
    console.error('逆地理编码失败:', e)
    return null
  }
}

/**
 * POI 地点搜索
 */
export async function searchPOI(keyword, city = '') {
  try {
    const res = await uni.request({
      url: `${AMAP_BASE}/place/text`,
      data: {
        key: AMAP_KEY,
        keywords: keyword,
        city: city,
        types: '100000|100100|100200', // 当前 Key 需指定类型才能返回结果
        offset: 20,
        page: 1,
        extensions: 'all'
      }
    })
    checkKeyError(res.data?.status, res.data?.info)
    console.log(`[高德] searchPOI: "${keyword}" → ${res.data?.count || 0} 条`)
    if (res.data.status === '1') {
      return res.data.pois.map(p => ({
        id: p.id,
        name: p.name,
        address: p.address,
        lat: parseFloat(p.location.split(',')[1]),
        lng: parseFloat(p.location.split(',')[0]),
        type: p.type,
        photos: (p.photos || []).map(ph => ({
          title: ph.title,
          url: ph.url
        }))
      }))
    }
    return []
  } catch (e) {
    console.error('POI 搜索失败:', e)
    return []
  }
}

/**
 * 周边 POI 搜索（按半径搜索酒店）
 */
export async function searchAround(lat, lng, radius = 5000) {
  try {
    console.log(`[高德] searchAround: (${lat}, ${lng}) radius=${radius}m`)
    const res = await uni.request({
      url: `${AMAP_BASE}/place/around`,
      data: {
        key: AMAP_KEY,
        location: `${lng},${lat}`,
        radius: radius,
        types: '100000|100100|100101|100102|100103|100104|100105|100200',
        offset: 50,
        page: 1,
        extensions: 'all'
      }
    })
    console.log(`[高德] 响应状态: ${res.statusCode}, API状态: ${res.data?.status}, 结果数: ${res.data?.count || 0}`)
    checkKeyError(res.data?.status, res.data?.info)
    if (res.data.status === '1') {
      return res.data.pois.map(p => ({
        id: p.id,
        name: p.name,
        address: p.address,
        lat: parseFloat(p.location.split(',')[1]),
        lng: parseFloat(p.location.split(',')[0]),
        rating: p.biz_ext?.rating || '0',
        star: parseInt(p.biz_ext?.star) || 0,
        lowestPrice: parseFloat(p.biz_ext?.lowest_price) || null,
        type: p.type,
        // 传递 AMap 返回的照片列表（供 hotel-adapter 使用）
        photos: (p.photos || []).map(ph => ({
          title: ph.title,
          url: ph.url
        }))
      }))
    }
    console.warn('[高德] API 返回非 1 状态:', res.data?.status, res.data?.info)
    return []
  } catch (e) {
    console.error('[高德] 周边搜索网络失败:', JSON.stringify(e))
    return []
  }
}

/**
 * 驾车距离计算（两点间实际路径距离）
 */
export async function calcDrivingDistance(origin, destination) {
  try {
    const res = await uni.request({
      url: `${AMAP_BASE}/direction/driving`,
      data: {
        key: AMAP_KEY,
        origin: `${origin.lng},${origin.lat}`,
        destination: `${destination.lng},${destination.lat}`,
        extensions: 'base'
      }
    })
    if (res.data.status === '1' && res.data.route.paths.length > 0) {
      return parseInt(res.data.route.paths[0].distance) / 1000 // 转为 km
    }
    return calcDistance(origin.lat, origin.lng, destination.lat, destination.lng)
  } catch (e) {
    // 降级为直线距离
    return calcDistance(origin.lat, origin.lng, destination.lat, destination.lng)
  }
}

/**
 * 获取用户当前位置
 */
export function getUserLocation() {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      success: (res) => {
        console.log('[定位] GPS 成功:', res.latitude, res.longitude)
        resolve({
          lat: res.latitude,
          lng: res.longitude,
          accuracy: res.accuracy
        })
      },
      fail: (err) => {
        console.error('[定位] GPS 失败:', JSON.stringify(err))
        // 真机上可能因权限未授予而失败，拒绝让上层处理
        reject(err)
      }
    })
  })
}

/**
 * 打开地图选择位置
 */
export function chooseLocation() {
  return new Promise((resolve, reject) => {
    uni.chooseLocation({
      success: (res) => {
        resolve({
          name: res.name,
          address: res.address,
          lat: res.latitude,
          lng: res.longitude
        })
      },
      fail: (err) => {
        console.error('选择位置失败:', err)
        reject(err)
      }
    })
  })
}
