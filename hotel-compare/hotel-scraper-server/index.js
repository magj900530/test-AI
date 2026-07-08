/**
 * 酒店价格爬虫后端服务
 * Express + Puppeteer 代理抓取四平台价格
 */

const express = require('express')
const config = require('./config')
const cache = require('./cache')
const { getMockPrices } = require('./mock-data')
const { normalize } = require('./normalizer')

// 引入各平台爬虫
const XiechengScraper = require('./scrapers/xiecheng')
const MeituanScraper = require('./scrapers/meituan')
const QunarScraper = require('./scrapers/qunar')
const FeizhuScraper = require('./scrapers/feizhu')

const app = express()
app.use(express.json())

// 平台爬虫注册表
const scrapers = {
  xiecheng: new XiechengScraper(),
  meituan: new MeituanScraper(),
  qunar: new QunarScraper(),
  feizhu: new FeizhuScraper()
}

/**
 * GET /api/hotels/prices
 * 查询单个酒店的实时价格
 *
 * Query: ?hotelName=深圳福田香格里拉大酒店&city=深圳
 * Response: { hotelName, updatedAt, platforms: [...] }
 */
app.get('/api/hotels/prices', async (req, res) => {
  const { hotelName, city = '' } = req.query

  if (!hotelName) {
    return res.status(400).json({ error: '缺少 hotelName 参数' })
  }

  console.log(`\n🔍 查询: "${hotelName}" (${city || '全国'})`)

  // 1. 先查缓存
  const cached = cache.get(hotelName, city)
  if (cached) {
    console.log(`📦 命中缓存: ${hotelName}`)
    return res.json({
      ...cached,
      fromCache: true
    })
  }

  // 2. 并行爬取所有平台
  const platformTasks = Object.entries(scrapers).map(async ([name, scraper]) => {
    try {
      const raw = await scraper.scrapeWithRetry(hotelName, city)
      if (raw) {
        return normalize(name, { ...raw, source: 'scraped' })
      }
    } catch (err) {
      console.warn(`[${name}] 跳过: ${err.message}`)
    }
    return null
  })

  const results = await Promise.all(platformTasks)
  const platforms = results.filter(Boolean)

  console.log(`📊 共获取 ${platforms.length}/4 平台数据`)

  // 3. 如果所有平台都失败，降级到 mock
  if (platforms.length === 0) {
    console.log(`⚠️ 无平台返回数据，降级到 mock`)
    const mockData = getMockPrices(hotelName)
    if (mockData) {
      return res.json(mockData)
    }
    return res.json({
      hotelName,
      updatedAt: new Date().toISOString(),
      fromCache: false,
      isMock: false,
      platforms: [],
      error: '所有平台爬取失败，且无 mock 数据'
    })
  }

  // 4. 检查是否至少有一个平台抓到了有效价格
  const hasValidPrice = platforms.some(p => p.minPrice > 0)

  // 5. 写入缓存并返回（仅当有有效价格或所有平台都尝试过时缓存）
  const responseData = {
    hotelName,
    updatedAt: new Date().toISOString(),
    fromCache: false,
    isMock: false,
    platforms
  }

  if (hasValidPrice || platforms.length >= 3) {
    // 有有效价格或大部分平台都返回了 → 缓存
    cache.set(hotelName, city, responseData)
  } else {
    console.log(`⚠️ 无有效价格且仅 ${platforms.length} 平台返回，不缓存（允许重试）`)
  }
  res.json(responseData)
})

/**
 * POST /api/hotels/batch
 * 批量查询酒店价格
 *
 * Body: { hotels: [{ name: "香格里拉", city: "深圳" }, ...] }
 */
app.post('/api/hotels/batch', async (req, res) => {
  const { hotels } = req.body

  if (!hotels || !Array.isArray(hotels) || hotels.length === 0) {
    return res.status(400).json({ error: '缺少 hotels 数组参数' })
  }

  if (hotels.length > 10) {
    return res.status(400).json({ error: '单次最多查询 10 家酒店' })
  }

  console.log(`\n📋 批量查询 ${hotels.length} 家酒店...`)

  // 逐个查询（避免同时打开过多浏览器页面）
  const results = []
  for (const h of hotels) {
    const cached = cache.get(h.name, h.city)
    if (cached) {
      results.push(cached)
      continue
    }

    const platformTasks = Object.entries(scrapers).map(async ([name, scraper]) => {
      try {
        const raw = await scraper.scrapeWithRetry(h.name, h.city || '')
        if (raw) return normalize(name, { ...raw, source: 'scraped' })
      } catch (err) { /* skip */ }
      return null
    })

    const platformResults = await Promise.all(platformTasks)
    const platforms = platformResults.filter(Boolean)

    if (platforms.length === 0) {
      const mock = getMockPrices(h.name)
      results.push(mock || { hotelName: h.name, platforms: [] })
    } else {
      const data = {
        hotelName: h.name,
        updatedAt: new Date().toISOString(),
        platforms
      }
      cache.set(h.name, h.city || '', data)
      results.push(data)
    }
  }

  res.json({ results })
})

/**
 * POST /api/cache/flush
 * 清空所有缓存（部署后使用）
 */
app.post('/api/cache/flush', (req, res) => {
  cache.flush()
  console.log('🗑️ 缓存已清空')
  res.json({ ok: true, message: '缓存已清空' })
})

/**
 * GET /api/health
 * 健康检查 + 缓存统计
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: cache.stats()
  })
})

// 优雅退出：关闭所有浏览器
process.on('SIGINT', async () => {
  console.log('\n🛑 关闭服务器...')
  for (const [name, scraper] of Object.entries(scrapers)) {
    console.log(`关闭 ${name} 浏览器...`)
    await scraper.closeBrowser()
  }
  process.exit(0)
})

// 启动服务
app.listen(config.port, () => {
  console.log(`\n🏨 酒店价格爬虫服务已启动: http://localhost:${config.port}`)
  console.log(`  健康检查: http://localhost:${config.port}/api/health`)
  console.log(`  价格查询: http://localhost:${config.port}/api/hotels/prices?hotelName=深圳福田香格里拉&city=深圳\n`)
})
