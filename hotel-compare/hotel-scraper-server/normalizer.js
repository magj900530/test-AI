/**
 * 数据标准化器
 * 将各平台爬取的原始数据统一为前端数据模型
 */

/**
 * 标准化单个平台的价格数据
 */
function normalize(platform, rawData) {
  const template = platformTemplates[platform]
  if (!template) {
    console.warn(`未知平台: ${platform}`)
    return null
  }

  return {
    platform: template.platform,
    platformName: template.platformName,
    minPrice: rawData.minPrice != null ? rawData.minPrice : 0,
    roomTypes: (rawData.roomTypes || []).map(room => ({
      name: room.name || '标准房',
      price: room.price || rawData.minPrice || 0,
      breakfast: room.breakfast || false,
      cancelFree: room.cancelFree || false
    })),
    rating: rawData.rating || 0,
    reviewCount: rawData.reviewCount || 0,
    jumpUrl: rawData.jumpUrl || template.jumpUrl,
    deepLink: rawData.deepLink || template.deepLink,
    source: rawData.source || 'scraped'
  }
}

/**
 * 平台模板配置
 */
const platformTemplates = {
  meituan: {
    platform: 'meituan',
    platformName: '美团',
    jumpUrl: 'https://hotel.meituan.com/',
    deepLink: 'meituan://hotel/detail'
  },
  xiecheng: {
    platform: 'xiecheng',
    platformName: '携程',
    jumpUrl: 'https://hotels.ctrip.com/',
    deepLink: 'ctrip://hotel/detail'
  },
  qunar: {
    platform: 'qunar',
    platformName: '去哪儿',
    jumpUrl: 'https://hotel.qunar.com/',
    deepLink: 'qunar://hotel/detail'
  },
  feizhu: {
    platform: 'feizhu',
    platformName: '飞猪',
    jumpUrl: 'https://hotel.fliggy.com/',
    deepLink: 'fliggy://hotel/detail'
  }
}

module.exports = { normalize, platformTemplates }
