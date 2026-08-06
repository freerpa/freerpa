/**
 * @file: 文件读取节点执行器
 * @author: dabao
 * @date: 2024-03-29
 */
import readline from 'readline'
import iconv from 'iconv-lite'
import { Buffer } from 'node:buffer' // deno ESM 无全局 Buffer，需显式导入

// 全量读取大小上限（超过提示改用按行读取，防止大文件 OOM）
const MAX_FULL_READ = 50 * 1024 * 1024

const execute = async (node, context) => {
  const { config } = node
  const { complete, fs } = context
  const { filePath, encoding, readMode, startLine, endLine } = config
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`)
  }

  // 根据不同的读取方式处理
  switch (readMode) {
    case 'line': {
      // 按行读取
      const fileStream = fs.createReadStream(filePath)
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      })

      let currentLine = 0
      let content = []

      for await (const line of rl) {
        currentLine++

        // 跳过起始行之前的内容
        if (currentLine < startLine) continue

        // 如果设置了结束行且已达到，则停止读取
        if (endLine && currentLine > endLine) break

        // 对每行内容进行编码转换
        const decodedLine = iconv.decode(Buffer.from(line), encoding)
        content.push(decodedLine)
      }

      // 合并所有行
      let result = content.join('\n')

      complete({ result, filePath })
      break
    }

    default: {
      // 读取全部内容（大文件限流：超过上限提示改用按行读取）
      const stats = fs.statSync(filePath)
      if (stats.size > MAX_FULL_READ) {
        throw new Error(`文件过大（${stats.size} 字节），全量读取上限 ${MAX_FULL_READ} 字节，请改用按行读取`)
      }
      const buffer = fs.readFileSync(filePath)
      let content = iconv.decode(buffer, encoding)
      complete({ result: content, filePath })
    }
  }
}

export default execute
