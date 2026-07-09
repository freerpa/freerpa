/**
 * @file: 图片模板匹配 — 纯 JS 实现（零依赖）
 *
 * 输入：截图 base64 / 模板 base64
 * 输出：匹配区域 { x, y, width, height } 或 null
 */

import { inflateSync } from 'zlib'

// ─── PNG 解码 — 返回 { width, height, pixels: Buffer (RGBA) } ──

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function parsePNG(buf) {
  if (!buf.slice(0, 8).equals(SIG)) throw new Error('Not a PNG')

  let offset = 8
  let width = 0, height = 0
  const idatChunks = []

  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset)
    const type = buf.slice(offset + 4, offset + 8).toString('ascii')
    const data = buf.slice(offset + 8, offset + 8 + len)
    offset += 12 + len

    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
    } else if (type === 'IDAT') {
      idatChunks.push(data)
    } else if (type === 'IEND') {
      break
    }
  }

  if (!width || !height) throw new Error('Invalid PNG: no IHDR')

  const compressed = Buffer.concat(idatChunks)
  const raw = inflateSync(compressed)

  // 重建 RGBA 像素（处理 PNG filter byte + 行）
  const bpp = 4 // RGBA
  const stride = width * bpp
  const pixels = Buffer.alloc(stride * height)

  let srcIdx = 0
  for (let y = 0; y < height; y++) {
    const filterType = raw[srcIdx++]
    const rowStart = y * stride

    for (let x = 0; x < stride; x++) {
      const byte = raw[srcIdx++]
      const a = x >= bpp ? pixels[rowStart + x - bpp] : 0
      const b = y > 0 ? pixels[rowStart - stride + x] : 0
      const c = (y > 0 && x >= bpp) ? pixels[rowStart - stride + x - bpp] : 0

      let val
      switch (filterType) {
        case 0: val = byte; break                        // None
        case 1: val = byte + a; break                     // Sub
        case 2: val = byte + b; break                     // Up
        case 3: val = byte + ((a + b) >>> 1); break       // Average
        case 4: val = byte + paeth(a, b, c); break        // Paeth
        default: val = byte
      }
      pixels[rowStart + x] = val & 0xff
    }
  }

  return { width, height, pixels }
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

// ─── base64 → PNG 解码后的像素 ──────────────────────────

function base64ToPixels(base64) {
  const buf = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
  return parsePNG(buf)
}

// ─── 模板匹配（SAD 滑动窗口） ────────────────────────────

/**
 * 在大图（截图）中查找小图（模板）的位置
 * @param {string} screenBase64 - 页面截图 base64
 * @param {string} tmplBase64   - 模板图片 base64
 * @returns {{ x: number, y: number, width: number, height: number } | null}
 */
export function matchTemplate(screenBase64, tmplBase64) {
  try {
    const screen = base64ToPixels(screenBase64)
    const tmpl = base64ToPixels(tmplBase64)

    if (tmpl.width > screen.width || tmpl.height > screen.height) return null

    const { width: sw, height: sh, pixels: sp } = screen
    const { width: tw, height: th, pixels: tp } = tmpl

    let bestScore = Infinity
    let bestX = 0, bestY = 0

    // 滑动窗口
    for (let y = 0; y <= sh - th; y++) {
      for (let x = 0; x <= sw - tw; x++) {
        let diff = 0
        for (let ty = 0; ty < th && diff < bestScore; ty++) {
          const sRow = (y + ty) * sw * 4 + x * 4
          const tRow = ty * tw * 4
          for (let tx = 0; tx < tw * 4; tx++) {
            diff += Math.abs(sp[sRow + tx] - tp[tRow + tx])
          }
        }
        if (diff < bestScore) {
          bestScore = diff
          bestX = x
          bestY = y
        }
      }
    }

    // 阈值：每像素平均差异 < 60 认为匹配
    const avgDiff = bestScore / (tw * th * 4)
    if (avgDiff > 60) return null

    return { x: bestX, y: bestY, width: tw, height: th }
  } catch (e) {
    console.error('[imageMatcher] match failed:', e.message)
    return null
  }
}
