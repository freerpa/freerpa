<template>
  <div v-if="visible">
    <a-modal
      v-model:visible="visible"
      title="发布插件"
      @before-ok="handleSubmit"
      @cancel="handleCancel"
      :mask-closable="false"
      :esc-to-close="false"
      :ok-loading="isSubmiting"
      unmount-on-close
      @open="handleOpen"
      width="1200px"
      :body-style="{ maxHeight: '80vh', overflow: 'auto', paddingBottom: '0px' }"
    >
      <a-form ref="formRef" :model="form" auto-label-width>
        <a-row :gutter="16">
          <a-col :span="6">
            <!-- 封面图 -->
            <a-form-item
              label="插件封面"
              field="cover"
              :rules="[{ required: true, message: '请上传封面图' }]"
            >
              <image-upload
                ref="imageUploadRef"
                v-model="form.cover"
                upload-text="上传封面图"
                class="cover-upload"
              />
            </a-form-item>
          </a-col>
          <a-col :span="18">
            <a-row :gutter="16">
              <a-col :span="16">
                <!-- 工作流选择 -->
                <a-form-item
                  label="工作流"
                  field="workflow"
                  :rules="[{ required: true, message: '请选择工作流' }]"
                >
                  <div class="workflow-wrapper">
                    <div class="tag-wrapper">
                      <a-tag
                        v-if="form.workflow"
                        closable
                        @close="handleRemoveWorkflow"
                        size="large"
                      >
                        {{ form.workflow.name }}
                      </a-tag>
                      <a-button v-else type="outline" @click="showWorkflowSelect = true">
                        <template #icon><icon-plus /></template>
                        选择工作流
                      </a-button>
                    </div>
                    <div v-if="form.dependencies.length > 0">
                      <a-button type="text" @click="showDependencies = true">
                        <icon-info-circle />
                        {{ form.dependencies.length }} 个依赖
                      </a-button>
                    </div>
                  </div>
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <!-- 分类 -->
                <a-form-item
                  label="分类"
                  field="category_id"
                  :rules="[{ required: true, message: '请选择分类' }]"
                >
                  <a-select
                    v-model="form.category_id"
                    placeholder="请选择分类"
                    :loading="categoryLoading"
                    :filter-option="false"
                  >
                    <a-option v-for="item in categories" :key="item.id" :value="item.id">
                      {{ item.name }}
                    </a-option>
                  </a-select>
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="16">
                <!-- 标签 -->
                <a-form-item label="标签" field="tags">
                  <a-input-tag v-model="form.tags" placeholder="输入标签后按回车添加" allow-clear />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <!-- 积分 -->
                <a-form-item
                  label="积分"
                  field="price"
                  :rules="[{ required: true, message: '请输入积分' }]"
                >
                  <a-input-number
                    v-model="form.price"
                    placeholder="请输入积分"
                    :min="0"
                    :precision="0"
                    :step="1"
                  >
                    <template v-if="form.dependencies_price > 0" #prefix>
                      <a-tooltip
                        content="所有依赖的总积分，用户兑换时会根据未兑换过的依赖进行动态计算"
                      >
                        <span>
                          {{ form.dependencies_price }}
                        </span>
                      </a-tooltip>
                      &nbsp; +
                    </template>
                  </a-input-number>
                </a-form-item>
              </a-col>
            </a-row>

            <a-row :gutter="16">
              <a-col :span="24">
                <!-- 描述 -->
                <a-form-item
                  label="简介"
                  field="description"
                  :rules="[{ required: true, message: '请输入简介' }]"
                >
                  <a-textarea
                    v-model="form.description"
                    placeholder="请输入简介"
                    :max-length="200"
                    show-word-limit
                    allow-clear
                  />
                </a-form-item>
              </a-col>
            </a-row>
          </a-col>
        </a-row>

        <!-- 使用限制 -->
        <a-form-item label="插件类型" required>
          <a-space>
            <a-radio-group v-model="form.only_node" type="button">
              <a-radio :value="false"> 工作流 </a-radio>
              <a-radio :value="true"> 节点 </a-radio>
            </a-radio-group>
            <a-alert style="height: 32px">
              {{
                form.only_node
                  ? '仅以节点的形式使用，且用户无法看到工作流内的节点，请确保工作流可以正常运行，且配置了合理的配置项、输入、输出'
                  : '用户可以直接导入、作为工作流或节点使用'
              }}
            </a-alert>
          </a-space>
        </a-form-item>
        <!-- 详情 -->
        <a-form-item label="插件详情" field="content">
          <am-wang-editor
            ref="editorRef"
            class="editor-wrapper"
            v-model="form.content"
            placeholder="请务必详细描述工作流的功能、使用方法、注意事项等，审核人员会据此进行审核。"
          />
        </a-form-item>

        <!-- 数据表选择 -->
        <a-form-item label="数据表" field="models">
          <div class="tag-wrapper">
            <div class="selected-tags" v-if="form.models.length > 0">
              <a-tag
                v-for="model in form.models"
                :key="model.id"
                closable
                @close="handleRemoveModel(model)"
                size="large"
              >
                {{ model.name }}
              </a-tag>
            </div>
            <a-button
              v-if="form.models.length < maxModelCount"
              type="outline"
              @click="showModelSelect = true"
            >
              <template #icon><icon-plus /></template>
              选择数据表
            </a-button>
          </div>
        </a-form-item>

        <!-- 开发者协议 -->
        <a-form-item
          label=""
          field="developer_agreement"
          :rules="[
            {
              message: '请同意开发者协议',
              validator: (value, callback) => !value && callback(true)
            }
          ]"
        >
          <a-checkbox v-model="form.developer_agreement"> 我已阅读并同意 </a-checkbox>
          <a-link @click.stop="showDeveloperAgreement = true">开发者协议</a-link>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 工作流选择弹窗 -->
    <a-modal
      v-model:visible="showWorkflowSelect"
      title="选择工作流"
      @ok="handleWorkflowSelectOk"
      :width="1000"
      :body-style="{ padding: '16px' }"
    >
      <a-input-search
        :style="{ marginBottom: '12px' }"
        placeholder="请输入工作流名称"
        v-model="workflowKeyword"
        allow-clear
        @press-enter="fetchWorkflows"
        @search="fetchWorkflows"
      >
        <template #prepend>
          <CategorySelect @change="handleWorkflowCategoryChange" />
        </template>
      </a-input-search>
      <a-table
        :data="workflows"
        :pagination="{
          pageSize: 10,
          current: workFlowPage,
          showTotal: true,
          total: workFlowTotal
        }"
        :loading="loading"
        @page-change="handleWorkflowPageChange"
        row-key="id"
        v-model:selectedKeys="selectedWorkflowKeys"
        :row-selection="{ type: 'radio' }"
      >
        <template #columns>
          <a-table-column title="名称" data-index="name" :width="300" />
          <a-table-column title="描述" data-index="description" />
        </template>
      </a-table>
    </a-modal>

    <!-- 数据表选择弹窗 -->
    <a-modal
      v-model:visible="showModelSelect"
      title="选择数据表"
      @ok="handleModelSelectOk"
      :width="1000"
      :body-style="{ padding: '16px' }"
    >
      <a-input-search
        :style="{ marginBottom: '12px' }"
        placeholder="请输入数据表名称"
        v-model="modelKeyword"
        allow-clear
        @press-enter="fetchModels"
        @search="fetchModels"
      />
      <a-table
        :data="models"
        :pagination="{ pageSize: 10, showTotal: true }"
        row-key="id"
        v-model:selectedKeys="selectedModelKeys"
        :row-selection="{ type: 'checkbox' }"
      >
        <template #columns>
          <a-table-column title="名称" data-index="name" :width="300" />
          <a-table-column title="描述" data-index="description" />
        </template>
      </a-table>
    </a-modal>

    <!-- 依赖列表 -->
    <a-modal v-model:visible="showDependencies" title="依赖列表" width="1000px" :footer="false">
      <a-alert style="margin-bottom: 16px" type="warning">
        说明：为了保障开发者的权益，用户在兑换您的插件时，需要同时兑换您依赖的插件，如用户已经兑换过您依赖的插件，不会重复兑换
      </a-alert>
      <a-table :data="form.dependencies" :pagination="false">
        <template #columns>
          <a-table-column title="名称" data-index="name" />
          <a-table-column title="描述" data-index="description" />
          <a-table-column title="积分" data-index="price" />
          <a-table-column title="查看" data-index="action" :width="60" align="center">
            <template #cell="{ record }">
              <a-button type="text" @click="handleViewDependency(record)">查看</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-modal>

    <workflow-detail v-model:visible="showWorkflowDetail" :workflowId="detailWorkflowId" />

    <a-modal
      v-model:visible="showDeveloperAgreement"
      title="开发者协议"
      width="700px"
      ok-text="同意"
      cancel-text="不同意"
      @ok="form.developer_agreement = true"
      @cancel="form.developer_agreement = false"
      :body-style="{ height: '600px', overflow: 'auto' }"
    >
      <div v-html="developerAgreement"></div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, watch, toRaw } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { IconPlus, IconInfoCircle } from '@arco-design/web-vue/es/icon'
import { getDeveloperAgreement } from '@/api/login'
import { publishWorkflow, getStoreWorkflowCategories } from '@/api/workflowStore'
import { debounce } from 'lodash-es'
import ImageUpload from '@/components/ImageUpload.vue'
import AmWangEditor from './am-wangEditor/index.vue'
import WorkflowDetail from './WorkflowDetail.vue'
import CategorySelect from '@/components/CategorySelect.vue'

const { workflow: workflowAPI } = window.electronAPI
import { useStore } from '@/store'

const {
  userInfo: { phone }
} = useStore()

const showDeveloperAgreement = ref(false)
const developerAgreement = ref('')
getDeveloperAgreement().then((data) => {
  developerAgreement.value = data
})

const visible = defineModel('visible')
const emit = defineEmits(['update:visible', 'success'])
const props = defineProps({
  workflow: {
    type: [Object, null],
    required: true
  }
})

const editorRef = ref(null)
const imageUploadRef = ref(null)
// 表单数据
const formRef = ref(null)
const form = ref({
  cover: '',
  category: '',
  tags: [],
  workflow: '',
  description: '',
  dependencies: [],
  dependencies_price: 0,
  price: 0,
  models: [],
  content: '',
  only_node: false,
  developer_agreement: false
})

// 工作流依赖
const showDependencies = ref(false)

// 查看依赖工作流
const showWorkflowDetail = ref(false)
const detailWorkflowId = ref('')
const handleViewDependency = (row) => {
  detailWorkflowId.value = row.id
  showWorkflowDetail.value = true
}

// 工作流列表
const workflows = ref([])
// 数据表列表
const models = ref([])
// 分类列表
const categories = ref([])
const categoryLoading = ref(false)

// 选择弹窗状态
const showWorkflowSelect = ref(false)
const showModelSelect = ref(false)
const selectedWorkflowKeys = ref([])
const selectedModelKeys = ref([])
const maxModelCount = ref(20)
const workflowKeyword = ref('')
const modelKeyword = ref('')

watch(selectedModelKeys, () => {
  if (selectedModelKeys.value.length > maxModelCount.value) {
    Message.warning(`最多只能选择 ${maxModelCount.value} 个数据表`)
    selectedModelKeys.value.pop()
  }
})

const workFlowPage = ref(1)
const workFlowTotal = ref(0)
const workflowCategory = ref('')
const loading = ref(false)
const handleWorkflowCategoryChange = (value) => {
  workFlowPage.value = 1
  workflowCategory.value = value
  fetchWorkflows()
}
const handleWorkflowPageChange = (page) => {
  workFlowPage.value = page
  fetchWorkflows()
}
// 获取工作流列表
const fetchWorkflows = async () => {
  loading.value = true
  try {
    const result = await workflowAPI.getWorkflows({
      category_id: workflowCategory.value,
      keyword: workflowKeyword.value,
      page: workFlowPage.value,
      pageSize: 10
    })
    workFlowTotal.value = result.total
    workflows.value = result.data.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description
    }))
  } catch (error) {
    console.error('获取工作流列表失败:', error)
    Message.error('获取工作流列表失败')
  } finally {
    loading.value = false
  }
}

// 获取数据表列表
const fetchModels = async () => {
  try {
    // 从本地获取数据表列表
    const { data: dataAPI } = window.electronAPI
    const result = await dataAPI.getModels({
      page: 1,
      pageSize: 999,
      keyword: modelKeyword.value
    })
    models.value = result.data.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      fields: JSON.parse(item.fields)
    }))
  } catch (error) {
    console.error('获取数据表列表失败:', error)
    Message.error('获取数据表列表失败')
  }
}

// 获取分类列表
const fetchCategories = async () => {
  try {
    categoryLoading.value = true
    const result = await getStoreWorkflowCategories()
    let _categories = result.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      sort: item.sort,
      status: item.status
    }))
    if (phone !== '15615144111') {
      _categories = _categories.filter((item) => item.name !== '官方示例')
    }
    categories.value = _categories
  } catch (error) {
    console.error('获取分类列表失败:', error)
    Message.error('获取分类列表失败')
  } finally {
    categoryLoading.value = false
  }
}

// 处理移除工作流
const handleRemoveWorkflow = () => {
  form.value.workflow = ''
  selectedWorkflowKeys.value = []
  form.value.dependencies = []
  form.value.dependencies_price = 0
}

// 处理移除数据表
const handleRemoveModel = (model) => {
  form.value.models = form.value.models.filter((item) => item.id !== model.id)
  selectedModelKeys.value = selectedModelKeys.value.filter((key) => key !== model.id)
}

// 处理工作流选择确认
const handleWorkflowSelectOk = () => {
  const selectedWorkflow = workflows.value.find((w) => w.id === selectedWorkflowKeys.value[0])
  if (selectedWorkflow) {
    form.value.workflow = selectedWorkflow
    form.value.description = selectedWorkflow.description || ''
    form.value.dependencies = []
    form.value.dependencies_price = 0
  }
  showWorkflowSelect.value = false
}

// 处理数据表选择确认
const handleModelSelectOk = () => {
  form.value.models = selectedModelKeys.value.map((key) => {
    const model = models.value.find((m) => m.id === key)
    return model
  })
  showModelSelect.value = false
}

// 监听弹窗显示时初始化选中状态
watch(showWorkflowSelect, (val) => {
  if (val && form.value.workflow) {
    const workflow = form.value.workflow
    selectedWorkflowKeys.value = [workflow.id]
  }
})

watch(showModelSelect, (val) => {
  if (val) {
    selectedModelKeys.value = form.value.models.map((item) => item.id)
  }
})

const isSubmiting = ref(false)
// 提交表单
const handleSubmit = async (done) => {
  try {
    done(false)
    const validate = await formRef.value.validate()
    if (validate) {
      return
    }
    if (isSubmiting.value) {
      return
    }
    Modal.confirm({
      title: '提交插件',
      content: '提交后插件将进入审核流程，是否继续？',
      width: 400,
      bodyStyle: {
        textAlign: 'center'
      },
      okText: '提交',
      okButtonProps: {
        type: 'primary',
        style: {
          width: '160px'
        }
      },
      cancelButtonProps: {
        style: {
          width: '160px'
        }
      },
      onOk: async () => {
        isSubmiting.value = true
        await imageUploadRef.value.upload()
        const workflow = form.value.workflow
        const models = form.value.models.map((model) => toRaw(model))
        // 构建提交数据
        const submitData = {
          ...form.value,
          workflow: workflow,
          name: workflow?.name || '',
          models,
          dependencies: toRaw(form.value.dependencies)
        }
        await publishWorkflow(submitData)
        editorRef.value.deleteImage(true)
        Message.success('提交成功')
        isSubmiting.value = false
        visible.value = false
        emit('success')
        resetForm()
        return true
      }
    })
  } catch (error) {
    return false
  }
}

// 处理取消
const handleCancel = () => {
  editorRef.value.deleteImage(false)
  resetForm()
}

// 重置表单
const resetForm = () => {
  form.value = {
    cover: '',
    category: '',
    tags: [],
    workflow: '',
    description: '',
    dependencies: [],
    dependencies_price: 0,
    price: 0,
    models: [],
    content: '',
    only_node: false,
    developer_agreement: false
  }
}

// 填充表单数据
const fillFormData = () => {
  form.value = JSON.parse(JSON.stringify(props.workflow))
  form.value.price = Number(props.workflow.price) || 0
  form.value.dependencies_price = props.workflow.dependencies
    .map((item) => item.price)
    .reduce((acc, num) => acc + num, 0)
  form.value.only_node = props.workflow.only_node === 1
}

// 监听弹窗打开时初始化数据
const handleOpen = async () => {
  await fetchWorkflows()
  await fetchModels()
  await fetchCategories()
  if (props.workflow) {
    fillFormData()
  }
}
</script>

<style lang="less" scoped>
.workflow-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.upload-demo {
  width: 100%;
  height: 100%;
  .upload-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    .upload-icon {
      font-size: 24px;
      color: var(--color-text-3);
    }
    .upload-text {
      margin-top: 8px;
      font-size: 12px;
      color: var(--color-text-3);
    }
  }
}

.tag-wrapper {
  display: flex;
  flex-wrap: wrap;
  min-height: 32px;
  .selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-right: 8px;
    margin-bottom: 8px;
  }
}
.cover-upload {
  width: 160px;
  height: 160px;
  :deep(.arco-upload-list-picture) {
    width: 160px;
    height: 160px;
  }
  :deep(.arco-upload-list-picture-mask) {
    line-height: 160px;
  }
  :deep(.upload-button) {
    width: 160px;
    height: 160px;
  }
}
.editor-wrapper {
  height: 400px;
  width: 100%;
  border-radius: var(--border-radius-small);
  overflow: hidden;
}
</style>
