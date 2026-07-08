/**
 * 飞猪爬虫（v3 — 名称+地址精确匹配，无兜底估算）
 *
 * 策略：
 * 1. 拦截 API 响应
 * 2. DOM 全页扫描兜底
 * 3. 酒店名称 + 地址双重匹配
 * 4. 未匹配到则返回 null
 */

const BaseScraper = require('./base')
const config = require('../config')

class FeizhuScraper extends BaseScraper {
  constructor() {
    super('飞猪')
  }

  async scrape(hotelName, city, address) {
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
        const result = this._extractFromJSON(item.data, hotelName, address)
        if (result && result.minPrice > 0) {
          console.log(`[飞猪] ✅ API 拦截: ¥${result.minPrice}`)
          await page.close()
          return result
        }
      }

      // DOM 扫描
      console.log('[飞猪] DOM 扫描...')
      const domResult = await page.evaluate((name, addr) => {
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
        const matched = candidates.filter(p => p.combinedScore >= 0.5)

        if (matched.length > 0) {
          matched.sort((a, b) => a.price - b.price)
          return {
            minPrice: matched[0].price,
            roomTypes: [], rating: 0, reviewCount: 0,
            jumpUrl: window.location.href,
            _matchScore: matched[0].combinedScore
          }
        }

        return null
      }, hotelName, address || '')

      await page.close()

      if (domResult && domResult.minPrice > 0) {
        console.log(`[飞猪] ✅ DOM 扫描: ¥${domResult.minPrice} (匹配分: ${domResult._matchScore?.toFixed(2)})`)
        return { ...domResult, jumpUrl: domResult.jumpUrl || searchUrl }
      }

      console.warn('[飞猪] ⚠️ 未找到匹配酒店（可能需要登录）')
      return null

    } catch (err) {
      await page.close().catch(() => {})
      console.error(`[飞猪] 异常:`, err.message)
      return null
    }
  }

  _extractFromJSON(json, hotelName, address) {
    const results = []
    this._searchJSON(json, hotelName, address || '', results, 0)
    if (results.length === 0) return null
    results.sort((a, b) => a.minPrice - b.minPrice)
    const b = results[0]
    return { minPrice: b.minPrice, roomTypes: [], rating: b.rating || 0, reviewCount: b.reviewCount || 0, jumpUrl: b.jumpUrl || '' }
  }

  _searchJSON(obj, hotelName, address, results, depth) {
    if (!obj || depth > 10 || typeof obj !== 'object') return
    if (Array.isArray(obj)) { obj.slice(0, 50).forEach(i => this._searchJSON(i, hotelName, address, results, depth + 1)); return }
    const keys = Object.keys(obj)
    if (keys.some(k => /name|title/i.test(k)) && keys.some(k => /price|amount|fee/i.test(k))) {
      const nv = this._fv(obj, /name|title|hotel/i)
      const pv = this._fv(obj, /price|amount|min|lowest/i)
      if (nv && pv && typeof nv === 'string') {
        const price = parseInt(String(pv).replace(/[^\d]/g, ''))
        if (price >= 50 && price <= 50000) {
          const nameScore = hotelName.split('').filter(c => nv.includes(c)).length / Math.max(hotelName.length, 1)
          const av = this._fv(obj, /address|addr|location|position/i)
          const addrScore = (av && typeof av === 'string' && address)
            ? address.split('').filter(c => av.includes(c)).length / Math.max(address.length, 1)
            : 0
          const combinedScore = address ? nameScore * 0.6 + addrScore * 0.4 : nameScore
          if (combinedScore >= 0.4) {
            results.push({ name: nv, minPrice: price, rating: 0, reviewCount: 0, jumpUrl: this._fv(obj, /url|link|href/i) || '', matchScore: combinedScore })
          }
        }
      }
    }
    for (const k of Object.keys(obj)) {
      if (['data','result','list','items','hotels','records','content'].includes(k.toLowerCase()) || !isNaN(parseInt(k)))
        this._searchJSON(obj[k], hotelName, address, results, depth + 1)
    }
  }

  _fv(obj, pattern) { for (const k of Object.keys(obj)) { if (pattern.test(k)) return obj[k] } return null }
}

module.exports = FeizhuScraper
