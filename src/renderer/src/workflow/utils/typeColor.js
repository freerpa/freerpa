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
  page: '浏览器',
  websocket: 'WebSocket',
  tempStore: '暂存器',
  dataQuery: '数据标识',
  counter: '计数器',
  worksheet: '工作表',
  timer: '计时器'
}

// 获取类型颜色
export const getTypeColor = (type) => {
  if (typeof type === 'string') {
    type = [type]
  }
  const path = []
  for (let i = 0; i < type.length; i++) {
    path.push({
      d: calculateSectorPath(i, type.length),
      fill: typeColor[type[i]],
      text: typeText[type[i]]
    })
  }
  return (
    path || [
      {
        d: calculateSectorPath(0, 1),
        fill: '#b1b1b7'
      }
    ]
  )
}

// 动态计算扇形路径的函数
function calculateSectorPath(index, total, radius = 50, centerX = 50, centerY = 50) {
  // 特殊处理只有一个扇形的情况
  if (total === 1) {
    return `M${centerX},${centerY}
            m 0,-${radius}
            a ${radius},${radius} 0 1 1 0,${radius * 2}
            a ${radius},${radius} 0 1 1 0,-${radius * 2}
            z`
  }

  const startAngle = (index * 2 * Math.PI) / total
  const endAngle = ((index + 1) * 2 * Math.PI) / total

  const startX = centerX + radius * Math.sin(startAngle)
  const startY = centerY - radius * Math.cos(startAngle)
  const endX = centerX + radius * Math.sin(endAngle)
  const endY = centerY - radius * Math.cos(endAngle)

  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0

  return `M${centerX},${centerY} L${startX},${startY} A${radius},${radius} 0 ${largeArcFlag},1 ${endX},${endY} Z`
}

export default typeColor
