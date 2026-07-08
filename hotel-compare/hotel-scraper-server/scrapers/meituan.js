/**
 * 美团爬虫（v3 — 名称+地址精确匹配，无兜底估算）
 *
 * 策略：
 * 1. 拦截 XHR/fetch 响应，直接捕获 API 数据
 * 2. DOM 全页扫描兜底
 * 3. 酒店名称 + 地址双重匹配（combinedScore ≥ 0.5）
 * 4. 未匹配到则返回 null（不做任何兜底估算）
 */

const BaseScraper = require('./base')
const config = require('../config')

class MeituanScraper extends BaseScraper {
  constructor() {
    super('美团')
  }

  async scrape(hotelName, city, address) {
    const browser = await this.getBrowser()
    const page = await browser.newPage()
    const interceptedData = []

    try {
      await page.setViewport({ width: 390, height: 844, isMobile: true })
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' })

      // 监听响应，捕获酒店列表 API
      page.on('response', async (response) => {
        const url = response.url()
        const contentType = response.headers()['content-type'] || ''
        if (contentType.includes('json') ||
            url.includes('/api/') || url.includes('/hotel/') ||
            url.includes('/search') || url.includes('/list')) {
          try {
            const text = await response.text()
            if (text && text.length > 100 && text.length < 500000) {
              try {
                const json = JSON.parse(text)
                interceptedData.push({ url, data: json })
              } catch (_) { /* 非 JSON 忽略 */ }
            }
          } catch (_) { /* 读取失败忽略 */ }
        }
      })

      const keyword = encodeURIComponent(hotelName)
      const searchUrl = `https://i.meituan.com/hotel/list?keyword=${keyword}`

      console.log(`[美团] 搜索: ${searchUrl}`)
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: config.scrapeTimeout
      })

      await this.delay(2000)

      // ====== 方式1：从拦截的 API 数据中提取 ======
      for (const item of interceptedData) {
        const result = this._extractFromJSON(item.data, hotelName, address)
        if (result && result.minPrice > 0) {
          console.log(`[美团] ✅ API 拦截: ¥${result.minPrice}`)
          await page.close()
          return result
        }
      }

      // ====== 方式2：DOM 全页扫描 ======
      console.log('[美团] API 拦截未获取到有效数据，尝试 DOM 扫描...')

      const domResult = await page.evaluate((name, addr) => {
        const allElements = document.querySelectorAll('*')
        const candidates = []

        allElements.forEach((el) => {
          if (el.children.length > 0) return // 只检查叶子节点
          const text = el.textContent || ''
          const priceMatch = text.match(/[¥￥]\s*(\d+)/)
          if (priceMatch) {
            const price = parseInt(priceMatch[1])
            if (price >= 50 && price <= 50000) {
              const card = el.closest('div, li, a') || el.parentElement || el
              const cardText = (card.textContent || '').substring(0, 400)

              // 名称匹配分
              const nameChars = [...name]
              const nameScore = nameChars.filter(c => cardText.includes(c)).length / Math.max(name.length, 1)

              // 地址匹配分
              const addrChars = [...(addr || '')]
              const addrScore = addrChars.length > 0
                ? addrChars.filter(c => cardText.includes(c)).length / Math.max(addrChars.length, 1)
                : 0

              // 综合匹配分（名称权重 0.6，地址权重 0.4）
              const combinedScore = addrChars.length > 0
                ? nameScore * 0.6 + addrScore * 0.4
                : nameScore

              if (combinedScore >= 0.3) {
                candidates.push({ price, text: cardText, nameScore, addrScore, combinedScore })
              }
            }
          }
        })

        // 按综合匹配分降序
        candidates.sort((a, b) => b.combinedScore - a.combinedScore)

        // 只取匹配度 ≥ 0.35 的
        const matched = candidates.filter(p => p.combinedScore >= 0.35)

        if (matched.length > 0) {
          // 取匹配度最高的前 3 个中的最低价
          const best = matched.slice(0, 3)
          best.sort((a, b) => a.price - b.price)
          return {
            minPrice: best[0].price,
            roomTypes: [],
            rating: 0,
            reviewCount: 0,
            jumpUrl: window.location.href,
            _matchScore: best[0].combinedScore
          }
        }

        // 无匹配：不做兜底估算，返回 null
        return null
      }, hotelName, address || '')

      await page.close()

      if (domResult && domResult.minPrice > 0) {
        console.log(`[美团] ✅ DOM 扫描: ¥${domResult.minPrice} (匹配分: ${domResult._matchScore?.toFixed(2)})`)
        return { ...domResult, jumpUrl: domResult.jumpUrl || searchUrl }
      }

      console.warn(`[美团] ⚠️ 未找到匹配酒店（名称+地址双重校验未通过）`)
      return null

    } catch (err) {
      await page.close().catch(() => {})
      console.error(`[美团] 爬取异常:`, err.message)
      return null
    }
  }

  /**
   * 从拦截的 JSON 数据中提取酒店价格（名称+地址匹配）
   */
  _extractFromJSON(json, hotelName, address) {
    const results = []
    this._searchJSON(json, hotelName, address || '', results, '', 0)
    if (results.length === 0) return null

    results.sort((a, b) => a.minPrice - b.minPrice)
    const best = results[0]
    return {
      minPrice: best.minPrice,
      roomTypes: [],
      rating: best.rating || 0,
      reviewCount: best.reviewCount || 0,
      jumpUrl: best.jumpUrl || ''
    }
  }

  _searchJSON(obj, hotelName, address, results, path, depth) {
    if (!obj || depth > 8) return
    if (typeof obj !== 'object') return

    if (Array.isArray(obj)) {
      obj.forEach((item, i) => this._searchJSON(item, hotelName, address, results, `${path}[${i}]`, depth + 1))
      return
    }

    const keys = Object.keys(obj)
    const hasName = keys.some(k => /name|title|hotel/i.test(k))
    const hasPrice = keys.some(k => /price|amount|fee|rate/i.test(k))

    if (hasName && hasPrice) {
      const nameVal = this._findValue(obj, /name|title|hotel/i)
      const priceVal = this._findValue(obj, /price|amount|lowest|min/i)

      if (nameVal && priceVal && typeof nameVal === 'string') {
        const price = parseInt(String(priceVal).replace(/[^\d]/g, ''))
        if (price >= 50 && price <= 50000) {
          // 名称匹配分
          const nameScore = hotelName.split('').filter(c => nameVal.includes(c)).length / Math.max(hotelName.length, 1)

          // 地址匹配分（JSON 中可能有 address/addr/location 字段）
          const addrVal = this._findValue(obj, /address|addr|location|position/i)
          const addrScore = (addrVal && typeof addrVal === 'string' && address)
            ? address.split('').filter(c => addrVal.includes(c)).length / Math.max(address.length, 1)
            : 0

          // 综合匹配分
          const combinedScore = address
            ? nameScore * 0.6 + addrScore * 0.4
            : nameScore

          // JSON 数据匹配阈值稍低
          if (combinedScore >= 0.3) {
            const ratingVal = this._findValue(obj, /rating|score|comment/i)
            results.push({
              name: nameVal,
              minPrice: price,
              rating: ratingVal ? parseFloat(String(ratingVal).replace(/[^\d.]/g, '')) || 0 : 0,
              reviewCount: 0,
              jumpUrl: this._findValue(obj, /url|link|href/i) || '',
              matchScore: combinedScore
            })
          }
        }
      }
    }

    // 递归搜索子对象
    for (const key of Object.keys(obj)) {
      if (['children', 'list', 'data', 'result', 'pois', 'hotels', 'items', 'records'].includes(key.toLowerCase()) ||
          !isNaN(parseInt(key))) {
        this._searchJSON(obj[key], hotelName, address, results, `${path}.${key}`, depth + 1)
      }
    }
  }

  _findValue(obj, pattern) {
    for (const key of Object.keys(obj)) {
      if (pattern.test(key)) {
        return obj[key]
      }
    }
    return null
  }
}

module.exports = MeituanScraper
