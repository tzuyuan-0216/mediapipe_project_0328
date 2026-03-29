# 🎮 MediaPipe 互動式風格 UI 首頁 & AI 照相館

這是一個基於 **Vue 3** 與 **Vite** 開發的實驗性前端專案。本專案利用 **MediaPipe Hands** 實現了完全去滑鼠化的「無接觸手勢操作」體驗，模擬 PS5 系統介面，並整合了智慧感應拍照功能。

---

## ✨ 專案亮點

* **無接觸手勢控制**：透過食指與大拇指的「捏合 (Pinch)」動作來模擬滑鼠點擊，控制 UI 滾動與選單進入。
* **沉浸式 UI**：橫向捲動選單、動態背景縮放與精緻的圖示懸停效果。
* **AI 智能照相館**：
    * **全螢幕取景**：鏡頭畫面自動適應瀏覽器大小，提供沉浸式拍貼體驗。
    * **手勢自動觸發**：偵測到「張開手掌」持續 2 秒即可觸發 3 秒倒數自動拍照。
    * **垂直預覽清單**：拍完的照片會立即顯示在左側側邊欄，方便即時檢視。

---

## 🚀 快速啟動

### 1. 安裝環境與依賴
確保你的電腦已安裝 **Node.js**，接著在專案根目錄執行：

```bash
npm install

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
