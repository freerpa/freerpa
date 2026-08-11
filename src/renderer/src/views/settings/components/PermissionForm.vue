<template>
  <a-form auto-label-width class="permission-editor">
    <!-- 文件系统（IO 目录） -->
    <a-form-item label="允许文件目录" extra="工作流可读写的目录">
      <div class="tag-list">
        <a-tag size="large" v-for="(r, i) in value.io.roots" :key="i" closable color="arcoblue" @close="removeRoot(i)">
          {{ r }}
        </a-tag>
        <a-button @click="addRoot">
          <template #icon><icon-plus /></template>
          添加目录
        </a-button>
      </div>
    </a-form-item>

    <!-- 网络规则 -->
    <a-form-item label="网络访问模式">
      <a-radio-group v-model="value.network.mode" type="button">
        <a-radio value="allow-all">允许全部</a-radio>
        <a-radio value="allow-list">仅白名单</a-radio>
        <a-radio value="disabled">禁止网络</a-radio>
      </a-radio-group>
    </a-form-item>
    <a-form-item
      v-if="value.network.mode === 'allow-list'"
      label="网络访问规则"
      extra="允许访问的域名或 IP（支持 *.domain 通配、host:port）"
    >
      <PermissionMultiSelect v-model="value.network.rules" placeholder="如 *.example.com / 1.2.3.4:8080" />
    </a-form-item>

    <!-- 环境变量 -->
    <a-form-item label="允许环境变量">
      <PermissionMultiSelect v-model="value.env.allow" :options="INFRA_ENV" placeholder="选择或输入变量名" />
    </a-form-item>

    <!-- 系统信息 -->
    <a-form-item label="允许系统信息">
      <PermissionMultiSelect v-model="value.sys.allow" :options="SYS_OPTIONS" placeholder="选择要开放的系统信息" />
    </a-form-item>

    <!-- 远程模块导入 -->
    <a-form-item
      label="远程模块导入"
      :extra="
        value.import.enabled
          ? '允许 import() 远程模块（host 白名单为空则允许全部）'
          : '默认开启，可关闭（白名单用于限定可导入的源）'
      "
    >
      <a-switch v-model="value.import.enabled" />
    </a-form-item>
    <a-form-item v-if="value.import.enabled" label="导入源白名单">
      <PermissionMultiSelect v-model="value.import.hosts" placeholder="如 cdn.jsdelivr.net" />
    </a-form-item>

    <!-- 子进程 -->
    <a-form-item
      label="执行子进程"
      :extra="
        value.process.enabled
          ? '允许执行（白名单命令为空则允许任意命令）'
          : '默认禁止执行子进程，开启有可能会带来安全风险（如执行系统命令）；建议仅在必要时开启。'
      "
    >
      <a-switch v-model="value.process.enabled" />
    </a-form-item>
    <a-form-item v-if="value.process.enabled" label="命令白名单">
      <PermissionMultiSelect v-model="value.process.commands" placeholder="如 git / node" />
    </a-form-item>

    <!-- 原生库（FFI） -->
    <a-form-item
      label="原生库 FFI"
      :extra="
        value.ffi.enabled
          ? '允许加载动态库（路径白名单为空则允许全部）'
          : '默认禁止加载动态库，开启有可能会带来安全风险（如加载系统库）；建议仅在必要时开启。'
      "
    >
      <a-switch v-model="value.ffi.enabled" />
    </a-form-item>
    <a-form-item v-if="value.ffi.enabled" label="动态库白名单">
      <PermissionMultiSelect v-model="value.ffi.paths" placeholder="如 /usr/lib/libfoo.so" />
    </a-form-item>
  </a-form>
</template>

<script setup>
  import { computed } from 'vue';
  import { IconPlus } from '@arco-design/web-vue/es/icon';
  import PermissionMultiSelect from './PermissionMultiSelect.vue';
  import { INFRA_ENV } from '@/utils/permissions';

  const props = defineProps({ modelValue: { type: Object, required: true } });

  // computed 派生：父组件整体替换 modelValue（如重新加载）时模板与函数自动跟随最新对象
  const value = computed(() => props.modelValue);

  // 系统信息预设（umask 为基础设施，由主进程强制附加，不在此列出）
  const SYS_OPTIONS = [
    { label: '主机名 hostname', value: 'hostname' },
    { label: '系统版本 osRelease', value: 'osRelease' },
    { label: '运行时长 osUptime', value: 'osUptime' },
    { label: '内存 systemMemoryInfo', value: 'systemMemoryInfo' },
    { label: 'CPU 信息 cpus', value: 'cpus' },
    { label: '当前用户 username', value: 'username' },
    { label: '用户 ID uid', value: 'uid' },
    { label: '组 ID gid', value: 'gid' },
    { label: '主目录 homedir', value: 'homedir' },
    { label: '负载 loadavg', value: 'loadavg' },
    { label: '网络接口 networkInterfaces', value: 'networkInterfaces' },
  ];

  const addRoot = async () => {
    const result = await window.electronAPI.dialog.openPath({ title: '选择可访问目录', properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths?.length) return;
    if (!value.value.io.roots.includes(result.filePaths[0])) value.value.io.roots.push(result.filePaths[0]);
  };
  const removeRoot = (i) => value.value.io.roots.splice(i, 1);
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
