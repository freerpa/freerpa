const operator = {
  eq: {
    label: "等于",
    expression: "a === b",
    where: "a = b"
  },    
  ne: {
    label: "不等于",
    expression: "a !== b",
    where: "a != b"
  },
  in: {
    label: "包含",
    expression: "a.includes(b)",
    where: "a IN b"
  },
  notIn: {
    label: "不包含",
    expression: "!a.includes(b)",
    where: "a NOT IN b"
  },
  isNull: {
    label: "为空",
    expression: "a === null",
    where: "a IS NULL"
  },
  isNotNull: {
    label: "不为空",
    expression: "a !== null",
    where: "a IS NOT NULL"
  },
  gt: {
    label: "大于",
    expression: "a > b",
    where: "a > b"
  },
  gte: {
    label: "大于等于",
    expression: "a >= b",
    where: "a >= b"
  },
  lt: {
    label: "小于",
    expression: "a < b",
    where: "a < b"
  },
  lte: {
    label: "小于等于",
    expression: "a <= b",
    where: "a <= b"
  },
  like: {
    label: "模糊匹配",
    expression: "a.includes(b)",
    where: "a LIKE b"
  } 
}

export default operator