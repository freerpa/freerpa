export const parseConfigExpression = (fields, key, expression, values) => {
    if (typeof expression !== 'string') return expression

    if (expression === 'false') {
        return false
    }

    if (expression === 'true') {
        return true
    }
    // 替换字段引用
    const expr = expression.replace(/\${([^}]+)}/g, (match, field) => {
        // 引用字段
        const refField = fields.find((f) => f.id === field)
        if (
            refField &&
            key === 'show' &&
            refField.hasOwnProperty('show') &&
            !parseConfigExpression(fields, 'show', refField.show, values)
        ) {
            return 'false'
        }
        return JSON.stringify(values[field])
    })
    // 如果表达式没有变化，则返回原表达式
    if (expr == expression) return expression

    try {
        return new Function('return ' + expr)()
    } catch (e) {
        return expr
    }
}