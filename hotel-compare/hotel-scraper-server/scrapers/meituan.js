/**
 * 美团爬虫（增强版）
 *
 * 策略：
 * 1. 拦截 XHR/fetch 响应，直接捕获 API 数据
 * 2. DOM 解析兜底 — 全页扫描价格元素
 * 3. 名称模糊匹配找目标酒店
 * 4. 取最低价（考虑不同房型）
 */

const BaseScraper = require('./base')
const config = require('../config')

class MeituanScraper extends BaseScraper {
  constructor() {
    super('美团')
  }

  async scrape(hotelName, city) {
    const browser = await this.getBrowser()
    const page = await browser.newPage()

    // 收集拦截到的 API 数据
    const interceptedData = []

    try {
      await page.setViewport({ width: 390, height: 844, isMobile: true })
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' })

      // 监听响应，捕获酒店列表 API（不需要 request interception）
      page.on('response', async (response) => {
        const url = response.url()
        const contentType = response.headers()['content-type'] || ''
        // 捕获可能包含酒店数据的 JSON 响应
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

      // 额外等待 JS 渲染
      await this.delay(2000)

      // ====== 方式1：从拦截的 API 数据中提取 ======
      let apiResult = null
      for (const item of interceptedData) {
        apiResult = this._extractFromJSON(item.data, hotelName)
        if (apiResult && apiResult.minPrice > 0) {
          console.log(`[美团] ✅ 从 API 拦截数据中提取到价格: ¥${apiResult.minPrice}`)
          break
        }
      }

      if (apiResult && apiResult.minPrice > 0) {
        await page.close()
        return apiResult
      }

      // ====== 方式2：DOM 全页扫描 ======
      console.log('[美团] API 拦截未获取到有效数据，尝试 DOM 扫描...')

      const domResult = await page.evaluate((name) => {
        // 通用价格提取：找页面中所有包含 ¥ 或 ￥ 的元素
        const allElements = document.querySelectorAll('*')
        const priceCandidates = []

        allElements.forEach((el) => {
          const text = el.textContent || ''
          // 匹配价格模式：¥123、￥123、123元、123起
          const priceMatch = text.match(/[¥￥]\s*(\d+)\s*(?:起|元)?/)
          if (priceMatch) {
            const price = parseInt(priceMatch[1])
            if (price >= 50 && price <= 50000) {
              // 找到该元素所在的卡片容器
              const card = el.closest('div[class], li[class], a[class]') || el
              const cardText = card.textContent || ''
              priceCandidates.push({
                price,
                text: cardText.substring(0, 200),
                // 计算名称相似度（简单的包含匹配）
                nameMatch: name.split('').filter(c => cardText.includes(c)).length / name.length
              })
            }
          }
        })

        // 按名称匹配度排序，取最佳匹配
        priceCandidates.sort((a, b) => b.nameMatch - a.nameMatch)

        // 过滤掉名称匹配度太低的（< 0.3）
        const matched = priceCandidates.filter(p => p.nameMatch >= 0.3)

        if (matched.length > 0) {
          // 取匹配度最高的几个中价格最低的
          const best = matched.slice(0, 3)
          best.sort((a, b) => a.price - b.price)
          return {
            minPrice: best[0].price,
            roomTypes: [],
            rating: 0,
            reviewCount: 0,
            jumpUrl: window.location.href
          }
        }

        // 兜底：找页面上所有价格数字，取最合理的
        const allPrices = priceCandidates.map(p => p.price).sort((a, b) => a - b)
        if (allPrices.length > 0) {
          // 取第10百分位数作为最低价估计
          const idx = Math.floor(allPrices.length * 0.1)
          return {
            minPrice: allPrices[Math.min(idx, allPrices.length - 1)],
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
        console.log(`[美团] ✅ DOM 扫描提取到价格: ¥${domResult.minPrice}`)
        return { ...domResult, jumpUrl: domResult.jumpUrl || searchUrl }
      }

      console.warn(`[美团] ⚠️ 所有方式均未提取到有效价格`)
      return {
        minPrice: 0,
        roomTypes: [],
        rating: 0,
        reviewCount: 0,
        jumpUrl: searchUrl
      }

    } catch (err) {
      await page.close().catch(() => {})
      console.error(`[美团] 爬取异常:`, err.message)
      return {
        minPrice: 0,
        roomTypes: [],
        rating: 0,
        reviewCount: 0,
        jumpUrl: `https://i.meituan.com/hotel/list?keyword=${encodeURIComponent(hotelName)}`
      }
    }
  }

  /**
   * 从拦截的 JSON 数据中提取酒店价格
   */
  _extractFromJSON(json, hotelName) {
    // 递归搜索 JSON 中包含酒店名和价格的节点
    const results = []
    this._searchJSON(json, hotelName, results, '', 0)
    if (results.length === 0) return null

    // 取价格最低的
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

  _searchJSON(obj, hotelName, results, path, depth) {
    if (!obj || depth > 8) return
    if (typeof obj !== 'object') return

    if (Array.isArray(obj)) {
      obj.forEach((item, i) => this._searchJSON(item, hotelName, results, `${path}[${i}]`, depth + 1))
      return
    }

    // 检查当前对象是否包含酒店相关信息
    const keys = Object.keys(obj)
    const hasName = keys.some(k => /name|title|hotel/i.test(k))
    const hasPrice = keys.some(k => /price|amount|fee|rate/i.test(k))

    if (hasName && hasPrice) {
      // 找到名称字段
      const nameVal = this._findValue(obj, /name|title|hotel/i)
      const priceVal = this._findValue(obj, /price|amount|lowest|min/i)

      if (nameVal && priceVal && typeof nameVal === 'string') {
        const price = parseInt(String(priceVal).replace(/[^\d]/g, ''))
        if (price >= 50 && price <= 50000) {
          const matchScore = hotelName.split('').filter(c => nameVal.includes(c)).length / hotelName.length
          if (matchScore >= 0.2) {
            const ratingVal = this._findValue(obj, /rating|score|comment/i)
            results.push({
              name: nameVal,
              minPrice: price,
              rating: ratingVal ? parseFloat(String(ratingVal).replace(/[^\d.]/g, '')) || 0 : 0,
              reviewCount: 0,
              jumpUrl: this._findValue(obj, /url|link|href/i) || '',
              matchScore
            })
          }
        }
      }
    }

    // 递归搜索子对象
    for (const key of Object.keys(obj)) {
      if (['children', 'list', 'data', 'result', 'pois', 'hotels', 'items', 'records'].includes(key.toLowerCase()) ||
          !isNaN(parseInt(key))) {
        this._searchJSON(obj[key], hotelName, results, `${path}.${key}`, depth + 1)
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
