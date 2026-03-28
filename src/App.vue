<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <!-- RouterView 會根據當前網址，自動渲染對應的 View 元件 (如 HomeView 或 AboutView) -->
  <RouterView />
</template>

<style>
/* 這裡可以放全域樣式，例如清除邊距 */
body {
  margin: 0;
  padding: 0;
  font-family: sans-serif;
}
</style>
