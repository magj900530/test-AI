/**
 * 降级用 mock 数据
 * 当爬取失败且无缓存时，返回预置的估算价格
 * 复用前端 hotels.json 的数据结构
 */

const hotels = require('./data/hotels.json')

/**
 * 按酒店名查找 mock 数据
 */
function findMockHotel(hotelName) {
  // 精确匹配
  let hotel = hotels.find(h => h.name === hotelName)
  // 模糊匹配
  if (!hotel) {
    hotel = hotels.find(h => h.name.includes(hotelName) || hotelName.includes(h.name))
  }
  return hotel || null
}

/**
 * 获取酒店的 mock 价格数据
 */
function getMockPrices(hotelName) {
  const hotel = findMockHotel(hotelName)
  if (!hotel) {
    return null
  }
  return {
    hotelName: hotel.name,
    updatedAt: new Date().toISOString(),
    fromCache: false,
    isMock: true,
    platforms: hotel.platforms.map(p => ({
      ...p,
      source: 'mock'
    }))
  }
}

module.exports = { getMockPrices, findMockHotel }
