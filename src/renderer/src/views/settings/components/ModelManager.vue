<template>
  <div class="model-manager">
    <a-card title="模型管理" :bordered="false">
      <template #extra>
        <a-button type="primary" @click="openCreate">
          <template #icon><icon-plus /></template>
          添加供应商
        </a-button>
      </template>
      <div v-if="providers.length" class="provider-grid">
        <div v-for="provider in providers" :key="provider.id" class="provider-card">
          <div class="provider-card__head">
            <span class="provider-card__name" :title="provider.name">{{ provider.name }}</span>
            <a-tag color="arcoblue">{{ protocolLabel[provider.protocol] || provider.protocol }}</a-tag>
          </div>
          <div class="provider-card__row">
            <span class="provider-card__label">API地址</span>
            <span class="mono provider-card__value" :title="provider.baseURL">{{ provider.baseURL || '—' }}</span>
          </div>
          <div class="provider-card__row">
            <span class="provider-card__label">APIKEY</span>
            <span v-if="provider.hasKey" class="mono provider-card__value">{{ provider.apiKey }}</span>
            <a-tag v-else color="red">未配置</a-tag>
          </div>
          <div class="provider-card__row">
            <span class="provider-card__label">模型</span>
            <div class="provider-card__models">
              <template v-if="provider.models.length">
                <a-tag v-for="m in visibleModels(provider)" :key="m.id" class="model-chip" :title="m.id">
                  {{ m.name || m.id }}
                </a-tag>
                <a-tag v-if="provider.models.length > VISIBLE_MODELS" color="gray">
                  +{{ provider.models.length - VISIBLE_MODELS }}
                </a-tag>
              </template>
              <span v-else class="provider-card__empty">无模型</span>
            </div>
          </div>
          <div class="provider-card__actions">
            <a-button type="text" size="mini" @click="openEdit(provider)">编辑</a-button>
            <a-popconfirm content="删除后该供应商及其模型将不可用，确认删除？" @ok="handleDelete(provider)">
              <a-button type="text" size="mini" status="danger">删除</a-button>
            </a-popconfirm>
          </div>
        </div>
      </div>
      <a-empty v-else description="暂无供应商。点击右上角「添加供应商」配置模型后，工作流 AI 助手即可使用。">
        <template #image><icon-robot /></template>
      </a-empty>
    </a-card>

    <a-modal
      v-model:visible="modalVisible"
      :title="editingId ? '编辑供应商' : '添加供应商'"
      :ok-loading="saving"
      width="640px"
      @ok="handleSave"
      @cancel="modalVisible = false"
    >
      <a-form layout="vertical" :style="{ marginTop: '8px' }">
        <a-form-item v-if="!editingId" label="预设供应商模板（可选，自动填充名称、协议与API地址）">
          <a-select
            v-model="presetName"
            :options="presetOptions"
            placeholder="选择预设模板"
            allow-clear
            @change="applyPreset"
          />
        </a-form-item>
        <a-form-item label="名称" required>
          <a-input v-model="form.name" placeholder="如 DeepSeek / 自定义供应商" />
        </a-form-item>
        <a-form-item label="协议" required>
          <a-select v-model="form.protocol" :options="protocolOptions" />
        </a-form-item>
        <a-form-item label="API地址">
          <a-input v-model="form.baseURL" :placeholder="protocolPlaceholder" />
          <template #extra>
            OpenAI 兼容协议需填写完整地址（含 /v1 前缀）；Anthropic / Google 可留空使用官方地址
          </template>
        </a-form-item>
        <a-form-item label="APIKEY">
          <a-input-password
            v-model="form.apiKey"
            :placeholder="editingId && providerHasKey ? '留空表示不修改' : 'sk-...'"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="模型列表（可多次添加）">
          <div class="model-rows">
            <div v-for="(model, index) in form.models" :key="index" class="model-row">
              <a-input v-model="model.id" placeholder="模型ID，如 deepseek-chat" />
              <a-button
                class="model-row__remove"
                type="secondary"
                status="danger"
                @click="form.models.splice(index, 1)"
              >
                删除
              </a-button>
            </div>
            <a-button type="dashed" block @click="form.models.push({ id: '', name: '' })">添加模型</a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
  import { ref, reactive, computed, onMounted } from 'vue';
  import { Message } from '@arco-design/web-vue';
  import { getProviders, getPresetProviders, createProvider, updateProvider, deleteProvider } from '@/api/aiModels';

  const protocolOptions = [
    { label: 'OpenAI 兼容', value: 'openai-compatible' },
    { label: 'Anthropic', value: 'anthropic' },
    { label: 'Google Gemini', value: 'google' },
  ];
  const protocolLabel = {
    'openai-compatible': 'OpenAI 兼容',
    anthropic: 'Anthropic',
    google: 'Google Gemini',
  };
  const protocolPlaceholder = computed(() => {
    if (form.protocol === 'openai-compatible') return 'https://api.openai.com/v1';
    if (form.protocol === 'anthropic') return '留空使用 https://api.anthropic.com';
    return '留空使用官方地址';
  });

  const providers = ref([]);
  const presetProviders = ref([]);
  const presetOptions = computed(() => presetProviders.value.map((p) => ({ label: p.name, value: p.name })));

  // 卡片上最多直接展示的模型个数，超出折叠为 +N
  const VISIBLE_MODELS = 5;
  const visibleModels = (provider) => (provider.models || []).slice(0, VISIBLE_MODELS);

  const load = async () => {
    try {
      providers.value = (await getProviders()) || [];
    } catch (error) {
      console.error('加载供应商列表失败:', error);
    }
  };

  onMounted(async () => {
    try {
      presetProviders.value = (await getPresetProviders()) || [];
    } catch (error) {
      console.error('加载预设供应商失败:', error);
    }
    load();
  });

  // ---- 表单 ----
  const modalVisible = ref(false);
  const saving = ref(false);
  const editingId = ref('');
  const providerHasKey = ref(false);
  const presetName = ref('');
  const form = reactive({ name: '', protocol: 'openai-compatible', baseURL: '', apiKey: '', models: [] });

  const resetForm = () => {
    presetName.value = '';
    providerHasKey.value = false;
    Object.assign(form, { name: '', protocol: 'openai-compatible', baseURL: '', apiKey: '', models: [] });
  };

  const openCreate = () => {
    editingId.value = '';
    resetForm();
    modalVisible.value = true;
  };

  const openEdit = (provider) => {
    editingId.value = provider.id;
    providerHasKey.value = !!provider.hasKey;
    Object.assign(form, {
      name: provider.name,
      protocol: provider.protocol,
      baseURL: provider.baseURL,
      apiKey: '',
      models: (provider.models || []).map((m) => ({ ...m })),
    });
    modalVisible.value = true;
  };

  const applyPreset = (name) => {
    const preset = presetProviders.value.find((p) => p.name === name);
    if (!preset) return;
    // 预设选项即供应商名称；只填充 名称/协议/API地址，模型列表由用户自行添加
    form.name = preset.name;
    form.protocol = preset.protocol;
    form.baseURL = preset.baseURL || '';
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Message.error('请输入供应商名称');
      return;
    }
    if (!form.protocol) {
      Message.error('请选择协议');
      return;
    }
    const payload = {
      name: form.name.trim(),
      protocol: form.protocol,
      baseURL: form.baseURL.trim(),
      apiKey: form.apiKey,
      // map 重造纯对象：form.models 元素是 Vue reactive Proxy，Electron IPC 的
      // structuredClone 无法克隆 Proxy，直接传会报 "An object could not be cloned"
      models: form.models
        .filter((m) => m.id && m.id.trim())
        .map((m) => ({ id: m.id.trim(), name: (m.name || '').trim() })),
    };
    saving.value = true;
    try {
      if (editingId.value) {
        await updateProvider(editingId.value, payload);
      } else {
        await createProvider(payload);
      }
      Message.success('保存成功');
      modalVisible.value = false;
      load();
    } catch (error) {
      Message.error(error.message || '保存失败');
    } finally {
      saving.value = false;
    }
  };

  const handleDelete = async (provider) => {
    try {
      await deleteProvider(provider.id);
      Message.success('已删除');
      load();
    } catch (error) {
      Message.error(error.message || '删除失败');
    }
  };
</script>

<style lang="less" scoped>
  .mono {
    font-family: monospace;
    font-size: 12px;
  }
  // 供应商卡片网格（替代表格：完整展示 API 地址与模型列表）
  .provider-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }
  .provider-card {
    border: 1px solid var(--color-border-2);
    border-radius: 8px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--color-bg-2);
    transition: box-shadow 0.2s ease;
    &:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    }
    &__head {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    &__name {
      flex: 1;
      min-width: 0;
      font-size: 15px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    &__row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 13px;
      line-height: 1.5;
    }
    &__label {
      flex-shrink: 0;
      width: 52px;
      color: var(--color-text-3);
    }
    &__value {
      flex: 1;
      min-width: 0;
      word-break: break-all;
      color: var(--color-text-1);
    }
    &__models {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      .model-chip {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
    &__empty {
      color: var(--color-text-4);
    }
    &__actions {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
      border-top: 1px dashed var(--color-border-2);
      padding-top: 10px;
      margin-top: auto;
    }
  }
  .model-rows {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    .model-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      // 每条模型一行横排：ID 与显示名各占一半撑满，删除按钮固定行尾。
      // 必须作用于 .arco-input-wrapper（a-input 根元素，默认占满整行），
      // 否则两个输入框竖向堆叠
      :deep(.arco-input-wrapper) {
        flex: 1;
        min-width: 0;
        width: auto;
      }
      .model-row__remove {
        flex-shrink: 0;
        margin-left: 4px;
      }
    }
  }
</style>
