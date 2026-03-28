<template>
  <div class="ps5-container">
    <header>首 頁</header>

    <div class="scroller-container" ref="scroller">
      <div class="game-items-list">
        <div 
          v-for="game in games" 
          :key="game.id"
          class="game-card" 
          :class="{ active: lastHoveredId === game.id }"
          :data-url="game.url"
          ref="gameCardRefs"
        >
          <img :src="game.image" :alt="game.title">
          <div class="game-title">{{ game.title }}</div>
        </div>
      </div>
    </div>

    <div 
      id="cursor" 
      :class="{ hovering: isHovering, pinching: isPinching }"
      :style="cursorPositionStyle"
    ></div>
    
    <video ref="videoRef" id="video-input" autoplay playsinline></video>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

const router = useRouter();

// --- 資料定義 ---
const games = [
  //{ id: 'elden', title: 'Elden Ring', image: 'https://image.api.playstation.com/vulcan/ap/rnd/202110/2000/aGhoX9b74pS2p2ycgXPkr7vC.png', url: '/run' },
  //{ id: 'gow', title: 'God of War Ragnarök', image: 'https://image.api.playstation.com/vulcan/ap/rnd/202207/1210/675F7T8v02Q0M9VjYInBInM3.png', url: '/gow' },
  //{ id: 'spidey', title: 'Spider-Man 2', image: 'https://image.api.playstation.com/vulcan/ap/rnd/202306/1219/62254d3b644e5914101a1c905398a1f2.png', url: '/spidey' },
  //{ id: 'tlou', title: 'The Last of Us Part I', image: 'https://image.api.playstation.com/vulcan/ap/rnd/202206/0720/XFFBOfB0yOrF1bUjFv3A021p.png', url: '/tlou' },
  { id: 'photo', title: 'AI 照相館', image: 'https://images.unsplash.com/photo-1520390138845-fd2d229dd553?q=80&w=600', url: '/photo' },
];

// --- 狀態定義 ---
const videoRef = ref(null);
const scroller = ref(null);
const lastHoveredId = ref(null);
const isHovering = ref(false);
const isPinching = ref(false);

const currentPos = ref({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
const targetPos = ref({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
let wasPinching = false;
let cameraInstance = null;
const lerpFactor = 0.15;

// --- 計算屬性 ---
const cursorPositionStyle = computed(() => ({
  left: `${currentPos.value.x}px`,
  top: `${currentPos.value.y}px`
}));

// --- MediaPipe 處理 ---
const onResults = (results) => {
  if (results.multiHandLandmarks && results.multiHandLandmarks[0]) {
    const landmarks = results.multiHandLandmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    // 更新目標座標 (鏡像處理)
    targetPos.value.x = (1 - indexTip.x) * window.innerWidth;
    targetPos.value.y = indexTip.y * window.innerHeight;

    // 計算捏合
    const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    isPinching.value = distance < 0.06;
  }
};

const animationLoop = () => {
  // 1. 平滑移動
  currentPos.value.x += (targetPos.value.x - currentPos.value.x) * lerpFactor;
  currentPos.value.y += (targetPos.value.y - currentPos.value.y) * lerpFactor;

  // 2. 碰撞偵測 (Hit Testing)
  const elementUnderCursor = document.elementFromPoint(currentPos.value.x, currentPos.value.y);
  const hoveredCard = elementUnderCursor ? elementUnderCursor.closest('.game-card') : null;

  if (hoveredCard) {
    const gameUrl = hoveredCard.dataset.url;
    const game = games.find(g => g.url === gameUrl);
    
    if (game && lastHoveredId.value !== game.id) {
      lastHoveredId.value = game.id;
      isHovering.value = true;
      hoveredCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  } else {
    lastHoveredId.value = null;
    isHovering.value = false;
  }

  // 3. 跳轉邏輯 (Edge Detection)
  if (isPinching.value && !wasPinching) {
    if (lastHoveredId.value) {
      const targetUrl = games.find(g => g.id === lastHoveredId.value)?.url;
      if (targetUrl) {
        // 使用 Vue Router 進行導航
        setTimeout(() => router.push(targetUrl), 200);
      }
    }
  }

  wasPinching = isPinching.value;
  requestAnimationFrame(animationLoop);
};

// --- 生命週期 ---
onMounted(() => {
  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
  });

  hands.onResults(onResults);

  if (videoRef.value) {
    cameraInstance = new Camera(videoRef.value, {
      onFrame: async () => await hands.send({ image: videoRef.value }),
      width: 640,
      height: 480
    });
    cameraInstance.start();
  }

  animationLoop();
});

onUnmounted(() => {
  if (cameraInstance) {
    cameraInstance.stop(); // 重要：離開頁面時停止攝影機，釋放 WASM 資源
  }
});
</script>

<style scoped>
.ps5-container {
  --ps-blue: #0072ce;
  --bg-color: #050505;
  --card-width: 300px;
  --card-height: 170px;
  margin: 0;
  background-color: var(--bg-color);
  color: white;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

header {
  padding: 30px 60px;
  font-size: 24px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.scroller-container {
  flex: 1;
  display: flex;
  align-items: center;
  overflow-x: auto;
  padding: 0 10%;
  scroll-behavior: smooth;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}

.scroller-container::-webkit-scrollbar { display: none; }

.game-items-list {
  display: flex;
  gap: 40px;
  padding: 50px 0;
}

.game-card {
  flex: 0 0 var(--card-width);
  height: var(--card-height);
  background-color: #1a1a1a;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
  border: 4px solid transparent;
  scroll-snap-align: center;
}

.game-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.game-title {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 15px;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  font-size: 18px;
}

.game-card.active {
  transform: scale(1.15) translateY(-15px);
  border-color: white;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 15px rgba(255, 255, 255, 0.3);
  z-index: 5;
}

#cursor {
  width: 25px;
  height: 25px;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  position: fixed;
  pointer-events: none;
  z-index: 999;
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.5), 0 0 30px var(--ps-blue);
  transform: translate(-50%, -50%);
  transition: background-color 0.2s ease, transform 0.2s ease;
}

#cursor.pinching {
  transform: translate(-50%, -50%) scale(0.7);
  background-color: var(--ps-blue);
}

#video-input {
  position: fixed;
  bottom: 10px;
  right: 10px;
  width: 150px;
  border-radius: 8px;
  transform: scaleX(-1);
  opacity: 0.5;
  z-index: 100;
}
</style>