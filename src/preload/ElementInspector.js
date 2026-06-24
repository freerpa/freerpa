import css2xpath from './css2xpath.js'
// =============================================================================
// 元素检查器类 - 封装所有功能，避免全局变量污染
// =============================================================================
class ElementInspector {
  // 新增：添加selector参数，默认值为'html'
  constructor(
    selector = 'html',
    sendToMain = (eventName, data) => {
      console.log('sendToMain', eventName, data)
    },
  ) {
    // 状态管理
    this.state = {
      currentElement: null,
      overlayElement: null,
      listItemOverlays: [],
      inspectorEnabled: false,
      inspectorMode: 'free', // 'free' | 'list'
      crosshair: this.createCrosshairStyle(),
      rootSelector: selector, // 新增：存储根选择器
      rootElement: null, // 新增：根元素
      maskElement: null, // 新增：遮罩元素
      focusd: false, // 新增：检查器是否聚焦
    }
    this.sendToMain = sendToMain
    // 绑定事件处理函数上下文
    this.handleMouseMove = this.throttle(this.handleMouseMove.bind(this), 50)
    this.handleContextMenu = this.handleContextMenu.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleKeyUp = this.handleKeyUp.bind(this)
    this.handlePointerDown = this.handlePointerDown.bind(this)
    this.handleClick = this.handleClick.bind(this)
    this.handleWindowBlur = this.handleWindowBlur.bind(this)

    // 初始化
    this.init()
  }

  // 初始化函数
  init() {
    // 等待DOM加载完成后初始化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.postDOMInit())
    } else {
      this.postDOMInit()
    }

    // 注册事件监听
    this.registerEvents()
  }

  getRootElement() {
    const sel = this.state.rootSelector
    let el = null
    const isXpath = sel.startsWith('::-p-xpath')
    if (isXpath) {
      function extractXPathContent(str) {
        return str.substring(11, str.length - 1)
      }
      // 辅助函数：使用 XPath 查询元素
      function evaluateXPath(xpath, contextNode = document) {
        const result = document.evaluate(
          xpath, // XPath 表达式
          contextNode, // 查询上下文
          null, // 命名空间解析器（null 表示使用默认）
          XPathResult.ANY_TYPE, // 结果类型
          null, // 结果对象（null 表示创建新的结果对象）
        )

        // 根据结果类型处理返回值
        switch (result.resultType) {
          case XPathResult.NUMBER_TYPE:
            return result.numberValue
          case XPathResult.STRING_TYPE:
            return result.stringValue
          case XPathResult.BOOLEAN_TYPE:
            return result.booleanValue
          case XPathResult.UNORDERED_NODE_ITERATOR_TYPE:
            // 处理节点迭代器结果
            const nodes = []
            let node
            while ((node = result.iterateNext())) {
              nodes.push(node)
            }
            return nodes
          default:
            return null
        }
      }
      const items = evaluateXPath(extractXPathContent(sel))
      if (items.length > 0) {
        el = items[0]
      }
    } else {
      el = document.querySelector(sel)
    }
    return el
  }

  // 新增：DOM加载完成后的初始化工作
  postDOMInit() {
    // 获取根元素
    this.state.rootElement = this.getRootElement()
    if (this.state.rootElement && this.state.rootSelector !== 'html') {
      this.initMask()
      this.showMask()
    } else {
      this.state.rootElement = document.documentElement
      this.state.rootSelector = 'html'
    }

    // 初始化覆盖层和遮罩
    this.initOverlay()
  }

  // 创建鼠标十字线样式元素
  createCrosshairStyle() {
    const style = document.createElement('style')
    style.textContent = ' * {cursor: crosshair !important}'
    return style
  }

  // 初始化基础覆盖层
  initOverlay() {
    this.state.overlayElement = this.createBaseOverlay(
      {
        top: 0,
        left: 0,
        width: 0,
        height: 0,
      },
      {
        zIndex: 999999,
        backgroundColor: 'rgba(88, 129, 207, 0.6)',
        border: '1px dashed rgba(0, 0, 0, 0.6)',
        display: 'none',
      },
    )
    const label = document.createElement('div')
    Object.assign(label.style, {
      position: 'absolute',
      top: '-21px',
      left: '-1px',
      height: '16px',
      backgroundColor: 'rgba(88, 129,207, 1)',
      color: 'white',
      fontSize: '12px',
      padding: '2px 6px',
    })
    this.state.overlayElement.appendChild(label)
    this.state.overlayElement.label = label
  }

  // 新增：初始化遮罩层
  initMask() {
    if (this.state.maskElement) return
    // 创建四个遮罩区域：根元素上方、下方、左侧、右侧
    const createMaskRegion = (styles) => {
      const mask = document.createElement('div')
      Object.assign(mask.style, {
        position: 'fixed',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        pointerEvents: 'auto',
        zIndex: 999999,
        ...styles,
      })
      document.body.appendChild(mask)
      return mask
    }

    this.state.maskElement = {
      top: createMaskRegion({ left: 0, right: 0, top: 0, height: 0 }),
      bottom: createMaskRegion({ left: 0, right: 0, bottom: 0, height: 0 }),
      left: createMaskRegion({ top: 0, bottom: 0, left: 0, width: 0 }),
      right: createMaskRegion({ top: 0, bottom: 0, right: 0, width: 0 }),
    }
  }

  // 获取滚动条宽度的函数
  getScrollbarWidth() {
    const scrollWidth = { x: 0, y: 0 }
    // 创建用于测量的元素
    const outer = document.createElement('div')
    outer.style.visibility = 'hidden'
    outer.style.overflow = 'scroll' // 强制显示滚动条
    outer.style.msOverflowStyle = 'scrollbar' // 针对IE
    outer.style.position = 'absolute'
    outer.style.top = '-9999px'
    document.body.appendChild(outer)

    // 创建内部元素
    const inner = document.createElement('div')
    outer.appendChild(inner)

    // 计算滚动条宽度
    scrollWidth.y = outer.offsetWidth - inner.offsetWidth
    scrollWidth.x = outer.offsetHeight - inner.offsetHeight

    // 清理创建的元素
    document.body.removeChild(outer)

    if (!(document.documentElement.scrollHeight > window.innerHeight)) {
      scrollWidth.y = 0
    }
    if (!(document.documentElement.scrollWidth > window.innerWidth)) {
      scrollWidth.x = 0
    }

    return scrollWidth
  }

  getBoundingClientRect(element) {
    const rect = element.getBoundingClientRect().toJSON()
    const computedStyle = window.getComputedStyle(element)
    const style = {
      borderLeftWidth: parseFloat(computedStyle.borderLeftWidth),
      borderRightWidth: parseFloat(computedStyle.borderRightWidth),
      borderTopWidth: parseFloat(computedStyle.borderTopWidth),
      borderBottomWidth: parseFloat(computedStyle.borderBottomWidth),
      marginLeft: parseFloat(computedStyle.marginLeft),
      marginRight: parseFloat(computedStyle.marginRight),
      marginTop: parseFloat(computedStyle.marginTop),
      marginBottom: parseFloat(computedStyle.marginBottom),
    }
    rect.width =
      rect.width +
      style.borderLeftWidth +
      style.borderRightWidth +
      style.marginLeft +
      style.marginRight
    rect.height =
      rect.height +
      style.borderTopWidth +
      style.borderBottomWidth +
      style.marginTop +
      style.marginBottom
    rect.top = rect.top - style.marginTop - style.borderTopWidth
    rect.left = rect.left - style.marginLeft - style.borderLeftWidth
    rect.right = rect.right + style.marginRight + style.borderRightWidth
    rect.bottom = rect.bottom + style.marginBottom + style.borderBottomWidth
    return rect
  }

  // 新增：更新遮罩层位置
  updateMask() {
    if (!this.state.maskElement || !this.state.rootElement) return

    const rect = this.getBoundingClientRect(this.state.rootElement)
    const { top, bottom, left, right, height } = rect
    const scrollWidth = this.getScrollbarWidth()
    console.log('scrollWidth', scrollWidth)
    // 更新四个方向的遮罩
    this.state.maskElement.top.style.height = `${top}px`
    this.state.maskElement.bottom.style.height = `${window.innerHeight - bottom - scrollWidth.x}px`
    this.state.maskElement.left.style.width = `${left}px`
    this.state.maskElement.left.style.height = `${height}px`
    this.state.maskElement.left.style.top = `${top}px`
    this.state.maskElement.right.style.width = `${window.innerWidth - right - scrollWidth.y}px`
    this.state.maskElement.right.style.height = `${height}px`
    this.state.maskElement.right.style.top = `${top}px`
  }

  // 新增：显示遮罩
  showMask() {
    if (!this.state.maskElement) return
    Object.values(this.state.maskElement).forEach((mask) => {
      mask.style.display = 'block'
    })
    this.updateMask()
  }

  removeMask() {
    if (this.state.maskElement) {
      Object.values(this.state.maskElement).forEach((mask) => {
        mask.remove()
      })
      this.state.maskElement = null
    }
  }

  // 新增：检查元素是否在根选择器范围内
  isElementInRoot(element) {
    if (!this.state.rootElement || !element || element === this.state.rootElement) return false
    return this.state.rootElement.contains(element)
  }

  // =============================================================================
  // 覆盖层管理
  // =============================================================================

  // 创建基础覆盖层
  createBaseOverlay(rect, styles = {}) {
    if (!document.body) {
      return null
    }

    const overlay = document.createElement('div')
    const defaultStyles = {
      position: 'absolute',
      cursor: '',
      pointerEvents: 'none',
      boxSizing: 'border-box',
      zIndex: 999999,
      top: `${rect.top + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    }

    // 合并样式（自定义样式优先）
    const finalStyles = { ...defaultStyles, ...styles }

    // 应用样式
    Object.entries(finalStyles).forEach(([key, value]) => {
      overlay.style[key] = value
    })

    document.body.appendChild(overlay)
    return overlay
  }

  // 列表项点击处理
  handleListItemClick(e) {
    e.stopPropagation()
    e.preventDefault()
    const selector = e.currentTarget.groupSelector
    const xpath = css2xpath(selector)
    this.sendToMain('selector', { xpath, selector })
  }

  // 列表项右键点击处理
  handleListContextMenu(e) {
    e.preventDefault()
    e.stopPropagation()
    const overlay = e.currentTarget
    const groupSelector = overlay.groupSelector
    this.state.rootSelector = groupSelector + `:nth-child(${overlay.index})`
    this.state.inspectorEnabled = false
    this.setInspectorMode('free')
    this.postDOMInit()
  }

  // 列表项鼠标悬停处理
  handleListItemMouseOver(e) {
    const overlay = e.currentTarget
    overlay.style.backgroundColor = 'rgba(88, 129, 207, 0.6)'
    overlay.style.border = '1px dashed rgba(0, 0, 0, 0.6)'
    overlay.label.style.backgroundColor = 'rgba(88, 129, 207, 1)'
  }

  // 列表项鼠标移出处理
  handleListItemMouseOut(e) {
    const overlay = e.currentTarget
    overlay.style.backgroundColor = 'rgba(255, 165, 0, 0.4)'
    overlay.style.border = '1px dashed rgba(255, 140, 0, 0.8)'
    overlay.label.style.backgroundColor = 'rgba(255, 140, 0, 1)'
  }

  // 创建列表项覆盖层
  createListItemOverlay(rect, index, groupSelector) {
    const overlay = this.createBaseOverlay(rect, {
      zIndex: 999998,
      backgroundColor: 'rgba(255, 165, 0, 0.4)',
      border: '1px dashed rgba(255, 140, 0, 0.8)',
      pointerEvents: 'click',
      cursor: 'pointer',
    })

    if (overlay) {
      overlay.label = this.createIndexLabel(index)
      overlay.index = index
      overlay.groupSelector = groupSelector
      overlay.appendChild(overlay.label)
      overlay.addEventListener('click', this.handleListItemClick.bind(this))
      overlay.addEventListener('contextmenu', this.handleListContextMenu.bind(this))
      overlay.addEventListener('mouseover', this.handleListItemMouseOver.bind(this))
      overlay.addEventListener('mouseout', this.handleListItemMouseOut.bind(this))
    }

    return overlay
  }

  // 创建列表项索引标签
  createIndexLabel(index) {
    const label = document.createElement('div')
    Object.assign(label.style, {
      position: 'absolute',
      top: '0px',
      left: '0',
      backgroundColor: 'rgba(255, 140, 0, 1)',
      color: 'white',
      fontSize: '12px',
      padding: '2px 6px',
      fontWeight: 'bold',
    })
    label.textContent = index
    return label
  }

  // 更新覆盖层位置和大小
  updateOverlay() {
    if (!this.state.overlayElement) return
    const rect = this.state.currentElement.getBoundingClientRect()
    if (rect && rect.width > 0 && rect.height > 0) {
      const { overlayElement } = this.state
      overlayElement.style.display = 'block'
      overlayElement.style.top = `${rect.top + window.scrollY}px`
      overlayElement.style.left = `${rect.left + window.scrollX}px`
      overlayElement.style.width = `${rect.width}px`
      overlayElement.style.height = `${rect.height}px`
      overlayElement.label.textContent = this.state.currentElement.tagName.toLowerCase()
    }
  }

  // 清除元素覆盖层
  clearOverlay() {
    if (this.state.overlayElement) {
      this.state.overlayElement.style.width = '0'
      this.state.overlayElement.style.height = '0'
      this.state.overlayElement.style.display = 'none'
    }
  }

  // 清除所有列表项覆盖层
  clearListItemOverlays() {
    this.state.listItemOverlays.forEach((overlay) => {
      if (overlay && overlay.parentNode) {
        overlay.removeEventListener('click', this.handleListItemClick)
        overlay.removeEventListener('contextmenu', this.handleListContextMenu)
        overlay.removeEventListener('mouseover', this.handleListItemMouseOver)
        overlay.removeEventListener('mouseout', this.handleListItemMouseOut)
        overlay.parentNode.removeChild(overlay)
      }
    })
    this.state.listItemOverlays = []
  }

  // 高亮当前元素
  highlightElement() {
    this.clearOverlay()
    // 只高亮根元素范围内的元素
    if (this.state.currentElement && this.isElementInRoot(this.state.currentElement)) {
      this.updateOverlay()
    }
  }

  // =============================================================================
  // 列表项管理 - 优化后版本
  // =============================================================================

  // 高亮显示列表项（优化核心方法）
  highlightListItems() {
    this.clearListItemOverlays()

    const allowTags = new Set(['LI', 'TR', 'DIV'])

    // 只选择根元素内的元素
    const candidateElements = Array.from(this.state.rootElement.querySelectorAll('*')).filter(
      (el) => allowTags.has(el.tagName),
    )

    const parentGroups = this.groupElementsByParent(candidateElements)

    Object.values(parentGroups).forEach((siblings) => {
      const tagGroups = this.groupElementsByTag(siblings)

      Object.values(tagGroups).forEach((tagSiblings) => {
        // 关键优化：先检查是否能提取共同选择器，再决定是否处理
        const commonSelector = this.findCommonSelector(tagSiblings)

        if (commonSelector && tagSiblings.length >= 2) {
          tagSiblings.forEach((item, index) => {
            const rect = item.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0 && this.isElementVisible(item)) {
              const overlay = this.createListItemOverlay(rect, index + 1, commonSelector)
              if (overlay) this.state.listItemOverlays.push(overlay)
            }
          })
        }
      })
    })
  }

  // 新增：查找一组同级同标签元素的共同选择器
  findCommonSelector(elements) {
    if (!elements || elements.length < 2) return null

    // 验证是否真的同级同标签（双重校验）
    const first = elements[0]
    if (
      !elements.every((el) => el.tagName === first.tagName && el.parentNode === first.parentNode)
    ) {
      return null
    }

    const tagName = first.tagName.toLowerCase()
    const parent = first.parentNode
    const { selector: parentSelector } = this.getElementPaths(parent)

    // 1. 查找共同的稳定类（必须全部元素都包含的非动态类）
    const commonClasses = this.findCommonStableClasses(elements)
    if (commonClasses.length > 0) {
      return `${parentSelector} ${tagName}.${commonClasses.map(this.escapeValue).join('.')}`
    }

    // 2. 查找共同的数据属性（只需要属性名存在，不强制值相同）
    const commonDataAttrs = this.findCommonDataAttributes(elements)
    if (commonDataAttrs.length > 0) {
      const attrSelectors = commonDataAttrs.map((attr) => `[${attr}]`).join('')
      return `${parentSelector} ${tagName}${attrSelectors}`
    }

    // 3. 查找共同的标准属性（如name/type等）
    const commonAttrs = this.findCommonAttributes(elements, ['name', 'type', 'role'])
    if (commonAttrs.length > 0) {
      const attrSelectors = commonAttrs.map((attr) => `[${attr}]`).join('')
      return `${parentSelector} ${tagName}${attrSelectors}`
    }

    // 4. 最后检查是否有相同的属性值组合（严格匹配）
    const commonAttrValues = this.findCommonAttributeValues(elements)
    if (commonAttrValues.length > 0) {
      const attrSelectors = commonAttrValues
        .map(({ name, value }) => `[${name}="${this.escapeValue(value)}"]`)
        .join('')
      return `${parentSelector} ${tagName}${attrSelectors}`
    }

    if (['li', 'tr'].includes(tagName)) {
      return `${parentSelector} ${tagName}`
    }

    // 无法提取共同选择器，返回null
    return null
  }

  // 新增：查找元素组共同的稳定类
  findCommonStableClasses(elements) {
    const firstStableClasses = new Set(
      this.getClassList(elements[0]).filter((cls) => !this.isDynamicClass(cls)),
    )

    return elements.reduce((common, el) => {
      const currentStable = new Set(
        this.getClassList(el).filter((cls) => !this.isDynamicClass(cls)),
      )
      return common.filter((cls) => currentStable.has(cls))
    }, Array.from(firstStableClasses))
  }

  // 新增：查找元素组共同的数据属性名
  findCommonDataAttributes(elements) {
    const firstDataAttrs = new Set(this.getDataAttributes(elements[0]).map((attr) => attr.name))

    return elements.reduce((common, el) => {
      const currentDataAttrs = new Set(this.getDataAttributes(el).map((attr) => attr.name))
      return common.filter((attr) => currentDataAttrs.has(attr))
    }, Array.from(firstDataAttrs))
  }

  // 新增：查找元素组共同拥有的指定属性
  findCommonAttributes(elements, attrNames) {
    return attrNames.filter((attr) => elements.every((el) => el.hasAttribute(attr)))
  }

  // 新增：查找元素组共同的属性值组合
  findCommonAttributeValues(elements) {
    if (elements.length < 2) return []

    // 提取第一个元素的关键属性值
    const firstAttrs = this.getDataAttributes(elements[0])
      .filter((attr) => ['data-id', 'data-key', 'data-testid'].includes(attr.name))
      .concat(
        Array.from(elements[0].attributes)
          .filter((attr) => ['name', 'type'].includes(attr.name))
          .map((attr) => ({ name: attr.name, value: attr.value })),
      )

    return firstAttrs.filter(({ name, value }) => {
      // 检查所有元素是否有相同的属性值
      return elements.every((el) => {
        const elValue = el.getAttribute(name)
        return elValue !== null && elValue === value
      })
    })
  }

  // 按父节点分组（确保同级）
  groupElementsByParent(elements) {
    const groups = {}

    elements.forEach((element) => {
      if (!element.parentNode) return

      // 使用父节点的唯一标识作为键
      const parentKey = this.getElementUniqueKey(element.parentNode)
      if (!groups[parentKey]) {
        groups[parentKey] = []
      }
      groups[parentKey].push(element)
    })

    return groups
  }

  // 按标签名分组（确保同标签）
  groupElementsByTag(elements) {
    const groups = {}

    elements.forEach((element) => {
      const tagName = element.tagName
      if (!groups[tagName]) {
        groups[tagName] = []
      }
      groups[tagName].push(element)
    })

    return groups
  }

  // 获取元素的唯一标识键
  getElementUniqueKey(element) {
    if (element.id) {
      return `id:${element.id}`
    }

    // 使用路径和索引生成唯一键
    let key = []
    let current = element
    let index = 0

    while (current && current !== document) {
      index = 0
      let sibling = current.previousSibling
      while (sibling) {
        if (sibling.nodeType === 1 && sibling.tagName === current.tagName) {
          index++
        }
        sibling = sibling.previousSibling
      }

      key.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${index + 1})`)
      current = current.parentNode
    }

    return key.join(' > ')
  }

  // =============================================================================
  // 事件处理
  // =============================================================================

  // 注册所有事件监听
  registerEvents() {
    window.addEventListener('mousemove', this.handleMouseMove, true)
    window.addEventListener('pointerdown', this.handlePointerDown, true)
    window.addEventListener('contextmenu', this.handleContextMenu, true)
    window.addEventListener('click', this.handleClick, true)
    window.addEventListener('keydown', this.handleKeyDown, true)
    window.addEventListener('keyup', this.handleKeyUp, true)
    window.addEventListener('blur', this.handleWindowBlur)
    // 新增：窗口滚动或大小改变时更新遮罩
    window.addEventListener('scroll', this.updateMask.bind(this))
    window.addEventListener('resize', this.updateMask.bind(this))
  }

  // 移除所有事件监听
  removeEvents() {
    window.removeEventListener('mousemove', this.handleMouseMove, true)
    window.removeEventListener('pointerdown', this.handlePointerDown, true)
    window.removeEventListener('contextmenu', this.handleContextMenu, true)
    window.removeEventListener('click', this.handleClick, true)
    window.removeEventListener('keydown', this.handleKeyDown, true)
    window.removeEventListener('keyup', this.handleKeyUp, true)
    window.removeEventListener('blur', this.handleWindowBlur)
    // 新增：移除窗口事件监听
    window.removeEventListener('scroll', this.updateMask.bind(this))
    window.removeEventListener('resize', this.updateMask.bind(this))
  }

  // 鼠标移动事件处理（带节流）
  handleMouseMove(e) {
    this.sendToMain('mouseenter')
    window.focus()
    if (!this.state.inspectorEnabled) return
    const target = document.elementFromPoint(e.clientX, e.clientY)
    // 只处理根元素范围内的元素
    if (target && this.isElementInRoot(target) && target !== this.state.currentElement) {
      this.state.currentElement = target
      this.state.inspectorMode === 'free' && this.highlightElement()
    } else if (target && !this.isElementInRoot(target)) {
      this.state.currentElement = null
      // 不在范围内的元素不高亮
      this.clearOverlay()
    }
  }

  // 点击事件处理
  handlePointerDown(e) {
    if (!this.state.inspectorEnabled) return
    // 只处理根元素范围内的点击
    if (this.state.currentElement && this.isElementInRoot(this.state.currentElement)) {
      e.preventDefault()
      e.stopPropagation()

      const { xpath, selector } = this.getElementPaths(this.state.currentElement)
      this.sendToMain('selector', { xpath, selector })
    }
  }

  // 上下文菜单事件处理
  handleContextMenu(e) {
    if (!this.state.inspectorEnabled) return
    // 只处理根元素范围内的上下文菜单
    e.preventDefault()
    e.stopPropagation()
    const { selector } = this.getElementPaths(this.state.currentElement)
    this.state.rootSelector = this.state.rootSelector + ' ' + selector
    this.clearOverlay()
    this.postDOMInit()
  }

  // 阻止默认点击行为
  handleClick(e) {
    if (this.state.inspectorEnabled) {
      e.preventDefault()
      e.stopPropagation()
    }
  }
  /**
   * 判断当前浏览器是否运行在 macOS 系统
   * @returns {boolean} true: 是 macOS; false: 否
   */
  isMacOS() {
    // 兜底：若 navigator 不存在（非浏览器环境），返回 false
    if (!window.navigator) return false
    // 检测 platform 是否以 "Mac" 开头（覆盖所有 Mac 平台）
    return /^Mac/.test(navigator.platform)
  }

  isCtrlKey(e) {
    // 检查是否是Ctrl或Command键
    return this.isMacOS() ? e.metaKey : e.ctrlKey
  }

  // 键盘按下事件处理
  handleKeyDown(e) {
    // Ctrl/Command键启用检查模式
    if (this.isCtrlKey(e) && !this.state.inspectorEnabled) {
      this.state.inspectorEnabled = true
      document.head.appendChild(this.state.crosshair)
    }

    // Alt键切换到列表模式
    if (e.altKey && this.state.inspectorMode !== 'list') {
      this.setInspectorMode('list')
    }

    if (e.key === 'Escape') {
      this.removeMask()
      this.state.rootSelector = 'html'
      this.postDOMInit()
    }
  }

  // 键盘释放事件处理
  handleKeyUp(e) {
    // 释放Ctrl/Command键禁用检查模式
    if (!this.isCtrlKey(e)) {
      this.cleanupInspectorState()
    }

    // 释放Alt键切换回自由模式
    if (!e.altKey && this.state.inspectorMode === 'list') {
      this.setInspectorMode('free')
    }
  }

  // 窗口失焦处理
  handleWindowBlur() {
    this.cleanupInspectorState()
  }

  // 清理检查器状态
  cleanupInspectorState() {
    this.clearOverlay()
    this.clearListItemOverlays()
    this.state.inspectorEnabled = false
    this.state.currentElement = null

    if (this.state.crosshair.parentNode) {
      document.head.removeChild(this.state.crosshair)
    }
  }

  // =============================================================================
  // 检查器控制
  // =============================================================================

  // 设置检查器模式
  setInspectorMode(mode) {
    if (this.state.inspectorMode === mode) return

    this.state.inspectorMode = mode

    if (mode === 'free') {
      this.clearListItemOverlays()
    } else if (mode === 'list') {
      this.clearOverlay()
      this.state.inspectorEnabled = false
      this.highlightListItems()
    }
  }

  // =============================================================================
  // 元素路径生成
  // =============================================================================

  // 获取元素的XPath和CSS选择器
  getElementPaths(element) {
    const result = { xpath: '', selector: '' }
    if (!element || element.nodeType !== 1 || !this.isElementInRoot(element)) return result

    // ID优先
    if (element.id) {
      const escapedId = this.escapeValue(element.id)
      result.xpath = `//*[@id="${escapedId}"]`
      result.selector = `#${escapedId}`
      return result
    }

    const identity = this.getElementIdentity(element)
    result.selector = this.generateCSSSelector(element, identity)
    result.xpath = css2xpath(result.selector)

    return result
  }

  // 获取元素唯一标识信息
  getElementIdentity(element) {
    return {
      uniqueClass: this.getUniqueClass(element),
      uniqueAttr: this.getUniqueAttribute(element),
      uniqueText: this.getUniqueText(element),
      classCombo: this.getUniqueClassCombination(element),
      attrCombo: this.getUniqueAttributeCombination(element),
      index: this.getStableElementIndex(element),
    }
  }

  // 生成CSS选择器
  generateCSSSelector(element, identity) {
    const parts = []
    let current = element
    let currentIdentity = identity

    // 限制只在根元素内生成选择器
    while (current && current !== document && this.isElementInRoot(current)) {
      if (current.nodeType !== 1) {
        current = current.parentNode
        currentIdentity = current ? this.getElementIdentity(current) : null
        continue
      }

      const tagName = current.tagName.toLowerCase()
      if (tagName === 'html') {
        parts.unshift('html')
        break
      }
      if (tagName === 'body') {
        parts.unshift('body')
        current = current.parentNode
        continue
      }

      let cssPart = this.buildCssPart(current, currentIdentity, tagName)
      parts.unshift(cssPart)

      // 检查选择器是否唯一
      const testSelector = parts.join(' > ')
      if (this.isUniqueBySelector(testSelector)) break

      current = current.parentNode
      currentIdentity = current ? this.getElementIdentity(current) : null
    }

    return parts.join(' > ')
  }

  // 检查元素标签是否唯一
  isUniqueByTag(element, tagName) {
    return element.parentElement.querySelectorAll(tagName).length === 1
  }

  // 构建CSS选择器部分
  buildCssPart(element, identity, tagName) {
    if (element.id && /^[a-zA-Z_][a-zA-Z0-9_-]{2,19}$/.test(element.id)) {
      return `#${this.escapeValue(element.id)}`
    } else if (this.isUniqueByTag(element, tagName)) {
      return tagName
    } else if (identity.uniqueClass) {
      return this.buildClassSelector(element, identity.uniqueClass, tagName)
    } else if (identity.uniqueAttr) {
      return `${tagName}[${identity.uniqueAttr.name}="${this.escapeValue(
        identity.uniqueAttr.value,
      )}"]`
    } else if (identity.attrCombo) {
      return this.generateSelectorForAttributeCombo(element, identity.attrCombo)
    } else if (identity.classCombo) {
      return this.buildClassComboSelector(element, identity.classCombo, tagName)
    } else {
      return `${tagName}:nth-of-type(${identity.index})`
    }
  }

  // =============================================================================
  // 工具函数
  // =============================================================================

  /**
   * 判断元素是否完全显示（完全在视口内 + 无任何遮挡 + 自身样式可见）
   * @param {HTMLElement} el 目标元素
   * @returns {boolean} 是否完全显示
   */

  isElementVisible(el) {
    // 1. 基础隐藏检查
    if (this.isElementVisuallyHidden(el)) return false

    // 2. 视口可见性检查
    if (!this.isElementInViewport(el)) return false

    // 3. 检查祖先元素是否遮挡（如overflow:hidden导致元素被裁剪）
    let parent = el.parentElement
    while (parent && parent !== document.body) {
      const parentStyle = window.getComputedStyle(parent)
      // 祖先元素设置了overflow:hidden且可能裁剪子元素
      if (parentStyle.overflow === 'hidden' || parentStyle.overflow === 'scroll') {
        const parentRect = parent.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        // 子元素完全超出父元素范围（被裁剪）
        if (
          elRect.top > parentRect.bottom ||
          elRect.bottom < parentRect.top ||
          elRect.left > parentRect.right ||
          elRect.right < parentRect.left
        ) {
          return false
        }
      }
      parent = parent.parentElement
    }

    return true
  }

  isElementVisuallyHidden(el) {
    if (!el) return true // 元素不存在，视为不可见

    const style = window.getComputedStyle(el) // 获取计算后的样式（考虑所有CSS影响）

    // 检查display、visibility、opacity
    if (style.display === 'none') return true
    if (style.visibility === 'hidden') return true
    if (Number(style.opacity) === 0) return true

    // 检查尺寸是否为0
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return true

    return false // 未被上述条件隐藏
  }
  isElementInViewport(el) {
    if (!el || this.isElementVisuallyHidden(el)) return false // 先排除基础隐藏的元素
    const rect = el.getBoundingClientRect()
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight

    // 元素与视口有重叠区域（不完全在视口外）
    return (
      rect.top < viewportHeight && // 元素顶部在视口底部之上
      rect.bottom > 0 && // 元素底部在视口顶部之下
      rect.left < viewportWidth && // 元素左侧在视口右侧之左
      rect.right > 0 // 元素右侧在视口左侧之右
    )
  }
  // 获取元素类列表（去重和过滤空值）
  getClassList(element) {
    // 确保是元素节点且存在className属性
    if (element.nodeType !== 1 || typeof element.className !== 'string') {
      return []
    }
    return element.className.trim().split(/\s+/).filter(Boolean)
  }

  // 获取元素data属性列表
  getDataAttributes(element) {
    return Array.from(element.attributes)
      .filter((attr) => attr.name.startsWith('data-'))
      .map((attr) => ({ name: attr.name, value: attr.value }))
  }

  // 检查选择器是否唯一
  isUniqueBySelector(selector) {
    try {
      // 只在根元素内检查唯一性
      return this.state.rootElement.querySelectorAll(selector).length === 1
    } catch (e) {
      return false
    }
  }

  // 获取元素稳定索引
  getStableElementIndex(element) {
    let index = 1
    let sibling = element.previousElementSibling
    while (sibling) {
      if (sibling.tagName === element.tagName) index++
      sibling = sibling.previousElementSibling
    }
    return index
  }

  // 判断是否为动态类
  isDynamicClass(cls) {
    const dynamicPatterns = [
      // 框架特定前缀
      /^(ng|v|mat|md|el|ant|vue|react)-/,
      // 哈希/数字模式
      /^_[a-z0-9]+$/,
      /^[0-9]+$/,
      /[0-9]+$/,
      /-[0-9a-f]{8,}$/,
      // 时间戳/版本号
      /\d{10,}/,
      /v\d+\.\d+/,
      // 随机字符串模式
      /^[a-z]{8,}-/,
      /-[a-z0-9]{10,}/,
      // 动态哈希模式
      /^[a-z]+_[a-z0-9]{6,}$/,
      /^[a-z]+-[a-z0-9]{6,}$/,
    ]
    return dynamicPatterns.some((pattern) => pattern.test(cls))
  }

  // 转义选择器特殊字符
  escapeValue(value) {
    if (typeof value !== 'string') return ''
    // 转义CSS选择器特殊字符
    return value.replace(/[!"#$%&'()*+,./:;<=>?@[\]^`{|}~]/g, '\\$&')
  }

  // 为属性组合生成选择器
  generateSelectorForAttributeCombo(element, attrCombo) {
    const attrs = attrCombo
      .map((attr) => `[${attr.name}="${this.escapeValue(attr.value)}"]`)
      .join('')
    return `${element.tagName.toLowerCase()}${attrs}`
  }

  // 获取允许检查的属性列表
  getAllowAttribute(element) {
    //禁止检查data-*属性
    const forbidAttrs = [
      /^((?!class|name|label|title|alt|href|src|value|loading|style|target|tag).)*$/i,
      /id/,
      /^data-/,
    ]
    const allAttrs = element.getAttributeNames()
    const allowAttrs = allAttrs.filter((attr) => forbidAttrs.some((pattern) => pattern.test(attr)))
    return allowAttrs
  }

  // 获取唯一属性
  getUniqueAttribute(element) {
    const allowAttrs = this.getAllowAttribute(element)
    for (const attr of allowAttrs) {
      const value = element.getAttribute(attr)
      if (value) {
        const selector = `${element.tagName.toLowerCase()}[${attr}="${this.escapeValue(value)}"]`
        if (this.isUniqueBySelector(selector)) {
          return { name: attr, value }
        }
      }
    }
    return null
  }

  // 其他工具函数保持不变...
  getUniqueAttributeCombination(element) {
    const allowAttrs = this.getAllowAttribute(element)
    // 尝试两两组合
    for (let i = 0; i < allowAttrs.length; i++) {
      for (let j = i + 1; j < allowAttrs.length; j++) {
        const combo = [allowAttrs[i], allowAttrs[j]]
        const selector = `${element.tagName.toLowerCase()}[${
          combo[0]
        }="${this.escapeValue(element.getAttribute(combo[0]))}"][${
          combo[1]
        }="${this.escapeValue(element.getAttribute(combo[1]))}"]`
        if (this.isUniqueBySelector(selector)) {
          return combo
        }
      }
    }

    return null
  }

  getUniqueClass(element) {
    const classes = this.getClassList(element)

    // 优先检查非动态类
    for (const cls of classes) {
      if (!this.isDynamicClass(cls)) {
        const selector = `${element.tagName.toLowerCase()}.${this.escapeValue(cls)}`
        if (this.isUniqueBySelector(selector)) {
          return cls
        }
      }
    }

    // 检查动态类
    for (const cls of classes) {
      if (this.isDynamicClass(cls)) {
        // 提取类名的固定部分
        const prefixMatch = cls.match(/^([a-z]+)[_-]/i)
        const suffixMatch = cls.match(/[_-]([a-z]+)$/i)

        if (prefixMatch && prefixMatch[1].length >= 2) {
          const selector = `${element.tagName.toLowerCase()}[class^="${this.escapeValue(
            prefixMatch[1],
          )}"]`
          if (this.isUniqueBySelector(selector)) {
            return { type: 'prefix', value: prefixMatch[1] }
          }
        } else if (suffixMatch && suffixMatch[1].length >= 2) {
          const selector = `${element.tagName.toLowerCase()}[class$="${this.escapeValue(
            suffixMatch[1],
          )}"]`
          if (this.isUniqueBySelector(selector)) {
            return { type: 'suffix', value: suffixMatch[1] }
          }
        }
      }
    }

    return null
  }

  getUniqueText(element) {
    const text = element.textContent.trim()
    if (!text) return null

    const tag = element.tagName.toLowerCase()
    // 精确匹配
    if (this.isUniqueByXPath(`//${tag}[text()="${this.escapeValue(text)}"]`)) {
      return text
    }
    // 包含匹配
    if (this.isUniqueByXPath(`//${tag}[contains(text(), "${this.escapeValue(text)}")]`)) {
      return text
    }
    return null
  }

  getUniqueClassCombination(element) {
    const classes = this.getClassList(element)
    // 单个非动态类
    for (const cls of classes) {
      if (
        !this.isDynamicClass(cls) &&
        this.isUniqueBySelector(`${element.tagName.toLowerCase()}.${this.escapeValue(cls)}`)
      ) {
        return [cls]
      }
    }

    // 非动态类两两组合
    for (let i = 0; i < classes.length; i++) {
      for (let j = i + 1; j < classes.length; j++) {
        if (!this.isDynamicClass(classes[i]) && !this.isDynamicClass(classes[j])) {
          const selector = `${element.tagName.toLowerCase()}.${this.escapeValue(
            classes[i],
          )}.${this.escapeValue(classes[j])}`
          if (this.isUniqueBySelector(selector)) {
            return [classes[i], classes[j]]
          }
        }
      }
    }

    return null
  }

  buildClassSelector(element, uniqueClass, tagName) {
    if (typeof uniqueClass === 'object') {
      return uniqueClass.type === 'prefix'
        ? `${tagName}[class^="${this.escapeValue(uniqueClass.value)}"]`
        : `${tagName}[class$="${this.escapeValue(uniqueClass.value)}"]`
    }
    return `${tagName}.${this.escapeValue(uniqueClass)}`
  }

  buildClassComboSelector(element, classCombo, tagName) {
    const classSelectors = classCombo.map((cls) => `.${this.escapeValue(cls)}`).join('')
    return `${tagName}${classSelectors}`
  }

  isUniqueByXPath(xpath) {
    try {
      const result = document.evaluate(
        xpath,
        this.state.rootElement, // 只在根元素内检查XPath唯一性
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null,
      )
      return result.snapshotLength === 1
    } catch (e) {
      return false
    }
  }

  throttle(fn, delay) {
    let lastTime = 0
    return function (...args) {
      const now = Date.now()
      if (now - lastTime >= delay) {
        lastTime = now
        fn.apply(this, args)
      }
    }
  }

  clear() {
    if (this.state.overlayElement) {
      this.state.overlayElement.remove()
    }
    this.clearListItemOverlays()
    this.removeMask()
    this.removeEvents()

    this.state = {
      currentElement: null,
      overlayElement: null,
      listItemOverlays: [],
      inspectorEnabled: false,
      inspectorMode: 'free', // 'free' | 'list'
      crosshair: null,
      rootSelector: null, // 新增：存储根选择器
      rootElement: null, // 新增：根元素
      maskElement: null, // 新增：遮罩元素
      focusd: false, // 新增：检查器是否聚焦
    }
  }
}

export default ElementInspector
