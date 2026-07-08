/**
 * 酒店优选推荐引擎
 *
 * 推荐逻辑：
 * 1. 按距离分层（1km / 3km / 5km）各取候选项
 * 2. 每层内部按综合评分排名，取 Top 3
 * 3. 去重后为每个推荐生成推荐理由
 */

import { comprehensiveSort } from './ranking'

/**
 * 主推荐函数
 * @param {Array} hotels - 范围内的所有酒店
 * @returns {Array} 推荐结果 [{ hotel, reasons: [] }]
 */
export function generateRecommendations(hotels) {
  if (!hotels || hotels.length === 0) return []

  // Step 1: 按距离分层
  const layers = [
    { label: '1公里以内', maxDist: 1, hotels: [] },
    { label: '3公里以内', maxDist: 3, hotels: [] },
    { label: '5公里以内', maxDist: 5, hotels: [] }
  ]

  hotels.forEach(h => {
    for (const layer of layers) {
      if (h.distance <= layer.maxDist) {
        layer.hotels.push(h)
        break
      }
    }
  })

  // Step 2: 每层综合排名取 Top 3
  const seen = new Set()
  const candidates = []

  for (const layer of layers) {
    const ranked = comprehensiveSort(layer.hotels)
    let added = 0
    for (const hotel of ranked) {
      if (added >= 3) break
      if (!seen.has(hotel.id)) {
        seen.add(hotel.id)
        candidates.push({
          hotel,
          layer: layer.label
        })
        added++
      }
    }
  }

  // Step 3: 为每个候选生成推荐理由
  return candidates.map(c => ({
    ...c,
    reasons: generateReasons(c.hotel, hotels)
  }))
}

/**
 * 生成推荐理由
 */
function generateReasons(hotel, allHotels) {
  const reasons = []

  // 1. 距离理由
  if (hotel.distance < 1) {
    reasons.push({
      type: 'distance',
      icon: '📍',
      text: `距您仅 ${Math.round(hotel.distance * 1000)}m，步行可达`
    })
  } else if (hotel.distance < 3) {
    reasons.push({
      type: 'distance',
      icon: '📍',
      text: `距您 ${hotel.distance.toFixed(1)}km，交通便利`
    })
  }

  // 2. 性价比理由（同星级价格对比）
  const sameStar = allHotels.filter(h => h.starLevel === hotel.starLevel && h.id !== hotel.id)
  if (sameStar.length > 0) {
    const avgPriceSameStar = sameStar.reduce((s, h) => s + h.minPrice, 0) / sameStar.length
    const savings = avgPriceSameStar - hotel.minPrice
    if (savings > 0) {
      const percent = Math.round((savings / avgPriceSameStar) * 100)
      if (percent >= 10) {
        reasons.push({
          type: 'value',
          icon: '💰',
          text: `同星级性价比最优，低于均价 ${percent}%`
        })
      }
    }
  }

  // 3. 评分理由
  const bestPlatform = [...hotel.platforms].sort((a, b) => b.rating - a.rating)[0]
  if (hotel.avgRating >= 4.5) {
    reasons.push({
      type: 'rating',
      icon: '⭐',
      text: `${bestPlatform.platformName} 评分 ${bestPlatform.rating}，口碑优秀`
    })
  } else if (hotel.avgRating >= 4.0) {
    reasons.push({
      type: 'rating',
      icon: '⭐',
      text: `多平台综合评分 ${hotel.avgRating.toFixed(1)}，品质可靠`
    })
  }

  // 4. 设施理由
  const goodAmenities = ['免费早餐', '健身房', '游泳池', '免费停车', '商务中心']
  const matched = hotel.amenities.filter(a => goodAmenities.includes(a))
  if (matched.length >= 2) {
    reasons.push({
      type: 'amenities',
      icon: '🏊',
      text: `含${matched.slice(0, 3).join('、')}等设施`
    })
  }

  // 5. 最低价平台
  const cheapestPlatform = [...hotel.platforms].sort((a, b) => a.minPrice - b.minPrice)[0]
  reasons.push({
    type: 'bestPrice',
    icon: '🏷️',
    text: `${cheapestPlatform.platformName} 最低 ¥${cheapestPlatform.minPrice}`
  })

  // 6. 口碑理由
  const mostReviewed = [...hotel.platforms].sort((a, b) => b.reviewCount - a.reviewCount)[0]
  if (mostReviewed.reviewCount > 2000) {
    const count = mostReviewed.reviewCount > 10000
      ? `${(mostReviewed.reviewCount / 10000).toFixed(1)}万`
      : mostReviewed.reviewCount
    reasons.push({
      type: 'reviews',
      icon: '📝',
      text: `${mostReviewed.platformName} 累计 ${count} 条评价`
    })
  }

  return reasons
}

/**
 * 获取最优预订平台
 * 综合价格和评分推荐最佳预订渠道
 */
export function getBestPlatform(hotel) {
  // 评分 > 4.0 且价格最低的组合最优
  const scored = hotel.platforms.map(p => ({
    ...p,
    _value: p.rating / (p.minPrice / 100) // 评分/百元价格比
  }))
  scored.sort((a, b) => b._value - a._value)
  return scored[0]
}
