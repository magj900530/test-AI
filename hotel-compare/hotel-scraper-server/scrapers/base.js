/**
 * 爬虫基类
 * 封装 Puppeteer 浏览器生命周期、重试、延迟等通用逻辑
 */

const config = require('../config')

class BaseScraper {
  constructor(platformName) {
    this.platform = platformName
    this.browser = null
  }

  /**
   * 启动浏览器实例（单例复用）
   */
  async getBrowser() {
    if (this.browser && this.browser.isConnected()) {
      return this.browser
    }
    const puppeteer = require('puppeteer-extra')
    const StealthPlugin = require('puppeteer-extra-plugin-stealth')
    puppeteer.use(StealthPlugin())

    const execPath = process.env.CHROMIUM_PATH
      || '/usr/bin/chromium-browser'
    const launchOpts = {
      ...config.browser,
      executablePath: execPath
    }

    this.browser = await puppeteer.launch(launchOpts)
    return this.browser
  }

  /**
   * 延迟等待
   * @param {number} ms 指定毫秒（可选，不传则随机 2~5 秒）
   */
  async delay(ms) {
    const wait = ms || (config.minDelay + Math.random() * (config.maxDelay - config.minDelay))
    console.log(`[${this.platform}] 等待 ${Math.round(wait)}ms...`)
    return new Promise(resolve => setTimeout(resolve, wait))
  }

  /**
   * 带重试的爬取
   * @param {string} hotelName 酒店名
   * @param {string} city 城市
   * @param {string} address 酒店地址（用于精确匹配）
   * @returns {object|null} 标准化后的价格数据，未找到返回 null
   */
  async scrapeWithRetry(hotelName, city, address) {
    let lastError = null

    for (let i = 0; i <= config.maxRetries; i++) {
      try {
        if (i > 0) {
          console.log(`[${this.platform}] 第 ${i} 次重试: ${hotelName}`)
          await this.delay()
        }
        const result = await this.scrape(hotelName, city, address)
        if (result && result.minPrice > 0) {
          console.log(`[${this.platform}] ✅ 成功: ${hotelName} → ¥${result.minPrice}`)
          return result
        }
        // 未找到匹配酒店，不算错误，返回 null
        if (result && result.minPrice === 0) {
          console.log(`[${this.platform}] ⚠️ 未找到匹配酒店: ${hotelName}`)
          return null
        }
      } catch (err) {
        lastError = err
        console.error(`[${this.platform}] ❌ 失败 (尝试 ${i + 1}/${config.maxRetries + 1}):`, err.message)
      }
    }

    console.warn(`[${this.platform}] ⚠️ 全部重试失败: ${hotelName}`)
    return null
  }

  /**
   * 子类必须实现：执行实际爬取逻辑
   * @param {string} hotelName 酒店名
   * @param {string} city 城市
   * @param {string} address 酒店地址
   * @returns {object|null} { minPrice, roomTypes, rating, reviewCount, jumpUrl } 或 null
   */
  async scrape(hotelName, city, address) {
    throw new Error(`子类必须实现 scrape() 方法`)
  }

  /**
   * 关闭浏览器
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }
}

module.exports = BaseScraper
