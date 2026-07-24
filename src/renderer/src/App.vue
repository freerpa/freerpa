<template>
  <router-view></router-view>
</template>

<script setup>
import { provide } from 'vue'

const keyDownFn = new Map()
const keyUpFn = new Map()

const keyDownEventListener = (fn, id) => {
  keyDownFn.set(id, fn)
  return () => {
    keyDownFn.delete(id)
  }
}

const keyUpEventListener = (fn, id) => {
  keyUpFn.set(id, fn)
  return () => {
    keyUpFn.delete(id)
  }
}

provide('keyDownEventListener', keyDownEventListener)
provide('keyUpEventListener', keyUpEventListener)

window.addEventListener('keydown', (e) => {
  // e.preventDefault()
  keyDownFn.forEach((fn) => fn(e))
})
window.addEventListener('keyup', (e) => {
  keyUpFn.forEach((fn) => fn(e))
})
</script>

<style lang="less">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  overflow: hidden;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
