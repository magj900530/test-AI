/**
 * 缓存层 — 基于 node-cache
 * TTL 默认 30 分钟，避免频繁爬取
 */

const NodeCache = require('node-cache')
const config = require('./config')

const cache = new NodeCache({
  stdTTL: config.cacheTTL,
  checkperiod: 60, // 每 60 秒清理过期项
  useClones: false
})

/**
 * 生成缓存 key
 */
function cacheKey(hotelName, city) {
  return `price:${city || 'default'}:${hotelName.trim()}`
}

/**
 * 读取缓存
 */
function get(hotelName, city) {
  return cache.get(cacheKey(hotelName, city)) || null
}

/**
 * 写入缓存
 */
function set(hotelName, city, data) {
  return cache.set(cacheKey(hotelName, city), data)
}

/**
 * 获取缓存统计数据
 */
function stats() {
  return {
    keys: cache.keys().length,
    hits: cache.getStats().hits,
    misses: cache.getStats().misses,
    ksize: cache.getStats().ksize,
    vsize: cache.getStats().vsize
  }
}

/**
 * 清空所有缓存
 */
function flush() {
  cache.flushAll()
}

module.exports = { get, set, stats, flush, cacheKey }
