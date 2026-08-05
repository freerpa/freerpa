const separator = '--!@#$%freerpa-refer%$#@!--'

export const isParamRefer = (value) => {
  if (typeof value !== 'string') {
    return false
  }
  if(value.indexOf(separator) === -1) {
    return false
  }
  const refer = value.split(separator)[0]
  return /^\{\{[^\{\}]+\.[^\{\}]+\}\}$/.test(refer)
}

export const makeParamReferValue = (value, refer) => {
  const oldValue = JSON.stringify(getOldValue(value))
  return `${refer}${separator}${oldValue}`
}

export const getRefer = (value) => {
  if (isParamRefer(value)) {
    return value.split(separator)[0]
  }
  return ''
}

export const getOldValue = (value) => {
  if (isParamRefer(value)) {
    const refer = value.split(separator)[0]
    let oldValue = value.slice(refer.length + separator.length)
    if (oldValue) {
      oldValue = JSON.parse(oldValue)
    }
    return oldValue
  }
  return value
}

export const paramReferRegex = /\{{[^}]+}}/g
