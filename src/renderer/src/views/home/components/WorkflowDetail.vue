<template>
  <div>
    <a-modal
      v-model:visible="visible"
      title="详情"
      :footer="false"
      hide-title
      :mask-closable="true"
      unmount-on-close
      width="auto"
      @before-open="handleOpen"
      :body-style="{ padding: 0 }"
    >
      <a-spin :loading="pageLoading">
        <a-button class="close-btn" type="text" @click="visible = false">
          <icon-close />
        </a-button>
        <div ref="modalBody" class="workflow-detail-modal-body">
          <a-affix :target="modalBody">
            <a-page-header
              :style="{ background: 'var(--color-bg-2)', padding: '16px 4px' }"
              :title="workflow?.name"
              :show-back="false"
              @back="visible = false"
            >
              <template #subtitle>
                <a-space>
                  <a-tag v-for="tag in workflow?.tags" :key="tag" size="small">
                    {{ tag }}
                  </a-tag>
                </a-space>
              </template>
            </a-page-header>
          </a-affix>
          <div class="workflow-detail scrollbar" v-if="workflow">
            <div class="detail-content">
              <!-- 左侧主图 -->
              <div class="cover-section">
                <a-image
                  :src="workflow.cover + '?imageView2/1/w/300/h/300' || '/default-cover.png'"
                  fit="cover"
                  width="100%"
                  height="100%"
                  :preview="false"
                />
              </div>

              <!-- 右侧信息 -->
              <div class="info-section">
                <!-- 分类 -->
                <div class="category">
                  <h5>简介</h5>
                  <a-typography-paragraph class="description-content" :ellipsis="{ rows: 4 }">
                    {{ workflow.description }}
                  </a-typography-paragraph>
                </div>
                <div class="price-downloads">
                  <div class="price-downloads-content">
                    <span class="price" :class="workflow.price > 0 ? 'paid' : 'free'">
                      {{ workflow.price > 0 ? `${workflow.price} 积分` : '免费' }}
                    </span>
                    &nbsp;
                    <a-link status="warning" :hoverable="false" @click="showDependencies = true">
                      <small v-if="realDependenciesPrice > 0">
                        <span>额外需要 </span>
                        <span> {{ realDependenciesPrice }} 依赖积分</span>
                      </small>
                    </a-link>
                  </div>
                  <span class="downloads">
                    <IconDownload /> {{ workflow.downloads || 0 }}人兑换
                  </span>
                </div>
                <div class="prop">
                  <a-space>
                    <a-space>
                      <icon-common v-if="workflow.only_node" />
                      <icon-branch v-else />
                      插件类型：{{ workflow.only_node ? '节点' : '工作流' }}
                    </a-space>
                    <a-divider direction="vertical" />
                    <a-space>
                      <icon-relation />
                      内部节点：{{ workflow.nodes_count }} 个
                    </a-space>
                    <a-divider direction="vertical" />
                    <a-space>
                      <icon-storage />
                      数据表：{{ workflow.models?.length }} 个
                    </a-space>
                  </a-space>
                </div>

                <div class="app-version">
                  软件版本要求：<a-tag size="small" bordered>
                    <b>V{{ workflow.app_version || '1.0.0' }}</b>
                  </a-tag>
                  及以上<a-divider direction="vertical" />
                  <a-tag v-if="!isVersionMatch" color="red" size="small" bordered>
                    当前版本 &nbsp;<b>v{{ appVersion }}</b> &nbsp;低于要求版本，无法使用
                  </a-tag>
                  <a-tag v-else color="green" size="small" bordered>
                    当前版本 &nbsp;<b>v{{ appVersion }}</b> &nbsp;符合要求
                  </a-tag>
                </div>
                <!-- 操作按钮 -->
                <div class="actions">
                  <a-popconfirm
                    v-if="workflow.only_node && isAuthor"
                    content="将节点类型的插件以工作流的形式导入? 该功能仅作者本人能看到!"
                    @ok="handleUse"
                  >
                    <a-button type="primary" size="medium" :loading="loading">
                      <icon-branch />
                      导入
                    </a-button>
                  </a-popconfirm>
                  <a-popconfirm
                    v-if="!workflow?.is_purchased"
                    content="立即兑换此插件?"
                    @ok="handlePurchase"
                  >
                    <template #icon>
                      <icon-check-circle />
                    </template>
                    <template v-if="workflow.price + realDependenciesPrice > 0" #content>
                      您即将消耗
                      <b>
                        <a-typography-text type="danger">
                          {{ workflow.price + realDependenciesPrice }}
                          积分
                        </a-typography-text>
                      </b>
                      <a-link
                        status="warning"
                        @click="showDependencies = true"
                        v-if="realDependenciesPrice > 0"
                      >
                        <small>
                          ( 插件:{{ workflow.price }} + 依赖:{{ realDependenciesPrice }} )
                        </small>
                      </a-link>
                      <br />
                      兑换此插件，确认后积分无法退回，是否继续？
                    </template>
                    <a-button
                      type="primary"
                      size="medium"
                      :loading="loading"
                      :disabled="!isVersionMatch"
                    >
                      <icon-check-circle />
                      立即兑换
                    </a-button>
                  </a-popconfirm>
                  <template v-else>
                    <template v-if="storeScene !== 'nodeList'">
                      <a-popconfirm content="将插件以工作流的形式导入?" @ok="handleUse">
                        <a-button
                          type="primary"
                          size="medium"
                          :loading="loading"
                          :disabled="workflow.only_node || !isVersionMatch"
                        >
                          <template v-if="workflow.only_node">
                            <icon-common />
                            仅作为节点使用
                          </template>
                          <template v-else>
                            <icon-branch />
                            立即导入
                          </template>
                        </a-button>
                      </a-popconfirm>
                    </template>
                    <template v-else>
                      <a-button type="primary" size="medium" disabled>
                        <icon-common />
                        请返回至节点列表使用
                      </a-button>
                    </template>
                    <a-popconfirm
                      v-if="workflow.models?.length"
                      content="导入数据表?"
                      @ok="handleImportModel"
                    >
                      <a-button type="primary" size="medium" :disabled="!isVersionMatch">
                        <icon-storage />
                        导入数据表
                      </a-button>
                    </a-popconfirm>
                  </template>
                  <a-popover title="举报有奖">
                    <template #content>
                      <a-typography-paragraph>
                        哪些属于违规插件？
                        <br />
                        <a-typography-paragraph
                          v-for="(item, index) in reportType"
                          :key="index"
                          style="margin-bottom: 0px"
                        >
                          {{ index + 1 }}、{{ item }}
                        </a-typography-paragraph>
                        <a-divider style="margin: 5px 0px" />
                        1、成功举报后将获得积分奖励<br />
                        <a-typography-paragraph type="danger">
                          2、恶意举报有可能被封号
                        </a-typography-paragraph>
                      </a-typography-paragraph>
                    </template>
                    <a-button
                      type="primary"
                      status="warning"
                      size="medium"
                      @click="reportVisible = true"
                    >
                      <icon-exclamation-circle />
                      举报有奖
                    </a-button>
                  </a-popover>
                </div>
              </div>
              <!-- 作者信息 -->
              <div class="author-info">
                <a-space direction="vertical" align="center" class="author-info-content">
                  <a-avatar :size="100" :image-url="workflow.author_info.avatar" />
                  <a-typography-paragraph style="margin: 0px">
                    {{ workflow.author_info.nickname }}
                  </a-typography-paragraph>
                  <a-typography-paragraph style="margin: 0px" :ellipsis="{ rows: 3 }">
                    {{ workflow.author_info.signed }}
                  </a-typography-paragraph>
                  <a-space>
                    <a-tag size="small"> 发布量：{{ workflow.author_info.total_publish }} </a-tag>
                    <a-tag size="small"> 兑换量：{{ workflow.author_info.total_exchanges }} </a-tag>
                  </a-space>
                  <a-space v-if="storeScene !== 'nodeDetail'">
                    <a-button
                      title="查看作者发布的所有插件"
                      type="primary"
                      size="medium"
                      @click="handleAllWorkflow"
                    >
                      <icon-branch />
                      全部插件
                    </a-button>
                    <a-button
                      title="通过QQ联系作者"
                      type="primary"
                      size="medium"
                      :loading="loading"
                      v-if="workflow.author_info.qq"
                      @click="handleContactWithQQ"
                    >
                      <icon-qq />
                    </a-button>
                    <a-button
                      title="通过邮箱联系作者"
                      type="primary"
                      size="medium"
                      :loading="loading"
                      v-if="workflow.author_info.email"
                      @click="handleContactWithEmail"
                    >
                      <icon-email />
                    </a-button>
                  </a-space>
                </a-space>
              </div>
            </div>
            <!-- 数据表 -->
            <div class="models" v-if="workflow.models?.length && workflow?.is_purchased">
              <h4>数据表</h4>
              <a-collapse>
                <a-collapse-item
                  v-for="model in workflow.models"
                  :key="model.id"
                  :header="model.name"
                >
                  <a-descriptions :column="4" :data="getModelFields(model)" />
                </a-collapse-item>
              </a-collapse>
            </div>
            <!-- 插件预览 -->
            <div class="preview">
              <h4>插件预览</h4>
              <div class="preview-wrapper">
                <FlowPreview class="preview-content" :workflow="workflow" />
              </div>
            </div>
            <div class="content" v-if="workflow.content">
              <!-- <h4>插件详情</h4> -->
              <div class="editor-content-view" v-html="workflow.content"></div>
            </div>
          </div>
        </div>
      </a-spin>
    </a-modal>

    <!-- 获取积分弹窗 -->
    <a-modal v-model:visible="rechargeVisible" title="获取积分" :footer="false">
      <div v-html="rechargeInfo"></div>
    </a-modal>
    <!-- 举报弹窗 -->
    <a-modal v-model:visible="reportVisible" title="举报" width="700px" @before-ok="handleReport">
      <a-space wrap>
        <a-button
          v-for="(item, index) in reportType"
          :key="index"
          :value="index"
          @click="reportInfo = item"
        >
          {{ item }}
        </a-button>
      </a-space>
      <a-textarea v-model="reportInfo" style="height: 150px;margin-top: 16px;" placeholder="请输入举报内容" />
    </a-modal>

    <!-- 依赖列表 -->
    <a-modal v-model:visible="showDependencies" title="依赖列表" width="1000px" :footer="false">
      <a-alert style="margin-bottom: 16px" type="warning">
        说明：因为该插件使用了以下插件，所以需要同时兑换这些插件，如果之前已经兑换过，则不再扣除积分
      </a-alert>

      <a-table :data="workflow?.dependencies" :pagination="false">
        <template #columns>
          <a-table-column title="名称" data-index="name" />
          <a-table-column title="描述" data-index="description" />
          <a-table-column title="积分" data-index="price" :width="80" />
          <a-table-column title="兑换" data-index="status" :width="80" align="center">
            <template #cell="{ record }">
              <a-tag v-if="myPurchases.includes(record.id)" color="green">已兑换</a-tag>
              <a-tag v-else color="red">未兑换</a-tag>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { Message } from '@arco-design/web-vue'
import {
  IconDownload,
  IconCommon,
  IconClose,
  IconCheckCircle,
  IconQq,
  IconExclamationCircle,
  IconBranch,
  IconEmail,
  IconRelation,
  IconStorage
} from '@arco-design/web-vue/es/icon'
import FlowPreview from '@/workflow/components/FlowPreview.vue'
import { getAppVersion, compareVersion } from '@/utils/version'
import { useStore } from '@/store'

import {
  getStoreWorkflowDetail,
  reportStoreWorkflow,
  purchaseStoreWorkflow,
  useStoreWorkflow,
  getMyPurchases
} from '@/api/workflowStore'

const modalBody = ref(null)
const visible = defineModel('visible')
const emit = defineEmits(['author-all-workflow', 'purchase-success'])

// 工作流数据
const workflow = ref(null)
const loading = ref(false)

const storeScene = inject('storeScene', 'store')

const isAuthor = computed(() => {
  const { userInfo } = useStore()
  return userInfo?.username === workflow.value?.author_info?.username
})

// 软件版本
const appVersion = getAppVersion()
const isVersionMatch = computed(() => {
  return compareVersion(appVersion, workflow.value?.app_version || '1.0.0') >= 0
})

// 接收工作流ID
const props = defineProps({
  workflowId: {
    type: [String, Number],
    required: true
  }
})

const reportType = ref([
  '含有违法违规、政治敏感信息',
  '含有广告、营销等商业信息',
  '含有侵犯他人权益的信息',
  '含有色情、赌博、暴力等不良信息',
  '含有病毒、木马等恶意脚本或动作',
  '含有其他违规信息'
])
const reportVisible = ref(false)
const reportInfo = ref('')

const handleReport = async (done) => {
  if (!reportInfo.value) {
    Message.error('请输入举报内容')
    done(false)
    return
  }
  try {
    await reportStoreWorkflow({
      id: props.workflowId,
      name: workflow.value.name,
      reason: reportInfo.value
    })
    Message.success('举报成功，我们将尽快处理')
    reportInfo.value = ''
    done()
  } catch (error) {
    done(false)
  }
}

// 依赖列表
const showDependencies = ref(false)

// 我的兑换记录
const myPurchases = ref([])
const fetchMyPurchases = async () => {
  const data = await getMyPurchases({
    workflow_id: props.workflowId,
    page: 1,
    pageSize: 10000
  })
  myPurchases.value = data.list.map((item) => item.id)
}

// 计算实际需要兑换的依赖积分
const realDependenciesPrice = computed(() => {
  return workflow.value.dependencies
    .filter((item) => !myPurchases.value.includes(item.id))
    .reduce((acc, curr) => acc + curr.price, 0)
})

// 页面加载时获取插件详情
const handleOpen = async () => {
  reportInfo.value = ''
  fetchWorkflowDetail()
  fetchMyPurchases()
}

// 查看作者所有插件
const handleAllWorkflow = async () => {
  visible.value = false
  emit('author-all-workflow', {
    username: workflow.value.author_info.username,
    nickname: workflow.value.author_info.nickname
  })
}

// 联系作者
const handleContactWithQQ = async () => {
  window.open(`tencent://message/?uin=${workflow.value.author_info.qq}`)
}

const handleContactWithEmail = async () => {
  window.open(`mailto:${workflow.value.author_info.username}`)
}

// 获取插件详情
const pageLoading = ref(false)
const fetchWorkflowDetail = async () => {
  try {
    pageLoading.value = true
    loading.value = true
    const data = await getStoreWorkflowDetail(props.workflowId)
    workflow.value = data
  } catch (error) {
    visible.value = false
  } finally {
    pageLoading.value = false
    loading.value = false
  }
}

const rechargeVisible = ref(false)
const rechargeInfo = ref('')

// 兑换插件
const handlePurchase = async () => {
  try {
    loading.value = true
    await purchaseStoreWorkflow({
      id: workflow.value.id
    })
    Message.success('兑换成功')
    workflow.value.is_purchased = true
    emit('purchase-success')
  } catch (error) {
  } finally {
    loading.value = false
  }
}

//导入数据表
const handleImportModel = async () => {
  for (const model of workflow.value.models) {
    await window.electronAPI.data.createModel({
      name: model.name,
      description: model.description,
      fields: JSON.parse(JSON.stringify(model.fields))
    })
  }
  Message.success('数据表导入成功')
}
// 使用插件
const handleUse = async () => {
  try {
    loading.value = true
    await useStoreWorkflow({
      id: workflow.value.id
    })
    Message.success('工作流导入成功，请切换到工作流管理页面查看')
    visible.value = false
  } finally {
    loading.value = false
  }
}

// 获取模型字段描述
const getModelFields = (model) => {
  return model.fields.map((field) => ({
    label: field.description,
    value: `${field.name} (${getFieldTypeName(field.type)})${
      field.required ? ' *' : ''
    }${field.unique ? ' 唯一' : ''}`
  }))
}

// 获取字段类型名称
const getFieldTypeName = (type) => {
  const typeMap = {
    string: '文本',
    number: '数字',
    boolean: '布尔',
    array: '数组',
    object: '对象'
  }
  return typeMap[type] || type
}
</script>

<style lang="less" scoped>
.workflow-detail-modal-body {
  padding: 0px;
  width: 1200px !important;
  overflow: auto;
  border-radius: 16px;
}

:deep(.arco-page-header-wrapper) {
  padding: 0 16px;
}

.workflow-detail {
  max-height: 80vh;
  overflow: auto;
  padding: 0 20px 20px 20px;
  .detail-content {
    display: flex;
    margin-bottom: 24px;

    .cover-section {
      width: 300px;
      height: 300px;
      overflow: hidden;
      margin-right: 24px;
      border-radius: 4px;
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .info-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;

      h4 {
        margin: 0 0 10px;
        font-size: 20px;
        font-weight: bold;
        color: var(--color-text-1);
      }

      .price-downloads {
        display: flex;
        gap: 24px;
        align-items: center;
        margin-bottom: 10px;
        height: 40px;
        .price {
          font-size: 18px;
          font-weight: bold;

          &.paid {
            color: #ff4d4f;
          }

          &.free {
            color: #52c41a;
          }
        }

        .downloads {
          color: var(--color-text-3);
          display: flex;
          align-items: center;
          gap: 4px;

          svg {
            font-size: 18px;
          }
        }
      }
      .app-version {
        margin-bottom: 16px;
      }

      .prop {
        margin-bottom: 16px;
      }

      .tags {
        margin-bottom: 10px;

        h5 {
          margin-bottom: 4px;
          font-size: 18px;
          font-weight: bold;
          color: var(--color-text-2);
        }

        .arco-tag {
          margin-bottom: 8px;
        }
      }

      .category {
        margin-bottom: 10px;
        flex: 1;
        h5 {
          margin-bottom: 4px;
          font-size: 18px;
          font-weight: bold;
          color: var(--color-text-2);
        }

        p {
          margin: 0;
          color: var(--color-text-3);
        }
      }

      .actions {
        display: flex;
        gap: 10px;
      }
    }
    .author-info {
      width: 300px;
      margin-left: 24px;
      h5 {
        margin-bottom: 4px;
        font-size: 18px;
        font-weight: bold;
      }
      .author-info-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }
    }
  }

  .description {
    margin-bottom: 24px;

    h4 {
      margin: 0 0 12px;
      font-size: 22px;
      font-weight: bold;
      color: var(--color-text-1);
    }

    p {
      margin: 0;
      color: var(--color-text-3);
    }
  }

  .models {
    margin-bottom: 24px;

    h4 {
      margin: 0 0 12px;
      font-size: 22px;
      font-weight: bold;
      color: var(--color-text-1);
    }

    .arco-collapse-item-header {
      font-size: 18px;
      font-weight: bold;
      color: var(--color-text-2);
    }

    .arco-descriptions-item-label {
      font-weight: bold;
      color: var(--color-text-2);
    }

    .arco-descriptions-item-value {
      color: var(--color-text-3);
    }
  }
  .preview {
    width: 100%;
    height: 800px;
    h4 {
      margin: 0 0 12px;
      font-size: 22px;
      font-weight: bold;
      color: var(--color-text-1);
    }
    .preview-wrapper {
      width: 100%;
      height: 90%;
      border: 1px solid var(--color-border-2);
      border-radius: 8px;
    }
  }
  .content {
    h4 {
      margin: 0 0 12px;
      font-size: 22px;
      font-weight: bold;
      color: var(--color-text-1);
    }
    :deep([data-slate-editor]) {
      user-select: text;
      padding: 0px;
    }
  }
}

.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  border-radius: var(--border-radius-small);
  height: 32px;
  width: 32px;
  padding: 0;
}
</style>
