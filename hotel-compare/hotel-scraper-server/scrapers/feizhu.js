/**
 * 飞猪爬虫（增强版）
 * URL: https://hotel.fliggy.com/search.htm?keyword=酒店名
 */

const BaseScraper = require('./base')
const config = require('../config')

class FeizhuScraper extends BaseScraper {
  constructor() {
    super('飞猪')
  }

  async scrape(hotelName, city) {
    const browser = await this.getBrowser()
    const page = await browser.newPage()
    const interceptedData = []

    try {
      await page.setViewport({ width: 390, height: 844, isMobile: true })
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' })

      page.on('response', async (response) => {
        const url = response.url()
        const ct = response.headers()['content-type'] || ''
        if (ct.includes('json') || ct.includes('javascript') ||
            url.includes('/api/') || url.includes('/hotel/') || url.includes('/search/') ||
            url.includes('h5.m.taobao.com')) {
          try {
            const text = await response.text()
            if (text && text.length > 100 && text.length < 500000) {
              let jsonStr = text
              const m = text.match(/^[^(]*\(([\s\S]*)\)\s*;?\s*$/)
              if (m) jsonStr = m[1]
              try { interceptedData.push({ url, data: JSON.parse(jsonStr) }) } catch (_) {}
            }
          } catch (_) {}
        }
      })

      const keyword = encodeURIComponent(hotelName)
      const searchUrl = `https://h5.m.taobao.com/trip/hotel/search?keyword=${keyword}`

      console.log(`[飞猪] 搜索: ${searchUrl}`)
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: config.scrapeTimeout
      })

      await this.delay(2000)

      // 检查登录墙
      const hasLogin = await page.$('.login-layer, .login-dialog, [class*="login"], .mask').catch(() => null)
      if (hasLogin) {
        console.warn('[飞猪] ⚠️ 登录弹窗，尝试关闭...')
        await page.evaluate(() => {
          const closeBtn = document.querySelector('.close, .cancel, [class*="close"], [class*="cancel"]')
          if (closeBtn) closeBtn.click()
        }).catch(() => {})
        await this.delay(1000)
      }

      // API 拦截
      for (const item of interceptedData) {
        const result = this._extractFromJSON(item.data, hotelName)
        if (result && result.minPrice > 0) {
          console.log(`[飞猪] ✅ API 拦截: ¥${result.minPrice}`)
          await page.close()
          return result
        }
      }

      // DOM 扫描
      console.log('[飞猪] DOM 扫描...')
      const domResult = await page.evaluate((name) => {
        const allElements = document.querySelectorAll('*')
        const candidates = []
        allElements.forEach((el) => {
          if (el.children.length > 0) return
          const text = el.textContent || ''
          const pm = text.match(/[¥￥]\s*(\d+)/)
          if (pm) {
            const price = parseInt(pm[1])
            if (price >= 50 && price <= 50000) {
              const card = el.closest('div, li, a') || el.parentElement || el
              const ct = (card.textContent || '').substring(0, 300)
              const nm = name.split('').filter(c => ct.includes(c)).length / Math.max(name.length, 1)
              candidates.push({ price, text: ct, nameMatch: nm })
            }
          }
        })
        candidates.sort((a, b) => b.nameMatch - a.nameMatch)
        const matched = candidates.filter(p => p.nameMatch >= 0.3)
        if (matched.length > 0) {
          matched.sort((a, b) => a.price - b.price)
          return {
            minPrice: matched[0].price,
            roomTypes: [], rating: 0, reviewCount: 0,
            jumpUrl: window.location.href
          }
        }
        const allPrices = candidates.map(p => p.price).sort((a, b) => a - b)
        if (allPrices.length > 0) {
          return {
            minPrice: allPrices[Math.max(0, Math.floor(allPrices.length * 0.05))],
            roomTypes: [], rating: 0, reviewCount: 0,
            jumpUrl: window.location.href
          }
        }
        return null
      }, hotelName)

      await page.close()

      if (domResult && domResult.minPrice > 0) {
        console.log(`[飞猪] ✅ DOM 扫描: ¥${domResult.minPrice}`)
        return { ...domResult, jumpUrl: domResult.jumpUrl || searchUrl }
      }

      console.warn('[飞猪] ⚠️ 未提取到有效价格（可能需要登录）')
      return { minPrice: 0, roomTypes: [], rating: 0, reviewCount: 0, jumpUrl: searchUrl }

    } catch (err) {
      await page.close().catch(() => {})
      console.error(`[飞猪] 异常:`, err.message)
      return { minPrice: 0, roomTypes: [], rating: 0, reviewCount: 0, jumpUrl: `https://h5.m.taobao.com/trip/hotel/search?keyword=${encodeURIComponent(hotelName)}` }
    }
  }

  _extractFromJSON(json, hotelName) {
    const results = []
    this._searchJSON(json, hotelName, results, 0)
    if (results.length === 0) return null
    results.sort((a, b) => a.minPrice - b.minPrice)
    const b = results[0]
    return { minPrice: b.minPrice, roomTypes: [], rating: b.rating || 0, reviewCount: b.reviewCount || 0, jumpUrl: b.jumpUrl || '' }
  }

  _searchJSON(obj, hotelName, results, depth) {
    if (!obj || depth > 10 || typeof obj !== 'object') return
    if (Array.isArray(obj)) { obj.slice(0, 50).forEach(i => this._searchJSON(i, hotelName, results, depth + 1)); return }
    const keys = Object.keys(obj)
    if (keys.some(k => /name|title/i.test(k)) && keys.some(k => /price|amount|fee/i.test(k))) {
      const nv = this._fv(obj, /name|title|hotel/i)
      const pv = this._fv(obj, /price|amount|min|lowest/i)
      if (nv && pv && typeof nv === 'string') {
        const price = parseInt(String(pv).replace(/[^\d]/g, ''))
        if (price >= 50 && price <= 50000) {
          const ms = hotelName.split('').filter(c => nv.includes(c)).length / Math.max(hotelName.length, 1)
          if (ms >= 0.2) results.push({ name: nv, minPrice: price, rating: 0, reviewCount: 0, jumpUrl: this._fv(obj, /url|link|href/i) || '', matchScore: ms })
        }
      }
    }
    for (const k of Object.keys(obj)) {
      if (['data','result','list','items','hotels','records','content'].includes(k.toLowerCase()) || !isNaN(parseInt(k)))
        this._searchJSON(obj[k], hotelName, results, depth + 1)
    }
  }

  _fv(obj, pattern) { for (const k of Object.keys(obj)) { if (pattern.test(k)) return obj[k] } return null }
}

module.exports = FeizhuScraper
