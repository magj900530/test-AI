/**
 * 酒店价格爬虫后端服务
 * Express + Puppeteer 代理抓取四平台价格
 *
 * 重要：只返回实际抓取到的平台价格，不做任何估算/兜底。
 * 酒店不在某平台 → 该平台不返回数据。
 */

const express = require('express')
const config = require('./config')
const cache = require('./cache')
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
 * Query: ?hotelName=深圳福田香格里拉大酒店&city=深圳&address=福田区益田路4088号
 * Response: { hotelName, updatedAt, platforms: [...] }
 *   仅返回实际抓取到酒店的平台（名称+地址匹配通过）
 */
app.get('/api/hotels/prices', async (req, res) => {
  const { hotelName, city = '', address = '' } = req.query

  if (!hotelName) {
    return res.status(400).json({ error: '缺少 hotelName 参数' })
  }

  console.log(`\n🔍 查询: "${hotelName}" (${city || '全国'}) [${address || '无地址'}]`)

  // 1. 先查缓存
  const cached = cache.get(hotelName, city)
  if (cached) {
    console.log(`📦 命中缓存: ${hotelName}`)
    return res.json({
      ...cached,
      fromCache: true
    })
  }

  // 2. 并行爬取所有平台（传入 address 用于精确匹配）
  const platformTasks = Object.entries(scrapers).map(async ([name, scraper]) => {
    try {
      const raw = await scraper.scrapeWithRetry(hotelName, city, address)
      if (raw && raw.minPrice > 0) {
        console.log(`[${name}] ✅ 已找到: ¥${raw.minPrice}`)
        return normalize(name, { ...raw, source: 'scraped' })
      } else {
        console.log(`[${name}] ⚠️ 未在该平台上架`)
      }
    } catch (err) {
      console.warn(`[${name}] 跳过: ${err.message}`)
    }
    return null
  })

  const results = await Promise.all(platformTasks)
  const platforms = results.filter(Boolean)

  console.log(`📊 共 ${platforms.length}/4 平台找到该酒店`)

  // 3. 构建响应（仅包含实际找到的平台）
  const responseData = {
    hotelName,
    updatedAt: new Date().toISOString(),
    fromCache: false,
    isMock: false,
    platforms
  }

  // 4. 缓存（有有效价格时缓存，避免缓存空结果）
  const hasValidPrice = platforms.some(p => p.minPrice > 0)
  if (hasValidPrice) {
    cache.set(hotelName, city, responseData)
  } else {
    console.log(`⚠️ 所有平台均未找到该酒店，不缓存（允许重试）`)
  }

  res.json(responseData)
})

/**
 * POST /api/hotels/batch
 * 批量查询酒店价格
 *
 * Body: { hotels: [{ name: "香格里拉", city: "深圳", address: "福田区..." }, ...] }
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

    const address = h.address || ''

    const platformTasks = Object.entries(scrapers).map(async ([name, scraper]) => {
      try {
        const raw = await scraper.scrapeWithRetry(h.name, h.city || '', address)
        if (raw && raw.minPrice > 0) return normalize(name, { ...raw, source: 'scraped' })
      } catch (err) { /* skip */ }
      return null
    })

    const platformResults = await Promise.all(platformTasks)
    const platforms = platformResults.filter(Boolean)

    const data = {
      hotelName: h.name,
      updatedAt: new Date().toISOString(),
      platforms
    }

    if (platforms.length > 0) {
      cache.set(h.name, h.city || '', data)
    }
    results.push(data)
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
  console.log(`  价格查询: http://localhost:${config.port}/api/hotels/prices?hotelName=深圳福田香格里拉&city=深圳&address=福田区\n`)
})
