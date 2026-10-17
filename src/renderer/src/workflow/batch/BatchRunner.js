/**
 * @file: 多线程执行管理（模块级单例）
 *
 * 设计要点：
 *  - 「多线程」：填写数量点击执行即**并发启动 N 条线程（创建即执行）**，无并发上限、不排队。
 *  - 模块级单例（Map<workflowId, BatchRunner>），跨页面卸载 / 工作流切换存活：
 *    离开工作流页面、切换工作流、关闭面板都**不停止**线程，只有「停止」才销毁（应用退出由主进程 cleanup 兜底）。
 *  - 线程启动时锁定工作流快照；不提供重跑，只有停止。
 *  - 「错误重试」勾选后：出错线程等待 1s 自动重启，重试到成功或手动停止；未勾选则保持「出错」终态。
 *  - 状态机：空闲（无线程，可执行）→ 执行中（有线程未到终态，禁止再次执行、标签不可关闭）→ 停止后保留本轮记录回到空闲。
 *    下一次执行时清空上一轮记录，编号每轮从 1 开始。
 *  - 每次执行分配**新的实例 id**（run-<base36 时间戳>-<序号>），它作为 flowData.id 贯穿全链路
 *    （worker key / 事件通道后缀 / 引擎 key / 节点通道 / 浏览器归属 / 数据库连接归属），
 *    因此同工作流的 N 个线程天然隔离，主进程与 worker 侧无需新增参数。
 *    ⚠ 实例 id 只允许 [A-Za-z0-9_-]：禁止 ':'（主进程按 split(':')[2] 解析 flowId）与 '/'（可能进路径）。
 *  - 传给主进程的快照必须是**纯对象**：快照用 markRaw 存放，启动时再 JSON 深拷贝一次，
 *    避免 Vue 响应式 Proxy 经 IPC 触发 "An object could not be cloned."。
 *  - 本模块**不提供**页面卸载时的 dispose。
 */
import { reactive, markRaw } from 'vue'
import { useFlowStore } from '../store'
import { validateWorkflow } from '../engine/validate'

/** 未到终态（启动中/重试中/运行中） */
const LIVE_STATUS = new Set(['starting', 'retrying', 'running'])

let idSeq = 0
/** 生成唯一 id（只允许 [A-Za-z0-9_-]） */
const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(++idSeq).toString(36)}`

/** stopFlow 超时兜底：节点销毁钩子可能长时间阻塞，超时后直接强制销毁实例 */
const STOP_TIMEOUT = 3000
/** 启动看门狗：createEngine/startFlow 之后若迟迟收不到 running 事件，判定为启动失败并显式报错（避免永远停在「启动中」） */
const START_TIMEOUT = 15000
/** 「错误重试」的重试间隔：出错后等待 1s 再重启该线程，避免失败过快时高频重启 */
const RETRY_DELAY = 1000
const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))])

class BatchRunner {
  constructor(workflowId) {
    this.workflowId = workflowId
    // state 为响应式，面板直接消费（行状态/「错误重试」开关/本轮耗时持续刷新，即使当前处于其他页面）
    // startedAt/endedAt：本轮开始与结束时间（endedAt 为空表示本轮尚未结束，耗时仍在累计）
    this.state = reactive({ rows: [], retryOnError: false, startedAt: null, endedAt: null })
    this.running = new Set() // 运行中的实例 id（仅用于结算去重，行状态才是 UI 数据源）
    this.rowNo = 0
  }

  /** 运行中的线程数（从行状态推导，保证响应式：this.running 为普通 Set，读取它不会触发更新） */
  get activeCount() {
    return this.state.rows.filter((row) => LIVE_STATUS.has(row.status)).length
  }

  /** 是否存在未到终态的线程（执行中：此时禁止再次执行） */
  get hasLive() {
    return this.state.rows.some((row) => LIVE_STATUS.has(row.status))
  }

  /**
   * 启动 N 条线程（创建即执行，全部并发，不排队）。
   * 复用编辑器运行前的完整校验；每行锁定一份工作流快照。
   * 执行中禁止重复执行；上一轮已结束的线程在开启新一轮时一并清除。
   */
  async create(count) {
    if (this.hasLive) return { ok: false, message: '线程正在执行中，请先停止' }
    const n = Number(count)
    if (!Number.isInteger(n) || n <= 0) return { ok: false, message: '线程数量必须为正整数' }
    const store = useFlowStore(this.workflowId)
    if (!store?.vueFlowRef) return { ok: false, message: '工作流尚未加载完成，请稍后重试' }

    let result
    try {
      result = await validateWorkflow(store)
    } catch (e) {
      return { ok: false, message: e?.message || String(e) }
    }
    if (!result.ok) {
      return { ok: false, message: result.errors[0]?.message || '工作流校验未通过' }
    }

    this.clearRows() // 清掉上一轮的线程记录，列表始终只反映当前这一轮
    this.rowNo = 0 // 编号每轮从 1 开始，不跨轮累计
    this.state.startedAt = Date.now() // 本轮开始时间（面板底部「总耗时」起点）
    this.state.endedAt = null
    const base = result.flowData
    for (let i = 0; i < n; i++) {
      // markRaw：避免快照被响应式代理（Proxy 无法经 IPC 结构化克隆）
      const snapshot = markRaw(JSON.parse(JSON.stringify(base)))
      snapshot.sourceId = snapshot.id // 真实工作流 id（快照锁定后不再变化）
      snapshot.isolated = true // 多线程标记：浏览器同环境共用内核、本地网络服务用随机端口
      // ⚠ 必须用 reactive() 包装：否则行的 status/errorMsg 由 startRow 在原始对象上修改，
      // 不会触发依赖收集（Vue 只在经过响应式代理写入时才 trigger），列表会永久停留在「启动中」。
      const row = reactive({
        rowId: newId('row'),
        no: ++this.rowNo,
        status: 'starting',
        errorMsg: '',
        snapshot,
        runId: null,
        unsub: null,
        watchTimer: null,
        retryTimer: null,
        retryCount: 0
      })
      this.state.rows.push(row)
      this.startRow(row)
    }
    return { ok: true, count: n }
  }

  /** 启动一行（订阅时序：先订阅 stateChange，再 createEngine → startFlow，避免漏掉 running） */
  async startRow(row) {
    const runId = newId('run')
    row.runId = runId
    row.status = 'starting'
    row.errorMsg = ''
    this.running.add(runId)

    // 启动看门狗：startFlow 之后若迟迟收不到 running 事件（主进程 handler 静默失败等），
    // 显式判为启动失败并回收实例，避免列表永远停留在「启动中」。
    clearTimeout(row.watchTimer)
    row.watchTimer = setTimeout(() => {
      if (row.status !== 'starting') return
      this.destroy(runId)
      this.handleError(row, runId, '启动超时：未收到执行状态事件')
    }, START_TIMEOUT)

    row.unsub?.()
    row.unsub = window.electronAPI.onFlowEvent('stateChange', runId, null, (event, data) => {
      if (row.runId !== runId) return // 旧一轮（已重试/已停止）的迟到事件，忽略
      const state = data?.state
      if (state === 'running') {
        clearTimeout(row.watchTimer)
        row.watchTimer = null
        row.status = 'running'
      } else if (state === 'completed') {
        row.status = 'completed'
        this.settle(row, runId)
      } else if (state === 'stopped') {
        row.status = 'stopped'
        this.settle(row, runId)
      } else if (state === 'error') {
        this.handleError(row, runId, data?.error)
      }
    })

    // 深拷贝为纯对象（row.snapshot 存放于响应式数组内，直接展开会把 Proxy 传给 IPC）后仅替换 id
    const snapshot = JSON.parse(JSON.stringify(row.snapshot))
    snapshot.id = runId
    try {
      const created = await window.electronAPI.emitFlowEvent('createEngine', null, null, snapshot)
      if (!created?.success) throw new Error(created?.message || '创建执行实例失败')
      // 创建期间被终止（stopFlow/destroyEngine 已下发）：回收刚建好的实例，不再启动
      if (row.runId !== runId || !LIVE_STATUS.has(row.status)) {
        await this.destroy(runId)
        this.settle(row, runId)
        return
      }
      const started = await window.electronAPI.emitFlowEvent('startFlow', null, null, runId)
      // 主进程 startFlow 失败时返回 { success:false, message }（不抛异常）；显式转成错误，避免停在「启动中」
      if (started && started.success === false) throw new Error(started.message || '启动工作流失败')
    } catch (e) {
      await this.destroy(runId)
      this.handleError(row, runId, e?.message || String(e))
    }
  }

  /**
   * 出错处理：开启「错误重试」时延迟重启该线程（间隔 RETRY_DELAY），重试到成功或手动停止；
   * 未开启则保持「出错」终态。
   */
  handleError(row, runId, error) {
    row.errorMsg = error || '工作流执行失败'
    this.settle(row, runId)
    if (!this.state.retryOnError || row.status === 'stopped') {
      row.status = 'error'
      return
    }
    row.retryCount += 1
    // 重试意味着本轮尚未结束：撤掉上一行结算时可能写入的结束时间
    this.state.endedAt = null
    row.status = 'retrying' // 重试等待中：保持「执行中」态，执行按钮/标签 loading 不闪断
    clearTimeout(row.retryTimer)
    row.retryTimer = setTimeout(() => {
      row.retryTimer = null
      if (row.status === 'retrying') this.startRow(row) // 等待期间若已被停止则不重启
    }, RETRY_DELAY)
  }

  /** 终态结算：释放运行标记并取消订阅（以实例 id 去重，幂等） */
  settle(row, runId) {
    if (!this.running.delete(runId)) return
    clearTimeout(row.watchTimer)
    row.watchTimer = null
    row.unsub?.()
    row.unsub = null
    // 最后一条线程到达终态：定格本轮总耗时
    if (!this.hasLive) this.state.endedAt = Date.now()
  }

  /** 强制销毁实例（worker + 浏览器引用） */
  async destroy(runId) {
    if (!runId) return
    try {
      await window.electronAPI.emitFlowEvent('destroyEngine', null, null, runId)
    } catch {
      /* 实例已结束（worker 已自动销毁）/ 宿主不可用 */
    }
  }

  /** 终止单行：停止（节点销毁钩子正常释放资源）→ 强制销毁兜底 */
  async stopRow(row) {
    clearTimeout(row.retryTimer)
    row.retryTimer = null
    if (!row?.runId) return
    const runId = row.runId
    try {
      await withTimeout(
        window.electronAPI.emitFlowEvent('stopFlow', null, null, runId).catch(() => {}),
        STOP_TIMEOUT
      )
    } catch {
      /* 忽略停止请求失败，下方强制销毁兜底 */
    }
    await this.destroy(runId)
    row.status = 'stopped'
    this.settle(row, runId)
  }

  /** 停止：终止所有未结束的线程并保留本轮记录（记录在下次执行时清空，回到可再次执行的状态） */
  async terminate() {
    const live = this.state.rows.filter((row) => LIVE_STATUS.has(row.status))
    await Promise.all(live.map((row) => this.stopRow(row)))
  }

  /** 清空线程列表（仅取消订阅与移除记录；不负责终止，终止见 terminate） */
  clearRows() {
    for (const row of this.state.rows) {
      clearTimeout(row.watchTimer)
      row.watchTimer = null
      clearTimeout(row.retryTimer)
      row.retryTimer = null
      row.unsub?.()
      row.unsub = null
    }
    this.state.rows.splice(0, this.state.rows.length)
  }
}

const runners = new Map()

/** 取指定工作流的多线程管理器（模块级缓存，跨页面存活） */
export const getRunner = (workflowId) => {
  const key = String(workflowId)
  if (!runners.has(key)) runners.set(key, new BatchRunner(key))
  return runners.get(key)
}
