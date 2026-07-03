import Text from './Text.vue'
import Number from './Number.vue'
import Select from './Select.vue'
import Switch from './Switch.vue'
import Radio from './Radio.vue'
import Checkbox from './Checkbox.vue'
import Date from './Date.vue'
import Time from './Time.vue'
import DateTime from './DateTime.vue'
import Slider from './Slider.vue'
import Color from './Color.vue'
import Code from './CodeEditor.vue'
import Selector from './ElementSelector.vue'
import Array from './Array.vue'
import Object from './Object.vue'
import Path from './Path.vue'
import Alert from './Alert.vue'
import Position from './Position.vue'
import Model from './Model.vue'
import Browser from './Browser.vue'

export default [
  { name: 'text',      component: Text,      dataType: 'string' },
  { name: 'number',    component: Number,    dataType: 'number' },
  { name: 'select',    component: Select,    dataType: 'string' },
  { name: 'switch',    component: Switch,    dataType: 'boolean' },
  { name: 'radio',     component: Radio,     dataType: 'string' },
  { name: 'checkbox',  component: Checkbox,  dataType: 'array' },
  { name: 'date',      component: Date,      dataType: 'string' },
  { name: 'time',      component: Time,      dataType: 'string' },
  { name: 'datetime',  component: DateTime,  dataType: 'string' },
  { name: 'slider',    component: Slider,    dataType: 'number' },
  { name: 'color',     component: Color,     dataType: 'string' },
  { name: 'code',      component: Code,      dataType: 'string' },
  { name: 'selector',  component: Selector,  dataType: 'string' },
  { name: 'array',     component: Array,     dataType: 'array' },
  { name: 'object',    component: Object,    dataType: 'object' },
  { name: 'path',      component: Path,      dataType: 'string' },
  { name: 'alert',     component: Alert,     dataType: 'string' },
  { name: 'position',  component: Position,  dataType: 'object' },
  { name: 'model',     component: Model,     dataType: 'string' },
  { name: 'browser',  component: Browser,  dataType: 'string' },
]
