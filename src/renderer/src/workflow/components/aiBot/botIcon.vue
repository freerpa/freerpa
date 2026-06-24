<template>
  <div class="ai-assistant-btn">
    <div :class="{ 'ai-robot-wrap': showBackground }">
      <div class="robot-container">
        <!-- 机器人头部 -->
        <div class="robot-head">
          <!-- 头顶天线 -->
          <div class="robot-antenna"></div>
          <!-- 两侧耳麦 -->
          <div class="robot-ear left"></div>
          <div class="robot-ear right"></div>
          <!-- 视窗+眼睛 -->
          <div class="robot-visor">
            <div class="robot-eyes">
              <div class="robot-eye left"></div>
              <div class="robot-eye right"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  showBackground: {
    type: Boolean,
    default: true
  }
})
</script>
<style scoped lang="less">
/* 悬浮按钮容器 */
.ai-assistant-btn {
  width: 100%;
  height: 100%;
  z-index: 999;
  cursor: pointer;
}

/* 解决背景冲突：改用纯色底+渐变光环，而非渐变填充 */
.ai-robot-wrap {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  /* 主体纯色（参考图白色底），避免和机器人冲突 */
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 外层渐变光环替代渐变背景 */
  box-shadow:
    0 0 0 2px rgba(22, 93, 255, 0.2),
    0 0 30px rgba(22, 93, 255, 0.4),
    0 0 45px rgba(255, 125, 0, 0.2);
  position: relative;
  overflow: hidden;
  transition: transform 0.3s ease;
  /* 仅保留呼吸缩放，移除渐变流动避免冲突 */
  animation: breathe 3.5s ease-in-out infinite;
}

/* 外层渐变光环动画（绕外圈旋转，不干扰主体） */
.ai-robot-wrap::before {
  content: '';
  position: absolute;
  width: 120%;
  height: 120%;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, #165dff, #ff7d00, transparent);
  z-index: -1;
  animation: rotate 8s linear infinite;
  opacity: 0.7;
}

/* 悬停放大 */
.ai-robot-wrap:hover {
  transform: scale(1.08);
}

/* 呼吸缩放（更柔和） */
@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.03);
  }
}

/* 光环旋转 */
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ========== 精准还原参考图的机器人 ========== */
.robot-container {
  width: 52px;
  height: 52px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
}

/* 机器人头部（比例优化：更圆润、更贴合参考图） */
.robot-head {
  width: 48px;
  height: 44px;
  background: #ffffff;
  border-radius: 16px;
  position: relative;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
  border: 2px solid #e8f3ff;
}

/* 头部蓝色视窗边框（1:1还原参考图） */
.robot-visor {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 38px;
  height: 28px;
  background: #0a1a2f; /* 参考图黑色视窗底 */
  border-radius: 10px;
  border: 3px solid #165dff; /* 蓝色边框 */
  box-sizing: border-box;
  overflow: hidden;
}

/* 头顶天线（比例优化：更纤细，贴合参考图） */
.robot-antenna {
  position: absolute;
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 6px;
  background: #165dff;
  z-index: 2;
}
.robot-antenna::after {
  content: '';
  position: absolute;
  top: -7px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 8px;
  background: #ff7d00;
  border-radius: 50%;
  box-shadow: 0 0 5px rgba(255, 125, 0, 0.6);
}

/* 两侧耳麦（精准还原参考图：蓝橙分层、圆润） */
.robot-ear {
  position: absolute;
  top: 14px;
  width: 6px;
  height: 16px;
  border-radius: 10px;
  background: #165dff;
  z-index: 1;
}
.robot-ear.left {
  left: -6px;
}
.robot-ear.right {
  right: -6px;
}
/* 耳麦橙色端头（参考图的橙蓝拼接） */
.robot-ear::after {
  content: '';
  position: absolute;
  width: 4px;
  height: 10px;
  border-radius: 8px;
  background: #ff7d00;
}
.robot-ear.left::after {
  left: -2px;
  top: 3px;
}
.robot-ear.right::after {
  right: -2px;
  top: 3px;
}

/* 眼睛容器（居中、间距优化） */
.robot-eyes {
  display: flex;
  gap: 4px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
}

/* 左眼（圆形发光眼，还原参考图） */
.robot-eye.left {
  width: 6px;
  height: 9px;
  background: linear-gradient(180deg, #87e8de, #00cffd);
  border-radius: 6px;
  box-shadow:
    0 0 8px rgba(0, 207, 253, 1),
    0 0 4px rgba(0, 207, 253, 0.8) inset;
  animation: blink 4s infinite;
}

/* 右眼（月牙形发光眼，精准还原参考图） */
.robot-eye.right {
  width: 8px;
  height: 9px;
  background: linear-gradient(180deg, #87e8de, #00cffd);
  border-radius: 50%;
  /* 月牙形状裁剪 */
  clip-path: polygon(15% 0, 100% 0, 100% 100%, 15% 100%, 40% 50%);
  box-shadow:
    0 0 8px rgba(0, 207, 253, 1),
    0 0 4px rgba(0, 207, 253, 0.8) inset;
  animation: blink 4s infinite;
}

/* 更自然的眨眼动画（幅度更柔和） */
@keyframes blink {
  0%,
  25%,
  29%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  27% {
    opacity: 0;
    transform: scale(1, 0.1);
  }
}
</style>
