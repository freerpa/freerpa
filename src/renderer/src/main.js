import { createApp } from 'vue'
import ArcoVue from '@arco-design/web-vue'
import '@arco-design/web-vue/dist/arco.css'
import '@arco-themes/vue-xavier/css/arco.css'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
const app = createApp(App)
const pinia = createPinia()

app.use(ArcoVue)
app.use(pinia)
app.use(router)
app.mount('#app')
