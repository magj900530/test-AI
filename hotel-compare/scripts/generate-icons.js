/**
 * Tab Bar 图标生成器
 * 纯 Node.js（无外部依赖），生成 81x81 PNG 图标
 *
 * 首页 (home):      房子形状  — 参考微信/淘宝/美团等成熟平台
 * 推荐 (recommend): 星星形状  — 表示"精选/推荐"
 *
 * 颜色:
 *   未选中: #8E8E93 (iOS Tab Bar 灰色)
 *   选中:   #007AFF (App 主色调蓝)
 */

const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const SIZE = 81
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'static', 'icons')

// ========== CRC32 ==========
function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

// ========== PNG 编码 ==========
function createPNGChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([typeBytes, data])
  const crcVal = Buffer.alloc(4)
  crcVal.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([len, typeBytes, data, crcVal])
}

function encodePNG(width, height, pixels) {
  // pixels: Buffer of RGBA data, row-major
  // Filter each row with byte 0 (None)
  const rawRows = []
  for (let y = 0; y < height; y++) {
    const rowStart = y * width * 4
    rawRows.push(Buffer.from([0])) // filter byte
    rawRows.push(pixels.slice(rowStart, rowStart + width * 4))
  }
  const raw = Buffer.concat(rawRows)

  const compressed = zlib.deflateSync(raw)

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8  // bit depth
  ihdrData[9] = 6  // color type: RGBA
  ihdrData[10] = 0 // compression
  ihdrData[11] = 0 // filter
  ihdrData[12] = 0 // interlace

  const ihdr = createPNGChunk('IHDR', ihdrData)
  const idat = createPNGChunk('IDAT', compressed)
  const iend = createPNGChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdr, idat, iend])
}

// ========== 绘图工具 ==========
function createBuffer(width, height, r, g, b, a) {
  const buf = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    buf[i * 4] = r
    buf[i * 4 + 1] = g
    buf[i * 4 + 2] = b
    buf[i * 4 + 3] = a
  }
  return buf
}

function setPixel(buf, width, x, y, r, g, b, a) {
  if (x < 0 || x >= width || y < 0 || y >= width) return
  const idx = (Math.round(y) * width + Math.round(x)) * 4
  buf[idx] = r
  buf[idx + 1] = g
  buf[idx + 2] = b
  buf[idx + 3] = a
}

// 抗锯齿画线 (Xiaolin Wu)
function drawLine(buf, width, x0, y0, x1, y1, r, g, b, a, thickness = 1.5) {
  const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0)
  if (steep) {
    [x0, y0] = [y0, x0]
    ;[x1, y1] = [y1, x1]
  }
  if (x0 > x1) {
    [x0, x1] = [x1, x0]
    ;[y0, y1] = [y1, y0]
  }

  const dx = x1 - x0
  const dy = y1 - y0
  const gradient = dx === 0 ? 1 : dy / dx

  for (let x = Math.round(x0); x <= Math.round(x1); x++) {
    const y = y0 + gradient * (x - x0)
    for (let t = -thickness / 2; t <= thickness / 2; t += 0.5) {
      const py = y + t
      if (steep) {
        setPixel(buf, width, py, x, r, g, b, a)
        setPixel(buf, width, py + 0.5, x, r, g, b, Math.round(a * 0.5))
      } else {
        setPixel(buf, width, x, py, r, g, b, a)
        setPixel(buf, width, x, py + 0.5, r, g, b, Math.round(a * 0.5))
      }
    }
  }
}

function fillCircle(buf, width, cx, cy, radius, r, g, b, a) {
  for (let y = Math.max(0, Math.round(cy - radius)); y <= Math.min(width - 1, Math.round(cy + radius)); y++) {
    for (let x = Math.max(0, Math.round(cx - radius)); x <= Math.min(width - 1, Math.round(cx + radius)); x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (dist <= radius) {
        setPixel(buf, width, x, y, r, g, b, a)
      } else if (dist <= radius + 0.8) {
        const alpha = Math.round(a * (1 - (dist - radius)))
        setPixel(buf, width, x, y, r, g, b, Math.max(0, alpha))
      }
    }
  }
}

function fillRect(buf, width, x0, y0, w, h, r, g, b, a) {
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(width, Math.round(y0 + h)); y++) {
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(width, Math.round(x0 + w)); x++) {
      setPixel(buf, width, x, y, r, g, b, a)
    }
  }
}

function fillPolygon(buf, width, points, r, g, b, a) {
  // Simple scanline fill
  let minY = Infinity, maxY = -Infinity
  for (const p of points) {
    minY = Math.min(minY, p[1])
    maxY = Math.max(maxY, p[1])
  }

  for (let y = Math.round(minY); y <= Math.round(maxY); y++) {
    const intersections = []
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i]
      const [x2, y2] = points[(i + 1) % points.length]
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const x = x1 + (y - y1) / (y2 - y1) * (x2 - x1)
        intersections.push(x)
      }
    }
    intersections.sort((a, b) => a - b)
    for (let i = 0; i < intersections.length; i += 2) {
      const xStart = Math.round(intersections[i])
      const xEnd = Math.round(intersections[i + 1] || intersections[i])
      for (let x = xStart; x <= xEnd; x++) {
        setPixel(buf, width, x, y, r, g, b, a)
      }
    }
  }
}

// ========== 图标绘制 ==========

/**
 * 首页图标 — 房子形状
 * 参考微信"发现"、淘宝"首页"等成熟平台的 house 语义
 */
function drawHouseIcon(color) {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff

  const buf = createBuffer(SIZE, SIZE, 0, 0, 0, 0)
  const PAD = 14

  // 屋顶 — 三角形
  const roofTop = [SIZE / 2, PAD + 2]
  const roofLeft = [PAD + 4, SIZE * 0.42]
  const roofRight = [SIZE - PAD - 4, SIZE * 0.42]

  fillPolygon(buf, SIZE, [roofTop, roofLeft, roofRight], r, g, b, 255)

  // 烟囱
  fillRect(buf, SIZE, SIZE * 0.55, PAD + 6, SIZE * 0.1, SIZE * 0.2, r, g, b, 255)

  // 房屋主体
  const bodyTop = SIZE * 0.42
  const bodyBottom = SIZE - PAD
  const bodyLeft = PAD + 8
  const bodyRight = SIZE - PAD - 8
  fillRect(buf, SIZE, bodyLeft, bodyTop, bodyRight - bodyLeft, bodyBottom - bodyTop, r, g, b, 255)

  // 门
  const doorW = SIZE * 0.18
  const doorH = SIZE * 0.28
  const doorX = SIZE / 2 - doorW / 2
  const doorY = bodyBottom - doorH
  fillRect(buf, SIZE, doorX, doorY, doorW, doorH, 255, 255, 255, 255)
  // 门把手
  fillCircle(buf, SIZE, doorX + doorW - 5, doorY + doorH / 2, 2, r, g, b, 255)

  // 窗户 — 左
  const winW = SIZE * 0.14
  const winH = SIZE * 0.16
  const winY = bodyTop + SIZE * 0.1
  fillRect(buf, SIZE, bodyLeft + 8, winY, winW, winH, 255, 255, 255, 255)
  // 窗户 — 右
  fillRect(buf, SIZE, bodyRight - 8 - winW, winY, winW, winH, 255, 255, 255, 255)

  return buf
}

/**
 * 推荐图标 — 五角星形状
 * 参考美团"推荐"、大众点评"精选"、微博"热门"等平台的 star/featured 语义
 */
function drawStarIcon(color) {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff

  const buf = createBuffer(SIZE, SIZE, 0, 0, 0, 0)

  const cx = SIZE / 2
  const cy = SIZE / 2 + 1
  const outerR = SIZE * 0.38
  const innerR = SIZE * 0.16
  const spikes = 5
  const points = []

  for (let i = 0; i < spikes * 2; i++) {
    const angle = (Math.PI / 2) * -1 + (Math.PI / spikes) * i
    const radius = i % 2 === 0 ? outerR : innerR
    points.push([
      cx + radius * Math.cos(angle),
      cy - radius * Math.sin(angle)
    ])
  }

  fillPolygon(buf, SIZE, points, r, g, b, 255)

  return buf
}

// ========== 主函数 ==========
function generate() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  const inactiveColor = 0x8E8E93 // iOS Tab Bar 灰色
  const activeColor = 0x007AFF   // App 蓝

  const icons = [
    { name: 'home',         draw: drawHouseIcon, active: false, color: inactiveColor },
    { name: 'home-active',  draw: drawHouseIcon, active: true,  color: activeColor },
    { name: 'recommend',        draw: drawStarIcon,  active: false, color: inactiveColor },
    { name: 'recommend-active', draw: drawStarIcon,  active: true,  color: activeColor },
  ]

  for (const icon of icons) {
    const pixels = icon.draw(icon.color)
    const png = encodePNG(SIZE, SIZE, pixels)
    const filePath = path.join(OUTPUT_DIR, `${icon.name}.png`)
    fs.writeFileSync(filePath, png)
    console.log(`✅ ${icon.name}.png (${png.length} bytes) — ${icon.active ? 'active' : 'inactive'}`)
  }

  console.log(`\n📁 图标已生成到: ${OUTPUT_DIR}`)
}

generate()
