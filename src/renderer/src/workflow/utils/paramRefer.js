const separator = '--!@#$%freerpa-refer%$#@!--'

// 公共解析：一次拆出 refer 与 oldValue，供 is/getRefer/getOldValue 复用（替代各自的重复 split）
export const parseParamRefer = (value) => {
  if (typeof value !== 'string') return null
  const idx = value.indexOf(separator)
  if (idx === -1) return null
  const refer = value.slice(0, idx)
  if (!/^\{\{[^\{\}]+\.[^\{\}]+\}\}$/.test(refer)) return null
  let oldValue = value.slice(refer.length + separator.length)
  if (oldValue) {
    try {
      oldValue = JSON.parse(oldValue)
    } catch {
      oldValue = value.slice(refer.length + separator.length)
    }
  }
  return { refer, oldValue }
}

export const isParamRefer = (value) => {
  return parseParamRefer(value) !== null
}

export const makeParamReferValue = (value, refer) => {
  const oldValue = JSON.stringify(getOldValue(value))
  return `${refer}${separator}${oldValue}`
}

export const getRefer = (value) => {
  return parseParamRefer(value)?.refer || ''
}

export const getOldValue = (value) => {
  const parsed = parseParamRefer(value)
  if (parsed) {
    return parsed.oldValue
  }
  return value
}


// export const paramReferRegex = /{{([\u4e00-\u9fa5a-zA-Z0-9_\-\.\[\]]+)\.([\u4e00-\u9fa5a-zA-Z0-9_\-\.\[\]]+)}}/g
export const paramReferRegex = /\{{[^}]+}}/g
