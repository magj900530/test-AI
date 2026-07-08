/**
 * 携程爬虫（增强版）
 *
 * 策略：
 * 1. 拦截携程移动端 API 响应（携程用 JSONP/JSON 加载酒店列表）
 * 2. DOM 扫描兜底
 * 3. 名称模糊匹配
 * 4. 取各房型最低价
 */

const BaseScraper = require('./base')
const config = require('../config')

class XiechengScraper extends BaseScraper {
  constructor() {
    super('携程')
  }

  async scrape(hotelName, city) {
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
      let apiResult = null
      for (const item of interceptedData) {
        apiResult = this._extractFromJSON(item.data, hotelName)
        if (apiResult && apiResult.minPrice > 0) {
          console.log(`[携程] ✅ 从 API 拦截数据中提取到价格: ¥${apiResult.minPrice}`)
          break
        }
      }

      if (apiResult && apiResult.minPrice > 0) {
        await page.close()
        return apiResult
      }

      // ====== 方式2：DOM 扫描 ======
      console.log('[携程] API 拦截未获取到有效数据，尝试 DOM 扫描...')

      const domResult = await page.evaluate((name) => {
        const allElements = document.querySelectorAll('*')
        const priceCandidates = []

        allElements.forEach((el) => {
          if (el.children.length > 0) return // 只检查叶子节点
          const text = el.textContent || ''
          const priceMatch = text.match(/[¥￥]\s*(\d+)/)
          if (priceMatch) {
            const price = parseInt(priceMatch[1])
            if (price >= 50 && price <= 50000) {
              const card = el.closest('div, li, a') || el.parentElement || el
              const cardText = (card.textContent || '').substring(0, 300)
              const nameMatch = name.split('').filter(c => cardText.includes(c)).length / Math.max(name.length, 1)
              priceCandidates.push({ price, text: cardText, nameMatch })
            }
          }
        })

        // 按名称匹配度排序
        priceCandidates.sort((a, b) => b.nameMatch - a.nameMatch)
        const matched = priceCandidates.filter(p => p.nameMatch >= 0.3)

        if (matched.length > 0) {
          const best = matched.slice(0, 5)
          best.sort((a, b) => a.price - b.price)
          return {
            minPrice: best[0].price,
            roomTypes: [],
            rating: 0,
            reviewCount: 0,
            jumpUrl: window.location.href
          }
        }

        // 兜底：全页最低价
        const allPrices = priceCandidates.map(p => p.price).sort((a, b) => a - b)
        if (allPrices.length > 0) {
          const idx = Math.max(0, Math.floor(allPrices.length * 0.05))
          return {
            minPrice: allPrices[idx],
            roomTypes: [],
            rating: 0,
            reviewCount: 0,
            jumpUrl: window.location.href
          }
        }

        return null
      }, hotelName)

      await page.close()

      if (domResult && domResult.minPrice > 0) {
        console.log(`[携程] ✅ DOM 扫描提取到价格: ¥${domResult.minPrice}`)
        return { ...domResult, jumpUrl: domResult.jumpUrl || searchUrl }
      }

      console.warn(`[携程] ⚠️ 所有方式均未提取到有效价格`)
      return {
        minPrice: 0,
        roomTypes: [],
        rating: 0,
        reviewCount: 0,
        jumpUrl: searchUrl
      }

    } catch (err) {
      await page.close().catch(() => {})
      console.error(`[携程] 爬取异常:`, err.message)
      return {
        minPrice: 0,
        roomTypes: [],
        rating: 0,
        reviewCount: 0,
        jumpUrl: `https://m.ctrip.com/html5/hotel/search?keyword=${encodeURIComponent(hotelName)}`
      }
    }
  }

  /**
   * 从 JSON 数据中提取酒店价格
   */
  _extractFromJSON(json, hotelName) {
    const results = []
    this._searchJSON(json, hotelName, results, 0)
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

  _searchJSON(obj, hotelName, results, depth) {
    if (!obj || depth > 10) return
    if (typeof obj !== 'object') return

    if (Array.isArray(obj)) {
      // 对数组前50个元素搜索
      obj.slice(0, 50).forEach((item) => this._searchJSON(item, hotelName, results, depth + 1))
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
          const matchScore = hotelName.split('').filter(c => nameVal.includes(c)).length / Math.max(hotelName.length, 1)
          if (matchScore >= 0.2) {
            results.push({
              name: nameVal,
              minPrice: price,
              rating: this._findNum(obj, /rating|score|comment/i),
              reviewCount: 0,
              jumpUrl: this._findValue(obj, /url|link|href/i) || '',
              matchScore
            })
          }
        }
      }
    }

    // 递归
    for (const key of Object.keys(obj)) {
      const lk = key.toLowerCase()
      if (['data', 'result', 'list', 'items', 'hotels', 'pois', 'records', 'content', 'body'].includes(lk) ||
          !isNaN(parseInt(key))) {
        this._searchJSON(obj[key], hotelName, results, depth + 1)
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
