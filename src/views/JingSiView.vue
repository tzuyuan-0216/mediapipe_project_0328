<template>
  <div id="container">
    
    <Transition name="fade">
      <div v-if="showGuide" id="guide-overlay">
        <div class="guide-box">
          <h2>互動式靜思語</h2>
          
          <div class="guide-steps">
            <div class="step-item">
              <div class="step-icon">🧘‍♂️</div>
              <h3>1. 靜心合掌彎腰</h3>
              <p>在鏡頭前挺直身體，然後做一個<strong>「向前彎腰」</strong>的動作，即可隨機觸發靜思語動畫。</p> <!--與銅鑼聲-->
            </div>
            
            <div class="step-item">
              <div class="step-icon">🖐️</div>
              <h3>2. 舉起右手控制</h3>
              <p>舉起右手，畫面上會出現<strong>圓點游標</strong>。將游標對準左上角按鈕，做出<strong>「捏合或握拳」</strong>手勢即可返回。</p>
            </div>
          </div>
            嘗試將圓點移到「開始體驗」按鈕上！<br><br>
          <button 
            id="btn-start" 
            class="start-btn" 
            :class="{ active: isHoveringStart }" 
            @click="closeGuide"
            >
            開始體驗
          </button>
        </div>
      </div>
    </Transition>

    <button 
      id="btn-back" 
      class="back-btn" 
      :class="{ active: isHoveringBack }"
      @click="goBack"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      <span>回上頁</span>
    </button>

    <img id="bg-img" src="@/assets/靜思語封面.jpg" alt="背景圖">
    
    <div id="canvas-container">
      <canvas ref="canvasRef"></canvas>
    </div>

    <video id="input_video" muted playsinline></video>
    
    <video 
      ref="mainVideoRef" 
      id="video-player"
      @ended="handleVideoEnded"
    ></video>
    
    <audio ref="bellSoundRef" src="@/assets/銅鑼聲.mp3"></audio>

    <div 
      id="cursor" 
      :style="{ left: cX + 'px', top: cY + 'px' }"
      :class="{ pinching: isPinching }"
    >
      <div class="cursor-core"></div>
    </div>
    
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
// 1. 只保留 Pose 模型，完全移除 Hands 以防 Wasm 記憶體衝突
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

const router = useRouter();

// DOM 元素引用
const canvasRef = ref(null);
const mainVideoRef = ref(null);
const bellSoundRef = ref(null);
const showGuide = ref(true);         // 預設開啟說明視窗
const isHoveringStart = ref(false);  // 是否懸停在開始體驗按鈕上
// 狀態管理
const isPlaying = ref(false);
let poseInstance = null;
let cameraInstance = null;
let canvasCtx = null;

// 虛擬游標與懸停狀態管理
let tX = window.innerWidth / 2, tY = window.innerHeight / 2;
const cX = ref(tX), cY = ref(tY);
const isPinching = ref(false);
let wasPinching = false;
const isHoveringBack = ref(false);
let isActive = true;

function goBack() {
  isActive = false;
  if (cameraInstance) cameraInstance.stop();
  if (router) {
    router.push('/');
  } else {
    window.history.back();
  }
}

// 核心控制循環（負責游標平滑化與碰撞偵測）
const loop = () => {
  if (!isActive) return;

  cX.value += (tX - cX.value) * 0.15;
  cY.value += (tY - cY.value) * 0.15;

  const el = document.elementFromPoint(cX.value, cY.value);
  
  // 1. 檢查回上頁按鈕
  const hoverBack = el?.closest('#btn-back');
  isHoveringBack.value = !!hoverBack;

  // 2. 新增：檢查開始體驗按鈕
  const hoverStart = el?.closest('#btn-start');
  isHoveringStart.value = !!hoverStart; // 👈 補上這一行！
  // 當懸停在「開始體驗」按鈕上，且做出捏合動作時
  if (showGuide.value && hoverStart && isPinching.value && !wasPinching) {
    closeGuide();
  }

  // 當懸停在「回上頁」按鈕上，且做出捏合動作時
  if (!showGuide.value && hoverBack && isPinching.value && !wasPinching) {
    goBack();
    return;
  }

  wasPinching = isPinching.value;
  requestAnimationFrame(loop);
};

// 偵測結果處理
function onResults(results) {
  if (!results.poseLandmarks || !canvasRef.value || !canvasCtx) return;

  // 1. 繪製右下角小視窗
  const canvas = canvasRef.value;
  canvas.width = results.image.width;
  canvas.height = results.image.height;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
  drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
  drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2 });
  canvasCtx.restore();

  const lm = results.poseLandmarks;

  // ==========================================================================
  // 新增：利用 Pose 的手部節點轉換為虛擬游標與點擊手勢
  // MediaPipe Pose 節點: 19 代表左手腕, 20 代表右手腕
  // 這裡以使用者的右手（畫面上呈現的左側，也就是 node 20）作為控制滑鼠的準心
  // ==========================================================================
  const rightWrist = lm[20]; // 右手腕
  const rightIndex = lm[18]; // 右手食指尖 (Pose 18 接近食指區域)
  const leftWrist = lm[19];  // 左手腕 (備用)

  if (rightWrist) {
    // 鏡像對齊轉換，計算畫面的 X 軸與 Y 軸
    tX = (1 - rightWrist.x) * window.innerWidth;
    tY = rightWrist.y * window.innerHeight;

    // 手勢點擊判定：
    // 在 Pose 模型中，我們用「舉手且手掌高於肩膀/耳朵」或「手部快速向前探/收縮」來代表點擊。
    // 這邊使用最直覺的方式：當你把手抬高做「抓取」或「右手食指尖往右手腕靠近 (握拳)」時觸發點擊。
    // 如果食指尖與手腕的距離在畫面上明顯縮短，代表手部內縮或握拳，視為點擊 (Pinch)
    const handDistance = Math.hypot(rightIndex.x - rightWrist.x, rightIndex.y - rightWrist.y);
    isPinching.value = handDistance < 0.055; 
  }

  // 2. 原本的隨機影片觸發邏輯 (彎腰判定)
  const p11 = lm[11], p12 = lm[12], p23 = lm[23], p24 = lm[24];
  const w = results.image.width;
  const h = results.image.height;

  const dr = Math.hypot((p11.x - p23.x) * w, (p11.y - p23.y) * h);
  const dl = Math.hypot((p12.x - p24.x) * w, (p12.y - p24.y) * h);
  const shoulderWidth = Math.hypot((p11.x - p12.x) * w, (p11.y - p12.y) * h);
  const tb = (250 / 40) * shoulderWidth;

  if (!isPlaying.value && (dr < 70 && dr > 30) && (dl < 70 && dl > 30) && (tb > 400)) {
    triggerVideo();
  }
}

// 初始化偵測與相機的函式
function initMediaPipe() {
  const videoInput = document.getElementById('input_video');
  if (!canvasRef.value || !videoInput) return;
  
  canvasCtx = canvasRef.value.getContext('2d');

  poseInstance = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
  });

  poseInstance.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  poseInstance.onResults(onResults);

  cameraInstance = new Camera(videoInput, {
    onFrame: async () => {
      if (isActive && videoInput && poseInstance) {
        await poseInstance.send({ image: videoInput });
      }
    },
    width: 640,
    height: 480
  });
  
  cameraInstance.start();
  console.log("🚀 MediaPipe 單模型優化系統初始化成功！");
}
// 關閉說明視窗，此時才真正初始化相機 (避免一進頁面就被彈窗擋住卻在背景狂偵測)
function closeGuide() {
  showGuide.value = false;
  // initMediaPipe(); // 搬到這裡執行！
}
onMounted(() => {
  initMediaPipe();
  loop();
});

function triggerVideo() {
  if (!mainVideoRef.value) return;
  
  isPlaying.value = true;
  const num = Math.floor(Math.random() * 305 + 1).toString().padStart(3, '0');
  const videoPath = `/靜思語動畫_mp4/靜思語${num}.mp4`; 
  
  const mainVideo = mainVideoRef.value;
  mainVideo.src = videoPath;
  mainVideo.style.display = 'block';
  
  mainVideo.load(); 
  mainVideo.play().catch(error => {
    console.error("影片播放失敗:", error);
    mainVideo.style.display = 'none';
    isPlaying.value = false;
  });
}

function handleVideoEnded() {
  if (bellSoundRef.value) {
    bellSoundRef.value.play().catch(e => console.log("音效播放受限"));
  }

  setTimeout(() => {
    if (mainVideoRef.value) {
      mainVideoRef.value.style.display = 'none';
      mainVideoRef.value.src = ""; 
    }
    isPlaying.value = false;
  }, 1000); 
}

onUnmounted(() => {
  isActive = false;
  if (cameraInstance) cameraInstance.stop();
  if (poseInstance) poseInstance.close();
});
</script>

<style scoped>
#container { position: relative; width: 100vw; height: 100vh; background: #000; overflow: hidden; }
#bg-img { position: absolute; width: 100%; height: 100%; object-fit: cover; z-index: 1; }

/* 左上角回上頁按鈕樣式 */
.back-btn {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background-color: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(4px);
}

.back-btn.active {
  background-color: #ffffff;
  color: #000000;
  border-color: #ffffff;
  transform: scale(1.05);
}

/* 右下角預覽小視窗 */
#canvas-container {
  position: absolute; 
  bottom: 20px; 
  right: 20px; 
  width: 250px; 
  height: 150px;
  z-index: 10; 
  border: 2px solid white; 
  background: #222;
}
canvas { width: 100%; height: 100%; transform: scaleX(-1); } 
#input_video { display: none; }
#video-player {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  z-index: 20; display: none; background: black;
}

/* 藍白點雙層虛擬游標 CSS */
#cursor {
  position: fixed;
  width: 34px;
  height: 34px;
  background: rgba(255, 255, 255, 0.25);
  border: 2px solid #ffffff;
  border-radius: 50%;
  pointer-events: none;
  z-index: 999;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  transition: transform 0.15s ease, background-color 0.2s;
}

.cursor-core {
  width: 10px;
  height: 10px;
  background-color: #0072ce;
  border-radius: 50%;
  box-shadow: 0 0 8px #0072ce;
  transition: transform 0.15s ease, background-color 0.2s;
}

#cursor.pinching {
  transform: translate(-50%, -50%) scale(0.8);
  background: rgba(0, 114, 206, 0.2);
  border-color: #0072ce;
}

#cursor.pinching .cursor-core {
  transform: scale(1.3);
  background-color: #00ffcc;
  box-shadow: 0 0 12px #00ffcc;
}
/* ==========================================================================
   彈出說明視窗 CSS
   ========================================================================== */
#guide-overlay {
  position: absolute;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background-color: rgba(0, 0, 0, 0.75); 
  z-index: 100; 
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px); 
}

.guide-box {
  background: rgba(255, 255, 255, 0.95);
  padding: 40px;
  border-radius: 20px;
  width: 80%;
  max-width: 650px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

.guide-box h2 {
  color: #1a1a1a;
  margin-bottom: 30px;
  font-size: 28px;
}

.guide-steps {
  display: flex;
  gap: 30px;
  margin-bottom: 40px;
  text-align: left;
}

.step-item {
  flex: 1;
  background: #f5f7fa;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #e1e4e8;
}

.step-icon {
  font-size: 40px;
  margin-bottom: 10px;
}

.step-item h3 {
  margin: 0 0 10px 0;
  color: #0072ce;
  font-size: 18px;
}

.step-item p {
  margin: 0;
  color: #555;
  font-size: 14px;
  line-height: 1.6;
}

.start-btn {
  /* 顯著放大字體與按鈕面積 */
  padding: 18px 60px;          /* 增加上下與左右的填充範圍 */
  font-size: 24px;             /* 字體從 18px 放大到 24px */
  font-weight: 800;            /* 讓字體更粗、更醒目 */
  letter-spacing: 2px;         /* 稍微拉開字距，提升大字體的質感 */
  
  background-color: #0072ce;
  color: white;
  border: none;
  border-radius: 40px;         /* 隨著按鈕放大，圓角也微調成更流線的 40px */
  cursor: pointer;
  
  /* 增強陰影，讓按鈕更有立體浮空感 */
  box-shadow: 0 8px 25px rgba(0, 114, 206, 0.45);
  
  /* 讓動畫過渡在滑動時更流暢 */
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 當手勢游標或滑鼠碰觸到時的視覺反饋 */
.start-btn:hover,
.start-btn.active {
  background-color: #00569d;
  transform: scale(1.08);      /* 隔空手勢游標對準時，一樣能順利放大 1.08 倍！ */
  box-shadow: 0 12px 30px rgba(0, 114, 206, 0.6);
}

/* ==========================================================================
   Vue Transition "fade" 過場動畫效果樣式
   ========================================================================== */
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}
</style>