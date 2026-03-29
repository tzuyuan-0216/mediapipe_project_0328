<template>
  <div class="photo-booth">
    <div class="sidebar">
      <button 
        class="back-btn" 
        :class="{ active: isHoveringBack }"
        id="btn-back"
      >⬅ 返回首頁</button>
      
      <div class="hint-box">
        提示：張開手掌 2 秒自動拍照
      </div>

      <div class="gallery-container">
        <h3>🎞️ 拍攝紀錄</h3>
        <div class="gallery">
          <img v-for="(img, index) in photoGallery" :key="index" :src="img" alt="Captured Photo" />
        </div>
      </div>
    </div>

    <div class="main-display">
      <canvas ref="canvasRef"></canvas>
      <div v-if="isCounting" id="countdown">{{ countdownNumber }}</div>
    </div>

    <div 
      id="cursor" 
      :style="{ left: cX + 'px', top: cY + 'px' }"
      :class="{ pinching: isPinching }"
    ></div>
    <div id="flash" :style="{ opacity: flashOpacity }"></div>
    <video ref="videoRef" style="display:none" autoplay playsinline></video>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

const router = useRouter();

// --- DOM 引用 ---
const videoRef = ref(null);
const canvasRef = ref(null);

// --- 狀態管理 ---
const photoGallery = ref([]);
const isCounting = ref(false);
const countdownNumber = ref(3);
const flashOpacity = ref(0);
const isHoveringBack = ref(false);

// --- 座標與手勢狀態 ---
let tX = window.innerWidth / 2, tY = window.innerHeight / 2;
const cX = ref(tX), cY = ref(tY);
let isPinching = ref(false);
let wasPinching = false;
let isPalm = false;
let palmStart = 0;
let cameraInstance = null;
let isProcessing = false;
let isActive = true;

// --- MediaPipe 邏輯 ---
const onResults = (res) => {
  if (res.multiHandLandmarks && res.multiHandLandmarks[0]) {
    const marks = res.multiHandLandmarks[0];
    // 更新目標座標 (鏡像)
    tX = (1 - marks[8].x) * window.innerWidth;
    tY = marks[8].y * window.innerHeight;
    
    // 捏合偵測
    isPinching.value = Math.hypot(marks[4].x - marks[8].x, marks[4].y - marks[8].y) < 0.06;
    
    // 手掌偵測：食指與中指高度高於掌心
    isPalm = marks[8].y < marks[9].y - 0.1 && marks[12].y < marks[9].y - 0.1;
  }
};

const startShot = () => {
  isCounting.value = true;
  countdownNumber.value = 3;
  
  const timer = setInterval(() => {
    countdownNumber.value--;
    if (countdownNumber.value < 0) {
      clearInterval(timer);
      isCounting.value = false;
      
      // 閃光燈效果
      flashOpacity.value = 1;
      setTimeout(() => (flashOpacity.value = 0), 100);
      
      // 拍照並加入相簿
      const ctx = canvasRef.value.getContext('2d');
      const dataUrl = canvasRef.value.toDataURL('image/png');
      photoGallery.value.unshift(dataUrl);
    }
  }, 1000);
};

const loop = () => {
  if (!isActive) return; // 核心：如果組件已不活躍，立即中斷執行
  // 平滑游標移動
  cX.value += (tX - cX.value) * 0.15;
  cY.value += (tY - cY.value) * 0.15;
  
  // 繪製影像至畫布
  if (canvasRef.value && videoRef.value) {
    const canvas = canvasRef.value;
    const video = videoRef.value;
    
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    const ctx = canvas.getContext('2d');
    
    // 使用 drawImage 的切片功能，模擬 object-fit: cover 的效果
    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;
    const vAspect = vWidth / vHeight;
    const cAspect = canvas.width / canvas.height;

    let sx, sy, sw, sh;
    if (vAspect > cAspect) {
      sw = vHeight * cAspect;
      sh = vHeight;
      sx = (vWidth - sw) / 2;
      sy = 0;
    } else {
      sw = vWidth;
      sh = vWidth / cAspect;
      sx = 0;
      sy = (vHeight - sh) / 2;
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }

  // 返回按鈕碰撞偵測
  const el = document.elementFromPoint(cX.value, cY.value);
  const hoverBack = el?.closest('#btn-back');
  isHoveringBack.value = !!hoverBack;

  if (hoverBack && isPinching.value && !wasPinching) {
    isActive = false; // 跳轉前先停止運算
    if (cameraInstance) cameraInstance.stop();
    router.push('/');
  }

  // 自動拍照觸發
  if (isPalm && !isCounting.value) {
    if (!palmStart) palmStart = Date.now();
    else if (Date.now() - palmStart > 2000) {
      startShot();
      palmStart = 0;
    }
  } else {
    palmStart = 0;
  }

  wasPinching = isPinching.value;
  requestAnimationFrame(loop);
};

// --- 生命週期 ---
onMounted(() => {
  const hands = new Hands({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
  });
  
  hands.setOptions({ 
    maxNumHands: 1, 
    modelComplexity: 0, // 核心修復：從預設值改為 0 (Lite 版本)
    minDetectionConfidence: 0.7 
  });
  hands.onResults(onResults);

  if (videoRef.value) {
    cameraInstance = new Camera(videoRef.value, {
      onFrame: async () => {
        // 增加 video 寬高檢查與 isActive 檢查
        if (
          isActive && 
          !isProcessing && 
          videoRef.value?.readyState >= 2 && 
          videoRef.value?.videoWidth > 0 // 確保有實際像素內容
        ) {
          isProcessing = true;
          try {
            await hands.send({ image: videoRef.value });
          } catch (error) {
            console.error("MediaPipe 運算異常:", error);
          } finally {
            isProcessing = false;
          }
        }
      },
      width: 1280,
      height: 720
    });
    cameraInstance.start();
  }
  
  loop();
});

onUnmounted(() => {
  isActive = false; // 1. 先標記為不活躍，切斷 loop 執行
  if (cameraInstance) cameraInstance.stop(); // 離開頁面時停止攝影機
});
</script>

<style scoped>
.photo-booth {
  margin: 0;
  background: #000;
  color: white;
  font-family: sans-serif;
  overflow: hidden;
  position: relative; /* 改為相對定位 */
  width: 100vw;
  height: 100vh;
}

.sidebar {
  position: absolute; /* 改為絕對定位，浮在畫面上方 */
  left: 20px;
  top: 20px;
  bottom: 20px;
  width: 280px;
  background: rgba(0, 0, 0, 0.6); /* 增加透明度，可以看到後面的畫面 */
  backdrop-filter: blur(10px); /* 磨砂玻璃效果 */
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  z-index: 10; /* 確保在畫面上層 */
}

.back-btn {
  background: #333;
  color: white;
  border: none;
  padding: 15px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.3s;
}

.back-btn.active {
  background: white;
  color: black;
  transform: scale(1.05);
}

.hint-box {
  background: rgba(0, 114, 206, 0.2);
  padding: 15px;
  border-left: 4px solid #0072ce;
  border-radius: 4px;
  font-size: 14px;
}

.gallery-container h3 {
  font-size: 16px;
  margin-bottom: 10px;
  color: #aaa;
}

.gallery {
  display: flex;          /* 改用 flex 佈局 */
  flex-direction: column; /* 讓內容垂直排列 */
  gap: 15px;             /* 照片之間的間距 */
  overflow-y: auto;      /* 允許垂直捲動 */
  max-height: 65vh;      /* 調整最大高度，避免撐破側邊欄 */
  padding-right: 10px;   /* 為捲軸預留空間 */
}

.gallery::-webkit-scrollbar {
  width: 6px;
}
.gallery::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 10px;
}

.gallery img {
  width: 100%;           /* 寬度撐滿側邊欄容器 */
  border-radius: 12px;   /* 增加圓角更現代感 */
  border: 2px solid #333;
  transition: transform 0.3s ease;
}

.gallery img:hover {
  transform: scale(1.02); /* 游標滑過微幅放大 */
  border-color: var(--ps-blue);
}

.main-display {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1; /* 在底層 */
}

canvas {
  /* 關鍵：使用 object-fit 概念讓 Canvas 撐滿 */
  width: 100vw;
  height: 100vh;
  object-fit: cover; /* 確保影像填滿不留黑邊 */
  transform: scaleX(-1); /* 保持鏡像 */
}

#countdown {
  position: absolute;
  font-size: 150px;
  font-weight: 900;
  color: white;
  text-shadow: 0 0 20px rgba(0,0,0,0.5);
  pointer-events: none;
}

#cursor {
  width: 25px;
  height: 25px;
  background: white;
  border-radius: 50%;
  position: fixed;
  pointer-events: none;
  z-index: 999;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 15px #0072ce;
  transition: transform 0.1s, background-color 0.2s;
}

#cursor.pinching {
  transform: translate(-50%, -50%) scale(0.7);
  background-color: #0072ce;
}

#flash {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: white;
  pointer-events: none;
  z-index: 1000;
  transition: opacity 0.1s;
}
</style>