import { defineAsyncComponent } from 'vue'

export default [
  {
    name: 'text',
    component: defineAsyncComponent(() => import('./Text.vue')),
    dataType: 'string'
  },
  {
    name: 'number',
    component: defineAsyncComponent(() => import('./Number.vue')),
    dataType: 'number'
  },
  {
    name: 'select',
    component: defineAsyncComponent(() => import('./Select.vue')),
    dataType: 'string'
  },
  {
    name: 'switch',
    component: defineAsyncComponent(() => import('./Switch.vue')),
    dataType: 'boolean'
  },
  {
    name: 'radio',
    component: defineAsyncComponent(() => import('./Radio.vue')),
    dataType: 'string'
  },
  {
    name: 'checkbox',
    component: defineAsyncComponent(() => import('./Checkbox.vue')),
    dataType: 'array'
  },
  {
    name: 'date',
    component: defineAsyncComponent(() => import('./Date.vue')),
    dataType: 'string'
  },
  {
    name: 'time',
    component: defineAsyncComponent(() => import('./Time.vue')),
    dataType: 'string'
  },
  {
    name: 'datetime',
    component: defineAsyncComponent(() => import('./DateTime.vue')),
    dataType: 'string'
  },
  {
    name: 'slider',
    component: defineAsyncComponent(() => import('./Slider.vue')),
    dataType: 'number'
  },
  {
    name: 'color',
    component: defineAsyncComponent(() => import('./Color.vue')),
    dataType: 'string'
  },
  {
    name: 'code',
    component: defineAsyncComponent(() => import('./CodeEditor.vue')),
    dataType: 'string'
  },
  {
    name: 'selector',
    component: defineAsyncComponent(() => import('./ElementSelector.vue')),
    dataType: 'string'
  },
  {
    name: 'array',
    component: defineAsyncComponent(() => import('./Array.vue')),
    dataType: 'array'
  },
  {
    name: 'object',
    component: defineAsyncComponent(() => import('./Object.vue')),
    dataType: 'object'
  },
  {
    name: 'path',
    component: defineAsyncComponent(() => import('./Path.vue')),
    dataType: 'string'
  },
  {
    name: 'alert',
    component: defineAsyncComponent(() => import('./Alert.vue')),
    dataType: 'string'
  }, 
  {
    name: 'position',
    component: defineAsyncComponent(() => import('./Position.vue')),
    dataType: 'object'
  },
  {
    name: 'model',
    component: defineAsyncComponent(() => import('./Model.vue')),
    dataType: 'string'
  },
  {
    name: 'env',
    component: defineAsyncComponent(() => import('./Env.vue')),
    dataType: 'string'
  },
]
