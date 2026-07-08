/**
 * 酒店综合排序算法
 * 参考美团、携程的排序逻辑，提供多种排序方式
 */

/**
 * 综合排序（默认）
 * 加权公式：score = 0.35 × 价格分 + 0.25 × 评分 + 0.20 × 距离分 + 0.12 × 评价数 + 0.08 × 星级
 *
 * 各分项都归一化到 [0, 1] 区间，分数越高越好
 */
export function comprehensiveSort(hotels) {
  if (!hotels || hotels.length === 0) return []

  const sorted = [...hotels]

  // 收集各维度的最大最小值，用于归一化（过滤无效值）
  const prices = sorted.map(h => h.minPrice).filter(p => p != null)
  const ratings = sorted.map(h => h.avgRating).filter(r => r != null && r > 0)
  const distances = sorted.map(h => h.distance).filter(d => d != null)
  const reviews = sorted.map(h => h.maxReviewCount).filter(r => r != null)
  const stars = sorted.map(h => h.starLevel).filter(s => s != null)

  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 1
  const minRating = ratings.length ? Math.min(...ratings) : 0
  const maxRating = ratings.length ? Math.max(...ratings) : 5
  const minDist = distances.length ? Math.min(...distances) : 0
  const maxDist = distances.length ? Math.max(...distances) : 1
  const minReview = reviews.length ? Math.min(...reviews) : 0
  const maxReview = reviews.length ? Math.max(...reviews) : 1
  const minStar = stars.length ? Math.min(...stars) : 2
  const maxStar = stars.length ? Math.max(...stars) : 5

  // 计算综合得分
  sorted.forEach(h => {
    const priceVal = h.minPrice != null ? h.minPrice : maxPrice  // 无价格视为最贵
    const priceScore = maxPrice === minPrice ? 0.5 : 1 - (priceVal - minPrice) / (maxPrice - minPrice)
    const ratingVal = (h.avgRating != null && h.avgRating > 0) ? h.avgRating : 0
    const ratingScore = maxRating === minRating ? 0.5 : (ratingVal - minRating) / (maxRating - minRating)
    const distVal = h.distance != null ? h.distance : maxDist
    const distScore = maxDist === minDist ? 1 : 1 - (distVal - minDist) / (maxDist - minDist)
    const reviewVal = h.maxReviewCount != null ? h.maxReviewCount : 0
    const reviewScore = maxReview === minReview ? 0.5 : (reviewVal - minReview) / (maxReview - minReview)
    const starVal = h.starLevel != null ? h.starLevel : minStar
    const starScore = maxStar === minStar ? 0.5 : (starVal - minStar) / (maxStar - minStar)

    h._score = (
      0.35 * priceScore +
      0.25 * ratingScore +
      0.20 * distScore +
      0.12 * reviewScore +
      0.08 * starScore
    )
  })

  return sorted.sort((a, b) => b._score - a._score)
}

/**
 * 距离优先（近→远）
 */
export function distanceSort(hotels) {
  return [...hotels].sort((a, b) => a.distance - b.distance)
}

/**
 * 评分最高（高→低）
 */
export function ratingSort(hotels) {
  return [...hotels].sort((a, b) => {
    if (a.avgRating == null && b.avgRating == null) return 0
    if (a.avgRating == null) return 1
    if (b.avgRating == null) return -1
    return b.avgRating - a.avgRating
  })
}

/**
 * 价格最低（低→高）
 */
export function priceSort(hotels) {
  return [...hotels].sort((a, b) => {
    if (a.minPrice == null && b.minPrice == null) return 0
    if (a.minPrice == null) return 1
    if (b.minPrice == null) return -1
    return a.minPrice - b.minPrice
  })
}

/**
 * 星级最高（高→低）
 */
export function starSort(hotels) {
  return [...hotels].sort((a, b) => b.starLevel - a.starLevel)
}

/**
 * 通用排序入口
 * @param {Array} hotels - 酒店列表
 * @param {string} sortType - 排序类型：comprehensive | distance | rating | price | star
 */
export function sortHotels(hotels, sortType = 'comprehensive') {
  const sortMap = {
    comprehensive: comprehensiveSort,
    distance: distanceSort,
    rating: ratingSort,
    price: priceSort,
    star: starSort
  }

  const sortFn = sortMap[sortType] || comprehensiveSort
  return sortFn(hotels)
}

/**
 * 排序类型中文映射
 */
export const SORT_LABELS = {
  comprehensive: '综合排序',
  distance: '距离优先',
  rating: '评分最高',
  price: '价格最低',
  star: '星级最高'
}
