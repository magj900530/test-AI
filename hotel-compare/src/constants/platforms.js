/**
 * 平台常量 — 单一来源
 * 所有平台相关的名称、颜色、URL、CSS class 均从此文件引用
 */

export const PLATFORMS = [
  { platform: 'meituan', platformName: '美团', color: '#FF9800', bg: '#FFF8E1', cssClass: 'chip-meituan' },
  { platform: 'xiecheng', platformName: '携程', color: '#096DD9', bg: '#E3F2FD', cssClass: 'chip-xiecheng' },
  { platform: 'qunar', platformName: '去哪儿', color: '#0088CC', bg: '#E0F7FA', cssClass: 'chip-qunar' },
  { platform: 'feizhu', platformName: '飞猪', color: '#FF5000', bg: '#FFF0EB', cssClass: 'chip-feizhu' }
]

export const PLATFORM_KEY_MAP = Object.fromEntries(PLATFORMS.map(p => [p.platform, p]))

export const PLATFORM_JUMP_URLS = {
  meituan: (q) => `https://i.meituan.com/hotel/list?keyword=${q}`,
  xiecheng: (q) => `https://m.ctrip.com/html5/hotel/search?keyword=${q}`,
  qunar: (q) => `https://touch.qunar.com/hotel/search?keyword=${q}`,
  feizhu: (q) => `https://h5.m.taobao.com/trip/hotel/search?keyword=${q}`
}
