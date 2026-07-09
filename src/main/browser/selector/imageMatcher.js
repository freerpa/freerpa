/**
 * @file: 图片模板匹配 — sharp 解码 + 稀疏像素搜索
 */

import sharp from 'sharp'

// ─── base64 → sharp raw RGBA ────────────────────────────

async function toRawRGBA(base64) {
  const buf = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, rgba: data }
}

// ─── 提取关键采样点 ────────────────────────────────────

function sample(w, h, rgba) {
  const pts = [], s = w * 4

  const pick = (x, y) => {
    const i = y * s + x * 4
    return { x, y, r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] }
  }

  // 九宫格（3x3）+ 中心
  const gx = [0, w >> 1, w - 1], gy = [0, h >> 1, h - 1]
  for (const y of gy)
    for (const x of gx)
      pts.push(pick(x, y))

  // 随机补充到 20 个
  while (pts.length < 20) {
    const x = (Math.random() * (w - 1)) | 0, y = (Math.random() * (h - 1)) | 0
    pts.push(pick(x, y))
  }

  return pts
}

// ─── 主入口 ────────────────────────────────────────────

export async function matchTemplate(screenBase64, tmplBase64) {
  try {
    const scr = await toRawRGBA(screenBase64)
    const tpl = await toRawRGBA(tmplBase64)
    const { w: sw, h: sh, rgba: sp } = scr
    const { w: tw, h: th, rgba: tp } = tpl

    if (tw > sw || th > sh) return null

    const TOL = 40
    const pts = sample(tw, th, tp)
    const first = pts[0], rest = pts.slice(1)
    const ss = sw * 4

    for (let y = 0; y <= sh - th; y++) {
      const sy = y * ss
      for (let x = 0; x <= sw - tw; x++) {
        const si = sy + x * 4
        if (Math.abs(sp[si] - first.r) > TOL ||
            Math.abs(sp[si + 1] - first.g) > TOL ||
            Math.abs(sp[si + 2] - first.b) > TOL)
          continue

        // 验证其余采样点
        let ok = true
        for (const p of rest) {
          const pi = (y + p.y) * ss + (x + p.x) * 4
          if (Math.abs(sp[pi] - p.r) > TOL ||
              Math.abs(sp[pi + 1] - p.g) > TOL ||
              Math.abs(sp[pi + 2] - p.b) > TOL) { ok = false; break }
        }
        if (!ok) continue

        // 局部 SAD 校验
        let diff = 0, n = 0
        for (let ty = 0; ty < th && diff < 2000 * n; ty += 3) {
          const tRow = ty * tw * 4, sRow = (y + ty) * ss + x * 4
          for (let tx = 0; tx < tw * 4; tx += 12) {
            diff += Math.abs(sp[sRow + tx] - tp[tRow + tx]); n++
          }
        }
        if (diff / n > 25) continue

        return { x, y, width: tw, height: th }
      }
    }

    return null
  } catch (e) {
    console.error('[imageMatcher]', e.message)
    return null
  }
}
