/*
 * 文件名：main.js
 * 作者：dabao
 * 日期：2024-03-21
 * 描述：官网主要交互脚本
 */

// 导航栏滚动效果
const navbar = document.querySelector('.navbar')
let lastScrollY = window.scrollY

window.addEventListener('scroll', () => {
  if (lastScrollY < window.scrollY) {
    navbar.style.transform = 'translateY(-100%)'
  } else {
    navbar.style.transform = 'translateY(0)'
  }
  lastScrollY = window.scrollY
})

// 平滑滚动
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault()
    const target = document.querySelector(this.getAttribute('href'))
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth'
      })
    }
  })
})

// 动画观察器
const observerOptions = {
  root: null,
  rootMargin: '0px',
  threshold: 0.1
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animate-in')
      observer.unobserve(entry.target)
    }
  })
}, observerOptions)

// 添加动画类
document.querySelectorAll('.feature-card, .product-image, .about-content').forEach((el) => {
  el.classList.add('animate-on-scroll')
  observer.observe(el)
})

// 添加动画CSS
const style = document.createElement('style')
style.textContent = `
    .animate-on-scroll {
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.6s ease-out;
    }
    
    .animate-in {
        opacity: 1;
        transform: translateY(0);
    }
`
document.head.appendChild(style)

// 性能优化：防抖函数
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// 优化滚动事件
window.addEventListener(
  'scroll',
  debounce(() => {
    if (window.scrollY > 100) {
      navbar.classList.add('navbar-scrolled')
    } else {
      navbar.classList.remove('navbar-scrolled')
    }
  }, 20)
)

// 添加页面加载完成动画
window.addEventListener('load', () => {
  document.body.classList.add('loaded')
})

// 节点滚动效果
document.addEventListener('DOMContentLoaded', () => {
  const nodeTracks = document.querySelectorAll('.nodes-track')

  nodeTracks.forEach((track) => {
    // 复制两次节点实现无缝滚动
    const cards = track.innerHTML
    track.innerHTML = cards + cards + cards

    // 设置初始位置
    track.style.transform = 'translateX(calc(-33.33%))'

    // 监听动画结束
    track.addEventListener('animationend', () => {
      // 取消动画
      track.style.animation = 'none'
      // 重置位置
      track.style.transform = 'translateX(calc(-33.33%))'
      // 重新触发动画
      setTimeout(() => {
        track.style.animation = ''
      }, 0)
    })
  })

  // 波浪动画增强
  gsap.to('.waves', {
    scaleY: 1.2,
    duration: 2.5,
    ease: 'power1.inOut',
    yoyo: true,
    repeat: -1
  })

  // 随机生成波浪扭曲效果
  setInterval(() => {
    const waves = document.querySelectorAll('.wave-parallax use')
    waves.forEach((wave) => {
      gsap.to(wave, {
        attr: { y: Math.random() * 5 },
        duration: 2,
        ease: 'power1.inOut'
      })
    })
  }, 3000)
})
