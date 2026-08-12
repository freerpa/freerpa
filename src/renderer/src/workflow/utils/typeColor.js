// 类型颜色
export const typeColor = {
  string: '#1E90FF',
  number: '#32CD32',
  boolean: '#FF6347',
  array: '#8A2BE2',
  object: '#F08EE6',
  any: '#333333',
  page: '#FFA500',
  websocket: '#40E0D0',
  tempStore: '#86909C',
  dataQuery: '#F5319D',
  dbConnection: '#B71C1C',
  counter: '#CB272D',
  worksheet: '#207345',
  timer: '#FFD700'
}

export const typeText = {
  string: '文本',
  number: '数字',
  boolean: '是否',
  array: '数组',
  object: '对象',
  any: '任意',
  page: '网页',
  websocket: 'WebSocket',
  tempStore: '暂存器',
  dataQuery: '数据标识',
  dbConnection: '数据库',
  counter: '计数器',
  worksheet: '工作表',
  timer: '计时器'
}

// 类型颜色缓存：key = type 数组 join 结果
const typeColorCache = new Map()

// 获取类型颜色
export const getTypeColor = (type) => {
  if (typeof type === 'string') {
    type = [type]
  }
  const cacheKey = type.join(',')
  const cached = typeColorCache.get(cacheKey)
  if (cached) return cached

  const path = []
  for (let i = 0; i < type.length; i++) {
    path.push({
      d: calculateSectorPath(i, type.length),
      fill: typeColor[type[i]],
      text: typeText[type[i]]
    })
  }
  const result = path.length > 0
    ? path
    : [
        {
          d: calculateSectorPath(0, 1),
          fill: '#b1b1b7'
        }
      ]

  typeColorCache.set(cacheKey, result)
  return result
}

// 扇形路径缓存：key = `${index}|${total}` → SVG path
const sectorPathCache = new Map()

// 动态计算扇形路径的函数
function calculateSectorPath(index, total, radius = 50, centerX = 50, centerY = 50) {
  const cacheKey = `${index}|${total}`
  const cached = sectorPathCache.get(cacheKey)
  if (cached) return cached

  let path
  // 特殊处理只有一个扇形的情况
  if (total === 1) {
    path = `M${centerX},${centerY}
            m 0,-${radius}
            a ${radius},${radius} 0 1 1 0,${radius * 2}
            a ${radius},${radius} 0 1 1 0,-${radius * 2}
            z`
  } else {
    const startAngle = (index * 2 * Math.PI) / total
    const endAngle = ((index + 1) * 2 * Math.PI) / total

    const startX = centerX + radius * Math.sin(startAngle)
    const startY = centerY - radius * Math.cos(startAngle)
    const endX = centerX + radius * Math.sin(endAngle)
    const endY = centerY - radius * Math.cos(endAngle)

    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0

    path = `M${centerX},${centerY} L${startX},${startY} A${radius},${radius} 0 ${largeArcFlag},1 ${endX},${endY} Z`
  }

  sectorPathCache.set(cacheKey, path)
  return path
}

export default typeColor
