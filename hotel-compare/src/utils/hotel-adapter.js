/**
 * AMap POI → Hotel 对象适配器
 * 将高德周边搜索返回的 POI 数据转换为 App 需要的酒店数据格式
 *
 * 重要：不做任何价格估算。各平台价格由后端爬虫实时抓取。
 * 未抓取到的平台 minPrice 为 null，UI 展示"暂无"。
 */

const DEFAULT_COVER = '/static/images/hotel-default.jpg'

const PLATFORM_TEMPLATES = [
  { platform: 'meituan', platformName: '美团' },
  { platform: 'xiecheng', platformName: '携程' },
  { platform: 'qunar', platformName: '去哪儿' },
  { platform: 'feizhu', platformName: '飞猪' }
]

/**
 * 生成平台搜索/跳转链接
 */
function buildJumpUrl(platform, hotelName) {
  const q = encodeURIComponent(hotelName)
  const urls = {
    meituan: `https://i.meituan.com/hotel/list?keyword=${q}`,
    xiecheng: `https://m.ctrip.com/html5/hotel/search?keyword=${q}`,
    qunar: `https://touch.qunar.com/hotel/search?keyword=${q}`,
    feizhu: `https://h5.m.taobao.com/trip/hotel/search?keyword=${q}`
  }
  return urls[platform] || ''
}

/**
 * 从高德 POI 类型码推断星级
 * 高德 POI 分类: 100101=五星级, 100102=四星级, 100103=三星级, 100104=二星级及以下
 */
function parseStarLevel(typeCode) {
  if (!typeCode) return 3
  const code = String(typeCode)
  if (code.includes('100101')) return 6
  if (code.includes('100102')) return 5
  if (code.includes('100103')) return 4
  if (code.includes('100104')) return 3
  if (code.includes('100105')) return 2
  return 3
}

/**
 * 创建平台价格占位（不做任何估算）
 * 所有平台 minPrice 初始为 null，等待后端爬虫回填真实价格
 */
function createPlatformPlaceholders(hotelName) {
  return PLATFORM_TEMPLATES.map((tpl) => ({
    ...tpl,
    minPrice: null,
    rating: 0,
    reviewCount: 0,
    roomTypes: [],
    jumpUrl: buildJumpUrl(tpl.platform, hotelName),
    deepLink: '',
    _pending: true
  }))
}

/**
 * 单条 POI → hotel 对象
 * @param {object} poi — 高德 searchAround/searchPOI 返回的单条 POI
 */
export function amapPOIToHotel(poi) {
  const amapRating = parseFloat(poi.rating) || 0
  const starLevel = parseInt(poi.star) || parseStarLevel(poi.type) || 3
  const hotelName = poi.name || ''
  const hotelAddress = poi.address || ''

  // 从 AMap photos 提取照片 URL（优先有 title 的，即实拍照片）
  const amapPhotos = (poi.photos || [])
  const sortedPhotos = [...amapPhotos].sort((a, b) => {
    if (a.title && !b.title) return -1
    if (!a.title && b.title) return 1
    return 0
  })
  const photoUrls = sortedPhotos.map(p => p.url).filter(Boolean)
  const cover = photoUrls.length > 0 ? photoUrls[0] : DEFAULT_COVER
  const images = photoUrls.length > 0 ? photoUrls : [DEFAULT_COVER]

  // 创建平台占位（不做估算，价格由后端爬虫回填）
  const platforms = createPlatformPlaceholders(hotelName)

  return {
    id: poi.id,
    name: hotelName,
    address: hotelAddress,
    lat: poi.lat,
    lng: poi.lng,
    starLevel,
    coverImage: cover,
    images: images,
    amenities: [],
    platforms
  }
}

/**
 * 批量 POI → hotel 对象数组
 * @param {Array} pois — 高德 POI 数组
 */
export function amapPOIsToHotels(pois) {
  if (!pois || !pois.length) return []
  return pois.map(amapPOIToHotel)
}
