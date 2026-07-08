/**
 * HTTP 请求封装
 * 预留真实 API 对接能力，MVP 阶段用于基础网络请求
 */

// 后端爬虫服务地址
// TODO: 绑定域名后替换为 https://your-domain.com
const BASE_URL = 'http://162.14.75.110:3001'

// 请求拦截器
function beforeRequest(config) {
  // TODO: 添加 token、签名等
  return config
}

// 响应拦截器
function afterResponse(response) {
  const { statusCode, data } = response
  if (statusCode === 200) {
    return data
  }
  throw new Error(`请求失败: ${statusCode}`)
}

/**
 * 通用 GET 请求
 */
export function get(url, params = {}) {
  return new Promise((resolve, reject) => {
    const config = beforeRequest({ url: BASE_URL + url, data: params })
    uni.request({
      ...config,
      method: 'GET',
      success: (res) => {
        try {
          resolve(afterResponse(res))
        } catch (e) {
          reject(e)
        }
      },
      fail: (err) => {
        console.error('请求失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 通用 POST 请求
 */
export function post(url, data = {}) {
  return new Promise((resolve, reject) => {
    const config = beforeRequest({ url: BASE_URL + url, data })
    uni.request({
      ...config,
      method: 'POST',
      success: (res) => {
        try {
          resolve(afterResponse(res))
        } catch (e) {
          reject(e)
        }
      },
      fail: (err) => {
        console.error('请求失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 搜索酒店（预留接口）
 */
export function searchHotels(params) {
  return get('/api/hotels/search', params)
}

/**
 * 获取酒店详情（预留接口）
 */
export function getHotelDetail(hotelId) {
  return get(`/api/hotels/${hotelId}`)
}

/**
 * 获取实时价格对比（调用后端爬虫服务）
 * @param {string} hotelName 酒店名
 * @param {string} city 城市
 */
export function getPriceCompare(hotelName, city = '', address = '') {
  return get('/api/hotels/prices', { hotelName, city, address })
}

/**
 * 批量获取酒店价格
 * @param {Array<{name: string, city: string}>} hotels
 */
export function batchGetPrices(hotels) {
  return post('/api/hotels/batch', { hotels })
}
