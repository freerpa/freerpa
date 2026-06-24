/** * @file: 用户反馈组件 * @author: dabao * @date: 2024-03-29 */
<template>
  <a-card :bordered="false">
    <template #title>
      <div class="feedback-header">
        <div class="feedback-header-title">
          <span>反馈列表</span>
          <a-button type="text" @click="_getFeedbackList"> 刷新 </a-button>
        </div>
        <a-button type="primary" @click="showAddModal">意见反馈</a-button>
      </div>
    </template>
    <div class="feedback-content">
      <!-- 反馈列表 -->
      <a-table
        :data="feedbackList"
        :bordered="false"
        :pagination="pagination"
        @page-change="onPageChange"
        :loading="loading"
      >
        <template #columns>
          <a-table-column title="反馈类型" data-index="type" :width="100">
            <template #cell="{ record }">
              <a-tag :color="getTypeColor(record.type)">{{ record.type }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="反馈内容" data-index="content" />
          <a-table-column title="状态" data-index="status" :width="80">
            <template #cell="{ record }">
              <a-tag :color="getStatus(record.status).color">{{
                getStatus(record.status).status
              }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="反馈日期" data-index="create_time" :width="150" />
          <a-table-column title="详情" data-index="handle" :width="80" align="center">
            <template #cell="{ record }">
              <a-button type="text" @click="showDetail(record)"> 查看 </a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </div>

    <!-- 新增反馈弹窗 -->
    <a-modal
      v-model:visible="visible"
      title="意见反馈"
      @before-ok="handleSubmit"
      @cancel="handleCancel"
      unmount-on-close
    >
      <a-form :model="formData" ref="formRef" :rules="rules">
        <a-form-item field="type" label="反馈类型">
          <a-select v-model="formData.type" placeholder="请选择反馈类型">
            <a-option value="问题反馈">问题反馈</a-option>
            <a-option value="功能建议">功能建议</a-option>
            <a-option value="其他">其他</a-option>
          </a-select>
        </a-form-item>
        <a-form-item field="content" label="反馈内容">
          <a-textarea
            v-model="formData.content"
            placeholder="请输入反馈内容"
            :auto-size="{
              minRows: 5,
              maxRows: 10
            }"
          />
        </a-form-item>
        <a-form-item field="images" label="图片">
          <ImageUpload ref="imageUploadRef" v-model="formData.images" :limit="3" :fixed="false" />
        </a-form-item>
      </a-form>
    </a-modal>
    <a-modal v-model:visible="detailVisible" title="反馈详情" unmount-on-close>
      <a-space direction="vertical">
        <a-space>
          <span class="feedback-detail-label">反馈类型：</span>
          <a-tag :color="getTypeColor(detailData.type)">{{ detailData.type }}</a-tag>
        </a-space>
        <a-space>
          <span class="feedback-detail-label">反馈内容：</span>
          <span>{{ detailData.content }}</span>
        </a-space>
        <a-space>
          <span class="feedback-detail-label">反馈图片：</span>
          <span>
            <a-image-preview-group>
              <a-image
                v-for="image in detailData.images"
                :key="image"
                :src="image.url"
                :width="100"
              />
            </a-image-preview-group>
          </span>
        </a-space>
        <a-space>
          <span class="feedback-detail-label">反馈日期：</span>
          <span>{{ detailData.create_time }}</span>
        </a-space>
        <a-space>
          <span class="feedback-detail-label">反馈状态：</span>
          <a-tag :color="getStatus(detailData.status).color">{{
            getStatus(detailData.status).status
          }}</a-tag>
        </a-space>
        <a-space v-if="detailData.point">
          <span class="feedback-detail-label">奖励积分：</span>
          <span>{{ detailData.point }}</span>
        </a-space>
        <a-space v-if="detailData.handle_result">
          <span class="feedback-detail-label">处理结果：</span>
          <a-typography-text>
            {{ detailData.handle_result }}
          </a-typography-text>
        </a-space>
      </a-space>
    </a-modal>
  </a-card>
</template>

<script setup>
import { ref, reactive, onMounted, toRaw } from 'vue'
import { Message } from '@arco-design/web-vue'
import { getFeedbackList, addFeedback } from '@/api/user'
import ImageUpload from '../../../components/ImageUpload.vue'
// 表单ref
const formRef = ref(null)
const imageUploadRef = ref(null)
// 弹窗显示状态
const visible = ref(false)
// 表单数据
const formData = reactive({
  type: '问题反馈',
  content: '',
  images: []
})

// 表单校验规则
const rules = {
  type: [{ required: true, message: '请选择反馈类型' }],
  content: [{ required: true, message: '请输入反馈内容' }]
}

// 分页配置
const pagination = reactive({
  total: 0,
  current: 1,
  pageSize: 10
})

const detailVisible = ref(false)
const detailData = ref({})
const showDetail = (record) => {
  detailVisible.value = true
  detailData.value = record
}

// 反馈列表数据
const feedbackList = ref([])
const loading = ref(false)
const _getFeedbackList = async () => {
  loading.value = true
  const res = await getFeedbackList(pagination.current, pagination.pageSize)
  feedbackList.value = res.data
  pagination.total = res.total
  loading.value = false
}

onMounted(() => {
  _getFeedbackList()
})

// 显示新增弹窗
const showAddModal = () => {
  visible.value = true
}

// 处理提交
const handleSubmit = async (done) => {
  try {
    const valid = await formRef.value.validate()
    if (valid) {
      Message.error('验证失败')
      done(false)
      return
    }
    await imageUploadRef.value.upload()
    // TODO: 调用接口提交反馈
    await addFeedback(toRaw(formData))
    Message.success('提交成功')
    handleCancel()
    _getFeedbackList()
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

// 处理取消
const handleCancel = () => {
  visible.value = false
  formData.type = '问题反馈'
  formData.content = ''
  formData.images = []
}

// 处理分页变化
const onPageChange = (current) => {
  pagination.current = current
  // TODO: 调用接口获取对应页数据
}

// 获取类型对应的颜色
const getTypeColor = (type) => {
  const colorMap = {
    功能建议: 'blue',
    问题反馈: 'orange',
    其他: 'gray'
  }
  return colorMap[type] || 'gray'
}

// 获取状态对应的颜色和文本
const getStatus = (status) => {
  const colorMap = [
    {
      status: '待处理',
      color: 'orange'
    },
    {
      status: '已处理',
      color: 'green'
    },
    {
      status: '已关闭',
      color: 'red'
    }
  ]
  return colorMap[status]
}
</script>

<style lang="less" scoped>
.feedback-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  .feedback-header-title {
    display: flex;
    align-items: baseline;
    gap: 5px;
  }
}

.feedback-content {
  margin-top: 16px;
}

.feedback-detail-label {
  width: 80px;
}
</style>
