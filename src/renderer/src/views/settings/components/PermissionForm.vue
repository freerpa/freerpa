<template>
  <div class="permission-editor">
    <!-- 文件系统（IO 目录） -->
    <a-form-item label="文件目录" extra="工作流可读写的目录（相对路径将重定向到首个目录）">
      <div class="tag-list">
        <a-tag v-for="(r, i) in value.io.roots" :key="i" closable color="arcoblue" @close="removeRoot(i)">
          {{ r }}
        </a-tag>
        <a-button size="mini" @click="addRoot">
          <template #icon><icon-plus /></template>
          添加目录
        </a-button>
      </div>
    </a-form-item>

    <!-- 网络规则 -->
    <a-form-item label="访问模式">
      <a-radio-group v-model="value.network.mode" type="button">
        <a-radio value="allow-all">允许全部</a-radio>
        <a-radio value="allow-list">仅白名单</a-radio>
        <a-radio value="disabled">禁止网络</a-radio>
      </a-radio-group>
    </a-form-item>
    <a-form-item v-if="value.network.mode === 'allow-list'" label="网络规则" extra="允许访问的域名或 IP，支持 *.domain 通配">
      <div class="tag-list">
        <a-tag v-for="(r, i) in value.network.rules" :key="i" closable @close="value.network.rules.splice(i, 1)">
          {{ r }}
        </a-tag>
        <a-input
          v-model="ruleInput"
          placeholder="域名或 IP，如 *.example.com / 1.2.3.4:8080"
          size="mini"
          style="width: 260px"
          @press-enter="addRule"
        />
        <a-button size="mini" @click="addRule">添加</a-button>
      </div>
    </a-form-item>

    <!-- 子进程 -->
    <a-form-item label="执行子进程" :extra="value.process.enabled ? '允许执行（白名单命令为空则允许任意命令）' : '默认禁止执行子进程'">
      <a-switch v-model="value.process.enabled" />
    </a-form-item>
    <a-form-item v-if="value.process.enabled" label="命令白名单">
      <div class="tag-list">
        <a-tag v-for="(c, i) in value.process.commands" :key="i" closable @close="value.process.commands.splice(i, 1)">
          {{ c }}
        </a-tag>
        <a-input
          v-model="commandInput"
          placeholder="命令白名单，如 git / node，空则允许任意"
          size="mini"
          style="width: 260px"
          @press-enter="addCommand"
        />
        <a-button size="mini" @click="addCommand">添加</a-button>
      </div>
    </a-form-item>

    <!-- 环境变量 -->
    <a-form-item label="环境变量" extra="留空 = 允许读取全部（node 生态兼容）；配置后仅白名单变量可读">
      <div class="tag-list">
        <a-tag v-for="(e, i) in value.env.allow" :key="i" closable @close="value.env.allow.splice(i, 1)">
          {{ e }}
        </a-tag>
        <a-input
          v-model="envInput"
          placeholder="变量名，如 MY_TOKEN"
          size="mini"
          style="width: 200px"
          @press-enter="addEnv"
        />
        <a-button size="mini" @click="addEnv">添加</a-button>
      </div>
    </a-form-item>

    <!-- 系统信息 -->
    <a-form-item label="系统信息" extra="留空 = 禁止读取系统信息">
      <a-checkbox-group v-model="value.sys.allow" :options="SYS_OPTIONS" />
    </a-form-item>

    <!-- 原生库（FFI） -->
    <a-form-item label="原生库 FFI" :extra="value.ffi.enabled ? '允许加载动态库（路径白名单为空则允许全部）' : '默认禁止加载动态库（Deno.dlopen / NAPI 原生模块）'">
      <a-switch v-model="value.ffi.enabled" />
    </a-form-item>
    <a-form-item v-if="value.ffi.enabled" label="动态库白名单">
      <div class="tag-list">
        <a-tag v-for="(p, i) in value.ffi.paths" :key="i" closable @close="value.ffi.paths.splice(i, 1)">
          {{ p }}
        </a-tag>
        <a-input
          v-model="ffiInput"
          placeholder="动态库路径，如 /usr/lib/libfoo.so"
          size="mini"
          style="width: 260px"
          @press-enter="addFfi"
        />
        <a-button size="mini" @click="addFfi">添加</a-button>
      </div>
    </a-form-item>

    <!-- 远程模块导入 -->
    <a-form-item label="远程模块导入" :extra="value.import.enabled ? '允许 import() 远程模块（host 白名单为空则允许全部）' : '默认仅允许 deno.land / jsr.io 等内置源静态导入'">
      <a-switch v-model="value.import.enabled" />
    </a-form-item>
    <a-form-item v-if="value.import.enabled" label="导入源白名单">
      <div class="tag-list">
        <a-tag v-for="(h, i) in value.import.hosts" :key="i" closable @close="value.import.hosts.splice(i, 1)">
          {{ h }}
        </a-tag>
        <a-input
          v-model="importInput"
          placeholder="域名或 URL 前缀，如 example.com / https://jsr.io"
          size="mini"
          style="width: 260px"
          @press-enter="addImport"
        />
        <a-button size="mini" @click="addImport">添加</a-button>
      </div>
    </a-form-item>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { IconPlus } from '@arco-design/web-vue/es/icon'

const props = defineProps({ modelValue: { type: Object, required: true } })

// computed 派生：父组件整体替换 modelValue（如重新加载）时模板与函数自动跟随最新对象
const value = computed(() => props.modelValue)

const SYS_OPTIONS = [
  { label: '主机名 hostname', value: 'hostname' },
  { label: '系统信息 osRelease', value: 'osRelease' },
  { label: '内存 systemMemoryInfo', value: 'systemMemoryInfo' },
  { label: '用户 userInfo', value: 'userInfo' },
  { label: '负载 loadavg', value: 'loadavg' },
  { label: '网络接口 networkInterfaces', value: 'networkInterfaces' }
]

const ruleInput = ref('')
const commandInput = ref('')
const envInput = ref('')
const ffiInput = ref('')
const importInput = ref('')

const addRoot = async () => {
  const result = await window.electronAPI.dialog.openPath({ title: '选择可访问目录', properties: ['openDirectory'] })
  if (result.canceled || !result.filePaths?.length) return
  if (!value.value.io.roots.includes(result.filePaths[0])) value.value.io.roots.push(result.filePaths[0])
}
const removeRoot = (i) => value.value.io.roots.splice(i, 1)
// 标签白名单输入统一逻辑：trim → 查重 → push → 清空输入
const addTag = (list, input) => {
  const v = input.value.trim()
  if (v && !list.includes(v)) list.push(v)
  input.value = ''
}
const addRule = () => addTag(value.value.network.rules, ruleInput)
const addCommand = () => addTag(value.value.process.commands, commandInput)
const addEnv = () => addTag(value.value.env.allow, envInput)
const addFfi = () => addTag(value.value.ffi.paths, ffiInput)
const addImport = () => addTag(value.value.import.hosts, importInput)
</script>

<style lang="less" scoped>
.permission-editor {
  .tag-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
}
</style>
