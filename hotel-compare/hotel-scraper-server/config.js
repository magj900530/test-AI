/**
 * 爬虫服务配置
 */
module.exports = {
  // 服务端口
  port: process.env.PORT || 3001,

  // 缓存 TTL（秒）
  cacheTTL: 30 * 60, // 30 分钟

  // 爬取超时（毫秒）
  scrapeTimeout: 15000,

  // 单平台并发上限
  maxConcurrent: 2,

  // 重试次数
  maxRetries: 2,

  // 请求间隔（毫秒）- 随机 2~5 秒
  minDelay: 2000,
  maxDelay: 5000,

  // 浏览器配置
  browser: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--lang=zh-CN'
    ]
  }
}
