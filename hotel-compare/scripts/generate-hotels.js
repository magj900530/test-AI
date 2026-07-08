/**
 * 生成模拟酒店数据
 * 深圳、北京、上海各 25 家酒店
 */

const fs = require('fs')
const path = require('path')

// 深圳福田/南山区域酒店
const szHotels = [
  { name: '深圳福田香格里拉大酒店', address: '深圳市福田区益田路4088号', lat: 22.5362, lng: 114.0579, star: 5, amenities: ['WiFi','健身房','游泳池','免费停车','商务中心','行政酒廊'] },
  { name: '深圳柏悦酒店', address: '深圳市福田区益田路5023号平安金融中心', lat: 22.5368, lng: 114.0585, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','商务中心','管家服务'] },
  { name: '深圳四季酒店', address: '深圳市福田区福华三路138号', lat: 22.5355, lng: 114.0592, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','行政酒廊','接机服务'] },
  { name: '深圳丽思卡尔顿酒店', address: '深圳市福田区福华三路116号', lat: 22.5348, lng: 114.0588, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','行政酒廊'] },
  { name: '深圳君悦酒店', address: '深圳市罗湖区宝安南路1881号', lat: 22.5425, lng: 114.1078, star: 5, amenities: ['WiFi','健身房','游泳池','商务中心','免费停车'] },
  { name: '深圳瑞吉酒店', address: '深圳市罗湖区深南东路5016号京基100大厦', lat: 22.5451, lng: 114.1052, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','管家服务'] },
  { name: '深圳大中华希尔顿酒店', address: '深圳市福田区深南大道1003号', lat: 22.5385, lng: 114.0621, star: 4, amenities: ['WiFi','健身房','游泳池','商务中心','免费停车'] },
  { name: '深圳福田喜来登酒店', address: '深圳市福田区福华路大中华国际交易广场', lat: 22.5378, lng: 114.0615, star: 4, amenities: ['WiFi','健身房','游泳池','行政酒廊'] },
  { name: '深圳绿景锦江酒店', address: '深圳市福田区新洲路3099号', lat: 22.5312, lng: 114.0488, star: 4, amenities: ['WiFi','健身房','商务中心','免费停车'] },
  { name: '深圳温德姆至尊酒店', address: '深圳市福田区彩田路2009号', lat: 22.5401, lng: 114.0662, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','商务中心'] },
  { name: '深圳中洲万豪酒店', address: '深圳市南山区海德一道88号', lat: 22.5178, lng: 113.9385, star: 5, amenities: ['WiFi','健身房','游泳池','行政酒廊','管家服务'] },
  { name: '深圳湾木棉花酒店', address: '深圳市南山区滨海大道3001号', lat: 22.5142, lng: 113.9456, star: 4, amenities: ['WiFi','健身房','免费停车'] },
  { name: '深圳JW万豪酒店', address: '深圳市福田区深南大道6005号', lat: 22.5398, lng: 114.0456, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','行政酒廊','商务中心'] },
  { name: '深圳威尼斯睿途酒店', address: '深圳市南山区深南大道9026号', lat: 22.5372, lng: 113.9755, star: 5, amenities: ['WiFi','健身房','游泳池','SPA'] },
  { name: '深圳东海朗廷酒店', address: '深圳市福田区深南大道7888号', lat: 22.5345, lng: 114.0289, star: 5, amenities: ['WiFi','健身房','游泳池','行政酒廊','商务中心'] },
  { name: '深圳马哥孛罗好日子酒店', address: '深圳市福田区福华一路28号', lat: 22.5359, lng: 114.0605, star: 4, amenities: ['WiFi','健身房','商务中心','免费停车'] },
  { name: '深圳皇庭V酒店', address: '深圳市福田区金田路2028号', lat: 22.5333, lng: 114.0632, star: 4, amenities: ['WiFi','健身房','游泳池','免费停车'] },
  { name: '深圳硬石酒店', address: '深圳市龙华区观澜高尔夫大道9号', lat: 22.7023, lng: 114.0587, star: 4, amenities: ['WiFi','健身房','游泳池','免费停车','餐厅'] },
  { name: '深圳回酒店', address: '深圳市福田区红荔路3015号', lat: 22.5438, lng: 114.0745, star: 3, amenities: ['WiFi','免费停车'] },
  { name: '深圳福朋喜来登酒店', address: '深圳市福田区桂花路5号', lat: 22.5248, lng: 114.0588, star: 4, amenities: ['WiFi','健身房','游泳池','商务中心'] },
  { name: '深圳海景嘉途酒店', address: '深圳市南山区华侨城光侨街3号', lat: 22.5362, lng: 113.9814, star: 4, amenities: ['WiFi','健身房','游泳池','免费停车'] },
  { name: '深圳凯宾斯基酒店', address: '深圳市南山区后海滨路海德三道', lat: 22.5165, lng: 113.9402, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','行政酒廊'] },
  { name: '如家酒店(深圳福田口岸店)', address: '深圳市福田区裕亨路38号', lat: 22.5235, lng: 114.0658, star: 2, amenities: ['WiFi'] },
  { name: '汉庭酒店(深圳会展中心店)', address: '深圳市福田区金田路3030号', lat: 22.5302, lng: 114.0645, star: 3, amenities: ['WiFi','商务中心'] },
  { name: '全季酒店(深圳南山科技园店)', address: '深圳市南山区科技南路18号', lat: 22.5315, lng: 113.9512, star: 3, amenities: ['WiFi','健身房','免费停车'] }
]

// 北京国贸/CBD区域酒店
const bjHotels = [
  { name: '北京国贸大酒店', address: '北京市朝阳区建国门外大街1号', lat: 39.9087, lng: 116.4605, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','行政酒廊','商务中心'] },
  { name: '北京柏悦酒店', address: '北京市朝阳区建国门外大街2号', lat: 39.9092, lng: 116.4598, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','管家服务'] },
  { name: '北京嘉里大酒店', address: '北京市朝阳区光华路1号', lat: 39.9125, lng: 116.4628, star: 5, amenities: ['WiFi','健身房','游泳池','商务中心','免费停车'] },
  { name: '北京中国大饭店', address: '北京市朝阳区建国门外大街1号', lat: 39.9082, lng: 116.4612, star: 5, amenities: ['WiFi','健身房','游泳池','行政酒廊','商务中心'] },
  { name: '北京JW万豪酒店', address: '北京市朝阳区华贸中心建国路83号', lat: 39.9105, lng: 116.4785, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','行政酒廊'] },
  { name: '北京丽思卡尔顿酒店', address: '北京市朝阳区华贸中心建国路甲83号', lat: 39.9112, lng: 116.4792, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','管家服务'] },
  { name: '北京万达文华酒店', address: '北京市朝阳区建国路93号万达广场', lat: 39.9089, lng: 116.4715, star: 5, amenities: ['WiFi','健身房','游泳池','商务中心'] },
  { name: '北京千禧大酒店', address: '北京市朝阳区东三环中路7号', lat: 39.9138, lng: 116.4562, star: 5, amenities: ['WiFi','健身房','游泳池','行政酒廊'] },
  { name: '北京富力万丽酒店', address: '北京市朝阳区东三环中路61号', lat: 39.8988, lng: 116.4595, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','行政酒廊'] },
  { name: '北京瑰丽酒店', address: '北京市朝阳区呼家楼京广中心', lat: 39.9185, lng: 116.4598, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','管家服务'] },
  { name: '北京昆仑饭店', address: '北京市朝阳区新源南路2号', lat: 39.9488, lng: 116.4592, star: 5, amenities: ['WiFi','健身房','游泳池','商务中心'] },
  { name: '北京希尔顿酒店', address: '北京市朝阳区东三环北路东方路1号', lat: 39.9505, lng: 116.4615, star: 5, amenities: ['WiFi','健身房','游泳池','行政酒廊','商务中心'] },
  { name: '北京康莱德酒店', address: '北京市朝阳区东三环北路29号', lat: 39.9215, lng: 116.4608, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','行政酒廊'] },
  { name: '北京金茂万丽酒店', address: '北京市东城区王府井大街57号', lat: 39.9198, lng: 116.4132, star: 5, amenities: ['WiFi','健身房','游泳池','商务中心'] },
  { name: '北京诺金酒店', address: '北京市朝阳区将台路甲2号', lat: 39.9712, lng: 116.4875, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','行政酒廊'] },
  { name: '北京燕莎中心凯宾斯基饭店', address: '北京市朝阳区亮马桥路50号', lat: 39.9482, lng: 116.4658, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','商务中心'] },
  { name: '北京中奥马哥孛罗大酒店', address: '北京市朝阳区安立路78号', lat: 39.9925, lng: 116.4082, star: 4, amenities: ['WiFi','健身房','游泳池','商务中心','免费停车'] },
  { name: '北京北辰洲际酒店', address: '北京市朝阳区北辰西路8号', lat: 39.9988, lng: 116.3932, star: 5, amenities: ['WiFi','健身房','游泳池','行政酒廊'] },
  { name: '北京五洲皇冠国际酒店', address: '北京市朝阳区北四环中路8号', lat: 39.9898, lng: 116.4058, star: 4, amenities: ['WiFi','健身房','游泳池','商务中心'] },
  { name: '北京民族饭店', address: '北京市西城区复兴门内大街51号', lat: 39.9075, lng: 116.3652, star: 4, amenities: ['WiFi','健身房','商务中心','免费停车'] },
  { name: '北京建国饭店', address: '北京市朝阳区建国门外大街5号', lat: 39.9082, lng: 116.4478, star: 4, amenities: ['WiFi','健身房','游泳池','商务中心'] },
  { name: '如家精选酒店(北京国贸店)', address: '北京市朝阳区光华路15号', lat: 39.9145, lng: 116.4682, star: 3, amenities: ['WiFi','商务中心'] },
  { name: '汉庭酒店(北京三里屯店)', address: '北京市朝阳区工人体育场北路13号', lat: 39.9362, lng: 116.4532, star: 3, amenities: ['WiFi'] },
  { name: '全季酒店(北京朝阳大悦城店)', address: '北京市朝阳区朝阳北路139号', lat: 39.9245, lng: 116.4968, star: 3, amenities: ['WiFi','健身房'] },
  { name: '桔子酒店(北京望京店)', address: '北京市朝阳区望京街10号', lat: 39.9952, lng: 116.4868, star: 3, amenities: ['WiFi','免费停车'] }
]

// 上海陆家嘴/南京路区域酒店
const shHotels = [
  { name: '上海浦东香格里拉大酒店', address: '上海市浦东新区富城路33号', lat: 31.2398, lng: 121.4988, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','行政酒廊','商务中心'] },
  { name: '上海柏悦酒店', address: '上海市浦东新区世纪大道100号', lat: 31.2362, lng: 121.5068, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','管家服务'] },
  { name: '上海金茂君悦大酒店', address: '上海市浦东新区世纪大道88号', lat: 31.2375, lng: 121.5052, star: 5, amenities: ['WiFi','健身房','游泳池','行政酒廊','商务中心'] },
  { name: '上海浦东丽思卡尔顿酒店', address: '上海市浦东新区世纪大道8号国金中心', lat: 31.2368, lng: 121.5035, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','管家服务'] },
  { name: '上海外滩华尔道夫酒店', address: '上海市黄浦区中山东一路2号', lat: 31.2395, lng: 121.4922, star: 5, amenities: ['WiFi','健身房','SPA','行政酒廊','管家服务'] },
  { name: '上海半岛酒店', address: '上海市黄浦区中山东一路32号', lat: 31.2445, lng: 121.4902, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','管家服务','接机服务'] },
  { name: '上海和平饭店', address: '上海市黄浦区南京东路20号', lat: 31.2435, lng: 121.4915, star: 5, amenities: ['WiFi','健身房','SPA','行政酒廊'] },
  { name: '上海浦东文华东方酒店', address: '上海市浦东新区浦东南路111号', lat: 31.2348, lng: 121.5102, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','管家服务'] },
  { name: '上海外滩茂悦大酒店', address: '上海市虹口区黄浦路199号', lat: 31.2498, lng: 121.4948, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','商务中心'] },
  { name: '上海新天地朗廷酒店', address: '上海市黄浦区马当路99号', lat: 31.2225, lng: 121.4752, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','行政酒廊'] },
  { name: '上海雅居乐万豪酒店', address: '上海市黄浦区西藏中路555号', lat: 31.2385, lng: 121.4758, star: 5, amenities: ['WiFi','健身房','游泳池','行政酒廊'] },
  { name: '上海明天广场JW万豪酒店', address: '上海市黄浦区南京西路399号', lat: 31.2328, lng: 121.4712, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','行政酒廊'] },
  { name: '上海静安香格里拉', address: '上海市静安区延安中路1218号', lat: 31.2268, lng: 121.4552, star: 5, amenities: ['WiFi','健身房','游泳池','SPA','行政酒廊','商务中心'] },
  { name: '上海浦东喜来登由由大酒店', address: '上海市浦东新区浦建路38号', lat: 31.2135, lng: 121.5182, star: 4, amenities: ['WiFi','健身房','游泳池','商务中心'] },
  { name: '上海世博洲际酒店', address: '上海市浦东新区雪野路1188号', lat: 31.1898, lng: 121.4868, star: 5, amenities: ['WiFi','健身房','游泳池','行政酒廊','商务中心'] },
  { name: '上海宏安瑞士大酒店', address: '上海市静安区愚园路1号', lat: 31.2282, lng: 121.4502, star: 5, amenities: ['WiFi','健身房','SPA','商务中心'] },
  { name: '上海豫园万丽酒店', address: '上海市黄浦区河南南路159号', lat: 31.2298, lng: 121.4912, star: 4, amenities: ['WiFi','健身房','游泳池','商务中心'] },
  { name: '上海王宝和大酒店', address: '上海市黄浦区九江路555号', lat: 31.2375, lng: 121.4798, star: 4, amenities: ['WiFi','健身房','商务中心'] },
  { name: '上海古象大酒店', address: '上海市黄浦区九江路595号', lat: 31.2372, lng: 121.4788, star: 4, amenities: ['WiFi','健身房','游泳池'] },
  { name: '上海锦江饭店', address: '上海市黄浦区茂名南路59号', lat: 31.2201, lng: 121.4612, star: 4, amenities: ['WiFi','健身房','商务中心','免费停车'] },
  { name: '上海国际饭店', address: '上海市黄浦区南京西路170号', lat: 31.2352, lng: 121.4738, star: 4, amenities: ['WiFi','商务中心'] },
  { name: '上海索菲特海仑宾馆', address: '上海市黄浦区南京东路505号', lat: 31.2398, lng: 121.4802, star: 4, amenities: ['WiFi','健身房','商务中心'] },
  { name: '全季酒店(上海外滩店)', address: '上海市黄浦区四川中路420号', lat: 31.2415, lng: 121.4928, star: 3, amenities: ['WiFi','商务中心'] },
  { name: '汉庭酒店(上海南京路步行街店)', address: '上海市黄浦区福建中路225号', lat: 31.2388, lng: 121.4785, star: 3, amenities: ['WiFi'] },
  { name: '如家商旅酒店(上海陆家嘴店)', address: '上海市浦东新区张杨路828号', lat: 31.2335, lng: 121.5202, star: 3, amenities: ['WiFi','商务中心'] }
]

const PLATFORM_CONFIG = {
  meituan: { name: '美团', baseRating: 4.5, baseReviews: 3000, priceFactor: 1.0 },
  xiecheng: { name: '携程', baseRating: 4.6, baseReviews: 5000, priceFactor: 0.95 },
  qunar: { name: '去哪儿', baseRating: 4.4, baseReviews: 2000, priceFactor: 0.92 },
  feizhu: { name: '飞猪', baseRating: 4.5, baseReviews: 2500, priceFactor: 0.9 }
}

const STAR_BASE_PRICES = {
  2: [150, 280],
  3: [250, 500],
  4: [450, 900],
  5: [800, 2500]
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min, max, decimals = 1) {
  const val = Math.random() * (max - min) + min
  return parseFloat(val.toFixed(decimals))
}

function generatePlatforms(starLevel) {
  const [minPrice, maxPrice] = STAR_BASE_PRICES[starLevel] || [200, 600]
  const platforms = []

  for (const [key, config] of Object.entries(PLATFORM_CONFIG)) {
    const basePrice = randomInt(minPrice, maxPrice)
    const adjustedPrice = Math.round(basePrice * config.priceFactor)
    const rating = parseFloat(Math.min(5, Math.max(3.5, config.baseRating + randomFloat(-0.3, 0.4))).toFixed(1))
    const reviewCount = randomInt(config.baseReviews, config.baseReviews * 3)

    platforms.push({
      platform: key,
      platformName: config.name,
      minPrice: adjustedPrice,
      roomTypes: [
        {
          name: starLevel >= 4 ? '豪华大床房' : '标准大床房',
          price: adjustedPrice,
          breakfast: starLevel >= 4 ? randomInt(0, 1) === 1 : false,
          cancelFree: Math.random() > 0.3
        },
        {
          name: starLevel >= 4 ? '行政套房' : '商务大床房',
          price: Math.round(adjustedPrice * 1.5),
          breakfast: starLevel >= 4,
          cancelFree: Math.random() > 0.3
        }
      ],
      rating,
      reviewCount,
      jumpUrl: `https://hotel.${key}.com/redirect`
    })

    // 添加 deepLink（仅美团、携程）
    if (key === 'meituan' || key === 'xiecheng') {
      platforms[platforms.length - 1].deepLink = `${key}://hotel/detail`
    }
  }

  return platforms
}

function generateHotels(cityHotels, prefix) {
  return cityHotels.map((h, i) => {
    const platforms = generatePlatforms(h.star)
    return {
      id: `${prefix}${String(i + 1).padStart(3, '0')}`,
      name: h.name,
      address: h.address,
      lat: h.lat,
      lng: h.lng,
      coverImage: `/static/images/hotel-${((i % 10) + 1).toString().padStart(2, '0')}.jpg`,
      images: [
        `/static/images/hotel-${((i % 10) + 1).toString().padStart(2, '0')}.jpg`,
        `/static/images/hotel-${(((i + 1) % 10) + 1).toString().padStart(2, '0')}.jpg`,
        `/static/images/hotel-${(((i + 2) % 10) + 1).toString().padStart(2, '0')}.jpg`
      ],
      starLevel: h.star,
      amenities: h.amenities,
      platforms
    }
  })
}

const allHotels = [
  ...generateHotels(szHotels, 'sz'),
  ...generateHotels(bjHotels, 'bj'),
  ...generateHotels(shHotels, 'sh')
]

const outputPath = path.join(__dirname, '..', 'data', 'hotels.json')
fs.writeFileSync(outputPath, JSON.stringify(allHotels, null, 2), 'utf8')
console.log(`✅ 生成 ${allHotels.length} 家酒店数据 -> ${outputPath}`)
console.log(`   深圳: ${szHotels.length} 家`)
console.log(`   北京: ${bjHotels.length} 家`)
console.log(`   上海: ${shHotels.length} 家`)
