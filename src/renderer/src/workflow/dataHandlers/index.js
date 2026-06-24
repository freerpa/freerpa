import stringHandlers from './types/string.js'
import booleanHandlers from './types/boolean.js'
import arrayHandlers from './types/array.js'
import objectHandlers from './types/object.js'
import numberHandlers from './types/number.js'
import timeHandlers from './types/time.js'



export const Handlers = {
  string: stringHandlers,
  number: numberHandlers,
  boolean: booleanHandlers,
  array: arrayHandlers,
  object: objectHandlers,
  time: timeHandlers
}
export const getTypes = () => {
  return Object.keys(Handlers).map((item) => ({
    label: Handlers[item].label,
    value: item
  }))
}

export const getHandlersByType = (type) => {
  if (!Handlers[type]) return []
  return Object.keys(Handlers[type].handlers).map((item) => ({
    label: Handlers[type].handlers[item].label,
    value: item
  }))
}

export const getHandler = (type, name) => {
  return Handlers[type]?.handlers[name] || { params: [] }
}
