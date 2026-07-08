/**
 * 携程爬虫（v3 — 名称+地址精确匹配，无兜底估算）
 *
 * 策略：
 * 1. 拦截携程移动端 API 响应（JSONP/JSON）
 * 2. DOM 全页扫描兜底
 * 3. 酒店名称 + 地址双重匹配
 * 4. 未匹配到则返回 null
 */

const BaseScraper = require('./base')
const config = require('../config')

class XiechengScraper extends BaseScraper {
  constructor() {
    super('携程')
  }

  async scrape(hotelName, city, address) {
    const browser = await this.getBrowser()
    const page = await browser.newPage()
    const interceptedData = []

    try {
      await page.setViewport({ width: 390, height: 844, isMobile: true })
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' })

      // 拦截响应
      page.on('response', async (response) => {
        const url = response.url()
        const ct = response.headers()['content-type'] || ''
        if (ct.includes('json') || ct.includes('javascript') ||
            url.includes('/api/') || url.includes('/hotel/') ||
            url.includes('/rest/') || url.includes('/search/')) {
          try {
            const text = await response.text()
            if (text && text.length > 100 && text.length < 500000) {
              // 处理 JSONP: callback({...})
              let jsonStr = text
              const jsonpMatch = text.match(/^[^(]*\(([\s\S]*)\)\s*;?\s*$/)
              if (jsonpMatch) jsonStr = jsonpMatch[1]
              try {
                interceptedData.push({ url, data: JSON.parse(jsonStr) })
              } catch (_) { /* ignore */ }
            }
          } catch (_) { /* ignore */ }
        }
      })

      const keyword = encodeURIComponent(hotelName)
      const cityParam = city ? `&city=${encodeURIComponent(city)}` : ''
      const searchUrl = `https://m.ctrip.com/html5/hotel/search?keyword=${keyword}${cityParam}`

      console.log(`[携程] 搜索: ${searchUrl}`)
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: config.scrapeTimeout
      })

      await this.delay(2000)

      // ====== 方式1：API 拦截数据 ======
      for (const item of interceptedData) {
        const result = this._extractFromJSON(item.data, hotelName, address)
        if (result && result.minPrice > 0) {
          console.log(`[携程] ✅ API 拦截: ¥${result.minPrice}`)
          await page.close()
          return result
        }
      }

      // ====== 方式2：DOM 全页扫描 ======
      console.log('[携程] API 拦截未获取到有效数据，尝试 DOM 扫描...')

      const domResult = await page.evaluate((name, addr) => {
        const allElements = document.querySelectorAll('*')
        const candidates = []

        allElements.forEach((el) => {
          if (el.children.length > 0) return
          const text = el.textContent || ''
          const priceMatch = text.match(/[¥￥]\s*(\d+)/)
          if (priceMatch) {
            const price = parseInt(priceMatch[1])
            if (price >= 50 && price <= 50000) {
              const card = el.closest('div, li, a') || el.parentElement || el
              const cardText = (card.textContent || '').substring(0, 400)

              const nameChars = [...name]
              const nameScore = nameChars.filter(c => cardText.includes(c)).length / Math.max(name.length, 1)

              const addrChars = [...(addr || '')]
              const addrScore = addrChars.length > 0
                ? addrChars.filter(c => cardText.includes(c)).length / Math.max(addrChars.length, 1)
                : 0

              const combinedScore = addrChars.length > 0
                ? nameScore * 0.6 + addrScore * 0.4
                : nameScore

              if (combinedScore >= 0.3) {
                candidates.push({ price, text: cardText, nameScore, addrScore, combinedScore })
              }
            }
          }
        })

        candidates.sort((a, b) => b.combinedScore - a.combinedScore)
        const matched = candidates.filter(p => p.combinedScore >= 0.35)

        if (matched.length > 0) {
          const best = matched.slice(0, 5)
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

        // 无匹配：不做兜底估算
        return null
      }, hotelName, address || '')

      await page.close()

      if (domResult && domResult.minPrice > 0) {
        console.log(`[携程] ✅ DOM 扫描: ¥${domResult.minPrice} (匹配分: ${domResult._matchScore?.toFixed(2)})`)
        return { ...domResult, jumpUrl: domResult.jumpUrl || searchUrl }
      }

      console.warn(`[携程] ⚠️ 未找到匹配酒店`)
      return null

    } catch (err) {
      await page.close().catch(() => {})
      console.error(`[携程] 爬取异常:`, err.message)
      return null
    }
  }

  /**
   * 从 JSON 数据中提取酒店价格（名称+地址匹配）
   */
  _extractFromJSON(json, hotelName, address) {
    const results = []
    this._searchJSON(json, hotelName, address || '', results, 0)
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

  _searchJSON(obj, hotelName, address, results, depth) {
    if (!obj || depth > 10) return
    if (typeof obj !== 'object') return

    if (Array.isArray(obj)) {
      obj.slice(0, 50).forEach((item) => this._searchJSON(item, hotelName, address, results, depth + 1))
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
          const nameScore = hotelName.split('').filter(c => nameVal.includes(c)).length / Math.max(hotelName.length, 1)

          const addrVal = this._findValue(obj, /address|addr|location|position/i)
          const addrScore = (addrVal && typeof addrVal === 'string' && address)
            ? address.split('').filter(c => addrVal.includes(c)).length / Math.max(address.length, 1)
            : 0

          const combinedScore = address
            ? nameScore * 0.6 + addrScore * 0.4
            : nameScore

          if (combinedScore >= 0.3) {
            results.push({
              name: nameVal,
              minPrice: price,
              rating: this._findNum(obj, /rating|score|comment/i),
              reviewCount: 0,
              jumpUrl: this._findValue(obj, /url|link|href/i) || '',
              matchScore: combinedScore
            })
          }
        }
      }
    }

    for (const key of Object.keys(obj)) {
      const lk = key.toLowerCase()
      if (['data', 'result', 'list', 'items', 'hotels', 'pois', 'records', 'content', 'body'].includes(lk) ||
          !isNaN(parseInt(key))) {
        this._searchJSON(obj[key], hotelName, address, results, depth + 1)
      }
    }
  }

  _findValue(obj, pattern) {
    for (const key of Object.keys(obj)) {
      if (pattern.test(key)) return obj[key]
    }
    return null
  }

  _findNum(obj, pattern) {
    const val = this._findValue(obj, pattern)
    if (val != null) {
      const n = parseFloat(String(val).replace(/[^\d.]/g, ''))
      return isNaN(n) ? 0 : n
    }
    return 0
  }
}

module.exports = XiechengScraper
