/**
 * 解析配置联动表达式
 * @param {Array<{id: string, show?: string}>} fields 字段配置列表
 * @param {'show' | string} parseKey 当前解析维度（仅show时处理字段自身显隐）
 * @param {string | boolean | number} expression 原始表达式
 * @param {Record<string, any>} values 字段实际值映射
 * @param {Set<string>} visited 递归缓存，防止循环依赖
 * @param {number} depth 递归深度，防栈溢出
 * @returns {any} 表达式计算结果
 */
export const parseConfigExpression = (
  fields,
  parseKey,
  expression,
  values,
  visited = new Set(),
  depth = 0
) => {
  // 1. 入参基础校验
  if (!Array.isArray(fields)) return expression;
  if (typeof values !== 'object' || values === null) return expression;
  // 递归深度限制，避免循环依赖爆栈
  const MAX_RECURSION_DEPTH = 20;
  if (depth > MAX_RECURSION_DEPTH) {
    console.warn('表达式递归层级过深，终止解析');
    return false;
  }

  // 非字符串直接原值返回
  if (typeof expression !== 'string') return expression;

  // 字面量布尔快捷处理
  if (expression === 'false') return false;
  if (expression === 'true') return true;

  // 2. 构建字段Map，优化查找性能 O(1)
  const fieldMap = new Map();
  fields.forEach(f => fieldMap.set(f.id, f));

  // 3. 替换 ${fieldId} 占位符
  let replacedExpr = expression.replace(/\${([^}]+?)}/g, (_, fieldId) => {
    const targetField = fieldMap.get(fieldId);
    // 当前解析维度是show，且目标字段存在show表达式
    if (parseKey === 'show' && targetField?.hasOwnProperty('show')) {
      // 循环依赖检测
      const visitKey = `${parseKey}_${fieldId}`;
      if (visited.has(visitKey)) return 'false';
      visited.add(visitKey);
      // 递归解析目标字段显隐
      const childShow = parseConfigExpression(
        fields,
        'show',
        targetField.show,
        values,
        visited,
        depth + 1
      );
      visited.delete(visitKey);
      // 子字段隐藏，直接返回false阻断表达式
      if (!childShow) return 'false';
    }

    // 取值兜底，不存在字段返回 undefined
    const fieldValue = values[fieldId] ?? undefined;
    // 优化序列化：避免字符串歧义，数字/布尔直接输出字面量，其余JSON序列化
    if (typeof fieldValue === 'number' || typeof fieldValue === 'boolean') {
      return String(fieldValue);
    }
    return JSON.stringify(fieldValue);
  });

  // 无占位符替换，直接返回原表达式
  if (replacedExpr === expression) return expression;

  // 4. 动态执行表达式，增加异常捕获
  try {
    // 简单输入过滤：阻断危险关键字（基础防护，无法根治注入）
    const dangerousReg = /window|document|eval|Function|constructor|__proto__/;
    if (dangerousReg.test(replacedExpr)) {
      throw new Error('表达式包含非法关键字');
    }
    const execFn = new Function('return ' + replacedExpr);
    return execFn();
  } catch (err) {
    return false;
  }
};